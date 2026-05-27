import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("wavely", {
  platform: process.platform,

  getSettings: (): Promise<{ hotkey: string; language: string; model: string; provider: string; copyToClipboard: boolean; appLanguage: string }> =>
    ipcRenderer.invoke("settings:get"),

  setSettings: (settings: Record<string, string | boolean>): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("settings:set", settings),

  getPaused: (): Promise<boolean> =>
    ipcRenderer.invoke("app:getPaused"),

  togglePaused: (): Promise<boolean> =>
    ipcRenderer.invoke("app:togglePaused"),

  getDebugProximity: (): Promise<boolean> =>
    ipcRenderer.invoke("debug:getProximity"),

  toggleDebugProximity: (): Promise<boolean> =>
    ipcRenderer.invoke("debug:toggleProximity"),

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


  fullReset: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke("app:fullReset"),

  getVersion: (): Promise<string> =>
    ipcRenderer.invoke("app:getVersion"),

  toggleOverlayTransparency: (transparent: boolean): Promise<void> =>
    ipcRenderer.invoke("overlay:toggleTransparency", transparent),

  checkForUpdates: (): Promise<{ available: boolean; version: string | null; error: string | null }> =>
    ipcRenderer.invoke("app:checkForUpdates"),

  downloadAndInstallUpdate: (): Promise<void> =>
    ipcRenderer.invoke("app:downloadAndInstallUpdate"),

  onSwitchTab: (callback: (tab: string) => void): void => {
    ipcRenderer.on("settings:switchTab", (_event, tab: string) => callback(tab));
  },

  conversations: {
    list: (): Promise<unknown> =>
      ipcRenderer.invoke("conversations:list"),

    delete: (id: string): Promise<unknown> =>
      ipcRenderer.invoke("conversations:delete", id),

    clear: (): Promise<void> =>
      ipcRenderer.invoke("conversations:clear"),

    onNew: (callback: (conv: unknown) => void): void => {
      ipcRenderer.on("conversations:new", (_event, conv) => callback(conv));
    },
  },
});

// Keep legacy bridge for backwards compat (settings window still references window.whisper)
contextBridge.exposeInMainWorld("whisper", {
  platform: process.platform,

  getSettings: (): Promise<{ hotkey: string; language: string; model: string; provider: string }> =>
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
