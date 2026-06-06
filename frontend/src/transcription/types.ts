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

export type ProviderName = "deepgram" | "groq" | "openai" | "xai";

export interface TranscribeOptions {
  model: string;
  language: string;
  /** Raw 16-bit PCM audio at 16kHz mono, for providers that need
   *  uncompressed audio (e.g. xAI realtime/STT APIs).
   *  Undefined when the provider should use the WebM/Opus buffer. */
  pcmBuffer?: ArrayBuffer;
}

export interface TranscriptionProvider {
  readonly name: ProviderName;
  transcribe(audio: ArrayBuffer, options: TranscribeOptions): Promise<string>;
}
