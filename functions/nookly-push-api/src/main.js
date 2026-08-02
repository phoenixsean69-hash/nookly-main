import {
  Client,
  ID,
  Permission,
  Query,
  Role,
  TablesDB,
} from "node-appwrite";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL =
  "https://exp.host/--/api/v2/push/getReceipts";

const env = (name, fallback = "") =>
  String(process.env[name] ?? fallback).trim();

const DATABASE_ID = env("NOOKLY_DATABASE_ID");
const PUSH_TOKENS_TABLE_ID = env(
  "NOOKLY_PUSH_TOKENS_COLLECTION_ID",
);
const USERS_TABLE_ID = env("NOOKLY_USERS_COLLECTION_ID");
const NOTIFICATIONS_TABLE_ID = env(
  "NOOKLY_NOTIFICATIONS_COLLECTION_ID",
);
const PROPERTIES_TABLE_ID = env(
  "NOOKLY_PROPERTIES_COLLECTION_ID",
);
const LIKES_TABLE_ID = env(
  "NOOKLY_LIKES_COLLECTION_ID",
);
const CONSOLE_TEST_SECRET = env(
  "NOOKLY_CONSOLE_TEST_SECRET",
);

const ok = (res, data, status = 200) =>
  res.json({ ok: true, data }, status);

const fail = (res, status, message, details) =>
  res.json(
    {
      ok: false,
      error: message,
      ...(details ? { details } : {}),
    },
    status,
  );

const statusError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const parseBody = (req) => {
  if (
    req.bodyJson &&
    typeof req.bodyJson === "object" &&
    !Array.isArray(req.bodyJson)
  ) {
    return req.bodyJson;
  }

  const text = String(req.bodyText ?? "").trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const normalizePath = (req) => {
  const raw = String(req.path ?? req.url ?? "/").trim();
  const withoutQuery = raw.split("?")[0] || "/";
  return withoutQuery.startsWith("/")
    ? withoutQuery
    : `/${withoutQuery}`;
};

const getHeader = (req, name) =>
  String(req.headers?.[name.toLowerCase()] ?? "").trim();

const isExpoPushToken = (value) =>
  /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(
    String(value ?? "").trim(),
  );

const requireAuthenticatedUser = (req) => {
  const userId = getHeader(req, "x-appwrite-user-id");

  if (!userId) {
    throw statusError(
      401,
      "Authentication is required for this route.",
    );
  }

  return userId;
};

const createAdminClient = (req) => {
  const endpoint =
    env("APPWRITE_FUNCTION_API_ENDPOINT") ||
    env("APPWRITE_ENDPOINT") ||
    "https://fra.cloud.appwrite.io/v1";

  const projectId = env("APPWRITE_FUNCTION_PROJECT_ID");
  const apiKey =
    getHeader(req, "x-appwrite-key") ||
    env("APPWRITE_FUNCTION_API_KEY");

  if (!projectId || !apiKey) {
    throw statusError(
      500,
      "Appwrite function credentials are unavailable.",
    );
  }

  return new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
};

const createTables = (req) =>
  new TablesDB(createAdminClient(req));

const requireConfiguredTable = (tableId, label) => {
  if (!tableId) {
    throw statusError(
      500,
      `${label} is not configured for the Nookly Push API.`,
    );
  }

  return tableId;
};

const listAllRows = async (
  tables,
  tableId,
  queries = [],
  maximum = 1000,
) => {
  const rows = [];
  const pageSize = Math.min(100, maximum);

  for (
    let offset = 0;
    offset < maximum;
    offset += pageSize
  ) {
    const result = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [
        ...queries,
        Query.limit(pageSize),
        Query.offset(offset),
      ],
    });

    const pageRows = Array.isArray(result.rows)
      ? result.rows
      : [];

    rows.push(...pageRows);

    if (
      pageRows.length < pageSize ||
      rows.length >=
        Number(result.total ?? rows.length)
    ) {
      break;
    }
  }

  return rows.slice(0, maximum);
};

