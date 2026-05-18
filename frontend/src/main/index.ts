import http from "http";
import https from "https";
import { app, ipcMain, clipboard } from "electron";
import { autoUpdater } from "electron-updater";
import { createSettingsWindow, createOverlayWindow, createAudioWindow, getOverlayWindow, getAudioWindow } from "./windows";
import { createTray } from "./tray";
import { registerHotkey, unregisterAll } from "./hotkey";
import { registerIpcHandlers, store, getActiveProfile, saveConversation, uuid } from "./ipc-handlers";
import { transcribe, fetchTemporaryKey, initDeepgramClient, startRealtimeTranscription, sendRealtimeChunk, stopRealtimeTranscription } from "./transcriber";
import { pasteText } from "./paste";
import { correctTranscript } from "./llm";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const _origFetch = global.fetch;
global.fetch = function (url, options) {
  return _origFetch(url, {
    ...options,
    agent: new URL(url.toString()).protocol === "http:" ? httpAgent : httpsAgent,
  } as RequestInit);
};

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

const _origFetch = global.fetch;
global.fetch = function (url, options) {
  return _origFetch(url, {
    ...options,
    agent: new URL(url.toString()).protocol === "http:" ? httpAgent : httpsAgent,
  } as RequestInit);
};

type AppState = "idle" | "recording" | "processing" | "showing-result";

let state: AppState = "idle";
let audioActive = false;
let lastDurationSec = 0;
let rtChunkLogCounter = 0;

autoUpdater.logger = console;

const overlayLabels: Record<string, Record<string, string>> = {
  en: { recording: "Recording", processing: "Transcribing…", idle: "" },
  de: { recording: "Aufzeichnen…", processing: "Transkribiere…", idle: "" },
  it: { recording: "Registrazione…", processing: "Trascrizione…", idle: "" },
  es: { recording: "Grabando…", processing: "Transcribiendo…", idle: "" },
  ja: { recording: "録音中…", processing: "文字起こし中…", idle: "" },
};

function sendOverlayState(newState: string): void {
  const overlay = getOverlayWindow();
  const lang = store.get("appLanguage") || "en";
  const labels = overlayLabels[lang] ?? overlayLabels["en"]!;
  const label = labels[newState] ?? "";
  overlay?.webContents.send("overlay:state", newState, label);
}

async function startRecording(): Promise<void> {
  if (store.get("isPaused")) {
    console.log("[Wavely] Recording blocked — app is paused.");
    return;
  }
  if (audioActive) {
    console.log("[Wavely] Recording blocked — audio already capturing.");
    return;
  }
  if (state === "processing") {
    console.log("[Wavely] Recording blocked — transcription in progress.");
    return;
  }

  audioActive = true;
  state = "recording";

  const audio = getAudioWindow();

  console.log("[Wavely] Recording started...");
  sendOverlayState("recording");

  audio?.webContents.send("audio:start");

  const mode = store.get("transcriptionMode");

  if (mode === "realtime") {
    rtChunkLogCounter = 0;
    const { language, model, modelTier } = resolveTranscribeOptions();
    console.log("[Wavely RT] Starting WebSocket (audio already capturing)...");
    startRealtimeTranscription(
      model,
      modelTier,
      language,
      (interim) => {
        console.log(`[Wavely RT] Interim callback — "${interim.slice(-60)}"`);
      },
      (_final) => {
        console.log(`[Wavely RT] Final utterance — transcript so far: "${_final.slice(-60)}"`);
      },
    ).then(() => {
      console.log("[Wavely RT] WebSocket ready — buffered chunks flushed.");
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Wavely] Realtime connection failed:", msg);
      audioActive = false;
      state = "idle";
      getOverlayWindow()?.webContents.send("overlay:error", msg);
    });
  }
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

  const mode = store.get("transcriptionMode");

  if (mode === "realtime") {
    console.log("[Wavely RT] stopRecording — entering realtime stop path.");
    state = "processing";
    sendOverlayState("processing");

    const { language, model, modelTier, profileId } = resolveTranscribeOptions();
    const modelLabel = `${model}${modelTier ? `-${modelTier}` : ""}`;

    stopRealtimeTranscription()
      .then((finalText) => {
        if (finalText) {
          console.log(`[Wavely] Realtime -> "${finalText}"`);
          const prevClipboard = store.get("copyToClipboard") ? "" : clipboard.readText();
          pasteText(finalText)
            .then(() => {
              if (!store.get("copyToClipboard")) {
                clipboard.writeText(prevClipboard);
              }
            })
            .catch((err: Error) => {
              console.error(`[Wavely] Paste failed: ${err.message}`);
              getOverlayWindow()?.webContents.send("overlay:error", `Text copied. Paste failed: ${err.message}`);
            });
          state = "showing-result";
          getOverlayWindow()?.webContents.send("overlay:result", finalText);
          saveConversation({
            id: uuid(),
            text: finalText,
            language,
            model: modelLabel,
            profileId,
            durationSec: lastDurationSec,
            createdAt: Date.now(),
          });
          lastDurationSec = 0;
        } else {
          console.log("[Wavely] No realtime transcript returned.\n");
          state = "idle";
          sendOverlayState("idle");
        }
      })
      .catch((err: Error) => {
        console.error(`[Wavely] Realtime stop failed: ${err.message}\n`);
        state = "idle";
        getOverlayWindow()?.webContents.send("overlay:error", err.message);
      });
  }
}

