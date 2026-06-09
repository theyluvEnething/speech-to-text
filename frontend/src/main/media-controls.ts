import { execFile } from "child_process";
import { keyboard, Key } from "@nut-tree-fork/nut-js";

keyboard.config.autoDelayMs = 5;

// ── State tracking ──────────────────────────────────────────────────────────
// Tracks what we changed so we only restore what we initiated.

interface MediaState {
  mediaWasPaused: boolean;
  discordWasMuted: boolean;
}

const state: MediaState = {
  mediaWasPaused: false,
  discordWasMuted: false,
};

// ── PowerShell helpers ─────────────────────────────────────────────────────
// Single shared C# source for Core Audio API access, compiled once per
// PowerShell invocation. Uses Windows Core Audio API to enumerate audio
// sessions, check playback state, and control per-app mute.

const CORE_AUDIO_CS = `
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;

// P/Invoke declarations for Core Audio API
public static class AudioSessionAPI
{
    [DllImport("ole32.dll")]
    public static extern int CoInitializeEx(IntPtr pvReserved, uint dwCoInit);

    public static void CoUninitialize() { }

    [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
    internal class MMDeviceEnumerator { }

    public enum EDataFlow { eRender = 0, eCapture = 1, eAll = 2 }
    public enum ERole { eConsole = 0, eMultimedia = 1, eCommunications = 2 }

    [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IMMDeviceEnumerator
    {
        int EnumAudioEndpoints(int dataFlow, int dwStateMask, out IntPtr ppDevices);
        int GetDefaultAudioEndpoint(int dataFlow, int role, out IntPtr ppEndpoint);
        int GetDevice(string pwId, out IntPtr ppDevice);
        int RegisterEndpointNotificationCallback(IntPtr pClient);
        int UnregisterEndpointNotificationCallback(IntPtr pClient);
    }

    [Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionManager2
    {
        int GetAudioSessionControl(IntPtr AudioSessionGuid, int StreamFlags, out IntPtr SessionControl);
        int GetSimpleAudioVolume(IntPtr AudioSessionGuid, int StreamFlags, out IntPtr AudioVolume);
        int GetSessionEnumerator(out IntPtr SessionEnum);
        int RegisterSessionNotification(IntPtr NewSession);
        int UnregisterSessionNotification(IntPtr Session);
        int RegisterDuckNotification(string sessionID, IntPtr newSubscription);
        int UnregisterDuckNotification(IntPtr subscription);
    }

    [Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionEnumerator
    {
        int GetCount(out int SessionCount);
        int GetSession(int SessionCount, out IntPtr Session);
    }

    [Guid("BFBABE47-6C8C-4A7B-8A0E-10266D96C6E5"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IAudioSessionControl
    {
        int GetState(out int pRetVal);
        int GetDisplayName(out IntPtr pRetVal);
        int SetDisplayName(string Value, Guid EventContext);
        int GetIconPath(out IntPtr pRetVal);
        int GetGroupingParam(out Guid pRetVal);
        int SetGroupingParam(Guid Override, Guid EventContext);
        int RegisterAudioSessionNotification(IntPtr NewNotifications);
        int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    }

    [Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface ISimpleAudioVolume
    {
        int SetMasterVolume(float fLevel, Guid EventContext);
        int GetMasterVolume(out float pfLevel);
        int SetMute(bool bMute, Guid EventContext);
        int GetMute(out bool pbMute);
    }

    // AudioSessionState enum
    public const int AudioSessionStateInactive = 0;
    public const int AudioSessionStateActive = 1;
    public const int AudioSessionStateExpired = 2;

    public static object GetDefaultEndpoint(int dataFlow, int role)
    {
        var enumerator = new MMDeviceEnumerator() as IMMDeviceEnumerator;
        IntPtr endpointPtr;
        enumerator.GetDefaultAudioEndpoint(dataFlow, role, out endpointPtr);
        return System.Runtime.InteropServices.Marshal.GetObjectForIUnknown(endpointPtr);
    }

    public static IAudioSessionManager2 GetSessionManager(object endpoint)
    {
        Guid IID_IAudioSessionManager2 = typeof(IAudioSessionManager2).GUID;
        IntPtr sessionManagerPtr;
        ((IMMDevice)endpoint).Activate(ref IID_IAudioSessionManager2, 0, IntPtr.Zero, out sessionManagerPtr);
        return (IAudioSessionManager2)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(sessionManagerPtr, typeof(IAudioSessionManager2));
    }

    public static List<Dictionary<string, object>> GetSessions(int dataFlow)
    {
        var result = new List<Dictionary<string, object>>();
        var endpoint = GetDefaultEndpoint(dataFlow, 0);
        var manager = GetSessionManager(endpoint);
        IntPtr enumeratorPtr;
        manager.GetSessionEnumerator(out enumeratorPtr);
        var enumerator = (IAudioSessionEnumerator)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(enumeratorPtr, typeof(IAudioSessionEnumerator));
        int count;
        enumerator.GetCount(out count);

        for (int i = 0; i < count; i++)
        {
            IntPtr sessionPtr;
            enumerator.GetSession(i, out sessionPtr);
            var session = (IAudioSessionControl)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(sessionPtr, typeof(IAudioSessionControl));
            var volume = (ISimpleAudioVolume)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(sessionPtr, typeof(ISimpleAudioVolume));

            int stateVal;
            session.GetState(out stateVal);

            bool muted;
            volume.GetMute(out muted);

            // Get process ID from session
            int pid = 0;
            try
            {
                var ac2 = session as IAudioSessionControl2;
                if (ac2 != null)
                {
                    ac2.GetProcessId(out pid);
                }
            }
            catch { }

            string processName = "";
            if (pid > 0)
            {
                try
                {
                    var proc = System.Diagnostics.Process.GetProcessById(pid);
                    processName = proc.ProcessName;
                }
                catch { }
            }

            result.Add(new Dictionary<string, object>
            {
                { "pid", pid },
                { "process", processName },
                { "state", stateVal },
                { "muted", muted }
            });

            System.Runtime.InteropServices.Marshal.ReleaseComObject(session);
        }

        System.Runtime.InteropServices.Marshal.ReleaseComObject(enumerator);
        return result;
    }

    public static bool SetProcessMute(int dataFlow, string processName, bool mute)
    {
        var endpoint = GetDefaultEndpoint(dataFlow, 0);
        var manager = GetSessionManager(endpoint);
        IntPtr enumeratorPtr;
        manager.GetSessionEnumerator(out enumeratorPtr);
        var enumerator = (IAudioSessionEnumerator)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(enumeratorPtr, typeof(IAudioSessionEnumerator));
        int count;
        enumerator.GetCount(out count);

        bool found = false;
        for (int i = 0; i < count; i++)
        {
            IntPtr sessionPtr;
            enumerator.GetSession(i, out sessionPtr);
            var volume = (ISimpleAudioVolume)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(sessionPtr, typeof(ISimpleAudioVolume));

            int pid = 0;
            try
            {
                var ac2 = session as IAudioSessionControl2;
                if (ac2 != null) ac2.GetProcessId(out pid);
            }
            catch { }

            string currentProcess = "";
            if (pid > 0)
            {
                try
                {
                    var proc = System.Diagnostics.Process.GetProcessById(pid);
                    currentProcess = proc.ProcessName;
                }
                catch { }
            }

            if (currentProcess.Equals(processName, StringComparison.OrdinalIgnoreCase))
            {
                volume.SetMute(mute, Guid.Empty);
                found = true;
            }

            System.Runtime.InteropServices.Marshal.ReleaseComObject(sessionPtr);
        }

        System.Runtime.InteropServices.Marshal.ReleaseComObject(enumerator);
        return found;
    }

    public static bool IsProcessMuted(int dataFlow, string processName)
    {
        var endpoint = GetDefaultEndpoint(dataFlow, 0);
        var manager = GetSessionManager(endpoint);
        IntPtr enumeratorPtr;
        manager.GetSessionEnumerator(out enumeratorPtr);
        var enumerator = (IAudioSessionEnumerator)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(enumeratorPtr, typeof(IAudioSessionEnumerator));
        int count;
        enumerator.GetCount(out count);

        bool muted = false;
        for (int i = 0; i < count; i++)
        {
            IntPtr sessionPtr;
            enumerator.GetSession(i, out sessionPtr);
            var volume = (ISimpleAudioVolume)System.Runtime.InteropServices.Marshal.GetTypedObjectForIUnknown(sessionPtr, typeof(ISimpleAudioVolume));

            int pid = 0;
            try
            {
                var ac2 = session as IAudioSessionControl2;
                if (ac2 != null) ac2.GetProcessId(out pid);
            }
            catch { }

            string currentProcess = "";
            if (pid > 0)
            {
                try
                {
                    var proc = System.Diagnostics.Process.GetProcessById(pid);
                    currentProcess = proc.ProcessName;
                }
                catch { }
            }

            if (currentProcess.Equals(processName, StringComparison.OrdinalIgnoreCase))
            {
                volume.GetMute(out muted);
            }

            System.Runtime.InteropServices.Marshal.ReleaseComObject(sessionPtr);
        }

        System.Runtime.InteropServices.Marshal.ReleaseComObject(enumerator);
        return muted;
    }
}

// Missing interface definition — IAudioSessionControl2
[Guid("bfbabf47-6c8c-4a7b-8a0e-10266d96c6e5"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IAudioSessionControl2
{
    int GetState(out int pRetVal);
    int GetDisplayName(out IntPtr pRetVal);
    int SetDisplayName(string Value, Guid EventContext);
    int GetIconPath(out IntPtr pRetVal);
    int GetGroupingParam(out Guid pRetVal);
    int SetGroupingParam(Guid Override, Guid EventContext);
    int RegisterAudioSessionNotification(IntPtr NewNotifications);
    int UnregisterAudioSessionNotification(IntPtr NewNotifications);
    int GetSessionIdentifier(out IntPtr pRetVal);
    int GetSessionInstanceIdentifier(out IntPtr pRetVal);
    int GetProcessId(out int pRetVal);
    int IsSystemSoundsSession();
    int SetDuckingPreference(bool optOut);
}

// IMMDevice interface (minimal — only Activate is needed)
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
public interface IMMDevice
{
    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IntPtr ppInterface);
    int OpenPropertyStore(int stgmAccess, out IntPtr ppProperties);
    int GetId(out IntPtr ppstrId);
    int GetState(out int pdwState);
}
`;

function runPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const ps = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout: 8000, windowsHide: true },
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

// ── Audio playback detection (Windows) ──────────────────────────────────────

async function isAudioPlayingWindows(): Promise<boolean> {
  try {
    const script = `
${CORE_AUDIO_CS}
$sessions = [AudioSessionAPI]::GetSessions(0)  # eRender
$active = $sessions | Where-Object { $_.state -eq 1 -and $_.process -ne "" }
if ($active) { Write-Output "PLAYING" } else { Write-Output "SILENT" }
`;
    const result = await runPowerShell(script);
    return result === "PLAYING";
  } catch (err) {
    console.error(`[MediaControls] Failed to check audio state: ${(err as Error).message}`);
    return false;
  }
}

function isAudioPlayingMacOS(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      "osascript",
      ["-e", 'tell application "System Events" to get name of every process whose background only is false'],
      { timeout: 3000 },
      (_err, stdout) => {
        // On macOS, we can't easily detect audio playback without additional
        // permissions. Default to assuming media is playing to be safe.
        // The media key is a toggle — worst case, we unpause something that
        // was already paused, which is less disruptive than the other way.
        resolve(true);
      },
    );
  });
}

async function isAudioPlaying(): Promise<boolean> {
  if (process.platform === "win32") {
    return isAudioPlayingWindows();
  }
  return isAudioPlayingMacOS();
}

