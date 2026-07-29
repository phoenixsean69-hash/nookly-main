import AsyncStorage from "@react-native-async-storage/async-storage";

export type POICategoryId =
  | "schools"
  | "universities"
  | "hospitals"
  | "shopping"
  | "busTerminals"
  | "policeStations"
  | "restaurants"
  | "parks"
  | "fuelStations";

export interface POICategory {
  id: POICategoryId;
  label: string;
  icon: string;
  color: string;
}

export interface POI {
  id: string;
  osmId: number;
  osmType: "node" | "way" | "relation";
  name: string;
  categoryId: POICategoryId;
  categoryLabel: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  address?: string;
  tags: Record<string, string>;
}

export interface PropertyAmenities {
  total: number;
  schools: number;
  universities: number;
  hospitals: number;
  shopping: number;
  busTerminals: number;
  policeStations: number;
  restaurants: number;
  parks: number;
  fuelStations: number;
  nearestDistanceKm: number | null;
  nearbyPOIs: POI[];
  byCategory: Record<POICategoryId, number>;
}

export const POI_CATEGORIES: readonly POICategory[] = [
  {
    id: "schools",
    label: "Schools",
    icon: "school-outline",
    color: "#2563EB",
  },
  {
    id: "universities",
    label: "Universities",
    icon: "library-outline",
    color: "#7C3AED",
  },
  {
    id: "hospitals",
    label: "Health services",
    icon: "medical-outline",
    color: "#DC2626",
  },
  {
    id: "shopping",
    label: "Shopping",
    icon: "cart-outline",
    color: "#D97706",
  },
  {
    id: "busTerminals",
    label: "Public transport",
    icon: "bus-outline",
    color: "#059669",
  },
  {
    id: "policeStations",
    label: "Police",
    icon: "shield-checkmark-outline",
    color: "#475569",
  },
  {
    id: "restaurants",
    label: "Food & restaurants",
    icon: "restaurant-outline",
    color: "#EA580C",
  },
  {
    id: "parks",
    label: "Parks",
    icon: "leaf-outline",
    color: "#16A34A",
  },
  {
    id: "fuelStations",
    label: "Fuel stations",
    icon: "car-outline",
    color: "#0891B2",
  },
] as const;

const CATEGORY_BY_ID = new Map<POICategoryId, POICategory>(
  POI_CATEGORIES.map((category) => [category.id, category]),
);

const ALL_CATEGORY_IDS = POI_CATEGORIES.map((category) => category.id);
const CACHE_PREFIX = "@nookly:poi:v2:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RESULTS = 500;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
] as const;

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface POICacheEntry {
  savedAt: number;
  pois: POI[];
}

const memoryCache = new Map<string, POICacheEntry>();

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const validateCoordinates = (latitude: number, longitude: number) => {
  if (
    !isFiniteNumber(latitude) ||
    !isFiniteNumber(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    throw new Error("Invalid property coordinates.");
  }
};

const normalizeRadius = (radiusKm: number) => {
  if (!Number.isFinite(radiusKm)) return 3;
  return Math.min(5, Math.max(0.25, radiusKm));
};

const normalizeCategoryIds = (
  categoryIds?: string[],
): POICategoryId[] => {
  if (!categoryIds || categoryIds.length === 0) {
    return [...ALL_CATEGORY_IDS];
  }

  const allowed = new Set<POICategoryId>();

  for (const id of categoryIds) {
    if (CATEGORY_BY_ID.has(id as POICategoryId)) {
      allowed.add(id as POICategoryId);
    }
  }

  return allowed.size > 0 ? [...allowed] : [...ALL_CATEGORY_IDS];
};

const getCacheKey = (
  latitude: number,
  longitude: number,
  radiusKm: number,
  categoryIds: POICategoryId[],
) => {
  const lat = latitude.toFixed(4);
  const lng = longitude.toFixed(4);
  const radius = radiusKm.toFixed(2);
  const categories = [...categoryIds].sort().join(",");
  return `${CACHE_PREFIX}${lat}:${lng}:${radius}:${categories}`;
};

const readCache = async (key: string): Promise<POICacheEntry | null> => {
  const memoryEntry = memoryCache.get(key);
  if (memoryEntry) return memoryEntry;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<POICacheEntry>;
    if (
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed.pois)
    ) {
      await AsyncStorage.removeItem(key);
      return null;
    }

    const entry: POICacheEntry = {
      savedAt: parsed.savedAt,
      pois: parsed.pois,
    };

    memoryCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
};

const writeCache = async (key: string, pois: POI[]) => {
  const entry: POICacheEntry = {
    savedAt: Date.now(),
    pois,
  };

  memoryCache.set(key, entry);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn("Unable to persist POI cache:", error);
  }
};

