import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  cache: path.join(root, "lib", "profilePageCache.ts"),
  auth: path.join(root, "store", "auth.store.ts"),
  tenant: path.join(root, "app", "(root)", "(tabs)", "profile.tsx"),
  student: path.join(root, "app", "(root)", "(student)", "s-profile.tsx"),
  landlord: path.join(
    root,
    "app",
    "(root)",
    "(landlord)",
    "landProfile.tsx",
  ),
  driver: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "driver-profile.tsx",
  ),
};

for (const [name, filePath] of Object.entries(paths)) {
  if (name === "cache") continue;

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing ${name} profile dependency: ${filePath}\n` +
        "Run this script from the Nookly project root.",
    );
  }
}

const originals = {
  auth: fs.readFileSync(paths.auth, "utf8"),
  tenant: fs.readFileSync(paths.tenant, "utf8"),
  student: fs.readFileSync(paths.student, "utf8"),
  landlord: fs.readFileSync(paths.landlord, "utf8"),
  driver: fs.readFileSync(paths.driver, "utf8"),
};

const replaceRequired = (
  text,
  pattern,
  replacement,
  label,
) => {
  if (typeof pattern === "string") {
    if (!text.includes(pattern)) {
      throw new Error(
        `Could not locate ${label}. No files were written.`,
      );
    }

    return text.replace(pattern, replacement);
  }

  if (!pattern.test(text)) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  return text.replace(pattern, replacement);
};

// ===========================================================================
// Shared persistent profile-page cache
// ===========================================================================
const cacheFile = `import AsyncStorage from "@react-native-async-storage/async-storage";

const PROFILE_PAGE_CACHE_PREFIX =
  "@nookly:profile-page:v1";

interface StoredProfilePageEntry<T> {
  accountId: string;
  profileKey: string;
  data: T;
  savedAt: number;
}

const memoryCache = new Map<
  string,
  StoredProfilePageEntry<unknown>
>();

const warmPromises = new Map<string, Promise<void>>();

const normalize = (value: string): string =>
  String(value || "").trim();

const hashText = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const getMemoryKey = (
  accountId: string,
  profileKey: string,
): string =>
  \`\${normalize(accountId)}:\${normalize(profileKey)}\`;

const getAccountStoragePrefix = (
  accountId: string,
): string =>
  \`\${PROFILE_PAGE_CACHE_PREFIX}:\${hashText(
    normalize(accountId),
  )}:\`;

const getStorageKey = (
  accountId: string,
  profileKey: string,
): string =>
  \`\${getAccountStoragePrefix(accountId)}\${hashText(
    normalize(profileKey),
  )}\`;

const isStoredEntry = (
  value: unknown,
): value is StoredProfilePageEntry<unknown> => {
  if (!value || typeof value !== "object") return false;

  const candidate =
    value as Partial<StoredProfilePageEntry<unknown>>;

  return (
    typeof candidate.accountId === "string" &&
    typeof candidate.profileKey === "string" &&
    typeof candidate.savedAt === "number" &&
    Object.prototype.hasOwnProperty.call(candidate, "data")
  );
};

export const peekProfilePageCache = <T>(
  accountId: string,
  profileKey: string,
): T | null => {
  const normalizedAccountId = normalize(accountId);
  const normalizedProfileKey = normalize(profileKey);

  if (!normalizedAccountId || !normalizedProfileKey) {
    return null;
  }

  const entry = memoryCache.get(
    getMemoryKey(
      normalizedAccountId,
      normalizedProfileKey,
    ),
  );

  return entry ? (entry.data as T) : null;
};

export const readProfilePageCache = async <T>(
  accountId: string,
  profileKey: string,
): Promise<T | null> => {
  const normalizedAccountId = normalize(accountId);
  const normalizedProfileKey = normalize(profileKey);

  if (!normalizedAccountId || !normalizedProfileKey) {
    return null;
  }

  const memoryValue = peekProfilePageCache<T>(
    normalizedAccountId,
    normalizedProfileKey,
  );

  if (memoryValue !== null) {
    return memoryValue;
  }

  try {
    const raw = await AsyncStorage.getItem(
      getStorageKey(
        normalizedAccountId,
        normalizedProfileKey,
      ),
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;

    if (!isStoredEntry(parsed)) {
      return null;
    }

    if (
      parsed.accountId !== normalizedAccountId ||
      parsed.profileKey !== normalizedProfileKey
    ) {
      return null;
    }

    memoryCache.set(
      getMemoryKey(
        normalizedAccountId,
        normalizedProfileKey,
      ),
      parsed,
    );

    return parsed.data as T;
  } catch (error) {
    console.warn(
      "Could not read persistent profile page cache:",
      error,
    );
    return null;
  }
};

export const writeProfilePageCache = async <T>(
  accountId: string,
  profileKey: string,
  data: T,
): Promise<void> => {
  const normalizedAccountId = normalize(accountId);
  const normalizedProfileKey = normalize(profileKey);

  if (!normalizedAccountId || !normalizedProfileKey) {
    return;
  }

  const entry: StoredProfilePageEntry<T> = {
    accountId: normalizedAccountId,
    profileKey: normalizedProfileKey,
    data,
    savedAt: Date.now(),
  };

  memoryCache.set(
    getMemoryKey(
      normalizedAccountId,
      normalizedProfileKey,
    ),
    entry as StoredProfilePageEntry<unknown>,
  );

  try {
    await AsyncStorage.setItem(
      getStorageKey(
        normalizedAccountId,
        normalizedProfileKey,
      ),
      JSON.stringify(entry),
    );
  } catch (error) {
    console.warn(
      "Could not persist profile page cache:",
      error,
    );
  }
};

export const mergeProfilePageCache = async <
  T extends object,
>(
  accountId: string,
  profileKey: string,
  partial: Partial<T>,
): Promise<T> => {
  const current =
    (await readProfilePageCache<T>(
      accountId,
      profileKey,
    )) ?? ({} as T);

  const next = {
    ...current,
    ...partial,
  } as T;

  await writeProfilePageCache(
    accountId,
    profileKey,
    next,
  );

  return next;
};

export const warmProfilePageCache = async (
  accountId: string,
): Promise<void> => {
  const normalizedAccountId = normalize(accountId);

  if (!normalizedAccountId) return;

  const existing = warmPromises.get(normalizedAccountId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const prefix =
        getAccountStoragePrefix(normalizedAccountId);

      const allKeys = await AsyncStorage.getAllKeys();
      const accountKeys = allKeys.filter((key) =>
        key.startsWith(prefix),
      );

      if (accountKeys.length === 0) return;

      const entries =
        await AsyncStorage.multiGet(accountKeys);

      entries.forEach(([, raw]) => {
        if (!raw) return;

        try {
          const parsed = JSON.parse(raw) as unknown;

          if (
            !isStoredEntry(parsed) ||
            parsed.accountId !== normalizedAccountId
          ) {
            return;
          }

          memoryCache.set(
            getMemoryKey(
              parsed.accountId,
              parsed.profileKey,
            ),
            parsed,
          );
        } catch {
          // Ignore one malformed profile snapshot without
          // blocking the remaining account cache.
        }
      });
    } catch (error) {
      console.warn(
        "Could not warm profile page cache:",
        error,
      );
    }
  })().finally(() => {
    warmPromises.delete(normalizedAccountId);
  });

  warmPromises.set(normalizedAccountId, promise);
  return promise;
};

export const clearProfilePageCache = async (
  accountId?: string | null,
): Promise<void> => {
  const normalizedAccountId = normalize(accountId || "");

  if (!normalizedAccountId) {
    memoryCache.clear();
    warmPromises.clear();
    return;
  }

  const memoryPrefix = \`\${normalizedAccountId}:\`;

  Array.from(memoryCache.keys())
    .filter((key) => key.startsWith(memoryPrefix))
    .forEach((key) => memoryCache.delete(key));

  warmPromises.delete(normalizedAccountId);

  try {
    const storagePrefix =
      getAccountStoragePrefix(normalizedAccountId);

    const allKeys = await AsyncStorage.getAllKeys();
    const accountKeys = allKeys.filter((key) =>
      key.startsWith(storagePrefix),
    );

    if (accountKeys.length > 0) {
      await AsyncStorage.multiRemove(accountKeys);
    }
  } catch (error) {
    console.warn(
      "Could not clear profile page cache:",
      error,
    );
  }
};
`;

// ===========================================================================
// Auth store: warm snapshots before navigation and clear on logout.
// ===========================================================================
let auth = originals.auth;

if (!auth.includes('from "@/lib/profilePageCache"')) {
  const importMarker =
    'import { clearPersistentQueryCache } from "@/lib/persistentQueryCache";';

  auth = replaceRequired(
    auth,
    importMarker,
    `${importMarker}
import {
  clearProfilePageCache,
  warmProfilePageCache,
} from "@/lib/profilePageCache";`,
    "the auth persistent-query import",
  );
}

auth = replaceRequired(
  auth,
`    if (user) {
      const normalizedUser = normalizeUserRecord(user, get().user);
      await get().saveUserToStorage(normalizedUser);
`,
`    if (user) {
      const normalizedUser = normalizeUserRecord(user, get().user);

      await warmProfilePageCache(
        normalizedUser.accountId,
      );

      await get().saveUserToStorage(normalizedUser);
`,
  "the auth setUser cache block",
);

auth = replaceRequired(
  auth,
`      if (storedUser) {
        await get().saveUserToStorage(storedUser);
`,
`      if (storedUser) {
        await warmProfilePageCache(
          storedUser.accountId,
        );

        await get().saveUserToStorage(storedUser);
`,
  "the auth hydration stored-user block",
);

auth = replaceRequired(
  auth,
`      if (accountId) {
        await clearPersistentQueryCache(accountId);
      }
`,
`      if (accountId) {
        await Promise.all([
          clearPersistentQueryCache(accountId),
          clearProfilePageCache(accountId),
        ]);
      }
`,
  "the auth account-cache cleanup block",
);

// ===========================================================================
// Tenant and student profile patch helper
// ===========================================================================
const patchTenantLikeProfile = (
  original,
  cacheKey,
  label,
) => {
  let text = original;

  if (!text.includes('from "@/lib/profilePageCache"')) {
    const importMarker =
      'import { getTenantScore } from "@/lib/tenantProfile";';

    text = replaceRequired(
      text,
      importMarker,
      `${importMarker}
import {
  mergeProfilePageCache,
  peekProfilePageCache,
  readProfilePageCache,
} from "@/lib/profilePageCache";`,
      `${label} tenant-score import`,
    );
  }

  if (!text.includes("interface TenantProfilePageSnapshot")) {
    text = replaceRequired(
      text,
      "const Profile = () => {",
`interface TenantProfilePageSnapshot {
  stats: TenantStats;
  tenantScore: TenantScoreData | null;
}

const EMPTY_TENANT_STATS: TenantStats = {
  totalFavorites: 0,
  totalLikes: 0,
  totalReviews: 0,
  totalApplications: 0,
  viewedProperties: 0,
};

const PROFILE_PAGE_CACHE_KEY = "${cacheKey}";

const Profile = () => {`,
      `${label} profile component marker`,
    );
  }

  text = replaceRequired(
    text,
`  const { user, fetchAuthenticatedUser } = useAuthStore();
  const [showSuccess, setShowSuccess] = useState(false);
`,
`  const { user, fetchAuthenticatedUser } = useAuthStore();
  const accountId = user?.accountId || "";
  const initialProfileSnapshot =
    peekProfilePageCache<TenantProfilePageSnapshot>(
      accountId,
      PROFILE_PAGE_CACHE_KEY,
    );

  const [showSuccess, setShowSuccess] = useState(false);
`,
    `${label} auth state block`,
  );

  text = replaceRequired(
    text,
/  const \[stats, setStats\] = useState<TenantStats>\(\{\s*totalFavorites: 0,\s*totalLikes: 0,\s*totalReviews: 0,\s*totalApplications: 0,\s*viewedProperties: 0,\s*\}\);\s*const \[loadingStats, setLoadingStats\] = useState\(true\);/m,
`  const [stats, setStats] = useState<TenantStats>(
    () =>
      initialProfileSnapshot?.stats ??
      EMPTY_TENANT_STATS,
  );
  const [loadingStats, setLoadingStats] = useState(false);`,
    `${label} stats state`,
  );

  text = replaceRequired(
    text,
/  const \[tenantScore, setTenantScore\] = useState<TenantScoreData \| null>\(null\);\s*const \[loadingScore, setLoadingScore\] = useState\(true\);/m,
`  const [tenantScore, setTenantScore] =
    useState<TenantScoreData | null>(
      () =>
        initialProfileSnapshot?.tenantScore ??
        null,
    );
  const [loadingScore, setLoadingScore] = useState(false);`,
    `${label} score state`,
  );

  const themeMarker =
    '  const theme = Colors[colorScheme ?? "light"];\n';

  if (!text.includes("readProfilePageCache<TenantProfilePageSnapshot>")) {
    text = replaceRequired(
      text,
      themeMarker,
`${themeMarker}
  useEffect(() => {
    let active = true;

    if (!accountId) {
      return () => {
        active = false;
      };
    }

    void readProfilePageCache<TenantProfilePageSnapshot>(
      accountId,
      PROFILE_PAGE_CACHE_KEY,
    ).then((snapshot) => {
      if (!active || !snapshot) return;

      if (snapshot.stats) {
        setStats(snapshot.stats);
      }

      if (
        Object.prototype.hasOwnProperty.call(
          snapshot,
          "tenantScore",
        )
      ) {
        setTenantScore(snapshot.tenantScore);
      }
    });

    return () => {
      active = false;
    };
  }, [accountId]);
`,
      `${label} theme marker`,
    );
  }

  text = text.replace(
    /(\s*)setLoadingStats\(true\);\s*/g,
    "$1",
  );

  text = text.replace(
    /(\s*)setLoadingScore\(true\);\s*/g,
    "$1",
  );

  text = replaceRequired(
    text,
`      setStats({
        totalFavorites,
        totalLikes,
        totalReviews,
        totalApplications,
        viewedProperties: viewedPropertiesCount,
      });
`,
`      const nextStats: TenantStats = {
        totalFavorites,
        totalLikes,
        totalReviews,
        totalApplications,
        viewedProperties: viewedPropertiesCount,
      };

      setStats(nextStats);

      if (accountId) {
        void mergeProfilePageCache<TenantProfilePageSnapshot>(
          accountId,
          PROFILE_PAGE_CACHE_KEY,
          { stats: nextStats },
        );
      }
`,
    `${label} successful stats update`,
  );

  text = text.replace(
/      setStats\(\{\s*totalFavorites: 0,\s*totalLikes: 0,\s*totalReviews: 0,\s*totalApplications: 0,\s*viewedProperties: 0,\s*\}\);/m,
`      // Keep the last cached activity values on refresh failure.`,
  );

  text = replaceRequired(
    text,
`      const score = await getTenantScore(user.accountId);
      setTenantScore(score as TenantScoreData | null);
`,
`      const score = await getTenantScore(user.accountId);
      const nextScore =
        score as TenantScoreData | null;

      setTenantScore(nextScore);

      if (accountId) {
        void mergeProfilePageCache<TenantProfilePageSnapshot>(
          accountId,
          PROFILE_PAGE_CACHE_KEY,
          { tenantScore: nextScore },
        );
      }
`,
    `${label} successful score update`,
  );

  text = text.replace(
    /(\s*)setTenantScore\(null\);\s*/g,
    "$1// Keep the last cached score on refresh failure.\n",
  );

  // Keep the previous avatar visible while a replacement uploads.
  text = text.replace(
/            \{uploadingAvatar \? \(\s*<View\s*className="w-32 h-32 rounded-full items-center justify-center"[\s\S]*?<ActivityIndicator size="large" color=\{theme\.primary\[300\]\} \/>\s*<\/View>\s*\) : \(\s*<Image\s*source=\{user\?\.avatar \? \{ uri: user\.avatar \} : icons\.person\}\s*className="w-32 h-32 rounded-full border-4 border-white shadow-lg"\s*style=\{\{ borderColor: theme\.surface \}\}\s*\/>\s*\)\}/m,
`            <Image
              source={user?.avatar ? { uri: user.avatar } : icons.person}
              className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
              style={{ borderColor: theme.surface }}
            />

            {uploadingAvatar && (
              <View
                className="absolute inset-0 rounded-full items-center justify-center"
                style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                pointerEvents="none"
              >
                <ActivityIndicator size="large" color="#FFFFFF" />
              </View>
            )}`,
  );

  return text;
};

const tenant = patchTenantLikeProfile(
  originals.tenant,
  "tenant-profile",
  "Tenant",
);

const student = patchTenantLikeProfile(
  originals.student,
  "student-profile",
  "Student",
);

// ===========================================================================
// Landlord profile
// ===========================================================================
let landlord = originals.landlord;

if (!landlord.includes('from "@/lib/profilePageCache"')) {
  const importMarker =
    'import { config, databases, logout, uploadImage } from "@/lib/appwrite";';

  landlord = replaceRequired(
    landlord,
    importMarker,
    `${importMarker}
import {
  mergeProfilePageCache,
  peekProfilePageCache,
  readProfilePageCache,
} from "@/lib/profilePageCache";`,
    "the landlord Appwrite import",
  );
}

if (!landlord.includes("interface LandlordProfilePageSnapshot")) {
  landlord = replaceRequired(
    landlord,
    "const LandLordProfile = () => {",
`interface LandlordProfilePageSnapshot {
  stats: ProfileStats;
}

const EMPTY_LANDLORD_STATS: ProfileStats = {
  totalProperties: 0,
  totalLikes: 0,
  totalViews: 0,
  totalReviews: 0,
  averageRating: 0,
};

const LANDLORD_PROFILE_CACHE_KEY =
  "landlord-profile";

const LandLordProfile = () => {`,
    "the landlord component marker",
  );
}

landlord = replaceRequired(
  landlord,
`  const { user, fetchAuthenticatedUser } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
`,
`  const { user, fetchAuthenticatedUser } = useAuthStore();
  const accountId = user?.accountId || "";
  const initialProfileSnapshot =
    peekProfilePageCache<LandlordProfilePageSnapshot>(
      accountId,
      LANDLORD_PROFILE_CACHE_KEY,
    );

  const [modalVisible, setModalVisible] = useState(false);
`,
  "the landlord auth block",
);

landlord = replaceRequired(
  landlord,
/  const \[stats, setStats\] = useState<ProfileStats>\(\{\s*totalProperties: 0,\s*totalLikes: 0,\s*totalViews: 0,\s*totalReviews: 0,\s*averageRating: 0,\s*\}\);\s*const \[loadingStats, setLoadingStats\] = useState\(true\);/m,
`  const [stats, setStats] = useState<ProfileStats>(
    () =>
      initialProfileSnapshot?.stats ??
      EMPTY_LANDLORD_STATS,
  );
  const [loadingStats, setLoadingStats] = useState(false);`,
  "the landlord stats state",
);

const landlordThemeMarker =
  '  const theme = Colors[colorScheme ?? "light"];\n';

if (
  !landlord.includes(
    "readProfilePageCache<LandlordProfilePageSnapshot>",
  )
) {
  landlord = replaceRequired(
    landlord,
    landlordThemeMarker,
`${landlordThemeMarker}
  useEffect(() => {
    let active = true;

    if (!accountId) {
      return () => {
        active = false;
      };
    }

    void readProfilePageCache<LandlordProfilePageSnapshot>(
      accountId,
      LANDLORD_PROFILE_CACHE_KEY,
    ).then((snapshot) => {
      if (active && snapshot?.stats) {
        setStats(snapshot.stats);
      }
    });

    return () => {
      active = false;
    };
  }, [accountId]);
`,
    "the landlord theme marker",
  );
}

landlord = landlord.replace(
  /(\s*)setLoadingStats\(true\);\s*/g,
  "$1",
);

landlord = replaceRequired(
  landlord,
`      setStats({
        totalProperties: properties.length,
        totalLikes,
        totalViews,
        totalReviews,
        occupancyRate,
        averageRating: Number(averageRating.toFixed(1)),
      });
`,
`      const nextStats: ProfileStats = {
        totalProperties: properties.length,
        totalLikes,
        totalViews,
        totalReviews,
        occupancyRate,
        averageRating: Number(
          averageRating.toFixed(1),
        ),
      };

      setStats(nextStats);

      if (accountId) {
        void mergeProfilePageCache<LandlordProfilePageSnapshot>(
          accountId,
          LANDLORD_PROFILE_CACHE_KEY,
          { stats: nextStats },
        );
      }
`,
  "the landlord successful stats update",
);

// ===========================================================================
// Driver profile
// ===========================================================================
let driver = originals.driver;

driver = driver.replace(
  'import React, { useCallback, useMemo, useState } from "react";',
  'import React, { useCallback, useEffect, useMemo, useState } from "react";',
);

if (!driver.includes('from "@/lib/profilePageCache"')) {
  const importMarker =
    'import useAuthStore from "@/store/auth.store";';

  driver = replaceRequired(
    driver,
    importMarker,
    `import {
  mergeProfilePageCache,
  peekProfilePageCache,
  readProfilePageCache,
} from "@/lib/profilePageCache";
${importMarker}`,
    "the driver auth import",
  );
}

if (!driver.includes("interface DriverProfilePageSnapshot")) {
  driver = replaceRequired(
    driver,
    "export default function DriverProfileScreen() {",
`interface DriverProfilePageSnapshot {
  dashboard: DriverDashboard | null;
  form: OnboardingFormState;
  errorMessage: string;
  showApplicationForm: boolean;
}

const DRIVER_PROFILE_CACHE_KEY =
  "driver-profile";

export default function DriverProfileScreen() {`,
    "the driver component marker",
  );
}

driver = replaceRequired(
  driver,
`  const { user, signOut } = useAuthStore();

  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_FORM);
`,
`  const { user, signOut } = useAuthStore();
  const accountId = user?.accountId || "";
  const initialProfileSnapshot =
    peekProfilePageCache<DriverProfilePageSnapshot>(
      accountId,
      DRIVER_PROFILE_CACHE_KEY,
    );

  const [dashboard, setDashboard] =
    useState<DriverDashboard | null>(
      () =>
        initialProfileSnapshot?.dashboard ??
        null,
    );
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState(
      () =>
        initialProfileSnapshot?.errorMessage ??
        "",
    );
  const [signingOut, setSigningOut] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [showApplicationForm, setShowApplicationForm] =
    useState(
      () =>
        initialProfileSnapshot?.showApplicationForm ??
        false,
    );
  const [form, setForm] =
    useState<OnboardingFormState>(
      () =>
        initialProfileSnapshot?.form ??
        EMPTY_FORM,
    );

  useEffect(() => {
    let active = true;

    if (!accountId) {
      return () => {
        active = false;
      };
    }

    void readProfilePageCache<DriverProfilePageSnapshot>(
      accountId,
      DRIVER_PROFILE_CACHE_KEY,
    ).then((snapshot) => {
      if (!active || !snapshot) return;

      setDashboard(snapshot.dashboard ?? null);
      setForm(snapshot.form ?? EMPTY_FORM);
      setErrorMessage(snapshot.errorMessage ?? "");
      setShowApplicationForm(
        snapshot.showApplicationForm ?? false,
      );
    });

    return () => {
      active = false;
    };
  }, [accountId]);
`,
  "the driver initial state block",
);

driver = driver.replace(
  /(\s*)setLoading\(true\);\s*/g,
  "$1",
);

driver = replaceRequired(
  driver,
`      const result = await getDriverDashboard();
      setDashboard(result);
      setForm(mergeRetainedForm(formFromDashboard(result), retainedForm));

      if (result.profile.verificationStatus === "rejected") {
        setShowApplicationForm(false);
      }
`,
`      const result = await getDriverDashboard();
      const nextForm = mergeRetainedForm(
        formFromDashboard(result),
        retainedForm,
      );
      const rejected =
        result.profile.verificationStatus === "rejected";

      setDashboard(result);
      setForm(nextForm);
      setErrorMessage("");

      if (rejected) {
        setShowApplicationForm(false);
      }

      if (accountId) {
        void mergeProfilePageCache<DriverProfilePageSnapshot>(
          accountId,
          DRIVER_PROFILE_CACHE_KEY,
          {
            dashboard: result,
            form: nextForm,
            errorMessage: "",
            ...(rejected
              ? { showApplicationForm: false }
              : {}),
          },
        );
      }
`,
  "the driver successful dashboard update",
);

driver = driver.replace(
  /\s*setDashboard\(null\);\s*setErrorMessage\(message\);/m,
`
      // Keep the last cached dashboard visible when a quiet
      // background refresh fails.
      setErrorMessage(message);`,
);

driver = driver.replace(
`      if (message.toLowerCase().includes("no driver profile")) {
        setShowApplicationForm(true);
      }
`,
`      if (message.toLowerCase().includes("no driver profile")) {
        setShowApplicationForm(true);

        if (accountId) {
          void mergeProfilePageCache<DriverProfilePageSnapshot>(
            accountId,
            DRIVER_PROFILE_CACHE_KEY,
            {
              errorMessage: message,
              showApplicationForm: true,
              form: retainedForm ?? form,
            },
          );
        }
      }
`,
);

driver = replaceRequired(
  driver,
`  const updateForm = <K extends keyof OnboardingFormState>(
    field: K,
    value: OnboardingFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
`,
`  const updateForm = <K extends keyof OnboardingFormState>(
    field: K,
    value: OnboardingFormState[K],
  ) => {
    setForm((current) => {
      const next = {
        ...current,
        [field]: value,
      };

      if (accountId) {
        void mergeProfilePageCache<DriverProfilePageSnapshot>(
          accountId,
          DRIVER_PROFILE_CACHE_KEY,
          { form: next },
        );
      }

      return next;
    });
  };
`,
  "the driver form updater",
);

// ===========================================================================
// Validation
// ===========================================================================
const outputs = {
  auth,
  tenant,
  student,
  landlord,
  driver,
};

if (!cacheFile.includes("warmProfilePageCache")) {
  throw new Error(
    "Validation failed: profile cache warming is missing.",
  );
}

if (
  !auth.includes(
    "await warmProfilePageCache",
  ) ||
  !auth.includes(
    "clearProfilePageCache(accountId)",
  )
) {
  throw new Error(
    "Validation failed: auth profile-cache lifecycle is incomplete.",
  );
}

for (const [name, text] of Object.entries({
  tenant,
  student,
  landlord,
  driver,
})) {
  if (!text.includes("peekProfilePageCache")) {
    throw new Error(
      `Validation failed: ${name} lacks first-render profile hydration.`,
    );
  }

  if (!text.includes("readProfilePageCache")) {
    throw new Error(
      `Validation failed: ${name} lacks persistent profile hydration.`,
    );
  }

  if (!text.includes("mergeProfilePageCache")) {
    throw new Error(
      `Validation failed: ${name} does not persist refreshed profile data.`,
    );
  }
}

if (
  tenant.includes("const [loadingStats, setLoadingStats] = useState(true)") ||
  student.includes("const [loadingStats, setLoadingStats] = useState(true)") ||
  landlord.includes("const [loadingStats, setLoadingStats] = useState(true)") ||
  driver.includes("const [loading, setLoading] = useState(true)")
) {
  throw new Error(
    "Validation failed: a profile still starts in a blocking loading state.",
  );
}

if (
  tenant.includes("setTenantScore(null);") ||
  student.includes("setTenantScore(null);") ||
  driver.includes("setDashboard(null);")
) {
  throw new Error(
    "Validation failed: a refresh failure still destroys cached profile data.",
  );
}

// ===========================================================================
// Back up and write only after all validations pass.
// ===========================================================================
for (const [name, filePath] of Object.entries(paths)) {
  if (name === "cache") continue;

  fs.copyFileSync(
    filePath,
    `${filePath}.step11.bak`,
  );
}

fs.mkdirSync(path.dirname(paths.cache), {
  recursive: true,
});

fs.writeFileSync(paths.cache, cacheFile, "utf8");
fs.writeFileSync(paths.auth, auth, "utf8");
fs.writeFileSync(paths.tenant, tenant, "utf8");
fs.writeFileSync(paths.student, student, "utf8");
fs.writeFileSync(paths.landlord, landlord, "utf8");
fs.writeFileSync(paths.driver, driver, "utf8");

console.log("");
console.log("Step 11 applied successfully.");
console.log("");
console.log("Added:");
console.log("- lib/profilePageCache.ts");
console.log("");
console.log("Updated:");
console.log("- store/auth.store.ts");
console.log("- app/(root)/(tabs)/profile.tsx");
console.log("- app/(root)/(student)/s-profile.tsx");
console.log("- app/(root)/(landlord)/landProfile.tsx");
console.log("- app/(root)/(driver)/driver-profile.tsx");
console.log("");
console.log("Tenant, student, landlord and driver profiles now");
console.log("render their last saved data immediately.");
console.log("");
console.log("Now run: npx tsc --noEmit");
