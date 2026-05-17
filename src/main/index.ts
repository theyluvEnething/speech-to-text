import { app } from "electron";
import { join } from "path";
import { config } from "dotenv";
import { createSettingsWindow, createOverlayWindow, createAudioWindow, getOverlayWindow, getAudioWindow } from "./windows";
import { createTray } from "./tray";
import { registerHotkey, unregisterAll } from "./hotkey";
import { registerIpcHandlers, store } from "./ipc-handlers";
import { transcribe } from "./transcriber";
import { pasteText } from "./paste";

config({ path: join(app.getAppPath(), ".env") });

type AppState = "idle" | "recording" | "processing" | "showing-result";

let state: AppState = "idle";
let audioActive = false;
let savedResult: string | null = null;

function ensureApiKey(): void {
  if (!process.env['DEEPGRAM_API_KEY'] || process.env['DEEPGRAM_API_KEY'] === "your_key_here") {
    console.warn("[Wavely] Deepgram API key not set. Add DEEPGRAM_API_KEY to .env file.");
  }
}

function startRecording(): void {
  if (audioActive) {
    console.log("[Wavely] Recording blocked — audio already capturing.");
    return;
  }
  if (state === "processing") {
    console.log("[Wavely] Recording blocked — transcription in progress.");
    return;
  }

  audioActive = true;
  const audio = getAudioWindow();
  audio?.webContents.send("audio:start");

  if (state === "showing-result") {
    console.log("[Wavely] Deferred recording — capturing behind result overlay.");
    return;
  }

  state = "recording";
  const overlay = getOverlayWindow();
  console.log("[Wavely] Recording started...");
  overlay?.webContents.send("overlay:state", "recording");
}

function stopRecording(): void {
  if (!audioActive) {
    console.log("[Wavely] Stop ignored — not recording.");
    return;
  }

  audioActive = false;
  const audio = getAudioWindow();
  console.log("[Wavely] Recording stopped.");
  audio?.webContents.send("audio:stop");
}

function handleLevels(data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }): void {
  if (data.final) {
    console.log(`[Wavely] Audio levels — duration: ${data.elapsed.toFixed(1)}s, peak: ${data.peak.toFixed(1)} dB, RMS: ${data.rms.toFixed(1)} dB`);
  }
}

function handleAudioBuffer(buffer: ArrayBuffer): void {
  const overlay = getOverlayWindow();

  if (buffer.byteLength === 0) {
    console.log("[Wavely] No audio captured.");
    if (state === "recording") {
      state = "idle";
      overlay?.webContents.send("overlay:state", "idle");
    }
    return;
  }

  const durationS = (buffer.byteLength / 16000).toFixed(1);
  const model = store.get("model");
  const modelTier = store.get("modelTier");
  const language = store.get("language");
  const modelLabel = `${model}${modelTier ? `-${modelTier}` : ""}`;

  console.log(`[Wavely] Captured ${durationS}s of audio. Transcribing with ${modelLabel}...`);

  if (state === "showing-result") {
    transcribe(buffer, model, modelTier, language)
      .then((text) => {
        if (text) {
          console.log(`[Wavely] (deferred) -> "${text}"\n`);
          savedResult = text;
        } else {
          console.log("[Wavely] (deferred) No transcript returned.\n");
        }
      })
      .catch((err: Error) => {
        console.error(`[Wavely] (deferred) Transcription failed: ${err.message}\n`);
      });
    return;
  }

  state = "processing";
  overlay?.webContents.send("overlay:state", "processing");

  transcribe(buffer, model, modelTier, language)
    .then((text) => {
      if (text) {
        console.log(`[Wavely] -> "${text}"\n`);
        state = "showing-result";
        overlay?.webContents.send("overlay:result", text);
        pasteText(text);
      } else {
        console.log("[Wavely] No transcript returned.\n");
        state = "idle";
        overlay?.webContents.send("overlay:state", "idle");
      }
    })
    .catch((err: Error) => {
      console.error(`[Wavely] Transcription failed: ${err.message}\n`);
      state = "idle";
      overlay?.webContents.send("overlay:error", err.message);
    });
}

function handleOverlayIdle(): void {
  console.log("[Wavely] Overlay returned to idle.");

  if (savedResult) {
    const text = savedResult;
    savedResult = null;
    state = "showing-result";
    const overlay = getOverlayWindow();
    overlay?.webContents.send("overlay:result", text);
    pasteText(text);
    return;
  }

  if (audioActive) {
    state = "recording";
    const overlay = getOverlayWindow();
    console.log("[Wavely] Showing deferred recording UI.");
    overlay?.webContents.send("overlay:state", "recording");
    return;
  }

  state = "idle";
}

app.whenReady().then(() => {
  const savedHotkey = store.get("hotkey");
  const savedLanguage = store.get("language");
  const savedModel = store.get("model");
  const savedModelTier = store.get("modelTier");
  const apiKey = process.env['DEEPGRAM_API_KEY'];
  const modelLabel = `${savedModel}${savedModelTier ? `-${savedModelTier}` : ""}`;

  console.log("--- Wavely v1.0.0 ---");
  console.log(`  Hotkey: ${savedHotkey}  |  Language: ${savedLanguage}  |  Model: ${modelLabel}`);
  console.log(`  Deepgram API key: ${apiKey && apiKey !== "your_key_here" ? "configured" : "MISSING"}`);
  console.log(`  Platform: ${process.platform}`);

  ensureApiKey();

  registerIpcHandlers(handleAudioBuffer, handleLevels, handleOverlayIdle);

  createAudioWindow();
  createOverlayWindow();

  createTray(() => {
    console.log("[Wavely] Settings opened from tray.");
    createSettingsWindow();
  });

  registerHotkey(savedHotkey, startRecording, stopRecording);

  app.on("activate", () => {
    createSettingsWindow();
  });

  console.log("[Wavely] System tray created. Ready.\n");
});

app.on("window-all-closed", () => {
  // Keep tray running on all platforms
});

app.on("will-quit", () => {
  unregisterAll();
  console.log("[Wavely] Shutting down.");
});
