import type { TranscriptionProvider, TranscribeOptions, ProviderName } from "../types";

export class OpenAIProvider implements TranscriptionProvider {
  readonly name: ProviderName = "openai";

  async transcribe(_audio: ArrayBuffer, _options: TranscribeOptions): Promise<string> {
    throw new Error("OpenAI provider not yet implemented");
  }
}
