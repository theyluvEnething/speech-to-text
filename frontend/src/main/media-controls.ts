/**
 * Media and Discord audio controls during transcription.
 *
 * Windows: Uses koffi (FFI) for sub-millisecond keybd_event calls,
 *   plus a PowerShell helper for Core Audio API playback detection
 *   and Discord window activation.
 * macOS: Stub — nut-js fallback for media keys (to be implemented).
 *
 * Discord requires matching keybinds:
 *   Settings -> Keybinds -> Add: Toggle Mute -> Ctrl+Shift+M
 *   Settings -> Keybinds -> Add: Toggle Deafen -> Ctrl+Shift+D
 */

import { execFile } from "child_process";

// ── Platform ────────────────────────────────────────────────────────────────

const IS_WIN = process.platform === "win32";

// ── State tracking ──────────────────────────────────────────────────────────

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
const KEYEVENTF_KEYDOWN = 0x0000;

// ── Logging (ASCII only — no emoji/Unicode to avoid terminal corruption) ────

function L(msg: string): void {
  console.log(`[MediaControls] ${msg}`);
}

// ── Windows: koffi fast path ────────────────────────────────────────────────

type KeybdEventFn = (vk: number, scan: number, flags: number, extra: number) => void;

let __koffiFn: KeybdEventFn | null = null;
let __koffiTried = false;

function koffiKeybdEvent(): KeybdEventFn | null {
  if (__koffiTried) return __koffiFn;
  __koffiTried = true;
  if (!IS_WIN) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ko = require("koffi");
    const u32 = ko.load("user32.dll");
    // koffi v3: C-style declaration string
    const fn = u32.func(
      "void keybd_event(uchar bVk, uchar bScan, uint dwFlags, uintptr_t dwExtraInfo)",
    );
    // smoke test: harmless key-up for a non-existent key
    fn(0, 0, KEYEVENTF_KEYUP, 0);
    __koffiFn = fn as unknown as KeybdEventFn;
    L("koffi keybd_event ready (fast path)");
    return __koffiFn;
  } catch (err) {
    L(`koffi unavailable: ${(err as Error).message}`);
    return null;
  }
}

/** Send a single key event via koffi (sub-ms). */
function sendKeyFast(vk: number, scan: number, flags: number): void {
  const fn = koffiKeybdEvent();
  if (fn) {
    fn(vk, scan, flags, 0);
  }
  // If koffi is unavailable, this is a no-op. PowerShell fallback
  // is only used for complex operations (Discord window + hotkey).
}

// ── Windows: PowerShell helpers ─────────────────────────────────────────────

function runPs(script: string, timeoutMs = 6000): Promise<string> {
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
      { timeout: timeoutMs, windowsHide: true },
      (_err, stdout, stderr) => {
        resolve((stdout + stderr).trim());
      },
    );
  });
}

// ── Windows: Audio playback detection ───────────────────────────────────────

const CHECK_AUDIO_PS = `
Add-Type -TypeDefinition @"
using System;using System.Runtime.InteropServices;
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]public class MMDE{}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDE{int GetDefaultAudioEndpoint(int flow,int role,out IntPtr ep);}
[Guid("BFBABE47-6C8C-4A7B-8A0E-10266D96C6E5"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IASC{int GetState(out int s);}
[Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IASE{int GetCount(out int c);int GetSession(int i,out IntPtr s);}
[Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IASM2{int GetSessionEnumerator(out IntPtr e);}
public class AD{
[DllImport("ole32.dll")]public static extern int CoInitializeEx(IntPtr r,uint f);
public static bool IsPlaying(){
CoInitializeEx(IntPtr.Zero,0);
try{
var en=new MMDE()as IMMDE;IntPtr ep;en.GetDefaultAudioEndpoint(0,0,out ep);
var dev=Marshal.GetObjectForIUnknown(ep);
Guid g2=typeof(IASM2).GUID;IntPtr m2p;
((IMMDevice)dev).Activate(ref g2,0,IntPtr.Zero,out m2p);
var m2=(IASM2)Marshal.GetTypedObjectForIUnknown(m2p,typeof(IASM2));
IntPtr ep2;m2.GetSessionEnumerator(out ep2);
var se=(IASE)Marshal.GetTypedObjectForIUnknown(ep2,typeof(IASE));
int c;se.GetCount(out c);
for(int i=0;i<c;i++){IntPtr sp;se.GetSession(i,out sp);
var sc=(IASC)Marshal.GetTypedObjectForIUnknown(sp,typeof(IASC));
int st;sc.GetState(out st);Marshal.ReleaseComObject(sp);
if(st==1){Marshal.ReleaseComObject(se);return true;}}
Marshal.ReleaseComObject(se);return false;
}catch{return false;}
}}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice{int Activate(ref Guid iid,int ctx,IntPtr p,out IntPtr pp);}
"@
[AD]::IsPlaying()
`;

