# Wavely — Push-to-Talk Speech-to-Text

## What this is

A cross-platform desktop app (Windows + macOS) that lets the user hold a hotkey,
speak, release the key, and have the transcribed text automatically pasted into the
focused text field. Runs silently in the system tray. Transcription via Deepgram API.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron 31 | Cross-platform desktop, system tray, global shortcuts |
| Renderer | React 18 + Vite 5 | Fast dev, modern UI, Tailwind CSS |
| Language | TypeScript 5.5 strict | Type safety across main + renderer |
| Transcription | `@deepgram/sdk` (nova-2) | State-of-the-art accuracy, fast API |
| Audio capture | Web `MediaRecorder` API | Browser-native, no native deps |
| Hotkey | `uiohook-napi` + `globalShortcut` fallback | Global key-down/key-up detection |
| Paste | `@nut-tree/nut-js` | OS-level keyboard simulation |
| Settings | `electron-store` | Persistent local JSON config |
| Packaging | `electron-builder` | `.exe` (NSIS) and `.dmg` into `dist/` |

## Project layout

```
speech-to-text/
├── src/
│   ├── main/
│   │   ├── index.ts          # Entry point — windows, tray, hotkey
│   │   ├── windows.ts        # SettingsWindow, OverlayWindow, AudioWindow
│   │   ├── tray.ts           # System tray icon + menu
│   │   ├── hotkey.ts         # Global push-to-talk via uiohook / globalShortcut
│   │   ├── ipc-handlers.ts   # IPC channel handlers + electron-store
│   │   ├── transcriber.ts    # Deepgram SDK wrapper
│   │   └── paste.ts          # Clipboard write + Ctrl/Command+V
│   ├── preload/
│   │   ├── preload.ts        # Settings window bridge
│   │   ├── preload-audio.ts  # Audio window bridge
│   │   └── preload-overlay.ts # Overlay window bridge
│   └── renderer/
│       ├── index.html        # Settings window HTML
│       ├── overlay.html      # Overlay window HTML (transparent)
│       ├── audio.html        # Hidden audio capture window
│       ├── main.tsx          # Settings React entry
│       ├── overlay.tsx       # Overlay React entry
│       ├── audio.ts          # getUserMedia + MediaRecorder logic
│       ├── App.tsx           # Settings UI component
│       ├── OverlayApp.tsx    # Floating pill overlay component
│       ├── index.css         # Tailwind imports + globals
│       └── global.d.ts       # Window API type declarations
├── assets/
│   ├── icon.png              # Tray / app icon (512x512)
│   └── icon.ico              # Windows icon
├── .env                      # DEEPGRAM_API_KEY (gitignored)
├── package.json              # Deps + electron-builder config
├── electron.vite.config.ts   # electron-vite build config
├── tsconfig.json             # TypeScript config
├── tailwind.config.js        # Tailwind theme
└── postcss.config.js         # PostCSS + autoprefixer
```

## Core flow

1. User holds hotkey (default `Alt`); `uiohook-napi` detects global key-down
2. Main process sends IPC to hidden AudioWindow: start recording via MediaRecorder
3. Main process sends IPC to OverlayWindow: show "Recording..." pill
4. User releases hotkey; `uiohook-napi` detects global key-up
5. Main process sends IPC to AudioWindow: stop recording
6. AudioWindow converts Blob to ArrayBuffer and sends back via IPC
7. Main process sends to Deepgram nova-2 model for transcription
8. Main process copies transcript to clipboard, simulates Ctrl+V / Cmd+V via nut-js
9. OverlayWindow shows transcribed text briefly, then auto-fades

## Configuration

Settings stored via `electron-store`:
- `hotkey` — default `"Alt"`, any modifier key
- `language` — ISO code e.g. `"en"`, `"de"`, or `"auto"` for auto-detect
- `apiKey` — Deepgram API key (stored locally, never sent anywhere else)

## Platform notes

**Windows**
- Paste via `Ctrl+V` simulation (nut-js)
- Build: `npm run dist` → `dist/Wavely Setup.exe`

**macOS**
- Accessibility permission required for keyboard simulation
- Paste via `Cmd+V` simulation (nut-js)
- Build: `npm run dist` → `dist/Wavely.dmg`

## Dev setup

```bash
npm install
cp .env .env.local  # add your DEEPGRAM_API_KEY
npm run dev          # starts electron-vite dev server
npm run build        # production build
npm run dist         # package installer
```
