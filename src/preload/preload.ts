import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("wavely", {
  platform: process.platform,

  getSettings: (): Promise<{ hotkey: string; language: string; model: string; modelTier: string }> =>
    ipcRenderer.invoke("settings:get"),

  setSettings: (settings: Record<string, string>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("settings:set", settings),

  stopRecording: (): void => {
    ipcRenderer.send("recording:stop");
  },

  hideWindow: (): void => {
    ipcRenderer.send("settings:hide");
  },

  closeWindow: (): void => {
    ipcRenderer.send("settings:close");
  },

  profiles: {
    list: (): Promise<unknown> =>
      ipcRenderer.invoke("profiles:list"),

    upsert: (profile: unknown): Promise<unknown> =>
      ipcRenderer.invoke("profiles:upsert", profile),

    delete: (id: string): Promise<unknown> =>
      ipcRenderer.invoke("profiles:delete", id),

    getActive: (): Promise<unknown> =>
      ipcRenderer.invoke("profiles:getActive"),

    setActive: (id: string): Promise<void> =>
      ipcRenderer.invoke("profiles:setActive", id),
  },

  conversations: {
    list: (): Promise<unknown> =>
      ipcRenderer.invoke("conversations:list"),

    delete: (id: string): Promise<unknown> =>
      ipcRenderer.invoke("conversations:delete", id),

    clear: (): Promise<void> =>
      ipcRenderer.invoke("conversations:clear"),
  },
});

// Keep legacy bridge for backwards compat (settings window still references window.whisper)
contextBridge.exposeInMainWorld("whisper", {
  platform: process.platform,

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