async function isAudioPlayingOnWindows(): Promise<boolean> {
  try {
    const result = await runPs(CHECK_AUDIO_PS, 4000);
    return result.includes("True");
  } catch {
    // If detection fails, assume nothing is playing (safer than unpausing)
    return false;
  }
}

// ── Windows: Discord window + hotkey ────────────────────────────────────────

const DISCORD_HOTKEY_CS = `
using System;using System.Runtime.InteropServices;using System.Text;using System.Diagnostics;
[StructLayout(LayoutKind.Sequential)]public struct KB{public ushort vk;public ushort sc;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Sequential)]public struct MI{public int dx;public int dy;public uint md;public uint fl;public uint tm;public IntPtr ex;}
[StructLayout(LayoutKind.Explicit)]public struct MU{[FieldOffset(0)]public MI mi;[FieldOffset(0)]public KB ki;}
[StructLayout(LayoutKind.Sequential)]public struct IN{public uint tp;public MU u;}
public class X{
[DllImport("user32.dll")]public static extern uint SendInput(uint n,IN[] ii,int cb);
[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")]public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint pid);
[DllImport("kernel32.dll")]public static extern void Sleep(uint ms);
[DllImport("user32.dll")]public static extern bool EnumWindows(EnumWindowsProc lp,IntPtr l);
public delegate bool EnumWindowsProc(IntPtr h,IntPtr l);
[DllImport("user32.dll")]public static extern int GetWindowText(IntPtr h,StringBuilder s,int n);

public static void S(ushort vk,ushort sc,uint fl){var ii=new IN[1];ii[0].tp=1;ii[0].u.ki.vk=vk;ii[0].u.ki.sc=sc;ii[0].u.ki.fl=fl;SendInput(1,ii,Marshal.SizeOf(typeof(IN)));}

public static IntPtr FindDiscordWindow(){
var procs=Process.GetProcessesByName("discord");
foreach(var p in procs){try{var h=p.MainWindowHandle;if(h!=IntPtr.Zero&&p.MainWindowTitle.ToLowerInvariant().Contains("discord"))return h;}catch{}}
IntPtr r=IntPtr.Zero;
EnumWindows(delegate(IntPtr h,IntPtr l){var sb=new StringBuilder(256);GetWindowText(h,sb,256);if(sb.ToString().ToLowerInvariant().Contains("discord")){r=h;return false;}return true;},IntPtr.Zero);
return r;}

public static string DiscordHotkey(ushort actionVk){
IntPtr dh=FindDiscordWindow();
if(dh==IntPtr.Zero)return "NO_WINDOW";
IntPtr prev=GetForegroundWindow();
bool needRestore=prev!=dh;
if(needRestore){SetForegroundWindow(dh);Sleep(80);}
// Modifiers down, action press+release, modifiers up
S(0x11,0,0);Sleep(5);S(0x10,0,0);Sleep(5);
S(actionVk,0,0);Sleep(5);S(actionVk,0,2);Sleep(5);
S(0x10,0,2);Sleep(5);S(0x11,0,2);Sleep(5);
Sleep(50);
if(needRestore&&prev!=IntPtr.Zero){SetForegroundWindow(prev);}
return "OK";
}
}`;

async function toggleDiscordWindows(mode: "mic" | "full"): Promise<boolean> {
  const vk = mode === "mic" ? VK_M : VK_D;
  const label = mode === "mic" ? "Ctrl+Shift+M" : "Ctrl+Shift+D";
  L(`Discord: sending ${label}...`);

  try {
    const result = await runPs(
      `Add-Type -TypeDefinition @"\n${DISCORD_HOTKEY_CS}\n"@\n[X]::DiscordHotkey(${vk})`,
      6000,
    );
    if (result.includes("OK")) {
      L(`Discord: ${label} sent OK`);
      return true;
    } else if (result.includes("NO_WINDOW")) {
      L("Discord: window not found - is Discord running?");
    } else {
      L(`Discord: unexpected result: ${result.slice(0, 100)}`);
    }
  } catch (err) {
    L(`Discord: error: ${(err as Error).message}`);
  }
  return false;
}

