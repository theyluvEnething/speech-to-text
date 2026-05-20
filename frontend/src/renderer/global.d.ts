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
    onNew(callback: (conv: Conversation) => void): void;
  }

  interface WavelyApi {
    platform: string;
    getSettings(): Promise<{ hotkey: string; language: string; model: string; provider: string; copyToClipboard: boolean; appLanguage: string }>;
    setSettings(settings: Record<string, string | boolean>): Promise<{ success: boolean }>;
    getPaused(): Promise<boolean>;
    togglePaused(): Promise<boolean>;
    stopRecording(): void;
    hideWindow(): void;
    closeWindow(): void;
    checkForUpdates(): Promise<{ available: boolean; version: string | null; error: string | null }>;
    downloadAndInstallUpdate(): Promise<void>;
    toggleOverlayTransparency(transparent: boolean): Promise<void>;

    onSwitchTab(callback: (tab: string) => void): void;
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
    getApiKey(): Promise<string>;
  }

  interface OverlayApi {
    onState(callback: (state: string, label: string) => void): void;
    onResult(callback: (text: string) => void): void;
    onError(callback: (msg: string) => void): void;
    onLevels(callback: (levels: { rms: number; peak: number }) => void): void;
    sendIdle(): void;
    startRecording(): void;
    stopRecording(): void;
    setClickThrough(passthrough: boolean): Promise<void>;
    getProfiles(): Promise<Profile[]>;
    setActiveProfile(id: string): Promise<void>;
    showSettings(tab?: string): Promise<void>;
    onTransparencyChanged(callback: (transparent: boolean) => void): void;
  }

  interface Window {
    wavely: WavelyApi;
    whisper: WavelyApi;
    audio: AudioApi;
    overlay: OverlayApi;
  }
}
