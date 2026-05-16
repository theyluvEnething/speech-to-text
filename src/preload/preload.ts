import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("whisper", {
  getSettings: (): Promise<{ hotkey: string; language: string; model: string }> =>
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
