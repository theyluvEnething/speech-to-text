import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("whisper", {
  // API key remains "whisper" for backwards compatibility with renderer code
  getSettings: (): Promise<{ hotkey: string; language: string; model: string; modelTier: string }> =>
    ipcRenderer.invoke("settings:get"),

  setSettings: (settings: Record<string, string>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("settings:set", settings),

  hideWindow: (): void => {
    ipcRenderer.send("settings:hide");
  },

  closeWindow: (): void => {
    ipcRenderer.send("settings:close");
  },
});
