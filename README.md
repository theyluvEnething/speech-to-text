# Whisper PTT — Push-to-Talk Speech-to-Text

Hold a hotkey, speak, release — transcribed text appears wherever your cursor is.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Runtime](https://img.shields.io/badge/node-22%20LTS-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## How it works

```
 Hold Alt  ->  Speak  ->  Release Alt  ->  Text pasted at cursor
```

1. **Hotkey detection** — `uiohook-napi` listens globally for key-down/key-up (default: `Alt`). Falls back to Electron `globalShortcut` toggle mode if native modules can't load.
2. **Audio capture** — Browser `MediaRecorder` API captures from the default microphone at 16 kHz mono in a hidden renderer window.
3. **Transcription** — Deepgram nova-2 model transcribes the audio. API key required (free tier: 200 hrs/month).
4. **Paste** — Text is copied to the clipboard and `Ctrl+V` / `Cmd+V` is simulated into the active text field via `@nut-tree/nut-js`.

## Quick start

### Prerequisites

- Node.js 22 LTS
- A microphone
- A [Deepgram API key](https://console.deepgram.com) (free tier available)
- Windows 10+ or macOS 12+

### Launch

```bash
# Clone
git clone https://github.com/theyluvEnething/speech-to-text.git
cd speech-to-text

# Install
npm install

# Add your API key
echo DEEPGRAM_API_KEY=your_key_here > .env

# Run
npm run dev
```

Or double-click `start.bat` (Windows) — it checks prerequisites, installs dependencies, and launches the app.

The app lives in your system tray. Hold **Alt**, speak, release. An overlay shows recording/processing/result state. Right-click the tray icon for Settings or to quit.

## Configuration

Settings stored via `electron-store` and the `.env` file:

| Key | Location | Default | Description |
|-----|----------|---------|-------------|
| `hotkey` | electron-store | `alt` | Hold-to-record key (Alt L/R, Ctrl L/R, Shift L/R) |
| `language` | electron-store | `en` | ISO 639-1 code or `auto` |
| `DEEPGRAM_API_KEY` | `.env` | — | Deepgram API key |

Settings are changed via the tray → Settings window. The hotkey updates immediately on save.

## Architecture

```
src/
├── main/
│   ├── index.ts          # Entry point — windows, tray, hotkey, main loop
│   ├── windows.ts        # SettingsWindow, OverlayWindow, AudioWindow
│   ├── tray.ts           # System tray icon + menu
│   ├── hotkey.ts         # Global push-to-talk via uiohook-napi / globalShortcut
│   ├── ipc-handlers.ts   # IPC channel handlers + electron-store
│   ├── transcriber.ts    # Deepgram SDK wrapper (nova-2)
│   └── paste.ts          # Clipboard write + Ctrl/Cmd+V simulation
├── preload/
│   ├── preload.ts        # Settings window bridge
│   ├── preload-audio.ts  # Audio window bridge (MediaRecorder control)
│   └── preload-overlay.ts# Overlay window bridge
└── renderer/
    ├── index.html        # Settings window
    ├── overlay.html      # Transparent overlay window
    ├── audio.html        # Hidden audio capture window
    ├── main.tsx          # Settings React entry
    ├── overlay.tsx       # Overlay React entry
    ├── audio.ts          # getUserMedia + MediaRecorder logic
    ├── App.tsx           # Settings UI component (hotkey, language)
    ├── OverlayApp.tsx    # Floating pill overlay (recording/result states)
    └── index.css         # Tailwind imports + globals
```

### Core flow

1. User holds hotkey → `uiohook-napi` key-down event
2. Main process sends `audio:start` IPC → AudioWindow begins MediaRecorder
3. Main process sends `overlay:state("recording")` IPC → Overlay shows red pill
4. User releases hotkey → `uiohook-napi` key-up event
5. Main process sends `audio:stop` IPC → AudioWindow stops, returns ArrayBuffer
6. Main process calls Deepgram nova-2 via `@deepgram/sdk`
7. Transcript → clipboard → `Ctrl+V` / `Cmd+V` via nut-js
8. Overlay shows transcribed text briefly, then auto-fades

### Window design

| Window | Purpose | Visible |
|--------|---------|---------|
| Settings | Hotkey and language configuration | On demand |
| Overlay | Semi-transparent floating pill, always-on-top | During recording/result |
| Audio | Hidden window hosting MediaRecorder | Never |

## Build & package

```bash
npm run build      # Production build
npm run dist       # Package installer (NSIS .exe on Windows, .dmg on macOS)
```

Output lands in `dist/`.

## macOS notes

- Accessibility permission required for keyboard simulation (nut-js)
- Grant in System Preferences → Privacy & Security → Accessibility
- uiohook-napi requires signed binaries — if it fails, the app falls back to Electron `globalShortcut` toggle mode

## Troubleshooting

**uiohook-napi not available / fallback to toggle mode**
Run `npm run rebuild` to rebuild native modules for your Electron version. If it still fails, toggle mode works as a fallback — press the hotkey once to start recording, again to stop.

**No microphone audio**
Check that your default microphone is accessible. The app uses the system default input device via `getUserMedia`.

**DEEPGRAM_API_KEY not found**
Make sure `.env` exists in the project root with `DEEPGRAM_API_KEY=your_key`. Get a key at [console.deepgram.com](https://console.deepgram.com).

## Dependencies

### Runtime

| Library | Purpose |
|---------|---------|
| `@deepgram/sdk` | Deepgram nova-2 speech-to-text API |
| `@nut-tree-fork/nut-js` | OS-level keyboard simulation for paste |
| `electron-store` | Persistent local JSON settings |
| `uiohook-napi` | Low-level global keyboard hook |
| `dotenv` | Load API key from `.env` file |

### Dev

| Library | Purpose |
|---------|---------|
| `electron` | Desktop app framework |
| `electron-vite` | Build tooling (Vite for main + renderer) |
| `electron-builder` | Package into installers |
| `react` / `react-dom` | Settings and overlay UI |
| `tailwindcss` | Utility-first CSS |
| `typescript` | Type safety across all layers |

## Design philosophy

The app is a pipeline of four independent stages:

```
┌──────────┐    ┌──────────┐    ┌─────────────┐    ┌──────────┐
│ Hotkey   │    │ Audio    │    │ Transcription│    │ Paste    │
│ detector ├───→│ capture  ├───→│ engine       ├───→│ output   │
│          │    │ (PCM)    │    │ (audio->text)│    │ (Ctrl+V) │
└──────────┘    └──────────┘    └─────────────┘    └──────────┘
```

Each stage has a clear input → output contract. You can swap any stage without touching the others — for example, replace Deepgram with a local Whisper model by changing only `transcriber.ts`.

## License

MIT
