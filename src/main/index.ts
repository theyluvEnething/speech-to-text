import { app } from "electron";
import { join } from "path";
import { config } from "dotenv";
import { createSettingsWindow, createOverlayWindow, createAudioWindow, getOverlayWindow, getAudioWindow } from "./windows";
import { createTray } from "./tray";
import { registerHotkey, unregisterAll } from "./hotkey";
import { registerIpcHandlers, store } from "./ipc-handlers";
import { pasteText } from "./paste";
import { events } from "./events";
import { getApiKey } from "./transcriber";

config({ path: join(app.getAppPath(), ".env") });

let isRecording = false;

function ensureApiKey(): void {
  if (!getApiKey()) {
    events.log("WARN", "Deepgram API key not set. Add DEEPGRAM_API_KEY to .env file.");
  }
}

function startRecording(): void {
  if (isRecording) return;
  isRecording = true;

  const overlay = getOverlayWindow();
  const audio = getAudioWindow();

  events.phase("recording");
  overlay?.webContents.send("overlay:state", "recording");
  audio?.webContents.send("audio:start");
}

function stopRecording(): void {
  if (!isRecording) return;
  isRecording = false;

  const overlay = getOverlayWindow();
  const audio = getAudioWindow();

  events.phase("transcribing");
  overlay?.webContents.send("overlay:state", "processing");
  audio?.webContents.send("audio:stop");
}

function handleLevels(data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }): void {
  if (!data.final) {
    events.levels({ rms: data.rms, peak: data.peak, elapsed: data.elapsed });
  }

  const overlay = getOverlayWindow();
  overlay?.webContents.send("overlay:levels", data);
}

function handleTranscript(text: string): void {
  const overlay = getOverlayWindow();

  if (!text) {
    events.log("WARN", "No transcript returned.");
    events.phase("idle");
    overlay?.webContents.send("overlay:state", "idle");
    return;
  }

  events.log("SUCCESS", `Transcription: "${text}"`);
  events.phase("idle");
  overlay?.webContents.send("overlay:result", text);
  pasteText(text);
}

app.whenReady().then(() => {
  const savedHotkey = store.get("hotkey");
  const savedLanguage = store.get("language");
  const savedModel = store.get("model");
  const apiKey = getApiKey();

  events.log("INFO", "Whisper PTT v2.0.0");
  events.log("INFO", `Hotkey: ${savedHotkey} | Language: ${savedLanguage} | Model: ${savedModel}`);
  events.log("INFO", `Deepgram API key: ${apiKey ? "configured" : "MISSING"}`);
  events.log("INFO", `Platform: ${process.platform}`);
  events.config({ model: savedModel, language: savedLanguage, hotkey: savedHotkey });

  ensureApiKey();

  registerIpcHandlers(handleTranscript, handleLevels);

  const audioWindow = createAudioWindow();
  createOverlayWindow();

  if (apiKey) {
    audioWindow.webContents.send("audio:apikey", apiKey);
  }

  createTray(() => {
    events.log("INFO", "Settings opened from tray.");
    createSettingsWindow();
  });

  registerHotkey(savedHotkey, startRecording, stopRecording);

  app.on("activate", () => {
    createSettingsWindow();
  });

  events.log("INFO", "System tray created. Ready.");

  if (process.argv.includes("--console")) {
    import("ink").then(({ render }) => {
      import("react").then((React) => {
        import("../tui/app").then(({ default: App }) => {
          render(React.createElement(App, { events: events as unknown as import("events").EventEmitter }));
        });
      });
    });
  }
});

app.on("window-all-closed", () => {
  // Keep tray running on all platforms
});

app.on("will-quit", () => {
  events.log("INFO", "Shutting down.");
  unregisterAll();
});
