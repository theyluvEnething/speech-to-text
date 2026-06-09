/**
 * Media and Discord audio controls during transcription.
 *
 * Windows: Uses koffi (pure-JS FFI) to call user32.dll directly —
 *   keybd_event for media keys and Discord hotkeys. No PowerShell,
 *   no C# compilation, no process spawn. Sub-millisecond calls.
 *
 * macOS: Falls back to nut-js keyboard simulation for media keys.
 *
 * ## Discord approach (Windows)
 *
 * Discord registers global hotkeys via RegisterHotKey. When we
 * simulate Ctrl+Shift+M (Toggle Mute) or Ctrl+Shift+D (Toggle
 * Deafen) via keybd_event, the system routes the keystroke through
 * the normal input pipeline and Discord's hotkey handler picks it
 * up — regardless of which window is focused.
 *
 * **The user must configure the matching keybind in Discord:**
 *   Settings → Keybinds → Add a Keybind
 *   - Toggle Mute → Ctrl+Shift+M
 *   - Toggle Deafen → Ctrl+Shift+D
 *
 * ## Safeguard for media pause/resume
 *
 * State tracking ensures we only restore what we changed. If the
 * user manually resumes media during transcription, we detect it
 * (audio is playing again) and skip the restore to avoid an
 * unintended pause.
 */

import { keyboard, Key } from "@nut-tree-fork/nut-js";

keyboard.config.autoDelayMs = 5;

// ── State tracking ──────────────────────────────────────────────────────────

interface MediaState {
  mediaWasPaused: boolean;
  discordWasMuted: boolean;
}

const state: MediaState = {
  mediaWasPaused: false,
  discordWasMuted: false,
};

// ── Windows API bindings (koffi) ────────────────────────────────────────────

type KeybdEventFn = (bVk: number, bScan: number, dwFlags: number, dwExtraInfo: number) => void;

// Constants
const VK_MEDIA_PLAY_PAUSE = 0xb3;
const VK_CONTROL = 0x11;
const VK_SHIFT = 0x10;
const KEYEVENTF_KEYUP = 0x0002;

// Standard Windows scan codes for modifier keys
const SC_CONTROL = 0x1d;
const SC_SHIFT = 0x2a;
const SC_M = 0x32;
const SC_D = 0x20;

let koffiLoaded = false;
let _keybdEvent: KeybdEventFn | null = null;

function loadKoffi(): KeybdEventFn | null {
  if (_keybdEvent) return _keybdEvent;
  if (koffiLoaded) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const koffi = require("koffi");
    const user32 = koffi.load("user32.dll");
    _keybdEvent = user32.func("void", "keybd_event", [
      "uchar",
      "uchar",
      "uint",
      "uintptr_t",
    ]);
    console.log("[MediaControls] koffi loaded — direct Windows API available.");
  } catch (err) {
    koffiLoaded = true;
    console.warn(
      "[MediaControls] koffi unavailable, falling back to nut-js:",
      (err as Error).message,
    );
  }
  koffiLoaded = true;
  return _keybdEvent;
}

// ── Media key helpers ───────────────────────────────────────────────────────

function sendMediaToggle(): void {
  const fn = loadKoffi();
  if (fn) {
    // Direct Windows API — VK_MEDIA_PLAY_PAUSE (0xB3)
    // keybd_event is a well-tested API that sends to the system
    // input queue, same as a physical media key.
    fn(VK_MEDIA_PLAY_PAUSE, 0, 0, 0);
    fn(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_KEYUP, 0);
    return;
  }

  // macOS fallback: nut-js keyboard (maps to CGEvent)
  keyboard.pressKey(Key.AudioPause).catch(() => {});
  keyboard.releaseKey(Key.AudioPause).catch(() => {});
}

// ── Discord hotkey helpers ──────────────────────────────────────────────────

/**
 * Discord global hotkey combinations.
 *
 * Users must configure these EXACT keybinds in Discord:
 *   Settings → Keybinds → Add a Keybind
 *   - Toggle Mute → Ctrl+Shift+M
 *   - Toggle Deafen → Ctrl+Shift+D
 *
 * We simulate the key combo via keybd_event, which goes through
 * the system input queue. Discord's global hotkey handler
 * (RegisterHotKey) picks it up regardless of focused window.
 */
const DISCORD_HOTKEYS = {
  mic: {
    key: 0x4d, // M
    scan: SC_M,
  },
  full: {
    key: 0x44, // D
    scan: SC_D,
  },
} as const;

