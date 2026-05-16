@echo off
setlocal enabledelayedexpansion
title Whisper PTT
echo ================================================
echo   Whisper PTT v2.0.0
echo   Push-to-Talk Speech-to-Text (Deepgram)
echo ================================================
echo.

#:: Check Node.js
# echo [STEP 1] Checking Node.js...
# where node >nul 2>&1
# if errorlevel 1 (
#    echo [ERROR] Node.js is not installed or not in PATH.
#    echo         Download from https://nodejs.org/ (LTS recommended)
#    goto :fail
# )
# for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
# echo [OK] Node.js found: %NODE_VER%


:: Check npm
echo [STEP 2] Checking npm...
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found.
    goto :fail
)
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i
echo [OK] npm found: v%NPM_VER%
echo.

:: Check .env
echo [STEP 3] Checking .env file...
if not exist ".env" (
    echo [INFO] No .env file found. Creating template...
    echo DEEPGRAM_API_KEY=your_key_here > .env
    echo [WARN] Edit .env and add your Deepgram API key before continuing.
    echo        Get one at https://console.deepgram.com
    goto :fail
) else (
    echo [OK] .env file found.
)

:: Check node_modules
echo [STEP 4] Checking node_modules...
if not exist "node_modules\" (
    echo [INFO] node_modules not found. Running npm install...
    call npm install
    set INSTALL_CODE=!errorlevel!
    echo [INFO] npm install exited with code: !INSTALL_CODE!
    if !INSTALL_CODE! neq 0 (
        echo [ERROR] npm install failed with code !INSTALL_CODE!.
        goto :fail
    )
    echo [OK] npm install succeeded.
) else (
    echo [OK] node_modules found.
)
echo.

:: Clean dist
echo [STEP 5] Cleaning dist directory...
if exist "dist\" (
    rmdir /s /q "dist"
    echo [OK] dist directory removed.
) else (
    echo [OK] dist directory does not exist — nothing to clean.
)
echo.

:: Build
echo [STEP 6] Building application...
call npm run build
set BUILD_CODE=!errorlevel!
if !BUILD_CODE! neq 0 (
    echo [ERROR] Build failed with code !BUILD_CODE!.
    goto :fail
)
echo [OK] Build succeeded.
echo.

:: Launch Electron in background
echo [STEP 7] Starting Electron backend (minimized)...
start "Whisper PTT Backend" /MIN cmd /c npm run dev
echo [OK] Electron backend launched in background window.
echo.

:: Wait for Vite + WebSocket
echo [STEP 8] Waiting for backend to initialize...
timeout /t 3 /nobreak >nul
echo [OK] Backend should be ready.
echo.

:: Run TUI in foreground
echo [STEP 9] Starting TUI...
echo ------------------------------------------------
call npm run tui
set TUI_CODE=%errorlevel%
echo ------------------------------------------------
echo [INFO] TUI exited with code: %TUI_CODE%
if %TUI_CODE% neq 0 (
    echo [WARN] TUI exited with an error (code %TUI_CODE%).
) else (
    echo [OK] TUI exited cleanly.
)
goto :done

:fail
echo.
echo ================================================
echo   Whisper PTT stopped due to an error above.
echo ================================================

:done
echo.
echo Press any key to close this window...
pause >nul
endlocal