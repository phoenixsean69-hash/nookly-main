import { Functions } from "react-native-appwrite";

import { client } from "@/lib/appwrite";
import type {
  AcceptRideOfferResult,
  CreateRideRequestInput,
  DriverRideRequestDetails,
  FindNearbyDriversInput,
  NearbyDriversResponse,
  RideOffer,
  RideRequest,
  StudentRideRequestDetails,
  SubmitRideOfferInput,
} from "@/types/ride-marketplace";

const functions = new Functions(client);

const MARKETPLACE_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_RIDES_MARKETPLACE_FUNCTION_ID?.trim() ||
  "rides-driver-api";

type HttpMethod = "GET" | "POST";

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
        ? "Nookly Rides request failed."
        : "Nookly Rides returned an invalid response.",
    );
  }

  if (responseStatusCode >= 400 || payload.ok === false) {
    throw new Error(
      payload.error ||
        payload.message ||
        `Nookly Rides request failed with status ${responseStatusCode}.`,
    );
  }

  if (payload.data === undefined) {
    throw new Error("Nookly Rides returned no data.");
  }

  return payload.data;
}

async function executeMarketplaceRequest<T>(
  path: string,
  method: HttpMethod = "GET",
  body?: Record<string, unknown>,
): Promise<T> {
  const execution = await (functions as any).createExecution({
    functionId: MARKETPLACE_FUNCTION_ID,
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

export async function getNearbyDrivers(
  input: FindNearbyDriversInput,
): Promise<NearbyDriversResponse> {
  return executeMarketplaceRequest<NearbyDriversResponse>(
    "/student/nearby-drivers",
    "POST",
    input as unknown as Record<string, unknown>,
  );
}

export async function createStudentRideRequest(
  input: CreateRideRequestInput,
): Promise<RideRequest> {
  return executeMarketplaceRequest<RideRequest>(
    "/student/requests",
    "POST",
    input as unknown as Record<string, unknown>,
  );
}

export async function getStudentRideRequests(): Promise<RideRequest[]> {
  return executeMarketplaceRequest<RideRequest[]>(
    "/student/requests",
    "GET",
  );
}

export async function getStudentRideRequestDetails(
  requestId: string,
): Promise<StudentRideRequestDetails> {
  return executeMarketplaceRequest<StudentRideRequestDetails>(
    `/student/requests/${encodeURIComponent(requestId)}`,
    "GET",
  );
}

export async function cancelStudentRideRequest(
  requestId: string,
): Promise<RideRequest> {
  return executeMarketplaceRequest<RideRequest>(
    `/student/requests/${encodeURIComponent(requestId)}/cancel`,
    "POST",
  );
}

export async function acceptStudentRideOffer(
  requestId: string,
  offerId: string,
): Promise<AcceptRideOfferResult> {
  return executeMarketplaceRequest<AcceptRideOfferResult>(
    `/student/requests/${encodeURIComponent(requestId)}/accept-offer`,
    "POST",
    { offerId },
  );
}

export async function getDriverOpenRideRequests(): Promise<RideRequest[]> {
  return executeMarketplaceRequest<RideRequest[]>(
    "/driver/requests",
    "GET",
  );
}

export async function getDriverRideOffers(): Promise<RideOffer[]> {
  return executeMarketplaceRequest<RideOffer[]>(
    "/driver/offers",
    "GET",
  );
}

export async function getDriverRideRequestDetails(
  requestId: string,
): Promise<DriverRideRequestDetails> {
  return executeMarketplaceRequest<DriverRideRequestDetails>(
    `/driver/requests/${encodeURIComponent(requestId)}`,
    "GET",
  );
}

export async function submitDriverRideOffer(
  requestId: string,
  input: SubmitRideOfferInput,
): Promise<RideOffer> {
  return executeMarketplaceRequest<RideOffer>(
    `/driver/requests/${encodeURIComponent(requestId)}/offers`,
    "POST",
    input as unknown as Record<string, unknown>,
  );
}

export async function withdrawDriverRideOffer(
  offerId: string,
): Promise<RideOffer> {
  return executeMarketplaceRequest<RideOffer>(
    `/driver/offers/${encodeURIComponent(offerId)}/withdraw`,
    "POST",
  );
}

export function formatMarketplaceStatus(status: string): string {
  return String(status || "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatMarketplaceMoney(
  amount: number | undefined,
  currency = "USD",
): string {
  const safeAmount = Number(amount ?? 0);
  const safeCurrency = currency?.trim().toUpperCase() || "USD";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(safeAmount) ? safeAmount : 0);
  } catch {
    return `${safeCurrency} ${
      Number.isFinite(safeAmount) ? safeAmount.toFixed(2) : "0.00"
    }`;
  }
}

export function formatMarketplaceDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Time unavailable";
  }

  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isMarketplaceRequestOpen(status: string): boolean {
  return ["pending", "quoted"].includes(
    String(status || "").toLowerCase(),
  );
}
