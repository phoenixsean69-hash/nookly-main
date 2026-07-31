#!/usr/bin/env node

import {
  Client,
  Databases,
  Query,
  TablesDB,
  Users,
} from "node-appwrite";

const required = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const optional = (name, fallback = "") =>
  process.env[name]?.trim() || fallback;

const ENDPOINT = required("EXPO_PUBLIC_APPWRITE_ENDPOINT");
const PROJECT_ID = required("EXPO_PUBLIC_APPWRITE_PROJECT_ID");
const DATABASE_ID = required("EXPO_PUBLIC_APPWRITE_DATABASE_ID");
const USERS_COLLECTION_ID = required(
  "EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID",
);
const DRIVER_TABLE_ID = optional(
  "EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID",
  "ride_drivers",
);
const API_KEY = required("APPWRITE_API_KEY");

const TARGET_EMAIL = optional(
  "TARGET_DRIVER_EMAIL",
  "jsjzjjz@gmail.com",
).toLowerCase();

const DRIVER_PROFILE_ID = optional(
  "TARGET_DRIVER_PROFILE_ID",
  "6a6a6808000d95107895",
);

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const users = new Users(client);
const databases = new Databases(client);
const tablesDB = new TablesDB(client);

async function findAuthUser() {
  const result = await users.list({
    queries: [
      Query.equal("email", TARGET_EMAIL),
      Query.limit(1),
    ],
  });

  return result.users[0] ?? null;
}

async function findUserDocument(accountId) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: USERS_COLLECTION_ID,
    queries: [
      Query.equal("accountId", accountId),
      Query.limit(1),
    ],
  });

  return result.documents[0] ?? null;
}

function isValidHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;

  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function main() {
  console.log("\nLinking new Nookly driver account...\n");

  const authUser = await findAuthUser();

  if (!authUser) {
    throw new Error(
      `No Appwrite Auth account exists for ${TARGET_EMAIL}.`,
    );
  }

  console.log(`✓ Auth account found: ${authUser.$id}`);

  const userDocument = await findUserDocument(authUser.$id);

  if (!userDocument) {
    throw new Error(
      "The Auth account exists, but no matching users document was found.",
    );
  }

  console.log(`✓ Users document found: ${userDocument.$id}`);

  if (String(userDocument.userMode || "").toLowerCase() !== "driver") {
    await databases.updateDocument({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION_ID,
      documentId: userDocument.$id,
      data: {
        userMode: "driver",
      },
    });

    console.log("✓ Users document changed to driver mode");
  }

  const driverProfile = await tablesDB.getRow({
    databaseId: DATABASE_ID,
    tableId: DRIVER_TABLE_ID,
    rowId: DRIVER_PROFILE_ID,
  });

  if (!driverProfile) {
    throw new Error(
      `Driver profile ${DRIVER_PROFILE_ID} was not found.`,
    );
  }

  const now = new Date().toISOString();
  const updateData = {
    userId: authUser.$id,
    email: TARGET_EMAIL,
    name:
      String(userDocument.name || "").trim() ||
      String(authUser.name || "").trim() ||
      String(driverProfile.name || "").trim(),
    phone:
      String(userDocument.phone || "").trim() ||
      String(driverProfile.phone || "").trim(),
    status: "active",
    verificationStatus: "verified",
    updatedAt: now,
    lastSeenAt: now,
  };

  if (isValidHttpUrl(userDocument.avatar)) {
    updateData.avatar = userDocument.avatar.trim();
  }

  const updatedProfile = await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: DRIVER_TABLE_ID,
    rowId: DRIVER_PROFILE_ID,
    data: updateData,
  });

  console.log(`✓ Driver profile linked: ${updatedProfile.$id}`);
  console.log(`✓ Driver userId is now: ${authUser.$id}`);
  console.log(`✓ Driver email is now: ${TARGET_EMAIL}`);
  console.log("✓ Verification status: verified");
  console.log("✓ Account status: active");

  console.log(
    "\nVehicle and ride assignments were preserved because the driver profile ID did not change.",
  );

  console.log(
    "\nNow sign out of Nookly, sign back in with the new account, and open Driver Home.",
  );
}

main().catch((error) => {
  console.error("\n✗ Driver account linking failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
