import AsyncStorage from "@react-native-async-storage/async-storage";

import type { POI } from "@/lib/poiService";
import type { DrivingRoute } from "@/lib/routingService";

const POI_FAVORITES_KEY = "@nookly:poi-offline-favorites:v1";

export interface OfflinePOIFavorite {
  id: string;
  poi: POI;
  propertyName: string;
  propertyLatitude: number;
  propertyLongitude: number;
  savedAt: number;
  route?: DrivingRoute;
  routeSavedAt?: number;
}

export interface SavePOIFavoriteInput {
  poi: POI;
  propertyName: string;
  propertyLatitude: number;
  propertyLongitude: number;
}

type FavoritesListener = (favorites: OfflinePOIFavorite[]) => void;

const listeners = new Set<FavoritesListener>();
let memoryFavorites: OfflinePOIFavorite[] | null = null;
let mutationQueue: Promise<void> = Promise.resolve();

const isFiniteCoordinate = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const normalizeName = (value: string | undefined) =>
  value?.trim() || "Property";

export const buildPOIFavoriteId = (
  propertyLatitude: number,
  propertyLongitude: number,
  poiId: string,
) =>
  `${propertyLatitude.toFixed(5)}:${propertyLongitude.toFixed(5)}:${poiId}`;

const sanitizeFavorites = (value: unknown): OfflinePOIFavorite[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is OfflinePOIFavorite => {
      if (!item || typeof item !== "object") return false;

      const candidate = item as Partial<OfflinePOIFavorite>;
      return (
        typeof candidate.id === "string" &&
        typeof candidate.savedAt === "number" &&
        !!candidate.poi &&
        typeof candidate.poi.id === "string" &&
        isFiniteCoordinate(candidate.propertyLatitude) &&
        isFiniteCoordinate(candidate.propertyLongitude)
      );
    })
    .sort((first, second) => second.savedAt - first.savedAt);
};

const notifyListeners = (favorites: OfflinePOIFavorite[]) => {
  const snapshot = [...favorites];
  for (const listener of listeners) listener(snapshot);
};

const persistFavorites = async (favorites: OfflinePOIFavorite[]) => {
  const sorted = [...favorites].sort(
    (first, second) => second.savedAt - first.savedAt,
  );

  memoryFavorites = sorted;
  await AsyncStorage.setItem(POI_FAVORITES_KEY, JSON.stringify(sorted));
  notifyListeners(sorted);
};

const runMutation = async <T>(mutation: () => Promise<T>): Promise<T> => {
  let result!: T;
  let failure: unknown;

  mutationQueue = mutationQueue.then(async () => {
    try {
      result = await mutation();
    } catch (error) {
      failure = error;
    }
  });

  await mutationQueue;
  if (failure) throw failure;
  return result;
};

export const getOfflinePOIFavorites = async (): Promise<
  OfflinePOIFavorite[]
> => {
  if (memoryFavorites) return [...memoryFavorites];

  try {
    const raw = await AsyncStorage.getItem(POI_FAVORITES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const favorites = sanitizeFavorites(parsed);
    memoryFavorites = favorites;
    return [...favorites];
  } catch (error) {
    console.warn("Unable to load offline POI favorites:", error);
    memoryFavorites = [];
    return [];
  }
};

export const subscribeToOfflinePOIFavorites = (
  listener: FavoritesListener,
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const savePOIFavorite = async (
  input: SavePOIFavoriteInput,
): Promise<OfflinePOIFavorite> =>
  runMutation(async () => {
    const favorites = await getOfflinePOIFavorites();
    const id = buildPOIFavoriteId(
      input.propertyLatitude,
      input.propertyLongitude,
      input.poi.id,
    );
    const existing = favorites.find((favorite) => favorite.id === id);

    const favorite: OfflinePOIFavorite = {
      id,
      poi: input.poi,
      propertyName: normalizeName(input.propertyName),
      propertyLatitude: input.propertyLatitude,
      propertyLongitude: input.propertyLongitude,
      savedAt: existing?.savedAt ?? Date.now(),
      route: existing?.route,
      routeSavedAt: existing?.routeSavedAt,
    };

    await persistFavorites([
      favorite,
      ...favorites.filter((item) => item.id !== id),
    ]);

    return favorite;
  });

export const removePOIFavorite = async (favoriteId: string): Promise<void> =>
  runMutation(async () => {
    const favorites = await getOfflinePOIFavorites();
    await persistFavorites(
      favorites.filter((favorite) => favorite.id !== favoriteId),
    );
  });

export const togglePOIFavorite = async (
  input: SavePOIFavoriteInput,
): Promise<{ saved: boolean; favorite: OfflinePOIFavorite | null }> =>
  runMutation(async () => {
    const favorites = await getOfflinePOIFavorites();
    const id = buildPOIFavoriteId(
      input.propertyLatitude,
      input.propertyLongitude,
      input.poi.id,
    );
    const existing = favorites.find((favorite) => favorite.id === id);

    if (existing) {
      await persistFavorites(
        favorites.filter((favorite) => favorite.id !== id),
      );
      return { saved: false, favorite: null };
    }

    const favorite: OfflinePOIFavorite = {
      id,
      poi: input.poi,
      propertyName: normalizeName(input.propertyName),
      propertyLatitude: input.propertyLatitude,
      propertyLongitude: input.propertyLongitude,
      savedAt: Date.now(),
    };

    await persistFavorites([favorite, ...favorites]);
    return { saved: true, favorite };
  });

export const savePOIRouteOffline = async (
  input: SavePOIFavoriteInput,
  route: DrivingRoute,
): Promise<OfflinePOIFavorite> =>
  runMutation(async () => {
    const favorites = await getOfflinePOIFavorites();
    const id = buildPOIFavoriteId(
      input.propertyLatitude,
      input.propertyLongitude,
      input.poi.id,
    );
    const existing = favorites.find((favorite) => favorite.id === id);
    const now = Date.now();

    const favorite: OfflinePOIFavorite = {
      id,
      poi: input.poi,
      propertyName: normalizeName(input.propertyName),
      propertyLatitude: input.propertyLatitude,
      propertyLongitude: input.propertyLongitude,
      savedAt: existing?.savedAt ?? now,
      route: {
        ...route,
        coordinates: route.coordinates.map(([latitude, longitude]) => [
          latitude,
          longitude,
        ]),
        source: "cache",
        savedAt: now,
      },
      routeSavedAt: now,
    };

    await persistFavorites([
      favorite,
      ...favorites.filter((item) => item.id !== id),
    ]);

    return favorite;
  });

export const clearOfflinePOIFavorites = async (): Promise<void> =>
  runMutation(async () => {
    memoryFavorites = [];
    await AsyncStorage.removeItem(POI_FAVORITES_KEY);
    notifyListeners([]);
  });
