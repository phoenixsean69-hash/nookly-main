import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "app",
  "(root)",
  "properties",
  "[id].tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\nRun this script from the Nookly project root.`,
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

function replaceExact(oldBlock, newBlock, label) {
  if (!updated.includes(oldBlock)) {
    throw new Error(
      `Could not locate expected block: ${label}\nNo changes were written.`,
    );
  }

  updated = updated.replace(oldBlock, newBlock);
}

// ---------------------------------------------------------------------------
// 1. Remove local state used only by the direct tenant fetch.
// ---------------------------------------------------------------------------
replaceExact(
`  const [tenantsForProperty, setTenantsForProperty] = useState<
    TenantWithProfile[]
  >([]);
  const [loadingTenants, setLoadingTenants] = useState(false);
`,
``,
"Current tenants local state",
);

// ---------------------------------------------------------------------------
// 2. Remove the N+1 fetch function and its effect.
// ---------------------------------------------------------------------------
const fetchFunctionPattern =
  /  \/\/ ============================================================================\n  \/\/ FETCH TENANTS FOR PROPERTY\n  \/\/ ============================================================================\n  const fetchTenantsForProperty = async \(\) => \{[\s\S]*?\n  \};\n\n  \/\/ Handle tenant press - show details in alert/;

if (!fetchFunctionPattern.test(updated)) {
  throw new Error(
    "Could not locate the existing fetchTenantsForProperty function.",
  );
}

updated = updated.replace(
  fetchFunctionPattern,
  `  // Handle tenant press - show details in alert`,
);

const fetchEffectPattern =
  /  \/\/ Add this useEffect to fetch tenants when property loads and user is landlord\n  useEffect\(\(\) => \{\n    if \(property && user\?\.userMode === "landlord" && isLandlordOwner\) \{\n      fetchTenantsForProperty\(\);\n    \}\n  \}, \[property, user, isLandlordOwner\]\);\n\n/;

if (!fetchEffectPattern.test(updated)) {
  throw new Error(
    "Could not locate the existing current-tenants useEffect.",
  );
}

updated = updated.replace(fetchEffectPattern, "");

// ---------------------------------------------------------------------------
// 3. Insert a persistent, collection-aware batched query.
// ---------------------------------------------------------------------------
const ownerMarker = `  const isLandlordOwner =
    user?.userMode === "landlord" && property?.creatorId === user?.accountId;

  const priceHistory = buildPriceHistory(property);
`;

const cachedTenantsBlock = `  const isLandlordOwner =
    user?.userMode === "landlord" && property?.creatorId === user?.accountId;

  const {
    data: cachedTenantsForProperty,
    loading: cachedTenantsLoading,
  } = useAppwrite({
    fn: async (params: {
      propertyId: string;
    }): Promise<TenantWithProfile[]> => {
      const tenantProfiles = await databases.listDocuments(
        config.databaseId!,
        config.tenantProfilesCollectionId!,
        [
          Query.equal("currentProperty", params.propertyId),
          Query.limit(100),
        ],
      );

      if (tenantProfiles.documents.length === 0) {
        return [];
      }

      const userIds = [
        ...new Set(
          tenantProfiles.documents
            .map((profile) => String(profile.userId || "").trim())
            .filter(Boolean),
        ),
      ];

      if (userIds.length === 0) {
        return [];
      }

      const usersResult = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [
          Query.equal("accountId", userIds),
          Query.limit(Math.min(100, userIds.length)),
        ],
      );

      const usersByAccountId = new Map(
        usersResult.documents.map((userDocument) => [
          String(userDocument.accountId || ""),
          userDocument,
        ]),
      );

      return tenantProfiles.documents
        .map((profile) => {
          const userDocument = usersByAccountId.get(
            String(profile.userId || ""),
          );

          if (!userDocument) return null;

          return {
            userId: String(profile.userId || ""),
            name: userDocument.name || "Tenant",
            email: userDocument.email || "",
            phone: userDocument.phone || "",
            avatar:
              userDocument.avatar ||
              userDocument.customAvatar ||
              undefined,
            tenantScore: Number(profile.tenantScore || 0),
            isIdVerified: Boolean(profile.isIdVerified),
            currentProperty: profile.currentProperty,
            tenantProfileId: profile.$id,
          } satisfies TenantWithProfile;
        })
        .filter(
          (tenant): tenant is TenantWithProfile =>
            tenant !== null,
        );
    },
    params: {
      propertyId: property?.$id || "",
    },
    skip:
      !property?.$id ||
      user?.userMode !== "landlord" ||
      !isLandlordOwner,
    cacheKey: \`property_current_tenants_\${
      property?.$id || "missing"
    }\`,
    watchCollections: [
      config.tenantProfilesCollectionId,
      config.usersCollectionId,
    ],
  });

  const tenantsForProperty = cachedTenantsForProperty ?? [];
  const loadingTenants =
    cachedTenantsLoading && cachedTenantsForProperty === null;

  const priceHistory = buildPriceHistory(property);
`;

replaceExact(
  ownerMarker,
  cachedTenantsBlock,
  "Current tenants cached query insertion",
);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (updated === original) {
  throw new Error("No changes were made.");
}

if (updated.includes("fetchTenantsForProperty")) {
  throw new Error(
    "Validation failed: old tenant fetch function still exists.",
  );
}

if (updated.includes("setTenantsForProperty")) {
  throw new Error(
    "Validation failed: old tenant local state still exists.",
  );
}

if (!updated.includes("property_current_tenants_")) {
  throw new Error(
    "Validation failed: current-tenants cache key is missing.",
  );
}

if (!updated.includes('Query.equal("accountId", userIds)')) {
  throw new Error(
    "Validation failed: batched user lookup is missing.",
  );
}

if (
  !updated.includes("config.tenantProfilesCollectionId") ||
  !updated.includes("config.usersCollectionId")
) {
  throw new Error(
    "Validation failed: collection watches are incomplete.",
  );
}

const backupPath = `${targetPath}.step7.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Step 7 applied successfully.");
console.log("Updated: app/(root)/properties/[id].tsx");
console.log("Backup: [id].tsx.step7.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
