@echo off
title Denika WMS Launcher
echo ============================================================
echo  Denika ^& Team Solutions - Local Launcher (No Docker)
echo ============================================================
echo.

echo [1/3] Launching YOLO Vision Service on http://127.0.0.1:8001 ...
start "YOLO Vision Service (8001)" cmd /k "cd /d ""%~dp0ai-model"" && call .venv\Scripts\activate.bat && uvicorn api:app --host 127.0.0.1 --port 8001"

echo [2/3] Launching Express Backend on http://localhost:5000 ...
start "Backend API (5000)" cmd /k "cd /d ""%~dp0backend"" && npm run dev"

echo [3/3] Launching Vite Frontend on http://localhost:5173 ...
start "Frontend Web App (5173)" cmd /k "cd /d ""%~dp0frontend\warehouse-system"" && npm run dev"

echo.
echo ============================================================
echo  All 3 services have started in separate terminal windows!
echo  - Frontend UI:  http://localhost:5173
echo  - Backend API:  http://localhost:5000/api
echo  - Health Check: http://localhost:5000/api/health
echo  - YOLO Vision:  http://127.0.0.1:8001/health
echo ============================================================
pause

