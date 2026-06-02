@echo off
setlocal enabledelayedexpansion
title F-table - Stop servers
echo Stopping F-table servers...

for %%P in (8787 5173) do (
  for /f "tokens=5" %%I in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo   - stopping port %%P  ^(PID %%I^)
    taskkill /PID %%I /F >nul 2>&1
  )
)

echo Done. Close the Chrome window manually if needed (Alt+F4).
timeout /t 3 >nul
exit /b 0
