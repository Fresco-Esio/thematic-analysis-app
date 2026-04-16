@echo off
title Thematic Analysis App
cd /d "%~dp0"

:: ── Check if the app is already running on port 3000 ──────────────────────────
powershell -NoProfile -Command ^
  "if (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }" ^
  >nul 2>&1

if %errorlevel% == 0 (
    echo Thematic Analysis App is already running.
    echo Opening browser...
    start "" "http://localhost:3000"
    exit /b 0
)

:: ── Start the dev server in its own window ─────────────────────────────────────
echo Starting Thematic Analysis App...
start "TA App — Dev Server" cmd /k "npm start"

:: ── Wait for port 3000 to accept connections (max 90 s) ───────────────────────
powershell -NoProfile -Command ^
  "$max=90; $i=0; Write-Host 'Waiting for server'; while ($i -lt $max) { try { $t=New-Object System.Net.Sockets.TcpClient; $t.Connect('localhost',3000); $t.Close(); break } catch {}; Start-Sleep 1; $i++; Write-Host -NoNewline '.' }" ^
  2>nul

:: ── Open the app in the default browser ────────────────────────────────────────
start "" "http://localhost:3000"
echo.
echo Thematic Analysis App is ready at http://localhost:3000
