import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("overlay", {
  onState: (callback: (state: string) => void): void => {
    ipcRenderer.on("overlay:state", (_event, state: string) => callback(state));
  },

  onResult: (callback: (text: string) => void): void => {
    ipcRenderer.on("overlay:result", (_event, text: string) => callback(text));
  },

  onError: (callback: (msg: string) => void): void => {
    ipcRenderer.on("overlay:error", (_event, msg: string) => callback(msg));
  },
});
