import { app, ipcMain, clipboard, dialog } from "electron";
import { autoUpdater } from "electron-updater";
import { createSettingsWindow, createOverlayWindow, createAudioWindow, getOverlayWindow, getAudioWindow, registerAppProtocol, registerProtocolHandlers } from "./windows";
import { createTray } from "./tray";
import { registerHotkey, unregisterAll } from "./hotkey";
import { registerIpcHandlers, store, getActiveProfile, saveConversation, uuid } from "./ipc-handlers";
import { getProvider } from "../transcription/index";
import type { ProviderName } from "../transcription/types";
import { pasteText } from "./paste";
import { getAppWindowFocused } from "./state";

type AppState = "idle" | "recording" | "processing" | "showing-result";

let state: AppState = "idle";
let audioActive = false;
let lastDurationSec = 0;

autoUpdater.logger = console;
autoUpdater.autoDownload = false;

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

function startRecording(): void {
  if (getAppWindowFocused()) {
    console.log("[Wavely] Recording blocked — Wavely window is focused.");
    showOverlayNotification({
      variant: "tip",
      badge: "Tip",
      title: "Can't transcribe while Wavely is open",
      description: "Click into another app first, then press your hotkey.",
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
    lastDurationSec = data.elapsed;
    console.log(`[Wavely] Audio levels — duration: ${data.elapsed.toFixed(1)}s, peak: ${data.peak.toFixed(1)} dB, RMS: ${data.rms.toFixed(1)} dB`);
  }
  const overlay = getOverlayWindow();
  overlay?.webContents.send("overlay:levels", { rms: data.rms, peak: data.peak });
}

function resolveTranscribeOptions(): { language: string; model: string; provider: ProviderName; profileId: string } {
  const profile = getActiveProfile();
  const globalProvider = store.get("provider") as ProviderName;
  const globalModel = store.get("model");
  const globalLanguage = store.get("language");

  return {
    language: profile.language || globalLanguage,
    model: profile.model || globalModel,
    provider: globalProvider,
    profileId: profile.id,
  };
}

function handleAudioBuffer(buffer: ArrayBuffer): void {
  const overlay = getOverlayWindow();

  if (buffer.byteLength === 0) {
    console.log("[Wavely] No audio captured.");
    state = "idle";
    sendOverlayState("idle");
    return;
  }

  const { language, model, provider: providerName, profileId } = resolveTranscribeOptions();
  const durationSec = lastDurationSec;
  lastDurationSec = 0;
  const langLabel = language || "auto";

  const durationS = durationSec.toFixed(1);
  console.log(`[Wavely] Captured ${durationS}s of audio. Transcribing with ${providerName}/${model} in ${langLabel}...`);

  state = "processing";
  sendOverlayState("processing");

  const provider = getProvider(providerName);
  provider.transcribe(buffer, { model, language })
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
      message: `A new version of Wavely (v${info.version}) is available. Would you like to download and install it now?`,
      buttons: ["Yes, Update Now", "Later"],
    });
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall(true, true);
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
    autoUpdater.quitAndInstall(true, true);
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
