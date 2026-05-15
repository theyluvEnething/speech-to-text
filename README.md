# Whisper — Push-to-Talk Speech-to-Text

Hold a hotkey, speak, release — transcribed text appears wherever your cursor is.

**Fully local. No API calls. No cloud. No subscription.**

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## How it works

```
 Hold Alt  →  Speak  →  Release Alt  →  Text appears at cursor
```

1. **Hotkey detection** — `pynput` listens globally for the configured key (default: `Alt`). Pressing the key starts recording; releasing it stops.
2. **Audio capture** — `sounddevice` streams from the default microphone at 16 kHz mono 16-bit PCM. A live VU meter animates in the console showing real-time volume.
3. **Transcription** — `faster-whisper` (CTranslate2 backend) runs the Whisper model locally on your CPU or GPU. No network calls — everything happens on your machine.
4. **Paste** — The transcribed text is written to the clipboard and pasted into the active text field via `Ctrl+V` (Windows) or `Cmd+V` (macOS).

## Models

The app uses [faster-whisper](https://github.com/SYSTRAN/faster-whisper), a reimplementation of OpenAI's Whisper that runs on CTranslate2. It is **not** the OpenAI API — models download once from HuggingFace and run entirely offline.

| Model | Disk | RAM | Speed | Best for |
|-------|------|-----|-------|----------|
| `tiny` | ~75 MB | ~1 GB | Instant | Quick dictation, low-resource machines |
| `base` | ~150 MB | ~1 GB | Fast | Everyday use **(default)** |
| `small` | ~480 MB | ~2 GB | Moderate | Better accuracy for accented speech |
| `medium` | ~1.5 GB | ~5 GB | Slow | Near state-of-the-art accuracy |
| `large-v3` | ~3 GB | ~10 GB | Slowest | Maximum accuracy, multiple languages |

Switch models in the tray icon → Settings. The model downloads automatically on first use.

## Installation

### Prerequisites

- Python 3.11 or later
- A microphone
- Windows 10+ or macOS 12+
- ~300 MB free disk (for dependencies + `base` model)

### Setup

```bash
# Clone
git clone https://github.com/theyluvEnething/speech-to-text.git
cd speech-to-text

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate

# Activate (macOS)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Or use the launcher (Windows)

Double-click `start.bat` — it creates the venv, installs dependencies, and launches the app.

## Usage

```bash
cd src
python -m whisper_app
```

Or run `start.bat` from the repo root.

The app lives in your system tray. Hold **Alt**, speak, release. The console shows a live VU meter while recording:

```
==================================================
[Whisper]  RECORDING — speak now…
==================================================
  [████████████████░░░░░░░░░░░░░░░░░░░░░░░░]  -18.3 dB  peak -12.1 dB  |  02.5s  (40000 samples)
[Whisper] Stopped after 3.2s. Peak: -6.2 dB, RMS: -18.3 dB
[Whisper] Captured 3.2s of audio. Transcribing…
[Whisper] → "hello world this is a test"
```

Right-click the tray icon for Settings or to quit.

## Configuration

Settings are stored in `~/.whisper_app/config.json`:

```json
{
  "hotkey": "alt",
  "model": "base",
  "language": null,
  "device": "cpu"
}
```

| Key | Values | Description |
|-----|--------|-------------|
| `hotkey` | Any key pynput recognizes (e.g. `alt`, `ctrl`, `shift`, `f8`, `a`) | Hold-to-record key |
| `model` | `tiny`, `base`, `small`, `medium`, `large-v3` | Whisper model size |
| `language` | `null` (auto-detect) or ISO code like `en`, `no`, `fr` | Force a specific language |
| `device` | `cpu`, `cuda` | Inference device — `cuda` for NVIDIA GPUs |

Changes take effect after clicking Save in the Settings window.

## Architecture

```
src/whisper_app/
├── __main__.py          # Entry point, app lifecycle, hotkey listener, VU meter
├── config.py            # JSON config read/write (~/.whisper_app/config.json)
├── core/
│   ├── audio.py         # Microphone streaming via sounddevice, 16kHz mono
│   ├── transcriber.py   # faster-whisper wrapper, model caching
│   └── paste.py         # Clipboard write + Ctrl+V / Cmd+V simulation
└── ui/
    ├── tray.py          # pystray system tray icon and menu
    ├── overlay.py       # Floating tkinter status indicator (thread-safe)
    └── settings.py      # customtkinter settings window
```

### Thread model

| Thread | Purpose |
|--------|---------|
| Main | Blocked on pynput keyboard listener |
| Listener (pynput) | Fires on_press / on_release callbacks |
| Overlay | Dedicated tkinter thread with its own mainloop |
| VU meter | Spawned per recording, updates console bar at 25 fps |
| Transcription | Spawned per recording, runs faster-whisper inference |
| Tray (pystray) | System tray icon and menu events |

Cross-thread communication: the overlay uses a `queue.SimpleQueue` so `show_recording()` / `show_result()` / `hide()` are safe to call from any thread.

### Key design decisions

- **No network** — faster-whisper runs the model locally via CTranslate2. The only network call is the one-time model download from HuggingFace.
- **16 kHz mono** — lower sample rate = smaller audio buffer = faster transcription. Sufficient for speech.
- **int8 quantization** — CTranslate2 runs the model in int8 mode by default, trading a tiny accuracy drop for 2–4x speed.
- **VAD filter** — faster-whisper's `vad_filter=True` strips silence before inference, improving accuracy on short clips.

## Dependencies

Every library and why it's there.

### Runtime

| Library | Version | Purpose | Language-agnostic analogue |
|---------|---------|---------|---------------------------|
| `faster-whisper` | ≥1.0.0 | Whisper model inference via CTranslate2. Downloads the model from HuggingFace, transcribes WAV → text. No API calls. | `whisper.cpp`, `whisper-rs`, or any ONNX/CTranslate2 runtime |
| `sounddevice` | ≥0.4.6 | Cross-platform microphone capture via PortAudio. Streams raw PCM samples into a numpy buffer via callback. | `cpal` (Rust), `portaudio` (C), Web Audio API (browser) |
| `numpy` | ≥1.24.0 | Array math for audio concatenation, RMS/peak computation. The audio callback produces `ndarray` chunks that get stacked into one buffer. | Any numeric array library in your language |
| `pynput` | ≥1.7.6 | Global keyboard hook — detects key press/release system-wide without window focus. Runs a low-level OS keyboard listener in a background thread. | Platform-specific: `SetWindowsHookEx` (Win), `CGEvent` (macOS), `evdev` + `libinput` (Linux) |
| `pyperclip` | ≥1.8.2 | Cross-platform clipboard write. Copies transcribed text so it's available for paste. | Platform clipboard API — `arboard` (Rust), `Clipboard.SetText` (Win32) |
| `pyautogui` | ≥0.9.54 | Simulates `Ctrl+V` / `Cmd+V` keystroke to paste text into the focused application. | Platform key injection — `SendInput` (Win), `CGEventPost` (macOS), `xdotool` (Linux) |
| `pystray` | ≥0.19.5 | System tray icon with right-click menu (Settings, Quit). Runs in its own thread. | Platform tray APIs — `Shell_NotifyIcon` (Win), `NSStatusBar` (macOS), `libappindicator` (Linux) |
| `customtkinter` | ≥5.2.0 | Modern themed Settings window (hotkey, model, language). Built on tkinter with dark-mode styling. | Any GUI toolkit — `egui` (Rust), `SwiftUI` (macOS native), web-based settings page |
| `Pillow` | ≥10.0.0 | Image loading for the tray icon (PNG → PIL Image). Also generates a fallback icon if `assets/icon.png` is missing. | Any image library that can produce an OS-compatible bitmap |

### Dev

| Library | Purpose |
|---------|---------|
| `pytest` | Test runner |
| `pytest-mock` | Mock fixtures for testing audio/transcription without real hardware |
| `pyinstaller` | Bundles the app into a standalone `.exe` (Windows) or `.app` (macOS) |

## UI components

### System tray icon

Runs via `pystray` in a dedicated daemon thread. Right-click opens a two-item menu:

- **Settings** — opens the settings window
- **Quit Whisper** — stops the tray icon and exits the process

The icon is loaded from `assets/icon.png` (512×512). If missing, a blue circle is generated at runtime with Pillow `ImageDraw`.

### Overlay

A borderless, always-on-top, semi-transparent floating window built with raw `tkinter`. Appears near the bottom-center of the screen in three states:

| State | Color | Text | Duration |
|-------|-------|------|----------|
| Recording | Red indicator bar | "Recording..." | Until key release |
| Processing | Blue indicator bar | "Processing..." | During transcription |
| Result | Gray indicator bar | First 60 chars of transcribed text | 2.5 seconds, then fades |

Thread-safe: the overlay runs in its own thread with its own `tk.Tk().mainloop()`. Public methods (`show_recording`, `hide`, etc.) push commands into a `queue.SimpleQueue`. The overlay's polling loop pulls commands and updates the UI. Safe to call from the pynput listener thread.

### Settings window

Built with `customtkinter` (dark theme, blue accents). Contains:

- **Hotkey** text field
- **Model** dropdown (`tiny` / `base` / `small` / `medium` / `large-v3`)
- **Language** text field (blank = auto-detect, or ISO code like `en`)
- **Save** button — writes to `~/.whisper_app/config.json` and hot-reloads the model

## Design philosophy — porting to another language

This app is a pipeline of four independent stages. Each stage has a clear input → output contract. You can swap any stage without touching the others.

### The core loop

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐
│ Hotkey   │    │ Audio    │    │ Transcription│    │ Paste    │
│ detector ├───→│ capture  ├───→│ engine       ├───→│ output   │
│          │    │ (PCM)    │    │ (WAV → text) │    │ (Ctrl+V) │
└──────────┘    └──────────┘    └─────────────┘    └──────────┘
```

### Stage 1: Global hotkey

**Input:** OS key events  
**Output:** press / release signals for a specific key  
**Contract:** Detect when a specific key is held down and released, anywhere on the system, without the app having focus.

- On Windows: `SetWindowsHookEx` with `WH_KEYBOARD_LL` (low-level keyboard hook)
- On macOS: `CGEvent` tap or `NSEvent.addGlobalMonitorForEvents`
- On Linux: `evdev` or X11 `XGrabKey`
- What pynput does: wraps the platform-specific hook and exposes a clean `on_press`/`on_release` callback interface

**What you'd build in another language:** A thin wrapper around the OS keyboard hook. The callback should be non-blocking — on press, signal the audio stage to start; on release, signal it to stop.

### Stage 2: Audio capture

**Input:** Start/stop signal  
**Output:** A WAV buffer in memory (16 kHz, mono, 16-bit signed PCM)  
**Contract:** Stream from the default microphone while the key is held. Accumulate chunks into a buffer. On stop, join all chunks and encode as WAV.

- 16 kHz sample rate — the minimum Whisper accepts, keeps the buffer small
- 1 channel (mono) — stereo adds no value for speech
- 16-bit integer samples — standard PCM format
- Callback-based streaming — the OS audio system calls your function with each chunk of samples

**What you'd build in another language:**
- Rust: `cpal` with a `Stream` + `Arc<Mutex<Vec<i16>>>`
- Go: `github.com/gordonklaus/portaudio` or platform-specific WASAPI/CoreAudio
- C/C++: `portaudio` directly (what sounddevice wraps)
- JS/TS (desktop): Electron's `desktopCapturer` or Tauri with a Rust audio backend

### Stage 3: Transcription

**Input:** WAV bytes  
**Output:** Plain text string  
**Contract:** Take a WAV buffer, run speech-to-text inference, return the recognized text. No side effects.

The current implementation uses `faster-whisper` which:
1. Loads a Whisper model into CTranslate2 (ONNX-format, int8-quantized)
2. Feeds the WAV through the encoder → decoder
3. Runs VAD (Voice Activity Detection) to strip silence
4. Returns a list of text segments joined by spaces

**Alternative backends you could plug in:**

| Backend | Language | Notes |
|---------|----------|-------|
| `whisper.cpp` | C/C++ | ggml-based, runs on CPU, smaller binary |
| `whisper-rs` | Rust | Rust bindings to whisper.cpp |
| `whisperkit` | Swift | Apple's CoreML-optimized Whisper for macOS/iOS |
| OpenAI Whisper API | HTTP | Cloud-based, needs API key, fastest but not local |
| `sherpa-onnx` | C++/Python | ONNX runtime, supports multiple ASR models |

**What you'd build in another language:** Wrap any Whisper-compatible inference engine. The model expects 16 kHz mono audio. The output is segments with timestamps; collapse to plain text for the paste stage. Cache the model in memory after first load — don't reload per recording.

### Stage 4: Paste output

**Input:** Text string  
**Output:** Text appears in the focused application  
**Contract:** Take transcribed text, make it available for paste, and trigger the paste action.

Two-step process:
1. **Clipboard write** — copy text to the system clipboard (platform API call)
2. **Keystroke simulation** — send `Ctrl+V` (Windows/Linux) or `Cmd+V` (macOS) to the active window

**What you'd build in another language:**
- Clipboard: `arboard` (Rust), `Clipboard.SetText` (Win32), `NSPasteboard` (macOS)
- Keystroke: `enigo` (Rust), `kbt` (Go), `SendInput` (Win32), `CGEventCreateKeyboardEvent` (macOS)

### Configuration persistence

Settings are stored as a JSON file at `~/.whisper_app/config.json`. On first run, defaults are used if the file doesn't exist. Settings are read at startup and when the user clicks Save in the UI.

The config schema:
```json
{
  "hotkey": "string (pynput key name)",
  "model": "tiny | base | small | medium | large-v3",
  "language": "null | ISO-639-1 code",
  "device": "cpu | cuda"
}
```

### Thread safety rules

If you rebuild this, follow these rules to avoid the threading bugs we fixed:

1. **The keyboard hook fires from an OS-level thread.** UI updates must be queued — never call GUI methods directly from the hook callback.
2. **Transcription runs in a worker thread.** It can take 0.5–5 seconds depending on audio length and model size. Don't block the keyboard listener.
3. **The system tray runs in its own thread.** Menu callbacks (Settings, Quit) fire from that thread.
4. **Console output is synchronized.** The VU meter writes to stderr with `\r` for in-place updates. Between recordings, normal `print()` goes to stdout.
5. **Guard against double-trigger.** A `_finishing` flag prevents a new recording from starting while the previous one is still transcribing.

### Minimal port checklist

A working port needs exactly these capabilities from the target language:

- [ ] Global keyboard hook (key down / key up, system-wide)
- [ ] Microphone capture (16 kHz mono PCM streaming)
- [ ] WAV encoder (header + raw PCM → bytes buffer)
- [ ] Speech-to-text inference (any Whisper-compatible engine)
- [ ] Clipboard write (text → system clipboard)
- [ ] Keystroke injection (Ctrl+V / Cmd+V)
- [ ] System tray icon with menu
- [ ] JSON config file read/write
- [ ] Optional: GUI for settings (can just edit JSON by hand)

## macOS notes

On first launch, macOS will prompt for **Accessibility** permission. This is required for `pynput` to listen for global hotkeys. Grant it in System Preferences → Privacy & Security → Accessibility.

## Troubleshooting

**Alt key doesn't start recording**
Windows may intercept the Alt key for menu activation. Try changing the hotkey to `ctrl` or a non-modifier key like `f8` in `~/.whisper_app/config.json`.

**No microphone audio**
Check that your microphone is the default input device. The app uses `sounddevice.default.device[0]` (the system default). Test with `python -c "import sounddevice; print(sounddevice.default.device)"`.

**Transcription is slow on first run**
The model downloads on first use. Subsequent runs use the cached model from `~/.cache/huggingface/`.

**"main thread is not in main loop" error**
Make sure you're running the latest version — the overlay runs in a dedicated thread and is safe to call from pynput callbacks.

## Build standalone executable

```bash
# Windows (PowerShell)
.\scripts\build_windows.ps1
# → dist/Whisper.exe

# macOS
./scripts/build_macos.sh
# → dist/Whisper.app
```

Uses PyInstaller to bundle Python, dependencies, and the model into a single file.

## Development

```bash
pip install -r requirements-dev.txt     # includes pytest, pyinstaller
pytest tests/                           # run tests
```

See [CLAUDE.md](CLAUDE.md) for architecture details and contribution guidelines.

## License

MIT
