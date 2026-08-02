$ErrorActionPreference = "Stop"

$tenantPath = Join-Path $PWD "app\(root)\(tabs)\tenantHome.tsx"
$landlordPath = Join-Path $PWD "app\(root)\(landlord)\landHome.tsx"

function Assert-FileExists {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "File not found: $Path`nRun this script from the Nookly project root."
    }
}

function Normalize-Newlines {
    param([string]$Text)
    return $Text.Replace("`r`n", "`n")
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
Assert-FileExists -Path $landlordPath

$tenantOriginalRaw = Get-Content -LiteralPath $tenantPath -Raw
$landlordOriginalRaw = Get-Content -LiteralPath $landlordPath -Raw

$tenantOriginal = Normalize-Newlines $tenantOriginalRaw
$landlordOriginal = Normalize-Newlines $landlordOriginalRaw

$tenantUpdated = $tenantOriginal
$landlordUpdated = $landlordOriginal

# TENANT HOME
$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
import {
  cleanupOldAppwriteNotifications,
  getAvailableProperties,
  getBestProperties,
} from "@/lib/appwrite";
'@ `
    -NewBlock @'
import {
  cleanupOldAppwriteNotifications,
  config,
  getAvailableProperties,
  getBestProperties,
} from "@/lib/appwrite";
'@ `
    -Label "Tenant Home Appwrite imports"

$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
const STALE_TIME = 5 * 60 * 1000;

const getGreeting = () => {
'@ `
    -NewBlock @'
const STALE_TIME = 5 * 60 * 1000;
const FEATURED_PROPERTIES_CACHE_KEY = "featured_properties_ranked_6";

const loadFeaturedProperties = async () => getBestProperties(6);

const getGreeting = () => {
'@ `
    -Label "Tenant Home featured constants"

$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
  const { user } = useAuthStore();
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingAvatar, setLoadingAvatar] = useState(true);
'@ `
    -NewBlock @'
  const { user } = useAuthStore();
  const [loadingAvatar, setLoadingAvatar] = useState(true);
'@ `
    -Label "Tenant Home featured state"

$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
  const lastNotificationsFetch = useRef(0);
  const lastFeaturedFetch = useRef(0);
'@ `
    -NewBlock @'
  const lastNotificationsFetch = useRef(0);
'@ `
    -Label "Tenant Home featured timestamp"

$tenantUpdated = Replace-ExactBlock `
    -Text $tenantUpdated `
    -OldBlock @'
  const fetchBestProperties = useCallback(async () => {
    const now = Date.now();
    if (
      now - lastFeaturedFetch.current < STALE_TIME &&
      featuredProperties.length > 0
    ) {
      setLoadingFeatured(false);
      return;
    }
    try {
      setLoadingFeatured(true);
      const best = await getBestProperties(6);
      setFeaturedProperties(best);
      lastFeaturedFetch.current = now;
    } catch {
      setFeaturedProperties([]);
    } finally {
      setLoadingFeatured(false);
    }
  }, []);

  useEffect(() => {
    fetchBestProperties();
  }, [fetchBestProperties]);

  const { data: properties, loading } = useAppwrite({
'@ `
    -NewBlock @'
  const {
    data: featuredPropertyData,
    loading: featuredPropertiesLoading,
  } = useAppwrite({
    fn: loadFeaturedProperties,
    params: {},
    cacheKey: FEATURED_PROPERTIES_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const featuredProperties = featuredPropertyData ?? [];
  const loadingFeatured =
    featuredPropertiesLoading && featuredPropertyData === null;

  const { data: properties, loading } = useAppwrite({
'@ `
    -Label "Tenant Home featured fetch"

# LANDLORD HOME
$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
import {
  getAvailableProperties,
  getBestProperties,
  getLatestProperties,
} from "@/lib/appwrite";
'@ `
    -NewBlock @'
import {
  config,
  getAvailableProperties,
  getBestProperties,
  getLatestProperties,
} from "@/lib/appwrite";
'@ `
    -Label "Landlord Home Appwrite imports"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
const STALE_TIME = 5 * 60 * 1000; // 5 minutes

const getGreeting = () => {
'@ `
    -NewBlock @'
const STALE_TIME = 5 * 60 * 1000; // Notification badge only
const FEATURED_PROPERTIES_CACHE_KEY = "featured_properties_ranked_6";

const loadFeaturedProperties = async () => getBestProperties(6);

const getGreeting = () => {
'@ `
    -Label "Landlord Home featured constants"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
'@ `
    -NewBlock @'
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
'@ `
    -Label "Landlord Home featured state"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
  // Track last fetch times to prevent spam
  const lastNotificationsFetch = useRef<number>(0);
  const lastFeaturedFetch = useRef<number>(0);
  const backPressCountRef = useRef(0);
'@ `
    -NewBlock @'
  // Notification badge timestamp only
  const lastNotificationsFetch = useRef<number>(0);
  const backPressCountRef = useRef(0);
'@ `
    -Label "Landlord Home featured timestamp"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
  // Get landlord's own properties
  const {
'@ `
    -NewBlock @'
  const {
    data: featuredPropertyData,
    loading: featuredPropertiesLoading,
    refetch: refetchFeaturedProperties,
  } = useAppwrite({
    fn: loadFeaturedProperties,
    params: {},
    cacheKey: FEATURED_PROPERTIES_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const featuredProperties = (featuredPropertyData ?? []).slice(0, 5);
  const loadingFeatured =
    featuredPropertiesLoading && featuredPropertyData === null;

  // Get landlord's own properties
  const {
'@ `
    -Label "Landlord Home featured query"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
          fetchBestProperties(true), // force refresh featured
          loadNotifications(user.accountId),
'@ `
    -NewBlock @'
          refetchFeaturedProperties(),
          loadNotifications(user.accountId),
'@ `
    -Label "Landlord Home pull refresh"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
        lastNotificationsFetch.current = now;
        lastFeaturedFetch.current = now;
        console.log("✅ Manual refresh completed");
'@ `
    -NewBlock @'
        lastNotificationsFetch.current = now;
        console.log("✅ Manual refresh completed");
'@ `
    -Label "Landlord Home refresh timestamp"

$landlordUpdated = Replace-ExactBlock `
    -Text $landlordUpdated `
    -OldBlock @'
  // Fetch best properties with stale check
  const fetchBestProperties = async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFeaturedFetch.current < STALE_TIME) {
      console.log("⏭️ Skipping featured fetch - data fresh");
      setLoadingFeatured(false);
      return;
    }

    try {
      setLoadingFeatured(true);
      const best = await getBestProperties(5);
      setFeaturedProperties(best);
      lastFeaturedFetch.current = now;
    } catch (error) {
      console.error("Error fetching best properties:", error);
      const allLatest = await getLatestProperties();
      const filtered = allLatest.filter((p) => p.isAvailable === true);
      setFeaturedProperties(filtered.slice(0, 5));
    } finally {
      setLoadingFeatured(false);
    }
  };

  useEffect(() => {
    fetchBestProperties();
  }, []);

'@ `
    -NewBlock "" `
    -Label "Landlord Home featured fetch"

# VALIDATE BEFORE WRITING
if ($tenantUpdated -eq $tenantOriginal) {
    throw "Tenant Home was not changed."
}

if ($landlordUpdated -eq $landlordOriginal) {
    throw "Landlord Home was not changed."
}

$forbiddenTokens = @(
    "lastFeaturedFetch",
    "setFeaturedProperties",
    "setLoadingFeatured",
    "fetchBestProperties"
)

foreach ($token in $forbiddenTokens) {
    if ($tenantUpdated.Contains($token)) {
        throw "Tenant Home validation failed: $token still exists."
    }

    if ($landlordUpdated.Contains($token)) {
        throw "Landlord Home validation failed: $token still exists."
    }
}

if (-not $tenantUpdated.Contains('cacheKey: FEATURED_PROPERTIES_CACHE_KEY')) {
    throw "Tenant Home validation failed: featured cache key missing."
}

if (-not $landlordUpdated.Contains('cacheKey: FEATURED_PROPERTIES_CACHE_KEY')) {
    throw "Landlord Home validation failed: featured cache key missing."
}

Copy-Item -LiteralPath $tenantPath -Destination "$tenantPath.step4.bak" -Force
Copy-Item -LiteralPath $landlordPath -Destination "$landlordPath.step4.bak" -Force

Set-Content -LiteralPath $tenantPath -Value $tenantUpdated -Encoding utf8
Set-Content -LiteralPath $landlordPath -Value $landlordUpdated -Encoding utf8

Write-Host ""
Write-Host "Step 4 applied successfully." -ForegroundColor Green
Write-Host "Updated:"
Write-Host "- app/(root)/(tabs)/tenantHome.tsx"
Write-Host "- app/(root)/(landlord)/landHome.tsx"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
