// lib/useCachedData.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import { dataCache } from "./cache";

interface UseCachedDataOptions {
  ttl?: number; // Time to live in milliseconds
  skip?: boolean; // Skip initial fetch
  revalidateOnFocus?: boolean; // Revalidate when app comes to foreground
  revalidateOnMount?: boolean; // Revalidate when component mounts
  staleWhileRevalidate?: boolean; // Show stale data while fetching fresh
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export function useCachedData<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: UseCachedDataOptions = {},
) {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    skip = false,
    revalidateOnFocus = true,
    revalidateOnMount = true,
    staleWhileRevalidate = true,
    onSuccess,
    onError,
  } = options;

  const [data, setData] = useState<T>([] as T);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<Error | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isMounted = useRef(true);
  const isFetching = useRef(false);

  const fetchData = useCallback(
    async (force = false) => {
      if (skip || isFetching.current) return;

      isFetching.current = true;

      try {
        // Check cache first
        const cached = await dataCache.get<T>(key);

        if (cached && !force) {
          // Show cached data immediately (stale-while-revalidate)
          if (staleWhileRevalidate) {
            setData(cached);
            setLoading(false);
            setIsStale(true);
          } else {
            setData(cached);
            setLoading(false);
          }
        }

        // Always fetch fresh data in background (stale-while-revalidate)
        if (revalidateOnMount || force || !cached) {
          setLoading(true);
          const freshData = await fetchFn();

          if (isMounted.current) {
            setData(freshData);
            setError(null);
            setIsStale(false);
            await dataCache.set(key, freshData, ttl);
            onSuccess?.(freshData);
          }
        }
      } catch (err) {
        console.error(`Error fetching data for ${key}:`, err);
        if (isMounted.current) {
          setError(err as Error);
          onError?.(err as Error);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
        isFetching.current = false;
      }
    },
    [
      key,
      fetchFn,
      skip,
      ttl,
      staleWhileRevalidate,
      revalidateOnMount,
      onSuccess,
      onError,
    ],
  );

  // Initial fetch
  useEffect(() => {
    if (!skip) {
      fetchData();
    }

    return () => {
      isMounted.current = false;
    };
  }, [fetchData, skip]);

  // Revalidate on app focus
  useEffect(() => {
    if (!revalidateOnFocus) return;

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        console.log(`🔄 Revalidating ${key} on app focus`);
        fetchData(true);
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange,
    );
    return () => subscription.remove();
  }, [fetchData, revalidateOnFocus, key]);

  // Manual refresh function
  const refresh = useCallback(() => {
    console.log(`🔄 Manual refresh for ${key}`);
    return fetchData(true);
  }, [fetchData]);

  // Clear cache for this key
  const clearCache = useCallback(() => {
    dataCache.invalidate(key);
  }, [key]);

  return {
    data,
    loading,
    error,
    isStale,
    refresh,
    clearCache,
  };
}
