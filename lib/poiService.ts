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

export class POIUnavailableError extends Error {
  constructor(message = "Nearby amenities are temporarily unavailable.") {
    super(message);
    this.name = "POIUnavailableError";
  }
}

export const POI_CATEGORIES: readonly POICategory[] = [
  { id: "schools", label: "Schools", icon: "school-outline", color: "#2563EB" },
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
  { id: "shopping", label: "Shopping", icon: "cart-outline", color: "#D97706" },
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
  { id: "parks", label: "Parks", icon: "leaf-outline", color: "#848482" },
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

const CACHE_PREFIX = "@nookly:poi:v4:";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const ENDPOINT_COOLDOWN_MS = 60 * 1000;
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 22_000;
const MAX_RESULTS = 350;
const MAX_SERVER_RESULTS = 500;

// Use independent public Overpass hosts as fallbacks. Requests are attempted
// sequentially so Nookly does not send duplicate load to multiple servers.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
] as const;

const OVERPASS_REQUEST_HEADERS = {
  Accept: "*/*",
  "Content-Type": "application/x-www-form-urlencoded",
  "User-Agent":
    "Nookly/1.0 (https://github.com/phoenixsean69-hash/nookly-app)",
  Referer: "https://github.com/phoenixsean69-hash/nookly-app",
} as const;

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
  remark?: string;
}

interface POICacheEntry {
  savedAt: number;
  pois: POI[];
}

const memoryCache = new Map<string, POICacheEntry>();
const inFlightRequests = new Map<string, Promise<POI[]>>();
const endpointCooldownUntil = new Map<string, number>();

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

