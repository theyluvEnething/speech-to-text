#!/usr/bin/env bash
# Build Whisper.app for macOS
# Run from repo root: ./scripts/build_macos.sh

set -e
cd "$(dirname "$0")/.."

pyinstaller \
    --onefile \
    --windowed \
    --name Whisper \
    --icon assets/icon.png \
    --add-data "assets:assets" \
    --paths src \
    src/whisper_app/__main__.py

echo "Build complete: dist/Whisper.app"
