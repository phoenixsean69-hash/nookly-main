#!/usr/bin/env node

import {
  Client,
  Databases,
  ID,
  Permission,
  Query,
  Role,
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
const API_KEY = required("APPWRITE_API_KEY");

const DRIVER_TABLE_ID = optional(
  "EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID",
  "ride_drivers",
);

const DRIVER_NAME = required("DRIVER_NAME");
const DRIVER_EMAIL = required("DRIVER_EMAIL").toLowerCase();
const DRIVER_PASSWORD = required("DRIVER_PASSWORD");
const DRIVER_PHONE = required("DRIVER_PHONE");
const DRIVER_LICENCE_NUMBER = required("DRIVER_LICENCE_NUMBER");
const DRIVER_ORGANIZATION_ID = required("DRIVER_ORGANIZATION_ID");

const DRIVER_AVATAR = optional("DRIVER_AVATAR");
const DRIVER_LICENCE_EXPIRY = optional("DRIVER_LICENCE_EXPIRY");
const DRIVER_EMERGENCY_CONTACT_NAME = optional(
  "DRIVER_EMERGENCY_CONTACT_NAME",
);
const DRIVER_EMERGENCY_CONTACT_PHONE = optional(
  "DRIVER_EMERGENCY_CONTACT_PHONE",
);
const DRIVER_VERIFICATION_STATUS = optional(
  "DRIVER_VERIFICATION_STATUS",
  "verified",
);
const DRIVER_STATUS = optional("DRIVER_STATUS", "active");

if (DRIVER_PASSWORD.length < 8) {
  throw new Error("DRIVER_PASSWORD must contain at least 8 characters.");
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const users = new Users(client);
const databases = new Databases(client);
const tablesDB = new TablesDB(client);

const now = new Date().toISOString();

async function findAuthUserByEmail() {
  const result = await users.list({
    queries: [Query.equal("email", DRIVER_EMAIL), Query.limit(1)],
  });

  return result.users[0] ?? null;
}

async function findUserDocument(accountId) {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: USERS_COLLECTION_ID,
    queries: [Query.equal("accountId", accountId), Query.limit(1)],
  });

  return result.documents[0] ?? null;
}

async function findDriverProfile(accountId) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: DRIVER_TABLE_ID,
    queries: [Query.equal("userId", accountId), Query.limit(1)],
  });

  return result.rows[0] ?? null;
}

async function main() {
  console.log("\nCreating Nookly driver account...\n");

  let authUser = await findAuthUserByEmail();

  if (!authUser) {
    authUser = await users.create({
      userId: ID.unique(),
      email: DRIVER_EMAIL,
      password: DRIVER_PASSWORD,
      name: DRIVER_NAME,
    });

    console.log(`+ Created Appwrite Auth user: ${authUser.$id}`);
  } else {
    console.log(`✓ Auth user already exists: ${authUser.$id}`);
  }

  let userDocument = await findUserDocument(authUser.$id);

  if (!userDocument) {
    userDocument = await databases.createDocument({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION_ID,
      documentId: ID.unique(),
      data: {
        accountId: authUser.$id,
        name: DRIVER_NAME,
        userMode: "driver",
        email: DRIVER_EMAIL,
        phone: DRIVER_PHONE,
        avatar: DRIVER_AVATAR || "",
      },
      permissions: [
        Permission.read(Role.user(authUser.$id)),
        Permission.update(Role.user(authUser.$id)),
      ],
    });

    console.log(`+ Created users document: ${userDocument.$id}`);
  } else {
    userDocument = await databases.updateDocument({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION_ID,
      documentId: userDocument.$id,
      data: {
        name: DRIVER_NAME,
        userMode: "driver",
        email: DRIVER_EMAIL,
        phone: DRIVER_PHONE,
        ...(DRIVER_AVATAR ? { avatar: DRIVER_AVATAR } : {}),
      },
    });

    console.log(`✓ Updated users document: ${userDocument.$id}`);
  }

  let driverProfile = await findDriverProfile(authUser.$id);

  const profileData = {
    organizationId: DRIVER_ORGANIZATION_ID,
    userId: authUser.$id,
    name: DRIVER_NAME,
    phone: DRIVER_PHONE,
    email: DRIVER_EMAIL,
    avatar: DRIVER_AVATAR || "",
    licenceNumber: DRIVER_LICENCE_NUMBER,
    ...(DRIVER_LICENCE_EXPIRY
      ? { licenceExpiry: DRIVER_LICENCE_EXPIRY }
      : {}),
    verificationStatus: DRIVER_VERIFICATION_STATUS,
    rating: driverProfile?.rating ?? 0,
    completedTrips: driverProfile?.completedTrips ?? 0,
    status: DRIVER_STATUS,
    emergencyContactName: DRIVER_EMERGENCY_CONTACT_NAME || "",
    emergencyContactPhone: DRIVER_EMERGENCY_CONTACT_PHONE || "",
    isOnline: false,
    currentRideId: driverProfile?.currentRideId || "",
    lastSeenAt: now,
    updatedAt: now,
  };

  if (!driverProfile) {
    driverProfile = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      rowId: ID.unique(),
      data: {
        ...profileData,
        createdBy: userDocument.$id,
        createdAt: now,
      },
    });

    console.log(`+ Created driver profile: ${driverProfile.$id}`);
  } else {
    driverProfile = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      rowId: driverProfile.$id,
      data: profileData,
    });

    console.log(`✓ Updated driver profile: ${driverProfile.$id}`);
  }

  console.log("\n✓ Driver account is ready.");
  console.log(`Email:      ${DRIVER_EMAIL}`);
  console.log(`User mode:  driver`);
  console.log(`Driver ID:  ${driverProfile.$id}`);
  console.log(`Account ID: ${authUser.$id}`);
}

main().catch((error) => {
  console.error("\n✗ Driver account creation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
