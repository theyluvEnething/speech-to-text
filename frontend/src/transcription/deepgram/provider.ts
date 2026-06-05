import { DeepgramClient } from "@deepgram/sdk";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { getTokenCache } from "../token-cache";

export class DeepgramProvider implements TranscriptionProvider {
  readonly name: ProviderName = "deepgram";
  private client: DeepgramClient | null = null;
  private lastKey: string | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    console.log(
      `[Deepgram] transcribe() called — ` +
      `audio: ${audio.byteLength} bytes, ` +
      `language: ${options.language}, ` +
      `model: ${options.model}`,
    );

    // Token cache handles proactive refresh and expiry tracking.
    const key = await getTokenCache().get("deepgram");
    this.ensureClient(key);

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
        console.log("[Deepgram] Auth error — invalidating cached token and retrying...");
        getTokenCache().invalidate("deepgram");

        const freshKey = await getTokenCache().get("deepgram");
        this.ensureClient(freshKey);

        const retryResult = await this.transcribeOnce(audio, options);
        console.log(`[Deepgram] Retry result: "${retryResult}" (${retryResult.length} chars)`);
        return retryResult;
      }

      console.error(`[Deepgram] Transcription failed: ${msg}`);
      throw err;
    }
  }

  private ensureClient(key: string): void {
    if (!this.client || key !== this.lastKey) {
      console.log("[Deepgram] Creating DeepgramClient with token from cache.");
      this.client = new DeepgramClient({ apiKey: key });
      this.lastKey = key;
    }
  }

  private async transcribeOnce(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    // getClient is now just a direct cast — ensureClient() was called before
    const client = this.client!;

    console.log(
      `[Deepgram] Sending ${audio.byteLength} bytes to Deepgram — ` +
      `model: ${options.model}, language: ${options.language}`,
    );

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
