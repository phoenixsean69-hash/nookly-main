import AsyncStorage from "@react-native-async-storage/async-storage";

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
  `${normalize(accountId)}:${normalize(profileKey)}`;

const getAccountStoragePrefix = (
  accountId: string,
): string =>
  `${PROFILE_PAGE_CACHE_PREFIX}:${hashText(
    normalize(accountId),
  )}:`;

const getStorageKey = (
  accountId: string,
  profileKey: string,
): string =>
  `${getAccountStoragePrefix(accountId)}${hashText(
    normalize(profileKey),
  )}`;

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

  const memoryPrefix = `${normalizedAccountId}:`;

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
