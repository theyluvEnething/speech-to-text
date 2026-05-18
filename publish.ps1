$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Wavely - GitHub Release Publisher" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check for GitHub Token
if (-not $env:GH_TOKEN -and -not $env:GITHUB_TOKEN) {
    Write-Host "[ERROR] GH_TOKEN environment variable is missing!" -ForegroundColor Red
    Write-Host "Please set it before publishing. Example:" -ForegroundColor Yellow
    Write-Host '$env:GH_TOKEN="your_personal_access_token"' -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] GitHub Token found." -ForegroundColor Green

Push-Location $PSScriptRoot/frontend
$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# 2. Install dependencies
Write-Host "[STEP 1] Running npm install..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

# 3. Build React/Main code
Write-Host "[STEP 2] Building frontend & main process..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

# 4. Package and Publish
Write-Host "[STEP 3] Packaging and Publishing to GitHub..." -ForegroundColor Yellow
npx electron-builder --publish always
if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

Pop-Location
$stopwatch.Stop()
$elapsed = $stopwatch.Elapsed.ToString("mm\:ss")

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  SUCCESS! Release published to GitHub." -ForegroundColor Green
Write-Host "  Time elapsed: $elapsed" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Green
