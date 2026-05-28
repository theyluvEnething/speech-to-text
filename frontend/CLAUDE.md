# Wavely — Push-to-Talk Speech-to-Text

## What this is

A cross-platform desktop app (Windows + macOS) that lets the user hold a hotkey,
speak, release the key, and have the transcribed text automatically pasted into the
focused text field. Runs silently in the system tray. Modular transcription via
Groq, Deepgram, or OpenAI.

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Shell | Electron 31 | Cross-platform desktop, system tray, global shortcuts |
| Renderer | React 18 + Vite 5 | Fast dev, modern UI |
| Styling | Tailwind CSS 3 + shadcn/ui (New York) | CSS variables, dark theme, accessible primitives |
| Typography | Inter (via `@fontsource/inter`) | Clean sans-serif, 300–700 weights |
| Icons | lucide-react + flag-icons | Consistent, tree-shakeable + country flag icons |
| State (renderer) | Zustand | Lightweight, no boilerplate |
| Language | TypeScript 5.5 strict | Type safety across main + renderer |
| Transcription | Groq / Deepgram / OpenAI (modular) | Swappable providers via `transcription/` directory |
| Audio capture | Web `MediaRecorder` API | Browser-native, no native deps |
| Hotkey | `uiohook-napi` + `globalShortcut` fallback | Global key-down/key-up detection |
| Paste | `@nut-tree/nut-js` | OS-level keyboard simulation |
| Storage | `electron-store` | Persistent local JSON config + conversations |
| Popover | `@radix-ui/react-popover` | Accessible, collision-aware popovers |
| Tooltip | `@radix-ui/react-tooltip` | Accessible tooltips |
| Animation | `framer-motion` | Spring animations for pill and buttons |
| Packaging | `electron-builder` | `.exe` (NSIS) and `.dmg` into `dist/` |

## Project layout

```
speech-to-text/
├── src/
│   ├── main/
│   │   ├── index.ts          # Entry point — windows, tray, hotkey, state machine
│   │   ├── windows.ts        # SettingsWindow (frameless), OverlayWindow (460×260), AudioWindow
│   │   ├── tray.ts           # System tray icon + menu
│   │   ├── hotkey.ts         # Global push-to-talk via uiohook / globalShortcut
│   │   ├── ipc-handlers.ts   # IPC handlers + electron-store schema (profiles, conversations, debug)
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
│       ├── OverlayApp.tsx    # Floating pill overlay — recording UI, profile quick-swap, proximity logic
│       ├── store.ts          # Zustand store (activeTab, profiles, conversations)
│       ├── global.d.ts       # Window API type declarations
│       ├── index.css         # Tailwind + shadcn CSS variables + Inter font
│       ├── overlay.css       # Tailwind + flag-icons CSS for overlay window
│       ├── lib/
│       │   ├── utils.ts      # cn() classname helper
│       │   └── flagEmoji.ts  # isFlagEmoji() + flagEmojiToCountryCode() for country flag detection
│       ├── hooks/
│       │   └── useProximity.ts  # Cursor proximity detection with override support
│       ├── components/
│       │   ├── Sidebar.tsx
│       │   ├── TitleBar.tsx
│       │   ├── ProfileFooter.tsx
│       │   ├── ProfileIcon.tsx           # Emoji + flag icon renderer
│       │   ├── ProfileSwitcherPopover.tsx
│       │   ├── ProximityDebugOverlay.tsx # Debug visualization for proximity bounding boxes
│       │   └── ui/           # shadcn/ui components
│       │       ├── button.tsx, input.tsx, select.tsx
│       │       ├── dialog.tsx, popover.tsx
│       │       ├── card.tsx, textarea.tsx
│       │       ├── label.tsx, separator.tsx, scroll-area.tsx
│       │       └── switch.tsx
│       └── views/
│           ├── ConversationsView.tsx
│           ├── ProfilesView.tsx
│           ├── SettingsView.tsx
│           ├── AppView.tsx    # App settings — language, account, updates, reset
│           └── DebugView.tsx  # Debug tools — overlay background, proximity overlay, full reset
├── assets/
│   ├── icon.png              # Tray / app icon (512x512)
│   └── icon.ico              # Windows icon
├── .env                      # Provider API keys (gitignored)
├── package.json              # Deps + electron-builder config
├── electron.vite.config.ts   # electron-vite build config (renderer aliased @/ → src/renderer/)
├── tsconfig.json             # TypeScript config (paths: @/*, @main/*)
├── tailwind.config.js        # CSS variable theme + surface palette + custom animations
└── postcss.config.js         # PostCSS + autoprefixer
```

