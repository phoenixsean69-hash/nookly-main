$ErrorActionPreference = "Stop"

$root = Get-Location
$functionFolder = Join-Path $root "functions\nookly-push-api"
$output = Join-Path $root "nookly-push-api-v1.3.0-deploy.zip"

if (-not (Test-Path $functionFolder)) {
    throw "Function folder not found: $functionFolder"
}

if (-not (Test-Path (Join-Path $functionFolder "src\main.js"))) {
    throw "Function entry file not found."
}

if (Test-Path $output) {
    Remove-Item $output -Force
}

Compress-Archive `
    -Path (Join-Path $functionFolder "*") `
    -DestinationPath $output `
    -CompressionLevel Optimal

Write-Host ""
Write-Host "Function deployment ZIP created:" -ForegroundColor Green
Write-Host $output
Write-Host ""
Write-Host "Upload this ZIP as a new deployment for Function:"
Write-Host "6a31d988001bf962fb57"
Write-Host ""
Write-Host "Entrypoint: src/main.js"
