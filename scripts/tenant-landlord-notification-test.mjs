import fs from "node:fs";
import path from "node:path";
import { ID, Query } from "node-appwrite";

const EXPECTED_BEEF_ACCOUNT_ID =
  "6a6e3ba6000fb26e3dbc";

const DEFAULT_BEEF_EMAIL =
  "beefspook22@gmail.com";

const DEFAULT_PROPERTY_ID =
  "69c50097001babcc3e7c";

const root = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(
    filePath,
    "utf8",
  );

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#") ||
      !line.includes("=")
    ) {
      continue;
    }

    const separatorIndex =
      line.indexOf("=");

    const key = line
      .slice(0, separatorIndex)
      .trim();

    let value = line
      .slice(separatorIndex + 1)
      .trim();

    if (
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (
      key &&
      process.env[key] === undefined
    ) {
      process.env[key] = value;
    }
  }
}

for (const envName of [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
]) {
  loadEnvFile(path.join(root, envName));
}

function required(name, fallback = "") {
  const value = String(
    process.env[name] ?? fallback,
  ).trim();

  if (!value) {
    throw new Error(
      `Missing ${name}. Add it to your .env file.`,
    );
  }

  return value;
}

const endpoint = required(
  "EXPO_PUBLIC_APPWRITE_ENDPOINT",
).replace(/\/$/, "");

const projectId = required(
  "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
  "69904bec001b4d14cce2",
);

const databaseId = required(
  "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
  "6990ba1f00247b886338",
);

const usersCollectionId = required(
  "EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID",
  "69a205ed001b60197a88",
);

const propertiesCollectionId = required(
  "EXPO_PUBLIC_APPWRITE_PROPERTIES_COLLECTION_ID",
  "6990bd72002b31eeafed",
);

const requestsCollectionId = required(
  "EXPO_PUBLIC_APPWRITE_REQUESTS_COLLECTION",
  "69c3a9f30004facf9a4d",
);

const functionId = required(
  "EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID",
  "6a31d988001bf962fb57",
);

const email = String(
  process.env.NOOKIE_TEST_EMAIL ??
    DEFAULT_BEEF_EMAIL,
).trim();

const password = String(
  process.env.NOOKIE_TEST_PASSWORD ?? "",
);

const propertyId = String(
  process.env.NOOKIE_TEST_PROPERTY_ID ??
    DEFAULT_PROPERTY_ID,
).trim();

if (!password) {
  throw new Error(
    "Beef Spook's password was not provided.",
  );
}

let sessionSecret = "";
let sessionCreated = false;

function appwriteHeaders({
  authenticated = true,
  json = false,
} = {}) {
  const headers = {
    "X-Appwrite-Project": projectId,
    "X-Appwrite-Response-Format": "1.9.5",
  };

  if (authenticated && sessionSecret) {
    headers["X-Appwrite-Session"] =
      sessionSecret;
  }

  if (json) {
    headers["Content-Type"] =
      "application/json";
  }

  return headers;
}

async function readJsonResponse(
  response,
  label,
) {
  const text = await response.text();
  let payload = {};

  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        `${label} returned invalid JSON ` +
          `(HTTP ${response.status}): ` +
          text.slice(0, 300),
      );
    }
  }

  if (!response.ok) {
    throw new Error(
      payload?.message ||
        `${label} failed with HTTP ${response.status}.`,
    );
  }

  return payload;
}

function getSetCookieHeaders(headers) {
  if (
    typeof headers.getSetCookie === "function"
  ) {
    return headers.getSetCookie();
  }

  const combined = headers.get("set-cookie");
  return combined ? [combined] : [];
}

function extractSessionSecret(
  setCookieHeaders,
) {
  const expectedName =
    `a_session_${projectId}`;
  const fallbackName =
    `a_session_${projectId}_legacy`;

  for (const cookieHeader of setCookieHeaders) {
    const firstPart =
      String(cookieHeader).split(";")[0];

    const separatorIndex =
      firstPart.indexOf("=");

    if (separatorIndex < 1) continue;

    const name = firstPart
      .slice(0, separatorIndex)
      .trim();

    const value = firstPart
      .slice(separatorIndex + 1)
      .trim();

    if (
      (
        name === expectedName ||
        name === fallbackName
      ) &&
      value
    ) {
      return decodeURIComponent(value);
    }
  }

  return "";
}

