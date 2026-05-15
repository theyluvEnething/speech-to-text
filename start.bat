@echo off
setlocal

cd /d "%~dp0"

echo ========================================
echo   Whisper — Push-to-Talk Speech-to-Text
echo ========================================
echo.

REM --- Check Python -------------------------------------------------
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH.
    echo         Install Python 3.11+ from https://python.org
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PYVER=%%v
echo [INFO]  Python %PYVER%

REM --- Create virtual environment if missing -------------------------
if not exist ".venv\Scripts\python.exe" (
    echo [INFO]  Creating virtual environment...
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
)

REM --- Install / update dependencies ---------------------------------
echo [INFO]  Installing dependencies...
.venv\Scripts\pip install -q -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

REM --- Launch --------------------------------------------------------
echo [INFO]  Starting Whisper...
echo.
cd src
"%~dp0.venv\Scripts\python.exe" -m whisper_app

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Whisper exited with code %errorlevel%.
    pause
)