const getRowOrNull = async (
  tables,
  tableId,
  rowId,
) => {
  try {
    return await tables.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
    });
  } catch (error) {
    if (Number(error?.code ?? error?.statusCode) === 404) {
      return null;
    }

    throw error;
  }
};

const deduplicateTokenRows = (rows) => {
  const byToken = new Map();

  for (const row of rows) {
    const token = String(row?.token ?? "").trim();

    if (!isExpoPushToken(token)) continue;

    const existing = byToken.get(token);

    if (!existing) {
      byToken.set(token, row);
      continue;
    }

    const existingTime = new Date(
      existing.$updatedAt ||
        existing.$createdAt ||
        0,
    ).getTime();

    const rowTime = new Date(
      row.$updatedAt ||
        row.$createdAt ||
        0,
    ).getTime();

    if (rowTime >= existingTime) {
      byToken.set(token, row);
    }
  }

  return [...byToken.values()];
};

const listActiveTokenRows = async (
  tables,
  userIds,
) => {
  const uniqueUserIds = [
    ...new Set(
      userIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];

  if (uniqueUserIds.length === 0) return [];

  const rows = [];

  for (
    let index = 0;
    index < uniqueUserIds.length;
    index += 100
  ) {
    const batch = uniqueUserIds.slice(
      index,
      index + 100,
    );

    const batchRows = await listAllRows(
      tables,
      PUSH_TOKENS_TABLE_ID,
      [
        Query.equal("userId", batch),
        Query.equal("isActive", true),
      ],
      5000,
    );

    rows.push(...batchRows);
  }

  return deduplicateTokenRows(rows);
};

const deactivateTokenRow = async (
  tables,
  rowId,
) => {
  if (!rowId) return;

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: PUSH_TOKENS_TABLE_ID,
    rowId,
    data: {
      isActive: false,
    },
  });
};

const sendExpoMessages = async (
  tables,
  tokenRows,
  notification,
) => {
  const messages = tokenRows.map((row) => ({
    to: row.token,
    sound: notification.sound || "default",
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    priority: notification.priority || "high",
    channelId:
      notification.channelId || "default",
  }));

  const tickets = [];
  const failures = [];

  for (
    let index = 0;
    index < messages.length;
    index += 100
  ) {
    const chunk = messages.slice(
      index,
      index + 100,
    );
    const chunkRows = tokenRows.slice(
      index,
      index + 100,
    );

    const response = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const payload = await response
      .json()
      .catch(() => ({}));

    if (!response.ok) {
      throw statusError(
        502,
        payload?.errors?.[0]?.message ||
          `Expo rejected the request with HTTP ${response.status}.`,
      );
    }

    const chunkTickets = Array.isArray(payload.data)
      ? payload.data
      : payload.data
        ? [payload.data]
        : [];

    for (
      let ticketIndex = 0;
      ticketIndex < chunkTickets.length;
      ticketIndex += 1
    ) {
      const ticket = chunkTickets[ticketIndex];
      const tokenRow = chunkRows[ticketIndex];

      tickets.push({
        tokenRowId: tokenRow?.$id,
        token: tokenRow?.token,
        ...ticket,
      });

      if (ticket?.status === "error") {
        failures.push({
          tokenRowId: tokenRow?.$id,
          token: tokenRow?.token,
          message: ticket.message,
          details: ticket.details,
        });

        if (
          ticket?.details?.error ===
            "DeviceNotRegistered" &&
          tokenRow?.$id
        ) {
          await deactivateTokenRow(
            tables,
            tokenRow.$id,
          ).catch(() => undefined);
        }
      }
    }
  }

  return {
    requested: messages.length,
    accepted: tickets.filter(
      (ticket) => ticket.status === "ok",
    ).length,
    failed: failures.length,
    tickets,
    failures,
  };
};

const validateNotification = (body) => {
  const title = String(body.title ?? "")
    .trim()
    .slice(0, 120);

  const message = String(body.body ?? "")
    .trim()
    .slice(0, 500);

  if (!title) {
    throw statusError(
      400,
      "Notification title is required.",
    );
  }

  if (!message) {
    throw statusError(
      400,
      "Notification body is required.",
    );
  }

  const data =
    body.data &&
    typeof body.data === "object" &&
    !Array.isArray(body.data)
      ? body.data
      : {};

  return {
    title,
    body: message,
    data,
    sound: "default",
    priority: "high",
    channelId: "default",
  };
};