// ── Windows: media key ──────────────────────────────────────────────────────

async function toggleMediaWindows(): Promise<void> {
  // Check if audio is actually playing before pausing
  const playing = await isAudioPlayingOnWindows();
  if (!playing) {
    L("Media: no audio playing, skip pause");
    s.mediaWasPaused = false;
    return;
  }

  L("Media: audio playing, sending VK_MEDIA_PLAY_PAUSE");

  // Try koffi fast path first
  const fn = koffiKeybdEvent();
  if (fn) {
    fn(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY, 0);
    fn(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
    L("Media: sent via koffi");
  } else {
    // PowerShell fallback
    await runPs(
      `Add-Type -TypeDefinition @"\n${DISCORD_HOTKEY_CS}\n"@\n[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY});[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP});`,
      4000,
    );
    L("Media: sent via PowerShell");
  }

  s.mediaWasPaused = true;
}

// ── macOS stubs ─────────────────────────────────────────────────────────────

async function toggleMediaMacOS(): Promise<void> {
  L("Media: macOS stub - not implemented");
  s.mediaWasPaused = false;
}

async function toggleDiscordMacOS(_mode: "mic" | "full"): Promise<boolean> {
  L("Discord: macOS stub - not implemented");
  return false;
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
  L(`apply: mediaPause=${cfg.mediaPauseEnabled} discordMute=${cfg.discordMuteEnabled} mode=${cfg.discordMuteMode}`);

  s.mediaWasPaused = false;
  s.discordWasMuted = false;

  // Run media and Discord in parallel for speed
  const tasks: Promise<void>[] = [];

  if (cfg.mediaPauseEnabled) {
    tasks.push(
      (IS_WIN ? toggleMediaWindows() : toggleMediaMacOS()).then(() => {
        // s.mediaWasPaused is set inside toggleMediaWindows
      }),
    );
  }

  if (cfg.discordMuteEnabled) {
    tasks.push(
      (IS_WIN
        ? toggleDiscordWindows(cfg.discordMuteMode)
        : toggleDiscordMacOS(cfg.discordMuteMode)
      ).then((ok) => {
        s.discordWasMuted = ok;
      }),
    );
  }

  await Promise.all(tasks);

  L(`apply done: paused=${s.mediaWasPaused} muted=${s.discordWasMuted}`);
}

export async function restoreMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`restore: wasPaused=${s.mediaWasPaused} wasMuted=${s.discordWasMuted}`);

  const tasks: Promise<void>[] = [];

  if (s.mediaWasPaused && cfg.mediaPauseEnabled) {
    if (IS_WIN) {
      // On restore, always send the key via fast path — no need to check
      // playback state again (state tracking handles it)
      const fn = koffiKeybdEvent();
      if (fn) {
        fn(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY, 0);
        fn(VK_MEDIA_PLAY_PAUSE, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0);
        L("Media: resume sent via koffi");
      } else {
        tasks.push(
          runPs(
            `Add-Type -TypeDefinition @"\n${DISCORD_HOTKEY_CS}\n"@\n[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY});[X]::S(${VK_MEDIA_PLAY_PAUSE},0,${KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP});`,
            4000,
          ).then(() => {}),
        );
      }
    } else {
      tasks.push(toggleMediaMacOS());
    }
  }

  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    tasks.push(
      (IS_WIN
        ? toggleDiscordWindows(cfg.discordMuteMode)
        : toggleDiscordMacOS(cfg.discordMuteMode)
      ).then(() => {}),
    );
  }

  await Promise.all(tasks);

  s.mediaWasPaused = false;
  s.discordWasMuted = false;
  L("restore done");
}

export async function cleanupMediaControls(
  cfg: MediaControlsSettings,
): Promise<void> {
  L(`cleanup: wasMuted=${s.discordWasMuted}`);
  if (s.discordWasMuted && cfg.discordMuteEnabled) {
    if (IS_WIN) {
      await toggleDiscordWindows(cfg.discordMuteMode);
    } else {
      await toggleDiscordMacOS(cfg.discordMuteMode);
    }
  }
  s.mediaWasPaused = false;
  s.discordWasMuted = false;
}
