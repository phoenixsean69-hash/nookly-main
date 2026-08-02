$ErrorActionPreference = "Stop"

$root = Get-Location
$functionFolder = Join-Path $root "functions\nookly-push-api"
$output = Join-Path $root "nookly-push-api-v1.4.0-deploy.tar.gz"

if (-not (Test-Path $functionFolder)) {
    throw "Function folder not found: $functionFolder"
}

if (-not (Test-Path (Join-Path $functionFolder "src\main.js"))) {
    throw "Function entry file not found."
}

if (Test-Path $output) {
    Remove-Item $output -Force
}

tar.exe -czf $output -C $functionFolder .

if (-not (Test-Path $output)) {
    throw "The Function deployment archive was not created."
}

Write-Host ""
Write-Host "Function deployment archive created:" -ForegroundColor Green
Write-Host $output
Write-Host ""
Write-Host "Upload it to Function 6a31d988001bf962fb57"
Write-Host "Entrypoint: src/main.js"
