import { globalShortcut } from "electron";

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
      console.log(`[Whisper] Push-to-talk key released → stopping…`);
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
    console.warn("[Whisper] uiohook-napi not available (run `npm run rebuild` to build native modules). Falling back to toggle mode.");
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  const expectedKeycode = UIOHOOK_KEY_MAP[normalizedKey];
  if (expectedKeycode === undefined) {
    console.warn(`[Whisper] Unknown hotkey: "${normalizedKey}", falling back to toggle mode.`);
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  try {
    const { uIOhook, UiohookKey } = require("uiohook-napi");

    uIOhook.on("keydown", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && !state?.isPressed) {
        if (state) state.isPressed = true;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        console.log(`[Whisper] Push-to-talk key pressed (${keyName}) → recording…`);
        onKeyDown();
      }
    });

    uIOhook.on("keyup", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && state?.isPressed) {
        if (state) state.isPressed = false;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        console.log(`[Whisper] Push-to-talk key released (${keyName}) → stopping…`);
        onKeyUp();
      }
    });

    uIOhook.start();
    console.log(`[Whisper] Hotkey registered via uiohook: ${normalizedKey} (keycode ${expectedKeycode})`);
  } catch (err) {
    console.warn("[Whisper] uiohook-napi failed to start, falling back to globalShortcut toggle mode:", err);
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
        console.log(`[Whisper] Toggle mode: recording ON (${accelerator})`);
        state?.onKeyDown();
      } else {
        recording = false;
        console.log(`[Whisper] Toggle mode: recording OFF (${accelerator})`);
        state?.onKeyUp();
        stopPolling();
      }
    });
    console.log(`[Whisper] Hotkey registered via globalShortcut toggle: ${accelerator}`);
  } catch (err) {
    console.error("[Whisper] Failed to register any hotkey:", err);
  }
}

export function updateHotkey(key: string): void {
  if (state) {
    const { onKeyDown, onKeyUp } = state;
    console.log(`[Whisper] Hotkey changed to: ${key} → re-registering…`);
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
