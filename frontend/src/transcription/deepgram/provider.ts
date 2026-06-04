import { DeepgramClient } from "@deepgram/sdk";
import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { BACKEND_BASE_URL } from "../config";

export class DeepgramProvider implements TranscriptionProvider {
  readonly name: ProviderName = "deepgram";
  private cachedKey: string | null = null;
  private client: DeepgramClient | null = null;

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    try {
      return await this.transcribeOnce(audio, options);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number }).status;
      const isAuthError =
        status === 401 ||
        msg.toLowerCase().includes("unauthorized") ||
        (msg.toLowerCase().includes("invalid") && msg.toLowerCase().includes("key")) ||
        msg.toLowerCase().includes("expired");

      if (isAuthError) {
        console.log("[Deepgram] Auth error — fetching fresh key and retrying...");
        await this.fetchTemporaryKey();
        return await this.transcribeOnce(audio, options);
      }

      throw err;
    }
  }

  private async fetchTemporaryKey(): Promise<string> {
    console.log("[Deepgram] Fetching temporary key from backend...");
    const BACKEND_URL = `${BACKEND_BASE_URL}/api/get-deepgram-key`;
    const response = await fetch(BACKEND_URL);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }
    const data = await response.json();
    if (!data.api_key) {
      throw new Error("Backend response missing api_key");
    }
    this.cachedKey = String(data.api_key);
    this.client = null;
    console.log("[Deepgram] Temporary key received.");
    return this.cachedKey;
  }

  private getClient(): DeepgramClient {
    if (!this.client) {
      if (!this.cachedKey) {
        throw new Error("No Deepgram API key available. Ensure the backend is running.");
      }
      this.client = new DeepgramClient({ apiKey: this.cachedKey });
    }
    return this.client;
  }

  private async transcribeOnce(
    audio: ArrayBuffer,
    options: TranscribeOptions,
  ): Promise<string> {
    const client = this.getClient();

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

    return (transcript as string)?.trim() ?? "";
  }
}