function handleLevels(data: { rms: number; peak: number; elapsed: number; samples: number; final?: boolean }): void {
  if (data.final) {
    lastDurationSec = data.elapsed;
    console.log(`[Wavely] Audio levels — duration: ${data.elapsed.toFixed(1)}s, peak: ${data.peak.toFixed(1)} dB, RMS: ${data.rms.toFixed(1)} dB`);
  }
}

function resolveTranscribeOptions(): { language: string; model: string; modelTier: string; profileId: string } {
  const profile = getActiveProfile();
  const globalModel = store.get("model");
  const globalModelTier = store.get("modelTier");
  const globalLanguage = store.get("language");

  return {
    language: profile.language || globalLanguage,
    model: profile.model || globalModel,
    modelTier: profile.model ? "" : globalModelTier,
    profileId: profile.id,
  };
}

function handleAudioBuffer(buffer: ArrayBuffer): void {
  if (store.get("transcriptionMode") !== "prerecorded") return;

  const overlay = getOverlayWindow();

  if (buffer.byteLength === 0) {
    console.log("[Wavely] No audio captured.");
    state = "idle";
    sendOverlayState("idle");
    return;
  }

  const { language, model, modelTier, profileId } = resolveTranscribeOptions();
  const modelLabel = `${model}${modelTier ? `-${modelTier}` : ""}`;
  const durationSec = lastDurationSec;
  lastDurationSec = 0;
  const langLabel = language || "auto";

  const durationS = durationSec.toFixed(1);
  console.log(`[Wavely] Captured ${durationS}s of audio. Transcribing with ${modelLabel} in ${langLabel}...`);

  state = "processing";
  sendOverlayState("processing");

  const prevClipboard = store.get("copyToClipboard") ? "" : clipboard.readText();

  transcribe(buffer, model, modelTier, language)
    .then((rawText) => {
      if (rawText) {
        console.log(`[Wavely] -> "${rawText}"`);
        pasteText(rawText)
          .then(() => {
            if (!store.get("copyToClipboard")) {
              clipboard.writeText(prevClipboard);
            }
          })
          .catch((err: Error) => {
            console.error(`[Wavely] Paste failed: ${err.message}`);
            overlay?.webContents.send("overlay:error", `Text copied. Paste failed: ${err.message}`);
          });
        state = "showing-result";
        overlay?.webContents.send("overlay:result", rawText);
        saveConversation({
          id: uuid(),
          text: rawText,
          language,
          model: modelLabel,
          profileId,
          durationSec,
          createdAt: Date.now(),
        });
      } else {
        console.log("[Wavely] No transcript returned.\n");
        state = "idle";
        sendOverlayState("idle");
      }
    })
    .catch((err: Error) => {
      console.error(`[Wavely] Transcription failed: ${err.message}\n`);
      state = "idle";
      overlay?.webContents.send("overlay:error", err.message);
    });
}

function handleOverlayIdle(): void {
  state = "idle";
  console.log("[Wavely] Overlay returned to idle.");
}

app.whenReady().then(() => {
  const savedHotkey = store.get("hotkey");
  const savedLanguage = store.get("language");
  const savedModel = store.get("model");
  const savedModelTier = store.get("modelTier");
  const modelLabel = `${savedModel}${savedModelTier ? `-${savedModelTier}` : ""}`;

  console.log("--- Wavely v1.0.0 ---");
  console.log(`  Hotkey: ${savedHotkey}  |  Language: ${savedLanguage}  |  Model: ${modelLabel}`);
  const apiKey = process.env["DEEPGRAM_API_KEY"];
  console.log(`  Platform: ${process.platform}`);
  console.log(`  Deepgram API key: ${apiKey && apiKey !== "your_key_here" ? "configured" : "MISSING"}`);

  // Auto-start on Windows login
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
  });

  // Retry fetching a temporary Deepgram key every 15s until successful
  function tryFetchKey(): void {
    fetchTemporaryKey()
      .then(() => {
        console.log("[Wavely] Initial Deepgram key obtained.");
        initDeepgramClient();
      })
      .catch((err: Error) => {
        console.error("[Wavely] Failed to fetch Deepgram key:", err.message);
        console.log("[Wavely] Retrying in 15s...");
        setTimeout(tryFetchKey, 15_000);
      });
  }
  tryFetchKey();

  registerIpcHandlers(handleAudioBuffer, handleLevels, handleOverlayIdle);

  // Renderer-side key-up fallback — when the window is focused, the renderer
  // can detect key-up events that uiohook might miss (e.g. Alt on Windows).
  ipcMain.on("recording:stop", () => {
    if (audioActive) stopRecording();
  });

  ipcMain.on("audio:chunk", (_event, chunk: ArrayBuffer) => {
    rtChunkLogCounter++;
    if (rtChunkLogCounter <= 3) {
      console.log(`[Wavely RT] IPC chunk #${rtChunkLogCounter} — ${chunk.byteLength} bytes`);
    } else if (rtChunkLogCounter % 20 === 0) {
      console.log(`[Wavely RT] IPC chunk #${rtChunkLogCounter} — ${chunk.byteLength} bytes (${rtChunkLogCounter} total)`);
    }
    if (store.get("transcriptionMode") === "realtime") {
      sendRealtimeChunk(chunk);
    }
  });

  createAudioWindow();
  createOverlayWindow();

  createTray(() => {
    console.log("[Wavely] Settings opened from tray.");
    createSettingsWindow();
  });

  registerHotkey(savedHotkey, startRecording, stopRecording);

  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.error("[AutoUpdater] Failed to check for updates:", err);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[AutoUpdater] Update v${info.version} downloaded. It will be installed on restart.`);
  });

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