const getUserRowByAccountId = async (
  tables,
  accountId,
) => {
  requireConfiguredTable(
    USERS_TABLE_ID,
    "Users table",
  );

  const result = await tables.listRows({
    databaseId: DATABASE_ID,
    tableId: USERS_TABLE_ID,
    queries: [
      Query.equal("accountId", accountId),
      Query.limit(1),
    ],
  });

  return result.rows?.[0] ?? null;
};

const isPrivilegedUser = (userRow) => {
  const mode = String(
    userRow?.userMode ?? userRow?.role ?? "",
  )
    .trim()
    .toLowerCase();

  return new Set([
    "admin",
    "superadmin",
    "institution",
    "organization",
    "organisation",
  ]).has(mode);
};

const requirePrivilegedUser = async (
  req,
  tables,
) => {
  const accountId = requireAuthenticatedUser(req);
  const userRow = await getUserRowByAccountId(
    tables,
    accountId,
  );

  if (!userRow || !isPrivilegedUser(userRow)) {
    throw statusError(
      403,
      "You are not authorized to send notifications to other users.",
    );
  }

  return { accountId, userRow };
};

const registerDevice = async (
  req,
  tables,
  body,
) => {
  const userId = requireAuthenticatedUser(req);
  const token = String(body.token ?? "").trim();

  const deviceType = String(
    body.deviceType ??
      body.platform ??
      "android",
  )
    .trim()
    .toLowerCase()
    .slice(0, 30);

  if (!isExpoPushToken(token)) {
    throw statusError(
      400,
      "A valid Expo push token is required.",
    );
  }

  const existingRows = await listAllRows(
    tables,
    PUSH_TOKENS_TABLE_ID,
    [
      Query.equal("userId", userId),
      Query.equal("token", token),
    ],
    100,
  );

  if (existingRows.length > 0) {
    const sorted = [...existingRows].sort(
      (left, right) =>
        new Date(
          right.$updatedAt ||
            right.$createdAt ||
            0,
        ).getTime() -
        new Date(
          left.$updatedAt ||
            left.$createdAt ||
            0,
        ).getTime(),
    );

    const primary = sorted[0];

    const updated = await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: PUSH_TOKENS_TABLE_ID,
      rowId: primary.$id,
      data: {
        deviceType,
        isActive: true,
      },
    });

    for (const duplicate of sorted.slice(1)) {
      await deactivateTokenRow(
        tables,
        duplicate.$id,
      ).catch(() => undefined);
    }

    return {
      created: false,
      tokenRowId: updated.$id,
      isActive: true,
      duplicatesDeactivated:
        Math.max(0, sorted.length - 1),
    };
  }

  const created = await tables.createRow({
    databaseId: DATABASE_ID,
    tableId: PUSH_TOKENS_TABLE_ID,
    rowId: ID.unique(),
    data: {
      userId,
      token,
      deviceType,
      isActive: true,
    },
    permissions: [
      Permission.read(Role.user(userId)),
      Permission.update(Role.user(userId)),
      Permission.delete(Role.user(userId)),
    ],
  });

  return {
    created: true,
    tokenRowId: created.$id,
    isActive: true,
    duplicatesDeactivated: 0,
  };
};

const deactivateDevice = async (
  req,
  tables,
  body,
) => {
  const userId = requireAuthenticatedUser(req);
  const token = String(body.token ?? "").trim();

  const queries = [
    Query.equal("userId", userId),
    Query.equal("isActive", true),
  ];

  if (token) {
    queries.push(Query.equal("token", token));
  }

  const rows = await listAllRows(
    tables,
    PUSH_TOKENS_TABLE_ID,
    queries,
    100,
  );

  for (const row of rows) {
    await deactivateTokenRow(
      tables,
      row.$id,
    );
  }

  return {
    deactivated: rows.length,
  };
};