// ── Media pause / resume ────────────────────────────────────────────────────

async function sendMediaPauseKey(): Promise<void> {
  if (process.platform === "win32") {
    // Use PowerShell keybd_event for VK_MEDIA_PLAY_PAUSE (0xB3) to guarantee
    // correct virtual key code, avoiding ambiguity in nut-js abstract key mapping.
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MediaKey {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
[MediaKey]::keybd_event(0xB3, 0, 0, [UIntPtr]::Zero)
[MediaKey]::keybd_event(0xB3, 0, 2, [UIntPtr]::Zero)
`;
    await runPowerShell(script);
  } else {
    // macOS: use nut-js which maps to CGEvent
    await keyboard.pressKey(Key.AudioPause);
    await keyboard.releaseKey(Key.AudioPause);
  }
}

async function sendMediaPlayKey(): Promise<void> {
  if (process.platform === "win32") {
    const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class MediaKey {
    [DllImport("user32.dll")]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
}
"@
[MediaKey]::keybd_event(0xB3, 0, 0, [UIntPtr]::Zero)
[MediaKey]::keybd_event(0xB3, 0, 2, [UIntPtr]::Zero)
`;
    await runPowerShell(script);
  } else {
    await keyboard.pressKey(Key.AudioPlay);
    await keyboard.releaseKey(Key.AudioPlay);
  }
}

// ── Discord mute / unmute ───────────────────────────────────────────────────

const DISCORD_PROCESS_NAMES = ["discord", "Discord"];

async function setDiscordMuteWindows(mute: boolean, mode: "mic" | "full"): Promise<boolean> {
  try {
    // 1. Mute capture (mic) — always
    let micMuted = false;
    for (const name of DISCORD_PROCESS_NAMES) {
      const script = `
${CORE_AUDIO_CS}
$result = [AudioSessionAPI]::SetProcessMute(1, "${name}", $${mute ? "true" : "false"})
Write-Output $result
`;
      const result = await runPowerShell(script);
      if (result === "True") micMuted = true;
    }

    // 2. Mute render (output) — only for "full" mode
    let renderMuted = false;
    if (mode === "full") {
      for (const name of DISCORD_PROCESS_NAMES) {
        const script = `
${CORE_AUDIO_CS}
$result = [AudioSessionAPI]::SetProcessMute(0, "${name}", $${mute ? "true" : "false"})
Write-Output $result
`;
        const result = await runPowerShell(script);
        if (result === "True") renderMuted = true;
      }
    }

    return mute ? (micMuted || renderMuted) : true;
  } catch (err) {
    console.error(`[MediaControls] Discord mute failed: ${(err as Error).message}`);
    return false;
  }
}

async function setDiscordMuteMacOS(mute: boolean, mode: "mic" | "full"): Promise<boolean> {
  // macOS: Use osascript to control Discord's audio via System Events
  // This is inherently more fragile than Windows Core Audio API.
  try {
    if (mode === "mic") {
      // Toggle Discord mute via keyboard shortcut simulation
      // Discord default: no default mute key — user must configure
      // Fall back to logging a warning
      console.warn(
        "[MediaControls] Discord mute on macOS not fully supported. " +
        "Please configure a Toggle Mute hotkey in Discord and set it in Wavely settings.",
      );
      return false;
    }
    // Full mute: use osascript to set Discord volume
    const vol = mute ? "0" : "100";
    return new Promise((resolve) => {
      execFile(
        "osascript",
        ["-e", `set volume output volume ${vol}`],
        { timeout: 3000 },
        (err) => {
          if (err) {
            console.error(`[MediaControls] macOS full mute failed: ${err.message}`);
            resolve(false);
          } else {
            resolve(true);
          }
        },
      );
    });
  } catch (err) {
    console.error(`[MediaControls] macOS Discord mute failed: ${(err as Error).message}`);
    return false;
  }
}

async function setDiscordMute(mute: boolean, mode: "mic" | "full"): Promise<boolean> {
  if (process.platform === "win32") {
    return setDiscordMuteWindows(mute, mode);
  }
  return setDiscordMuteMacOS(mute, mode);
}

// ── Check if Discord is currently muted ─────────────────────────────────────

async function isDiscordMutedWindows(mode: "mic" | "full"): Promise<boolean> {
  for (const name of DISCORD_PROCESS_NAMES) {
    const script = `
${CORE_AUDIO_CS}
$muted = [AudioSessionAPI]::IsProcessMuted(1, "${name}")
Write-Output $muted
`;
    const result = await runPowerShell(script);
    if (result === "True") return true;
  }
  return false;
}

async function isDiscordMutedMacOS(_mode: "mic" | "full"): Promise<boolean> {
  // We can't reliably detect Discord's mute state on macOS without
  // Accessibility permissions. Default to false (assume not muted).
  return false;
}

async function isDiscordMuted(mode: "mic" | "full"): Promise<boolean> {
  if (process.platform === "win32") {
    return isDiscordMutedWindows(mode);
  }
  return isDiscordMutedMacOS(mode);
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
 * - If mediaPauseEnabled and audio is currently playing, pause it.
 * - If discordMuteEnabled and Discord is not already muted, mute it.
 *
 * Only changes state when an action was actually taken, and tracks
 * this in internal state so {@link restoreMediaControls} can safely
 * undo only what we did.
 */
export async function applyMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  // Reset state
  state.mediaWasPaused = false;
  state.discordWasMuted = false;

  // ── Media pause ────────────────────────────────────────────────
  if (settings.mediaPauseEnabled) {
    const playing = await isAudioPlaying();
    if (playing) {
      console.log("[MediaControls] Audio is playing — pausing media.");
      await sendMediaPauseKey();
      state.mediaWasPaused = true;
    } else {
      console.log("[MediaControls] No audio playing — skipping media pause.");
    }
  }

  // ── Discord mute ───────────────────────────────────────────────
  if (settings.discordMuteEnabled) {
    const alreadyMuted = await isDiscordMuted(settings.discordMuteMode);
    if (!alreadyMuted) {
      console.log(
        `[MediaControls] Muting Discord (${settings.discordMuteMode} mode).`,
      );
      const ok = await setDiscordMute(true, settings.discordMuteMode);
      if (ok) state.discordWasMuted = true;
    } else {
      console.log("[MediaControls] Discord already muted — skipping.");
    }
  }
}

/**
 * Restore media controls after transcription completes.
 *
 * Only restores what {@link applyMediaControls} actually changed.
 * If the user manually resumed playback or unmuted Discord during
 * transcription, this does nothing (since we only restore when our
 * internal state flag says we changed it).
 */
export async function restoreMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  // ── Media resume ───────────────────────────────────────────────
  if (state.mediaWasPaused && settings.mediaPauseEnabled) {
    // Re-check: if audio is now playing (user manually resumed),
    // don't toggle it again.
    const playing = await isAudioPlaying();
    if (!playing) {
      console.log("[MediaControls] Resuming media playback.");
      await sendMediaPlayKey();
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
      `[MediaControls] Unmuting Discord (${settings.discordMuteMode} mode).`,
    );
    await setDiscordMute(false, settings.discordMuteMode);
  }

  // Reset state
  state.mediaWasPaused = false;
  state.discordWasMuted = false;
}

/**
 * Clean up media controls on error / abort.
 * Unmutes Discord if we muted it. Does not resume media (the user
 * likely wants to keep listening).
 */
export async function cleanupMediaControls(
  settings: MediaControlsSettings,
): Promise<void> {
  if (state.discordWasMuted && settings.discordMuteEnabled) {
    console.log("[MediaControls] Cleanup: unmuting Discord after error.");
    await setDiscordMute(false, settings.discordMuteMode);
  }
  state.mediaWasPaused = false;
  state.discordWasMuted = false;
}
