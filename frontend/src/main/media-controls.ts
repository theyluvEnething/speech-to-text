/**
 * Media and Discord controls during transcription.
 *
 * Media: pauses only sources that are actually playing and resumes exactly
 *   those afterwards — never starts something that was stopped.
 *   - Windows: System Media Transport Controls (SMTC) via WinRT in PowerShell.
 *     Covers any SMTC-aware app (Spotify, browsers/YouTube, VLC, …).
 *   - macOS: AppleScript control of Spotify and Apple Music.
 * Discord (Windows only): briefly activates Discord's window, sends
 *   Ctrl+Shift+M (Toggle Mute) or Ctrl+Shift+D (Toggle Deafen), then restores
 *   the previous foreground window.
 *
 * Discord requires matching keybinds:
 *   Settings → Keybinds → Add: Toggle Mute → Ctrl+Shift+M
 *   Settings → Keybinds → Add: Toggle Deafen → Ctrl+Shift+D
 */

import { execFile } from "child_process";
import {
  parsePausedIds,
  windowsPauseScript,
  windowsResumeScript,
  macPauseScript,
  macResumeScript,
} from "./media-scripts";

// ── State ───────────────────────────────────────────────────────────────────

interface MediaState {
  /** Ids of sources we paused, so restore resumes exactly those. */
  pausedMediaIds: string[];
  /** The mode we muted Discord with, or null if we didn't. */
  discordMutedMode: "mic" | "full" | null;
}

const s: MediaState = { pausedMediaIds: [], discordMutedMode: null };

const isWindows = process.platform === "win32";
const isMac = process.platform === "darwin";

// ── Discord key codes (Windows C# below uses literals) ──────────────────────

const VK_M = 0x4d;
const VK_D = 0x44;

// ── Logging ─────────────────────────────────────────────────────────────────

function L(msg: string): void {
  console.log(`[MediaControls] ${msg}`);
}

// ── Discord C# (Windows) ─────────────────────────────────────────────────────

const DISCORD_CS = `
using System;using System.Runtime.InteropServices;using System.Text;using System.Diagnostics;
[StructLayout(LayoutKind.Sequential)]public struct KB{public ushort vk;public ushort sc;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Sequential)]public struct MI{public int dx;public int dy;public uint md;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Explicit)]public struct MU{[FieldOffset(0)]public MI mi;[FieldOffset(0)]public KB ki;}
[StructLayout(LayoutKind.Sequential)]public struct IN{public uint tp;public MU u;}
public class X{
[DllImport("user32.dll")]public static extern uint SendInput(uint n,IN[] ii,int cb);
[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("kernel32.dll")]public static extern void Sleep(uint ms);

public static void S(ushort vk,ushort sc,uint fl){
var ii=new IN[1];ii[0].tp=1;ii[0].u.ki.vk=vk;ii[0].u.ki.sc=sc;ii[0].u.ki.fl=fl;
uint r=SendInput(1,ii,Marshal.SizeOf(typeof(IN)));
if(r==0){int e=Marshal.GetLastWin32Error();Console.Error.Write("ERR:"+e);}}

public static IntPtr FindDiscordWindow(){
var procs=Process.GetProcessesByName("discord");
foreach(var p in procs){try{var h=p.MainWindowHandle;if(h!=IntPtr.Zero&&p.MainWindowTitle.ToLowerInvariant().Contains("discord"))return h;}catch{}}
IntPtr found=IntPtr.Zero;
EnumWindows(delegate(IntPtr h,IntPtr l){var sb=new StringBuilder(256);GetWindowText(h,sb,256);if(sb.ToString().ToLowerInvariant().Contains("discord")){found=h;return false;}return true;},IntPtr.Zero);
return found;}

[DllImport("user32.dll")]public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc,IntPtr lParam);
public delegate bool EnumWindowsProc(IntPtr hWnd,IntPtr lParam);
[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr hWnd,StringBuilder lpString,int nMaxCount);

public static void DiscordHotkey(ushort actionVk){
IntPtr discordHwnd=FindDiscordWindow();
if(discordHwnd==IntPtr.Zero){Console.Error.Write("NO_DISCORD_WINDOW");return;}
IntPtr prev=GetForegroundWindow();
if(prev!=discordHwnd){SetForegroundWindow(discordHwnd);Sleep(40);}
S(0x11,0,0);S(0x10,0,0);S(actionVk,0,0);S(actionVk,0,2);S(0x10,0,2);S(0x11,0,2);
Sleep(30);
if(prev!=IntPtr.Zero&&prev!=discordHwnd){SetForegroundWindow(prev);}
Console.Write("DC_OK");
}
}`;