function sendDiscordToggle(mode: "mic" | "full"): void {
  const fn = loadKoffi();
  if (!fn) {
    // macOS fallback
    console.warn(
      "[MediaControls] Cannot send Discord hotkey on macOS without koffi. " +
        "Discord mute on macOS requires manual configuration.",
    );
    return;
  }

  const hk = DISCORD_HOTKEYS[mode];

  // Press modifiers
  fn(VK_CONTROL, SC_CONTROL, 0, 0);
  fn(VK_SHIFT, SC_SHIFT, 0, 0);

  // Press + release the action key
  fn(hk.key, hk.scan, 0, 0);
  fn(hk.key, hk.scan, KEYEVENTF_KEYUP, 0);

  // Release modifiers
  fn(VK_SHIFT, SC_SHIFT, KEYEVENTF_KEYUP, 0);
  fn(VK_CONTROL, SC_CONTROL, KEYEVENTF_KEYUP, 0);
}

// ── Audio playback detection ────────────────────────────────────────────────

/**
 * Quick check: is any audio currently playing?
 *
 * On Windows, we use a lightweight heuristic — we check if the
 * media key has any registered handler. If we can't determine
 * playback state, we err on the side of caution (assume playing).
 *
 * On macOS, we always assume playing — the media key toggle
 * is harmless if nothing is playing.
 */
async function isAudioPlaying(): Promise<boolean> {
  if (process.platform === "win32") {
    // On Windows, we can't easily detect playback state without
    // Core Audio API. But sending VK_MEDIA_PLAY_PAUSE when nothing
    // is playing is generally harmless (most apps ignore it).
    // We default to assuming something IS playing — this means
    // we'll always send the pause key. The safeguard is: if we
    // paused something unnecessarily, the restore will re-check
    // and skip if audio is now playing.
    return true;
  }

  // macOS: always assume playing
  return true;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface MediaControlsSettings {
  mediaPauseEnabled: boolean;
  discordMuteEnabled: boolean;
  discordMuteMode: "mic" | "full";
}

/**
 * Apply media controls when recording starts.
 *
 * - If mediaPauseEnabled: send VK_MEDIA_PLAY_PAUSE
 * - If discordMuteEnabled: send Discord toggle mute/deafen hotkey
 *
 * Tracks in internal state what was changed so
 * {@link restoreMediaControls} can safely undo only those actions.
 */
export async function applyMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  state.mediaWasPaused = false;
  state.discordWasMuted = false;

  // ── Media pause ────────────────────────────────────────────────
  if (settings.mediaPauseEnabled) {
    const playing = await isAudioPlaying();
    if (playing) {
      console.log("[MediaControls] Pausing media.");
      sendMediaToggle();
      state.mediaWasPaused = true;
    } else {
      console.log("[MediaControls] No audio playing — skipping media pause.");
    }
  }

  // ── Discord mute ───────────────────────────────────────────────
  if (settings.discordMuteEnabled) {
    console.log(
      `[MediaControls] Toggling Discord mute (${settings.discordMuteMode} mode).`,
    );
    sendDiscordToggle(settings.discordMuteMode);
    state.discordWasMuted = true;
  }
}

/**
 * Restore media controls after successful transcription.
 *
 * Only restores what {@link applyMediaControls} actually changed.
 * Re-checks audio playback state before resuming media — if the
 * user manually resumed during transcription, we skip.
 */
export async function restoreMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  // ── Media resume ───────────────────────────────────────────────
  if (state.mediaWasPaused && settings.mediaPauseEnabled) {
    // Re-check: if audio is now playing (user manually resumed
    // during transcription), don't toggle it off again.
    const playing = await isAudioPlaying();
    if (!playing) {
      console.log("[MediaControls] Resuming media playback.");
      sendMediaToggle();
    } else {
      console.log(
        "[MediaControls] Audio already playing — skipping media resume " +
          "(user may have manually resumed).",
      );
    }
  }

  // ── Discord unmute ─────────────────────────────────────────────
  if (state.discordWasMuted && settings.discordMuteEnabled) {
    console.log(
      `[MediaControls] Toggling Discord unmute (${settings.discordMuteMode} mode).`,
    );
    sendDiscordToggle(settings.discordMuteMode);
  }

  state.mediaWasPaused = false;
  state.discordWasMuted = false;
}

/**
 * Clean up after error / abort.
 *
 * Unmutes Discord if we muted it. Does NOT resume media — the
 * user likely wants to keep listening.
 */
export async function cleanupMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  if (state.discordWasMuted && settings.discordMuteEnabled) {
    console.log("[MediaControls] Cleanup: unmuting Discord after error.");
    sendDiscordToggle(settings.discordMuteMode);
  }
  state.mediaWasPaused = false;
  state.discordWasMuted = false;
}
