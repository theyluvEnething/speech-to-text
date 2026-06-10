/**
 * Media and Discord controls during transcription.
 *
 * Media: Sends VK_MEDIA_PLAY_PAUSE via SendInput (system-wide).
 * Discord: Finds Discord's window, briefly activates it, sends
 *   Ctrl+Shift+M (Toggle Mute) or Ctrl+Shift+D (Toggle Deafen),
 *   then restores the previous foreground window.
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

// ── C# support (shared) ─────────────────────────────────────────────────────

const SHARED_CS = `
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
// Try process MainWindowHandle first
var procs=Process.GetProcessesByName("discord");
foreach(var p in procs){try{var h=p.MainWindowHandle;if(h!=IntPtr.Zero&&p.MainWindowTitle.ToLowerInvariant().Contains("discord"))return h;}catch{}}
// Fallback: enum windows looking for title containing "Discord"
IntPtr found=IntPtr.Zero;
EnumWindows(delegate(IntPtr h,IntPtr l){var sb=new StringBuilder(256);GetWindowText(h,sb,256);if(sb.ToString().ToLowerInvariant().Contains("discord")){found=h;return false;}return true;},IntPtr.Zero);
return found;}

[DllImport("user32.dll")]public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc,IntPtr lParam);
delegate bool EnumWindowsProc(IntPtr hWnd,IntPtr lParam);
[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr hWnd,StringBuilder lpString,int nMaxCount);

public static void DiscordHotkey(ushort actionVk){
IntPtr discordHwnd=FindDiscordWindow();
if(discordHwnd==IntPtr.Zero){Console.Error.Write("NO_DISCORD_WINDOW");return;}
IntPtr prev=GetForegroundWindow();
if(prev!=discordHwnd){SetForegroundWindow(discordHwnd);Sleep(40);}
// Send Ctrl+Shift+action
S(0x11,0,0);S(0x10,0,0);S(actionVk,0,0);S(actionVk,0,2);S(0x10,0,2);S(0x11,0,2);
Sleep(30);
if(prev!=IntPtr.Zero&&prev!=discordHwnd){SetForegroundWindow(prev);}
Console.Write("DC_OK");
}
}`;

// ── PowerShell runner ───────────────────────────────────────────────────────

function runScript(csharpBody: string, label: string): Promise<string> {
  const script = `Add-Type -TypeDefinition @"\n${SHARED_CS}\n"@\n${csharpBody}`;

  L(`  [ps: ${label}]`);

  return new Promise((resolve) => {
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
      { timeout: 6000, windowsHide: true },
      (err, stdout, stderr) => {
        const out = stdout.trim();
        const errOut = stderr.trim();
        if (errOut) {
          // Filter: only log actual errors, not the "DC_OK" output
          const parts = errOut.split("\n").filter((p) => p.trim() && !p.includes("DC_OK"));
          if (parts.length) L(`  [ps stderr] ${parts.join(" | ")}`);
        }
        if (out) L(`  [ps stdout] ${out}`);
        if (err && !errOut.includes("DC_OK")) {
          L(`  [ps FAILED] ${err.message}`);
        }
        resolve(out || errOut);
      },
    );
  });
}

// ── Actions ─────────────────────────────────────────────────────────────────

async function toggleMedia(): Promise<void> {
  L("→ toggleMedia() — VK_MEDIA_PLAY_PAUSE");
  await runScript(
    `[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY});[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY}|${KEYEVENTF_KEYUP});`,
    "media key",
  );
  L("  media key done");
}

async function toggleDiscord(mode: "mic" | "full"): Promise<void> {
  const vk = mode === "mic" ? VK_M : VK_D;
  const label = mode === "mic" ? "Ctrl+Shift+M" : "Ctrl+Shift+D";
  L(`→ toggleDiscord("${mode}") — ${label}`);

  const result = await runScript(`[X]::DiscordHotkey(${vk});`, label);

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

export async function applyMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== apply mediaPause=${cfg.mediaPauseEnabled} discordMute=${cfg.discordMuteEnabled} mode=${cfg.discordMuteMode}`);

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

  L(`=== apply END paused=${s.mediaWasPaused} muted=${s.discordWasMuted}`);
}

export async function restoreMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== restore wasPaused=${s.mediaWasPaused} wasMuted=${s.discordWasMuted}`);

  if (s.mediaWasPaused && cfg.mediaPauseEnabled) {
    await toggleMedia();
  }
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }

  s.mediaWasPaused = false;
  s.discordWasMuted = false;
  L("=== restore END");
}

export async function cleanupMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`=== cleanup wasMuted=${s.discordWasMuted}`);
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    await toggleDiscord(cfg.discordMuteMode);
  }
  s.mediaWasPaused = false;
  s.discordWasMuted = false;
}
