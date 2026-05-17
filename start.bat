@echo off
setlocal enabledelayedexpansion
title Wavely
echo ================================================
echo   Wavely v1.0.0
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

:: Launch
echo [STEP 5] Running: npm run dev
echo ------------------------------------------------
call npm run dev
set DEV_CODE=%errorlevel%
echo ------------------------------------------------
echo [INFO] npm run dev exited with code: %DEV_CODE%
if %DEV_CODE% neq 0 (
    echo [ERROR] App exited with an error (code %DEV_CODE%).
) else (
    echo [OK] App exited cleanly.
)
goto :done

:fail
echo.
echo ================================================
echo   Wavely stopped due to an error above.
echo ================================================

:done
echo.
echo Press any key to close this window...
pause >nul
endlocal