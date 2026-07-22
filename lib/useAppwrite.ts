// lib/useAppwrite.ts - Fixed + TS Safe
import { useCallback, useEffect, useRef, useState } from "react";

interface UseAppwriteOptions<T, P extends Record<string, any>> {
  fn: (params: P) => Promise<T>;
  params?: P;
  skip?: boolean;
  ttl?: number;
  cacheKey?: string;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL = 30 * 1000;

export const useAppwrite = <T, P extends Record<string, any>>({
  fn,
  params = {} as P,
  skip = false,
  ttl = DEFAULT_TTL,
  cacheKey,
}: UseAppwriteOptions<T, P>) => {
  const isMounted = useRef(true);

  const getCacheKey = useCallback(
    (p: P, customKey?: string): string => {
      if (customKey) return customKey;
      const fnName = fn.name || "query";
      return `${fnName}_${JSON.stringify(p)}`;
    },
    [fn, cacheKey],
  );

  const initialKey = getCacheKey(params, cacheKey);
  const cachedEntry = cache.get(initialKey) as CacheEntry | undefined;
  const hasFreshCache =
    !!cachedEntry && Date.now() - cachedEntry.timestamp < ttl;

  const [data, setData] = useState<T | null>(
    hasFreshCache ? (cachedEntry!.data as T) : null,
  );
  const [loading, setLoading] = useState<boolean>(!skip && !hasFreshCache);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (fetchParams: P, forceRefresh = false) => {
      const finalKey: string = getCacheKey(fetchParams, cacheKey);

      if (!forceRefresh) {
        const c = cache.get(finalKey);
        if (c && Date.now() - c.timestamp < ttl) {
          if (isMounted.current) {
            setData(c.data as T);
            setLoading(false);
          }
          return;
        }
      }

      if (isMounted.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await fn(fetchParams);
        if (!isMounted.current) return;

        setData(result);
        cache.set(finalKey, { data: result, timestamp: Date.now() });
      } catch (err: any) {
        if (!isMounted.current) return;
        setError(err?.message || "Failed to fetch");
        console.error(`[useAppwrite ${finalKey}]`, err);
      } finally {
        if (isMounted.current) setLoading(false);
      }
    },
    [fn, ttl, getCacheKey, cacheKey],
  );

  useEffect(() => {
    isMounted.current = true;
    if (!skip) {
      fetchData(params);
    }
    return () => {
      isMounted.current = false;
    };
  }, [skip]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(
    async (newParams: P) => {
      await fetchData(newParams, true);
    },
    [fetchData],
  );

  return { data, loading, error, refetch };
};
