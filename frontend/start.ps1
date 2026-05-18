$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Starting Wavely dev server ===" -ForegroundColor Cyan
npm run dev