const buildOverpassStatements = (
  around: string,
  categoryIds: POICategoryId[],
) => {
  const selected = new Set(categoryIds);
  const statements: string[] = [];

  if (selected.has("schools")) {
    statements.push(
      `nwr(${around})["amenity"~"^(school|kindergarten)$"];`,
    );
  }

  if (selected.has("universities")) {
    statements.push(
      `nwr(${around})["amenity"~"^(college|university)$"];`,
    );
  }

  if (selected.has("hospitals")) {
    statements.push(
      `nwr(${around})["amenity"~"^(hospital|clinic|doctors|pharmacy)$"];`,
    );
  }

  if (selected.has("shopping")) {
    statements.push(`nwr(${around})["shop"];`);
    statements.push(`nwr(${around})["amenity"="marketplace"];`);
  }

  if (selected.has("busTerminals")) {
    statements.push(`nwr(${around})["highway"="bus_stop"];`);
    statements.push(`nwr(${around})["amenity"="bus_station"];`);
    statements.push(
      `nwr(${around})["public_transport"~"^(platform|station|stop_position)$"];`,
    );
    statements.push(
      `nwr(${around})["railway"~"^(station|halt|tram_stop)$"];`,
    );
  }

  if (selected.has("policeStations")) {
    statements.push(`nwr(${around})["amenity"="police"];`);
  }

  if (selected.has("restaurants")) {
    statements.push(
      `nwr(${around})["amenity"~"^(restaurant|fast_food|cafe)$"];`,
    );
  }

  if (selected.has("parks")) {
    statements.push(
      `nwr(${around})["leisure"~"^(park|playground|recreation_ground)$"];`,
    );
  }

  if (selected.has("fuelStations")) {
    statements.push(`nwr(${around})["amenity"="fuel"];`);
  }

  return statements;
};

const buildOverpassQuery = (
  latitude: number,
  longitude: number,
  radiusKm: number,
  categoryIds: POICategoryId[],
) => {
  const radiusMeters = Math.round(radiusKm * 1000);
  const around = `around:${radiusMeters},${latitude},${longitude}`;
  const statements = buildOverpassStatements(around, categoryIds);

  return `[out:json][timeout:25];
(
${statements.map((statement) => `  ${statement}`).join("\n")}
);
out center;`;
};

