import { client } from "@/lib/appwrite";
import {
  ExecutionMethod,
  Functions,
  type Models,
} from "react-native-appwrite";

const PUSH_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID?.trim();

const functions = new Functions(client);

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
  const execution = await functions.createExecution({
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
}

const pushFunctionService = new PushFunctionService();

export default pushFunctionService;
