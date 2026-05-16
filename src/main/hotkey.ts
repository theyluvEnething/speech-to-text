import { globalShortcut } from "electron";
import { events } from "./events";

type HotkeyCallback = () => void;

interface HotkeyState {
  currentKey: string;
  onKeyDown: HotkeyCallback;
  onKeyUp: HotkeyCallback;
  isPressed: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
}

let state: HotkeyState | null = null;

const UIOHOOK_KEY_MAP: Record<string, number> = {
  "alt": 56,
  "altright": 3640,
  "ctrl": 29,
  "ctrlright": 3613,
  "shift": 42,
  "shiftright": 54,
  "meta": 3675,
  "metaright": 3676,
};

const ACCELERATOR_MAP: Record<string, string> = {
  "alt": "Alt",
  "altright": "Alt",
  "ctrl": "Control",
  "ctrlright": "Control",
  "shift": "Shift",
  "shiftright": "Shift",
};

function uiohookAvailable(): boolean {
  try {
    require("uiohook-napi");
    return true;
  } catch {
    return false;
  }
}

function startPolling(): void {
  if (!state) return;

  let wasPressed = true;

  state.pollTimer = setInterval(() => {
    if (!state) return;

    let isPressed = false;
    try {
      const { uIOhook } = require("uiohook-napi");
      const keycode = UIOHOOK_KEY_MAP[state.currentKey];
      if (keycode !== undefined) {
        isPressed = uIOhook.keyIsPressed(keycode);
      }
    } catch {
      // uiohook polling failed
    }

    if (wasPressed && !isPressed) {
      state.isPressed = false;
      events.log("WARN", "Push-to-talk key released — stopping...");
      state.onKeyUp();
      stopPolling();
    }

    wasPressed = isPressed;
  }, 50);
}

function stopPolling(): void {
  if (state?.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

export function registerHotkey(
  key: string,
  onKeyDown: HotkeyCallback,
  onKeyUp: HotkeyCallback,
): void {
  unregisterAll();

  const normalizedKey = key.toLowerCase();

  state = {
    currentKey: normalizedKey,
    onKeyDown,
    onKeyUp,
    isPressed: false,
    pollTimer: null,
  };

  if (!uiohookAvailable()) {
    events.log("WARN", "uiohook-napi not available (run `npm run rebuild` to build native modules). Falling back to toggle mode.");
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  const expectedKeycode = UIOHOOK_KEY_MAP[normalizedKey];
  if (expectedKeycode === undefined) {
    events.log("WARN", `Unknown hotkey: "${normalizedKey}", falling back to toggle mode.`);
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  try {
    const { uIOhook, UiohookKey } = require("uiohook-napi");

    uIOhook.on("keydown", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && !state?.isPressed) {
        if (state) state.isPressed = true;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        events.log("INFO", `Push-to-talk key pressed (${keyName}) — recording...`);
        onKeyDown();
      }
    });

    uIOhook.on("keyup", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && state?.isPressed) {
        if (state) state.isPressed = false;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        events.log("WARN", `Push-to-talk key released (${keyName}) — stopping...`);
        onKeyUp();
      }
    });

    uIOhook.start();
    events.log("SUCCESS", `Hotkey registered via uiohook: ${normalizedKey} (keycode ${expectedKeycode})`);
  } catch (err) {
    events.log("ERROR", `uiohook-napi failed to start, falling back to globalShortcut toggle mode: ${String(err)}`);
    registerGlobalShortcutFallback(normalizedKey);
  }
}

function registerGlobalShortcutFallback(key: string): void {
  const accelerator = ACCELERATOR_MAP[key] ?? key;
  let recording = false;

  try {
    globalShortcut.register(accelerator, () => {
      if (!recording) {
        recording = true;
        events.log("INFO", `Toggle mode: recording ON (${accelerator})`);
        state?.onKeyDown();
      } else {
        recording = false;
        events.log("WARN", `Toggle mode: recording OFF (${accelerator})`);
        state?.onKeyUp();
        stopPolling();
      }
    });
    events.log("INFO", `Hotkey registered via globalShortcut toggle: ${accelerator}`);
  } catch (err) {
    events.log("ERROR", `Failed to register any hotkey: ${String(err)}`);
  }
}

export function updateHotkey(key: string): void {
  if (state) {
    const { onKeyDown, onKeyUp } = state;
    events.log("INFO", `Hotkey changed to: ${key} — re-registering...`);
    registerHotkey(key, onKeyDown, onKeyUp);
  }
}

export function unregisterAll(): void {
  stopPolling();

  try {
    const { uIOhook } = require("uiohook-napi");
    uIOhook.stop();
  } catch {
    // uiohook not available
  }

  globalShortcut.unregisterAll();
  state = null;
}
