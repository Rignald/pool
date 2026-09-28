@echo off
title Pool en Biljart Scoreboard Server
echo ========================================================
echo   Pool ^& Biljart Scoreboard - Starten...
echo ========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
