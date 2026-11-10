@echo off
title FAME GENIX Backend (FastAPI)
echo Starting FAME GENIX FastAPI Backend...
cd /d "%~dp0.."
python scripts\seed_demo.py
python run_server.py
pause
