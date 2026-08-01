import {
  calculatePropertyAmenities,
  clearPOICache,
  getPOIs,
  type POI,
  type PropertyAmenities,
} from "@/lib/poiService";
import { useCallback, useEffect, useRef, useState } from "react";

interface UsePOIsResult {
  pois: POI[];
  amenities: PropertyAmenities | null;
  loading: boolean;
  error: string | null;
  refetch: (radius?: number) => Promise<void>;
  clearCache: () => void;
}

const isValidLatitude = (
  value?: number | null,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -90 &&
  value <= 90;

const isValidLongitude = (
  value?: number | null,
): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= -180 &&
  value <= 180;

export const usePOIs = (
  latitude?: number | null,
  longitude?: number | null,
  radiusKm = 3,
  categoryIds?: string[],
): UsePOIsResult => {
  const [pois, setPois] = useState<POI[]>([]);
  const [amenities, setAmenities] = useState<PropertyAmenities | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const categoryKey = [...(categoryIds ?? [])].sort().join("|");

  const fetchData = useCallback(
    async (radiusOverride?: number, forceRefresh = false) => {
      const requestId = ++requestIdRef.current;

      if (
        !isValidLatitude(latitude) ||
        !isValidLongitude(longitude)
      ) {
        setPois([]);
        setAmenities(null);
        setError(null);
        setLoading(false);
        return;
      }

      const resolvedLatitude = latitude;
      const resolvedLongitude = longitude;
      const requestedRadius = radiusOverride ?? radiusKm;
      const requestedCategories = categoryKey ? categoryKey.split("|") : undefined;

      setLoading(true);
      setError(null);

      try {
        const fetchedPOIs = await getPOIs(
          resolvedLatitude,
          resolvedLongitude,
          requestedRadius,
          requestedCategories,
          forceRefresh,
        );

        if (requestId !== requestIdRef.current) return;

        setPois(fetchedPOIs);
        setAmenities(
          calculatePropertyAmenities(
            fetchedPOIs,
            resolvedLatitude,
            resolvedLongitude,
            requestedRadius,
          ),
        );
      } catch (caughtError) {
        if (requestId !== requestIdRef.current) return;

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to load nearby amenities.";
        console.warn("Nearby amenities unavailable:", message);
        setError(message);
        setPois([]);
        setAmenities(null);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [categoryKey, latitude, longitude, radiusKm],
  );

  useEffect(() => {
    void fetchData();
    return () => {
      requestIdRef.current += 1;
    };
  }, [fetchData]);

  const refetch = useCallback(
    async (radius?: number) => {
      await fetchData(radius, true);
    },
    [fetchData],
  );

  const clearCache = useCallback(() => {
    clearPOICache();
  }, []);

  return { pois, amenities, loading, error, refetch, clearCache };
};
