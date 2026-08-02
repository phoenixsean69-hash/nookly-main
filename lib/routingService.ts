export interface DrivingRoute {
  coordinates: [number, number][];
  distanceKm: number;
  durationMinutes: number;
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

const ROUTING_TIMEOUT_MS = 20_000;

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

export const getDrivingRoute = async (
  startLatitude: number,
  startLongitude: number,
  destinationLatitude: number,
  destinationLongitude: number,
): Promise<DrivingRoute> => {
  validateCoordinate(startLatitude, startLongitude, "Property");
  validateCoordinate(
    destinationLatitude,
    destinationLongitude,
    "Destination",
  );

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
