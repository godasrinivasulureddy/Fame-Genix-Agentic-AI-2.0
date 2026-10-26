@echo off
title FAME GENIX Frontend (Vite)
echo Starting FAME GENIX React Frontend...
cd /d "%~dp0frontend"
if not exist node_modules (
  echo Installing frontend dependencies...
  npm install
)
npm run dev -- --host 127.0.0.1 --port 3000
pause
