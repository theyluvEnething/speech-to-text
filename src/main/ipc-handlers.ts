import { ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import { updateHotkey } from "./hotkey";

export const store = new Store<{
  hotkey: string;
  language: string;
  model: string;
  modelTier: string;
}>({
  defaults: {
    hotkey: "alt",
    language: "en",
    model: "nova-2",
    modelTier: "",
  },
});

export function registerIpcHandlers(
  onAudioBuffer: (buffer: ArrayBuffer) => void,
  onLevels: (data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => void,
): void {
  ipcMain.handle("settings:get", () => {
    const settings = {
      hotkey: store.get("hotkey"),
      language: store.get("language"),
      model: store.get("model"),
      modelTier: store.get("modelTier"),
    };
    console.log(`[Whisper] Settings loaded: hotkey=${settings.hotkey}, language=${settings.language}, model=${settings.model}${settings.modelTier ? `-${settings.modelTier}` : ""}`);
    return settings;
  });

  ipcMain.handle("settings:set", (_event, settings: Record<string, string>) => {
    const oldHotkey = store.get("hotkey");

    if (settings['hotkey'] !== undefined && settings['hotkey'] !== oldHotkey) {
      store.set("hotkey", settings['hotkey']);
      updateHotkey(settings['hotkey']);
      console.log(`[Whisper] Hotkey saved: ${oldHotkey} -> ${settings['hotkey']}`);
    }

    if (settings['language'] !== undefined) {
      store.set("language", settings['language']);
    }

    if (settings['model'] !== undefined) {
      store.set("model", settings['model']);
      console.log(`[Whisper] Model saved: ${settings['model']}`);
    }

    if (settings['modelTier'] !== undefined) {
      store.set("modelTier", settings['modelTier']);
      console.log(`[Whisper] Model tier saved: ${settings['modelTier'] || "default"}`);
    }

    return { success: true };
  });

  ipcMain.on("settings:hide", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      console.log("[Whisper] Settings window hidden to tray.");
      win.hide();
    }
  });

  ipcMain.on("settings:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    console.log("[Whisper] Settings window closed.");
    win?.close();
  });

  ipcMain.on("audio:buffer", (_event, buffer: ArrayBuffer) => {
    console.log(`[Whisper] Audio buffer received: ${buffer.byteLength} bytes`);
    onAudioBuffer(buffer);
  });

  ipcMain.on("audio:levels", (_event, data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => {
    onLevels(data);
  });
}
