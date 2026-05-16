import { ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import { updateHotkey } from "./hotkey";

export const store = new Store<{
  hotkey: string;
  language: string;
}>({
  defaults: {
    hotkey: "alt",
    language: "en",
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
      apiKey: process.env['DEEPGRAM_API_KEY'] || "",
    };
    console.log(`[Whisper] Settings loaded: hotkey=${settings.hotkey}, language=${settings.language}`);
    return settings;
  });

  ipcMain.handle("settings:set", (_event, settings: Record<string, string>) => {
    const oldHotkey = store.get("hotkey");
    const oldLanguage = store.get("language");

    if (settings['hotkey'] !== undefined && settings['hotkey'] !== oldHotkey) {
      store.set("hotkey", settings['hotkey']);
      updateHotkey(settings['hotkey']);
      console.log(`[Whisper] Hotkey saved & re-registered: ${oldHotkey} → ${settings['hotkey']}`);
    }

    if (settings['language'] !== undefined && settings['language'] !== oldLanguage) {
      store.set("language", settings['language']);
      console.log(`[Whisper] Language saved: ${oldLanguage} → ${settings['language']}`);
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

  ipcMain.handle("audio:get-api-key", () => {
    const apiKey = process.env['DEEPGRAM_API_KEY'] || "";
    return apiKey && apiKey !== "your_key_here" ? apiKey : null;
  });
}
