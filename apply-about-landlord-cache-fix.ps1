$ErrorActionPreference = "Stop"

$path = Join-Path $PWD "app\(root)\properties\[id].tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "File not found: $path`nRun this script from the Nookly project root."
}

$text = (Get-Content -LiteralPath $path -Raw).Replace("`r`n", "`n")
$original = $text

$oldBlock = @'
  } = useAppwrite({
    fn: getPropertyById,
    params: { id: id! },
    skip: !id,
    cacheKey: `property_details_${id || "missing"}`,
    watchCollections: [config.propertiesCollectionId],
  }) as {
'@

$newBlock = @'
  } = useAppwrite({
    fn: ({ documentId }: { documentId: string }) =>
      getPropertyById({ id: documentId }),
    params: { documentId: id! },
    skip: !id,
    cacheKey: `property_details_complete_v2_${id || "missing"}`,
    watchCollections: [config.propertiesCollectionId],
  }) as {
'@

if (-not $text.Contains($oldBlock)) {
  throw "Could not find the Step 6 property-details cache block. No changes were written."
}

$text = $text.Replace($oldBlock, $newBlock)

if ($text -eq $original) {
  throw "No changes were made."
}

if ($text.Contains('cacheKey: `property_details_${id || "missing"}`')) {
  throw "Validation failed: old partial property cache key still exists."
}

if (-not $text.Contains('property_details_complete_v2_')) {
  throw "Validation failed: complete property cache key is missing."
}

if (-not $text.Contains('getPropertyById({ id: documentId })')) {
  throw "Validation failed: complete property fetch wrapper is missing."
}

Copy-Item -LiteralPath $path -Destination "$path.landlord-info-fix.bak" -Force
Set-Content -LiteralPath $path -Value $text -Encoding utf8

Write-Host ""
Write-Host "About Landlord cache fix applied successfully." -ForegroundColor Green
Write-Host "Updated: app/(root)/properties/[id].tsx"
Write-Host "Backup: [id].tsx.landlord-info-fix.bak"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
