interface WhisperSettings {
  getSettings(): Promise<{
    hotkey: string;
    language: string;
    apiKey: string;
  }>;
  setSettings(settings: Record<string, string>): Promise<{ success: boolean }>;
  hideWindow(): void;
  closeWindow(): void;
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
}

declare global {
  interface Window {
    whisper: WhisperSettings;
    audio: AudioApi;
    overlay: OverlayApi;
  }
}

export {};
