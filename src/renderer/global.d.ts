export {};

declare global {
  interface Profile {
    id: string;
    name: string;
    color: string;
    icon: string;
    systemPrompt: string;
    language?: string;
    model?: string;
  }

  interface Conversation {
    id: string;
    text: string;
    language: string;
    model: string;
    profileId: string;
    durationSec: number;
    createdAt: number;
  }

  interface WavelyProfiles {
    list(): Promise<Profile[]>;
    upsert(profile: Profile): Promise<Profile[]>;
    delete(id: string): Promise<Profile[]>;
    getActive(): Promise<Profile>;
    setActive(id: string): Promise<void>;
  }

  interface WavelyConversations {
    list(): Promise<Conversation[]>;
    delete(id: string): Promise<Conversation[]>;
    clear(): Promise<void>;
  }

  interface WavelyApi {
    platform: string;
    getSettings(): Promise<{ hotkey: string; language: string; model: string; modelTier: string }>;
    setSettings(settings: Record<string, string>): Promise<{ success: boolean }>;
    hideWindow(): void;
    closeWindow(): void;
    profiles: WavelyProfiles;
    conversations: WavelyConversations;
  }

  interface LevelData {
    rms: number;
    peak: number;
    elapsed: number;
    samples: number;
    final?: boolean;
  }

  interface AudioApi {
    onStart(callback: () => void): void;
    onStop(callback: () => void): void;
    sendBuffer(buffer: ArrayBuffer): void;
    sendLevels(data: LevelData): void;
  }

  interface OverlayApi {
    onState(callback: (state: string) => void): void;
    onResult(callback: (text: string) => void): void;
    onError(callback: (msg: string) => void): void;
    sendIdle(): void;
  }

  interface Window {
    wavely: WavelyApi;
    whisper: WavelyApi;
    audio: AudioApi;
    overlay: OverlayApi;
  }
}
