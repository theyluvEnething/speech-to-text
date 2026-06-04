import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";
import { BACKEND_BASE_URL } from "../config";

const BACKEND_URL = `${BACKEND_BASE_URL}/api/transcribe`;

export class BackendProvider implements TranscriptionProvider {
  readonly name: ProviderName = "backend";

  async transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string> {
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "audio/webm" },
      body: audio,
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Max 10 requests per minute.");
      }
      const body = await response.text();
      throw new Error(`Backend returned ${response.status}: ${body}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error ?? "Backend transcription failed.");
    }

    return (data.transcript as string)?.trim() ?? "";
  }
}
