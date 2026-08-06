import crypto from "node:crypto";
import { Client, ID, Permission, Query, Role, TablesDB } from "node-appwrite";

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

const env = (name, fallback = "") =>
  String(process.env[name] ?? fallback).trim();

const DATABASE_ID = env("NOOKLY_DATABASE_ID");
const PUSH_TOKENS_TABLE_ID = env("NOOKLY_PUSH_TOKENS_COLLECTION_ID");
const USERS_TABLE_ID = env("NOOKLY_USERS_COLLECTION_ID");
const NOTIFICATIONS_TABLE_ID = env("NOOKLY_NOTIFICATIONS_COLLECTION_ID");
const ORGANIZATIONS_TABLE_ID = env(
  "NOOKLY_ORGANIZATIONS_COLLECTION_ID",
  "6a2c1643001faac686e9",
);
const PROPERTIES_TABLE_ID = env("NOOKLY_PROPERTIES_COLLECTION_ID");
const LIKES_TABLE_ID = env("NOOKLY_LIKES_COLLECTION_ID");
const REQUESTS_TABLE_ID = env(
  "NOOKLY_REQUESTS_COLLECTION_ID",
  "69c3a9f30004facf9a4d",
);
const LEASE_BUCKET_ID = env("NOOKLY_LEASE_BUCKET_ID", "69a20709002844cb4f69");
const CONSOLE_TEST_SECRET = env("NOOKLY_CONSOLE_TEST_SECRET");

const RIDE_DRIVERS_TABLE_ID = env(
  "NOOKLY_RIDE_DRIVERS_TABLE_ID",
  "ride_drivers",
);
const RIDE_DRIVER_INSTITUTIONS_TABLE_ID = env(
  "NOOKLY_RIDE_DRIVER_INSTITUTIONS_TABLE_ID",
  "ride_driver_institutions",
);
const RIDE_REQUESTS_TABLE_ID = env(
  "NOOKLY_RIDE_REQUESTS_TABLE_ID",
  "ride_requests",
);
const RIDE_OFFERS_TABLE_ID = env("NOOKLY_RIDE_OFFERS_TABLE_ID", "ride_offers");
const RIDES_TABLE_ID = env("NOOKLY_RIDES_TABLE_ID", "rides");
const RIDES_PUSH_SECRET = env("NOOKLY_RIDES_PUSH_SECRET");

const ACTIVE_DRIVER_RELATIONSHIP_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const DRIVER_RIDE_EVENT_TYPES = new Set([
  "request_created",
  "request_cancelled",
  "offer_accepted",
]);

const ok = (res, data, status = 200) => res.json({ ok: true, data }, status);

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
  return withoutQuery.startsWith("/") ? withoutQuery : `/${withoutQuery}`;
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
    throw statusError(401, "Authentication is required for this route.");
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
    getHeader(req, "x-appwrite-key") || env("APPWRITE_FUNCTION_API_KEY");

  if (!projectId || !apiKey) {
    throw statusError(500, "Appwrite function credentials are unavailable.");
  }

  return new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);
};

const createTables = (req) => new TablesDB(createAdminClient(req));

const requireConfiguredTable = (tableId, label) => {
  if (!tableId) {
    throw statusError(
      500,
      `${label} is not configured for the Nookly Push API.`,
    );
  }

  return tableId;
};

const listAllRows = async (tables, tableId, queries = [], maximum = 1000) => {
  const rows = [];
  const pageSize = Math.min(100, maximum);

  for (let offset = 0; offset < maximum; offset += pageSize) {
    const result = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [...queries, Query.limit(pageSize), Query.offset(offset)],
    });

    const pageRows = Array.isArray(result.rows) ? result.rows : [];

    rows.push(...pageRows);

    if (
      pageRows.length < pageSize ||
      rows.length >= Number(result.total ?? rows.length)
    ) {
      break;
    }
  }

  return rows.slice(0, maximum);
};

const getRowOrNull = async (tables, tableId, rowId) => {
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
      existing.$updatedAt || existing.$createdAt || 0,
    ).getTime();

    const rowTime = new Date(row.$updatedAt || row.$createdAt || 0).getTime();

    if (rowTime >= existingTime) {
      byToken.set(token, row);
    }
  }

  return [...byToken.values()];
};

const listActiveTokenRows = async (tables, userIds) => {
  const uniqueUserIds = [
    ...new Set(
      userIds.map((value) => String(value ?? "").trim()).filter(Boolean),
    ),
  ];

  if (uniqueUserIds.length === 0) return [];

  const rows = [];

  for (let index = 0; index < uniqueUserIds.length; index += 100) {
    const batch = uniqueUserIds.slice(index, index + 100);

    const batchRows = await listAllRows(
      tables,
      PUSH_TOKENS_TABLE_ID,
      [Query.equal("userId", batch), Query.equal("isActive", true)],
      5000,
    );

    rows.push(...batchRows);
  }

  return deduplicateTokenRows(rows);
};

const deactivateTokenRow = async (tables, rowId) => {
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

const sendExpoMessages = async (tables, tokenRows, notification) => {
  const messages = tokenRows.map((row) => ({
    to: row.token,
    sound: notification.sound || "default",
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    priority: notification.priority || "high",
    channelId: notification.channelId || "default",
  }));

  const tickets = [];
  const failures = [];

  for (let index = 0; index < messages.length; index += 100) {
    const chunk = messages.slice(index, index + 100);
    const chunkRows = tokenRows.slice(index, index + 100);

    const response = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(chunk),
    });

    const payload = await response.json().catch(() => ({}));

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
        ...ticket,
      });

      if (ticket?.status === "error") {
        failures.push({
          tokenRowId: tokenRow?.$id,
          message: ticket.message,
          details: ticket.details,
        });

        if (ticket?.details?.error === "DeviceNotRegistered" && tokenRow?.$id) {
          await deactivateTokenRow(tables, tokenRow.$id).catch(() => undefined);
        }
      }
    }
  }

  return {
    requested: messages.length,
    accepted: tickets.filter((ticket) => ticket.status === "ok").length,
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
    throw statusError(400, "Notification title is required.");
  }

  if (!message) {
    throw statusError(400, "Notification body is required.");
  }

  const data =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
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

const getUserRowByAccountId = async (tables, accountId) => {
  requireConfiguredTable(USERS_TABLE_ID, "Users table");

  const normalizedAccountId = String(accountId ?? "").trim();

  if (!normalizedAccountId) return null;

  // Nookly Mobile user rows may store the Appwrite account ID in
  // `accountId`, while Nookly Web organization rows use the account ID as
  // the row ID and also store it in `userId`. Resolve all supported shapes
  // so authenticated organization accounts can securely use privileged push
  // routes without changing the existing mobile schema.
  const directRow = await getRowOrNull(
    tables,
    USERS_TABLE_ID,
    normalizedAccountId,
  );

  if (directRow) return directRow;

  for (const attribute of ["accountId", "userId"]) {
    try {
      const result = await tables.listRows({
        databaseId: DATABASE_ID,
        tableId: USERS_TABLE_ID,
        queries: [Query.equal(attribute, normalizedAccountId), Query.limit(1)],
      });

      const row = result.rows?.[0] ?? null;
      if (row) return row;
    } catch (error) {
      // Some older Nookly user schemas do not expose both attributes. Ignore
      // an unavailable lookup field and continue with the next supported one.
      const status = Number(error?.code ?? error?.statusCode ?? 0);

      if (status !== 400 && status !== 404) {
        throw error;
      }
    }
  }

  return null;
};

const isPrivilegedUser = (userRow) => {
  const mode = String(userRow?.userMode ?? userRow?.role ?? "")
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

const requirePrivilegedUser = async (req, tables) => {
  const accountId = requireAuthenticatedUser(req);
  const userRow = await getUserRowByAccountId(tables, accountId);

  if (!userRow || !isPrivilegedUser(userRow)) {
    throw statusError(
      403,
      "You are not authorized to send notifications to other users.",
    );
  }

  return { accountId, userRow };
};

const STUDENT_SOS_INCIDENT_LABELS = new Map([
  ["robbery", "Robbery"],
  ["burglary", "Burglary"],
  ["being_followed", "Being followed"],
  ["assault_or_threat", "Assault or threat"],
  ["medical_emergency", "Medical emergency"],
  ["unsafe_transport", "Unsafe transport"],
  ["other_danger", "Other danger"],
]);

const normalizeSosText = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\\s+/g, " ");

