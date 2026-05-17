# Wavely — Push-to-Talk Speech-to-Text

Hold a hotkey, speak, release — transcribed text appears wherever your cursor is.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Runtime](https://img.shields.io/badge/node-22%20LTS-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## Architecture

```
speech-to-text/
├── client/        ← Electron desktop app (React + TypeScript)
├── backend/       ← Express server (temp API key distribution)
├── .claude/       ← Claude Code configuration
└── .git/
```

The app uses a **client-server model** for API key security:
- **Backend** holds the master Deepgram API key and generates short-lived temporary keys
- **Client** fetches a temp key on startup, uses it for transcription, and auto-refreshes on expiry

## Quick start

### Prerequisites

- Node.js 22 LTS
- A microphone
- A [Deepgram API key](https://console.deepgram.com) and Project ID
- Windows 10+ or macOS 12+

### Launch

```bash
# Clone
git clone https://github.com/theyluvEnething/speech-to-text.git
cd speech-to-text

# Backend
cd backend
echo DEEPGRAM_API_KEY=your_key_here > .env
echo DEEPGRAM_PROJECT_ID=your_project_id_here >> .env
npm install
npm start          # Starts on http://localhost:3000

# Client (new terminal)
cd ../client
npm install
npm run dev        # Starts the Electron app
```

Or double-click `client/start.bat` (Windows) — it checks prerequisites, installs dependencies, and launches both services.

## Configuration

Settings stored via `electron-store`:

| Key | Default | Description |
|-----|---------|-------------|
| `hotkey` | `ctrlright` | Hold-to-record key (Alt L/R, Ctrl L/R, Shift L/R) |
| `language` | `auto` | ISO 639-1 code or `auto` for auto-detect |
| `model` | `nova-2` | Deepgram model (`nova-2` / `nova-3`) |
| `modelTier` | — | Domain-specific tier (`general`, `medical`, `meeting`) |
| `copyToClipboard` | `true` | Also leave text in clipboard after pasting |
| `appLanguage` | `en` | UI language (en / de / it / es / ja) |

Settings are changed via the Settings and App tabs. The hotkey updates immediately on save.

## How it works

1. **Hotkey detection** — `uiohook-napi` listens globally for key-down/key-up. Falls back to Electron `globalShortcut` toggle mode if native modules can't load.
2. **Audio capture** — Browser `MediaRecorder` API captures from the default microphone at 16 kHz mono in a hidden renderer window.
3. **Transcription** — Deepgram transcribes the audio using a temporary API key fetched from the backend.
4. **Paste** — Text is simulated as `Ctrl+V` / `Cmd+V` into the active text field via `@nut-tree/nut-js`.

## Troubleshooting

**uiohook-napi not available / fallback to toggle mode**
Run `npm run rebuild` inside `client/` to rebuild native modules. If it still fails, toggle mode works as a fallback — press the hotkey once to start recording, again to stop.

**No microphone audio**
Check that your default microphone is accessible. The app uses the system default input device via `getUserMedia`.

**Backend connection refused**
Make sure the backend is running (`cd backend && npm start`). The client fetches a temporary Deepgram key from `http://localhost:3000/api/get-deepgram-key` on startup.

**Deepgram credentials not configured**
Set `DEEPGRAM_API_KEY` and `DEEPGRAM_PROJECT_ID` in `backend/.env`. Get them at [console.deepgram.com](https://console.deepgram.com).

## License

MIT
