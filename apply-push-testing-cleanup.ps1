$ErrorActionPreference = "Stop"

$root = Get-Location
$nodeScript = Join-Path $root "cleanup-push-testing.mjs"
$readmePath = Join-Path $root "README.txt"
$selfPath = $MyInvocation.MyCommand.Path

if (-not (Test-Path $nodeScript)) {
    throw "cleanup-push-testing.mjs was not found. Extract the ZIP into the Nookly project root first."
}

node $nodeScript

if ($LASTEXITCODE -ne 0) {
    throw "Push testing cleanup failed. The cleanup files were kept for inspection."
}

Remove-Item $nodeScript -Force -ErrorAction SilentlyContinue

if (Test-Path $readmePath) {
    $readmeContent = Get-Content $readmePath -Raw
    if ($readmeContent -match "NOOKLY.+PUSH TESTING CLEANUP") {
        Remove-Item $readmePath -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Temporary cleanup package files removed." -ForegroundColor Green
Write-Host "Now run: npx tsc --noEmit" -ForegroundColor Cyan

# Remove this runner after the current PowerShell process has released it.
$escapedSelf = $selfPath.Replace('"', '""')
Start-Process -WindowStyle Hidden -FilePath "cmd.exe" -ArgumentList "/c", "ping 127.0.0.1 -n 2 > nul & del /f /q \"$escapedSelf\"" | Out-Null