const isStudentUserRow = (userRow) => {
  const userMode = normalizeSosText(
    userRow?.userMode ?? userRow?.role,
  );

  const tenantType = normalizeSosText(
    userRow?.tenantType,
  );

  return (
    userMode === "student" ||
    tenantType === "student"
  );
};

const requireSosCoordinate = (
  value,
  label,
  minimum,
  maximum,
) => {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < minimum ||
    number > maximum
  ) {
    throw statusError(
      400,
      `${label} is invalid.`,
    );
  }

  return number;
};

const optionalSosAccuracy = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const accuracy = Number(value);

  if (
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > 10000
  ) {
    throw statusError(
      400,
      "Location accuracy is invalid.",
    );
  }

  return accuracy;
};

const requireSosClientRequestId = (
  value,
) => {
  const requestId =
    String(value ?? "").trim();

  if (
    requestId.length < 8 ||
    requestId.length > 128 ||
    !/^[a-zA-Z0-9._:-]+$/.test(
      requestId,
    )
  ) {
    throw statusError(
      400,
      "clientRequestId is invalid.",
    );
  }

  return requestId;
};

const requireRecentLocationTime = (
  value,
) => {
  const raw =
    String(value ?? "").trim();

  const capturedAt = new Date(raw);

  if (
    !raw ||
    Number.isNaN(
      capturedAt.getTime(),
    )
  ) {
    throw statusError(
      400,
      "capturedAt is invalid.",
    );
  }

  const age =
    Date.now() -
    capturedAt.getTime();

  if (age < -5 * 60 * 1000) {
    throw statusError(
      400,
      "The location timestamp is in the future.",
    );
  }

  if (age > 30 * 60 * 1000) {
    throw statusError(
      409,
      "Your location is too old. Refresh it before sending the SOS.",
    );
  }

  return capturedAt.toISOString();
};

const getOrganizationDisplayName = (
  organization,
) =>
  String(
    organization?.name ??
      organization?.organizationName ??
      organization?.institutionName ??
      organization?.schoolName ??
      "Institution",
  ).trim() || "Institution";

const getResolvedAccountId = (
  userRow,
  fallback,
) =>
  String(
    userRow?.accountId ??
      userRow?.userId ??
      fallback ??
      "",
  ).trim();

const resolveStudentInstitution = async (
  tables,
  studentUser,
) => {
  const organizationTableId =
    requireConfiguredTable(
      ORGANIZATIONS_TABLE_ID,
      "Organizations table",
    );

  const organizationId =
    String(
      studentUser?.organizationId ??
        "",
    ).trim();

  if (!organizationId) {
    throw statusError(
      409,
      "Pick your Institution before sending an SOS.",
    );
  }

  const organization =
    await getRowOrNull(
      tables,
      organizationTableId,
      organizationId,
    );

  if (!organization) {
    throw statusError(
      409,
      "Your linked Institution is no longer registered on Nookly.",
    );
  }

  const organizationType =
    normalizeSosText(
      organization.type_of ??
        organization.type ??
        organization.organizationType ??
        organization.category,
    );

  if (
    organizationType !== "school"
  ) {
    throw statusError(
      409,
      "Student SOS can only target an Institution registered with type_of = school.",
    );
  }

  if (
    organization.isActive === false ||
    normalizeSosText(
      organization.status,
    ) === "inactive"
  ) {
    throw statusError(
      409,
      "Your linked Institution is not active on Nookly.",
    );
  }

  const ownerCandidates = [
    organization.userId,
    organization.accountId,
    organization.ownerId,
    organization.creatorId,
    organization.$id,
  ]
    .map((value) =>
      String(value ?? "").trim(),
    )
    .filter(Boolean);

  for (
    const candidate of ownerCandidates
  ) {
    const ownerUser =
      await getUserRowByAccountId(
        tables,
        candidate,
      );

    if (!ownerUser) {
      continue;
    }

    const recipientUserId =
      getResolvedAccountId(
        ownerUser,
        candidate,
      );

    if (recipientUserId) {
      return {
        organization,
        organizationId:
          String(
            organization.$id ??
              organizationId,
          ).trim(),
        organizationName:
          getOrganizationDisplayName(
            organization,
          ),
        recipientUserId,
        ownerUser,
      };
    }
  }

  throw statusError(
    409,
    "The Institution does not have a linked Nookly owner account.",
  );
};

const buildStudentSosAlertId = (
  studentAccountId,
  clientRequestId,
) =>
  `sos_${crypto
    .createHash("sha256")
    .update(
      `student-sos:${studentAccountId}:${clientRequestId}`,
    )
    .digest("hex")
    .slice(0, 32)}`;

const parseStoredNotificationData = (
  row,
) => {
  const raw = row?.data;

  if (
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw)
  ) {
    return raw;
  }

  try {
    const parsed =
      JSON.parse(
        String(raw ?? "{}"),
      );

    return (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
        ? parsed
        : {}
    );
  } catch {
    return {};
  }
};

