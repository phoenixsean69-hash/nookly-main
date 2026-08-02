import fs from "node:fs";
import path from "node:path";
import {
  Account,
  Client,
  Databases,
  ExecutionMethod,
  Functions,
  ID,
  Query,
} from "node-appwrite";

const EXPECTED_BEEF_ACCOUNT_ID =
  "6a6e3ba6000fb26e3dbc";

const DEFAULT_BEEF_EMAIL =
  "beefspook22@gmail.com";

const DEFAULT_PROPERTY_ID =
  "69c50097001babcc3e7c";

const root = process.cwd();

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith("#") ||
      !line.includes("=")
    ) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
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
);

const projectId = required(
  "EXPO_PUBLIC_APPWRITE_PROJECT_ID",
  "69904bec001b4d14cce2",
);

const databaseId = required(
  "EXPO_PUBLIC_APPWRITE_DATABASE_ID",
  "6990ba1f00247b886338",
);

const likesCollectionId = required(
  "EXPO_PUBLIC_APPWRITE_LIKES_COLLECTION",
  "69a8973100253581f887",
);

const propertiesCollectionId = required(
  "EXPO_PUBLIC_APPWRITE_PROPERTIES_COLLECTION_ID",
  "6990bd72002b31eeafed",
);

const functionId = required(
  "EXPO_PUBLIC_APPWRITE_PUSH_FUNCTION_ID",
  "6a31d988001bf962fb57",
);

const email = String(
  process.env.NOOKLY_TEST_EMAIL ??
    DEFAULT_BEEF_EMAIL,
).trim();

const password = String(
  process.env.NOOKLY_TEST_PASSWORD ?? "",
);

const propertyId = String(
  process.env.NOOKLY_TEST_PROPERTY_ID ??
    DEFAULT_PROPERTY_ID,
).trim();

if (!password) {
  throw new Error(
    "Beef Spook's password was not provided.",
  );
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId);

const account = new Account(client);
const databases = new Databases(client);
const functions = new Functions(client);

let sessionCreated = false;

function parseFunctionResponse(execution) {
  const raw = String(
    execution.responseBody ?? "",
  ).trim();

  if (!raw) {
    return {
      ok: false,
      error:
        "The Push Function returned an empty body.",
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error:
        `Invalid Push Function JSON: ${raw.slice(0, 300)}`,
    };
  }
}

async function main() {
  console.log("");
  console.log(
    "Nookly Beef Spook terminal Like test v2",
  );
  console.log(
    "-------------------------------------",
  );

  console.log("");
  console.log("Target:");
  console.log(`- Beef email: ${email}`);
  console.log(
    `- Expected Beef accountId: ${EXPECTED_BEEF_ACCOUNT_ID}`,
  );
  console.log(
    `- Property ID: ${propertyId}`,
  );

  console.log("");
  console.log(
    "1. Signing in as Beef Spook...",
  );

  const session =
    await account.createEmailPasswordSession({
      email,
      password,
    });

  sessionCreated = true;

  if (!session.secret) {
    throw new Error(
      "Appwrite created a session but did not return " +
        "a server-side session secret.",
    );
  }

  client.setSession(session.secret);

  const currentAccount = await account.get();

  console.log(
    `   Signed in: ${currentAccount.name || email}`,
  );
  console.log(
    `   Account ID: ${currentAccount.$id}`,
  );

  if (
    currentAccount.$id !==
    EXPECTED_BEEF_ACCOUNT_ID
  ) {
    throw new Error(
      "Safety check failed. The supplied login is not " +
        `Beef Spook (${EXPECTED_BEEF_ACCOUNT_ID}).`,
    );
  }

  console.log("");
  console.log(
    "2. Loading Yellow House...",
  );

  const property =
    await databases.getDocument({
      databaseId,
      collectionId:
        propertiesCollectionId,
      documentId: propertyId,
    });

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
    String(property.creatorId ?? "").trim() ===
    currentAccount.$id
  ) {
    throw new Error(
      "Beef owns this property. Self-like " +
        "notifications are intentionally skipped.",
    );
  }

  console.log("");
  console.log(
    "3. Checking for an existing Beef Like...",
  );

  const existingLikes =
    await databases.listDocuments({
      databaseId,
      collectionId:
        likesCollectionId,
      queries: [
        Query.equal(
          "propertyId",
          propertyId,
        ),
        Query.equal(
          "userId",
          currentAccount.$id,
        ),
        Query.limit(5),
      ],
    });

  if (existingLikes.documents.length > 0) {
    throw new Error(
      "Beef already likes this property. " +
        "Use another Lucan property that Beef " +
        "has never liked.",
    );
  }

  console.log(
    "   No existing Like found.",
  );

  console.log("");
  console.log(
    "4. Creating the genuine Like row...",
  );

  const likeDocument =
    await databases.createDocument({
      databaseId,
      collectionId:
        likesCollectionId,
      documentId: ID.unique(),
      data: {
        propertyId,
        userId: currentAccount.$id,
      },
    });

  console.log(
    `   Like row: ${likeDocument.$id}`,
  );

  const rawLikeCount = Number(
    property.likes ?? 0,
  );

  const previousLikeCount =
    Number.isFinite(rawLikeCount)
      ? rawLikeCount
      : 0;

  const nextLikeCount =
    previousLikeCount + 1;

  console.log("");
  console.log(
    "5. Incrementing properties.likes...",
  );

  await databases.updateDocument({
    databaseId,
    collectionId:
      propertiesCollectionId,
    documentId: propertyId,
    data: {
      likes: nextLikeCount,
    },
  });

  console.log(
    `   Likes: ${previousLikeCount} -> ${nextLikeCount}`,
  );

  console.log("");
  console.log(
    "6. Calling secure /property-like...",
  );

  const execution =
    await functions.createExecution({
      functionId,
      body: JSON.stringify({
        propertyId,
      }),
      async: false,
      xpath: "/property-like",
      method: ExecutionMethod.POST,
      headers: {
        "content-type":
          "application/json",
      },
    });

  const response =
    parseFunctionResponse(execution);

  console.log(
    `   Function HTTP: ${
      execution.responseStatusCode ??
      "unknown"
    }`,
  );

  if (!response.ok) {
    throw new Error(
      response.error ||
        "The property-like Function failed.",
    );
  }

  const result = response.data ?? {};

  console.log("");
  console.log(
    "PROPERTY-LIKE RESULT",
  );
  console.log(
    "--------------------",
  );
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

  if (result.skipped) {
    console.log(
      `Reason: ${
        result.reason ||
        "not provided"
      }`,
    );
  }

  console.log("");
  console.log(
    "Now check Lucan's phone.",
  );
}

try {
  await main();
} catch (error) {
  console.error("");
  console.error(
    "TERMINAL TEST FAILED",
  );
  console.error(
    "--------------------",
  );
  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );
  process.exitCode = 1;
} finally {
  if (sessionCreated) {
    try {
      await account.deleteSession({
        sessionId: "current",
      });

      console.log("");
      console.log(
        "Temporary Beef terminal session closed.",
      );
    } catch {
      console.warn("");
      console.warn(
        "The temporary terminal session could not " +
          "be closed automatically.",
      );
    }
  }

  delete process.env.NOOKLY_TEST_PASSWORD;
}
