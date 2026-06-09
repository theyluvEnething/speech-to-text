# Test script: verify SendInput works for media keys
# Run this while playing a YouTube video to confirm the API works

Write-Host "=== SendInput Media Key Test ===" -ForegroundColor Cyan

# Embedded C# with CORRECT struct layout matching Windows binary ABI
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct KBDINPUT {
    public ushort wVk;
    public ushort wScan;
    public uint   dwFlags;
    public uint   time;
    public IntPtr dwExtraInfo;
}

[StructLayout(LayoutKind.Sequential)]
public struct MOUSEINPUT {
    public int    dx;
    public int    dy;
    public uint   mouseData;
    public uint   dwFlags;
    public uint   time;
    public IntPtr dwExtraInfo;
}

// Union: overlay MOUSEINPUT / KEYBDINPUT at same offset
[StructLayout(LayoutKind.Explicit)]
public struct UNION {
    [FieldOffset(0)] public MOUSEINPUT mi;
    [FieldOffset(0)] public KBDINPUT   ki;
}

[StructLayout(LayoutKind.Sequential)]
public struct WININPUT {
    public uint  type;   // INPUT_KEYBOARD = 1
    public UNION u;      // union at correct offset (8 on x64 after padding)
}

public class KS {
    [DllImport("user32.dll")]
    public static extern uint SendInput(uint n, WININPUT[] ii, int cb);

    public static void MediaPlayPause() {
        int cb = Marshal.SizeOf(typeof(WININPUT));
        Console.WriteLine("sizeof(INPUT) = " + cb + " bytes");

        var inputs = new WININPUT[1];
        inputs[0].type = 1;  // INPUT_KEYBOARD
        inputs[0].u.ki.wVk = 0xB3;  // VK_MEDIA_PLAY_PAUSE
        inputs[0].u.ki.dwFlags = 0x0001;  // KEYEVENTF_EXTENDEDKEY

        // Key down
        uint r1 = SendInput(1, inputs, cb);
        int e1 = Marshal.GetLastWin32Error();

        // Key up
        inputs[0].u.ki.dwFlags = 0x0001 | 0x0002;  // EXTENDED | KEYUP
        uint r2 = SendInput(1, inputs, cb);
        int e2 = Marshal.GetLastWin32Error();

        Console.WriteLine("KeyDown: " + r1 + " (err=" + e1 + "), KeyUp: " + r2 + " (err=" + e2 + ")");
        if (r1 == 0) Console.Error.WriteLine("FAILED - check struct size");
        else Console.WriteLine("SUCCESS - media key sent");
    }

    public static void DiscordHotkey(ushort actionKey) {
        int cb = Marshal.SizeOf(typeof(WININPUT));
        var inputs = new WININPUT[6];
        // Ctrl down, Shift down, Action down, Action up, Shift up, Ctrl up
        inputs[0].type=1; inputs[0].u.ki.wVk=0x11; // Ctrl
        inputs[1].type=1; inputs[1].u.ki.wVk=0x10; // Shift
        inputs[2].type=1; inputs[2].u.ki.wVk=actionKey;
        inputs[3].type=1; inputs[3].u.ki.wVk=actionKey; inputs[3].u.ki.dwFlags=2;
        inputs[4].type=1; inputs[4].u.ki.wVk=0x10;   inputs[4].u.ki.dwFlags=2;
        inputs[5].type=1; inputs[5].u.ki.wVk=0x11;   inputs[5].u.ki.dwFlags=2;

        uint r = SendInput(6, inputs, cb);
        int e = Marshal.GetLastWin32Error();
        Console.WriteLine("Discord hotkey: sent=" + r + " (err=" + e + ")");
    }
}
"@ -ErrorAction Stop

Write-Host "Add-Type succeeded. Struct size should be 40 on x64." -ForegroundColor Green
Write-Host ""

# ── Test media key ──
Write-Host "--- Testing VK_MEDIA_PLAY_PAUSE ---" -ForegroundColor Yellow
Write-Host "Play a YouTube video first, then press Enter..."
Read-Host
[KS]::MediaPlayPause()
Write-Host ""

# ── Test Discord hotkey ──
Write-Host "--- Testing Ctrl+Shift+D (Toggle Deafen) ---" -ForegroundColor Yellow
Write-Host "Make sure you have this keybind configured in Discord!"
Write-Host "Press Enter to send..."
Read-Host
[KS]::DiscordHotkey(0x44)  # D key
Write-Host ""

# ── Test Ctrl+Shift+M (Toggle Mute) ──
Write-Host "--- Testing Ctrl+Shift+M (Toggle Mute) ---" -ForegroundColor Yellow
Write-Host "Make sure you have this keybind configured in Discord!"
Write-Host "Press Enter to send..."
Read-Host
[KS]::DiscordHotkey(0x4D)  # M key
Write-Host ""

Write-Host "=== Tests complete ===" -ForegroundColor Cyan
Write-Host "If the media key worked (YouTube paused), the API is correct."
Write-Host "If Discord keys worked, the hotkey approach is correct."
