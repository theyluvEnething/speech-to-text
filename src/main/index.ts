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

let isRecording = false;

function ensureApiKey(): void {
  if (!process.env['DEEPGRAM_API_KEY'] || process.env['DEEPGRAM_API_KEY'] === "your_key_here") {
    console.warn("[Whisper] Deepgram API key not set — add DEEPGRAM_API_KEY to .env file.");
  }
}

function printHeader(): void {
  console.log("==================================================");
  console.log("[Whisper]  RECORDING — speak now…");
  console.log("==================================================");
}

function printLevels(rms: number, peak: number, elapsed: number, samples: number): void {
  const barWidth = 40;
  const normalized = Math.min(Math.max((rms + 60) / 60, 0), 1);
  const filled = Math.round(normalized * barWidth);
  const empty = barWidth - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);

  const elapsedStr = elapsed.toFixed(1).padStart(4, " ");
  const samplesStr = `${samples} samples`;

  process.stdout.write(
    `\r  [${bar}]  ${rms.toFixed(1)} dB  peak ${peak.toFixed(1)} dB  |  ${elapsedStr}s  (${samplesStr})`,
  );
}

function printSummary(duration: number, peak: number, rms: number): void {
  console.log(`\n[Whisper] Stopped after ${duration.toFixed(1)}s. Peak: ${peak.toFixed(1)} dB, RMS: ${rms.toFixed(1)} dB`);
}

function startRecording(): void {
  if (isRecording) return;
  isRecording = true;

  const overlay = getOverlayWindow();
  const audio = getAudioWindow();

  printHeader();
  overlay?.webContents.send("overlay:state", "recording");
  audio?.webContents.send("audio:start");
}

function stopRecording(): void {
  if (!isRecording) return;
  isRecording = false;

  const overlay = getOverlayWindow();
  const audio = getAudioWindow();

  overlay?.webContents.send("overlay:state", "processing");
  audio?.webContents.send("audio:stop");
}

function handleLevels(data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }): void {
  if (data.final) {
    printSummary(data.elapsed, data.peak, data.rms);
  } else {
    printLevels(data.rms, data.peak, data.elapsed, data.samples);
  }
}

function handleAudioBuffer(buffer: ArrayBuffer): void {
  const overlay = getOverlayWindow();

  if (buffer.byteLength === 0) {
    console.log("[Whisper] No audio captured.");
    overlay?.webContents.send("overlay:state", "idle");
    return;
  }

  const durationS = (buffer.byteLength / 16000).toFixed(1);
  console.log(`[Whisper] Captured ${durationS}s of audio. Transcribing…`);

  transcribe(buffer)
    .then((text) => {
      if (text) {
        console.log(`[Whisper] → "${text}"\n`);
        overlay?.webContents.send("overlay:result", text);
        pasteText(text);
      } else {
        console.log("[Whisper] No transcript returned.\n");
        overlay?.webContents.send("overlay:state", "idle");
      }
    })
    .catch((err: Error) => {
      console.error(`[Whisper] Transcription failed: ${err.message}\n`);
      overlay?.webContents.send("overlay:error", err.message);
    });
}

app.whenReady().then(() => {
  const savedHotkey = store.get("hotkey");
  const savedLanguage = store.get("language");
  const apiKey = process.env['DEEPGRAM_API_KEY'];

  console.log("╔══════════════════════════════════════════╗");
  console.log("║         Whisper PTT v2.0.0               ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`[Whisper] Hotkey: ${savedHotkey} (from saved settings)`);
  console.log(`[Whisper] Language: ${savedLanguage}`);
  console.log(`[Whisper] Deepgram API key: ${apiKey && apiKey !== "your_key_here" ? "configured" : "MISSING"}`);
  console.log("[Whisper] Platform:", process.platform);

  ensureApiKey();

  registerIpcHandlers(handleAudioBuffer, handleLevels);

  createAudioWindow();
  createOverlayWindow();

  createTray(() => {
    console.log("[Whisper] Settings opened from tray.");
    createSettingsWindow();
  });

  registerHotkey(savedHotkey, startRecording, stopRecording);

  app.on("activate", () => {
    createSettingsWindow();
  });

  console.log("[Whisper] System tray created. Ready.\n");
});

app.on("window-all-closed", () => {
  // Keep tray running on all platforms
});

app.on("will-quit", () => {
  unregisterAll();
  console.log("[Whisper] Shutting down.");
});
