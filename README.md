# Wavely — Push-to-Talk Speech-to-Text

Hold a hotkey, speak, release — transcribed text appears wherever your cursor is.

![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue)
![Runtime](https://img.shields.io/badge/node-22%20LTS-brightgreen)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

- **Push-to-talk** — hold a global hotkey (default `Alt`), speak, release
- **Modular transcription** — choose between Groq, Deepgram, or OpenAI providers
- **Silent operation** — runs in the system tray, pastes transcribed text into the focused field
- **Auto-update** — receives updates automatically via GitHub releases
- **Profiles** — per-profile language and model overrides
- **Conversation history** — saves up to 500 transcriptions, grouped by date

## Quick start

### Prerequisites

- Node.js 22 LTS
- A microphone
- An API key for your chosen transcription provider (Groq, Deepgram, or OpenAI)
- Windows 10+ or macOS 12+

### Setup

```bash
git clone https://github.com/theyluvEnething/speech-to-text.git
cd speech-to-text/frontend

# Set your API keys
cp .env .env.local

# Add at least one provider key to .env.local:
#   GROQ_API_KEY=...
#   DEEPGRAM_API_KEY=...
#   OPENAI_API_KEY=...

npm install
npm run dev
```

## Configuration

Settings stored via `electron-store`:

| Key | Default | Description |
|-----|---------|-------------|
| `hotkey` | `Alt` | Hold-to-record key |
| `language` | `en` | ISO 639-1 code or `auto` for auto-detect |
| `provider` | `groq` | Transcription provider (`groq`, `deepgram`, `openai`) |
| `model` | varies | Provider-specific model |
| `copyToClipboard` | `true` | Leave text in clipboard after pasting |
| `appLanguage` | `en` | UI language (en / de / it / es / ja) |

Settings are changed via the Settings and App tabs in the tray menu.

## How it works

1. **Hotkey detection** — `uiohook-napi` listens globally for key-down/key-up
2. **Audio capture** — `MediaRecorder` API captures at 16 kHz mono in a hidden window, with 310ms post-release buffer for trailing words
3. **Volume visualization** — real-time RMS/peak display on the overlay during recording
4. **Transcription** — audio buffer sent to the selected provider (Groq, Deepgram, or OpenAI)
5. **Paste** — `Ctrl+V` / `Cmd+V` simulation via `@nut-tree/nut-js`
6. **Overlay** — floating pill shows recording status, processing indicator, and transcription result with spring animations

## Build & publish

```bash
npm run dev          # Dev server with HMR
npm run build        # Production build
npm run dist         # Package installer + publish to GitHub releases
```

Requires `GH_TOKEN` environment variable for GitHub release publishing.

## Troubleshooting

**uiohook-napi not available**
Run `npm run rebuild` to rebuild native modules. Falls back to `globalShortcut` toggle mode.

**No microphone audio**
Check your system default input device. The app uses `getUserMedia` with the default microphone.

**API key not found**
Set provider-specific keys in `frontend/.env.local`. Keys are read from environment variables at runtime.

## License

MIT