const sendToUser = async (
  tables,
  recipientUserId,
  notification,
  diagnosticLog = () => undefined,
) => {
  const userId = String(
    recipientUserId ?? "",
  ).trim();

  if (!userId) {
    throw statusError(
      400,
      "recipientUserId is required.",
    );
  }

  const tokenRows = await listActiveTokenRows(
    tables,
    [userId],
  );

  diagnosticLog(
    JSON.stringify({
      event: "push-token-lookup",
      recipientUserId: userId,
      activeTokenCount: tokenRows.length,
    }),
  );

  if (tokenRows.length === 0) {
    return {
      requested: 0,
      accepted: 0,
      failed: 0,
      tickets: [],
      failures: [],
      message:
        "No active push token was found for this user.",
    };
  }

  const result = await sendExpoMessages(
    tables,
    tokenRows,
    notification,
  );

  diagnosticLog(
    JSON.stringify({
      event: "expo-push-result",
      requested: result.requested,
      accepted: result.accepted,
      failed: result.failed,
      ticketStatuses: result.tickets.map(
        (ticket) => ({
          status: ticket.status,
          id: ticket.id ?? null,
          error:
            ticket.details?.error ?? null,
          message: ticket.message ?? null,
        }),
      ),
    }),
  );

  return result;
};

const sendToUsers = async (
  tables,
  recipientUserIds,
  notification,
) => {
  if (!Array.isArray(recipientUserIds)) {
    throw statusError(
      400,
      "recipientUserIds must be an array.",
    );
  }

  const userIds = [
    ...new Set(
      recipientUserIds
        .map((value) =>
          String(value ?? "").trim(),
        )
        .filter(Boolean),
    ),
  ].slice(0, 1000);

  if (userIds.length === 0) {
    throw statusError(
      400,
      "At least one recipient user ID is required.",
    );
  }

  const tokenRows = await listActiveTokenRows(
    tables,
    userIds,
  );

  if (tokenRows.length === 0) {
    return {
      requested: 0,
      accepted: 0,
      failed: 0,
      tickets: [],
      failures: [],
      message:
        "No active push tokens were found.",
    };
  }

  return sendExpoMessages(
    tables,
    tokenRows,
    notification,
  );
};

const sendToRole = async (
  tables,
  role,
  notification,
) => {
  const normalizedRole = String(role ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedRole) {
    throw statusError(
      400,
      "role is required.",
    );
  }

  const users = await listAllRows(
    tables,
    USERS_TABLE_ID,
    [Query.equal("userMode", normalizedRole)],
    5000,
  );

  const userIds = users
    .map((row) =>
      String(row.accountId ?? "").trim(),
    )
    .filter(Boolean);

  return sendToUsers(
    tables,
    userIds,
    notification,
  );
};

const createInAppNotification = async (
  tables,
  {
    rowId,
    recipientUserId,
    title,
    message,
    type,
    data,
  },
) => {
  requireConfiguredTable(
    NOTIFICATIONS_TABLE_ID,
    "Notifications table",
  );

  const existing = await getRowOrNull(
    tables,
    NOTIFICATIONS_TABLE_ID,
    rowId,
  );

  if (existing) {
    return {
      created: false,
      row: existing,
    };
  }

  try {
    const created = await tables.createRow({
      databaseId: DATABASE_ID,
      tableId: NOTIFICATIONS_TABLE_ID,
      rowId,
      data: {
        userId: recipientUserId,
        title,
        message,
        type,
        data: JSON.stringify(data ?? {}),
        read: false,
      },
      permissions: [
        Permission.read(
          Role.user(recipientUserId),
        ),
        Permission.update(
          Role.user(recipientUserId),
        ),
        Permission.delete(
          Role.user(recipientUserId),
        ),
      ],
    });

    return {
      created: true,
      row: created,
    };
  } catch (error) {
    if (
      Number(
        error?.code ?? error?.statusCode,
      ) === 409
    ) {
      const duplicate = await getRowOrNull(
        tables,
        NOTIFICATIONS_TABLE_ID,
        rowId,
      );

      return {
        created: false,
        row: duplicate,
      };
    }

    throw error;
  }
};

