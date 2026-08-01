import { Functions } from "react-native-appwrite";

import { client } from "@/lib/appwrite";
import type {
  DriverDashboard,
  DriverIncidentInput,
  DriverOnboardingInput,
  DriverOnboardingResult,
  DriverOnboardingStatus,
  DriverOrganizationOption,
  DriverLocationInput,
  DriverRide,
  DriverRideDetails,
} from "@/types/driver";

const functions = new Functions(client);

const DRIVER_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_RIDES_DRIVER_FUNCTION_ID?.trim() ||
  "rides-driver-api";

type HttpMethod = "GET" | "POST" | "PATCH";

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
}

function parseExecutionBody<T>(execution: any): T {
  const responseStatusCode = Number(execution?.responseStatusCode ?? 200);
  const responseBody =
    execution?.responseBody ??
    execution?.response ??
    execution?.stdout ??
    "";

  let payload: ApiEnvelope<T>;

  try {
    payload =
      typeof responseBody === "string"
        ? (JSON.parse(responseBody || "{}") as ApiEnvelope<T>)
        : (responseBody as ApiEnvelope<T>);
  } catch {
    throw new Error(
      responseStatusCode >= 400
        ? "Driver service request failed."
        : "Driver service returned an invalid response.",
    );
  }

  if (responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Driver service request failed with status ${responseStatusCode}.`,
    );
  }

  if (payload.data === undefined) {
    throw new Error("Driver service returned no data.");
  }

  return payload.data;
}

async function executeDriverRequest<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const execution = await (functions as any).createExecution({
    functionId: DRIVER_FUNCTION_ID,
    body: body ? JSON.stringify(body) : "",
    async: false,
    xpath: path,
    method,
    headers: {
      "content-type": "application/json",
    },
  });

  return parseExecutionBody<T>(execution);
}


export async function getDriverOrganizations(): Promise<DriverOrganizationOption[]> {
  return executeDriverRequest<DriverOrganizationOption[]>(
    "/organizations",
    "GET",
  );
}

export async function submitDriverOnboarding(
  input: DriverOnboardingInput,
): Promise<DriverOnboardingResult> {
  return executeDriverRequest<DriverOnboardingResult>(
    "/onboarding",
    "POST",
    input as unknown as Record<string, unknown>,
  );
}

export async function getDriverOnboardingStatus(): Promise<DriverOnboardingStatus> {
  return executeDriverRequest<DriverOnboardingStatus>(
    "/onboarding",
    "GET",
  );
}

export async function getDriverDashboard(): Promise<DriverDashboard> {
  return executeDriverRequest<DriverDashboard>("/dashboard", "GET");
}

export async function getDriverRides(): Promise<DriverRide[]> {
  return executeDriverRequest<DriverRide[]>("/rides", "GET");
}

export async function getDriverRideDetails(
  rideId: string,
): Promise<DriverRideDetails> {
  return executeDriverRequest<DriverRideDetails>(
    `/rides/${encodeURIComponent(rideId)}`,
    "GET",
  );
}

export async function updateDriverAvailability(
  isOnline: boolean,
): Promise<{ isOnline: boolean }> {
  return executeDriverRequest<{ isOnline: boolean }>(
    "/availability",
    "POST",
    { isOnline },
  );
}

export async function updateDriverRideStatus(
  rideId: string,
  status: DriverRide["status"],
  reason?: string,
): Promise<DriverRide> {
  return executeDriverRequest<DriverRide>(
    `/rides/${encodeURIComponent(rideId)}/status`,
    "POST",
    {
      status,
      reason: reason?.trim() || undefined,
    },
  );
}

export async function sendDriverLocation(
  rideId: string,
  location: DriverLocationInput,
): Promise<{
  accepted: boolean;
  recordedAt: string;
}> {
  return executeDriverRequest(
    `/rides/${encodeURIComponent(rideId)}/location`,
    "POST",
    location as unknown as Record<string, unknown>,
  );
}

export async function reportDriverIncident(
  rideId: string,
  incident: DriverIncidentInput,
): Promise<{ incidentId: string }> {
  return executeDriverRequest(
    `/rides/${encodeURIComponent(rideId)}/incidents`,
    "POST",
    incident as unknown as Record<string, unknown>,
  );
}

export function formatDriverRideStatus(status: string): string {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDriverRideTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDriverRideDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
