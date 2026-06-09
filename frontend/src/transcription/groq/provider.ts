import Groq, { toFile } from "groq-sdk";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { getTokenCache } from "../token-cache";

export class GroqProvider implements TranscriptionProvider {
  readonly name: ProviderName = "groq";
  private client: Groq | null = null;
  private lastKey: string | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(
      `[Groq] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}`,
    );

    const key = await getTokenCache().get("groq");

    if (!this.client || key !== this.lastKey) {
      console.log("[Groq] Creating Groq SDK client with token from cache.");
      this.client = new Groq({ apiKey: key });
      this.lastKey = key;
    }

    try {
      console.log(
        `[Groq] Sending to Groq API — model: ${options.model}, language: ${options.language}`,
      );

      const transcription = await this.client.audio.transcriptions.create({
        file: await toFile(Buffer.from(audio), "audio.webm"),
        model: options.model,
        language: options.language === "auto" ? undefined : options.language,
        response_format: "verbose_json",
        prompt: options.prompt || undefined,
      });

      const text = transcription.text ?? "";
      console.log(`[Groq] Transcription result: "${text}" (${text.length} chars)`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      const isAuthErr =
        (err as { status?: number }).status === 401 ||
        msg.includes("401") ||
        msg.toLowerCase().includes("unauthorized");

      if (isAuthErr) {
        console.log("[Groq] Auth error — invalidating cached token and retrying...");
        getTokenCache().invalidate("groq");

        const freshKey = await getTokenCache().get("groq");
        this.client = new Groq({ apiKey: freshKey });
        this.lastKey = freshKey;

        const retryResult = await this.client.audio.transcriptions.create({
          file: await toFile(Buffer.from(audio), "audio.webm"),
          model: options.model,
          language: options.language === "auto" ? undefined : options.language,
          response_format: "verbose_json",
          prompt: options.prompt || undefined,
        });

        const retryText = retryResult.text ?? "";
        console.log(`[Groq] Retry result: "${retryText}"`);
        return retryText;
      }

      console.error(`[Groq] Transcription failed: ${msg}`);
      throw err;
    }
  }
}
