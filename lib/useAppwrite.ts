import NetInfo from "@react-native-community/netinfo";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { config } from "@/lib/appwrite";
import {
  checkCollectionsForRemoteChanges,
  getLatestCollectionChangedAt,
  refreshCollectionVersionBaselines,
  startAppwriteRealtimeCache,
  subscribeToAppwriteCollectionChanges,
  subscribeToAppwriteReconnect,
} from "@/lib/appwriteRealtimeCache";
import {
  readCachedPropertyEntity,
  readPersistentQueryCache,
  stableStringify,
  writePersistentQueryCache,
} from "@/lib/persistentQueryCache";
import useAuthStore from "@/store/auth.store";

interface UseAppwriteOptions<
  T,
  P extends Record<string, any>,
> {
  fn: (params: P) => Promise<T>;
  params?: P;
  skip?: boolean;

  /**
   * Retained for compatibility with existing screens.
   * Time-based expiry is intentionally no longer used.
   */
  ttl?: number;

  cacheKey?: string;
  persist?: boolean;

  /**
   * Collections that can change this query's result.
   * The hook only re-fetches after one of these collections
   * changes, or after an explicit refetch.
   */
  watchCollections?: Array<
    string | null | undefined
  >;
}

interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

type FetchMode =
  | "auto"
  | "force"
  | "database-change"
  | "reconnect";

const memoryCache = new Map<
  string,
  MemoryCacheEntry<any>
>();
const inFlightRequests = new Map<
  string,
  Promise<unknown>
>();

const isConnectedState = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean =>
  state.isConnected === true &&
  state.isInternetReachable !== false;

const getPropertyIdFromParams = (
  params: Record<string, any>,
): string | null => {
  const possibleId =
    params?.id ?? params?.propertyId;

  return typeof possibleId === "string" &&
    possibleId.trim()
    ? possibleId
    : null;
};

const uniqueCollectionIds = (
  collectionIds: Array<
    string | null | undefined
  >,
): string[] =>
  Array.from(
    new Set(
      collectionIds
        .filter(
          (collectionId): collectionId is string =>
            typeof collectionId === "string",
        )
        .map((collectionId) =>
          collectionId.trim(),
        )
        .filter(Boolean),
    ),
  );

const inferWatchedCollections = (
  fn: Function,
  cacheKey?: string,
): string[] => {
  const searchable = [
    cacheKey ?? "",
    fn.name ?? "",
    String(fn),
  ]
    .join(" ")
    .toLowerCase();

  const collectionIds: Array<
    string | null | undefined
  > = [];

  const addWhenMatched = (
    terms: string[],
    collectionId?: string,
  ) => {
    if (
      collectionId &&
      terms.some((term) =>
        searchable.includes(term),
      )
    ) {
      collectionIds.push(collectionId);
    }
  };

  addWhenMatched(
    [
      "propert",
      "listing",
      "map_pin",
      "popular_location",
      "trending",
      "hotdeal",
      "hot_deal",
    ],
    config.propertiesCollectionId,
  );
  addWhenMatched(
    ["notification"],
    config.notificationsCollectionId,
  );
  addWhenMatched(
    ["request"],
    config.requestsCollectionId,
  );
  addWhenMatched(
    ["favorite"],
    config.favoritesCollectionId,
  );
  addWhenMatched(
    ["review"],
    config.reviewsCollectionId,
  );
  addWhenMatched(
    ["match"],
    config.matchProfilesCollectionId,
  );
  addWhenMatched(
    ["organization"],
    config.organizationsCollectionId,
  );
  addWhenMatched(
    ["tenantprofile", "tenant_profile"],
    config.tenantProfilesCollectionId,
  );

  if (
    searchable.includes("like") &&
    config.likesCollectionId
  ) {
    collectionIds.push(config.likesCollectionId);

    if (config.propertiesCollectionId) {
      collectionIds.push(
        config.propertiesCollectionId,
      );
    }
  }

  if (
    ["landlord", "agent", "userprofile"].some(
      (term) => searchable.includes(term),
    )
  ) {
    collectionIds.push(
      config.usersCollectionId,
      config.landlordsCollectionId,
    );
  }

  return uniqueCollectionIds(collectionIds);
};

export const clearUseAppwriteMemoryCache = (
  namespace?: string | null,
): void => {
  if (!namespace) {
    memoryCache.clear();
    inFlightRequests.clear();
    return;
  }

  const prefix = `${namespace}:`;

  Array.from(memoryCache.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => memoryCache.delete(key));

  Array.from(inFlightRequests.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) =>
      inFlightRequests.delete(key),
    );
};

export const useAppwrite = <
  T,
  P extends Record<string, any>,