const submitStudentSos = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const studentAccountId =
    requireAuthenticatedUser(req);

  requireConfiguredTable(
    USERS_TABLE_ID,
    "Users table",
  );

  requireConfiguredTable(
    NOTIFICATIONS_TABLE_ID,
    "Notifications table",
  );

  const studentUser =
    await getUserRowByAccountId(
      tables,
      studentAccountId,
    );

  if (!studentUser) {
    throw statusError(
      404,
      "The authenticated student profile could not be found.",
    );
  }

  if (
    !isStudentUserRow(studentUser)
  ) {
    throw statusError(
      403,
      "Student SOS is available only to student accounts.",
    );
  }

  const incidentType =
    normalizeSosText(
      body.incidentType,
    );

  const incidentLabel =
    STUDENT_SOS_INCIDENT_LABELS.get(
      incidentType,
    );

  if (!incidentLabel) {
    throw statusError(
      400,
      "Choose a valid SOS incident type.",
    );
  }

  const latitude =
    requireSosCoordinate(
      body.latitude,
      "Latitude",
      -90,
      90,
    );

  const longitude =
    requireSosCoordinate(
      body.longitude,
      "Longitude",
      -180,
      180,
    );

  const accuracy =
    optionalSosAccuracy(
      body.accuracy,
    );

  const capturedAt =
    requireRecentLocationTime(
      body.capturedAt,
    );

  const address =
    String(body.address ?? "")
      .trim()
      .slice(0, 500) ||
    `Latitude ${latitude.toFixed(
      6,
    )}, Longitude ${longitude.toFixed(
      6,
    )}`;

  const clientRequestId =
    requireSosClientRequestId(
      body.clientRequestId,
    );

  const institution =
    await resolveStudentInstitution(
      tables,
      studentUser,
    );

  const studentName =
    String(
      studentUser.name ??
        studentUser.fullName ??
        "A student",
    ).trim() || "A student";

  const studentPhone =
    String(
      studentUser.phone ?? "",
    ).trim();

  const studentEmail =
    String(
      studentUser.email ?? "",
    ).trim();

  const alertId =
    buildStudentSosAlertId(
      studentAccountId,
      clientRequestId,
    );

  const reportedAt =
    new Date().toISOString();

  const mapUrl =
    "https://www.openstreetmap.org/" +
    "?mlat=" +
    encodeURIComponent(latitude) +
    "&mlon=" +
    encodeURIComponent(longitude) +
    "#map=18/" +
    encodeURIComponent(latitude) +
    "/" +
    encodeURIComponent(longitude);

  const notificationData = {
    type: "student_sos",
    screen: "/notifications",
    alertId,
    clientRequestId,
    incidentType,
    incidentLabel,
    studentId: studentAccountId,
    studentName,
    studentPhone,
    studentEmail,
    organizationId:
      institution.organizationId,
    organizationName:
      institution.organizationName,
    latitude,
    longitude,
    accuracy,
    address,
    capturedAt,
    reportedAt,
    mapUrl,
  };

  const title =
    `Emergency SOS: ${incidentLabel}`;

  const message =
    (
      `${studentName} reported ${incidentLabel.toLowerCase()}. ` +
      `Location: ${address}`
    ).slice(0, 500);

  const inApp =
    await createInAppNotification(
      tables,
      {
        rowId: alertId,
        recipientUserId:
          institution.recipientUserId,
        title,
        message,
        type: "student_sos",
        data: notificationData,
      },
    );

  if (!inApp.created) {
    const storedData =
      parseStoredNotificationData(
        inApp.row,
      );

    diagnosticLog(
      JSON.stringify({
        event:
          "student-sos-duplicate",
        alertId,
        studentAccountId,
        organizationId:
          institution.organizationId,
        recipientUserId:
          institution.recipientUserId,
      }),
    );

    return {
      alertId,
      duplicate: true,
      incidentType:
        storedData.incidentType ??
        incidentType,
      incidentLabel:
        storedData.incidentLabel ??
        incidentLabel,
      organizationId:
        storedData.organizationId ??
        institution.organizationId,
      organizationName:
        storedData.organizationName ??
        institution.organizationName,
      recipientUserId:
        institution.recipientUserId,
      latitude:
        Number(
          storedData.latitude ??
            latitude,
        ),
      longitude:
        Number(
          storedData.longitude ??
            longitude,
        ),
      accuracy:
        storedData.accuracy ??
        accuracy,
      address:
        storedData.address ??
        address,
      mapUrl:
        storedData.mapUrl ??
        mapUrl,
      reportedAt:
        storedData.reportedAt ??
        reportedAt,
      notificationCreated: false,
      push: {
        requested: 0,
        accepted: 0,
        failed: 0,
        message:
          "This SOS request was already recorded.",
      },
    };
  }

  let push;

  try {
    push = await sendToUser(
      tables,
      institution.recipientUserId,
      validateNotification({
        title,
        body: message,
        data: notificationData,
      }),
      diagnosticLog,
    );
  } catch (pushError) {
    diagnosticLog(
      JSON.stringify({
        event:
          "student-sos-push-failed",
        alertId,
        studentAccountId,
        organizationId:
          institution.organizationId,
        recipientUserId:
          institution.recipientUserId,
        message:
          pushError instanceof Error
            ? pushError.message
            : String(pushError),
      }),
    );

    push = {
      requested: 0,
      accepted: 0,
      failed: 1,
      tickets: [],
      failures: [],
      message:
        "The SOS was recorded, but the mobile push request could not be completed.",
    };
  }

  diagnosticLog(
    JSON.stringify({
      event: "student-sos-recorded",
      alertId,
      incidentType,
      studentAccountId,
      organizationId:
        institution.organizationId,
      recipientUserId:
        institution.recipientUserId,
      pushRequested:
        push.requested,
      pushAccepted:
        push.accepted,
      pushFailed:
        push.failed,
    }),
  );

  return {
    alertId,
    duplicate: false,
    incidentType,
    incidentLabel,
    organizationId:
      institution.organizationId,
    organizationName:
      institution.organizationName,
    recipientUserId:
      institution.recipientUserId,
    latitude,
    longitude,
    accuracy,
    address,
    mapUrl,
    reportedAt,
    notificationCreated: true,
    push,
  };
};

const registerDevice = async (req, tables, body) => {
  const userId = requireAuthenticatedUser(req);
  const token = String(body.token ?? "").trim();

  const deviceType = String(body.deviceType ?? body.platform ?? "android")
    .trim()
    .toLowerCase()
    .slice(0, 30);

  if (!isExpoPushToken(token)) {
    throw statusError(400, "A valid Expo push token is required.");
  }

  // Expo tokens identify physical app installations and can remain the
  // same after logout or account switching. Look up the token globally so
  // it can be securely reassigned to the currently authenticated account.
  const existingRows = await listAllRows(
    tables,
    PUSH_TOKENS_TABLE_ID,
    [Query.equal("token", token)],
    100,
  );

  const ownerPermissions = [
    Permission.read(Role.user(userId)),
    Permission.update(Role.user(userId)),
    Permission.delete(Role.user(userId)),
  ];

  if (existingRows.length > 0) {
    const sorted = [...existingRows].sort(
      (left, right) =>
        new Date(right.$updatedAt || right.$createdAt || 0).getTime() -
        new Date(left.$updatedAt || left.$createdAt || 0).getTime(),
    );

    const primary = sorted[0];

    const updated = await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId: PUSH_TOKENS_TABLE_ID,
      rowId: primary.$id,
      data: {
        userId,
        token,
        deviceType,
        isActive: true,
      },
      permissions: ownerPermissions,
    });

    for (const duplicate of sorted.slice(1)) {
      await deactivateTokenRow(tables, duplicate.$id).catch(() => undefined);
    }

    return {
      created: false,
      tokenRowId: updated.$id,
      isActive: true,
      duplicatesDeactivated: Math.max(0, sorted.length - 1),
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
    permissions: ownerPermissions,
  });

  return {
    created: true,
    tokenRowId: created.$id,
    isActive: true,
    duplicatesDeactivated: 0,
  };
};

const deactivateDevice = async (req, tables, body) => {
  const userId = requireAuthenticatedUser(req);
  const token = String(body.token ?? "").trim();

  const queries = [
    Query.equal("userId", userId),
    Query.equal("isActive", true),
  ];

  if (token) {
    queries.push(Query.equal("token", token));
  }

  const rows = await listAllRows(tables, PUSH_TOKENS_TABLE_ID, queries, 100);

  for (const row of rows) {
    await deactivateTokenRow(tables, row.$id);
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
  const userId = String(recipientUserId ?? "").trim();

  if (!userId) {
    throw statusError(400, "recipientUserId is required.");
  }

  const tokenRows = await listActiveTokenRows(tables, [userId]);

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
      message: "No active push token was found for this user.",
    };
  }

  const result = await sendExpoMessages(tables, tokenRows, notification);

  diagnosticLog(
    JSON.stringify({
      event: "expo-push-result",
      requested: result.requested,
      accepted: result.accepted,
      failed: result.failed,
      ticketStatuses: result.tickets.map((ticket) => ({
        status: ticket.status,
        id: ticket.id ?? null,
        error: ticket.details?.error ?? null,
        message: ticket.message ?? null,
      })),
    }),
  );

  return result;
};

