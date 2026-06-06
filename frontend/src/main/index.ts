import { app, ipcMain, clipboard, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { createSettingsWindow, createOverlayWindow, createAudioWindow, getOverlayWindow, getAudioWindow, registerAppProtocol, registerProtocolHandlers } from "./windows";
import { createTray } from "./tray";
import { registerHotkey, unregisterAll } from "./hotkey";
import { registerIpcHandlers, store, getActiveProfile, saveConversation, uuid } from "./ipc-handlers";
import { getProvider } from "../transcription/index";
import type { ProviderName } from "../transcription/types";
import { getTokenCache } from "../transcription/token-cache";
import { pasteText } from "./paste";
import { getAppWindowFocused } from "./state";

type AppState = "idle" | "recording" | "processing" | "showing-result";

let state: AppState = "idle";
let audioActive = false;
let lastDurationSec = 0;
let lastRmsDb = -60;
let lastPeakDb = -60;
let peakRmsDb = -60;
let peakPeakDb = -60;

autoUpdater.logger = console;
autoUpdater.autoDownload = false;

const overlayLabels: Record<string, Record<string, string>> = {
  en: { recording: "Recording", processing: "Transcribing…", idle: "" },
  de: { recording: "Aufzeichnen…", processing: "Transkribiere…", idle: "" },
  it: { recording: "Registrazione…", processing: "Trascrizione…", idle: "" },
  es: { recording: "Grabando…", processing: "Transcribiendo…", idle: "" },
  ja: { recording: "録音中…", processing: "文字起こし中…", idle: "" },
};

/**
 * Error codes sent to the overlay via IPC. The renderer resolves the
 * actual user-visible text from i18next locale files (en.json, etc.)
 * using the key `errors.<code>`. This keeps translations in a single
 * source of truth instead of duplicating them in the main process.
 */
type ErrorCode = "backendUnreachable" | "providerNoKey" | "audioEmpty" | "audioTooShort" | "rateLimited" | "unableToTranscribe";

interface ErrorPayload {
  code: ErrorCode;
  details?: string;
}

const notificationLabels: Record<string, { badge: string; title: string; description: string }> = {
  en: {
    badge: "Tip",
    title: "Can't transcribe while Wavely is open",
    description: "Click into another app first, then press your hotkey.",
  },
  de: {
    badge: "Tipp",
    title: "Keine Transkription bei geöffnetem Wavely",
    description: "Klicke zuerst in eine andere App und drücke dann deine Hotkey.",
  },
  it: {
    badge: "Consiglio",
    title: "Impossibile trascrivere con Wavely aperto",
    description: "Clicca prima su un'altra app, poi premi il tasto di scelta rapida.",
  },
  es: {
    badge: "Consejo",
    title: "No se puede transcribir con Wavely abierto",
    description: "Haz clic en otra aplicación primero, luego presiona tu tecla de acceso rápido.",
  },
  ja: {
    badge: "ヒント",
    title: "Wavelyが開いている間は文字起こしできません",
    description: "先に他のアプリをクリックしてから、ホットキーを押してください。",
  },
};

function sendOverlayState(newState: string): void {
  const overlay = getOverlayWindow();
  const lang = store.get("appLanguage") || "en";
  const labels = overlayLabels[lang] ?? overlayLabels["en"]!;
  const label = labels[newState] ?? "";
  overlay?.webContents.send("overlay:state", newState, label);
}

function showOverlayNotification(payload: {
  variant?: "tip" | "warning" | "premium";
  badge?: string;
  title: string;
  description?: string;
  durationMs?: number;
}): void {
  const overlay = getOverlayWindow();
  if (!overlay || overlay.isDestroyed()) return;
  overlay.webContents.send("overlay:notification", {
    id: `notif-${Date.now()}`,
    durationMs: 5000,
    ...payload,
  });
}

/**
 * Sends a transcription error to the overlay. The renderer resolves
 * the user-visible text from i18next using `errors.<code>`. Optional
 * `details` are appended for technical context (e.g. the raw error).
 */
function showTranscriptionError(code: ErrorCode, details?: string): void {
  const overlay = getOverlayWindow();
  state = "idle";
  const payload: ErrorPayload = { code };
  if (details) payload.details = details;
  overlay?.webContents.send("overlay:error", payload);
  // The bottom notification is now handled by the overlay renderer
  // after it resolves the translated message from the error code.
}

function startRecording(): void {
  if (getAppWindowFocused()) {
    console.log("[Wavely] Recording blocked — Wavely window is focused.");
    const lang = store.get("appLanguage") || "en";
    const labels = notificationLabels[lang] ?? notificationLabels["en"]!;
    showOverlayNotification({
      variant: "tip",
      badge: labels.badge,
      title: labels.title,
      description: labels.description,
    });
    return;
  }
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

  // ── Pre-fetch API key during recording (fire & forget) ──────────
  // The round-trip to the backend (100-300ms) completes while the
  // user is still speaking. By the time they release the hotkey,
  // the token is already cached — zero wait on the critical path.
  const { provider: preFetchProvider } = resolveTranscribeOptions();
  console.log(`[Wavely] Pre-fetching ${preFetchProvider} API key (background)...`);
  getTokenCache()
    .get(preFetchProvider)
    .then(() => {
      console.log(`[Wavely] Pre-fetch complete — ${preFetchProvider} key ready.`);
    })
    .catch((err: Error) => {
      // Backend unreachable or provider not configured.
      // Stop recording and show error — the user can't transcribe anyway.
      console.error(`[Wavely] Pre-fetch FAILED: ${err.message}`);

      // Stop the audio capture
      if (audioActive) {
        audioActive = false;
        audio?.webContents.send("audio:stop");
      }

      // Classify the error and send the appropriate code to the overlay.
      // The renderer resolves the actual text from i18next locale files.
      const msg = err.message.toLowerCase();
      if (msg.includes("cannot reach") || msg.includes("unreachable") || msg.includes("econnrefused")) {
        showTranscriptionError("backendUnreachable");
      } else if (msg.includes("not configured") || msg.includes("no api key") || msg.includes("empty")) {
        showTranscriptionError("providerNoKey");
      } else if (msg.includes("credits") || msg.includes("exhausted") || msg.includes("spending limit") || msg.includes("429") || msg.includes("rate")) {
        showTranscriptionError("rateLimited");
      } else {
        showTranscriptionError("unableToTranscribe", err.message);
      }
    });
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
  if (data.rms > peakRmsDb) peakRmsDb = data.rms;
  if (data.peak > peakPeakDb) peakPeakDb = data.peak;
  if (data.final) {
    lastDurationSec = data.elapsed;
    lastRmsDb = data.rms;
    lastPeakDb = data.peak;
    console.log(`[Wavely] Audio levels — duration: ${data.elapsed.toFixed(1)}s, peak: ${data.peak.toFixed(1)} dB, RMS: ${data.rms.toFixed(1)} dB`);
  }
  const overlay = getOverlayWindow();
  overlay?.webContents.send("overlay:levels", { rms: data.rms, peak: data.peak });
}

function resolveTranscribeOptions(): { language: string; model: string; provider: ProviderName; profileId: string } {
  const profile = getActiveProfile();
  const storedProvider = store.get("provider");
  const globalModel = store.get("model");
  const globalLanguage = store.get("language");

  // Migration: "backend" provider was removed in favor of "xai".
  // Users who still have "backend" stored get migrated to "groq".
  let globalProvider: ProviderName;
  if (storedProvider === "backend") {
    console.log("[Wavely] Migrating provider from 'backend' to 'groq'.");
    store.set("provider", "groq");
    globalProvider = "groq";
  } else if (
    storedProvider === "groq" ||
    storedProvider === "deepgram" ||
    storedProvider === "openai" ||
    storedProvider === "xai"
  ) {
    globalProvider = storedProvider;
  } else {
    console.warn(
      `[Wavely] Unknown provider "${storedProvider}" — falling back to "groq".`,
    );
    store.set("provider", "groq");
    globalProvider = "groq";
  }

  return {
    language: profile.language || globalLanguage,
    model: profile.model || globalModel,
    provider: globalProvider,
    profileId: profile.id,
  };
}

function handleAudioBuffer(webmBuffer: ArrayBuffer, pcmBuffer?: ArrayBuffer): void {
  const overlay = getOverlayWindow();

  // Guard: if an error was already shown (e.g. pre-fetch failure stopped
  // recording mid-way), don't process the truncated audio buffer.
  if (state === "idle") {
    console.log("[Wavely] Skipping audio buffer — error already shown.");
    return;
  }

  if (webmBuffer.byteLength === 0) {
    console.log("[Wavely] No audio captured.");
    state = "idle";
    sendOverlayState("idle");
    return;
  }

  const durationSec = lastDurationSec;
  const rmsDb = peakRmsDb;
  const peakDb = peakPeakDb;
  lastDurationSec = 0;
  lastRmsDb = -60;
  lastPeakDb = -60;
  peakRmsDb = -60;
  peakPeakDb = -60;

  // Accidental press: too short
  if (durationSec < 0.75) {
    console.log(`[Wavely] Skipping — audio too short (${durationSec.toFixed(2)}s < 0.75s).`);
    showTranscriptionError("audioTooShort");
    return;
  }

  // Audio captured but no meaningful signal — user probably didn't speak
  if (peakDb < -45) {
    const msg = durationSec >= 2.0
      ? `[Wavely] Skipping — ${durationSec.toFixed(1)}s of silent audio (peak ${peakDb.toFixed(1)} dB)`
      : `[Wavely] Skipping — audio is silent (peak ${peakDb.toFixed(1)} dB < -45 dB)`;
    console.log(msg);
    showTranscriptionError("audioEmpty");
    return;
  }

  const { language, model, provider: providerName, profileId } = resolveTranscribeOptions();
  const langLabel = language || "auto";

  const durationS = durationSec.toFixed(1);
  console.log(`[Wavely] Captured ${durationS}s of audio. Transcribing with ${providerName}/${model} in ${langLabel}...`);

  state = "processing";
  sendOverlayState("processing");

  const provider = getProvider(providerName);
  provider.transcribe(webmBuffer, { model, language, pcmBuffer })
    .then((text) => {
      if (text) {
        console.log(`[Wavely] -> "${text}"\n`);
        const prevClipboard = clipboard.readText();
        pasteText(text)
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
        overlay?.webContents.send("overlay:result", text);
        saveConversation({
          id: uuid(),
          text,
          language,
          model: `${providerName}/${model}`,
          profileId,
          durationSec,
          createdAt: Date.now(),
        });
      } else {
        console.log("[Wavely] No transcript returned.\n");
        showTranscriptionError("unableToTranscribe");
      }
    })
    .catch((err: Error) => {
      console.error(`[Wavely] Transcription failed: ${err.message}\n`);
      showTranscriptionError("unableToTranscribe", err.message);
    });
}

function handleOverlayIdle(): void {
  state = "idle";
  console.log("[Wavely] Overlay returned to idle.");
}

registerAppProtocol();

app.whenReady().then(() => {
  registerProtocolHandlers();

  const savedHotkey = store.get("hotkey");
  const savedLanguage = store.get("language");
  const savedProvider = store.get("provider");
  const savedModel = store.get("model");

  console.log(`--- Wavely v${app.getVersion()} ---`);
  console.log(`  Hotkey: ${savedHotkey}  |  Language: ${savedLanguage}  |  Provider: ${savedProvider}  |  Model: ${savedModel}`);
  console.log(`  Platform: ${process.platform}`);

  // Auto-start on Windows login
  app.setLoginItemSettings({
    openAtLogin: true,
    path: app.getPath("exe"),
  });

  registerIpcHandlers(handleAudioBuffer, handleLevels, handleOverlayIdle);

  // Allow the overlay to start/stop recording via click
  ipcMain.on("recording:start", () => {
    startRecording();
  });

  // Renderer-side key-up fallback — when the window is focused, the renderer
  // can detect key-up events that uiohook might miss (e.g. Alt on Windows).
  ipcMain.on("recording:stop", () => {
    if (audioActive) stopRecording();
  });

  // Serve API key to the transcription module on demand
  ipcMain.handle("audio:getApiKey", () => {
    return process.env["OPENAI_API_KEY"] || "";
  });

  // Toggle overlay click-through for proximity hover
  ipcMain.handle("overlay:setClickThrough", (_event, passthrough: boolean) => {
    const overlay = getOverlayWindow();
    if (overlay && !overlay.isDestroyed()) {
      overlay.setIgnoreMouseEvents(passthrough, { forward: true });
    }
  });

  // Open settings window from overlay, optionally switching to a tab
  ipcMain.handle("overlay:showSettings", (_event, tab?: string) => {
    const win = createSettingsWindow();
    if (tab) {
      win.webContents.once("did-finish-load", () => {
        win.webContents.send("settings:switchTab", tab);
      });
      // If already loaded, send immediately
      if (!win.webContents.isLoading()) {
        win.webContents.send("settings:switchTab", tab);
      }
    }
  });

  createAudioWindow();
  createOverlayWindow();

  createTray(() => {
    console.log("[Wavely] Settings opened from tray.");
    createSettingsWindow();
  });

  registerHotkey(savedHotkey, startRecording, stopRecording);

  autoUpdater.checkForUpdates().catch((err) => {
    console.error("[AutoUpdater] Failed to check for updates:", err);
  });

  autoUpdater.once("update-available", async (info) => {
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: "Update Available",
      message: `A new version of Wavely (v${info.version}) is available. Would you like to download and install it now?\n\n(The download will happen in the background and the app will restart when ready.)`,
      buttons: ["Yes, Update Now", "Later"],
    });
    if (response === 0) {
      try {
        await autoUpdater.downloadUpdate();
        autoUpdater.quitAndInstall(false, true);
      } catch (err) {
        console.error("[AutoUpdater] Update download failed:", err);
      }
    }
  });


  // Manual update check from settings UI
  ipcMain.handle("app:checkForUpdates", async () => {
    return new Promise<{ available: boolean; version: string | null; error: string | null }>((resolve) => {
      let settled = false;
      const done = (result: { available: boolean; version: string | null; error: string | null }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(result);
      };

      const timeout = setTimeout(() => {
        done({ available: false, version: null, error: "Update check timed out" });
      }, 30000);

      const onAvailable = (info: { version: string }) => {
        done({ available: true, version: info.version, error: null });
      };
      const onNotAvailable = () => {
        done({ available: false, version: null, error: null });
      };
      const onError = (err: Error) => {
        done({ available: false, version: null, error: err.message });
      };

      autoUpdater.once("update-available", onAvailable);
      autoUpdater.once("update-not-available", onNotAvailable);
      autoUpdater.once("error", onError);

      autoUpdater.checkForUpdates().catch((err) => {
        done({ available: false, version: null, error: (err as Error).message });
      });
    });
  });

  ipcMain.handle("app:downloadAndInstallUpdate", async () => {
    await autoUpdater.downloadUpdate();
    autoUpdater.quitAndInstall(false, true);
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
