import { app, BrowserWindow, screen, session, protocol, net } from "electron";
import { join } from "path";
import { pathToFileURL } from "url";


let settingsWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let audioWindow: BrowserWindow | null = null;
let overlayTransparent = true;

const PRELOAD_SETTINGS = join(__dirname, "../preload/preload.js");
const PRELOAD_OVERLAY = join(__dirname, "../preload/preload-overlay.js");
const PRELOAD_AUDIO = join(__dirname, "../preload/preload-audio.js");
const RENDERER_BASE = join(__dirname, "../../dist/renderer");

export function registerAppProtocol(): void {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const relativePath = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const absolutePath = join(RENDERER_BASE, decodeURIComponent(relativePath));

    return net.fetch(pathToFileURL(absolutePath).toString()).catch((err) => {
      console.error("[Protocol] Failed to serve", absolutePath, err);
      return new Response("Not found", { status: 404 });
    });
  });
}

let clerkSession: Electron.Session | null = null;
export function getClerkSession(): Electron.Session {
  if (!clerkSession) {
    clerkSession = session.fromPartition("persist:wavely");
  }
  return clerkSession;
}

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
      session: getClerkSession(),
    },
  });

  settingsWindow.loadURL("app://wavely/index.html");

  settingsWindow.setMenuBarVisibility(false);

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
  const FIXED_WIDTH = 460;
  const FIXED_HEIGHT = 180;

  overlayWindow = new BrowserWindow({
    width: FIXED_WIDTH,
    height: FIXED_HEIGHT,
    x: Math.round((screenWidth - FIXED_WIDTH) / 2),
    y: screenHeight - FIXED_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: PRELOAD_OVERLAY,
      contextIsolation: true,
      nodeIntegration: false,
      session: getClerkSession(),
    },
  });

  overlayWindow.loadURL("app://wavely/overlay.html");

  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  setWindowClickThrough(overlayWindow);

  const alwaysOnTopTimer = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    } else {
      clearInterval(alwaysOnTopTimer);
    }
  }, 5000);

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
      session: getClerkSession(),
    },
  });

  audioWindow.loadURL("app://wavely/audio.html");

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

export function toggleOverlayTransparency(transparent: boolean): void {
  overlayTransparent = transparent;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setBackgroundColor(transparent ? "#00000000" : "#0a0a0a");
    overlayWindow.setHasShadow(!transparent);
    overlayWindow.webContents.send("overlay:transparency-changed", transparent);
  }
}
