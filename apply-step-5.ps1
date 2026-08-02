$ErrorActionPreference = "Stop"

$path = Join-Path $PWD "app\(root)\(landlord)\landHome.tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "File not found: $path`nRun this script from the Nookly project root."
}

$text = (Get-Content -LiteralPath $path -Raw).Replace("`r`n", "`n")
$original = $text

function Replace-Regex {
  param(
    [string]$InputText,
    [string]$Pattern,
    [string]$Replacement,
    [string]$Label
  )

  $updated = [regex]::Replace(
    $InputText,
    $Pattern,
    $Replacement,
    [System.Text.RegularExpressions.RegexOptions]::Singleline
  )

  if ($updated -eq $InputText) {
    throw "Could not locate expected block: $Label`nNo changes were written."
  }

  return $updated
}

# Remove forced property refetches after returning from Add Property.
# Realtime already invalidates all active property queries.
$text = Replace-Regex `
  -InputText $text `
  -Pattern '(?s)\s*// Only refetch properties if explicitly requested via params\s*if \(params\.refresh === "true" && user\?\.accountId\) \{.*?setTimeout\(\(\) => \{\s*router\.setParams\(\{\}\);\s*\}, 100\);\s*\}' `
  -Replacement @'

      // The property collection Realtime event updates cached property queries.
      // Only clear the navigation flag so it cannot retrigger on focus.
      if (params.refresh === "true") {
        setTimeout(() => {
          router.setParams({});
        }, 100);
      }
'@ `
  -Label "Landlord post-create forced refetch"

$text = $text.Replace(
  '    }, [userId, params.refresh, user?.accountId, params.filter]),',
  '    }, [userId, params.refresh]),'
)

# Remove the forced property refetch that runs whenever the filter changes.
$text = Replace-Regex `
  -InputText $text `
  -Pattern '(?s)\s*// Refetch when filter changes\s*const filterRef = useRef\(params\.filter\);\s*useEffect\(\(\) => \{\s*if \(filterRef\.current !== params\.filter && user\?\.accountId\) \{\s*filterRef\.current = params\.filter;\s*refetchMyProperties\(\{.*?\}\);\s*\}\s*\}, \[params\.filter, user\?\.accountId\]\);' `
  -Replacement "" `
  -Label "Landlord filter forced refetch"

# Give the landlord property query a stable, account-scoped cache identity.
$oldQueryTail = @'
    },
    skip: !user?.accountId,
  });
'@

$newQueryTail = @'
    },
    skip: !user?.accountId,
    cacheKey: `landlord_properties_${user?.accountId || "anonymous"}_${params.filter || "all"}`,
    watchCollections: [config.propertiesCollectionId],
  });
'@

$firstIndex = $text.IndexOf($oldQueryTail)
if ($firstIndex -lt 0) {
  throw "Could not locate landlord property query tail."
}

# Replace the first matching query tail after the own-properties declaration.
$ownMarker = "// Get landlord's own properties"
$markerIndex = $text.IndexOf($ownMarker)
if ($markerIndex -lt 0) {
  throw "Could not locate landlord own-properties query."
}

$queryTailIndex = $text.IndexOf($oldQueryTail, $markerIndex)
if ($queryTailIndex -lt 0) {
  throw "Could not locate landlord own-properties query tail."
}

$text = $text.Remove($queryTailIndex, $oldQueryTail.Length).Insert(
  $queryTailIndex,
  $newQueryTail
)

# Validation
if ($text -eq $original) {
  throw "No changes were made."
}

if ($text.Contains("filterRef")) {
  throw "Validation failed: filterRef still exists."
}

if ($text.Contains("Refreshing properties after adding new listing")) {
  throw "Validation failed: post-create forced refresh still exists."
}

if (-not $text.Contains('cacheKey: `landlord_properties_')) {
  throw "Validation failed: landlord cache key is missing."
}

if (-not $text.Contains("watchCollections: [config.propertiesCollectionId]")) {
  throw "Validation failed: property collection watch is missing."
}

Copy-Item -LiteralPath $path -Destination "$path.step5.bak" -Force
Set-Content -LiteralPath $path -Value $text -Encoding utf8

Write-Host ""
Write-Host "Step 5 applied successfully." -ForegroundColor Green
Write-Host "Updated: app/(root)/(landlord)/landHome.tsx"
Write-Host "Backup: landHome.tsx.step5.bak"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
