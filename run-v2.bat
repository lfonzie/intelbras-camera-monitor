@echo off
REM Intelbras Camera Monitor V2 - Run Script for Windows
REM This script runs the v2 app from the project root directory

echo 🎥 Intelbras Camera Monitor V2 - Starting from project root
echo ==========================================================

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0
set V2_DIR=%SCRIPT_DIR%public\v2

REM Check if v2 directory exists
if not exist "%V2_DIR%" (
    echo ❌ Error: v2 directory not found at %V2_DIR%
    pause
    exit /b 1
)

REM Check if package.json exists in v2 directory
if not exist "%V2_DIR%\package.json" (
    echo ❌ Error: package.json not found in v2 directory
    pause
    exit /b 1
)

echo 📁 V2 directory: %V2_DIR%
echo.

REM Change to v2 directory
cd /d "%V2_DIR%"

REM Check if start.sh exists (for Git Bash or WSL)
if exist "start.sh" (
    echo 🚀 Running v2 startup script...
    bash start.sh
) else (
    echo ⚠️  start.sh not found, running manual setup...
    
    REM Check if Node.js is installed
    node --version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Error: Node.js is not installed. Please install Node.js first.
        echo Download from: https://nodejs.org/
        pause
        exit /b 1
    )

    REM Check if FFmpeg is installed
    ffmpeg -version >nul 2>&1
    if errorlevel 1 (
        echo ❌ Error: FFmpeg is not installed!
        echo Please install FFmpeg:
        echo   • Windows: choco install ffmpeg
        echo   • Or download from: https://ffmpeg.org/download.html
        pause
        exit /b 1
    )

    REM Install dependencies
    echo 📦 Installing dependencies...
    npm install

    REM Create directories
    if not exist "public\hls" mkdir "public\hls"
    if not exist "logs" mkdir "logs"

    REM Start the server
    echo 🚀 Starting streaming server...
    echo    Open your browser to: http://localhost:8000
    echo    Press Ctrl+C to stop the server
    echo.
    
    set PORT=8000
    node server_enhanced.js
)

pause
