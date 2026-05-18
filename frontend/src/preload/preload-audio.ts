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

  onChunk: (callback: (chunk: ArrayBuffer) => void): void => {
    ipcRenderer.on("audio:chunk:emit", (_event, chunk: ArrayBuffer) => callback(chunk));
  },

  sendBuffer: (buffer: ArrayBuffer): void => {
    ipcRenderer.send("audio:buffer", buffer);
  },

  sendChunk: (chunk: ArrayBuffer): void => {
    ipcRenderer.send("audio:chunk", chunk);
  },

  sendLevels: (data: LevelData): void => {
    ipcRenderer.send("audio:levels", data);
  },
});
