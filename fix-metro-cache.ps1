# Run this file from the Nookly project root.
# Example:
# powershell -ExecutionPolicy Bypass -File .\fix-metro-cache.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "Stopping stale Node/Expo processes..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "Removing project caches..." -ForegroundColor Cyan
$projectCaches = @(
  ".expo",
  ".metro-cache",
  "node_modules\.cache",
  "node_modules\.cache\metro"
)

foreach ($cache in $projectCaches) {
  if (Test-Path $cache) {
    Remove-Item $cache -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Removed $cache"
  }
}

Write-Host "Removing Windows Metro and haste-map caches..." -ForegroundColor Cyan
$tempPath = $env:TEMP
Get-ChildItem $tempPath -Force -ErrorAction SilentlyContinue |
  Where-Object {
    $_.Name -like "metro-cache*" -or
    $_.Name -like "haste-map*" -or
    $_.Name -like "react-native-packager-cache*"
  } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Checking installed Expo package alignment..." -ForegroundColor Cyan
npx expo-doctor

Write-Host ""
Write-Host "Starting Expo with a fresh Metro cache..." -ForegroundColor Green
npx expo start --clear
