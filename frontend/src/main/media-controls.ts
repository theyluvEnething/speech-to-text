/**
 * Media and Discord audio controls during transcription.
 *
 * ## Media keys (YouTube, Spotify, etc.)
 *
 * Sends VK_MEDIA_PLAY_PAUSE (0xB3) via SendInput — the modern
 * Windows API — or keybd_event fallback. Behaves identically to
 * a physical media key press.
 *
 * ## Discord mute
 *
 * Simulates Ctrl+Shift+M (Toggle Mute) or Ctrl+Shift+D (Toggle
 * Deafen) via SendInput. Discord's RegisterHotKey handler picks
 * up system-level keystrokes regardless of focus.
 *
 * **User MUST configure matching keybinds in Discord:**
 *   Settings → Keybinds → Add a Keybind
 *   - Toggle Mute → Ctrl+Shift+M
 *   - Toggle Deafen → Ctrl+Shift+D
 */

import { execFile } from "child_process";

// ── State ───────────────────────────────────────────────────────────────────

interface MediaState {
  mediaWasPaused: boolean;
  discordWasMuted: boolean;
}

const s: MediaState = { mediaWasPaused: false, discordWasMuted: false };

// ── Key constants ───────────────────────────────────────────────────────────

const VK_MEDIA_PLAY_PAUSE = 0xb3;
const VK_CONTROL = 0x11;
const VK_SHIFT = 0x10;
const VK_M = 0x4d;
const VK_D = 0x44;
const KEYEVENTF_KEYUP = 0x0002;
const KEYEVENTF_EXTENDEDKEY = 0x0001;

// ── Logging ─────────────────────────────────────────────────────────────────

function L(msg: string): void {
  console.log(`[MediaControls] ${msg}`);
}

// ── C# SendInput helper (embedded in PowerShell) ────────────────────────────
//
// SendInput is the official Windows API for injecting keystrokes.
// It's more reliable than keybd_event and handles UIPI correctly.

const SENDINPUT_CS = `
[StructLayout(LayoutKind.Sequential)]
public struct K { public ushort vk; public ushort sc; public uint fl; public uint tm; public IntPtr ex; }

[StructLayout(LayoutKind.Sequential)]
public struct I { public uint tp; public K ki; }

[DllImport("user32.dll")]
public static extern uint SendInput(uint n, I[] ii, int cb);

public static void S(ushort vk, ushort sc, uint fl) {
  I[] ii = new I[1];
  ii[0].tp = 1;  // INPUT_KEYBOARD
  ii[0].ki.vk = vk;
  ii[0].ki.sc = sc;
  ii[0].ki.fl = fl;
  SendInput(1, ii, Marshal.SizeOf(typeof(I)));
}`;

function wrapCs(code: string): string {
  return `Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class X {
${code}
}
"@`;
}

function runPs(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout: 5000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(stderr?.trim() || stdout?.trim() || err.message));
          return;
        }
        resolve(stdout.trim());
      },
    );
  });
}

// ── Core: send a single keyboard event ──────────────────────────────────────
//
// Uses PowerShell + SendInput (the official Windows API) as the primary
// path. This is ~200ms per call but GUARANTEED to work. koffi keybd_event
// is tried first for speed; falls back silently to PowerShell.

let koffiOk = false;
let koffiTried = false;

function getKoffiFn(): ((vk: number, sc: number, fl: number) => void) | null {
  if (koffiTried) return koffiOk ? getKoffiFn.__fn ?? null : null;
  koffiTried = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ko = require("koffi");
    const u32 = ko.load("user32.dll");
    const fn = u32.func("void", "keybd_event", ["uchar", "uchar", "uint", "uintptr_t"]);
    // smoke test with a harmless key-up for a key that doesn't exist (VK=0)
    fn(0, 0, KEYEVENTF_KEYUP, 0);
    koffiOk = true;
    (getKoffiFn as unknown as Record<string, unknown>).__fn = fn;
    L("koffi loaded — fast path active");
    return fn as unknown as (vk: number, sc: number, fl: number) => void;
  } catch (err) {
    L(`koffi not available, will use PowerShell: ${(err as Error).message}`);
    return null;
  }
}

