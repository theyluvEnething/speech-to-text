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

  sendBuffer: (buffer: ArrayBuffer): void => {
    ipcRenderer.send("audio:buffer", buffer);
  },

  sendLevels: (data: LevelData): void => {
    ipcRenderer.send("audio:levels", data);
  },

  getApiKey: (): Promise<string> => {
    return ipcRenderer.invoke("audio:getApiKey");
  },

  // FIXME(auth): Returns the backend shared secret for x-api-key
  // header. Replace with Clerk token when proper auth is added.
  getBackendSecret: (): Promise<string> => {
    return ipcRenderer.invoke("backend:getApiSecret");
  },
});
