#!/usr/bin/env node

import { Client, TablesDB } from "node-appwrite";

const env = (name) => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const ENDPOINT = env("EXPO_PUBLIC_APPWRITE_ENDPOINT");
const PROJECT_ID = env("EXPO_PUBLIC_APPWRITE_PROJECT_ID");
const DATABASE_ID = env("EXPO_PUBLIC_APPWRITE_DATABASE_ID");
const API_KEY = env("APPWRITE_API_KEY");
const DRIVER_TABLE_ID =
  process.env.EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID?.trim() ||
  "ride_drivers";

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const tablesDB = new TablesDB(client);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const errorCode = (error) => Number(error?.code ?? error?.response?.code ?? 0);
const isNotFound = (error) => errorCode(error) === 404;
const isConflict = (error) => errorCode(error) === 409;

async function getColumn(key) {
  try {
    return await tablesDB.getColumn({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      key,
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitForColumn(key) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const column = await getColumn(key);

    if (column?.status === "available") return;
    if (column?.status === "failed") {
      throw new Error(
        `Column ${DRIVER_TABLE_ID}.${key} failed: ${
          column.error || "unknown error"
        }`,
      );
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for ${DRIVER_TABLE_ID}.${key}`);
}

async function ensureBooleanColumn(key) {
  if (await getColumn(key)) {
    await waitForColumn(key);
    console.log(`✓ Column exists: ${key}`);
    return;
  }

  try {
    await tablesDB.createBooleanColumn({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      key,
      required: false,
      array: false,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await waitForColumn(key);
  console.log(`+ Created column: ${key}`);
}

async function ensureStringColumn(key, size) {
  if (await getColumn(key)) {
    await waitForColumn(key);
    console.log(`✓ Column exists: ${key}`);
    return;
  }

  try {
    await tablesDB.createStringColumn({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      key,
      size,
      required: false,
      array: false,
      encrypt: false,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await waitForColumn(key);
  console.log(`+ Created column: ${key}`);
}

async function ensureDatetimeColumn(key) {
  if (await getColumn(key)) {
    await waitForColumn(key);
    console.log(`✓ Column exists: ${key}`);
    return;
  }

  try {
    await tablesDB.createDatetimeColumn({
      databaseId: DATABASE_ID,
      tableId: DRIVER_TABLE_ID,
      key,
      required: false,
      array: false,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await waitForColumn(key);
  console.log(`+ Created column: ${key}`);
}

async function main() {
  console.log("\nSetting up Nookly Driver mode backend...\n");

  await tablesDB.getTable({
    databaseId: DATABASE_ID,
    tableId: DRIVER_TABLE_ID,
  });

  await ensureBooleanColumn("isOnline");
  await ensureStringColumn("currentRideId", 36);
  await ensureDatetimeColumn("lastSeenAt");

  console.log("\n✓ Driver-mode backend columns are ready.");
  console.log("\nAdd this to the mobile app environment:");
  console.log(
    "EXPO_PUBLIC_APPWRITE_RIDES_DRIVER_FUNCTION_ID=rides-driver-api",
  );
}

main().catch((error) => {
  console.error("\n✗ Driver-mode backend setup failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