## Core flow

1. User holds hotkey (default `Ctrl+Right`); `uiohook-napi` detects global key-down
2. Main process checks state machine — blocks if already recording or transcribing
3. If a previous result is still visible, starts recording behind the scenes (deferred)
4. Main sends IPC to AudioWindow: start recording via MediaRecorder
5. Main sends IPC to OverlayWindow: show "Recording..." pill with animated audio bars
6. User releases hotkey; `uiohook-napi` detects global key-up
7. AudioWindow continues recording for 310ms post-release (captures trailing words)
8. AudioWindow stops MediaRecorder, sends ArrayBuffer to main via IPC
9. Main reads active profile for language/model overrides, transcribes via selected provider
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

## Overlay UI

The overlay window (460×260, transparent, always-on-top) shows a floating pill at the bottom.
Cursor proximity (280×80 region centered on the pill) expands it to reveal:

- **Left**: Profile quick-swap button (shows active profile's icon using `ProfileIcon` for proper flag rendering)
- **Center**: Recording/status pill (click to start/stop recording)
- **Right**: Settings/Polish button

### Profile quick-swap pill

When the profile button is clicked, a vertical pill appears above it containing:
- Up to 3 other profiles (from `recentProfileIds` store) as circular emoji buttons
- If fewer than 3 recents exist, fills from the full profile list
- If only 1 profile exists total, shows a "⋯" button to open profile settings
- Uses `ProfileIcon` for proper flag emoji rendering via `flag-icons` CSS
- Click a circle → immediately switches to that profile, updates `recentProfileIds`

### Proximity-based menu closing

The profile menu stay-open logic uses a sophisticated multi-zone system:

1. **`useProximity` hook** (`renderer/hooks/useProximity.ts`) — accepts an `override` parameter. When the menu opens, `menuOverrideActive=true` forces `isNear=true` so the pill stays expanded even if the cursor leaves the pill region.

2. **Cached menu zones** — `cachedMenuZones` ref stores the last known button/popover/safe-zone rectangles. When a profile is selected and the popover unmounts, the override persists using these cached coordinates.

3. **Dynamic safe zone** — computed as the bounding box spanning from the popover's top edge to the button's bottom edge, and from the leftmost to rightmost edge of both elements.

4. **Closing logic** — the menu closes only when the cursor leaves ALL of: the trigger button, the popover content, and the dynamic safe zone between them. Moving back into the main pill (away from the button area) also closes the menu, while `useProximity` independently keeps the pill expanded.

### Debug proximity overlay

Toggle from Debug tab → "Show proximity debug overlay". Requires `debugProximity: true` in `electron-store`. Renders fixed-position colored rectangles:

- **Blue** — Pill region (280×80 proximity zone)
- **Green** — Profile trigger button bounds
- **Orange** — Popover content bounds (live or cached)
- **Pink** — Dynamic safe zone between button and popover (live or cached)

When the menu is visually closed but `menuOverrideActive` is still true, the debug overlay draws cached rectangles so the invisible boundary is visible.

## Data model

### Profile
```
id, name, color (8 presets), icon (23 emoji + custom input), systemPrompt (text, unused for now),
language? (override), model? (override)
```
- Default profile: id `"default"`, color `#10b981`, icon `🌎`
- Active profile's language/model take precedence over global settings
- Last profile cannot be deleted

### Conversation
```
id (uuid), text, language, model, profileId, durationSec, createdAt (epoch ms)
```
- Saved after every successful transcription
- Capped at 500 entries
- Grouped by Today / Yesterday / This week / Earlier in the UI

### Recent profiles
```
recentProfileIds: string[] (max 3)
```
- Persisted in `electron-store`, default `["default"]`
- Updated by `profiles:setActive` — prepends selected ID, dedupes, caps at 3
- Used by the overlay profile quick-swap pill to show recently used profiles
- On full reset, resets to `["default"]`

## Configuration

Settings stored via `electron-store`:
- `hotkey` — default `"ctrlright"`
- `language` — ISO code e.g. `"en"`, `"de"`, `"auto"`; default `"auto"`
- `model` — `"whisper-large-v3-turbo"`; default `"whisper-large-v3-turbo"`
- `provider` — `"groq"`; default `"groq"`
- `copyToClipboard` — boolean; default `true`
- `appLanguage` — `"en"`, `"de"`, `"it"`, `"es"`, `"ja"`; default `"en"`
- `isPaused` — boolean; default `false`
- `debugProximity` — boolean; default `false` (toggles proximity debug overlay)
- `profiles` — array of `Profile`; seeded with one default
- `activeProfileId` — `"default"`
- `recentProfileIds` — string[] (max 3); default `["default"]`
- `conversations` — array of `Conversation`; starts empty

### Full Reset

Two reset options:
- **App tab "Reset to defaults"** — resets settings (hotkey, language, model, provider, copyToClipboard, appLanguage) to defaults
- **Debug tab "FULL RESET"** — resets ALL data (settings, profiles, conversations, recentProfileIds, isPaused, debugProximity) to factory defaults. Both windows reload after reset, and the overlay receives an `app:reset` event to update its icon.

## IPC channels

### Settings (window.wavely / window.whisper)
| Channel | Direction | Purpose |
|---|---|---|
| `settings:get` | invoke | Read hotkey, language, model, provider, copyToClipboard, appLanguage |
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
| `profiles:setActive` | invoke | Set active profile by id + update `recentProfileIds` |
| `profiles:getRecent` | invoke → string[] | Get recent profile IDs (max 3, newest first) |

### Conversations (window.wavely.conversations)
| Channel | Direction | Purpose |
|---|---|---|
| `conversations:list` | invoke → Conversation[] | List all (newest first) |
| `conversations:delete` | invoke → Conversation[] | Delete by id |
| `conversations:clear` | invoke | Delete all |

### App (window.wavely)
| Channel | Direction | Purpose |
|---|---|---|
| `app:getVersion` | invoke → string | Get app version from `package.json` |
| `app:getPaused` | invoke → boolean | Get pause state |
| `app:togglePaused` | invoke → boolean | Toggle pause state |
| `app:fullReset` | invoke → {success} | Reset ALL data to factory defaults, broadcasts `app:reset` |

### Debug (window.wavely)
| Channel | Direction | Purpose |
|---|---|---|
| `debug:getProximity` | invoke → boolean | Get debug proximity overlay state |
| `debug:toggleProximity` | invoke → boolean | Toggle debug proximity overlay, broadcasts to overlay |

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
| `overlay:levels` | send → renderer | Real-time `{rms, peak}` dB levels for audio visualization |
| `overlay:idle` | send → main | Overlay faded and returned to idle |
| `overlay:getActiveProfile` | invoke → Profile | Get active profile from overlay window |
| `overlay:toggleTransparency` | invoke | Toggle overlay background transparency |
| `overlay:debug-proximity-changed` | send → renderer | Debug proximity state changed |
| `app:reset` | send → renderer | Full reset event — overlay re-fetches active profile icon |

### Overlay profiles (window.overlay — for quick-swap pill)
| Channel | Direction | Purpose |
|---|---|---|
| `profiles:list` (via overlay) | invoke → Profile[] | List all profiles |
| `profiles:getRecent` (via overlay) | invoke → string[] | Get recent profile IDs |
| `profiles:setActive` (via overlay) | invoke | Set active profile (also updates recents) |
| `debug:getProximity` (via overlay) | invoke → boolean | Get proximity debug state |

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
- **Overlay**: Uses Tailwind `neutral-900/90` with `backdrop-blur-md`, transparent background, `flag-icons` CSS for country flags

## Do NOT touch

- `main/hotkey.ts`, `main/paste.ts`, `main/tray.ts`
- Audio capture pipeline (`audio.html`, `audio.ts`, `preload-audio.ts`)
- The `window.whisper` shim in preload.ts (kept for safety)

## Dev setup

```bash
npm install
cp .env .env.local  # add at least one provider key: GROQ_API_KEY, DEEPGRAM_API_KEY, OPENAI_API_KEY
npm run dev          # starts electron-vite dev server
npm run build        # production build
npm run dist         # package installer + publish to GitHub releases (requires GH_TOKEN)
```
