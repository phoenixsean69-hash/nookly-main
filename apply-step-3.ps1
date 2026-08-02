$ErrorActionPreference = "Stop"

$tenantPath = Join-Path $PWD "app\(root)\(tabs)\tenantHome.tsx"
$explorePath = Join-Path $PWD "app\(root)\(tabs)\explore.tsx"

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path`nRun this script from the Nookly project root."
    }
}

function Replace-ExactBlock {
    param(
        [string]$Text,
        [string]$OldBlock,
        [string]$NewBlock,
        [string]$Label
    )

    if (-not $Text.Contains($OldBlock)) {
        throw "Could not locate expected block: $Label`nNo changes were written."
    }

    return $Text.Replace($OldBlock, $NewBlock)
}

Assert-FileExists -Path $tenantPath
Assert-FileExists -Path $explorePath

$tenantOriginal = Get-Content -LiteralPath $tenantPath -Raw
$exploreOriginal = Get-Content -LiteralPath $explorePath -Raw

$tenantUpdated = $tenantOriginal
$exploreUpdated = $exploreOriginal

# ---------------------------------------------------------------------------
# TENANT HOME
# Remove the filter ref that exists only to trigger a second forced request.
# The useAppwrite cache key already changes with the selected filter.
# ---------------------------------------------------------------------------
$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
  const lastNotificationsFetch = useRef(0);
  const lastFeaturedFetch = useRef(0);
  const filterRef = useRef(params.filter);
'@ `
    -NewBlock @'
  const lastNotificationsFetch = useRef(0);
  const lastFeaturedFetch = useRef(0);
'@ `
    -Label "Tenant Home filterRef declaration"

$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
  const {
    data: properties,
    refetch,
    loading,
  } = useAppwrite({
    fn: getAvailableProperties,
    params: { filter: params.filter || "", query: "", limit: 6 },
    cacheKey: `available_${params.filter || "all"}`,
    ttl: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (filterRef.current !== params.filter) {
      filterRef.current = params.filter;
      refetch({ filter: params.filter || "", query: "", limit: 6 });
    }
  }, [params.filter, refetch]);
'@ `
    -NewBlock @'
  const { data: properties, loading } = useAppwrite({
    fn: getAvailableProperties,
    params: { filter: params.filter || "", query: "", limit: 6 },
    cacheKey: `available_${params.filter || "all"}`,
  });
'@ `
    -Label "Tenant Home duplicate property refetch block"

# ---------------------------------------------------------------------------
# EXPLORE
# Remove the separate light map-pin query. The full map query already contains
# every coordinate needed for both the banner count and the map.
# ---------------------------------------------------------------------------
$exploreUpdated = Replace-ExactBlock `
    -Text $exploreUpdated `
    -OldBlock @'
  // Light pins for banner count - super fast
  const { data: mapPins } = useAppwrite({
    fn: async () => {
      const res = await getPropertiesWithFilters({
        filter: "",
        query: "",
        limit: 100,
        select: ["$id", "latitude", "longitude"],
      } as any);
      return res;
    },
    cacheKey: "map_pins_light",
    ttl: 10 * 60 * 1000,
  });

'@ `
    -NewBlock "" `
    -Label "Explore duplicate light map-pin query"

# Remove forced refetch on first mount and on each filter change.
$exploreUpdated = Replace-ExactBlock `
    -Text $exploreUpdated `
    -OldBlock @'
  const {
    data: properties,
    refetch,
    loading,
  } = useAppwrite({
    fn: (p: any) => getPropertiesWithFilters(p),
    params: filterParams,
    cacheKey,
    ttl: 60 * 1000,
  });

  const prevParamsRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(filterParams);
    if (prevParamsRef.current !== key) {
      prevParamsRef.current = key;
      refetch(filterParams);
    }
  }, [filterParams]);
'@ `
    -NewBlock @'
  const { data: properties, loading } = useAppwrite({
    fn: (p: any) => getPropertiesWithFilters(p),
    params: filterParams,
    cacheKey,
  });
'@ `
    -Label "Explore forced filter refetch block"

$exploreUpdated = Replace-ExactBlock `
    -Text $exploreUpdated `
    -OldBlock @'
              {mapPins?.length || allProperties?.length || 0} on Map
'@ `
    -NewBlock @'
              {allProperties?.length || 0} on Map
'@ `
    -Label "Explore map count"

$exploreUpdated = Replace-ExactBlock `
    -Text $exploreUpdated `
    -OldBlock @'
      mapPins,
      allProperties,
'@ `
    -NewBlock @'
      allProperties,
'@ `
    -Label "Explore ListHeader dependency"

# Remove the no-longer-needed TTL from the full map query. The Step 1 hook
# already keeps this cached until the properties collection changes.
$exploreUpdated = Replace-ExactBlock `
    -Text $exploreUpdated `
    -OldBlock @'
    cacheKey: "map_pins_full",
    ttl: 10 * 60 * 1000,
'@ `
    -NewBlock @'
    cacheKey: "map_pins_full",
'@ `
    -Label "Explore full-map TTL"

# Validate all intended changes before writing either file.
if ($tenantUpdated -eq $tenantOriginal) {
    throw "Tenant Home was not changed."
}

if ($exploreUpdated -eq $exploreOriginal) {
    throw "Explore was not changed."
}

if ($tenantUpdated.Contains("filterRef")) {
    throw "Tenant Home validation failed: filterRef still exists."
}

if ($tenantUpdated.Contains("refetch({ filter: params.filter")) {
    throw "Tenant Home validation failed: forced filter refetch still exists."
}

if ($exploreUpdated.Contains("map_pins_light")) {
    throw "Explore validation failed: duplicate map-pin query still exists."
}

if ($exploreUpdated.Contains("prevParamsRef")) {
    throw "Explore validation failed: forced filter refetch still exists."
}

# Back up original files once validation has passed.
Copy-Item -LiteralPath $tenantPath -Destination "$tenantPath.step3.bak" -Force
Copy-Item -LiteralPath $explorePath -Destination "$explorePath.step3.bak" -Force

Set-Content -LiteralPath $tenantPath -Value $tenantUpdated -Encoding utf8
Set-Content -LiteralPath $explorePath -Value $exploreUpdated -Encoding utf8

Write-Host ""
Write-Host "Step 3 applied successfully." -ForegroundColor Green
Write-Host "Updated:"
Write-Host "- app/(root)/(tabs)/tenantHome.tsx"
Write-Host "- app/(root)/(tabs)/explore.tsx"
Write-Host ""
Write-Host "Backups:"
Write-Host "- tenantHome.tsx.step3.bak"
Write-Host "- explore.tsx.step3.bak"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
