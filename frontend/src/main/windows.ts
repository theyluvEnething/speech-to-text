import { BrowserWindow, screen } from "electron";
import { join } from "path";

let settingsWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let audioWindow: BrowserWindow | null = null;

const PRELOAD_SETTINGS = join(__dirname, "../preload/preload.js");
const PRELOAD_OVERLAY = join(__dirname, "../preload/preload-overlay.js");
const PRELOAD_AUDIO = join(__dirname, "../preload/preload-audio.js");
const RENDERER_BASE = join(__dirname, "../renderer");

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow;
  }

  const isMac = process.platform === "darwin";

  settingsWindow = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 560,
    minHeight: 330,
    resizable: true,
    frame: false,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    transparent: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_SETTINGS,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  settingsWindow.loadFile(join(RENDERER_BASE, "index.html"));
  settingsWindow.setMenuBarVisibility(false);

  // Prevent modifier keys from triggering system menus (e.g. Alt on Windows)
  // which would break push-to-talk key-release detection via uiohook.
  settingsWindow.webContents.on("before-input-event", (event, input) => {
    if ((input.key === "Alt" || input.key === "Control" || input.key === "Shift") && input.type === "keyDown") {
      event.preventDefault();
    }
  });

  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });

  return settingsWindow;
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const FIXED_WIDTH = 340;
  const FIXED_HEIGHT = 190;

  overlayWindow = new BrowserWindow({
    width: FIXED_WIDTH,
    height: FIXED_HEIGHT,
    x: Math.round((screenWidth - FIXED_WIDTH) / 2),
    y: screenHeight - 92 - FIXED_HEIGHT,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: true,
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: PRELOAD_OVERLAY,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadFile(join(RENDERER_BASE, "overlay.html"));
  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  setWindowClickThrough(overlayWindow);

  // Re-apply alwaysOnTop periodically — Windows drops it after screensaver / fullscreen apps
  const alwaysOnTopTimer = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    } else {
      clearInterval(alwaysOnTopTimer);
    }
  }, 5000);

  // Reposition and re-assert alwaysOnTop when the window is shown (e.g. after alt-tab)
  overlayWindow.on("show", () => {
    const { width: w, height: h } = screen.getPrimaryDisplay().workAreaSize;
    overlayWindow?.setPosition(Math.round((w - FIXED_WIDTH) / 2), h - 92 - FIXED_HEIGHT);
    overlayWindow?.setAlwaysOnTop(true, "screen-saver");
  });

  overlayWindow.on("closed", () => {
    clearInterval(alwaysOnTopTimer);
    overlayWindow = null;
  });

  return overlayWindow;
}

export function createAudioWindow(): BrowserWindow {
  if (audioWindow && !audioWindow.isDestroyed()) {
    return audioWindow;
  }

  audioWindow = new BrowserWindow({
    width: 1,
    height: 1,
    show: false,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_AUDIO,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  audioWindow.loadFile(join(RENDERER_BASE, "audio.html"));

  audioWindow.on("closed", () => {
    audioWindow = null;
  });

  return audioWindow;
}

function setWindowClickThrough(win: BrowserWindow): void {
  win.setIgnoreMouseEvents(true, { forward: true });
}

export function getOverlayWindow(): BrowserWindow | null {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }
  return null;
}

export function getAudioWindow(): BrowserWindow | null {
  if (audioWindow && !audioWindow.isDestroyed()) {
    return audioWindow;
  }
  return null;
}

export function getSettingsWindow(): BrowserWindow | null {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    return settingsWindow;
  }
  return null;
}