>({
  fn,
  params = {} as P,
  skip = false,
  cacheKey,
  persist = true,
  watchCollections,
}: UseAppwriteOptions<T, P>) => {
  const isMounted = useRef(true);
  const paramsRef = useRef(params);
  const fnRef = useRef(fn);
  const dataRef = useRef<T | null>(null);
  const changeRefreshTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  paramsRef.current = params;
  fnRef.current = fn;

  const namespace =
    useAuthStore(
      (state) => state.user?.accountId,
    ) ?? "anonymous";

  const paramsSignature = stableStringify(params);

  const logicalKey = useMemo(() => {
    if (cacheKey) return cacheKey;

    const fnName = fn.name || "query";
    return `${fnName}_${paramsSignature}`;
  }, [cacheKey, fn.name, paramsSignature]);

  const inferredCollections = useMemo(
    () => inferWatchedCollections(fn, cacheKey),
    [cacheKey, fn],
  );

  const watchedCollections = useMemo(
    () =>
      uniqueCollectionIds([
        ...(watchCollections ?? []),
        ...inferredCollections,
      ]),
    [inferredCollections, watchCollections],
  );

  const watchedCollectionsKey =
    watchedCollections.join("|");

  const [data, setData] =
    useState<T | null>(null);
  const [loading, setLoading] =
    useState<boolean>(!skip);
  const [error, setError] =
    useState<string | null>(null);
  const [isOffline, setIsOffline] =
    useState(false);
  const [fromCache, setFromCache] =
    useState(false);

  const safelySetData = useCallback(
    (nextData: T, cached: boolean) => {
      if (!isMounted.current) return;

      dataRef.current = nextData;
      setData(nextData);
      setFromCache(cached);
      setLoading(false);
      setError(null);
    },
    [],
  );

  const loadCachedData = useCallback(
    async (
      fetchParams: P,
      queryKey: string,
      queryNamespace: string,
    ): Promise<{
      data: T;
      savedAt: number;
    } | null> => {
      const memoryKey =
        `${queryNamespace}:${queryKey}`;
      const memoryEntry = memoryCache.get(
        memoryKey,
      ) as MemoryCacheEntry<T> | undefined;

      if (memoryEntry) {
        return {
          data: memoryEntry.data,
          savedAt: memoryEntry.timestamp,
        };
      }

      if (persist) {
        const persistentEntry =
          await readPersistentQueryCache<T>(
            queryKey,
            queryNamespace,
          );

        if (persistentEntry) {
          memoryCache.set(memoryKey, {
            data: persistentEntry.data,
            timestamp: persistentEntry.savedAt,
          });

          return persistentEntry;
        }
      }

      const propertyId =
        getPropertyIdFromParams(fetchParams);

      if (persist && propertyId) {
        const propertyEntry =
          await readCachedPropertyEntity<T>(
            propertyId,
            queryNamespace,
          );

        if (propertyEntry) {
          memoryCache.set(memoryKey, {
            data: propertyEntry.data,
            timestamp: propertyEntry.savedAt,
          });

          return propertyEntry;
        }
      }

      return null;
    },
    [persist],
  );

  const executeNetworkRequest = useCallback(
    async (
      fetchParams: P,
      queryKey: string,
      queryNamespace: string,
    ): Promise<T> => {
      const requestKey =
        `${queryNamespace}:${queryKey}`;
      const existing =
        inFlightRequests.get(requestKey) as
          | Promise<T>
          | undefined;

      if (existing) return existing;

      const request = fnRef.current(fetchParams);
      inFlightRequests.set(requestKey, request);

      try {
        return await request;
      } finally {
        inFlightRequests.delete(requestKey);
      }
    },
    [],
  );

  const fetchData = useCallback(
    async (
      fetchParams: P,
      mode: FetchMode = "auto",
    ) => {
      const queryKey = cacheKey
        ? cacheKey
        : `${fnRef.current.name || "query"}_${stableStringify(
            fetchParams,
          )}`;
      const queryNamespace = namespace;
      const memoryKey =
        `${queryNamespace}:${queryKey}`;

      if (
        isMounted.current &&
        dataRef.current === null
      ) {
        setLoading(true);
      }

      if (isMounted.current) {
        setError(null);
      }

      const cachedEntry =
        await loadCachedData(
          fetchParams,
          queryKey,
          queryNamespace,
        );

      if (cachedEntry) {
        safelySetData(cachedEntry.data, true);
      }

      let networkState;

      try {
        networkState = await NetInfo.fetch();
      } catch {
        networkState = {
          isConnected: false,
          isInternetReachable: false,
        };
      }

      const online =
        isConnectedState(networkState);

      if (isMounted.current) {
        setIsOffline(!online);
      }

      if (!online) {
        if (
          !cachedEntry &&
          isMounted.current
        ) {
          setLoading(false);
          setError(
            "No saved data is available for this screen yet. Open it once while online.",
          );
        }

        return;
      }

      let databaseChanged = false;

      if (watchedCollections.length > 0) {
        const latestChangedAt =
          await getLatestCollectionChangedAt(
            watchedCollections,
            queryNamespace,
          );

        databaseChanged =
          !!cachedEntry &&
          latestChangedAt > cachedEntry.savedAt;

        if (
          mode === "auto" ||
          mode === "reconnect"
        ) {
          const statuses =
            await checkCollectionsForRemoteChanges(
              watchedCollections,
              queryNamespace,
              mode === "reconnect",
            );

          databaseChanged =
            databaseChanged ||
            statuses.some(
              (status) =>
                status === "changed" ||
                status === "unknown",
            );
        }
      }

      const shouldFetch =
        mode === "force" ||
        mode === "database-change" ||
        !cachedEntry ||
        databaseChanged;

      if (!shouldFetch) {
        if (isMounted.current) {
          setLoading(false);
        }
        return;
      }

      try {
        const result =
          await executeNetworkRequest(
            fetchParams,
            queryKey,
            queryNamespace,
          );

        if (!isMounted.current) return;

        const timestamp = Date.now();
        memoryCache.set(memoryKey, {
          data: result,
          timestamp,
        });
        safelySetData(result, false);

        if (persist) {
          await writePersistentQueryCache(
            queryKey,
            result,
            queryNamespace,
          );
        }

        if (watchedCollections.length > 0) {
          void refreshCollectionVersionBaselines(
            watchedCollections,
            queryNamespace,
          );
        }
      } catch (fetchError: any) {
        const fallback =
          cachedEntry ??
          (await loadCachedData(
            fetchParams,
            queryKey,
            queryNamespace,
          ));

        if (fallback) {
          safelySetData(fallback.data, true);
        } else if (isMounted.current) {
          setLoading(false);
          setError(
            fetchError?.message ||
              "Failed to fetch data.",
          );
        }

        console.error(
          `[useAppwrite ${queryKey}]`,
          fetchError,
        );
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [
      cacheKey,
      executeNetworkRequest,
      loadCachedData,
      namespace,
      persist,
      safelySetData,
      watchedCollections,
    ],
  );

  useEffect(() => {
    isMounted.current = true;
    startAppwriteRealtimeCache(namespace);

    if (!skip) {
      void fetchData(
        paramsRef.current,
        "auto",
      );
    } else {
      setLoading(false);
    }

    return () => {
      isMounted.current = false;

      if (changeRefreshTimerRef.current) {
        clearTimeout(
          changeRefreshTimerRef.current,
        );
      }
    };
  }, [
    fetchData,
    logicalKey,
    namespace,
    skip,
    watchedCollectionsKey,
  ]);

  useEffect(() => {
    if (
      skip ||
      watchedCollections.length === 0
    ) {
      return undefined;
    }

    return subscribeToAppwriteCollectionChanges(
      watchedCollections,
      () => {
        if (
          changeRefreshTimerRef.current
        ) {
          clearTimeout(
            changeRefreshTimerRef.current,
          );
        }

        changeRefreshTimerRef.current =
          setTimeout(() => {
            void fetchData(
              paramsRef.current,
              "database-change",
            );
          }, 250);
      },
    );
  }, [
    fetchData,
    skip,
    watchedCollections,
    watchedCollectionsKey,
  ]);

  useEffect(() => {
    if (skip) return undefined;

    return subscribeToAppwriteReconnect(
      () => {
        void fetchData(
          paramsRef.current,
          "reconnect",
        );
      },
    );
  }, [fetchData, skip]);

  useEffect(() => {
    if (skip) return undefined;

    const unsubscribe =
      NetInfo.addEventListener((state) => {
        if (isMounted.current) {
          setIsOffline(
            !isConnectedState(state),
          );
        }
      });

    return unsubscribe;
  }, [skip]);

  const refetch = useCallback(
    async (newParams?: P) => {
      const finalParams =
        newParams ?? paramsRef.current;
      paramsRef.current = finalParams;

      await fetchData(
        finalParams,
        "force",
      );
    },
    [fetchData],
  );

  const load = useCallback(
    async (newParams?: P) => {
      const finalParams =
        newParams ?? paramsRef.current;
      paramsRef.current = finalParams;

      await fetchData(
        finalParams,
        "auto",
      );
    },
    [fetchData],
  );

  return {
    data,
    loading,
    error,
    refetch,
    load,
    isOffline,
    fromCache,
  };
};