const notifyPropertyLike = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const likerAccountId =
    requireAuthenticatedUser(req);

  const propertiesTableId =
    requireConfiguredTable(
      PROPERTIES_TABLE_ID,
      "Properties table",
    );

  const likesTableId =
    requireConfiguredTable(
      LIKES_TABLE_ID,
      "Likes table",
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

  if (!propertyId) {
    throw statusError(
      400,
      "propertyId is required.",
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

  if (ownerAccountId === likerAccountId) {
    return {
      skipped: true,
      reason:
        "Property owners are not notified about their own likes.",
      recipientUserId: ownerAccountId,
      propertyId,
    };
  }

  const likeRows = await listAllRows(
    tables,
    likesTableId,
    [
      Query.equal("propertyId", propertyId),
      Query.equal("userId", likerAccountId),
    ],
    5,
  );

  const likeRow = likeRows[0];

  if (!likeRow) {
    throw statusError(
      409,
      "A matching property-like record was not found. Save the like before requesting the notification.",
    );
  }

  const likerUser = await getUserRowByAccountId(
    tables,
    likerAccountId,
  );

  const likerName = String(
    likerUser?.name ?? "Someone",
  ).trim() || "Someone";

  const propertyName = String(
    property.propertyName ?? "Property",
  ).trim() || "Property";

  const likeCount = Number(
    property.likes ?? 0,
  );

  const notificationData = {
    type: "like",
    screen: `/properties/${propertyId}`,
    propertyId,
    propertyName,
    likerId: likerAccountId,
    likerName,
    likeCount,
  };

  const title = "New Like! ❤️";
  const message =
    `${likerName} liked your property "${propertyName}".`;

  const notificationRowId =
    `like_${String(likeRow.$id)}`.slice(0, 36);

  const inApp = await createInAppNotification(
    tables,
    {
      rowId: notificationRowId,
      recipientUserId: ownerAccountId,
      title,
      message,
      type: "like",
      data: notificationData,
    },
  );

  if (!inApp.created) {
    diagnosticLog(
      JSON.stringify({
        event: "property-like-duplicate",
        propertyId,
        likerAccountId,
        ownerAccountId,
        notificationRowId,
      }),
    );

    return {
      skipped: true,
      duplicate: true,
      reason:
        "This like notification was already processed.",
      notificationRowId,
      recipientUserId: ownerAccountId,
      propertyId,
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
    push,
  };
};

const checkReceipts = async (body) => {
  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((value) =>
          String(value ?? "").trim(),
        )
        .filter(Boolean)
        .slice(0, 1000)
    : [];

  if (ids.length === 0) {
    throw statusError(
      400,
      "At least one Expo ticket ID is required.",
    );
  }

  const response = await fetch(
    EXPO_RECEIPTS_URL,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ids }),
    },
  );

  const payload = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw statusError(
      502,
      payload?.errors?.[0]?.message ||
        `Expo receipt lookup failed with HTTP ${response.status}.`,
    );
  }

  return payload;
};

const resolveTestRecipient = (
  req,
  body,
  diagnosticLog,
) => {
  const authenticatedUserId = getHeader(
    req,
    "x-appwrite-user-id",
  );

  const suppliedSecret =
    getHeader(
      req,
      "x-nookly-test-secret",
    ) ||
    String(
      body.consoleTestSecret ?? "",
    ).trim();

  const requestedRecipient = String(
    body.recipientUserId ?? "",
  ).trim();

  const hasValidConsoleSecret =
    Boolean(CONSOLE_TEST_SECRET) &&
    suppliedSecret === CONSOLE_TEST_SECRET;

  if (hasValidConsoleSecret) {
    if (!requestedRecipient) {
      throw statusError(
        400,
        "recipientUserId is required for a Console test execution.",
      );
    }

    diagnosticLog(
      JSON.stringify({
        event:
          "test-recipient-resolution",
        mode: "console-secret",
        authenticatedUserId:
          authenticatedUserId || null,
        recipientUserId:
          requestedRecipient,
      }),
    );

    return requestedRecipient;
  }

  if (authenticatedUserId) {
    diagnosticLog(
      JSON.stringify({
        event:
          "test-recipient-resolution",
        mode: "authenticated-user",
        authenticatedUserId,
        recipientUserId:
          authenticatedUserId,
      }),
    );

    return authenticatedUserId;
  }

  throw statusError(
    401,
    "Authentication is required for this route.",
  );
};

