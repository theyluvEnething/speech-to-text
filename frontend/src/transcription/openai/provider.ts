import type {
  TranscriptionProvider,
  TranscribeOptions,
  ProviderName,
} from "../types";

/**
 * Transcription provider using OpenAI's Whisper REST API.
 *
 * Uses the master OPENAI_API_KEY via process.env (main process) or
 * window.audio.getApiKey() (renderer). For realtime streaming with
 * ephemeral tokens, use the RealtimeTranscriber class from
 * groq/realtime-client.ts, which handles the full WebRTC flow and
 * runs in a BrowserWindow context.
 *
 * SECURITY NOTE: This provider reads the master API key directly.
 * For production, prefer the ephemeral-token flow via the backend's
 * POST /api/openai-client-secret endpoint + RealtimeTranscriber
 * (which keeps the master key server-side).
 */
export class OpenAIProvider implements TranscriptionProvider {
  readonly name: ProviderName = "openai";

  async transcribe(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    console.log(
      `[OpenAI] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}`,
    );

    if (audio.byteLength === 0) {
      throw new Error("No audio data provided to OpenAI provider");
    }

    const apiKey = this.getApiKey();
    console.log(
      `[OpenAI] API key source: ${typeof process !== "undefined" && process.env ? "process.env (main process)" : "window.audio (renderer)"}`,
    );

    // OpenAI Whisper REST API expects multipart/form-data with the
    // audio file, model, and optional language parameter.
    const formData = new FormData();
    const blob = new Blob([audio], { type: "audio/webm" });
    formData.append("file", blob, "audio.webm");
    formData.append("model", options.model || "whisper-1");
    formData.append("response_format", "json");

    if (options.language && options.language !== "auto") {
      formData.append("language", options.language);
      console.log(`[OpenAI] Language: ${options.language}`);
    } else {
      console.log("[OpenAI] Language: auto (server-side detection)");
    }

    console.log(`[OpenAI] Sending to OpenAI REST API — model: ${options.model || "whisper-1"}`);

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    );

    console.log(`[OpenAI] API response: HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[OpenAI] API error: ${errorBody}`);
      throw new Error(
        `OpenAI transcription failed (${response.status}): ${errorBody}`,
      );
    }

    const data = await response.json();
    const text = (data as { text?: string }).text?.trim() ?? "";

    console.log(`[OpenAI] Transcription result: "${text}" (${text.length} chars)`);
    return text;
  }

  /**
   * Resolves the OpenAI API key from the available environment.
   *
   * Main process: reads process.env.OPENAI_API_KEY
   * Renderer: uses window.audio.getApiKey() IPC bridge
   */
  private getApiKey(): string {
    // Main process — direct env access
    if (typeof process !== "undefined" && process.env) {
      const key = process.env["OPENAI_API_KEY"] || "";
      if (!key) {
        throw new Error(
          "OPENAI_API_KEY not set. Add it to your .env file or environment.",
        );
      }
      return key;
    }

    // This provider is typically called from the main process.
    // If we're in a renderer context, the caller should use
    // RealtimeTranscriber instead.
    throw new Error(
      "OpenAI provider requires process.env access (main process only). " +
      "For renderer-side transcription, use RealtimeTranscriber from " +
      "groq/realtime-client.ts which supports ephemeral tokens and WebRTC.",
    );
  }
}
