@echo off
setlocal
title F-table Desktop - Setup (run once per machine)
cd /d "%~dp0"

echo ============================================================
echo   F-table Desktop  -  SETUP
echo   Run this once on each new computer.
echo ============================================================
echo.

REM ---- locate Node.js ----
call :find_node
if not defined NODE_DIR (
  echo [ERROR] Node.js not found.
  echo         Install Node 18+ from https://nodejs.org
  echo         then reopen this window and run setup.bat again.
  pause & exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
echo [OK] Node.js:
node --version

REM ---- check Python ----
python --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found.
  echo         Install Python 3.11+ from https://python.org
  echo         IMPORTANT: tick "Add Python to PATH" during install,
  echo         then reopen this window and run setup.bat again.
  pause & exit /b 1
)
echo [OK] Python:
python --version
echo.

echo [1/2] Installing Python packages (pyscard, websockets)...
python -m pip install --upgrade pip >nul 2>&1
python -m pip install pyscard websockets
if errorlevel 1 (
  echo [ERROR] pip install failed - see messages above.
  pause & exit /b 1
)
echo.

echo [2/2] Installing web packages (npm install - first run is slow)...
pushd web
call npm.cmd install
set "NPM_ERR=%errorlevel%"
popd
if not "%NPM_ERR%"=="0" (
  echo [ERROR] npm install failed.
  pause & exit /b 1
)

echo.
echo ============================================================
echo   Setup complete. From now on just run start.bat
echo ============================================================
pause
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
