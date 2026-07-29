#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const filesRoot = path.join(root, "nookly-stability-hotfix-files");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".nookly-backups", `stability-hotfix-${timestamp}`);

const touchedFiles = [
  "lib/poiService.ts",
  "hooks/usePOIs.ts",
  "components/AmenitiesBadge.tsx",
  "components/MapLayers.tsx",
  "lib/appwrite.ts",
  "store/auth.store.ts",
  "app/(auth)/sign-in.tsx",
  "app/_layout.tsx",
  "app/(root)/(tabs)/_layout.tsx",
  "app/(root)/(student)/_layout.tsx",
  "app/(root)/(landlord)/_layout.tsx",
  "app/(root)/properties/[id].tsx",
];

const replacementFiles = [
  "lib/poiService.ts",
  "hooks/usePOIs.ts",
  "components/AmenitiesBadge.tsx",
  "components/MapLayers.tsx",
];

const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const write = (relativePath, content) =>
  writeFile(path.join(root, relativePath), content, "utf8");

const replaceOnce = (content, search, replacement, label) => {
  if (content.includes(replacement)) return content;
  const index = content.indexOf(search);
  if (index < 0) throw new Error(`Could not find ${label}.`);
  return content.slice(0, index) + replacement + content.slice(index + search.length);
};

const replaceBetween = (content, startMarker, endMarker, replacement, label) => {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not find ${label}.`);
  return content.slice(0, start) + replacement + content.slice(end);
};

const backupFiles = async () => {
  for (const relativePath of touchedFiles) {
    const source = path.join(root, relativePath);
    const destination = path.join(backupRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
};

const copyReplacementFiles = async () => {
  for (const relativePath of replacementFiles) {
    const source = path.join(filesRoot, relativePath);
    const destination = path.join(root, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
    console.log(`✓ Replaced ${relativePath}`);
  }
};

const patchAppwrite = async () => {
  const relativePath = "lib/appwrite.ts";
  let content = await read(relativePath);

  content = replaceOnce(
    content,
    `  landlordsCollectionId:\n    process.env.EXPO_PUBLIC_APPWRITE_LANDLORDS_COLLECTION_ID,`,
    `  landlordsCollectionId:\n    process.env.EXPO_PUBLIC_APPWRITE_LANDLORDS_COLLECTION_ID ||\n    process.env.EXPO_PUBLIC_APPWRITE_AGENTS_COLLECTION_ID,`,
    "the landlord/agent collection configuration",
  );

  const robustFunction = `export async function getPropertyById({ id }: { id: string }) {
  try {
    const property = await databases.getDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      id,
    );

    type OwnerProfile = {
      $id: string;
      name: string;
      email: string;
      phone?: string | null;
      avatar?: string | null;
      isOrganization?: boolean;
    };

    const mapOwner = (document: any, isOrganization = false): OwnerProfile => ({
      $id: document?.$id || document?.accountId || "",
      name:
        document?.name ||
        document?.T_name ||
        document?.organizationName ||
        "Property Owner",
      email: document?.email || "Contact details unavailable",
      phone: document?.phone || document?.T_phone || null,
      avatar: document?.avatar || null,
      ...(isOrganization ? { isOrganization: true } : {}),
    });

    const safeGet = async (collectionId: string | undefined, documentId: string) => {
      if (!collectionId || !documentId) return null;
      try {
        return await databases.getDocument(
          config.databaseId!,
          collectionId,
          documentId,
        );
      } catch {
        return null;
      }
    };

    const safeFind = async (
      collectionId: string | undefined,
      field: string,
      value: string,
    ) => {
      if (!collectionId || !value) return null;
      try {
        const response = await databases.listDocuments(
          config.databaseId!,
          collectionId,
          [Query.equal(field, value), Query.limit(1)],
        );
        return response.documents[0] ?? null;
      } catch {
        return null;
      }
    };

    const findUserDocument = async (reference: string) =>
      (await safeGet(config.usersCollectionId, reference)) ||
      (await safeFind(config.usersCollectionId, "accountId", reference));

    const findOrganization = async (references: string[]) => {
      for (const reference of references) {
        const organization = await safeFind(
          config.organizationsCollectionId,
          "userId",
          reference,
        );
        if (organization) return organization;
      }
      return null;
    };

    const findLandlordProfile = async (reference: string) => {
      const direct = await safeGet(config.landlordsCollectionId, reference);
      if (direct) return direct;

      for (const field of ["userDocId", "userId", "accountId"]) {
        const profile = await safeFind(
          config.landlordsCollectionId,
          field,
          reference,
        );
        if (profile) return profile;
      }
      return null;
    };

    const embeddedAgent =
      property.agent && typeof property.agent === "object"
        ? property.agent
        : null;
    const agentReference =
      typeof property.agent === "string" ? property.agent.trim() : "";
    const creatorReference =
      typeof property.creatorId === "string" ? property.creatorId.trim() : "";

    let owner: OwnerProfile | null = embeddedAgent
      ? mapOwner(embeddedAgent, Boolean(embeddedAgent.isOrganization))
      : null;

    let agentUser: any = null;
    let creatorUser: any = null;

    if (!owner && agentReference) {
      agentUser = await findUserDocument(agentReference);
      if (agentUser) owner = mapOwner(agentUser);

      if (!owner) {
        const profile = await findLandlordProfile(agentReference);
        if (profile) {
          const profileUser = profile.userDocId
            ? await findUserDocument(profile.userDocId)
            : null;
          owner = mapOwner(profileUser ? { ...profile, ...profileUser } : profile);
        }
      }
    }

    if (!owner && creatorReference) {
      creatorUser = await findUserDocument(creatorReference);

      if (!agentReference) {
        const organizationReferences = [
          creatorReference,
          creatorUser?.$id,
          creatorUser?.accountId,
        ].filter((value): value is string => Boolean(value));
        const organization = await findOrganization(organizationReferences);
        if (organization) owner = mapOwner(organization, true);
      }

      if (!owner && creatorUser) owner = mapOwner(creatorUser);

      if (!owner) {
        const profile = await findLandlordProfile(creatorReference);
        if (profile) owner = mapOwner(profile);
      }

      if (!owner) {
        const organization = await findOrganization([creatorReference]);
        if (organization) owner = mapOwner(organization, true);
      }
    }

    if (!owner && (property.creatorName || property.creatorEmail)) {
      owner = mapOwner({
        $id: creatorReference || agentReference,
        name: property.creatorName,
        email: property.creatorEmail,
        phone: property.creatorPhone,
        avatar: property.creatorAvatar,
      });
    }

    if (!owner) {
      owner = {
        $id: creatorReference || agentReference,
        name: "Property Owner",
        email: "Contact details unavailable",
        phone: null,
        avatar: null,
      };
    }

    property.agent = owner;
    property.creatorName = owner.name;
    property.creatorEmail = owner.email;
    property.creatorPhone = owner.phone;
    property.creatorAvatar = owner.avatar;

    return property;
  } catch (error) {
    console.error("❌ Error in getPropertyById:", error);
    return null;
  }
}

