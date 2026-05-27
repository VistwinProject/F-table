@echo off
title NFC Web Control

set "PATH=C:\nvm4w\nodejs;%PATH%"

echo.
echo  NFC Web Control v1.0
echo  ============================================================
echo.

python --version > nul 2>&1
if errorlevel 1 (
    echo  [ERROR] Python not found. Please install Python 3.11+
    pause
    exit /b 1
)

python -c "import smartcard" > nul 2>&1
if errorlevel 1 (
    echo  [SETUP] Installing pyscard and websockets...
    python -m pip install pyscard websockets
)

if not exist "%~dp0web\node_modules" (
    echo  [SETUP] Installing web packages...
    pushd "%~dp0web"
    npm.cmd install
    popd
)

echo  [1/3] Starting NFC server (Python)...
pushd "%~dp0server"
start "NFC Server" cmd /k python server.py
popd

echo  [2/3] Starting Vite dev server...
pushd "%~dp0web"
start "Web Dev" cmd /k npm.cmd run dev
popd

echo  [3/3] Waiting 6 seconds for servers to start...
timeout /t 6 /nobreak > nul

echo  Opening Chrome...
start chrome "http://localhost:5173"

echo.
echo  Both servers running in their own windows.
echo  Close those windows to stop.
echo.
pause