async function sendEv(vk: number, sc: number, fl: number): Promise<void> {
  // Try koffi first (fast, sub-ms)
  const kfn = getKoffiFn();
  if (kfn) {
    kfn(vk, sc, fl);
    return;
  }

  // Fallback: PowerShell + SendInput (reliable, ~200ms)
  const script = wrapCs(SENDINPUT_CS) + `\n[X]::S(${vk}, ${sc}, ${fl})`;
  L(`  [ps] sending vk=0x${vk.toString(16)} sc=0x${sc.toString(16)} fl=${fl}`);
  try {
    await runPs(script);
  } catch (err) {
    L(`  [ps] FAILED: ${(err as Error).message}`);
  }
}

async function sendKey(vk: number, sc: number): Promise<void> {
  const isMedia = vk === VK_MEDIA_PLAY_PAUSE;
  const ext = isMedia ? KEYEVENTF_EXTENDEDKEY : 0;
  const esc = isMedia ? 0xe0 : sc;
  await sendEv(vk, esc, ext);
  await sendEv(vk, esc, ext | KEYEVENTF_KEYUP);
}

// ── Public: media toggle ────────────────────────────────────────────────────

async function toggleMedia(): Promise<void> {
  L("→ toggleMedia() — sending VK_MEDIA_PLAY_PAUSE (0xB3)");
  await sendKey(VK_MEDIA_PLAY_PAUSE, 0);
  L("  VK_MEDIA_PLAY_PAUSE sent ✓");
}

// ── Public: Discord hotkey ──────────────────────────────────────────────────

async function toggleDiscord(mode: "mic" | "full"): Promise<void> {
  const vk = mode === "mic" ? VK_M : VK_D;
  const sc = mode === "mic" ? 0x32 : 0x20;
  const label =
    mode === "mic"
      ? "Ctrl+Shift+M (Toggle Mute)"
      : "Ctrl+Shift+D (Toggle Deafen)";

  L(`→ toggleDiscord("${mode}") — sending ${label}`);

  // Modifiers down
  await sendEv(VK_CONTROL, 0x1d, 0);
  await sendEv(VK_SHIFT, 0x2a, 0);
  // Action key press+release
  await sendEv(vk, sc, 0);
  await sendEv(vk, sc, KEYEVENTF_KEYUP);
  // Modifiers up
  await sendEv(VK_SHIFT, 0x2a, KEYEVENTF_KEYUP);
  await sendEv(VK_CONTROL, 0x1d, KEYEVENTF_KEYUP);

  L(`  ${label} sent ✓`);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface MediaControlsSettings {
  mediaPauseEnabled: boolean;
  discordMuteEnabled: boolean;
  discordMuteMode: "mic" | "full";
}

export async function applyMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(
    `=== applyMediaControls START === ` +
    `mediaPause=${cfg.mediaPauseEnabled} discordMute=${cfg.discordMuteEnabled} mode=${cfg.discordMuteMode}`,
  );

  s.mediaWasPaused = false;
  s.discordWasMuted = false;

  if (cfg.mediaPauseEnabled) {
    await toggleMedia();
    s.mediaWasPaused = true;
  } else {
    L("  media pause disabled — skip");
  }

  if (cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
    s.discordWasMuted = true;
  } else {
    L("  discord mute disabled — skip");
  }

  L(`=== applyMediaControls END (paused=${s.mediaWasPaused} muted=${s.discordWasMuted}) ===`);
}

export async function restoreMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(
    `=== restoreMediaControls START === ` +
    `wasPaused=${s.mediaWasPaused} wasMuted=${s.discordWasMuted}`,
  );

  if (s.mediaWasPaused && cfg.mediaPauseEnabled) {
    await toggleMedia();
  }
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }

  s.mediaWasPaused = false;
  s.discordWasMuted = false;
  L("=== restoreMediaControls END ===");
}

export async function cleanupMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== cleanupMediaControls (wasMuted=${s.discordWasMuted}) ===`);
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }
  s.mediaWasPaused = false;
  s.discordWasMuted = false;
}
