@echo off
echo Starting FireShield AI Backend...
start "FireShield Backend" cmd /k "cd fireshield-backend && python -m uvicorn main:app --reload --port 8001"

echo Starting FireShield AI Frontend...
start "FireShield Frontend" cmd /k "cd fireshield-frontend && npm install && npm run dev"

echo Both services have been launched in separate terminal windows.
echo Frontend: http://localhost:5173
echo Backend: http://127.0.0.1:8001
pause