const normalizeCategoryIds = (categoryIds?: string[]): POICategoryId[] => {
  if (!categoryIds || categoryIds.length === 0) return [...ALL_CATEGORY_IDS];

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
    if (typeof parsed.savedAt !== "number" || !Array.isArray(parsed.pois)) {
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
  const entry: POICacheEntry = { savedAt: Date.now(), pois };
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
  const amenityValues: string[] = [];

  if (selected.has("schools")) amenityValues.push("school", "kindergarten");
  if (selected.has("universities")) amenityValues.push("college", "university");
  if (selected.has("hospitals")) {
    amenityValues.push("hospital", "clinic", "doctors", "pharmacy");
  }
  if (selected.has("shopping")) amenityValues.push("marketplace");
  if (selected.has("busTerminals")) amenityValues.push("bus_station");
  if (selected.has("policeStations")) amenityValues.push("police");
  if (selected.has("restaurants")) {
    amenityValues.push("restaurant", "fast_food", "cafe");
  }
  if (selected.has("fuelStations")) amenityValues.push("fuel");

  if (amenityValues.length > 0) {
    statements.push(
      `nwr(${around})["amenity"~"^(${amenityValues.join("|")})$"];`,
    );
  }

  if (selected.has("shopping")) {
    statements.push(`nwr(${around})["shop"];`);
  }

  if (selected.has("busTerminals")) {
    statements.push(`nwr(${around})["highway"="bus_stop"];`);
    statements.push(
      `nwr(${around})["public_transport"~"^(platform|station|stop_position)$"];`,
    );
    statements.push(`nwr(${around})["railway"~"^(station|halt|tram_stop)$"];`);
  }

  if (selected.has("parks")) {
    statements.push(
      `nwr(${around})["leisure"~"^(park|playground|recreation_ground)$"];`,
    );
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

  return `[out:json][timeout:18][maxsize:67108864];
(
${statements.map((statement) => `  ${statement}`).join("\n")}
);
out tags center qt ${MAX_SERVER_RESULTS};`;
};

const getCategoryId = (tags: Record<string, string>): POICategoryId | null => {
  const amenity = tags.amenity;

  if (amenity === "university" || amenity === "college") return "universities";
  if (amenity === "school" || amenity === "kindergarten") return "schools";
  if (["hospital", "clinic", "doctors", "pharmacy"].includes(amenity)) {
    return "hospitals";
  }
  if (tags.shop || amenity === "marketplace") return "shopping";
  if (
    tags.highway === "bus_stop" ||
    amenity === "bus_station" ||
    ["platform", "station", "stop_position"].includes(tags.public_transport) ||
    ["station", "halt", "tram_stop"].includes(tags.railway)
  ) {
    return "busTerminals";
  }
  if (amenity === "police") return "policeStations";
  if (["restaurant", "fast_food", "cafe"].includes(amenity)) {
    return "restaurants";
  }
  if (["park", "playground", "recreation_ground"].includes(tags.leisure)) {
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

  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return null;

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

const parseOverpassResponse = async (
  response: Response,
): Promise<OverpassResponse> => {
  const raw = await response.text();

  if (!response.ok) {
    const compactMessage = raw
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);

    throw new Error(
      compactMessage
        ? `HTTP ${response.status}: ${compactMessage}`
        : `HTTP ${response.status}`,
    );
  }

  try {
    const payload = JSON.parse(raw) as OverpassResponse;

    if (!Array.isArray(payload.elements)) {
      throw new Error(payload.remark || "Invalid Overpass response.");
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
      throw error;
    }

    throw new Error("The POI server returned invalid JSON.");
  }
};

const fetchFromEndpoint = async (
  endpoint: string,
  query: string,
): Promise<OverpassResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // POST avoids oversized URLs and is more reliable through mobile carriers,
    // proxies and captive networks than a long ?data= GET request.
    let response = await fetch(endpoint, {
      method: "POST",
      headers: OVERPASS_REQUEST_HEADERS,
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    // A small number of proxies or mirrors reject POST. Only then retry GET.
    if (response.status === 405 || response.status === 415) {
      response = await fetch(
        `${endpoint}?data=${encodeURIComponent(query)}`,
        {
          method: "GET",
          headers: OVERPASS_REQUEST_HEADERS,
          signal: controller.signal,
        },
      );
    }

    return await parseOverpassResponse(response);
  } finally {
    clearTimeout(timeout);
  }
};

const getAvailableEndpoints = (ignoreCooldown: boolean): string[] => {
  if (ignoreCooldown) return [...OVERPASS_ENDPOINTS];

  const now = Date.now();
  const available = OVERPASS_ENDPOINTS.filter(
    (endpoint) => (endpointCooldownUntil.get(endpoint) ?? 0) <= now,
  );

  if (available.length > 0) return available;

  // Do not fail immediately merely because every endpoint recently timed out.
  // Retry the endpoint whose cooldown expires first.
  const earliest = [...OVERPASS_ENDPOINTS].sort(
    (first, second) =>
      (endpointCooldownUntil.get(first) ?? 0) -
      (endpointCooldownUntil.get(second) ?? 0),
  )[0];

  return earliest ? [earliest] : [];
};

const requestPOIs = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  categoryIds: POICategoryId[],
  ignoreCooldown = false,
): Promise<POI[]> => {
  const query = buildOverpassQuery(latitude, longitude, radiusKm, categoryIds);
  const endpoints = getAvailableEndpoints(ignoreCooldown);
  let lastMessage = "No POI server was available.";

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchFromEndpoint(endpoint, query);

      endpointCooldownUntil.delete(endpoint);

      const selected = new Set(categoryIds);
      const unique = new Map<string, POI>();

      for (const element of payload.elements ?? []) {
        const poi = normalizeElement(element, latitude, longitude);
        if (!poi || !selected.has(poi.categoryId)) continue;
        if (poi.distanceKm > radiusKm + 0.05) continue;
        unique.set(poi.id, poi);
      }

      const results = [...unique.values()]
        .sort((first, second) => first.distanceKm - second.distanceKm)
        .slice(0, MAX_RESULTS);

      console.log(
        `✅ Nearby amenities loaded: ${results.length} from ${endpoint}`,
      );

      return results;
    } catch (error) {
      const aborted =
        error instanceof Error &&
        (error.name === "AbortError" ||
          error.message.toLowerCase().includes("abort"));

      const errorMessage =
        error instanceof Error && error.message
          ? error.message
          : "Unknown network error";

      const isRateLimited =
        errorMessage.includes("HTTP 429") ||
        errorMessage.includes("HTTP 502") ||
        errorMessage.includes("HTTP 503") ||
        errorMessage.includes("HTTP 504");

      const cooldown = isRateLimited
        ? RATE_LIMIT_COOLDOWN_MS
        : ENDPOINT_COOLDOWN_MS;

      endpointCooldownUntil.set(endpoint, Date.now() + cooldown);

      lastMessage = aborted
        ? "The nearby-amenities server took too long to respond."
        : `The nearby-amenities server failed: ${errorMessage}`;

      console.warn("POI endpoint unavailable:", {
        endpoint,
        reason: aborted ? "timeout" : errorMessage,
        retryAfterSeconds: Math.round(cooldown / 1000),
      });
    }
  }

  throw new POIUnavailableError(lastMessage);
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

  if (!forceRefresh && cacheIsFresh) return cached.pois;

  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = requestPOIs(
    latitude,
    longitude,
    radius,
    categories,
    forceRefresh,
  )
    .then(async (pois) => {
      await writeCache(cacheKey, pois);
      return pois;
    })
    .catch((error) => {
      if (cached) return cached.pois;
      throw error;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request);
  return request;
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
    if (!isFiniteNumber(poi.latitude) || !isFiniteNumber(poi.longitude))
      continue;

    const distanceKm = calculateDistanceKm(
      latitude,
      longitude,
      poi.latitude,
      poi.longitude,
    );
    if (distanceKm > radius) continue;

    unique.set(poi.id, { ...poi, distanceKm });
  }

  const nearbyPOIs = [...unique.values()].sort(
    (first, second) => first.distanceKm - second.distanceKm,
  );
  const byCategory = emptyCategoryCounts();

  for (const poi of nearbyPOIs) byCategory[poi.categoryId] += 1;

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
  inFlightRequests.clear();
  endpointCooldownUntil.clear();

  void AsyncStorage.getAllKeys()
    .then((keys) => keys.filter((key) => key.startsWith("@nookly:poi:")))
    .then((keys) =>
      keys.length > 0 ? AsyncStorage.multiRemove(keys) : undefined,
    )
    .catch((error) => {
      console.warn("Unable to clear POI cache:", error);
    });
};
