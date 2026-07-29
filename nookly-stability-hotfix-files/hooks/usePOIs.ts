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

const hasValidCoordinates = (
  latitude?: number | null,
  longitude?: number | null,
): latitude is number =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === "number" &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

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

      if (!hasValidCoordinates(latitude, longitude)) {
        setPois([]);
        setAmenities(null);
        setError(null);
        setLoading(false);
        return;
      }

      const requestedRadius = radiusOverride ?? radiusKm;
      const requestedCategories = categoryKey ? categoryKey.split("|") : undefined;

      setLoading(true);
      setError(null);

      try {
        const fetchedPOIs = await getPOIs(
          latitude,
          longitude,
          requestedRadius,
          requestedCategories,
          forceRefresh,
        );

        if (requestId !== requestIdRef.current) return;

        setPois(fetchedPOIs);
        setAmenities(
          calculatePropertyAmenities(
            fetchedPOIs,
            latitude,
            longitude,
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
