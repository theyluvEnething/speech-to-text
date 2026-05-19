import { BackendProvider } from "./backend/provider";
import { DeepgramProvider } from "./deepgram/provider";
import { GroqProvider } from "./groq/provider";
import { OpenAIProvider } from "./openai/provider";
import type { TranscriptionProvider, ProviderName } from "./types";

const instances = new Map<ProviderName, TranscriptionProvider>();

export function getProvider(name: ProviderName): TranscriptionProvider {
  if (!instances.has(name)) {
    switch (name) {
      case "backend":
        instances.set(name, new BackendProvider());
        break;
      case "deepgram":
        instances.set(name, new DeepgramProvider());
        break;
      case "groq":
        instances.set(name, new GroqProvider());
        break;
      case "openai":
        instances.set(name, new OpenAIProvider());
        break;
      default:
        throw new Error(`Unknown provider: ${name satisfies never}`);
    }
  }
  return instances.get(name)!;
}

export { RealtimeTranscriber, getApiKey } from "./groq/index";
export type { TranscriptionCallback } from "./groq/index";
export type { TranscriptionProvider, ProviderName, TranscribeOptions, ServerEvent } from "./types";
