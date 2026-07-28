import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  readCachedPropertyEntity,
  readPersistentQueryCache,
  stableStringify,
  writePersistentQueryCache,
} from "@/lib/persistentQueryCache";
import useAuthStore from "@/store/auth.store";

interface UseAppwriteOptions<T, P extends Record<string, any>> {
  fn: (params: P) => Promise<T>;
  params?: P;
  skip?: boolean;
  ttl?: number;
  cacheKey?: string;
  persist?: boolean;
}

interface MemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, MemoryCacheEntry<any>>();
const DEFAULT_TTL = 30 * 1000;

const isConnectedState = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean =>
  state.isConnected === true && state.isInternetReachable !== false;

const getPropertyIdFromParams = (
  params: Record<string, any>,
): string | null => {
  const possibleId = params?.id ?? params?.propertyId;

  return typeof possibleId === "string" && possibleId.trim()
    ? possibleId
    : null;
};

export const useAppwrite = <T, P extends Record<string, any>>({
  fn,
  params = {} as P,
  skip = false,
  ttl = DEFAULT_TTL,
  cacheKey,
  persist = true,
}: UseAppwriteOptions<T, P>) => {
  const isMounted = useRef(true);
  const paramsRef = useRef(params);
  const dataRef = useRef<T | null>(null);
  const wasOfflineRef = useRef(false);

  paramsRef.current = params;

  const buildLogicalKey = useCallback(
    (fetchParams: P): string => {
      if (cacheKey) return cacheKey;

      const fnName = fn.name || "query";
      return `${fnName}_${stableStringify(fetchParams)}`;
    },
    [cacheKey, fn],
  );

  const getNamespace = useCallback(
    () => useAuthStore.getState().user?.accountId ?? "anonymous",
    [],
  );

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(!skip);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

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
      logicalKey: string,
      namespace: string,
    ): Promise<{ data: T; savedAt: number } | null> => {
      const memoryKey = `${namespace}:${logicalKey}`;
      const memoryEntry = memoryCache.get(memoryKey) as
        | MemoryCacheEntry<T>
        | undefined;

      if (memoryEntry) {
        return {
          data: memoryEntry.data,
          savedAt: memoryEntry.timestamp,
        };
      }

      if (persist) {
        const persistentEntry = await readPersistentQueryCache<T>(
          logicalKey,
          namespace,
        );

        if (persistentEntry) {
          memoryCache.set(memoryKey, {
            data: persistentEntry.data,
            timestamp: persistentEntry.savedAt,
          });

          return persistentEntry;
        }
      }

      const propertyId = getPropertyIdFromParams(fetchParams);

      if (persist && propertyId) {
        const propertyEntry = await readCachedPropertyEntity<T>(
          propertyId,
          namespace,
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

  const fetchData = useCallback(
    async (fetchParams: P, forceRefresh = false) => {
      const logicalKey = buildLogicalKey(fetchParams);
      const namespace = getNamespace();
      const memoryKey = `${namespace}:${logicalKey}`;

      if (isMounted.current && dataRef.current === null) {
        setLoading(true);
      }

      if (isMounted.current) {
        setError(null);
      }

      const cachedEntry = await loadCachedData(
        fetchParams,
        logicalKey,
        namespace,
      );
      const cacheIsFresh =
        cachedEntry !== null && Date.now() - cachedEntry.savedAt < ttl;

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

      const online = isConnectedState(networkState);

      if (isMounted.current) {
        setIsOffline(!online);
      }

      if (!online) {
        wasOfflineRef.current = true;

        if (!cachedEntry && isMounted.current) {
          setLoading(false);
          setError(
            "No saved data is available for this screen yet. Open it once while online.",
          );
        }

        return;
      }

      if (!forceRefresh && cacheIsFresh) {
        wasOfflineRef.current = false;
        return;
      }

      try {
        const result = await fn(fetchParams);

        if (!isMounted.current) return;

        const timestamp = Date.now();
        memoryCache.set(memoryKey, { data: result, timestamp });
        safelySetData(result, false);

        if (persist) {
          await writePersistentQueryCache(logicalKey, result, namespace);
        }

        wasOfflineRef.current = false;
      } catch (fetchError: any) {
        const fallback =
          cachedEntry ??
          (await loadCachedData(fetchParams, logicalKey, namespace));

        if (fallback) {
          safelySetData(fallback.data, true);
        } else if (isMounted.current) {
          setLoading(false);
          setError(fetchError?.message || "Failed to fetch data.");
        }

        console.error(`[useAppwrite ${logicalKey}]`, fetchError);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [
      buildLogicalKey,
      fn,
      getNamespace,
      loadCachedData,
      persist,
      safelySetData,
      ttl,
    ],
  );

  useEffect(() => {
    isMounted.current = true;

    if (!skip) {
      void fetchData(paramsRef.current);
    } else {
      setLoading(false);
    }

    return () => {
      isMounted.current = false;
    };
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (skip) return undefined;

    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = isConnectedState(state);

      if (isMounted.current) {
        setIsOffline(!online);
      }

      if (!online) {
        wasOfflineRef.current = true;
        return;
      }

      if (wasOfflineRef.current) {
        wasOfflineRef.current = false;
        void fetchData(paramsRef.current, true);
      }
    });

    return unsubscribe;
  }, [fetchData, skip]);

  const refetch = useCallback(
    async (newParams?: P) => {
      const finalParams = newParams ?? paramsRef.current;
      paramsRef.current = finalParams;
      await fetchData(finalParams, true);
    },
    [fetchData],
  );

  return {
    data,
    loading,
    error,
    refetch,
    isOffline,
    fromCache,
  };
};
