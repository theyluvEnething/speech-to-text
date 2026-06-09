import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("wavely", {
  platform: process.platform,

  isPackaged: (): Promise<boolean> =>
    ipcRenderer.invoke("app:isPackaged"),

  getSettings: (): Promise<{
    hotkey: string;
    language: string;
    model: string;
    provider: string;
    copyToClipboard: boolean;
    appLanguage: string;
    theme: string;
    hidePill: boolean;
    mediaPauseEnabled: boolean;
    discordMuteEnabled: boolean;
    discordMuteMode: "mic" | "full";
  }> =>
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

  getDebugMode: (): Promise<boolean> =>
    ipcRenderer.invoke("debug:getMode"),

  setDebugMode: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke("debug:setMode", enabled),

  stopRecording: (): void => {
    ipcRenderer.send("recording:stop");
  },

  startRecording: (): void => {
    ipcRenderer.send("recording:start");
  },

  hideWindow: (): void => {
    ipcRenderer.send("settings:hide");
  },

  minimizeWindow: (): void => {
    ipcRenderer.send("settings:minimize");
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

  sendOverlayNotification: (data: { id: string; variant?: string; badge?: string; title: string; description?: string; durationMs?: number }): Promise<void> =>
    ipcRenderer.invoke("debug:send-overlay-notification", data),

  checkForUpdates: (): Promise<{ available: boolean; version: string | null; error: string | null }> =>
    ipcRenderer.invoke("app:checkForUpdates"),

  downloadAndInstallUpdate: (): Promise<void> =>
    ipcRenderer.invoke("app:downloadAndInstallUpdate"),

  onSwitchTab: (callback: (tab: string) => void): void => {
    ipcRenderer.on("settings:switchTab", (_event, tab: string) => callback(tab));
  },

  onHidePillChanged: (callback: (hidePill: boolean) => void): void => {
    ipcRenderer.on("settings:hide-pill-changed", (_event, hidePill: boolean) => callback(hidePill));
  },

  onActiveProfileChanged: (callback: (profile: unknown) => void): void => {
    ipcRenderer.on("profiles:active-changed", (_event, profile: unknown) => callback(profile));
  },

  onProfilesChanged: (callback: (profiles: unknown) => void): void => {
    ipcRenderer.on("profiles:list-changed", (_event, profiles: unknown) => callback(profiles));
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
