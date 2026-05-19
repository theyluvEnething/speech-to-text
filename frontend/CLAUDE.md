# Wavely — Push-to-Talk Speech-to-Text

## What this is

A cross-platform desktop app (Windows + macOS) that lets the user hold a hotkey,
speak, release the key, and have the transcribed text automatically pasted into the
focused text field. Runs silently in the system tray. Transcription via Deepgram API.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron 31 | Cross-platform desktop, system tray, global shortcuts |
| Renderer | React 18 + Vite 5 | Fast dev, modern UI |
| Styling | Tailwind CSS 3 + shadcn/ui (New York) | CSS variables, dark theme, accessible primitives |
| Typography | Inter (via `@fontsource/inter`) | Clean sans-serif, 300–700 weights |
| Icons | lucide-react | Consistent, tree-shakeable |
| State (renderer) | Zustand | Lightweight, no boilerplate |
| Language | TypeScript 5.5 strict | Type safety across main + renderer |
| Transcription | `@deepgram/sdk` (nova-2 / nova-3) | State-of-the-art accuracy, fast API |
| Audio capture | Web `MediaRecorder` API | Browser-native, no native deps |
| Hotkey | `uiohook-napi` + `globalShortcut` fallback | Global key-down/key-up detection |
| Paste | `@nut-tree/nut-js` | OS-level keyboard simulation |
| Storage | `electron-store` | Persistent local JSON config + conversations |
| Packaging | `electron-builder` | `.exe` (NSIS) and `.dmg` into `dist/` |

## Project layout

```
speech-to-text/
├── src/
│   ├── main/
│   │   ├── index.ts          # Entry point — windows, tray, hotkey, state machine
│   │   ├── windows.ts        # SettingsWindow (frameless), OverlayWindow, AudioWindow
│   │   ├── tray.ts           # System tray icon + menu
│   │   ├── hotkey.ts         # Global push-to-talk via uiohook / globalShortcut
│   │   ├── ipc-handlers.ts   # IPC handlers + electron-store schema (profiles, conversations)
│   │   ├── transcriber.ts    # Deepgram SDK wrapper
│   │   └── paste.ts          # Clipboard write + Ctrl/Command+V
│   ├── transcription/        # All API/WebRTC logic — modular, swappable providers
│   │   ├── index.ts          # Re-exports from active provider
│   │   ├── types.ts          # Shared types (TranscriptionCallback, ServerEvent)
│   │   ├── groq/
│   │   │   ├── index.ts          # Barrel re-exports
│   │   │   ├── realtime-client.ts   # RealtimeTranscriber — WebRTC client
│   │   │   ├── get-api-key.ts      # getApiKey() — env vars via IPC
│   │   │   └── realtime-client.test.ts
│   │   ├── openai/
│   │   │   └── index.ts          # Placeholder — not yet implemented
│   │   └── deepgram/
│   │       └── index.ts          # Placeholder — not yet implemented
│   ├── preload/
│   │   ├── preload.ts        # Settings window bridge → window.wavely
│   │   ├── preload-audio.ts  # Audio window bridge → window.audio
│   │   └── preload-overlay.ts # Overlay window bridge → window.overlay
│   └── renderer/
│       ├── index.html        # Settings window HTML (dark, frameless)
│       ├── overlay.html      # Overlay window HTML (transparent)
│       ├── audio.html        # Hidden audio capture window
│       ├── main.tsx          # React entry point
│       ├── overlay.tsx       # Overlay React entry
│       ├── App.tsx           # Layout shell — TitleBar + Sidebar + tab routing
│       ├── audio.ts          # getUserMedia + MediaRecorder logic (+310ms buffer)
│       ├── OverlayApp.tsx    # Floating pill overlay component
│       ├── store.ts          # Zustand store (activeTab, profiles, conversations)
│       ├── global.d.ts       # Window API type declarations
│       ├── index.css         # Tailwind + shadcn CSS variables + Inter font
│       ├── lib/
│       │   └── utils.ts      # cn() classname helper
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── TitleBar.tsx
│       │   ├── ProfileFooter.tsx
│       │   ├── ProfileSwitcherPopover.tsx
│       │   └── ui/           # shadcn/ui components
│       │       ├── button.tsx, input.tsx, select.tsx
│       │       ├── dialog.tsx, popover.tsx
│       │       ├── card.tsx, textarea.tsx
│       │       ├── label.tsx, separator.tsx, scroll-area.tsx
│       └── views/
│           ├── ConversationsView.tsx
│           ├── ProfilesView.tsx
│           └── SettingsView.tsx
├── assets/
│   ├── icon.png              # Tray / app icon (512x512)
│   └── icon.ico              # Windows icon
├── .env                      # DEEPGRAM_API_KEY (gitignored)
├── package.json              # Deps + electron-builder config
├── electron.vite.config.ts   # electron-vite build config (renderer aliased @/ → src/renderer/)
├── tsconfig.json             # TypeScript config (paths: @/*, @main/*)
├── tailwind.config.js        # CSS variable theme + surface palette + custom animations
└── postcss.config.js         # PostCSS + autoprefixer
```

## Core flow

1. User holds hotkey (default `Alt`); `uiohook-napi` detects global key-down
2. Main process checks state machine — blocks if already recording or transcribing
3. If a previous result is still visible, starts recording behind the scenes (deferred)
4. Main sends IPC to AudioWindow: start recording via MediaRecorder
5. Main sends IPC to OverlayWindow: show "Recording..." pill with animated audio bars
6. User releases hotkey; `uiohook-napi` detects global key-up
7. AudioWindow continues recording for 310ms post-release (captures trailing words)
8. AudioWindow stops MediaRecorder, sends ArrayBuffer to main via IPC
9. Main reads active profile for language/model overrides, transcribes via Deepgram
10. Main copies transcript to clipboard, simulates Ctrl+V / Cmd+V via nut-js
11. Main saves a `Conversation` record (text, language, model, profileId, duration)
12. OverlayWindow shows transcribed text for 3s, then fades and sends `overlay:idle`