async function login() {
  const response = await fetch(
    `${endpoint}/account/sessions/email`,
    {
      method: "POST",
      headers: appwriteHeaders({
        authenticated: false,
        json: true,
      }),
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  const payload = await readJsonResponse(
    response,
    "Email/password login",
  );

  sessionCreated = true;

  sessionSecret =
    extractSessionSecret(
      getSetCookieHeaders(response.headers),
    ) ||
    String(payload?.secret ?? "").trim();

  if (!sessionSecret) {
    throw new Error(
      "Login succeeded but the Appwrite session cookie " +
        "was not exposed to Node. Use Node 20 or newer.",
    );
  }
}

async function apiRequest(
  relativePath,
  options = {},
) {
  const response = await fetch(
    `${endpoint}${relativePath}`,
    {
      ...options,
      headers: {
        ...appwriteHeaders({
          authenticated: true,
          json: Boolean(options.body),
        }),
        ...(options.headers || {}),
      },
    },
  );

  return readJsonResponse(
    response,
    `${options.method || "GET"} ${relativePath}`,
  );
}

async function listRows(
  collectionId,
  queries,
) {
  const params = new URLSearchParams();

  for (const query of queries) {
    params.append("queries[]", query);
  }

  return apiRequest(
    `/databases/${encodeURIComponent(databaseId)}` +
      `/collections/${encodeURIComponent(collectionId)}` +
      `/documents?${params.toString()}`,
  );
}

async function getDocument(
  collectionId,
  documentId,
) {
  return apiRequest(
    `/databases/${encodeURIComponent(databaseId)}` +
      `/collections/${encodeURIComponent(collectionId)}` +
      `/documents/${encodeURIComponent(documentId)}`,
  );
}

async function createDocument(
  collectionId,
  data,
) {
  return apiRequest(
    `/databases/${encodeURIComponent(databaseId)}` +
      `/collections/${encodeURIComponent(collectionId)}` +
      "/documents",
    {
      method: "POST",
      body: JSON.stringify({
        documentId: ID.unique(),
        data,
      }),
    },
  );
}

async function updateDocument(
  collectionId,
  documentId,
  data,
) {
  return apiRequest(
    `/databases/${encodeURIComponent(databaseId)}` +
      `/collections/${encodeURIComponent(collectionId)}` +
      `/documents/${encodeURIComponent(documentId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ data }),
    },
  );
}

async function invokeRoute(
  route,
  body,
) {
  const execution = await apiRequest(
    `/functions/${encodeURIComponent(functionId)}/executions`,
    {
      method: "POST",
      body: JSON.stringify({
        body: JSON.stringify(body),
        async: false,
        path: route,
        method: "POST",
        headers: {
          "content-type":
            "application/json",
        },
      }),
    },
  );

  const status = Number(
    execution.responseStatusCode ?? 0,
  );

  const raw = String(
    execution.responseBody ?? "",
  ).trim();

  if (!raw) {
    throw new Error(
      `${route} returned an empty Function response.`,
    );
  }

  let response;

  try {
    response = JSON.parse(raw);
  } catch {
    throw new Error(
      `${route} returned invalid JSON: ` +
        raw.slice(0, 300),
    );
  }

  if (
    status < 200 ||
    status >= 300 ||
    !response?.ok
  ) {
    if (
      status === 404 &&
      String(response?.error ?? "")
        .includes("Route not found")
    ) {
      throw new Error(
        `${route} is not deployed yet. Upload the v1.3 Function ZIP first.`,
      );
    }

    throw new Error(
      response?.error ||
        `${route} failed with HTTP ${status || "unknown"}.`,
    );
  }

  return response.data ?? {};
}

async function closeSession() {
  if (!sessionSecret) return;

  const response = await fetch(
    `${endpoint}/account/sessions/current`,
    {
      method: "DELETE",
      headers: appwriteHeaders({
        authenticated: true,
      }),
    },
  );

  if (
    !response.ok &&
    response.status !== 401
  ) {
    const text = await response.text();
    throw new Error(
      `Session cleanup failed with HTTP ` +
        `${response.status}: ` +
        text.slice(0, 200),
    );
  }
}

function parseReviews(value) {
  if (Array.isArray(value)) return value;

  if (typeof value !== "string") return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function printPushResult(label, result) {
  console.log("");
  console.log(label);
  console.log("-".repeat(label.length));
  console.log(
    `Skipped: ${Boolean(result.skipped)}`,
  );
  console.log(
    `Duplicate: ${Boolean(result.duplicate)}`,
  );
  console.log(
    `Recipient: ${
      result.recipientUserId ||
      "unknown"
    }`,
  );
  console.log(
    `Notification row: ${
      result.notificationRowId ||
      "none"
    }`,
  );
  console.log(
    `Push requested: ${
      result.push?.requested ?? 0
    }`,
  );
  console.log(
    `Push accepted: ${
      result.push?.accepted ?? 0
    }`,
  );
  console.log(
    `Push failed: ${
      result.push?.failed ?? 0
    }`,
  );

  if (result.reason) {
    console.log(
      `Reason: ${result.reason}`,
    );
  }

  if (result.data) {
    console.log("");
    console.log("Structured notification data:");
    console.log(
      JSON.stringify(
        result.data,
        null,
        2,
      ),
    );
  }
}

async function main() {
  console.log("");
  console.log(
    "Nookly tenant → landlord notification test",
  );
  console.log(
    "------------------------------------------",
  );

  console.log("");
  console.log(
    "1. Signing in as Beef Spook...",
  );

  await login();

  const currentAccount =
    await apiRequest("/account");

  console.log(
    `   Signed in: ${
      currentAccount.name || email
    }`,
  );
  console.log(
    `   Account ID: ${currentAccount.$id}`,
  );

  if (
    currentAccount.$id !==
    EXPECTED_BEEF_ACCOUNT_ID
  ) {
    throw new Error(
      "Safety check failed. This login is not " +
        `Beef Spook (${EXPECTED_BEEF_ACCOUNT_ID}).`,
    );
  }

  const userRows = await listRows(
    usersCollectionId,
    [
      Query.equal(
        "accountId",
        currentAccount.$id,
      ),
      Query.limit(1),
    ],
  );

  const tenantUser =
    userRows.documents?.[0];

  if (!tenantUser) {
    throw new Error(
      "Beef's users row could not be found.",
    );
  }

  console.log("");
  console.log(
    "2. Loading Yellow House...",
  );

  const property = await getDocument(
    propertiesCollectionId,
    propertyId,
  );

  console.log(
    `   Property: ${
      property.propertyName ||
      property.$id
    }`,
  );
  console.log(
    `   Owner accountId: ${
      property.creatorId ||
      "missing"
    }`,
  );

  if (
    String(property.creatorId ?? "") ===
    currentAccount.$id
  ) {
    throw new Error(
      "Beef owns this property. Use a Lucan property.",
    );
  }

  console.log("");
  console.log(
    "3. Creating a genuine property request...",
  );

  const moveInDate = new Date(
    Date.now() +
      30 * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);

  const proposedPrice = 95;

  const request = await createDocument(
    requestsCollectionId,
    {
      propertyId,
      propertyName:
        property.propertyName ||
        "Yellow House",
      tenantId: currentAccount.$id,
      tenantName:
        tenantUser.name ||
        currentAccount.name ||
        "Beef Spook",
      tenantEmail:
        tenantUser.email ||
        currentAccount.email ||
        email,
      tenantPhone:
        tenantUser.phone || "",
      tenantAvatar:
        tenantUser.customAvatar ||
        tenantUser.avatar ||
        "",
      status: "pending",
      proposedPrice,
      originalPrice:
        Number(property.price ?? 0),
      message:
        "I am interested in this property. This is a production notification test.",
      moveInDate,
      leaseDuration: "12 months",
      questions: JSON.stringify([
        "Is Wi-Fi included in the monthly rent?",
        "Can I arrange a property viewing?",
      ]),
    },
  );

  console.log(
    `   Request row: ${request.$id}`,
  );

  const requestResult =
    await invokeRoute(
      "/property-request",
      {
        requestId: request.$id,
        propertyId,
      },
    );

  printPushResult(
    "PROPERTY REQUEST RESULT",
    requestResult,
  );

  console.log("");
  console.log(
    "4. Creating a structured property review...",
  );

  const latestProperty = await getDocument(
    propertiesCollectionId,
    propertyId,
  );

  const currentReviews = parseReviews(
    latestProperty.reviews,
  );

  const reviewId =
    Date.now().toString();

  const review = {
    id: reviewId,
    propertyId,
    reviewerId:
      currentAccount.$id,
    userName:
      tenantUser.name ||
      currentAccount.name ||
      "Beef Spook",
    userAvatar:
      tenantUser.customAvatar ||
      tenantUser.avatar ||
      "",
    review:
      "The listing is clear, detailed, and easy to understand. This is a production review notification test.",
    rating: 4,
    date: new Date().toISOString(),
  };

  await updateDocument(
    propertiesCollectionId,
    propertyId,
    {
      reviews: JSON.stringify([
        ...currentReviews,
        review,
      ]),
    },
  );

  console.log(
    `   Review ID: ${reviewId}`,
  );
  console.log(
    `   Stars: ★★★★☆`,
  );
  console.log(
    `   Text: ${review.review}`,
  );

  const reviewResult =
    await invokeRoute(
      "/property-review",
      {
        propertyId,
        reviewId,
      },
    );

  printPushResult(
    "PROPERTY REVIEW RESULT",
    reviewResult,
  );

  console.log("");
  console.log(
    "Both events were created. Check Lucan's phone and landlord Notifications screen.",
  );
}

try {
  await main();
} catch (error) {
  console.error("");
  console.error(
    "TENANT → LANDLORD TEST FAILED",
  );
  console.error(
    "-----------------------------",
  );
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
} finally {
  if (
    sessionCreated &&
    sessionSecret
  ) {
    try {
      await closeSession();
      console.log("");
      console.log(
        "Temporary Beef terminal session closed.",
      );
    } catch (cleanupError) {
      console.warn("");
      console.warn(
        cleanupError instanceof Error
          ? cleanupError.message
          : String(cleanupError),
      );
    }
  }

  sessionSecret = "";
  delete process.env.NOOKIE_TEST_PASSWORD;
}
