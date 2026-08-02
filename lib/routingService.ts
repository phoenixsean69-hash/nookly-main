import AsyncStorage from "@react-native-async-storage/async-storage";

export interface DrivingRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
  source?: "network" | "cache";
  savedAt?: number;
}

interface OSRMRouteResponse {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: [number, number][];
    };
  }>;
}

interface CachedDrivingRoute {
  savedAt: number;
  route: DrivingRoute;
}

const ROUTING_TIMEOUT_MS = 20_000;
const ROUTE_CACHE_PREFIX = "@nookly:driving-route:v1:";
const memoryRouteCache = new Map<string, CachedDrivingRoute>();
const inFlightRoutes = new Map<string, Promise<DrivingRoute>>();

const validateCoordinate = (
  latitude: number,
  longitude: number,
  label: string,
) => {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error(`${label} coordinates are invalid.`);
  }
};

const getRouteCacheKey = (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
) =>
  `${ROUTE_CACHE_PREFIX}${startLatitude.toFixed(5)}:${startLongitude.toFixed(
    5,
  )}:${destinationLatitude.toFixed(5)}:${destinationLongitude.toFixed(5)}`;

const sanitizeRoute = (value: unknown): DrivingRoute | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<DrivingRoute>;
  if (
    !Array.isArray(candidate.coordinates) ||
    candidate.coordinates.length < 2 ||
    typeof candidate.distanceKm !== "number" ||
    typeof candidate.durationMinutes !== "number"
  ) {
    return null;
  }

  const coordinates = candidate.coordinates.filter(
    (coordinate): coordinate is [number, number] =>
      Array.isArray(coordinate) &&
      coordinate.length === 2 &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1]),
  );

  if (coordinates.length < 2) return null;

  return {
    coordinates,
    distanceKm: candidate.distanceKm,
    durationMinutes: candidate.durationMinutes,
    source: "cache",
    savedAt:
      typeof candidate.savedAt === "number" ? candidate.savedAt : undefined,
  };
};

export const getCachedDrivingRoute = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): Promise<DrivingRoute | null> => {
  validateCoordinate(startLatitude, startLongitude, "Property");
  validateCoordinate(
    destinationLatitude,
    destinationLongitude,
    "Destination",
  );

  const key = getRouteCacheKey(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  );
  const memoryEntry = memoryRouteCache.get(key);

  if (memoryEntry) {
    return {
      ...memoryEntry.route,
      source: "cache",
      savedAt: memoryEntry.savedAt,
    };
  }

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedDrivingRoute>;
    const route = sanitizeRoute(parsed.route);
    if (typeof parsed.savedAt !== "number" || !route) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const entry: CachedDrivingRoute = {
      savedAt: parsed.savedAt,
      route: {
        ...route,
        source: "cache",
        savedAt: parsed.savedAt,
      },
    };

    memoryRouteCache.set(key, entry);
    return entry.route;
  } catch (error) {
    console.warn("Unable to read the offline route cache:", error);
    return null;
  }
};

export const saveDrivingRouteOffline = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
  route: DrivingRoute,
): Promise<DrivingRoute> => {
  validateCoordinate(startLatitude, startLongitude, "Property");
  validateCoordinate(
    destinationLatitude,
    destinationLongitude,
    "Destination",
  );

  const cleanRoute = sanitizeRoute(route);
  if (!cleanRoute) throw new Error("The driving route is invalid.");

  const key = getRouteCacheKey(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  );
  const savedAt = Date.now();
  const entry: CachedDrivingRoute = {
    savedAt,
    route: {
      ...cleanRoute,
      source: "cache",
      savedAt,
    },
  };

  memoryRouteCache.set(key, entry);
  await AsyncStorage.setItem(key, JSON.stringify(entry));
  return entry.route;
};

const requestDrivingRoute = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): Promise<DrivingRoute> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ROUTING_TIMEOUT_MS);

  const coordinates =
    `${startLongitude},${startLatitude};` +
    `${destinationLongitude},${destinationLatitude}`;

  const url =
    `https://router.project-osrm.org/route/v1/driving/${coordinates}` +
    "?alternatives=false&steps=false&overview=full&geometries=geojson";

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Route server returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as OSRMRouteResponse;
    const route = payload.routes?.[0];
    const geometry = route?.geometry?.coordinates;

    if (
      payload.code !== "Ok" ||
      !route ||
      !Array.isArray(geometry) ||
      geometry.length < 2
    ) {
      throw new Error(
        payload.message || "No driving route was found for this destination.",
      );
    }

    return {
      coordinates: geometry.map(([longitude, latitude]) => [
        latitude,
        longitude,
      ]),
      distanceKm: (route.distance || 0) / 1000,
      durationMinutes: (route.duration || 0) / 60,
      source: "network",
    };
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("abort"));

    if (aborted) {
      throw new Error("The route server took too long to respond.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export const getDrivingRoute = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
  forceRefresh = false,
): Promise<DrivingRoute> => {
  validateCoordinate(startLatitude, startLongitude, "Property");
  validateCoordinate(
    destinationLatitude,
    destinationLongitude,
    "Destination",
  );

  const key = getRouteCacheKey(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  );
  const cached = await getCachedDrivingRoute(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  );

  if (!forceRefresh && cached) {
    console.log("📦 Driving route loaded from offline cache");
    return cached;
  }

  const existingRequest = inFlightRoutes.get(key);
  if (existingRequest) return existingRequest;

  const request = requestDrivingRoute(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  )
    .then(async (route) => {
      const saved = await saveDrivingRouteOffline(
        startLatitude,
        startLongitude,
        destinationLatitude,
        destinationLongitude,
        route,
      );

      return {
        ...saved,
        source: "network" as const,
      };
    })
    .catch((error) => {
      if (cached) return cached;
      throw error;
    })
    .finally(() => {
      inFlightRoutes.delete(key);
    });

  inFlightRoutes.set(key, request);
  return request;
};

export const removeCachedDrivingRoute = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): Promise<void> => {
  const key = getRouteCacheKey(
    startLatitude,
    startLongitude,
    destinationLatitude,
    destinationLongitude,
  );
  memoryRouteCache.delete(key);
  await AsyncStorage.removeItem(key);
};

export const clearDrivingRouteCache = async (): Promise<void> => {
  memoryRouteCache.clear();
  inFlightRoutes.clear();

  const keys = await AsyncStorage.getAllKeys();
  const routeKeys = keys.filter((key) => key.startsWith(ROUTE_CACHE_PREFIX));
  if (routeKeys.length > 0) await AsyncStorage.multiRemove(routeKeys);
};
