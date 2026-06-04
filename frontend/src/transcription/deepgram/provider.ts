import { DeepgramClient } from "@deepgram/sdk";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { BACKEND_BASE_URL } from "../config";
import { getBackendSecret } from "../env";

export class DeepgramProvider implements TranscriptionProvider {
  readonly name: ProviderName = "deepgram";
  private cachedKey: string | null = null;
  private client: DeepgramClient | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(
      `[Deepgram] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}, ` +
      `key cached: ${this.cachedKey ? "yes" : "no"}`,
    );

    // Eagerly fetch key if missing — avoids the catch/retry path on first call.
    // The GroqProvider uses the same pattern for its SDK client.
    if (!this.cachedKey) {
      console.log("[Deepgram] No cached key — fetching from backend before transcribing...");
      await this.fetchTemporaryKey();
    }

    try {
      const result = await this.transcribeOnce(audio, options);
      console.log(`[Deepgram] Transcription result: "${result}" (${result.length} chars)`);
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      const isAuthError =
        status === 401 ||
        msg.toLowerCase().includes("unauthorized") ||
        (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("key")) ||
        msg.toLowerCase().includes("expired");

      if (isAuthError) {
        console.log("[Deepgram] Auth error detected — fetching fresh key and retrying...");
        await this.fetchTemporaryKey();
        console.log("[Deepgram] Retrying transcription with fresh key...");
        const result = await this.transcribeOnce(audio, options);
        console.log(`[Deepgram] Retry result: "${result}" (${result.length} chars)`);
        return result;
      }

      console.error(`[Deepgram] Transcription failed: ${msg}`);
      throw err;
    }
  }

  private async fetchTemporaryKey(): Promise<string> {
    const secret = getBackendSecret();
    const url = `${BACKEND_BASE_URL}/api/get-deepgram-key`;

    console.log(`[Deepgram] fetchTemporaryKey() — calling backend: GET ${url}`);
    console.log(`[Deepgram] Using backend secret: ${secret === "0xDEADBEEF" ? "⚠ PLACEHOLDER (0xDEADBEEF)" : "✓ custom"}`);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { "x-api-key": secret },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Deepgram] Backend fetch failed: ${msg}`);
      throw new Error(`Cannot reach Wavely backend at ${url}: ${msg}`);
    }

    console.log(`[Deepgram] Backend response: HTTP ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const body = await response.text();
      console.error(`[Deepgram] Backend returned error: ${body}`);
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }

    const data = await response.json();
    if (!data.api_key) {
      console.error("[Deepgram] Backend response missing 'api_key':", JSON.stringify(data));
      throw new Error("Backend response missing api_key");
    }

    this.cachedKey = String(data.api_key);
    this.client = null; // Force client recreation with new key
    console.log(`[Deepgram] Temporary key received (${this.cachedKey.length} chars, starts with: ${this.cachedKey.slice(0, 12)}...)`);
    return this.cachedKey;
  }

  private getClient(): DeepgramClient {
    if (!this.client) {
      if (!this.cachedKey) {
        throw new Error("No Deepgram API key available. Ensure the backend is running.");
      }
      console.log(`[Deepgram] Creating DeepgramClient with cached key.`);
      this.client = new DeepgramClient({ apiKey: this.cachedKey });
    }
    return this.client;
  }

  private async transcribeOnce(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    const client = this.getClient();

    console.log(`[Deepgram] Sending ${audio.byteLength} bytes to Deepgram — model: ${options.model}, language: ${options.language}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await client.listen.v1.media.transcribeFile(
      Buffer.from(audio),
      {
        model: options.model,
        smart_format: true,
        punctuate: true,
        utterances: true,
        mimetype: "audio/webm",
        language: options.language === "auto" ? undefined : options.language,
      } as any,
    );

    const transcript =
      response.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    const text = (transcript as string)?.trim() ?? "";
    console.log(`[Deepgram] Raw response transcript: "${text}"`);
    return text;
  }
}
