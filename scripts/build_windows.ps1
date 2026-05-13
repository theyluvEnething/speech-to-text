# Build Whisper.exe for Windows
# Run from repo root: .\scripts\build_windows.ps1

Set-Location $PSScriptRoot\..

pyinstaller `
    --onefile `
    --windowed `
    --name Whisper `
    --icon assets/icon.ico `
    --add-data "assets;assets" `
    --paths src `
    src/whisper_app/__main__.py

Write-Host "Build complete: dist/Whisper.exe"