export default async ({
  req,
  res,
  log,
  error,
}) => {
  const method = String(
    req.method ?? "GET",
  ).toUpperCase();

  const path = normalizePath(req);

  try {
    if (
      method === "GET" &&
      path === "/health"
    ) {
      return ok(res, {
        service: "nookly-push-api",
        version: "1.1.0",
        status: "healthy",
        functionId:
          "6a31d988001bf962fb57",
        configuration: {
          database: Boolean(DATABASE_ID),
          pushTokens: Boolean(
            PUSH_TOKENS_TABLE_ID,
          ),
          users: Boolean(USERS_TABLE_ID),
          notifications: Boolean(
            NOTIFICATIONS_TABLE_ID,
          ),
          properties: Boolean(
            PROPERTIES_TABLE_ID,
          ),
          likes: Boolean(LIKES_TABLE_ID),
          consoleTestSecret: Boolean(
            CONSOLE_TEST_SECRET,
          ),
        },
        time: new Date().toISOString(),
      });
    }

    if (
      !DATABASE_ID ||
      !PUSH_TOKENS_TABLE_ID
    ) {
      return fail(
        res,
        500,
        "The push service database configuration is incomplete.",
      );
    }

    const tables = createTables(req);
    const body = parseBody(req);

    if (
      method === "POST" &&
      path === "/register-device"
    ) {
      return ok(
        res,
        await registerDevice(
          req,
          tables,
          body,
        ),
        201,
      );
    }

    if (
      method === "POST" &&
      path === "/deactivate-device"
    ) {
      return ok(
        res,
        await deactivateDevice(
          req,
          tables,
          body,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/test"
    ) {
      const recipientUserId =
        resolveTestRecipient(
          req,
          body,
          log,
        );

      const notification =
        validateNotification({
          title:
            body.title ||
            "Nookly Push Test",
          body:
            body.body ||
            "The secure Nookly Push API is working.",
          data:
            body.data || {
              type: "alert",
              source:
                "nookly-push-api",
            },
        });

      return ok(
        res,
        await sendToUser(
          tables,
          recipientUserId,
          notification,
          log,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/property-like"
    ) {
      return ok(
        res,
        await notifyPropertyLike(
          req,
          tables,
          body,
          log,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/send-to-user"
    ) {
      await requirePrivilegedUser(
        req,
        tables,
      );

      const notification =
        validateNotification(body);

      return ok(
        res,
        await sendToUser(
          tables,
          body.recipientUserId,
          notification,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/send-to-users"
    ) {
      await requirePrivilegedUser(
        req,
        tables,
      );

      const notification =
        validateNotification(body);

      return ok(
        res,
        await sendToUsers(
          tables,
          body.recipientUserIds,
          notification,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/send-to-role"
    ) {
      await requirePrivilegedUser(
        req,
        tables,
      );

      const notification =
        validateNotification(body);

      return ok(
        res,
        await sendToRole(
          tables,
          body.role,
          notification,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/receipts/check"
    ) {
      await requirePrivilegedUser(
        req,
        tables,
      );

      return ok(
        res,
        await checkReceipts(body),
      );
    }

    return fail(
      res,
      404,
      `Route not found: ${method} ${path}`,
    );
  } catch (caught) {
    const status = Number(
      caught?.statusCode ??
        caught?.code ??
        500,
    );

    const message =
      caught instanceof Error
        ? caught.message
        : "Unexpected push-service failure.";

    error(
      JSON.stringify({
        service: "nookly-push-api",
        path,
        method,
        status,
        message,
      }),
    );

    return fail(
      res,
      status >= 400 && status <= 599
        ? status
        : 500,
      message,
    );
  } finally {
    log(
      JSON.stringify({
        service: "nookly-push-api",
        method,
        path,
      }),
    );
  }
};