`;

  content = replaceBetween(
    content,
    "export async function getPropertyById({ id }: { id: string }) {",
    "// Count how many times a property appears in Favorites",
    robustFunction,
    "getPropertyById",
  );

  await write(relativePath, content);
  console.log(`✓ Fixed owner resolution in ${relativePath}`);
};

const patchAuthStore = async () => {
  const relativePath = "store/auth.store.ts";
  let content = await read(relativePath);

  if (!content.includes('tenantType?: "student" | "family" | "single";')) {
    content = content.replace(
      '  userMode: "tenant" | "landlord" | "student";\n  schoolLocation?: string;',
      '  userMode: "tenant" | "landlord" | "student";\n  tenantType?: "student" | "family" | "single";\n  schoolLocation?: string;',
    );
    content = content.replace(
      '  userMode: "tenant" | "landlord" | "student";\n  schoolLocation?: string;\n  email: string;',
      '  userMode: "tenant" | "landlord" | "student";\n  tenantType?: "student" | "family" | "single";\n  schoolLocation?: string;\n  email: string;',
    );
  }

  const normalizationHelper = `
const VALID_TENANT_TYPES = new Set(["student", "family", "single"] as const);

const normalizeUserRecord = (candidate: User, fallback?: User | null): User => {
  const sameAccountFallback =
    fallback?.accountId && fallback.accountId === candidate.accountId
      ? fallback
      : null;

  const rawMode = String(
    candidate.userMode || sameAccountFallback?.userMode || "tenant",
  )
    .trim()
    .toLowerCase();

  const userMode: User["userMode"] =
    rawMode === "landlord"
      ? "landlord"
      : rawMode === "student"
        ? "student"
        : "tenant";

  const normalizeTenantType = (value: unknown): User["tenantType"] => {
    const normalized = String(value || "").trim().toLowerCase();
    return VALID_TENANT_TYPES.has(normalized as any)
      ? (normalized as User["tenantType"])
      : undefined;
  };

  let tenantType =
    normalizeTenantType(candidate.tenantType) ||
    normalizeTenantType(sameAccountFallback?.tenantType);

  if (userMode === "student") tenantType = "student";

  const schoolLocation =
    candidate.schoolLocation || sameAccountFallback?.schoolLocation;

  // Old student accounts may already have been changed to userMode="tenant"
  // while an older cache/server document still lacks tenantType.
  if (userMode === "tenant" && !tenantType && schoolLocation?.trim()) {
    tenantType = "student";
  }

  return {
    ...(sameAccountFallback || {}),
    ...candidate,
    userMode,
    ...(tenantType ? { tenantType } : {}),
    ...(schoolLocation ? { schoolLocation } : {}),
  };
};
`;

  if (!content.includes("const normalizeUserRecord =")) {
    const anchor = `const isAuthenticationError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  return code === 401 || code === 403;
};
`;
    content = replaceOnce(
      content,
      anchor,
      `${anchor}${normalizationHelper}`,
      "the auth normalization anchor",
    );
  }

  content = content.replace(
    "      return JSON.parse(userData) as User;",
    "      return normalizeUserRecord(JSON.parse(userData) as User);",
  );

  const setUserReplacement = `  setUser: async (user: User | null) => {
    if (user) {
      const normalizedUser = normalizeUserRecord(user, get().user);
      await get().saveUserToStorage(normalizedUser);
      await storeData("user", normalizedUser);

      set({
        user: normalizedUser,
        isAuthenticated: true,
        isLoading: false,
      });

      return;
    }

    await get().removeUserFromStorage();
    await removeData("user");

    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

`;

  content = replaceBetween(
    content,
    "  setUser: async (user: User | null) => {",
    "  setOrganization: async (",
    setUserReplacement,
    "setUser",
  );

  content = content.replace(
    `      if (!storedUser) {
        storedUser = (await getData("user")) as User | null;
      }`,
    `      if (!storedUser) {
        const cachedUser = (await getData("user")) as User | null;
        storedUser = cachedUser ? normalizeUserRecord(cachedUser) : null;
      }`,
  );

  content = content.replace(
    `      const userDocument =
        userDocuments.documents[0] as unknown as User;`,
    `      const userDocument = normalizeUserRecord(
        userDocuments.documents[0] as unknown as User,
        cachedUser,
      );`,
  );

  content = content.replace(
    `      const user =
        userDetails.documents[0] as unknown as User;`,
    `      const user = normalizeUserRecord(
        userDetails.documents[0] as unknown as User,
        get().user,
      );`,
  );

  content = content.replace(
    "      const user = userDocument as unknown as User;",
    "      const user = normalizeUserRecord(userDocument as unknown as User);",
  );

  await write(relativePath, content);
  console.log(`✓ Stabilized stored user mode in ${relativePath}`);
};

const patchSignIn = async () => {
  const relativePath = "app/(auth)/sign-in.tsx";
  let content = await read(relativePath);

  if (!content.includes('import { getUserHomeRoute } from "@/lib/userMode";')) {
    content = content.replace(
      'import images from "@/constants/images";\n',
      'import images from "@/constants/images";\nimport { getUserHomeRoute } from "@/lib/userMode";\n',
    );
  }

  const newEffect = `  // Always route through the central mode helper so tenantType="student"
  // cannot accidentally open the ordinary tenant tabs.
  useEffect(() => {
    if (!user) return;
    router.replace(getUserHomeRoute(user) as any);
  }, [router, user]);

`;

  content = replaceBetween(
    content,
    "  // Navigate based on user mode after successful sign-in",
    "  const validateForm = (): ValidationError[] => {",
    newEffect,
    "the sign-in navigation effect",
  );

  await write(relativePath, content);
  console.log(`✓ Centralized sign-in routing in ${relativePath}`);
};

const patchRootLayout = async () => {
  const relativePath = "app/_layout.tsx";
  let content = await read(relativePath);

  content = content.replace('import { AuthProvider } from "@/context/AuthContext";\n', "");

  const oldReturn = `  return (
    <AuthProvider>
      <View className="flex-1">
        <OfflineStatusBanner />
        <View className="flex-1">
          <Slot />
        </View>
      </View>
    </AuthProvider>
  );`;
  const newReturn = `  return (
    <View className="flex-1">
      <OfflineStatusBanner />
      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );`;
  content = replaceOnce(content, oldReturn, newReturn, "the root AuthProvider wrapper");

  await write(relativePath, content);
  console.log(`✓ Removed the duplicate auth provider from ${relativePath}`);
};

const addLayoutGuard = async (relativePath, kind) => {
  let content = await read(relativePath);

  if (kind === "tenant") {
    if (!content.includes('from "@/lib/userMode"')) {
      content = content.replace(
        'import { client, config } from "@/lib/appwrite";\n',
        'import { client, config } from "@/lib/appwrite";\nimport { getUserHomeRoute, isStudentTenant, isTenantUser } from "@/lib/userMode";\n',
      );
    }
    content = content.replace(
      'import { Tabs, useFocusEffect } from "expo-router";',
      'import { Redirect, Tabs, useFocusEffect } from "expo-router";',
    );
    content = content.replace(
      '  Image,\n  ImageSourcePropType,',
      '  ActivityIndicator,\n  Image,\n  ImageSourcePropType,',
    );
    content = content.replace(
      "  const { user } = useAuthStore();",
      "  const { user, isHydrated, isInitialized, isLoading } = useAuthStore();",
    );

    const guard = `
  if (!isHydrated || !isInitialized || isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  if (!user) return <Redirect href="/sign-in" />;

  if (!isTenantUser(user) || isStudentTenant(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

`;
    if (!content.includes("if (!isTenantUser(user) || isStudentTenant(user))")) {
      content = content.replace("\n  return (\n    <Tabs", `${guard}  return (\n    <Tabs`);
    }
  }

  if (kind === "student") {
    if (!content.includes('from "@/lib/userMode"')) {
      content = content.replace(
        'import { client, config } from "@/lib/appwrite";\n',
        'import { client, config } from "@/lib/appwrite";\nimport { getUserHomeRoute, isStudentTenant } from "@/lib/userMode";\n',
      );
    }
    content = content.replace(
      'import { Tabs, useFocusEffect } from "expo-router";',
      'import { Redirect, Tabs, useFocusEffect } from "expo-router";',
    );
    content = content.replace(
      '  Image,\n  ImageSourcePropType,',
      '  ActivityIndicator,\n  Image,\n  ImageSourcePropType,',
    );
    content = content.replace(
      "  const { user } = useAuthStore();",
      "  const { user, isHydrated, isInitialized, isLoading } = useAuthStore();",
    );

    const guard = `
  if (!isHydrated || !isInitialized || isLoading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  if (!user) return <Redirect href="/sign-in" />;

  if (!isStudentTenant(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

`;
    if (!content.includes("if (!isStudentTenant(user))")) {
      content = content.replace("\n  return (\n    <Tabs", `${guard}  return (\n    <Tabs`);
    }
  }

  if (kind === "landlord") {
    if (!content.includes('from "@/lib/userMode"')) {
      content = content.replace(
        'import icons from "@/constants/icons";\n',
        'import icons from "@/constants/icons";\nimport { getUserHomeRoute, isLandlordUser } from "@/lib/userMode";\nimport useAuthStore from "@/store/auth.store";\n',
      );
    }
    content = content.replace('import { Tabs } from "expo-router";', 'import { Redirect, Tabs } from "expo-router";');
    content = content.replace(
      '  Image,\n  ImageSourcePropType,',
      '  ActivityIndicator,\n  Image,\n  ImageSourcePropType,',
    );
    content = content.replace(
      '  const theme = Colors[colorScheme ?? "light"];\n  return (',
      '  const theme = Colors[colorScheme ?? "light"];\n  const { user, isHydrated, isInitialized, isLoading } = useAuthStore();\n\n  if (!isHydrated || !isInitialized || isLoading) {\n    return (\n      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>\n        <ActivityIndicator size="large" color="#F97316" />\n      </View>\n    );\n  }\n\n  if (!user) return <Redirect href="/sign-in" />;\n  if (!isLandlordUser(user)) {\n    return <Redirect href={getUserHomeRoute(user) as any} />;\n  }\n\n  return (',
    );
  }

  await write(relativePath, content);
  console.log(`✓ Added a ${kind} route guard to ${relativePath}`);
};

const patchPropertyPage = async () => {
  const relativePath = "app/(root)/properties/[id].tsx";
  let content = await read(relativePath);

  if (!content.includes('import { getModeAwareRoute, getUserHomeRoute } from "@/lib/userMode";')) {
    content = content.replace(
      'import { useAppwrite } from "@/lib/useAppwrite";\n',
      'import { useAppwrite } from "@/lib/useAppwrite";\nimport { getModeAwareRoute, getUserHomeRoute } from "@/lib/userMode";\n',
    );
  }

  content = content.replace(
    `  agent?: {
    $id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };`,
    `  agent?:
    | string
    | {
        $id: string;
        name: string;
        email: string;
        phone?: string | null;
        avatar?: string | null;
        isOrganization?: boolean;
      };`,
  );

  content = content.replace(
    "  const [agentData, setAgentData] = useState<any>(null);\n  const [loadingAgent, setLoadingAgent] = useState(false);\n",
    "",
  );

  if (content.includes("  // LOAD AGENT WHEN PROPERTY LOADS")) {
    content = replaceBetween(
      content,
      "  // ============================================================================\n  // LOAD AGENT WHEN PROPERTY LOADS",
      "  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);",
      "  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);",
      "the duplicate property-agent effect",
    );
  }

  content = content.replace(
    `    // Get landlord info from property
    const landlord = property.agent || {
      name: property.creatorName || "Property Owner",
      email: property.creatorEmail || "Not available",
      phone: property.creatorPhone || null,
      avatar: property.creatorAvatar || null,
    };`,
    `    const landlord =
      property.agent && typeof property.agent === "object"
        ? property.agent
        : {
            name: property.creatorName || "Property Owner",
            email: property.creatorEmail || "Contact details unavailable",
            phone: property.creatorPhone || null,
            avatar: property.creatorAvatar || null,
          };`,
  );

  content = content.replace(
    `        router.replace(
          user?.userMode === "landlord"
            ? "/landHome"
            : user?.userMode === "student"
              ? "/s-tenantHome"
              : "/tenantHome",
        );`,
    `        router.replace(getUserHomeRoute(user) as any);`,
  );

  content = content.replace(
    `  const { amenities, loading: amenitiesLoading } = usePOIs(
    property?.latitude,
    property?.longitude,
    3,
  );`,
    `  const {
    amenities,
    loading: amenitiesLoading,
    error: amenitiesError,
    refetch: refetchAmenities,
  } = usePOIs(property?.latitude, property?.longitude, 3);`,
  );

  content = content.replace(
    `    const creator = property.agent || {
      name: property.creatorName || "Property Owner",
      email: property.creatorEmail || "Not available",
      phone: property.creatorPhone || "Not available",
      avatar: property.creatorAvatar || null,
    };`,
    `    const creator =
      property.agent && typeof property.agent === "object"
        ? property.agent
        : {
            $id: property.creatorId || "",
            name: property.creatorName || "Property Owner",
            email: property.creatorEmail || "Contact details unavailable",
            phone: property.creatorPhone || null,
            avatar: property.creatorAvatar || null,
            isOrganization: false,
          };`,
  );

  content = content.replace(
    '                  router.push(`/landlords?landlordId=${landlordId}`);',
    '                  router.push(\n                    getModeAwareRoute(\n                      `/landlords?landlordId=${landlordId}`,\n                      user,\n                    ) as any,\n                  );',
  );

  content = content.replaceAll(
    `                  <AmenitiesBadge
                    amenities={amenities}
                    loading={amenitiesLoading}
                  />`,
    `                  <AmenitiesBadge
                    amenities={amenities}
                    loading={amenitiesLoading}
                    error={amenitiesError}
                    onRetry={() => void refetchAmenities()}
                  />`,
  );

  await write(relativePath, content);
  console.log(`✓ Fixed landlord info, POI retry, and mode-aware navigation in ${relativePath}`);
};

const main = async () => {
  console.log("\nInstalling the Nookly stability hotfix...\n");
  await mkdir(backupRoot, { recursive: true });
  await backupFiles();
  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  await copyReplacementFiles();
  await patchAppwrite();
  await patchAuthStore();
  await patchSignIn();
  await patchRootLayout();
  await addLayoutGuard("app/(root)/(tabs)/_layout.tsx", "tenant");
  await addLayoutGuard("app/(root)/(student)/_layout.tsx", "student");
  await addLayoutGuard("app/(root)/(landlord)/_layout.tsx", "landlord");
  await patchPropertyPage();

  console.log("\n✓ POI reliability, landlord information, and user-mode stability are fixed.");
  console.log("\nNext verification command:");
  console.log(
    'npx eslint "lib/poiService.ts" "hooks/usePOIs.ts" "components/AmenitiesBadge.tsx" "components/MapLayers.tsx" "store/auth.store.ts" "app/(auth)/sign-in.tsx" "app/_layout.tsx" "app/(root)/(tabs)/_layout.tsx" "app/(root)/(student)/_layout.tsx" "app/(root)/(landlord)/_layout.tsx" "app/(root)/properties/[id].tsx"',
  );
};

main().catch((error) => {
  console.error("\n✗ Stability hotfix installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