### Recording state machine (main/index.ts)

```
state: "idle" | "recording" | "processing" | "showing-result"
audioActive: boolean
savedResult: string | null (deferred transcript awaiting overlay idle)
```

- `startRecording()` blocked on: `audioActive`, `state === "processing"`
- `startRecording()` allowed on: `"idle"` (show overlay), `"showing-result"` (deferred — capture audio behind result)
- `stopRecording()`: sets `audioActive = false`, sends `audio:stop`; overlay stays on recording through 310ms buffer
- `handleAudioBuffer()`: switches overlay to processing, transcribes, saves conversation
- Deferred flow: if a result is showing and user starts+stops recording, transcription runs in background; when overlay goes idle, the new result is displayed and saved

## Data model

### Profile
```
id, name, color (8 presets), icon (23 emoji + custom input), systemPrompt (text, unused for now),
language? (override), model? (override)
```
- Default profile: id `"default"`, color `#10b981`, icon `🎙️`
- Active profile's language/model take precedence over global settings
- Last profile cannot be deleted

### Conversation
```
id (uuid), text, language, model, profileId, durationSec, createdAt (epoch ms)
```
- Saved after every successful transcription
- Capped at 500 entries
- Grouped by Today / Yesterday / This week / Earlier in the UI

## Configuration

Settings stored via `electron-store`:
- `hotkey` — default `"Alt"`
- `language` — ISO code e.g. `"en"`, `"de"`, `"auto"`; default `"en"`
- `model` — `"nova-2"` or `"nova-3"`; default `"nova-2"`
- `modelTier` — `""`, `"general"`, `"medical"`, `"meeting"`; default `""`
- `profiles` — array of `Profile`; seeded with one default
- `activeProfileId` — `"default"`
- `conversations` — array of `Conversation`; starts empty

## IPC channels

### Settings (window.wavely / window.whisper)
| Channel | Direction | Purpose |
|---|---|---|
| `settings:get` | invoke | Read hotkey, language, model, modelTier |
| `settings:set` | invoke | Write settings, triggers `updateHotkey()` if hotkey changed |
| `settings:hide` | send | Hide window to tray |
| `settings:close` | send | Close/destroy window |

### Profiles (window.wavely.profiles)
| Channel | Direction | Purpose |
|---|---|---|
| `profiles:list` | invoke → Profile[] | List all profiles |
| `profiles:upsert` | invoke → Profile[] | Create or update a profile by id |
| `profiles:delete` | invoke → Profile[] | Delete by id (fails if last profile) |
| `profiles:getActive` | invoke → Profile | Get currently active profile |
| `profiles:setActive` | invoke | Set active profile by id |

### Conversations (window.wavely.conversations)
| Channel | Direction | Purpose |
|---|---|---|
| `conversations:list` | invoke → Conversation[] | List all (newest first) |
| `conversations:delete` | invoke → Conversation[] | Delete by id |
| `conversations:clear` | invoke | Delete all |

### Audio (window.audio)
| Channel | Direction | Purpose |
|---|---|---|
| `audio:start` | send | Start recording |
| `audio:stop` | send | Stop (with 310ms delay) |
| `audio:buffer` | send → main | Audio ArrayBuffer |
| `audio:levels` | send → main | RMS/peak/elapsed level data |

### Overlay (window.overlay)
| Channel | Direction | Purpose |
|---|---|---|
| `overlay:state` | send → renderer | `"recording"` / `"processing"` / `"idle"` |
| `overlay:result` | send → renderer | Transcription text |
| `overlay:error` | send → renderer | Error message |
| `overlay:idle` | send → main | Overlay faded and returned to idle |

## Platform notes

**Windows**
- Frameless window with rounded corners (CSS `rounded-[12px]`), custom titlebar with Minus/X buttons
- Paste via `Ctrl+V` simulation (nut-js)
- Build: `npm run dist` → `dist/Wavely Setup.exe`

**macOS**
- `titleBarStyle: hiddenInset` — traffic lights auto-positioned; sidebar header padded `pl-20`
- Accessibility permission required for keyboard simulation
- Paste via `Cmd+V` simulation (nut-js)
- Build: `npm run dist` → `dist/Wavely.dmg`

## Design system

- **Base**: Dark theme (`class="dark"` on `<html>`), CSS variables via shadcn convention
- **Colors**: `--background: 0 0% 4%` (#0a0a0a), `--card: 0 0% 6%`, `--primary: 252 80% 64%` (#6c5ce7), `--border: 0 0% 14%`
- **Radius**: `--radius: 0.625rem` (10px), applied via `rounded-lg`
- **Typography**: Inter, 13px body, tight tracking on headings, generous line-height
- **Motion**: 150–200ms ease transitions, no bouncy animations
- **Overlay**: Uses legacy `surface` palette (Tailwind colors) — kept separate from CSS variable system

## Do NOT touch

- `main/hotkey.ts`, `main/paste.ts`, `main/transcriber.ts`, `main/tray.ts`
- Audio capture pipeline (`audio.html`, `audio.ts`, `preload-audio.ts`)
- Overlay window and renderer (`overlay.html`, `OverlayApp.tsx`, `preload-overlay.ts`)
- The `window.whisper` shim in preload.ts (kept for safety)

## Dev setup

```bash
npm install
cp .env .env.local  # add your DEEPGRAM_API_KEY
npm run dev          # starts electron-vite dev server
npm run build        # production build
npm run dist         # package installer
```
