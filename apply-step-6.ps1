$ErrorActionPreference = "Stop"

$path = Join-Path $PWD "app\(root)\properties\[id].tsx"

if (-not (Test-Path -LiteralPath $path)) {
  throw "File not found: $path`nRun this script from the Nookly project root."
}

$text = (Get-Content -LiteralPath $path -Raw).Replace("`r`n", "`n")
$original = $text

function Replace-ExactBlock {
  param(
    [string]$InputText,
    [string]$OldBlock,
    [string]$NewBlock,
    [string]$Label
  )

  if (-not $InputText.Contains($OldBlock)) {
    throw "Could not locate expected block: $Label`nNo changes were written."
  }

  return $InputText.Replace($OldBlock, $NewBlock)
}

# ---------------------------------------------------------------------------
# 1. Give the property document a stable persistent cache identity.
# ---------------------------------------------------------------------------
$text = Replace-ExactBlock `
  -InputText $text `
  -OldBlock @'
  } = useAppwrite({
    fn: getPropertyById,
    params: { id: id! },
  }) as {
'@ `
  -NewBlock @'
  } = useAppwrite({
    fn: getPropertyById,
    params: { id: id! },
    skip: !id,
    cacheKey: `property_details_${id || "missing"}`,
    watchCollections: [config.propertiesCollectionId],
  }) as {
'@ `
  -Label "Property details persistent query"

# ---------------------------------------------------------------------------
# 2. Remove the immediate view write.
#    The existing 10-second/day-controlled view write remains below.
# ---------------------------------------------------------------------------
$text = Replace-ExactBlock `
  -InputText $text `
  -OldBlock @'
  const scale = useSharedValue(1);
  const viewRecorded = useRef(false);

'@ `
  -NewBlock @'
  const scale = useSharedValue(1);

'@ `
  -Label "Duplicate view ref declaration"

$text = Replace-ExactBlock `
  -InputText $text `
  -OldBlock @'
  useEffect(() => {
    if (
      property &&
      (user?.userMode === "tenant" || user?.userMode === "student") &&
      !viewRecorded.current
    ) {
      viewRecorded.current = true;

      incrementPropertyViews(property.$id, user.accountId).catch(console.error);

      const recordLocalView = async () => {
        const key = `user_viewed_properties_${user.accountId}`;
        const stored = await AsyncStorage.getItem(key);
        let viewed = stored ? JSON.parse(stored) : [];
        if (!viewed.includes(property.$id)) {
          viewed.push(property.$id);
          await AsyncStorage.setItem(key, JSON.stringify(viewed));
        }
      };
      recordLocalView().catch(console.error);
    }
  }, [property, user]);

'@ `
  -NewBlock "" `
  -Label "Immediate duplicate property view write"

# ---------------------------------------------------------------------------
# 3. Replace the always-fresh request-status query with persistent,
#    request-collection-aware cached state.
# ---------------------------------------------------------------------------
$text = Replace-ExactBlock `
  -InputText $text `
  -OldBlock @'
  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!property || !user?.accountId) return;

      try {
        const requestsResult = await databases.listDocuments(
          config.databaseId!,
          config.requestsCollectionId!,
          [
            Query.equal("propertyId", property.$id),
            Query.equal("tenantId", user.accountId),
            Query.limit(1),
          ],
        );

        if (requestsResult.documents.length > 0) {
          const status = requestsResult.documents[0].status;
          setRequestStatus(status);
          setHasRequested(status !== "rejected");
        }
      } catch (error) {
        console.error("Error checking request status:", error);
      }
    };

    checkRequestStatus();
  }, [property, user]);

'@ `
  -NewBlock @'
  const { data: cachedRequestStatus } = useAppwrite({
    fn: async (params: {
      propertyId: string;
      tenantId: string;
    }): Promise<"none" | "pending" | "accepted" | "rejected"> => {
      const requestsResult = await databases.listDocuments(
        config.databaseId!,
        config.requestsCollectionId!,
        [
          Query.equal("propertyId", params.propertyId),
          Query.equal("tenantId", params.tenantId),
          Query.limit(1),
        ],
      );

      const status = String(
        requestsResult.documents[0]?.status || "none",
      ).toLowerCase();

      return status === "pending" ||
        status === "accepted" ||
        status === "rejected"
        ? status
        : "none";
    },
    params: {
      propertyId: property?.$id || "",
      tenantId: user?.accountId || "",
    },
    skip: !property?.$id || !user?.accountId,
    cacheKey: `property_request_status_${property?.$id || "missing"}_${
      user?.accountId || "anonymous"
    }`,
    watchCollections: [config.requestsCollectionId],
  });

  useEffect(() => {
    if (cachedRequestStatus === null) return;

    setRequestStatus(cachedRequestStatus);
    setHasRequested(
      cachedRequestStatus !== "none" &&
        cachedRequestStatus !== "rejected",
    );
  }, [cachedRequestStatus]);

'@ `
  -Label "Request status cached query"

# ---------------------------------------------------------------------------
# 4. Replace repeated like-status reads with a persistent cached summary.
#    The two cold-start reads run in parallel, then remain cached until a like
#    row changes.
# ---------------------------------------------------------------------------
$text = Replace-ExactBlock `
  -InputText $text `
  -OldBlock @'
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (property && user?.accountId) {
        try {
          const userLiked = await checkUserLiked(property.$id, user.accountId);
          const count = await getLikeCount(property.$id);
          setLiked(userLiked);
          setLikeCount(count);
        } catch (error) {
          console.error("Error checking like status:", error);
        }
      }
    };

    checkLikeStatus();
  }, [property, user]);