const getCategoryId = (
  tags: Record<string, string>,
): POICategoryId | null => {
  const amenity = tags.amenity;

  if (amenity === "university" || amenity === "college") {
    return "universities";
  }

  if (amenity === "school" || amenity === "kindergarten") {
    return "schools";
  }

  if (
    amenity === "hospital" ||
    amenity === "clinic" ||
    amenity === "doctors" ||
    amenity === "pharmacy"
  ) {
    return "hospitals";
  }

  if (tags.shop || amenity === "marketplace") {
    return "shopping";
  }

  if (
    tags.highway === "bus_stop" ||
    amenity === "bus_station" ||
    tags.public_transport === "platform" ||
    tags.public_transport === "station" ||
    tags.public_transport === "stop_position" ||
    tags.railway === "station" ||
    tags.railway === "halt" ||
    tags.railway === "tram_stop"
  ) {
    return "busTerminals";
  }

  if (amenity === "police") return "policeStations";

  if (
    amenity === "restaurant" ||
    amenity === "fast_food" ||
    amenity === "cafe"
  ) {
    return "restaurants";
  }

  if (
    tags.leisure === "park" ||
    tags.leisure === "playground" ||
    tags.leisure === "recreation_ground"
  ) {
    return "parks";
  }

  if (amenity === "fuel") return "fuelStations";

  return null;
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const calculateDistanceKm = (
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
) => {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(latitude2 - latitude1);
  const longitudeDelta = toRadians(longitude2 - longitude1);
  const firstLatitude = toRadians(latitude1);
  const secondLatitude = toRadians(latitude2);

  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const buildAddress = (tags: Record<string, string>) => {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"],
    tags["addr:city"],
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(", ") : undefined;
};

const normalizeElement = (
  element: OverpassElement,
  centerLatitude: number,
  centerLongitude: number,
): POI | null => {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  const tags = element.tags ?? {};

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) {
    return null;
  }

  const categoryId = getCategoryId(tags);
  if (!categoryId) return null;

  const category = CATEGORY_BY_ID.get(categoryId);
  if (!category) return null;

  const fallbackName =
    tags.ref || tags.operator || tags.brand || category.label.replace(/s$/, "");

  return {
    id: `osm-${element.type}-${element.id}`,
    osmId: element.id,
    osmType: element.type,
    name: tags.name || tags["name:en"] || fallbackName,
    categoryId,
    categoryLabel: category.label,
    latitude,
    longitude,
    distanceKm: calculateDistanceKm(
      centerLatitude,
      centerLongitude,
      latitude,
      longitude,
    ),
    address: buildAddress(tags),
    tags,
  };
};

const requestPOIs = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  categoryIds: POICategoryId[],
): Promise<POI[]> => {
  const query = buildOverpassQuery(
    latitude,
    longitude,
    radiusKm,
    categoryIds,
  );

  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`POI service returned HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as OverpassResponse;
      if (!Array.isArray(payload.elements)) {
        throw new Error("POI service returned an invalid response.");
      }

      const selected = new Set(categoryIds);
      const unique = new Map<string, POI>();

      for (const element of payload.elements) {
        const poi = normalizeElement(element, latitude, longitude);
        if (!poi || !selected.has(poi.categoryId)) continue;
        if (poi.distanceKm > radiusKm + 0.05) continue;
        unique.set(poi.id, poi);
      }

      return [...unique.values()]
        .sort((first, second) => first.distanceKm - second.distanceKm)
        .slice(0, MAX_RESULTS);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  console.error("All POI endpoints failed:", lastError);
  throw new Error("Nearby amenities are temporarily unavailable.");
};

export const getPOIs = async (
  latitude: number,
  longitude: number,
  radiusKm = 3,
  categoryIds?: string[],
  forceRefresh = false,
): Promise<POI[]> => {
  validateCoordinates(latitude, longitude);

  const radius = normalizeRadius(radiusKm);
  const categories = normalizeCategoryIds(categoryIds);
  const cacheKey = getCacheKey(latitude, longitude, radius, categories);
  const cached = await readCache(cacheKey);
  const cacheIsFresh =
    cached !== null && Date.now() - cached.savedAt < CACHE_TTL_MS;

  if (!forceRefresh && cacheIsFresh) {
    return cached.pois;
  }

  try {
    const pois = await requestPOIs(latitude, longitude, radius, categories);
    await writeCache(cacheKey, pois);
    return pois;
  } catch (error) {
    if (cached) {
      return cached.pois;
    }

    throw error;
  }
};

export const fetchPOIs = (
  latitude: number,
  longitude: number,
  radiusKm = 3,
  categoryIds?: string[],
) => getPOIs(latitude, longitude, radiusKm, categoryIds);

const emptyCategoryCounts = (): Record<POICategoryId, number> => ({
  schools: 0,
  universities: 0,
  hospitals: 0,
  shopping: 0,
  busTerminals: 0,
  policeStations: 0,
  restaurants: 0,
  parks: 0,
  fuelStations: 0,
});

export const calculatePropertyAmenities = (
  pois: POI[],
  latitude: number,
  longitude: number,
  radiusKm = 3,
): PropertyAmenities => {
  validateCoordinates(latitude, longitude);
  const radius = normalizeRadius(radiusKm);
  const unique = new Map<string, POI>();

  for (const poi of pois) {
    if (!isFiniteNumber(poi.latitude) || !isFiniteNumber(poi.longitude)) {
      continue;
    }

    const distanceKm = calculateDistanceKm(
      latitude,
      longitude,
      poi.latitude,
      poi.longitude,
    );

    if (distanceKm > radius) continue;

    unique.set(poi.id, {
      ...poi,
      distanceKm,
    });
  }

  const nearbyPOIs = [...unique.values()].sort(
    (first, second) => first.distanceKm - second.distanceKm,
  );
  const byCategory = emptyCategoryCounts();

  for (const poi of nearbyPOIs) {
    byCategory[poi.categoryId] += 1;
  }

  return {
    total: nearbyPOIs.length,
    schools: byCategory.schools,
    universities: byCategory.universities,
    hospitals: byCategory.hospitals,
    shopping: byCategory.shopping,
    busTerminals: byCategory.busTerminals,
    policeStations: byCategory.policeStations,
    restaurants: byCategory.restaurants,
    parks: byCategory.parks,
    fuelStations: byCategory.fuelStations,
    nearestDistanceKm: nearbyPOIs[0]?.distanceKm ?? null,
    nearbyPOIs: nearbyPOIs.slice(0, 50),
    byCategory,
  };
};

export const clearPOICache = (): void => {
  memoryCache.clear();

  void AsyncStorage.getAllKeys()
    .then((keys) => keys.filter((key) => key.startsWith(CACHE_PREFIX)))
    .then((keys) => {
      if (keys.length > 0) {
        return AsyncStorage.multiRemove(keys);
      }

      return undefined;
    })
    .catch((error) => {
      console.warn("Unable to clear POI cache:", error);
    });
};
