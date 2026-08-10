import {
  Client,
  ExecutionMethod,
  Functions,
  type Models,
} from "react-native-appwrite";

import { client } from "@/lib/appwrite-client";

import type {
  StudentSosResult,
  StudentSosSubmission,
} from "@/types/student-sos";

const PUSH_FUNCTION_ID =
  process.env.EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID?.trim();

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
  tickets: {
    tokenRowId?: string;
    status?: string;
    id?: string;
    message?: string;
    details?: {
      error?: string;
      [key: string]: unknown;
    };
  }[];
  failures: {
    tokenRowId?: string;
    message?: string;
    details?: {
      error?: string;
      [key: string]: unknown;
    };
  }[];
  message?: string;
}

export interface PropertyCreatedNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  propertyId: string;
  recipientCount: number;
  notificationCreated: number;
  notificationSampleRowIds?: string[];
  push: PushTicketSummary;
}

let functionsInstance: Functions | null = null;

function getFunctions(): Functions {
  if (!functionsInstance) {
    functionsInstance = new Functions(client);
  }

  return functionsInstance;
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

export interface PropertyRequestNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  notificationCreated?: boolean;
  notificationRowId?: string;
  recipientUserId: string;
  propertyId: string;
  requestId: string;
  data?: {
    type: "request";
    screen: string;
    requestId: string;
    propertyId: string;
    propertyName: string;
    tenantId: string;
    tenantName: string;
    tenantAvatar?: string;
    tenantEmail?: string;
    tenantPhone?: string;
    proposedPrice?: number;
    originalPrice?: number;
    message?: string;
    moveInDate?: string;
    leaseDuration?: string;
    questions: string[];
    status: string;
    requestedAt?: string;
  };
  push?: PushTicketSummary;
}

export interface PropertyReviewNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  notificationCreated?: boolean;
  notificationRowId?: string;
  recipientUserId: string;
  propertyId: string;
  reviewId: string;
  data?: {
    type: "review";
    screen: string;
    propertyId: string;
    propertyName: string;
    reviewId: string;
    reviewerId: string;
    reviewerName: string;
    reviewerAvatar?: string;
    reviewerEmail?: string;
    reviewerPhone?: string;
    rating: number;
    stars: string;
    reviewText: string;
    reviewedAt?: string;
  };
  push?: PushTicketSummary;
}

export interface LeaseSentNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  notificationCreated?: boolean;
  notificationRowId?: string;
  recipientUserId: string;
  requestId: string;
  propertyId: string;
  documentId: string;
  data?: {
    type: "lease";
    screen: string;
    requestId: string;
    propertyId: string;
    propertyName: string;
    tenantId: string;
    tenantName: string;
    landlordId: string;
    landlordName: string;
    documentId: string;
    documentName: string;
    documentSize: number;
    mimeType: string;
    leaseMessage: string;
    sentAt: string;
  };
  push?: PushTicketSummary;
}

export interface LeaseAccessResult {
  requestId: string;
  propertyId: string;
  propertyName: string;
  documentId: string;
  documentName: string;
  documentSize: number;
  mimeType: string;
  expiresAt: string;
  viewUrl: string;
  downloadUrl: string;
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
    const normalizedToken = token.trim();
    const normalizedDeviceType =
      deviceType.trim().toLowerCase() || "android";

    if (!normalizedToken) {
      throw new Error(
        "A push token is required to register this device.",
      );
    }

    return executePushRoute<RegisterDeviceResult>(
      "/register-device",
      {
        token: normalizedToken,
        deviceType: normalizedDeviceType,
      },
    );
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

  async notifyPropertyCreated(
    propertyId: string,
  ): Promise<PropertyCreatedNotificationResult> {
    const normalizedPropertyId = propertyId.trim();

    if (!normalizedPropertyId) {
      throw new Error(
        "A property ID is required to announce a newly created property.",
      );
    }

    return executePushRoute<PropertyCreatedNotificationResult>(
      "/property-created",
      {
        propertyId: normalizedPropertyId,
      },
    );
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
  async notifyPropertyRequest(
    requestId: string,
    propertyId: string,
  ): Promise<PropertyRequestNotificationResult> {
    const normalizedRequestId = requestId.trim();
    const normalizedPropertyId = propertyId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        "A request ID is required to send a property-request notification.",
      );
    }

    if (!normalizedPropertyId) {
      throw new Error(
        "A property ID is required to send a property-request notification.",
      );
    }

    return executePushRoute<PropertyRequestNotificationResult>(
      "/property-request",
      {
        requestId: normalizedRequestId,
        propertyId: normalizedPropertyId,
      },
    );
  }

  async notifyPropertyReview(
    propertyId: string,
    reviewId: string,
  ): Promise<PropertyReviewNotificationResult> {
    const normalizedPropertyId = propertyId.trim();
    const normalizedReviewId = reviewId.trim();

    if (!normalizedPropertyId) {
      throw new Error(
        "A property ID is required to send a property-review notification.",
      );
    }

    if (!normalizedReviewId) {
      throw new Error(
        "A review ID is required to send a property-review notification.",
      );
    }

    return executePushRoute<PropertyReviewNotificationResult>(
      "/property-review",
      {
        propertyId: normalizedPropertyId,
        reviewId: normalizedReviewId,
      },
    );
  }

  async notifyLeaseSent(
    requestId: string,
    leaseMessage = "",
  ): Promise<LeaseSentNotificationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        "A request ID is required to send a lease notification.",
      );
    }

    return executePushRoute<LeaseSentNotificationResult>(
      "/lease-sent",
      {
        requestId: normalizedRequestId,
        leaseMessage: leaseMessage
          .trim()
          .slice(0, 500),
      },
    );
  }

  async getLeaseAccess(
    requestId: string,
  ): Promise<LeaseAccessResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        "A request ID is required to open a lease document.",
      );
    }

    return executePushRoute<LeaseAccessResult>(
      "/lease-access",
      {
        requestId: normalizedRequestId,
      },
    );
  }

  async sendStudentSos(
    input: StudentSosSubmission,
  ): Promise<StudentSosResult> {
    return executePushRoute<StudentSosResult>(
      "/student-sos",
      input as unknown as Record<string, unknown>,
    );
  }
}

const pushFunctionService = new PushFunctionService();

export default pushFunctionService;

