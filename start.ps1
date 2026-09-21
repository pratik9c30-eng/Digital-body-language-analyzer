$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { $python = 'python' }
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\server'; & '$python' -m uvicorn main:app --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$root\client'; npm.cmd run dev -- --host 0.0.0.0"