const sendToUsers = async (tables, recipientUserIds, notification) => {
  if (!Array.isArray(recipientUserIds)) {
    throw statusError(400, "recipientUserIds must be an array.");
  }

  const userIds = [
    ...new Set(
      recipientUserIds
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ].slice(0, 1000);

  if (userIds.length === 0) {
    throw statusError(400, "At least one recipient user ID is required.");
  }

  const tokenRows = await listActiveTokenRows(tables, userIds);

  if (tokenRows.length === 0) {
    return {
      requested: 0,
      accepted: 0,
      failed: 0,
      tickets: [],
      failures: [],
      message: "No active push tokens were found.",
    };
  }

  return sendExpoMessages(tables, tokenRows, notification);
};

const sendToRole = async (tables, role, notification) => {
  const normalizedRole = String(role ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedRole) {
    throw statusError(400, "role is required.");
  }

  const users = await listAllRows(
    tables,
    USERS_TABLE_ID,
    [Query.equal("userMode", normalizedRole)],
    5000,
  );

  const userIds = users
    .map((row) => String(row.accountId ?? "").trim())
    .filter(Boolean);

  return sendToUsers(tables, userIds, notification);
};

const createInAppNotification = async (
  tables,
  { rowId, recipientUserId, title, message, type, data },
) => {
  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const existing = await getRowOrNull(tables, NOTIFICATIONS_TABLE_ID, rowId);

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
        Permission.read(Role.user(recipientUserId)),
        Permission.update(Role.user(recipientUserId)),
        Permission.delete(Role.user(recipientUserId)),
      ],
    });

    return {
      created: true,
      row: created,
    };
  } catch (error) {
    if (Number(error?.code ?? error?.statusCode) === 409) {
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

const buildPropertyCreatedNotificationId = (
  propertyId,
  recipientUserId,
) =>
  `newprop_${crypto
    .createHash("sha256")
    .update(`new-property:${propertyId}:${recipientUserId}`)
    .digest("hex")
    .slice(0, 28)}`;

const notifyPropertyCreated = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const landlordAccountId =
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
      "The newly created property could not be found.",
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

  if (ownerAccountId !== landlordAccountId) {
    throw statusError(
      403,
      "Only the landlord who created this property can announce it.",
    );
  }

  const isUnavailable =
    property.isAvailable === false ||
    String(
      property.isAvailable ?? "",
    )
      .trim()
      .toLowerCase() === "false";

  if (isUnavailable) {
    return {
      skipped: true,
      duplicate: false,
      reason:
        "The property is unavailable, so tenants were not notified.",
      propertyId,
      recipientCount: 0,
      notificationCreated: 0,
      push: {
        requested: 0,
        accepted: 0,
        failed: 0,
        tickets: [],
        failures: [],
      },
    };
  }

  const tenantRows = await listAllRows(
    tables,
    USERS_TABLE_ID,
    [
      Query.equal("userMode", [
        "tenant",
        "student",
      ]),
    ],
    5000,
  );

  const candidateRecipientUserIds =
    tenantRows.map((userRow) => {
      const accountId = String(
        userRow.accountId ?? "",
      ).trim();

      const legacyUserId = String(
        userRow.userId ?? "",
      ).trim();

      return accountId || legacyUserId;
    });

  const isValidAccountId = (accountId) =>
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/.test(
      accountId,
    );

  const recipientUserIds = [
    ...new Set(
      candidateRecipientUserIds
        .filter(isValidAccountId)
        .filter(
          (accountId) =>
            accountId !== landlordAccountId,
        ),
    ),
  ];

  const invalidRecipientCount =
    candidateRecipientUserIds.filter(
      (accountId) =>
        Boolean(accountId) &&
        !isValidAccountId(accountId),
    ).length;

  if (invalidRecipientCount > 0) {
    diagnosticLog(
      JSON.stringify({
        event:
          "property-created-invalid-recipients-skipped",
        invalidRecipientCount,
      }),
    );
  }

  const propertyName =
    String(
      property.propertyName ??
        "Property",
    ).trim() || "Property";

  const address = String(
    property.address ?? "",
  ).trim();

  const city = String(
    property.city ??
      property.location ??
      "",
  ).trim();

  const location =
    address ||
    city ||
    "your area";

  const rawPrice = Number(
    property.price ?? 0,
  );

  const price =
    Number.isFinite(rawPrice) &&
    rawPrice >= 0
      ? rawPrice
      : 0;

  const formattedPrice =
    price.toLocaleString(
      "en-US",
      {
        maximumFractionDigits: 2,
      },
    );

  const priceText =
    price > 0
      ? `$${formattedPrice}/month`
      : "Price on request";

  const rawTotalSlots = Number(
    property.totalSlots ?? 0,
  );

  const totalSlots =
    Number.isFinite(rawTotalSlots)
      ? Math.max(0, rawTotalSlots)
      : 0;

  const rawAvailableSlots = Number(
    property.availableSlots ??
      totalSlots,
  );

  const availableSlots =
    Number.isFinite(rawAvailableSlots)
      ? Math.max(0, rawAvailableSlots)
      : totalSlots;

  const image1 =
    typeof property.image1 === "string"
      ? property.image1.trim()
      : "";

  const createdAt =
    typeof property.$createdAt === "string" &&
    property.$createdAt.trim()
      ? property.$createdAt
      : new Date().toISOString();

  const title =
    "New Property Listed 🏠";

  const message =
    `${propertyName} - ${priceText} in ${location}`.slice(
      0,
      500,
    );

  const notificationData = {
    type: "property",
    screen: `/properties/${propertyId}`,
    propertyId,
    propertyName,
    landlordId: ownerAccountId,
    address,
    location,
    price,
    totalSlots,
    availableSlots,
    createdAt,
    ...(image1
      ? {
          image1,
        }
      : {}),
  };

  if (recipientUserIds.length === 0) {
    return {
      skipped: true,
      duplicate: false,
      reason:
        "No tenant or student accounts were found.",
      propertyId,
      recipientCount: 0,
      notificationCreated: 0,
      push: {
        requested: 0,
        accepted: 0,
        failed: 0,
        tickets: [],
        failures: [],
      },
    };
  }

  const newlyNotifiedUserIds = [];
  const notificationRowIds = [];

  const inAppBatchSize = 25;

  for (
    let index = 0;
    index < recipientUserIds.length;
    index += inAppBatchSize
  ) {
    const batch =
      recipientUserIds.slice(
        index,
        index + inAppBatchSize,
      );

    const results = await Promise.all(
      batch.map(
        async (recipientUserId) => {
          const rowId =
            buildPropertyCreatedNotificationId(
              propertyId,
              recipientUserId,
            );

          const result =
            await createInAppNotification(
              tables,
              {
                rowId,
                recipientUserId,
                title,
                message,
                type: "property",
                data: notificationData,
              },
            );

          return {
            rowId,
            recipientUserId,
            created: result.created,
          };
        },
      ),
    );

    for (const result of results) {
      notificationRowIds.push(
        result.rowId,
      );

      if (result.created) {
        newlyNotifiedUserIds.push(
          result.recipientUserId,
        );
      }
    }
  }

  if (newlyNotifiedUserIds.length === 0) {
    return {
      skipped: true,
      duplicate: true,
      reason:
        "This property announcement was already processed.",
      propertyId,
      recipientCount:
        recipientUserIds.length,
      notificationCreated: 0,
      notificationSampleRowIds:
        notificationRowIds.slice(0, 10),
      push: {
        requested: 0,
        accepted: 0,
        failed: 0,
        tickets: [],
        failures: [],
      },
    };
  }

  const validatedNotification =
    validateNotification({
      title,
      body: message,
      data: notificationData,
    });

  const push = {
    requested: 0,
    accepted: 0,
    failed: 0,
    tickets: [],
    failures: [],
  };

  const pushBatchSize = 1000;

  for (
    let index = 0;
    index < newlyNotifiedUserIds.length;
    index += pushBatchSize
  ) {
    const batch =
      newlyNotifiedUserIds.slice(
        index,
        index + pushBatchSize,
      );

    const batchPush =
      await sendToUsers(
        tables,
        batch,
        validatedNotification,
      );

    push.requested +=
      batchPush.requested;

    push.accepted +=
      batchPush.accepted;

    push.failed +=
      batchPush.failed;

    push.tickets.push(
      ...batchPush.tickets,
    );

    push.failures.push(
      ...batchPush.failures,
    );
  }

  diagnosticLog(
    JSON.stringify({
      event:
        "property-created-notification",
      propertyId,
      landlordAccountId,
      recipientCount:
        recipientUserIds.length,
      newlyNotified:
        newlyNotifiedUserIds.length,
      pushRequested:
        push.requested,
      pushAccepted:
        push.accepted,
      pushFailed:
        push.failed,
    }),
  );

  return {
    skipped: false,
    duplicate: false,
    propertyId,
    recipientCount:
      recipientUserIds.length,
    notificationCreated:
      newlyNotifiedUserIds.length,
    notificationSampleRowIds:
      notificationRowIds.slice(0, 10),
    push,
  };
};

const notifyPropertyLike = async (req, tables, body, diagnosticLog) => {
  const likerAccountId = requireAuthenticatedUser(req);

  const propertiesTableId = requireConfiguredTable(
    PROPERTIES_TABLE_ID,
    "Properties table",
  );

  const likesTableId = requireConfiguredTable(LIKES_TABLE_ID, "Likes table");

  requireConfiguredTable(USERS_TABLE_ID, "Users table");

  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const propertyId = String(body.propertyId ?? "").trim();

  if (!propertyId) {
    throw statusError(400, "propertyId is required.");
  }

  const property = await getRowOrNull(tables, propertiesTableId, propertyId);

  if (!property) {
    throw statusError(404, "The requested property could not be found.");
  }

  const ownerAccountId = String(property.creatorId ?? "").trim();

  if (!ownerAccountId) {
    throw statusError(
      409,
      "The property does not have a valid owner account ID.",
    );
  }

  if (ownerAccountId === likerAccountId) {
    return {
      skipped: true,
      reason: "Property owners are not notified about their own likes.",
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

  const likerUser = await getUserRowByAccountId(tables, likerAccountId);

  const likerName = String(likerUser?.name ?? "Someone").trim() || "Someone";

  const propertyName =
    String(property.propertyName ?? "Property").trim() || "Property";

  const likeCount = Number(property.likes ?? 0);

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
  const message = `${likerName} liked your property "${propertyName}".`;

  const notificationRowId = `like_${String(likeRow.$id)}`.slice(0, 36);

  const inApp = await createInAppNotification(tables, {
    rowId: notificationRowId,
    recipientUserId: ownerAccountId,
    title,
    message,
    type: "like",
    data: notificationData,
  });

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
      reason: "This like notification was already processed.",
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

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getUserRowByReference = async (tables, reference) => {
  const normalized = String(reference ?? "").trim();

  if (!normalized) return null;

  const direct = await getRowOrNull(tables, USERS_TABLE_ID, normalized);

  if (direct) return direct;

  return getUserRowByAccountId(tables, normalized);
};

const sanitizeQuestions = (value) =>
  parseJsonArray(value)
    .map((item) =>
      String(item ?? "")
        .trim()
        .slice(0, 250),
    )
    .filter(Boolean)
    .slice(0, 20);

const notifyPropertyRequest = async (req, tables, body, diagnosticLog) => {
  const tenantAccountId = requireAuthenticatedUser(req);

  const requestsTableId = requireConfiguredTable(
    REQUESTS_TABLE_ID,
    "Requests table",
  );

  const propertiesTableId = requireConfiguredTable(
    PROPERTIES_TABLE_ID,
    "Properties table",
  );

  requireConfiguredTable(USERS_TABLE_ID, "Users table");

  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const requestId = String(body.requestId ?? "").trim();

  const propertyId = String(body.propertyId ?? "").trim();

  if (!requestId) {
    throw statusError(400, "requestId is required.");
  }

  if (!propertyId) {
    throw statusError(400, "propertyId is required.");
  }

  const requestRow = await getRowOrNull(tables, requestsTableId, requestId);

  if (!requestRow) {
    throw statusError(404, "The requested rental request could not be found.");
  }

  const storedTenantId = String(requestRow.tenantId ?? "").trim();

  if (storedTenantId !== tenantAccountId) {
    throw statusError(
      403,
      "The authenticated tenant does not own this rental request.",
    );
  }

  const storedPropertyId = String(requestRow.propertyId ?? "").trim();

  if (storedPropertyId !== propertyId) {
    throw statusError(
      409,
      "The request does not belong to the supplied property.",
    );
  }

  const property = await getRowOrNull(tables, propertiesTableId, propertyId);

  if (!property) {
    throw statusError(404, "The requested property could not be found.");
  }

  const ownerAccountId = String(property.creatorId ?? "").trim();

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

  const tenantUser = await getUserRowByReference(tables, tenantAccountId);

  const tenantName =
    String(requestRow.tenantName ?? tenantUser?.name ?? "A tenant").trim() ||
    "A tenant";

  const propertyName =
    String(
      requestRow.propertyName ?? property.propertyName ?? "Property",
    ).trim() || "Property";

  const proposedPriceRaw = Number(requestRow.proposedPrice);

  const originalPriceRaw = Number(requestRow.originalPrice ?? property.price);

  const proposedPrice = Number.isFinite(proposedPriceRaw)
    ? proposedPriceRaw
    : undefined;

  const originalPrice = Number.isFinite(originalPriceRaw)
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
      requestRow.tenantEmail ?? tenantUser?.email ?? "",
    ).trim(),
    tenantPhone: String(
      requestRow.tenantPhone ?? tenantUser?.phone ?? "",
    ).trim(),
    ...(proposedPrice !== undefined ? { proposedPrice } : {}),
    ...(originalPrice !== undefined ? { originalPrice } : {}),
    message: String(requestRow.message ?? "")
      .trim()
      .slice(0, 1000),
    moveInDate: String(requestRow.moveInDate ?? "").trim(),
    leaseDuration: String(requestRow.leaseDuration ?? "").trim(),
    questions: sanitizeQuestions(requestRow.questions),
    status: String(requestRow.status ?? "pending").trim() || "pending",
    requestedAt: requestRow.$createdAt ?? undefined,
  };

  const priceText =
    proposedPrice !== undefined ? " at $" + proposedPrice + "/month" : "";

  const title = "New Property Request 📋";
  const message =
    tenantName + ' requested "' + propertyName + '"' + priceText + ".";

  const notificationRowId = ("request_" + requestId).slice(0, 36);

  const inApp = await createInAppNotification(tables, {
    rowId: notificationRowId,
    recipientUserId: ownerAccountId,
    title,
    message,
    type: "request",
    data: notificationData,
  });

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
      reason: "This property-request notification was already processed.",
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

const notifyPropertyReview = async (req, tables, body, diagnosticLog) => {
  const reviewerAccountId = requireAuthenticatedUser(req);

  const propertiesTableId = requireConfiguredTable(
    PROPERTIES_TABLE_ID,
    "Properties table",
  );

  requireConfiguredTable(USERS_TABLE_ID, "Users table");

  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const propertyId = String(body.propertyId ?? "").trim();

  const reviewId = String(body.reviewId ?? "").trim();

  if (!propertyId) {
    throw statusError(400, "propertyId is required.");
  }

  if (!reviewId) {
    throw statusError(400, "reviewId is required.");
  }

  const property = await getRowOrNull(tables, propertiesTableId, propertyId);

  if (!property) {
    throw statusError(404, "The requested property could not be found.");
  }

  const ownerAccountId = String(property.creatorId ?? "").trim();

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

  const reviews = parseJsonArray(property.reviews);

  const review = reviews.find(
    (item) => String(item?.id ?? "").trim() === reviewId,
  );

  if (!review) {
    throw statusError(
      409,
      "A matching property review was not found. Save the review before requesting the notification.",
    );
  }

  const storedReviewerId = String(
    review.reviewerId ?? review.userId ?? "",
  ).trim();

  if (!storedReviewerId) {
    throw statusError(
      409,
      "The review does not contain a reviewer account ID.",
    );
  }

  if (storedReviewerId !== reviewerAccountId) {
    throw statusError(403, "The authenticated user does not own this review.");
  }

  const reviewerUser = await getUserRowByReference(tables, reviewerAccountId);

  const reviewerName =
    String(
      review.userName ??
        review.reviewerName ??
        reviewerUser?.name ??
        "A tenant",
    ).trim() || "A tenant";

  const propertyName =
    String(property.propertyName ?? "Property").trim() || "Property";

  const rawRating = Number(review.rating);

  const rating = Number.isFinite(rawRating)
    ? Math.min(5, Math.max(1, rawRating))
    : 1;

  const roundedRating = Math.round(rating);

  const stars = "★".repeat(roundedRating) + "☆".repeat(5 - roundedRating);

  const reviewText = String(
    review.review ?? review.reviewText ?? review.text ?? "",
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
    reviewerEmail: String(reviewerUser?.email ?? "").trim(),
    reviewerPhone: String(reviewerUser?.phone ?? "").trim(),
    rating,
    stars,
    reviewText,
    reviewedAt: review.date ?? review.reviewedAt ?? undefined,
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

  const notificationRowId = ("review_" + reviewId).slice(0, 36);

  const inApp = await createInAppNotification(tables, {
    rowId: notificationRowId,
    recipientUserId: ownerAccountId,
    title,
    message,
    type: "review",
    data: notificationData,
  });

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
      reason: "This property-review notification was already processed.",
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

const notifyLeaseSent = async (req, tables, body, diagnosticLog) => {
  const landlordAccountId = requireAuthenticatedUser(req);

  const requestsTableId = requireConfiguredTable(
    REQUESTS_TABLE_ID,
    "Requests table",
  );

  const propertiesTableId = requireConfiguredTable(
    PROPERTIES_TABLE_ID,
    "Properties table",
  );

  requireConfiguredTable(USERS_TABLE_ID, "Users table");

  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const requestId = String(body.requestId ?? "").trim();

  if (!requestId) {
    throw statusError(400, "requestId is required.");
  }

  const requestRow = await getRowOrNull(tables, requestsTableId, requestId);

  if (!requestRow) {
    throw statusError(404, "The rental request could not be found.");
  }

  const propertyId = String(requestRow.propertyId ?? "").trim();

  const property = await getRowOrNull(tables, propertiesTableId, propertyId);

  if (!property) {
    throw statusError(404, "The requested property could not be found.");
  }

  const ownerAccountId = String(property.creatorId ?? "").trim();

  if (!ownerAccountId || ownerAccountId !== landlordAccountId) {
    throw statusError(
      403,
      "Only the property owner can send this lease document.",
    );
  }

  const status = String(requestRow.status ?? "")
    .trim()
    .toLowerCase();

  if (status !== "accepted") {
    throw statusError(
      409,
      "The rental request must be accepted before a lease can be sent.",
    );
  }

  const tenantAccountId = String(requestRow.tenantId ?? "").trim();

  if (!tenantAccountId) {
    throw statusError(
      409,
      "The request does not contain a valid tenant account ID.",
    );
  }

  const documentId = String(requestRow.leaseDocumentId ?? "").trim();

  const documentName =
    String(requestRow.leaseDocumentName ?? "lease_document.pdf").trim() ||
    "lease_document.pdf";

  const sentAt = String(
    requestRow.leaseSentAt ?? new Date().toISOString(),
  ).trim();

  if (!documentId) {
    throw statusError(
      409,
      "Upload and save the lease document before sending its notification.",
    );
  }

  if (!documentName.toLowerCase().endsWith(".pdf")) {
    throw statusError(409, "The saved lease document must be a PDF.");
  }

  const landlordUser = await getUserRowByReference(tables, landlordAccountId);

  const tenantUser = await getUserRowByReference(tables, tenantAccountId);

  const landlordName =
    String(landlordUser?.name ?? "Landlord").trim() || "Landlord";

  const tenantName =
    String(requestRow.tenantName ?? tenantUser?.name ?? "Tenant").trim() ||
    "Tenant";

  const propertyName =
    String(
      requestRow.propertyName ?? property.propertyName ?? "Property",
    ).trim() || "Property";

  const leaseMessage = String(
    body.leaseMessage ?? "Please review this lease carefully before signing.",
  )
    .trim()
    .slice(0, 500);

  const notificationData = {
    type: "lease",
    screen: "/myRequests",
    requestId,
    propertyId,
    propertyName,
    tenantId: tenantAccountId,
    tenantName,
    landlordId: landlordAccountId,
    landlordName,
    documentId,
    documentName,
    documentSize: 0,
    mimeType: "application/pdf",
    leaseMessage,
    sentAt,
  };

  const title = "Lease Document Ready 📄";

  const message =
    landlordName +
    ' sent "' +
    documentName +
    '" for ' +
    propertyName +
    ". Review it before signing.";

  const notificationRowId = (
    "lease_" +
    requestId.slice(0, 14) +
    "_" +
    documentId.slice(0, 14)
  ).slice(0, 36);

  const inApp = await createInAppNotification(tables, {
    rowId: notificationRowId,
    recipientUserId: tenantAccountId,
    title,
    message,
    type: "lease",
    data: notificationData,
  });

  if (!inApp.created) {
    return {
      skipped: true,
      duplicate: true,
      reason: "This lease notification was already processed.",
      notificationRowId,
      recipientUserId: tenantAccountId,
      requestId,
      propertyId,
      documentId,
      data: notificationData,
    };
  }

  const push = await sendToUser(
    tables,
    tenantAccountId,
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
    recipientUserId: tenantAccountId,
    requestId,
    propertyId,
    documentId,
    data: notificationData,
    push,
  };
};

const issueLeaseAccess = async (req, tables, body) => {
  const tenantAccountId = requireAuthenticatedUser(req);

  const requestsTableId = requireConfiguredTable(
    REQUESTS_TABLE_ID,
    "Requests table",
  );

  const requestId = String(body.requestId ?? "").trim();

  if (!requestId) {
    throw statusError(400, "requestId is required.");
  }

  const requestRow = await getRowOrNull(tables, requestsTableId, requestId);

  if (!requestRow) {
    throw statusError(404, "The rental request could not be found.");
  }

  const requestTenantId = String(requestRow.tenantId ?? "").trim();

  if (requestTenantId !== tenantAccountId) {
    throw statusError(
      403,
      "Only the tenant named on this request can open its lease from Nookly.",
    );
  }

  const documentId = String(requestRow.leaseDocumentId ?? "").trim();

  if (!documentId) {
    throw statusError(404, "No lease document has been sent for this request.");
  }

  const documentName =
    String(requestRow.leaseDocumentName ?? "lease_document.pdf").trim() ||
    "lease_document.pdf";

  const endpoint =
    env("APPWRITE_FUNCTION_API_ENDPOINT") ||
    env("APPWRITE_ENDPOINT") ||
    "https://fra.cloud.appwrite.io/v1";

  const projectId = env("APPWRITE_FUNCTION_PROJECT_ID");

  const baseUrl =
    endpoint.replace(/\/$/, "") +
    "/storage/buckets/" +
    encodeURIComponent(LEASE_BUCKET_ID) +
    "/files/" +
    encodeURIComponent(documentId);

  const query = "?project=" + encodeURIComponent(projectId);

  // The existing storage bucket has public read access and
  // file security disabled, so these URLs do not need tokens.
  return {
    requestId,
    propertyId: String(requestRow.propertyId ?? "").trim(),
    propertyName:
      String(requestRow.propertyName ?? "Property").trim() || "Property",
    documentId,
    documentName,
    documentSize: 0,
    mimeType: "application/pdf",
    expiresAt: "",
    viewUrl: baseUrl + "/view" + query,
    downloadUrl: baseUrl + "/download" + query,
  };
};

const checkReceipts = async (body) => {
  const ids = Array.isArray(body.ids)
    ? body.ids
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
        .slice(0, 1000)
    : [];

  if (ids.length === 0) {
    throw statusError(400, "At least one Expo ticket ID is required.");
  }

  const response = await fetch(EXPO_RECEIPTS_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ ids }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw statusError(
      502,
      payload?.errors?.[0]?.message ||
        `Expo receipt lookup failed with HTTP ${response.status}.`,
    );
  }

  return payload;
};

const timingSafeSecretMatch = (supplied, expected) => {
  const suppliedBuffer = Buffer.from(String(supplied ?? ""));
  const expectedBuffer = Buffer.from(String(expected ?? ""));

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    suppliedBuffer.length > 0 &&
    crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
};

const requireRidesPushSecret = (req) => {
  if (!RIDES_PUSH_SECRET) {
    throw statusError(500, "NOOKLY_RIDES_PUSH_SECRET is not configured.");
  }

  const supplied = getHeader(req, "x-nookly-rides-secret");

  if (!timingSafeSecretMatch(supplied, RIDES_PUSH_SECRET)) {
    throw statusError(403, "The ride notification request is not authorized.");
  }
};

const deterministicRideNotificationId = (
  eventType,
  requestId,
  recipientUserId,
) => {
  const digest = crypto
    .createHash("sha256")
    .update(["driver-ride", eventType, requestId, recipientUserId].join(":"))
    .digest("hex")
    .slice(0, 30);

  return `ride_${digest}`.slice(0, 36);
};

const normalizeRideStatus = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getRideRequestOrThrow = async (tables, requestId) => {
  requireConfiguredTable(RIDE_REQUESTS_TABLE_ID, "Ride requests table");

  const normalizedRequestId = String(requestId ?? "").trim();

  if (!normalizedRequestId) {
    throw statusError(400, "requestId is required.");
  }

  const request = await getRowOrNull(
    tables,
    RIDE_REQUESTS_TABLE_ID,
    normalizedRequestId,
  );

  if (!request) {
    throw statusError(404, "The ride request could not be found.");
  }

  return request;
};

const getRideOfferOrThrow = async (tables, offerId) => {
  requireConfiguredTable(RIDE_OFFERS_TABLE_ID, "Ride offers table");

  const normalizedOfferId = String(offerId ?? "").trim();

  if (!normalizedOfferId) {
    throw statusError(400, "offerId is required.");
  }

  const offer = await getRowOrNull(
    tables,
    RIDE_OFFERS_TABLE_ID,
    normalizedOfferId,
  );

  if (!offer) {
    throw statusError(404, "The ride offer could not be found.");
  }

  return offer;
};

const getDriverAccountId = async (tables, driverId) => {
  const driver = await getRowOrNull(
    tables,
    requireConfiguredTable(RIDE_DRIVERS_TABLE_ID, "Ride drivers table"),
    String(driverId ?? "").trim(),
  );

  const accountId = String(driver?.userId ?? "").trim();

  return {
    driver,
    accountId: accountId || null,
  };
};

const listEligibleDriverAccountIds = async (tables, organizationId) => {
  const normalizedOrganizationId = String(organizationId ?? "").trim();

  if (!normalizedOrganizationId) return [];

  const relationships = await listAllRows(
    tables,
    requireConfiguredTable(
      RIDE_DRIVER_INSTITUTIONS_TABLE_ID,
      "Driver institutions table",
    ),
    [Query.equal("organizationId", normalizedOrganizationId)],
    5000,
  );

  const driverIds = [
    ...new Set(
      relationships
        .filter((relationship) =>
          ACTIVE_DRIVER_RELATIONSHIP_STATUSES.has(
            normalizeRideStatus(relationship.status),
          ),
        )
        .map((relationship) => String(relationship.driverId ?? "").trim())
        .filter(Boolean),
    ),
  ];

  const driverRows = await Promise.all(
    driverIds.map((driverId) =>
      getRowOrNull(tables, RIDE_DRIVERS_TABLE_ID, driverId),
    ),
  );

  return [
    ...new Set(
      driverRows
        .filter(
          (driver) =>
            driver &&
            normalizeRideStatus(driver.status) === "active" &&
            normalizeRideStatus(driver.verificationStatus) === "verified",
        )
        .map((driver) => String(driver.userId ?? "").trim())
        .filter(Boolean),
    ),
  ];
};

const listOfferDriverAccountIds = async (tables, requestId) => {
  const offers = await listAllRows(
    tables,
    requireConfiguredTable(RIDE_OFFERS_TABLE_ID, "Ride offers table"),
    [Query.equal("requestId", String(requestId ?? "").trim())],
    1000,
  );

  const driverIds = [
    ...new Set(
      offers
        .map((offer) => String(offer.driverId ?? "").trim())
        .filter(Boolean),
    ),
  ];

  const recipients = await Promise.all(
    driverIds.map(async (driverId) => {
      const result = await getDriverAccountId(tables, driverId);

      return result.accountId;
    }),
  );

  return [...new Set(recipients.filter(Boolean))];
};

const formatRideMoney = (amount, currency) => {
  const value = Number(amount);
  const safeValue = Number.isFinite(value) ? value : 0;

  return `${
    String(currency || "USD")
      .trim()
      .toUpperCase() || "USD"
  } ${safeValue.toFixed(2)}`;
};

const buildDriverRideNotification = async (tables, eventType, body) => {
  if (!DRIVER_RIDE_EVENT_TYPES.has(eventType)) {
    throw statusError(
      400,
      `Unsupported driver ride event: ${eventType || "missing"}.`,
    );
  }

  const request = await getRideRequestOrThrow(tables, body.requestId);

  const baseData = {
    type: "driver_ride",
    rideEvent: eventType,
    screen: "/driver-rides",
    requestId: request.$id,
    organizationId: request.organizationId,
    studentId: request.studentId,
    studentName:
      String(request.studentName ?? "A passenger").trim() || "A passenger",
    pickupAddress: String(request.pickupAddress ?? "").trim(),
    destinationAddress: String(request.destinationAddress ?? "").trim(),
    requestedDepartureTime: request.requestedDepartureTime,
    passengerCount: Number(request.passengerCount ?? 1),
    ridePreference: request.ridePreference,
    currency: request.currency || "USD",
  };

  if (eventType === "request_created") {
    if (!["pending", "quoted"].includes(normalizeRideStatus(request.status))) {
      throw statusError(
        409,
        `The ride request is ${request.status} and is not open.`,
      );
    }

    const recipients = await listEligibleDriverAccountIds(
      tables,
      request.organizationId,
    );

    const rideType =
      request.ridePreference === "requested_shared" ? "shared" : "private";

    return {
      recipients,
      title: "New Ride Request 🚗",
      message:
        `${baseData.studentName} needs a ${rideType} ride from ` +
        `${baseData.pickupAddress} to ${baseData.destinationAddress}.`,
      data: {
        ...baseData,
        section: "requests",
        proposedBudget: Number.isFinite(Number(request.proposedBudget))
          ? Number(request.proposedBudget)
          : undefined,
      },
    };
  }

  if (eventType === "request_cancelled") {
    if (normalizeRideStatus(request.status) !== "cancelled") {
      throw statusError(409, "The ride request has not been cancelled.");
    }

    const recipients = await listOfferDriverAccountIds(tables, request.$id);

    return {
      recipients,
      title: "Ride Request Cancelled",
      message:
        `${baseData.studentName} cancelled the ride request from ` +
        `${baseData.pickupAddress}.`,
      data: {
        ...baseData,
        section: "offers",
      },
    };
  }

  const offer = await getRideOfferOrThrow(tables, body.offerId);

  if (String(offer.requestId ?? "") !== String(request.$id)) {
    throw statusError(
      409,
      "The accepted offer does not belong to this ride request.",
    );
  }

  if (
    normalizeRideStatus(request.status) !== "confirmed" ||
    normalizeRideStatus(offer.status) !== "accepted" ||
    String(request.selectedOfferId ?? "") !== String(offer.$id)
  ) {
    throw statusError(409, "The ride offer is not confirmed as accepted.");
  }

  const { accountId: driverAccountId } = await getDriverAccountId(
    tables,
    offer.driverId,
  );

  if (!driverAccountId) {
    throw statusError(
      409,
      "The accepted driver does not have a linked account.",
    );
  }

  const rideId = String(body.rideId ?? "").trim();

  if (rideId) {
    const ride = await getRowOrNull(
      tables,
      requireConfiguredTable(RIDES_TABLE_ID, "Rides table"),
      rideId,
    );

    if (!ride || String(ride.driverId ?? "") !== String(offer.driverId ?? "")) {
      throw statusError(
        409,
        "The confirmed ride does not belong to the accepted driver.",
      );
    }
  }

  return {
    recipients: [driverAccountId],
    title: "Your Ride Offer Was Accepted ✅",
    message:
      `${baseData.studentName} accepted your ` +
      `${formatRideMoney(
        offer.quotedFare,
        offer.currency,
      )} offer. Open Confirmed trips for details.`,
    data: {
      ...baseData,
      section: "confirmed",
      offerId: offer.$id,
      rideId: rideId || undefined,
      quotedFare: Number(offer.quotedFare ?? 0),
      estimatedPickupMinutes: Number(offer.estimatedPickupMinutes ?? 0),
      estimatedJourneyMinutes: Number(offer.estimatedJourneyMinutes ?? 0),
    },
  };
};

const notifyDriverRideEvent = async (req, tables, body, diagnosticLog) => {
  requireRidesPushSecret(req);

  requireConfiguredTable(NOTIFICATIONS_TABLE_ID, "Notifications table");

  const eventType = normalizeRideStatus(body.eventType);

  const notification = await buildDriverRideNotification(
    tables,
    eventType,
    body,
  );

  const recipients = [
    ...new Set(
      notification.recipients
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ];

  if (recipients.length === 0) {
    return {
      skipped: true,
      eventType,
      recipientCount: 0,
      notificationCreated: 0,
      reason: "No eligible driver accounts were found for this ride event.",
    };
  }

  const newRecipients = [];
  const notificationRowIds = [];

  for (const recipientUserId of recipients) {
    const notificationRowId = deterministicRideNotificationId(
      eventType,
      body.requestId,
      recipientUserId,
    );

    const inApp = await createInAppNotification(tables, {
      rowId: notificationRowId,
      recipientUserId,
      title: notification.title,
      message: notification.message,
      type: "driver_ride",
      data: notification.data,
    });

    notificationRowIds.push(notificationRowId);

    if (inApp.created) {
      newRecipients.push(recipientUserId);
    }
  }

  if (newRecipients.length === 0) {
    return {
      skipped: true,
      duplicate: true,
      eventType,
      recipientCount: recipients.length,
      notificationCreated: 0,
      notificationRowIds,
      reason: "This driver ride notification was already processed.",
    };
  }

  const push = await sendToUsers(
    tables,
    newRecipients,
    validateNotification({
      title: notification.title,
      body: notification.message,
      data: notification.data,
    }),
  );

  diagnosticLog(
    JSON.stringify({
      event: "driver-ride-notification",
      eventType,
      requestId: body.requestId,
      recipientCount: recipients.length,
      newlyNotified: newRecipients.length,
      pushRequested: push.requested,
      pushAccepted: push.accepted,
      pushFailed: push.failed,
      recipientUserIds: newRecipients,
      ticketDiagnostics: push.tickets.map((ticket) => ({
        tokenRowId: ticket.tokenRowId ?? null,
        ticketId: ticket.id ?? null,
        status: ticket.status ?? null,
        error: ticket.details?.error ?? null,
        message: ticket.message ?? null,
      })),
    }),
  );

  return {
    skipped: false,
    duplicate: false,
    eventType,
    recipientCount: recipients.length,
    notificationCreated: newRecipients.length,
    notificationRowIds,
    push,
  };
};

const resolveTestRecipient = (req, body, diagnosticLog) => {
  const authenticatedUserId = getHeader(req, "x-appwrite-user-id");

  const suppliedSecret =
    getHeader(req, "x-nookly-test-secret") ||
    String(body.consoleTestSecret ?? "").trim();

  const requestedRecipient = String(body.recipientUserId ?? "").trim();

  const hasValidConsoleSecret =
    Boolean(CONSOLE_TEST_SECRET) && suppliedSecret === CONSOLE_TEST_SECRET;

  if (hasValidConsoleSecret) {
    if (!requestedRecipient) {
      throw statusError(
        400,
        "recipientUserId is required for a Console test execution.",
      );
    }

    diagnosticLog(
      JSON.stringify({
        event: "test-recipient-resolution",
        mode: "console-secret",
        authenticatedUserId: authenticatedUserId || null,
        recipientUserId: requestedRecipient,
      }),
    );

    return requestedRecipient;
  }

  if (authenticatedUserId) {
    diagnosticLog(
      JSON.stringify({
        event: "test-recipient-resolution",
        mode: "authenticated-user",
        authenticatedUserId,
        recipientUserId: authenticatedUserId,
      }),
    );

    return authenticatedUserId;
  }

  throw statusError(401, "Authentication is required for this route.");
};

export default async ({ req, res, log, error }) => {
  const method = String(req.method ?? "GET").toUpperCase();

  const path = normalizePath(req);

  try {
    if (method === "GET" && path === "/health") {
      return ok(res, {
        service: "nookly-push-api",
        version: "1.5.0",
        status: "healthy",
        functionId: "6a31d988001bf962fb57",
        configuration: {
          database: Boolean(DATABASE_ID),
          pushTokens: Boolean(PUSH_TOKENS_TABLE_ID),
          users: Boolean(USERS_TABLE_ID),
          notifications: Boolean(NOTIFICATIONS_TABLE_ID),
          organizations: Boolean(ORGANIZATIONS_TABLE_ID),
          properties: Boolean(PROPERTIES_TABLE_ID),
          likes: Boolean(LIKES_TABLE_ID),
          requests: Boolean(REQUESTS_TABLE_ID),
          rideDrivers: Boolean(RIDE_DRIVERS_TABLE_ID),
          rideDriverInstitutions: Boolean(RIDE_DRIVER_INSTITUTIONS_TABLE_ID),
          rideRequests: Boolean(RIDE_REQUESTS_TABLE_ID),
          rideOffers: Boolean(RIDE_OFFERS_TABLE_ID),
          rides: Boolean(RIDES_TABLE_ID),
          ridesPushSecret: Boolean(RIDES_PUSH_SECRET),
          consoleTestSecret: Boolean(CONSOLE_TEST_SECRET),
        },
        time: new Date().toISOString(),
      });
    }

    if (!DATABASE_ID || !PUSH_TOKENS_TABLE_ID) {
      return fail(
        res,
        500,
        "The push service database configuration is incomplete.",
      );
    }

    const tables = createTables(req);
    const body = parseBody(req);

    if (method === "POST" && path === "/register-device") {
      return ok(res, await registerDevice(req, tables, body), 201);
    }

    if (method === "POST" && path === "/deactivate-device") {
      return ok(res, await deactivateDevice(req, tables, body));
    }

    if (method === "POST" && path === "/test") {
      const recipientUserId = resolveTestRecipient(req, body, log);

      const notification = validateNotification({
        title: body.title || "Nookly Push Test",
        body: body.body || "The secure Nookly Push API is working.",
        data: body.data || {
          type: "alert",
          source: "nookly-push-api",
        },
      });

      return ok(
        res,
        await sendToUser(tables, recipientUserId, notification, log),
      );
    }

    if (method === "POST" && path === "/student-sos") {
      return ok(
        res,
        await submitStudentSos(
          req,
          tables,
          body,
          log,
        ),
        201,
      );
    }

    if (method === "POST" && path === "/rides/event") {
      return ok(res, await notifyDriverRideEvent(req, tables, body, log));
    }

    if (method === "POST" && path === "/property-created") {
      return ok(
        res,
        await notifyPropertyCreated(
          req,
          tables,
          body,
          log,
        ),
      );
    }
    if (method === "POST" && path === "/property-request") {
      return ok(res, await notifyPropertyRequest(req, tables, body, log));
    }

    if (method === "POST" && path === "/property-review") {
      return ok(res, await notifyPropertyReview(req, tables, body, log));
    }

    if (method === "POST" && path === "/lease-sent") {
      return ok(res, await notifyLeaseSent(req, tables, body, log));
    }

    if (method === "POST" && path === "/lease-access") {
      return ok(res, await issueLeaseAccess(req, tables, body));
    }

    if (method === "POST" && path === "/property-like") {
      return ok(res, await notifyPropertyLike(req, tables, body, log));
    }

    if (method === "POST" && path === "/send-to-user") {
      await requirePrivilegedUser(req, tables);

      const notification = validateNotification(body);

      return ok(
        res,
        await sendToUser(tables, body.recipientUserId, notification),
      );
    }

    if (method === "POST" && path === "/send-to-users") {
      await requirePrivilegedUser(req, tables);

      const notification = validateNotification(body);

      return ok(
        res,
        await sendToUsers(tables, body.recipientUserIds, notification),
      );
    }

    if (method === "POST" && path === "/send-to-role") {
      await requirePrivilegedUser(req, tables);

      const notification = validateNotification(body);

      return ok(res, await sendToRole(tables, body.role, notification));
    }

    if (method === "POST" && path === "/receipts/check") {
      await requirePrivilegedUser(req, tables);

      return ok(res, await checkReceipts(body));
    }

    return fail(res, 404, `Route not found: ${method} ${path}`);
  } catch (caught) {
    const status = Number(caught?.statusCode ?? caught?.code ?? 500);

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

    return fail(res, status >= 400 && status <= 599 ? status : 500, message);
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
