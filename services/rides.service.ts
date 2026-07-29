import AsyncStorage from "@react-native-async-storage/async-storage";
import { Query } from "react-native-appwrite";

import { config, databases } from "@/lib/appwrite";
import type {
  Ride,
  RideDetails,
  RideDetailsResult,
  RideListItem,
  RideListResult,
  RideRoute,
  RideStop,
} from "@/types/rides";

const RIDE_TABLES = {
  routes: process.env.EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID,
  stops: process.env.EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID,
  rides: process.env.EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID,
} as const;

const CACHE_KEYS = {
  school: (schoolLocation: string) =>
    `@nookly:rides:school:${normalizeSchoolLocation(schoolLocation)}`,
  details: (rideId: string) => `@nookly:rides:details:${rideId}`,
} as const;

const ACTIVE_RIDE_STATUSES = new Set(["scheduled", "boarding", "in_progress"]);

function normalizeSchoolLocation(value: string): string {
  return value.trim().toLowerCase();
}

function requireConfigValue(value: string | undefined, label: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing ${label} in the app environment.`);
  }
  return normalized;
}

function getDatabaseId(): string {
  return requireConfigValue(config.databaseId, "EXPO_PUBLIC_APPWRITE_DATABASE_ID");
}

function getRideTableId(): string {
  return requireConfigValue(
    RIDE_TABLES.rides,
    "EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID",
  );
}

function getRouteTableId(): string {
  return requireConfigValue(
    RIDE_TABLES.routes,
    "EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID",
  );
}

function getStopTableId(): string {
  return requireConfigValue(
    RIDE_TABLES.stops,
    "EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID",
  );
}

function isUsableRide(ride: Ride): boolean {
  return ACTIVE_RIDE_STATUSES.has(ride.status) && ride.status !== "cancelled";
}

function getRideSortRank(ride: Ride): number {
  if (ride.status === "in_progress") return 0;
  if (ride.status === "boarding") return 1;
  return 2;
}

function sortRides(rides: RideListItem[]): RideListItem[] {
  return [...rides].sort((left, right) => {
    const statusDifference = getRideSortRank(left) - getRideSortRank(right);
    if (statusDifference !== 0) return statusDifference;

    const leftTime = new Date(left.departureTime).getTime();
    const rightTime = new Date(right.departureTime).getTime();
    return leftTime - rightTime;
  });
}

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const value = await AsyncStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.warn("Unable to read Nookly Rides cache:", error);
    return null;
  }
}

async function writeCache<T>(key: string, value: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn("Unable to save Nookly Rides cache:", error);
  }
}

async function getRoute(routeId: string): Promise<RideRoute | null> {
  try {
    const document = await databases.getDocument(
      getDatabaseId(),
      getRouteTableId(),
      routeId,
    );
    return document as unknown as RideRoute;
  } catch (error) {
    console.warn(`Unable to load route ${routeId}:`, error);
    return null;
  }
}

async function getRoutesByIds(routeIds: string[]): Promise<Map<string, RideRoute>> {
  const uniqueRouteIds = Array.from(new Set(routeIds.filter(Boolean)));
  const routeResults = await Promise.all(
    uniqueRouteIds.map(async (routeId) => [routeId, await getRoute(routeId)] as const),
  );

  const routes = new Map<string, RideRoute>();
  routeResults.forEach(([routeId, route]) => {
    if (route) routes.set(routeId, route);
  });
  return routes;
}

async function getStops(routeId: string): Promise<RideStop[]> {
  const response = await databases.listDocuments(
    getDatabaseId(),
    getStopTableId(),
    [Query.equal("routeId", routeId), Query.limit(100)],
  );

  return (response.documents as unknown as RideStop[])
    .filter((stop) => stop.isActive !== false)
    .sort((left, right) => left.stopOrder - right.stopOrder);
}

export async function getAvailableRidesForSchool(
  schoolLocation: string,
): Promise<RideListResult> {
  const normalizedSchool = normalizeSchoolLocation(schoolLocation);
  if (!normalizedSchool) {
    return { rides: [], fromCache: false };
  }

  const cacheKey = CACHE_KEYS.school(normalizedSchool);

  try {
    const response = await databases.listDocuments(
      getDatabaseId(),
      getRideTableId(),
      [Query.equal("schoolLocation", normalizedSchool), Query.limit(100)],
    );

    const rideDocuments = (response.documents as unknown as Ride[]).filter(isUsableRide);
    const routes = await getRoutesByIds(rideDocuments.map((ride) => ride.routeId));
    const rides = sortRides(
      rideDocuments.map((ride) => ({
        ...ride,
        route: routes.get(ride.routeId) ?? null,
      })),
    );

    await writeCache(cacheKey, rides);
    return { rides, fromCache: false };
  } catch (error) {
    const cachedRides = await readCache<RideListItem[]>(cacheKey);
    if (cachedRides) {
      return { rides: sortRides(cachedRides), fromCache: true };
    }
    throw error;
  }
}

export async function getRideDetails(rideId: string): Promise<RideDetailsResult> {
  const normalizedRideId = rideId.trim();
  if (!normalizedRideId) {
    throw new Error("A ride ID is required.");
  }

  const cacheKey = CACHE_KEYS.details(normalizedRideId);

  try {
    const rideDocument = await databases.getDocument(
      getDatabaseId(),
      getRideTableId(),
      normalizedRideId,
    );
    const ride = rideDocument as unknown as Ride;

    const [route, stops] = await Promise.all([
      getRoute(ride.routeId),
      getStops(ride.routeId),
    ]);

    const details: RideDetails = {
      ...ride,
      route,
      stops,
    };

    await writeCache(cacheKey, details);
    return { ride: details, fromCache: false };
  } catch (error) {
    const cachedDetails = await readCache<RideDetails>(cacheKey);
    if (cachedDetails) {
      return { ride: cachedDetails, fromCache: true };
    }
    throw error;
  }
}

export function formatRideStatus(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRideFare(amount: number, currency: string): string {
  const safeCurrency = currency?.trim().toUpperCase() || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${safeCurrency} ${Number(amount || 0).toFixed(2)}`;
  }
}

export function formatRideDateTime(value: string): {
  date: string;
  time: string;
} {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: "Date unavailable", time: "Time unavailable" };
  }

  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