'@ `
  -NewBlock @'
  const { data: cachedLikeSummary } = useAppwrite({
    fn: async (params: {
      propertyId: string;
      userId: string;
    }) => {
      const [userLiked, count] = await Promise.all([
        checkUserLiked(params.propertyId, params.userId),
        getLikeCount(params.propertyId),
      ]);

      return {
        liked: userLiked,
        likeCount: count,
      };
    },
    params: {
      propertyId: property?.$id || "",
      userId: user?.accountId || "",
    },
    skip: !property?.$id || !user?.accountId,
    cacheKey: `property_like_summary_${property?.$id || "missing"}_${
      user?.accountId || "anonymous"
    }`,
    watchCollections: [config.likesCollectionId],
  });

  useEffect(() => {
    if (!cachedLikeSummary) return;

    setLiked(cachedLikeSummary.liked);
    setLikeCount(cachedLikeSummary.likeCount);
  }, [cachedLikeSummary]);

'@ `
  -Label "Like summary cached query"

# ---------------------------------------------------------------------------
# Validation before writing.
# ---------------------------------------------------------------------------
if ($text -eq $original) {
  throw "No changes were made."
}

if ($text.Contains("viewRecorded")) {
  throw "Validation failed: duplicate immediate-view logic still exists."
}

if (-not $text.Contains('cacheKey: `property_details_')) {
  throw "Validation failed: property details cache key is missing."
}

if (-not $text.Contains('cacheKey: `property_request_status_')) {
  throw "Validation failed: request-status cache key is missing."
}

if (-not $text.Contains('cacheKey: `property_like_summary_')) {
  throw "Validation failed: like-summary cache key is missing."
}

if (-not $text.Contains("watchCollections: [config.requestsCollectionId]")) {
  throw "Validation failed: request collection watch is missing."
}

if (-not $text.Contains("watchCollections: [config.likesCollectionId]")) {
  throw "Validation failed: likes collection watch is missing."
}

if ($text.Contains("const checkLikeStatus = async")) {
  throw "Validation failed: old like-status fetch still exists."
}

if ($text.Contains("const checkRequestStatus = async")) {
  throw "Validation failed: old request-status fetch still exists."
}

Copy-Item -LiteralPath $path -Destination "$path.step6.bak" -Force
Set-Content -LiteralPath $path -Value $text -Encoding utf8

Write-Host ""
Write-Host "Step 6 applied successfully." -ForegroundColor Green
Write-Host "Updated: app/(root)/properties/[id].tsx"
Write-Host "Backup: [id].tsx.step6.bak"
Write-Host ""
Write-Host "Now run: npx tsc --noEmit"
