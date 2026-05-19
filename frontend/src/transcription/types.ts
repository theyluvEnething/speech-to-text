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
