import { contextBridge, ipcRenderer } from "electron";

export interface LevelData {
  rms: number;
  peak: number;
  elapsed: number;
  samples: number;
  final?: boolean;
}

contextBridge.exposeInMainWorld("audio", {
  onStart: (callback: () => void): void => {
    ipcRenderer.on("audio:start", () => callback());
  },

  onStop: (callback: () => void): void => {
    ipcRenderer.on("audio:stop", () => callback());
  },

  sendBuffer: (webmBuffer: ArrayBuffer, pcmBuffer?: ArrayBuffer): void => {
    ipcRenderer.send("audio:buffer", webmBuffer, pcmBuffer);
  },

  sendLevels: (data: LevelData): void => {
    ipcRenderer.send("audio:levels", data);
  },

  getApiKey: (): Promise<string> => {
    return ipcRenderer.invoke("audio:getApiKey");
  },
});
