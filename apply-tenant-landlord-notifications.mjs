import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  appwrite: path.join(root, "lib", "appwrite.ts"),
  pushService: path.join(
    root,
    "services",
    "push-function.service.ts",
  ),
  pushFunction: path.join(
    root,
    "functions",
    "nookly-push-api",
    "src",
    "main.js",
  ),
  landlordNotifications: path.join(
    root,
    "app",
    "(root)",
    "(landlord)",
    "landLordNotifications.tsx",
  ),
};

for (const [label, filePath] of Object.entries(paths)) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} was not found: ${filePath}\n` +
        "Run this installer from the Nookly project root.",
    );
  }
}

const backupSuffix =
  ".tenant-landlord-notifications-v1.bak";

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeWithBackup(filePath, content) {
  const backupPath = `${filePath}${backupSuffix}`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

function replaceRequired(
  content,
  search,
  replacement,
  label,
) {
  if (!content.includes(search)) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  return content.replace(search, replacement);
}

function replaceRangeRequired(
  content,
  startMarker,
  endMarker,
  replacement,
  label,
) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(
    endMarker,
    start + startMarker.length,
  );

  if (start < 0 || end < 0) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  return (
    content.slice(0, start) +
    replacement +
    content.slice(end)
  );
}

function patchPushService(original) {
  let content = original;

  if (
    !content.includes(
      "export interface PropertyRequestNotificationResult",
    )
  ) {
    const interfaceMarker =
      "function requireFunctionId(): string {";

    const interfaces = `export interface PropertyRequestNotificationResult {
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

`;

    content = replaceRequired(
      content,
      interfaceMarker,
      `${interfaces}${interfaceMarker}`,
      "the push service interface insertion point",
    );
  }

  if (
    !content.includes(
      "async notifyPropertyRequest(",
    )
  ) {
    const classEndMarker =
      "\n}\n\nconst pushFunctionService = new PushFunctionService();";

    const methods = `
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
`;

    content = replaceRequired(
      content,
      classEndMarker,
      `${methods}${classEndMarker}`,
      "the PushFunctionService class ending",
    );
  }

  return content;
}

function patchAppwrite(original) {
  let content = original;

  if (
    !content.includes(
      "reviewerId: currentUser.$id",
    )
  ) {
    content = replaceRequired(
      content,
      `    const newReview = {
      id: Date.now().toString(),
      propertyId: propertyId,
      userName: currentUser.name,`,
      `    const newReview = {
      id: Date.now().toString(),
      propertyId: propertyId,
      reviewerId: currentUser.$id,
      userName: currentUser.name,`,
      "the newReview object",
    );
  }

  if (
    content.includes(
      "// 📢 Send notification to property owner",
    )
  ) {
    const replacement = `    // Notify the property owner through the secure centralized Function.
    // The Function verifies the authenticated reviewer and the exact review
    // inside properties.reviews before creating the in-app notification.
    if (
      property.creatorId &&
      property.creatorId !== currentUser.$id
    ) {
      try {
        const notificationResult =
          await pushFunctionService.notifyPropertyReview(
            propertyId,
            newReview.id,
          );

        if (notificationResult.skipped) {
          console.log(
            "ℹ️ Property-review notification skipped:",
            {
              reason: notificationResult.reason,
              duplicate:
                notificationResult.duplicate,
            },
          );
        } else {
          console.log(
            "✅ Property-review notification processed:",
            {
              notificationRowId:
                notificationResult.notificationRowId,
              recipientUserId:
                notificationResult.recipientUserId,
              acceptedPushes:
                notificationResult.push?.accepted ?? 0,
              failedPushes:
                notificationResult.push?.failed ?? 0,
            },
          );
        }
      } catch (notificationError) {
        // The review must remain saved even if notification delivery is
        // temporarily unavailable.
        console.error(
          "❌ Failed to process property-review notification:",
          notificationError,
        );
      }
    }

`;

    content = replaceRangeRequired(
      content,
      "    // 📢 Send notification to property owner",
      "    return newReview;",
      replacement,
      "the legacy review notification block",
    );
  }

  const requestStart =
    content.indexOf(
      "export const requestProperty = async (",
    );
  const requestEnd =
    content.indexOf(
      "export const markAllNotificationsAsRead",
      requestStart,
    );

  if (requestStart < 0 || requestEnd < 0) {
    throw new Error(
      "Could not locate requestProperty. No files were written.",
    );
  }

  let requestBlock = content.slice(
    requestStart,
    requestEnd,
  );

  requestBlock = requestBlock.replaceAll(
    '"unique()"',
    "ID.unique()",
  );

  if (
    requestBlock.includes(
      "// Get landlord's user document ID for notifications",
    )
  ) {
    const notificationStart =
      requestBlock.indexOf(
        "    // Get landlord's user document ID for notifications",
      );
    const returnIndex =
      requestBlock.indexOf(
        "    return request;",
        notificationStart,
      );

    if (returnIndex < 0) {
      throw new Error(
        "Could not locate the requestProperty return statement.",
      );
    }

    const secureNotification = `    // Notify the property owner through the secure centralized Function.
    // The Function verifies the authenticated tenant and the exact request row.
    try {
      const notificationResult =
        await pushFunctionService.notifyPropertyRequest(
          request.$id,
          propertyId,
        );

      if (notificationResult.skipped) {
        console.log(
          "ℹ️ Property-request notification skipped:",
          {
            reason: notificationResult.reason,
            duplicate:
              notificationResult.duplicate,
          },
        );
      } else {
        console.log(
          "✅ Property-request notification processed:",
          {
            notificationRowId:
              notificationResult.notificationRowId,
            recipientUserId:
              notificationResult.recipientUserId,
            acceptedPushes:
              notificationResult.push?.accepted ?? 0,
            failedPushes:
              notificationResult.push?.failed ?? 0,
          },
        );
      }
    } catch (notificationError) {
      // The request must remain saved even if notification delivery is
      // temporarily unavailable.
      console.error(
        "❌ Failed to process property-request notification:",
        notificationError,
      );
    }

`;

    requestBlock =
      requestBlock.slice(0, notificationStart) +
      secureNotification +
      requestBlock.slice(returnIndex);
  }

  if (requestBlock.includes('"unique()"')) {
    throw new Error(
      'Validation failed: literal "unique()" remains in requestProperty.',
    );
  }

  content =
    content.slice(0, requestStart) +
    requestBlock +
    content.slice(requestEnd);

  return content;
}

const functionHelpers = `const REQUESTS_TABLE_ID = env(
  "NOOKLY_REQUESTS_COLLECTION_ID",
  "69c3a9f30004facf9a4d",
);
`;

const secureEventFunctions = `const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getUserRowByReference = async (
  tables,
  reference,
) => {
  const normalized = String(
    reference ?? "",
  ).trim();

  if (!normalized) return null;

  const direct = await getRowOrNull(
    tables,
    USERS_TABLE_ID,
    normalized,
  );

  if (direct) return direct;

  return getUserRowByAccountId(
    tables,
    normalized,
  );
};

const sanitizeQuestions = (value) =>
  parseJsonArray(value)
    .map((item) =>
      String(item ?? "").trim().slice(0, 250),
    )
    .filter(Boolean)
    .slice(0, 20);

const notifyPropertyRequest = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const tenantAccountId =
    requireAuthenticatedUser(req);

  const requestsTableId =
    requireConfiguredTable(
      REQUESTS_TABLE_ID,
      "Requests table",
    );

  const propertiesTableId =
    requireConfiguredTable(
      PROPERTIES_TABLE_ID,
      "Properties table",
    );

  requireConfiguredTable(
    USERS_TABLE_ID,
    "Users table",
  );

  requireConfiguredTable(
    NOTIFICATIONS_TABLE_ID,
    "Notifications table",
  );

  const requestId = String(
    body.requestId ?? "",
  ).trim();

  const propertyId = String(
    body.propertyId ?? "",
  ).trim();

  if (!requestId) {
    throw statusError(
      400,
      "requestId is required.",
    );
  }

  if (!propertyId) {
    throw statusError(
      400,
      "propertyId is required.",
    );
  }

  const requestRow = await getRowOrNull(
    tables,
    requestsTableId,
    requestId,
  );

  if (!requestRow) {
    throw statusError(
      404,
      "The requested rental request could not be found.",
    );
  }

  const storedTenantId = String(
    requestRow.tenantId ?? "",
  ).trim();

  if (storedTenantId !== tenantAccountId) {
    throw statusError(
      403,
      "The authenticated tenant does not own this rental request.",
    );
  }

  const storedPropertyId = String(
    requestRow.propertyId ?? "",
  ).trim();

  if (storedPropertyId !== propertyId) {
    throw statusError(
      409,
      "The request does not belong to the supplied property.",
    );
  }

  const property = await getRowOrNull(
    tables,
    propertiesTableId,
    propertyId,
  );

  if (!property) {
    throw statusError(
      404,
      "The requested property could not be found.",
    );
  }

  const ownerAccountId = String(
    property.creatorId ?? "",
  ).trim();

  if (!ownerAccountId) {
    throw statusError(
      409,
      "The property does not have a valid owner account ID.",
    );
  }

  if (ownerAccountId === tenantAccountId) {
    return {
      skipped: true,
      reason:
        "Property owners are not notified about requests for their own properties.",
      recipientUserId: ownerAccountId,
      propertyId,
      requestId,
    };
  }

  const tenantUser =
    await getUserRowByReference(
      tables,
      tenantAccountId,
    );

  const tenantName = String(
    requestRow.tenantName ??
      tenantUser?.name ??
      "A tenant",
  ).trim() || "A tenant";

  const propertyName = String(
    requestRow.propertyName ??
      property.propertyName ??
      "Property",
  ).trim() || "Property";

  const proposedPriceRaw = Number(
    requestRow.proposedPrice,
  );

  const originalPriceRaw = Number(
    requestRow.originalPrice ??
      property.price,
  );

  const proposedPrice = Number.isFinite(
    proposedPriceRaw,
  )
    ? proposedPriceRaw
    : undefined;

  const originalPrice = Number.isFinite(
    originalPriceRaw,
  )
    ? originalPriceRaw
    : undefined;

  const notificationData = {
    type: "request",
    screen: "/Landrequests",
    requestId,
    propertyId,
    propertyName,
    tenantId: tenantAccountId,
    tenantName,
    tenantAvatar: String(
      requestRow.tenantAvatar ??
        tenantUser?.customAvatar ??
        tenantUser?.avatar ??
        "",
    ).trim(),
    tenantEmail: String(
      requestRow.tenantEmail ??
        tenantUser?.email ??
        "",
    ).trim(),
    tenantPhone: String(
      requestRow.tenantPhone ??
        tenantUser?.phone ??
        "",
    ).trim(),
    ...(proposedPrice !== undefined
      ? { proposedPrice }
      : {}),
    ...(originalPrice !== undefined
      ? { originalPrice }
      : {}),
    message: String(
      requestRow.message ?? "",
    ).trim().slice(0, 1000),
    moveInDate: String(
      requestRow.moveInDate ?? "",
    ).trim(),
    leaseDuration: String(
      requestRow.leaseDuration ?? "",
    ).trim(),
    questions: sanitizeQuestions(
      requestRow.questions,
    ),
    status: String(
      requestRow.status ?? "pending",
    ).trim() || "pending",
    requestedAt:
      requestRow.$createdAt ?? undefined,
  };

  const priceText =
    proposedPrice !== undefined
      ? " at $" + proposedPrice + "/month"
      : "";

  const title = "New Property Request 📋";
  const message =
    tenantName +
    ' requested "' +
    propertyName +
    '"' +
    priceText +
    ".";

  const notificationRowId =
    ("request_" + requestId).slice(0, 36);

  const inApp = await createInAppNotification(
    tables,
    {
      rowId: notificationRowId,
      recipientUserId: ownerAccountId,
      title,
      message,
      type: "request",
      data: notificationData,
    },
  );

  if (!inApp.created) {
    diagnosticLog(
      JSON.stringify({
        event: "property-request-duplicate",
        propertyId,
        requestId,
        tenantAccountId,
        ownerAccountId,
        notificationRowId,
      }),
    );

    return {
      skipped: true,
      duplicate: true,
      reason:
        "This property-request notification was already processed.",
      notificationRowId,
      recipientUserId: ownerAccountId,
      propertyId,
      requestId,
      data: notificationData,
    };
  }

  const push = await sendToUser(
    tables,
    ownerAccountId,
    validateNotification({
      title,
      body: message,
      data: notificationData,
    }),
    diagnosticLog,
  );

  return {
    skipped: false,
    duplicate: false,
    notificationCreated: true,
    notificationRowId,
    recipientUserId: ownerAccountId,
    propertyId,
    requestId,
    data: notificationData,
    push,
  };
};

const notifyPropertyReview = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const reviewerAccountId =
    requireAuthenticatedUser(req);

  const propertiesTableId =
    requireConfiguredTable(
      PROPERTIES_TABLE_ID,
      "Properties table",
    );

  requireConfiguredTable(
    USERS_TABLE_ID,
    "Users table",
  );

  requireConfiguredTable(
    NOTIFICATIONS_TABLE_ID,
    "Notifications table",
  );

  const propertyId = String(
    body.propertyId ?? "",
  ).trim();

  const reviewId = String(
    body.reviewId ?? "",
  ).trim();

  if (!propertyId) {
    throw statusError(
      400,
      "propertyId is required.",
    );
  }

  if (!reviewId) {
    throw statusError(
      400,
      "reviewId is required.",
    );
  }

  const property = await getRowOrNull(
    tables,
    propertiesTableId,
    propertyId,
  );

  if (!property) {
    throw statusError(
      404,
      "The requested property could not be found.",
    );
  }

  const ownerAccountId = String(
    property.creatorId ?? "",
  ).trim();

  if (!ownerAccountId) {
    throw statusError(
      409,
      "The property does not have a valid owner account ID.",
    );
  }

  if (ownerAccountId === reviewerAccountId) {
    return {
      skipped: true,
      reason:
        "Property owners are not notified about reviews of their own properties.",
      recipientUserId: ownerAccountId,
      propertyId,
      reviewId,
    };
  }

  const reviews = parseJsonArray(
    property.reviews,
  );

  const review = reviews.find(
    (item) =>
      String(item?.id ?? "").trim() === reviewId,
  );

  if (!review) {
    throw statusError(
      409,
      "A matching property review was not found. Save the review before requesting the notification.",
    );
  }

  const storedReviewerId = String(
    review.reviewerId ??
      review.userId ??
      "",
  ).trim();

  if (!storedReviewerId) {
    throw statusError(
      409,
      "The review does not contain a reviewer account ID.",
    );
  }

  if (storedReviewerId !== reviewerAccountId) {
    throw statusError(
      403,
      "The authenticated user does not own this review.",
    );
  }

  const reviewerUser =
    await getUserRowByReference(
      tables,
      reviewerAccountId,
    );

  const reviewerName = String(
    review.userName ??
      review.reviewerName ??
      reviewerUser?.name ??
      "A tenant",
  ).trim() || "A tenant";

  const propertyName = String(
    property.propertyName ?? "Property",
  ).trim() || "Property";

  const rawRating = Number(
    review.rating,
  );

  const rating = Number.isFinite(rawRating)
    ? Math.min(5, Math.max(1, rawRating))
    : 1;

  const roundedRating = Math.round(rating);

  const stars =
    "★".repeat(roundedRating) +
    "☆".repeat(5 - roundedRating);

  const reviewText = String(
    review.review ??
      review.reviewText ??
      review.text ??
      "",
  )
    .trim()
    .slice(0, 1500);

  const notificationData = {
    type: "review",
    screen: "/properties/" + propertyId,
    propertyId,
    propertyName,
    reviewId,
    reviewerId: reviewerAccountId,
    reviewerName,
    reviewerAvatar: String(
      review.userAvatar ??
        review.reviewerAvatar ??
        reviewerUser?.customAvatar ??
        reviewerUser?.avatar ??
        "",
    ).trim(),
    reviewerEmail: String(
      reviewerUser?.email ?? "",
    ).trim(),
    reviewerPhone: String(
      reviewerUser?.phone ?? "",
    ).trim(),
    rating,
    stars,
    reviewText,
    reviewedAt:
      review.date ??
      review.reviewedAt ??
      undefined,
  };

  const textPreview = reviewText
    ? ': "' +
      reviewText.slice(0, 100) +
      (reviewText.length > 100 ? "…" : "") +
      '"'
    : "";

  const title = "New Property Review ⭐";
  const message =
    reviewerName +
    ' rated "' +
    propertyName +
    '" ' +
    rating +
    "/5 " +
    stars +
    textPreview;

  const notificationRowId =
    ("review_" + reviewId).slice(0, 36);

  const inApp = await createInAppNotification(
    tables,
    {
      rowId: notificationRowId,
      recipientUserId: ownerAccountId,
      title,
      message,
      type: "review",
      data: notificationData,
    },
  );

  if (!inApp.created) {
    diagnosticLog(
      JSON.stringify({
        event: "property-review-duplicate",
        propertyId,
        reviewId,
        reviewerAccountId,
        ownerAccountId,
        notificationRowId,
      }),
    );

    return {
      skipped: true,
      duplicate: true,
      reason:
        "This property-review notification was already processed.",
      notificationRowId,
      recipientUserId: ownerAccountId,
      propertyId,
      reviewId,
      data: notificationData,
    };
  }

  const push = await sendToUser(
    tables,
    ownerAccountId,
    validateNotification({
      title,
      body: message,
      data: notificationData,
    }),
    diagnosticLog,
  );

  return {
    skipped: false,
    duplicate: false,
    notificationCreated: true,
    notificationRowId,
    recipientUserId: ownerAccountId,
    propertyId,
    reviewId,
    data: notificationData,
    push,
  };
};

`;

function patchPushFunction(original) {
  let content = original;

  if (!content.includes("const REQUESTS_TABLE_ID")) {
    content = replaceRequired(
      content,
      `const LIKES_TABLE_ID = env(
  "NOOKLY_LIKES_COLLECTION_ID",
);
`,
      `const LIKES_TABLE_ID = env(
  "NOOKLY_LIKES_COLLECTION_ID",
);
${functionHelpers}`,
      "the requests table configuration insertion point",
    );
  }

  if (!content.includes("const notifyPropertyRequest")) {
    content = replaceRequired(
      content,
      "const checkReceipts = async (body) => {",
      `${secureEventFunctions}const checkReceipts = async (body) => {`,
      "the secure tenant-landlord event insertion point",
    );
  }

  content = content.replace(
    'version: "1.1.0"',
    'version: "1.3.0"',
  );

  if (
    !content.includes(
      "requests: Boolean(",
    )
  ) {
    content = replaceRequired(
      content,
      `          likes: Boolean(LIKES_TABLE_ID),
          consoleTestSecret: Boolean(`,
      `          likes: Boolean(LIKES_TABLE_ID),
          requests: Boolean(
            REQUESTS_TABLE_ID,
          ),
          consoleTestSecret: Boolean(`,
      "the health configuration requests flag",
    );
  }

  if (
    !content.includes(
      'path === "/property-request"',
    )
  ) {
    const routeMarker = `    if (
      method === "POST" &&
      path === "/property-like"
    ) {`;

    const routes = `    if (
      method === "POST" &&
      path === "/property-request"
    ) {
      return ok(
        res,
        await notifyPropertyRequest(
          req,
          tables,
          body,
          log,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/property-review"
    ) {
      return ok(
        res,
        await notifyPropertyReview(
          req,
          tables,
          body,
          log,
        ),
      );
    }

`;

    content = replaceRequired(
      content,
      routeMarker,
      `${routes}${routeMarker}`,
      "the secure Function route insertion point",
    );
  }

  return content;
}

function patchLandlordNotifications(original) {
  let content = original;

  content = content.replace(
    `  type: "like" | "message" | "review" | "system" | "event";`,
    `  type:
    | "like"
    | "message"
    | "review"
    | "request"
    | "system"
    | "event";`,
  );

  if (
    !content.includes(
      'notification.type === "request"',
    )
  ) {
    content = replaceRequired(
      content,
      `      if (notification.type === "event") {
        router.push("/calendar");
      } else if (
        notification.type === "like" ||
        notification.type === "review"
      ) {`,
      `      if (notification.type === "event") {
        router.push("/calendar");
      } else if (notification.type === "request") {
        router.push("/Landrequests" as any);
      } else if (
        notification.type === "like" ||
        notification.type === "review"
      ) {`,
      "request notification navigation",
    );
  }

  if (
    !content.includes(
      'case "request":\n        return icons.request;',
    )
  ) {
    content = replaceRequired(
      content,
      `      case "review":
        return icons.star;
      case "event":`,
      `      case "review":
        return icons.star;
      case "request":
        return icons.request;
      case "event":`,
      "request notification icon",
    );
  }

  if (
    !content.includes(
      'case "request":\n        return "#8B5CF6";',
    )
  ) {
    content = replaceRequired(
      content,
      `      case "review":
        return "#F59E0B";
      case "event":`,
      `      case "review":
        return "#F59E0B";
      case "request":
        return "#8B5CF6";
      case "event":`,
      "request notification color",
    );
  }

  if (
    !content.includes(
      "const renderStructuredDetails",
    )
  ) {
    const marker =
      "  const renderNotification = ({ item }: { item: NotificationItem }) => (";

    const helper = `  const renderStructuredDetails = (
    item: NotificationItem,
  ) => {
    if (item.type === "review") {
      const rawRating = Number(
        item.data?.rating ?? 0,
      );
      const rating = Number.isFinite(rawRating)
        ? Math.max(0, Math.min(5, rawRating))
        : 0;
      const roundedRating = Math.round(rating);
      const stars =
        item.data?.stars ||
        \`\${"★".repeat(roundedRating)}\${"☆".repeat(
          5 - roundedRating,
        )}\`;
      const reviewText = String(
        item.data?.reviewText ?? "",
      ).trim();

      return (
        <View
          className="mt-3 rounded-xl p-3"
          style={{
            backgroundColor: "#F59E0B12",
            borderWidth: 1,
            borderColor: "#F59E0B35",
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text
              className="font-rubik-medium flex-1 mr-2"
              style={{ color: theme.text }}
            >
              {item.data?.reviewerName || "Tenant"}
            </Text>
            <Text
              className="font-rubik-medium"
              style={{ color: "#F59E0B" }}
            >
              {stars} {rating.toFixed(1)}/5
            </Text>
          </View>

          <Text
            className="text-xs mt-1"
            style={{ color: theme.muted }}
          >
            Property: {item.data?.propertyName || "Property"}
          </Text>

          {reviewText ? (
            <Text
              className="text-sm mt-2"
              style={{ color: theme.text }}
            >
              “{reviewText}”
            </Text>
          ) : null}
        </View>
      );
    }

    if (item.type === "request") {
      const proposedPrice = Number(
        item.data?.proposedPrice ??
          item.data?.originalPrice,
      );
      const questions = Array.isArray(
        item.data?.questions,
      )
        ? item.data.questions
        : [];
      const requestMessage = String(
        item.data?.message ?? "",
      ).trim();

      return (
        <View
          className="mt-3 rounded-xl p-3"
          style={{
            backgroundColor: "#8B5CF612",
            borderWidth: 1,
            borderColor: "#8B5CF635",
          }}
        >
          <Text
            className="font-rubik-medium"
            style={{ color: theme.text }}
          >
            {item.data?.tenantName || "Tenant"}
          </Text>

          <Text
            className="text-xs mt-1"
            style={{ color: theme.muted }}
          >
            Property: {item.data?.propertyName || "Property"}
          </Text>

          {Number.isFinite(proposedPrice) ? (
            <Text
              className="text-sm mt-2"
              style={{ color: theme.text }}
            >
              Proposed price: \${proposedPrice}/month
            </Text>
          ) : null}

          {item.data?.moveInDate ? (
            <Text
              className="text-xs mt-1"
              style={{ color: theme.muted }}
            >
              Move-in: {item.data.moveInDate}
            </Text>
          ) : null}

          {item.data?.leaseDuration ? (
            <Text
              className="text-xs mt-1"
              style={{ color: theme.muted }}
            >
              Lease: {item.data.leaseDuration}
            </Text>
          ) : null}

          {requestMessage ? (
            <Text
              className="text-sm mt-2"
              style={{ color: theme.text }}
            >
              “{requestMessage}”
            </Text>
          ) : null}

          {questions.length > 0 ? (
            <Text
              className="text-xs mt-2"
              style={{ color: theme.primary[300] }}
            >
              {questions.length} question
              {questions.length === 1 ? "" : "s"} included
            </Text>
          ) : null}
        </View>
      );
    }

    return null;
  };

`;

    content = replaceRequired(
      content,
      marker,
      `${helper}${marker}`,
      "the structured notification renderer insertion point",
    );
  }

  if (
    !content.includes(
      "{renderStructuredDetails(item)}",
    )
  ) {
    content = replaceRequired(
      content,
      `        <Text className="text-sm mt-1" style={{ color: theme.muted }}>
          {item.message}
        </Text>
        <Text className="text-xs mt-1" style={{ color: theme.muted }}>`,
      `        <Text className="text-sm mt-1" style={{ color: theme.muted }}>
          {item.message}
        </Text>
        {renderStructuredDetails(item)}
        <Text className="text-xs mt-1" style={{ color: theme.muted }}>`,
      "the structured notification details placement",
    );
  }

  content = content.replace(
    "When you get likes, messages, or add calendar events, they'll appear here",
    "When you get requests, reviews, likes, messages, or calendar events, they'll appear here",
  );

  return content;
}

const originals = {
  appwrite: read(paths.appwrite),
  pushService: read(paths.pushService),
  pushFunction: read(paths.pushFunction),
  landlordNotifications:
    read(paths.landlordNotifications),
};

const patched = {
  appwrite: patchAppwrite(originals.appwrite),
  pushService:
    patchPushService(originals.pushService),
  pushFunction:
    patchPushFunction(originals.pushFunction),
  landlordNotifications:
    patchLandlordNotifications(
      originals.landlordNotifications,
    ),
};

const validations = [
  [
    patched.appwrite.includes(
      "notifyPropertyRequest(",
    ),
    "requestProperty does not call the secure request route",
  ],
  [
    patched.appwrite.includes(
      "notifyPropertyReview(",
    ),
    "addReview does not call the secure review route",
  ],
  [
    !patched.appwrite
      .slice(
        patched.appwrite.indexOf(
          "export const requestProperty",
        ),
        patched.appwrite.indexOf(
          "export const markAllNotificationsAsRead",
        ),
      )
      .includes('"unique()"'),
    'literal "unique()" remains in requestProperty',
  ],
  [
    patched.pushFunction.includes(
      'path === "/property-request"',
    ),
    "the Function is missing /property-request",
  ],
  [
    patched.pushFunction.includes(
      'path === "/property-review"',
    ),
    "the Function is missing /property-review",
  ],
  [
    patched.landlordNotifications.includes(
      "renderStructuredDetails",
    ),
    "the landlord screen lacks structured request/review cards",
  ],
];

const failed = validations.find(
  ([valid]) => !valid,
);

if (failed) {
  throw new Error(
    `Validation failed: ${failed[1]}. No files were written.`,
  );
}

writeWithBackup(
  paths.appwrite,
  patched.appwrite,
);
writeWithBackup(
  paths.pushService,
  patched.pushService,
);
writeWithBackup(
  paths.pushFunction,
  patched.pushFunction,
);
writeWithBackup(
  paths.landlordNotifications,
  patched.landlordNotifications,
);

console.log("");
console.log(
  "Tenant → landlord request/review notification patch applied.",
);
console.log("");
console.log("Updated:");
console.log("- lib/appwrite.ts");
console.log("- services/push-function.service.ts");
console.log(
  "- functions/nookly-push-api/src/main.js",
);
console.log(
  "- app/(root)/(landlord)/landLordNotifications.tsx",
);
console.log("");
console.log("Next:");
console.log("npx tsc --noEmit");
console.log("");
console.log(
  "Then build the Function deployment ZIP:",
);
console.log(
  "powershell -ExecutionPolicy Bypass -File .\\package-push-function-v1.3.ps1",
);
