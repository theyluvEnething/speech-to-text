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

  requestResize: (width: number, height: number): void => {
    ipcRenderer.send("overlay:resize", width, height);
  },

  setClickThrough: (passthrough: boolean): Promise<void> => {
    return ipcRenderer.invoke("overlay:setClickThrough", passthrough);
  },

  getProfiles: (): Promise<unknown> => {
    return ipcRenderer.invoke("profiles:list");
  },

  setActiveProfile: (id: string): Promise<void> => {
    return ipcRenderer.invoke("profiles:setActive", id);
  },

  showSettings: (tab?: string): Promise<void> => {
    return ipcRenderer.invoke("overlay:showSettings", tab);
  },
});
