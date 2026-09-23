# Start the Aladdin local analysis worker (Sprint 5B).
#
# Picks up analyses queued from the Railway site with "Run on my PC" and runs
# them here on Ollama. Needs backend\.env with the same DATABASE_URL as Railway.
#
# Manual:            powershell -ExecutionPolicy Bypass -File E:\Aladdin\backend\scripts\start-worker.ps1
# At log-on (once):  see docs/local-llm-ollama-setup.md, "Run analyses queued from Railway".
#
# Restarts the worker if it exits with an error (e.g. database briefly unreachable).

$ErrorActionPreference = "Stop"
$backend = Split-Path -Parent $PSScriptRoot
Set-Location $backend

$python = Join-Path $backend ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Error "No venv at $python. Create it first: py -3.11 -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt"
}

while ($true) {
    & $python -m app.worker
    if ($LASTEXITCODE -eq 0) { break }   # stopped with Ctrl+C
    Write-Host "Worker exited with code $LASTEXITCODE; restarting in 30 s (Ctrl+C to stop)."
    Start-Sleep -Seconds 30
}
