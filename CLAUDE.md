# Whisper — Push-to-Talk Speech-to-Text

## What this is

A lightweight cross-platform desktop app (Windows + macOS) that lets the user hold a hotkey, speak, release the key, and have the transcribed text automatically typed/pasted into whatever text field is focused. Think WhisperFlow / Superwhisper, built and owned by the developer.

The app runs silently in the system tray. No subscription, no cloud — transcription runs locally via `faster-whisper`.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | Python 3.11+ | Best ecosystem for Whisper, pynput, sounddevice, cross-platform |
| Transcription | `faster-whisper` (CTranslate2) | Faster than openai-whisper, same accuracy, runs locally |
| Audio capture | `sounddevice` | Cross-platform, low-latency, no extra system deps |
| Hotkey | `pynput` | Works on Windows and macOS without admin rights (macOS needs Accessibility permission) |
| Paste | `pyperclip` + `pyautogui` | Clipboard write + Ctrl/Cmd+V simulation |
| UI | `customtkinter` | Minimal modern overlay / settings window |
| Tray | `pystray` | Cross-platform system tray icon |
| Packaging | `PyInstaller` | Single-file `.exe` (Windows) and `.app` (macOS) |

## Project layout

```
speech-to-text/
├── src/whisper_app/
│   ├── __main__.py          # Entry point — starts tray + hotkey listener
│   ├── core/
│   │   ├── audio.py         # Record audio while key held
│   │   ├── transcriber.py   # faster-whisper wrapper
│   │   └── paste.py         # Clipboard + auto-paste logic
│   └── ui/
│       ├── tray.py          # System tray icon + menu
│       ├── overlay.py       # Small floating status indicator
│       └── settings.py      # Settings window (hotkey, model, language)
├── assets/
│   ├── icon.png             # Tray / app icon (512×512)
│   └── icon.ico             # Windows icon
├── tests/                   # pytest unit tests
├── scripts/
│   ├── build_windows.ps1    # PyInstaller Windows build
│   └── build_macos.sh       # PyInstaller macOS build
├── requirements.txt         # Runtime dependencies
├── requirements-dev.txt     # Dev/test dependencies
├── pyproject.toml           # Project metadata + tool config
└── CLAUDE.md                # This file
```

## Core flow

1. `pynput` global listener detects hotkey press (default: `Alt`)
2. `audio.py` starts streaming from the default microphone into a buffer
3. On key release, the buffer is flushed to a WAV in memory
4. `transcriber.py` runs `faster-whisper` on the WAV → returns plain text
5. `paste.py` writes the text to the clipboard, then simulates Ctrl+V (Win) / Cmd+V (Mac)
6. Overlay briefly shows the transcribed text, then fades

## Configuration

Settings are stored in `~/.whisper_app/config.json`:
- `hotkey` — default `"alt"`, any key pynput recognizes
- `model` — `"tiny"`, `"base"`, `"small"`, `"medium"`, `"large-v3"` (tradeoff: speed vs accuracy)
- `language` — `null` (auto-detect) or ISO code e.g. `"en"`, `"no"`
- `device` — `"cpu"` or `"cuda"` (if NVIDIA GPU present)

## Platform notes

**Windows**
- No extra permissions needed
- Paste via `pyautogui.hotkey("ctrl", "v")`
- Build: `scripts/build_windows.ps1` → `dist/Whisper.exe`

**macOS**
- First launch: system will prompt for Accessibility permission (needed for pynput global hotkeys)
- Paste via `pyautogui.hotkey("command", "v")`
- Build: `scripts/build_macos.sh` → `dist/Whisper.app`

## Dev setup

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS:
source .venv/bin/activate

pip install -r requirements-dev.txt
python -m whisper_app   # run from src/
```

## Adding features / maintaining

- **Change hotkey**: update `ui/settings.py` and `core/audio.py` listener — the hotkey is injected at runtime from config, no hardcoding
- **Swap transcription backend**: replace `core/transcriber.py` only; the interface is `transcribe(wav_bytes: bytes) -> str`
- **New UI element**: add to `ui/`, import in `__main__.py`
- **Tests**: `pytest tests/` — unit-test audio chunking and transcription stub
