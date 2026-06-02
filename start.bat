@echo off
setlocal
title F-table Control Tower - Launcher
cd /d "%~dp0"

echo ============================================================
echo   F-table  AI Control Tower  -  starting
echo ============================================================
echo.

REM ---- locate Node.js ----
call :find_node
if not defined NODE_DIR (
  echo [ERROR] Node.js not found. Run setup.bat first.
  pause & exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"

REM ---- deps installed? ----
if not exist "web\node_modules" (
  echo [!] Web packages not installed yet. Run setup.bat first.
  pause & exit /b 1
)

echo [1/3] Starting NFC server  (Python, port 8787)...
start "NFC Server (8787)" /D "%~dp0server" cmd /k python server.py

echo [2/3] Starting web front-end (Vite, port 5173)...
start "Web (5173)" /D "%~dp0web" cmd /k npm.cmd run dev

echo [3/3] Waiting ~7s for servers to come up...
REM ping is used instead of timeout so the delay works even when this script
REM is launched with redirected stdin (timeout fails in that case).
ping -n 8 127.0.0.1 >nul

echo Opening Chrome in fullscreen...
start chrome --new-window --start-fullscreen "http://localhost:5173"

echo.
echo ============================================================
echo   Running.
echo     - URL: http://localhost:5173
echo     - Two black windows are the servers; close them (or run
echo       stop.bat) to stop everything.
echo     - Chrome: F11 exits fullscreen, Alt+F4 closes.
echo ============================================================
ping -n 5 127.0.0.1 >nul
exit /b 0

:find_node
set "NODE_DIR="
where node >nul 2>&1
if %errorlevel%==0 (
  for /f "delims=" %%i in ('where node') do (
    set "NODE_DIR=%%~dpi"
    goto :find_node_done
  )
)
if exist "C:\nvm4w\nodejs\node.exe" set "NODE_DIR=C:\nvm4w\nodejs"
if not defined NODE_DIR if exist "C:\Program Files\nodejs\node.exe" set "NODE_DIR=C:\Program Files\nodejs"
:find_node_done
goto :eof
