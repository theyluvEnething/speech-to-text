/**
 * Media and Discord controls during transcription.
 *
 * Sends VK_MEDIA_PLAY_PAUSE for media, and Ctrl+Shift+M / Ctrl+Shift+D
 * for Discord mute/deafen. All key injection happens via a single
 * PowerShell process (batched SendInput calls) for minimal latency.
 *
 * Discord requires matching keybinds:
 *   Settings → Keybinds → Add: Toggle Mute → Ctrl+Shift+M
 *   Settings → Keybinds → Add: Toggle Deafen → Ctrl+Shift+D
 */

import { execFile } from "child_process";

// ── State ───────────────────────────────────────────────────────────────────

interface MediaState {
  mediaWasPaused: boolean;
  discordWasMuted: boolean;
}

const s: MediaState = { mediaWasPaused: false, discordWasMuted: false };

// ── Key codes ───────────────────────────────────────────────────────────────

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

// ── PowerShell + SendInput (batched) ───────────────────────────────────────

/** Builds a C# SendInput call string: S(vk,sc,flags) */
function K(vk: number, sc: number, fl: number): string {
  return `S(${vk},${sc},${fl})`;
}

/** Execute batched SendInput calls in a single PowerShell process. */
async function psSend(calls: string[], label: string): Promise<void> {
  const body = calls.map((c) => `[X]::${c};`).join("");

  // Correct INPUT layout matching Windows ABI: union is sized by largest
  // member (MOUSEINPUT=32 bytes on x64), not KEYBDINPUT (24 bytes).
  const script = `Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]public struct KB{public ushort vk;public ushort sc;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Sequential)]public struct MI{public int dx;public int dy;public uint md;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Explicit)]public struct MU{[FieldOffset(0)]public MI mi;[FieldOffset(0)]public KB ki;}
[StructLayout(LayoutKind.Sequential)]public struct IN{public uint tp;public MU u;}
public class X{
[DllImport("user32.dll")]public static extern uint SendInput(uint n,IN[] ii,int cb);
public static void S(ushort vk,ushort sc,uint fl){var ii=new IN[1];ii[0].tp=1;ii[0].u.ki.vk=vk;ii[0].u.ki.sc=sc;ii[0].u.ki.fl=fl;uint r=SendInput(1,ii,Marshal.SizeOf(typeof(IN)));if(r==0){int e=Marshal.GetLastWin32Error();Console.Error.Write("ERR:"+e+" cb="+Marshal.SizeOf(typeof(IN)));}}
}
"@\n${body}`;

  L(`  [ps batch: ${label}] ${calls.length} key event(s)`);

  await new Promise<void>((resolve, reject) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      { timeout: 5000, windowsHide: true },
      (err, _stdout, stderr) => {
        if (stderr) {
          const trimmed = stderr.trim();
          if (trimmed) L(`  [ps] stderr: ${trimmed}`);
        }
        if (err) {
          L(`  [ps] FAILED: ${err.message}`);
          // Don't reject — a failed key injection shouldn't crash the app
          resolve();
          return;
        }
        resolve();
      },
    );
  });
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function toggleMedia(): Promise<void> {
  L("→ toggleMedia() — VK_MEDIA_PLAY_PAUSE");
  // KEYEVENTF_EXTENDEDKEY tells Windows this is an extended key.
  // Scan code must be 0 — Windows auto-generates it from the VK code.
  await psSend(
    [
      K(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY),
      K(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP),
    ],
    "media toggle",
  );
  L("  VK_MEDIA_PLAY_PAUSE done");
}

async function toggleDiscord(mode: "mic" | "full"): Promise<void> {
  const vk = mode === "mic" ? VK_M : VK_D;
  const label = mode === "mic" ? "Ctrl+Shift+M" : "Ctrl+Shift+D";
  L(`→ toggleDiscord("${mode}") — ${label}`);

  // Press modifiers, tap action key, release modifiers — all in one batch
  await psSend(
    [
      K(VK_CONTROL, 0, 0),
      K(VK_SHIFT, 0, 0),
      K(vk, 0, 0),
      K(vk, 0, KEYEVENTF_KEYUP),
      K(VK_SHIFT, 0, KEYEVENTF_KEYUP),
      K(VK_CONTROL, 0, KEYEVENTF_KEYUP),
    ],
    label,
  );
  L(`  ${label} done`);
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
    `=== apply START mediaPause=${cfg.mediaPauseEnabled} discordMute=${cfg.discordMuteEnabled} mode=${cfg.discordMuteMode}`,
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

  L(`=== apply END (paused=${s.mediaWasPaused} muted=${s.discordWasMuted})`);
}

export async function restoreMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== restore START wasPaused=${s.mediaWasPaused} wasMuted=${s.discordWasMuted}`);

  if (s.mediaWasPaused && cfg.mediaPauseEnabled) {
    await toggleMedia();
  }
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }

  s.mediaWasPaused = false;
  s.discordWasMuted = false;
  L(`=== restore END`);
}

export async function cleanupMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== cleanup (wasMuted=${s.discordWasMuted})`);
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }
  s.mediaWasPaused = false;
  s.discordWasMuted = false;
}