// ── Process runners ──────────────────────────────────────────────────────────

function run(file: string, args: string[], label: string): Promise<string> {
  L(`  [run: ${label}]`);
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 6000, windowsHide: true }, (err, stdout, stderr) => {
      const out = stdout.trim();
      const errOut = stderr.trim();
      if (errOut) {
        const parts = errOut.split("\n").filter((p) => p.trim() && !p.includes("DC_OK"));
        if (parts.length) L(`  [stderr] ${parts.join(" | ")}`);
      }
      if (err && !errOut.includes("DC_OK")) L(`  [FAILED] ${err.message}`);
      resolve(out || errOut);
    });
  });
}

function runPowerShell(script: string, label: string): Promise<string> {
  return run(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
    label,
  );
}

function runOsascript(script: string, label: string): Promise<string> {
  return run("osascript", ["-e", script], label);
}

// ── Media: pause / resume ─────────────────────────────────────────────────────

async function pausePlayingMedia(): Promise<string[]> {
  if (isWindows) return parsePausedIds(await runPowerShell(windowsPauseScript(), "smtc pause"));
  if (isMac) return parsePausedIds(await runOsascript(macPauseScript(), "media pause"));
  L("media pause not supported on this platform — skip");
  return [];
}

async function resumeMedia(ids: string[]): Promise<void> {
  if (!ids.length) return;
  L(`→ resume media: ${ids.join(", ")}`);
  if (isWindows) {
    await runPowerShell(windowsResumeScript(ids), "smtc resume");
  } else if (isMac) {
    await runOsascript(macResumeScript(ids), "media resume");
  }
}

// ── Discord: toggle mute / deafen ─────────────────────────────────────────────

async function toggleDiscord(mode: "mic" | "full"): Promise<void> {
  if (!isWindows) {
    L("Discord control not supported on this platform — skip");
    return;
  }

  const vk = mode === "mic" ? VK_M : VK_D;
  const label = mode === "mic" ? "Ctrl+Shift+M" : "Ctrl+Shift+D";
  L(`→ toggleDiscord("${mode}") — ${label}`);

  const script = `Add-Type -TypeDefinition @"\n${DISCORD_CS}\n"@\n[X]::DiscordHotkey(${vk});`;
  const result = await runPowerShell(script, label);

  if (result.includes("DC_OK")) {
    L(`  ${label} OK`);
  } else if (result.includes("NO_DISCORD_WINDOW")) {
    L("  Discord window not found — is Discord running?");
  } else {
    L(`  ${label} — unknown result: ${result.slice(0, 80)}`);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface MediaControlsSettings {
  mediaPauseEnabled: boolean;
  discordMuteEnabled: boolean;
  discordMuteMode: "mic" | "full";
}

export async function applyMediaControls(cfg: MediaControlsSettings): Promise<void> {
  L(`=== apply mediaPause=${cfg.mediaPauseEnabled} discordMute=${cfg.discordMuteEnabled} mode=${cfg.discordMuteMode}`);

  s.pausedMediaIds = [];
  s.discordMutedMode = null;

  if (cfg.mediaPauseEnabled) {
    s.pausedMediaIds = await pausePlayingMedia();
    L(`  paused ${s.pausedMediaIds.length} source(s): ${s.pausedMediaIds.join(", ") || "(none playing)"}`);
  } else {
    L("  media pause disabled — skip");
  }

  if (cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
    s.discordMutedMode = cfg.discordMuteMode;
  } else {
    L("  discord mute disabled — skip");
  }

  L("=== apply END");
}

/**
 * Undo whatever apply() did, driven by recorded state rather than current
 * config — so we always resume media we paused and unmute Discord with the
 * same mode, even if a setting changed mid-recording.
 */
async function undo(): Promise<void> {
  if (s.pausedMediaIds.length) {
    await resumeMedia(s.pausedMediaIds);
  }
  if (s.discordMutedMode) {
    await toggleDiscord(s.discordMutedMode);
  }
  s.pausedMediaIds = [];
  s.discordMutedMode = null;
}

export async function restoreMediaControls(): Promise<void> {
  L(`=== restore paused=${s.pausedMediaIds.length} mutedDiscord=${s.discordMutedMode !== null}`);
  await undo();
  L("=== restore END");
}

export async function cleanupMediaControls(): Promise<void> {
  L(`=== cleanup paused=${s.pausedMediaIds.length} mutedDiscord=${s.discordMutedMode !== null}`);
  await undo();
}
