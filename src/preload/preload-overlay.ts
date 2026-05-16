import { contextBridge, ipcRenderer } from "electron";

export interface LevelData {
  rms: number;
  peak: number;
  elapsed: number;
  samples: number;
  final?: boolean;
}

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

  onLevels: (callback: (data: LevelData) => void): void => {
    ipcRenderer.on("overlay:levels", (_event, data: LevelData) => callback(data));
  },
});
