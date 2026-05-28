# Wavely — Push-to-Talk Speech-to-Text

A cross-platform desktop app that lets you hold a hotkey, speak, and have transcribed text automatically typed wherever your cursor is. Built with Electron, React, and TypeScript.

## Features

- **Push-to-talk** — hold a global hotkey, speak, release, and text appears
- **Multi-provider transcription** — Groq (Whisper), Deepgram (Nova), OpenAI (Whisper)
- **Profile system** — create profiles with custom icons (emojis + country flags), language/model overrides
- **Quick-swap pill** — switch profiles instantly from the overlay without opening settings
- **System tray** — runs silently in the background
- **Cross-platform** — Windows (.exe) + macOS (.dmg)
- **Conversation history** — saves every transcription, searchable and grouped by date
- **i18n** — English, Deutsch, Italiano, Español, 日本語

## Quick profile switching

Hover near the bottom of your screen to reveal the overlay pill. Click the profile icon button to open the quick-swap pill:

- Shows your 3 most recently used profiles as circular emoji buttons
- Country flag emojis render as proper flag icons
- Click any circle to switch instantly
- The pill stays open while your cursor is near the button area

## Dev setup

```bash
npm install
cp .env .env.local  # add provider API keys
npm run dev          # starts electron-vite dev server
npm run build        # production build
npm run dist         # package installer
```

### Required API keys

Set at least one in `.env`:
- `GROQ_API_KEY`
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`

## Tech stack

Electron 31 · React 18 · Vite 5 · TypeScript 5.5 · Tailwind CSS 3 · shadcn/ui · Zustand · Radix UI · Framer Motion · electron-store · flag-icons

## License

MIT
