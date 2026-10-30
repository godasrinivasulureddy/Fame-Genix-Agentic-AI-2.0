@echo off
title FAME-GENIX 2.0 Dual Launcher
echo ===================================================
echo   FAME-GENIX 2.0 — Dual Full-Stack Service Launcher
echo ===================================================
echo [1/2] Launching Backend Server on http://127.0.0.1:8000...
start "FAME-GENIX 2.0 Backend" cmd /k "%~dp0start_backend.bat"
timeout /t 3 /nobreak >nul
echo [2/2] Launching Frontend Server on http://localhost:3000...
start "FAME-GENIX 2.0 Frontend" cmd /k "%~dp0start_frontend.bat"
echo.
echo Both services are booting. Open http://localhost:3000 once Vite is ready.
