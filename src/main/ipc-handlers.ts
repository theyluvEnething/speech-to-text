import { ipcMain, BrowserWindow } from "electron";
import Store from "electron-store";
import { updateHotkey } from "./hotkey";
import { events } from "./events";

export const store = new Store<{
  hotkey: string;
  language: string;
  model: string;
}>({
  defaults: {
    hotkey: "alt",
    language: "en",
    model: "nova-2",
  },
});

export function registerIpcHandlers(
  onTranscript: (text: string) => void,
  onLevels: (data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => void,
): void {
  ipcMain.handle("settings:get", () => {
    const settings = {
      hotkey: store.get("hotkey"),
      language: store.get("language"),
      model: store.get("model"),
    };
    events.log("INFO", `Settings loaded: hotkey=${settings.hotkey}, language=${settings.language}, model=${settings.model}`);
    return settings;
  });

  ipcMain.handle("settings:set", (_event, settings: Record<string, string>) => {
    const oldHotkey = store.get("hotkey");

    if (settings['hotkey'] !== undefined && settings['hotkey'] !== oldHotkey) {
      store.set("hotkey", settings['hotkey']);
      updateHotkey(settings['hotkey']);
      events.log("INFO", `Hotkey saved: ${oldHotkey} -> ${settings['hotkey']}`);
      events.config({
        model: store.get("model"),
        language: store.get("language"),
        hotkey: settings['hotkey'],
      });
    }

    if (settings['language'] !== undefined) {
      store.set("language", settings['language']);
    }

    if (settings['model'] !== undefined) {
      store.set("model", settings['model']);
      events.log("INFO", `Model saved: ${settings['model']}`);
      events.config({
        model: settings['model'],
        language: store.get("language"),
        hotkey: store.get("hotkey"),
      });
    }

    return { success: true };
  });

  ipcMain.on("settings:hide", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      events.log("INFO", "Settings window hidden to tray.");
      win.hide();
    }
  });

  ipcMain.on("settings:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    events.log("INFO", "Settings window closed.");
    win?.close();
  });

  ipcMain.on("audio:transcript", (_event, text: string) => {
    events.log("INFO", `Transcript received: "${text}" (${text.length} chars)`);
    onTranscript(text);
  });

  ipcMain.on("audio:levels", (_event, data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }) => {
    onLevels(data);
  });
}
