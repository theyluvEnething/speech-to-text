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

  onApiKey: (callback: (key: string) => void): void => {
    ipcRenderer.once("audio:apikey", (_event, key: string) => callback(key));
  },

  sendTranscript: (text: string): void => {
    ipcRenderer.send("audio:transcript", text);
  },

  sendLevels: (data: LevelData): void => {
    ipcRenderer.send("audio:levels", data);
  },
});
