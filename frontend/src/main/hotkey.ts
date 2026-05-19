import { globalShortcut } from "electron";

type HotkeyCallback = () => void;

interface HotkeyState {
  currentKey: string;
  onKeyDown: HotkeyCallback;
  onKeyUp: HotkeyCallback;
  isPressed: boolean;
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
  };

  if (!uiohookAvailable()) {
    console.warn("[Wavely] uiohook-napi not available (run `npm run rebuild` to build native modules). Falling back to toggle mode.");
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  const expectedKeycode = UIOHOOK_KEY_MAP[normalizedKey];
  if (expectedKeycode === undefined) {
    console.warn(`[Wavely] Unknown hotkey: "${normalizedKey}", falling back to toggle mode.`);
    registerGlobalShortcutFallback(normalizedKey);
    return;
  }

  try {
    const { uIOhook, UiohookKey } = require("uiohook-napi");

    uIOhook.on("keydown", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && !state?.isPressed) {
        if (state) state.isPressed = true;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        console.log(`[Wavely] Push-to-talk key pressed (${keyName}) -> recording...`);
        onKeyDown();
      }
    });

    uIOhook.on("keyup", (event: { keycode: number }) => {
      if (event.keycode === expectedKeycode && state?.isPressed) {
        if (state) state.isPressed = false;
        const keyName = UiohookKey[event.keycode] ?? event.keycode;
        console.log(`[Wavely] Push-to-talk key released (${keyName}) -> stopping...`);
        onKeyUp();
      }
    });

    uIOhook.start();
    console.log(`[Wavely] Hotkey registered via uiohook: ${normalizedKey} (keycode ${expectedKeycode})`);
  } catch (err) {
    console.warn("[Wavely] uiohook-napi failed to start, falling back to globalShortcut toggle mode:", err);
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
        console.log(`[Wavely] Toggle mode: recording ON (${accelerator})`);
        state?.onKeyDown();
      } else {
        recording = false;
        console.log(`[Wavely] Toggle mode: recording OFF (${accelerator})`);
        state?.onKeyUp();
      }
    });
    console.log(`[Wavely] Hotkey registered via globalShortcut toggle: ${accelerator}`);
  } catch (err) {
    console.error("[Wavely] Failed to register any hotkey:", err);
  }
}

export function updateHotkey(key: string): void {
  if (state) {
    const { onKeyDown, onKeyUp } = state;
    console.log(`[Wavely] Hotkey changed to: ${key} -> re-registering...`);
    registerHotkey(key, onKeyDown, onKeyUp);
  }
}

export function unregisterAll(): void {
  try {
    const { uIOhook } = require("uiohook-napi");
    uIOhook.stop();
  } catch {
    // uiohook not available
  }

  globalShortcut.unregisterAll();
  state = null;
}
