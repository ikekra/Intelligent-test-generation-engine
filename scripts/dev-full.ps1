$ErrorActionPreference = 'Stop'

Write-Host "Starting frontend (vite) and backend (node server/index.js)..." -ForegroundColor Cyan

$cwd = Get-Location

Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command `"Set-Location '$cwd'; npm run dev:client`""
Start-Process powershell -ArgumentList "-ExecutionPolicy Bypass -NoExit -Command `"Set-Location '$cwd'; npm run dev:server`""

Write-Host "Launched. Frontend: http://localhost:5173  Backend: http://localhost:5174" -ForegroundColor Green
