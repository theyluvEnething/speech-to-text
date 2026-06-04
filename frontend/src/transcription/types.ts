export type TranscriptionCallback = (text: string) => void;

export interface ServerEvent {
  type: string;
  response?: {
    output?: Array<{
      role?: string;
      content?: Array<{ type: string; text?: string; transcript?: string }>;
    }>;
  };
  error?: { message: string; code: string };
}

export type ProviderName = "deepgram" | "groq" | "openai" | "xai" | "backend";

export interface TranscribeOptions {
  model: string;
  language: string;
}

export interface TranscriptionProvider {
  readonly name: ProviderName;
  transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string>;
}
