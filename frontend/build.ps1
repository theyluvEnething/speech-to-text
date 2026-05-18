$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "=== Cleaning previous build artifacts ===" -ForegroundColor Cyan
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
}

Write-Host "=== Installing dependencies ===" -ForegroundColor Cyan
npm ci --silent

Write-Host "=== Building + packaging (this takes a few minutes) ===" -ForegroundColor Cyan
npm run dist 2>&1 | Out-Host
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

$installer = Get-ChildItem -Path "dist" -Filter "wavely-installer.*" -File |
    Where-Object { $_.Extension -in ".exe", ".dmg" } |
    Select-Object -First 1

if (-not $installer) {
    Write-Host "Installer not found in dist/" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Installer: $($installer.FullName)" -ForegroundColor Green
Write-Host "Size: $([math]::Round($installer.Length / 1MB, 1)) MB" -ForegroundColor Green
