// hooks/usePOIs.ts
import { calculatePropertyAmenities, clearPOICache, getPOIs, POI, PropertyAmenities } from '@/lib/poiService';
import { useCallback, useEffect, useState } from 'react';

interface UsePOIsResult {
  pois: POI[];
  amenities: PropertyAmenities | null;
  loading: boolean;
  error: string | null;
  refetch: (radius?: number) => Promise<void>;
  clearCache: () => void;
}

export const usePOIs = (
  latitude?: number | null,
  longitude?: number | null,
  radiusKm: number = 3,
  categoryIds?: string[]
): UsePOIsResult => {
  const [pois, setPois] = useState<POI[]>([]);
  const [amenities, setAmenities] = useState<PropertyAmenities | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (radius?: number) => {
    if (!latitude || !longitude) {
      setPois([]);
      setAmenities(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedPois = await getPOIs(latitude, longitude, radius || radiusKm, categoryIds);
      setPois(fetchedPois);
      
      const calculatedAmenities = calculatePropertyAmenities(
        fetchedPois,
        latitude,
        longitude,
        radius || radiusKm
      );
      setAmenities(calculatedAmenities);
    } catch (err) {
      console.error('Error fetching POIs:', err);
      setError('Failed to load nearby amenities');
      setPois([]);
      setAmenities(null);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radiusKm, categoryIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async (radius?: number) => {
    await fetchData(radius);
  }, [fetchData]);

  const clearCache = useCallback(() => {
    clearPOICache();
  }, []);

  return { pois, amenities, loading, error, refetch, clearCache };
};