import {
  Client,
  ExecutionMethod,
  Functions,
  type Models,
} from "react-native-appwrite";

const APPWRITE_ENDPOINT =
  process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT?.trim();

const APPWRITE_PROJECT_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID?.trim();

const APPWRITE_PLATFORM = "com.shon1123.Nookly";

const PUSH_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID?.trim();

/**
 * This service intentionally creates its own Appwrite client.
 *
 * The shared client must not be imported here because lib/appwrite.ts imports
 * this service for property-like notifications. Doing so would create a
 * circular dependency and leave the Functions service without a valid client
 * during app startup.
 */
function createPushClient(): Client {
  if (!APPWRITE_ENDPOINT) {
    throw new Error(
      "Missing EXPO_PUBLIC_APPWRITE_ENDPOINT in the environment.",
    );
  }

  if (!APPWRITE_PROJECT_ID) {
    throw new Error(
      "Missing EXPO_PUBLIC_APPWRITE_PROJECT_ID in the environment.",
    );
  }

  return new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT_ID)
    .setPlatform(APPWRITE_PLATFORM);
}

let functionsInstance: Functions | null = null;

function getFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = new Functions(createPushClient());
  }

  return functionsInstance;
}

interface FunctionResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export interface RegisterDeviceResult {
  created: boolean;
  tokenRowId: string;
  isActive: boolean;
  duplicatesDeactivated?: number;
}

export interface DeactivateDeviceResult {
  deactivated: number;
}

export interface PushTicketSummary {
  requested: number;
  accepted: number;
  failed: number;
  tickets: Array<{
    tokenRowId?: string;
    token?: string;
    status?: string;
    id?: string;
    message?: string;
    details?: {
      error?: string;
      [key: string]: unknown;
    };
  }>;
  failures: Array<{
    tokenRowId?: string;
    token?: string;
    message?: string;
    details?: {
      error?: string;
      [key: string]: unknown;
    };
  }>;
  message?: string;
}

export interface PropertyLikeNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  notificationCreated?: boolean;
  notificationRowId?: string;
  recipientUserId: string;
  propertyId: string;
  push?: PushTicketSummary;
}

function requireFunctionId(): string {
  if (!PUSH_FUNCTION_ID) {
    throw new Error(
      "Missing EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID in the environment.",
    );
  }

  return PUSH_FUNCTION_ID;
}

function parseExecutionBody<T>(
  execution: Models.Execution,
): FunctionResponse<T> {
  const rawBody = String(execution.responseBody ?? "").trim();

  if (!rawBody) {
    throw new Error(
      `The Nookly Push API returned an empty response (HTTP ${
        execution.responseStatusCode ?? "unknown"
      }).`,
    );
  }

  try {
    return JSON.parse(rawBody) as FunctionResponse<T>;
  } catch {
    throw new Error(
      `The Nookly Push API returned invalid JSON: ${rawBody.slice(0, 250)}`,
    );
  }
}

async function executePushRoute<T>(
  path: string,
  body: Record<string, unknown> = {},
): Promise<T> {
  const execution = await getFunctions().createExecution({
    functionId: requireFunctionId(),
    body: JSON.stringify(body),
    async: false,
    xpath: path,
    method: ExecutionMethod.POST,
    headers: {
      "content-type": "application/json",
    },
  });

  const response = parseExecutionBody<T>(execution);
  const statusCode = Number(execution.responseStatusCode ?? 0);

  if (
    statusCode < 200 ||
    statusCode >= 300 ||
    !response.ok ||
    response.data === undefined
  ) {
    throw new Error(
      response.error ||
        `Nookly Push API request failed with HTTP ${statusCode || "unknown"}.`,
    );
  }

  return response.data;
}

class PushFunctionService {
  async registerDevice(
    token: string,
    deviceType: string,
  ): Promise<RegisterDeviceResult> {
    return executePushRoute<RegisterDeviceResult>("/register-device", {
      token,
      deviceType,
    });
  }

  async deactivateDevice(
    token?: string | null,
  ): Promise<DeactivateDeviceResult> {
    return executePushRoute<DeactivateDeviceResult>("/deactivate-device", {
      ...(token?.trim() ? { token: token.trim() } : {}),
    });
  }

  async testCurrentUser(): Promise<PushTicketSummary> {
    return executePushRoute<PushTicketSummary>("/test", {
      title: "Nookly Mobile Test",
      body: "Your mobile app is now connected to the secure Nookly Push API.",
      data: {
        type: "alert",
        source: "nookly-mobile",
      },
    });
  }

  async notifyPropertyLike(
    propertyId: string,
  ): Promise<PropertyLikeNotificationResult> {
    const normalizedPropertyId = propertyId.trim();

    if (!normalizedPropertyId) {
      throw new Error(
        "A property ID is required to send a property-like notification.",
      );
    }

    return executePushRoute<PropertyLikeNotificationResult>("/property-like", {
      propertyId: normalizedPropertyId,
    });
  }
}

const pushFunctionService = new PushFunctionService();

export default pushFunctionService;
