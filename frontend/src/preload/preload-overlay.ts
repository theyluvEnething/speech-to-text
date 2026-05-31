import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlay", {
  onState: (callback: (state: string, label: string) => void): void => {
    ipcRenderer.on("overlay:state", (_event, state: string, label: string) => callback(state, label));
  },

  onResult: (callback: (text: string) => void): void => {
    ipcRenderer.on("overlay:result", (_event, text: string) => callback(text));
  },

  onError: (callback: (msg: string) => void): void => {
    ipcRenderer.on("overlay:error", (_event, msg: string) => callback(msg));
  },

  onLevels: (callback: (levels: { rms: number; peak: number }) => void): void => {
    ipcRenderer.on("overlay:levels", (_event, levels: { rms: number; peak: number }) => callback(levels));
  },

  sendIdle: (): void => {
    ipcRenderer.send("overlay:idle");
  },

  setClickThrough: (passthrough: boolean): Promise<void> => {
    return ipcRenderer.invoke("overlay:setClickThrough", passthrough);
  },

  getProfiles: (): Promise<unknown> => {
    return ipcRenderer.invoke("profiles:list");
  },

  getRecentProfileIds: (): Promise<unknown> => {
    return ipcRenderer.invoke("profiles:getRecent");
  },

  getActiveProfile: (): Promise<unknown> => {
    return ipcRenderer.invoke("overlay:getActiveProfile");
  },

  setActiveProfile: (id: string): Promise<void> => {
    return ipcRenderer.invoke("profiles:setActive", id);
  },

  startRecording: (): void => {
    ipcRenderer.send("recording:start");
  },

  stopRecording: (): void => {
    ipcRenderer.send("recording:stop");
  },

  showSettings: (tab?: string): Promise<void> => {
    return ipcRenderer.invoke("overlay:showSettings", tab);
  },

  onTransparencyChanged: (callback: (transparent: boolean) => void): void => {
    ipcRenderer.on("overlay:transparency-changed", (_event, transparent: boolean) => callback(transparent));
  },

  onReset: (callback: () => void): void => {
    ipcRenderer.on("app:reset", () => callback());
  },

  getDebugProximity: (): Promise<boolean> => {
    return ipcRenderer.invoke("debug:getProximity");
  },

  onDebugProximityChanged: (callback: (enabled: boolean) => void): void => {
    ipcRenderer.on("overlay:debug-proximity-changed", (_event, enabled: boolean) => callback(enabled));
  },

  onNotification: (callback: (data: unknown) => void): void => {
    ipcRenderer.on("overlay:notification", (_event, data) => callback(data));
  },

  getTheme: (): Promise<string> => {
    return ipcRenderer.invoke("overlay:getTheme");
  },

  onThemeChanged: (callback: (mode: string) => void): void => {
    ipcRenderer.on("overlay:theme-changed", (_event, mode: string) => callback(mode));
  },

  setSettings: (settings: Record<string, string | boolean>): Promise<{ success: boolean }> => {
    return ipcRenderer.invoke("settings:set", settings);
  },

  getHidePill: (): Promise<boolean> => {
    return ipcRenderer.invoke("settings:get").then((s: { hidePill: boolean }) => s.hidePill);
  },

  onHidePillChanged: (callback: (hidePill: boolean) => void): void => {
    ipcRenderer.on("overlay:hide-pill-changed", (_event, hidePill: boolean) => callback(hidePill));
  },
});
