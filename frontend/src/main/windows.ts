import { app, BrowserWindow, screen, session, protocol, net, powerMonitor } from "electron";
import { join } from "path";
import { pathToFileURL } from "url";
import { setAppWindowFocused } from "./state";
import {
  calculateOverlayBounds,
  OVERLAY_WINDOW_HEIGHT,
  OVERLAY_WINDOW_WIDTH,
} from "../shared/overlay-layout";


let settingsWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let audioWindow: BrowserWindow | null = null;
let overlayTransparent = true;

const PRELOAD_SETTINGS = join(__dirname, "../preload/preload.js");
const PRELOAD_OVERLAY = join(__dirname, "../preload/preload-overlay.js");
const PRELOAD_AUDIO = join(__dirname, "../preload/preload-audio.js");
const RENDERER_BASE = join(__dirname, "../../dist/renderer");

export function registerAppProtocol(): void {
  // No-op: we intercept http://localhost instead of using a custom scheme,
  // so Chromium natively persists cookies to disk.
}

export function registerProtocolHandlers(): void {
  const handler = (request: Request) => {
    const url = new URL(request.url);

    // Only intercept requests to our local app UI
    if (url.hostname === "localhost") {
      let filePath = url.pathname;
      if (filePath === "/") filePath = "/index.html";

      const absolutePath = join(RENDERER_BASE, filePath);
      return net.fetch(pathToFileURL(absolutePath).toString()).catch((err) => {
        console.error("[Protocol] Failed to serve", absolutePath, err);
        return new Response("Not Found", { status: 404 });
      });
    }

    // Let all other HTTP requests pass through to the internet
    return net.fetch(request, { bypassCustomProtocolHandlers: true });
  };

  protocol.handle("http", handler);
  getClerkSession().protocol.handle("http", handler);
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
    roundedCorners: true,
    webPreferences: {
      preload: PRELOAD_SETTINGS,
      contextIsolation: true,
      nodeIntegration: false,
      session: getClerkSession(),
    },
  });

  settingsWindow.loadURL("http://localhost/index.html");

  settingsWindow.setMenuBarVisibility(false);

  settingsWindow.webContents.on("before-input-event", (event, input) => {
    if ((input.key === "Alt" || input.key === "Control" || input.key === "Shift") && input.type === "keyDown") {
      event.preventDefault();
    }
  });

  settingsWindow.on("focus", () => setAppWindowFocused(true));
  settingsWindow.on("blur", () => setAppWindowFocused(false));
  // Initialize: if window is created focused, set state
  if (settingsWindow.isFocused()) setAppWindowFocused(true);

  settingsWindow.on("closed", () => {
    setAppWindowFocused(false);
    settingsWindow = null;
  });

  return settingsWindow;
}

export function createOverlayWindow(): BrowserWindow {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  const overlayBounds = calculateOverlayBounds(screen.getPrimaryDisplay().workArea);

  overlayWindow = new BrowserWindow({
    width: OVERLAY_WINDOW_WIDTH,
    height: OVERLAY_WINDOW_HEIGHT,
    x: overlayBounds.x,
    y: overlayBounds.y,
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

  overlayWindow.loadURL("http://localhost/overlay.html");

  overlayWindow.setVisibleOnAllWorkspaces(true);
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  setWindowClickThrough(overlayWindow);

  const reanchorOverlay = () => {
    positionOverlayWindow();
  };

  screen.on("display-metrics-changed", reanchorOverlay);
  screen.on("display-added", reanchorOverlay);
  screen.on("display-removed", reanchorOverlay);
  powerMonitor.on("resume", reanchorOverlay);
  powerMonitor.on("unlock-screen", reanchorOverlay);

  const alwaysOnTopTimer = setInterval(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      positionOverlayWindow();
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
    } else {
      clearInterval(alwaysOnTopTimer);
    }
  }, 5000);

  overlayWindow.on("show", () => {
    positionOverlayWindow();
    overlayWindow?.setAlwaysOnTop(true, "screen-saver");
  });

  overlayWindow.on("closed", () => {
    clearInterval(alwaysOnTopTimer);
    screen.off("display-metrics-changed", reanchorOverlay);
    screen.off("display-added", reanchorOverlay);
    screen.off("display-removed", reanchorOverlay);
    powerMonitor.off("resume", reanchorOverlay);
    powerMonitor.off("unlock-screen", reanchorOverlay);
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

  audioWindow.loadURL("http://localhost/audio.html");

  audioWindow.on("closed", () => {
    audioWindow = null;
  });

  return audioWindow;
}

function setWindowClickThrough(win: BrowserWindow): void {
  win.setIgnoreMouseEvents(true, { forward: true });
}

function positionOverlayWindow(): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  const bounds = calculateOverlayBounds(screen.getPrimaryDisplay().workArea);
  overlayWindow.setBounds(bounds);
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
