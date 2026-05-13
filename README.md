# Whisper

Hold a key → speak → release → text appears where your cursor is.

Runs locally. No cloud. No subscription.

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS

pip install -r requirements-dev.txt
python -m whisper_app           # run from src/
```

Default hotkey is **Alt**. Change it in the tray icon → Settings.

## Requirements

- Python 3.11+
- A microphone
- ~150 MB disk for the `base` Whisper model (downloaded automatically on first run)

## Build a standalone executable

**Windows**
```powershell
.\scripts\build_windows.ps1
# → dist/Whisper.exe
```

**macOS**
```bash
./scripts/build_macos.sh
# → dist/Whisper.app
```

## Models

| Model | Size | Speed | Accuracy |
|---|---|---|---|
| tiny | 75 MB | very fast | decent |
| base | 150 MB | fast | good |
| small | 480 MB | moderate | better |
| medium | 1.5 GB | slow | great |
| large-v3 | 3 GB | slow | best |

Start with `base`. Switch in Settings if you need more accuracy.

## Developer guide

See [CLAUDE.md](CLAUDE.md) for architecture, file layout, and contribution notes.
