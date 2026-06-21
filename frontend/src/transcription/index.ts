import { DeepgramProvider } from "./deepgram/provider";
import { GroqProvider } from "./groq/provider";
import { OpenAIProvider } from "./openai/provider";
import { XaiProvider } from "./xai/provider";
import type { TranscriptionProvider, ProviderName } from "./types";

const instances = new Map<ProviderName, TranscriptionProvider>();

export function getProvider(name: ProviderName): TranscriptionProvider {
  if (!instances.has(name)) {
    switch (name) {
      case "deepgram":
        instances.set(name, new DeepgramProvider());
        break;
      case "groq":
        instances.set(name, new GroqProvider());
        break;
      case "openai":
        instances.set(name, new OpenAIProvider());
        break;
      case "xai":
        instances.set(name, new XaiProvider());
        break;
      default:
        throw new Error(`Unknown provider: ${name satisfies never}`);
    }
  }
  return instances.get(name)!;
}

export { RealtimeTranscriber, getApiKey } from "./groq/index";
export type { TranscriptionCallback } from "./groq/index";
export { getXaiEphemeralToken } from "./xai/index";
export type { EphemeralToken } from "./xai/index";
export { getTranscriptionPrompt, TRANSCRIPTION_PROMPTS } from "./prompts";
export { postProcessText } from "./post-process";
export type { TokenProvider } from "./token-cache";
export type {
  TranscriptionProvider,
  ProviderName,
  TranscribeOptions,
  ServerEvent,
} from "./types";
