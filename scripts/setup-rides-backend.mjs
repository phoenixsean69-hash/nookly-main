#!/usr/bin/env node

/**
 * Nookly Rides — Appwrite backend setup
 *
 * Creates the tables, columns, indexes, and secure table-level
 * permissions required by the first Nookly Rides backend.
 *
 * Run from the Nookly project root:
 *   node scripts/setup-rides-backend.mjs
 *
 * Required environment variables:
 *   EXPO_PUBLIC_APPWRITE_ENDPOINT
 *   EXPO_PUBLIC_APPWRITE_PROJECT_ID
 *   EXPO_PUBLIC_APPWRITE_DATABASE_ID
 *   APPWRITE_API_KEY
 */

import {
  Client,
  TablesDB,
  Permission,
  Role,
} from "node-appwrite";

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

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const tablesDB = new TablesDB(client);

const TABLE_IDS = Object.freeze({
  drivers: "ride_drivers",
  vehicles: "ride_vehicles",
  routes: "ride_routes",
  stops: "ride_stops",
  rides: "rides",
  bookings: "ride_bookings",
  locations: "ride_locations",
  incidents: "ride_incidents",
  events: "ride_events",
});

const authenticatedReadPermissions = [Permission.read(Role.users())];
const serverOnlyPermissions = [];

const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const errorCode = (error) => Number(error?.code ?? error?.response?.code ?? 0);
const isNotFound = (error) => errorCode(error) === 404;
const isConflict = (error) => errorCode(error) === 409;

const describeError = (error) =>
  error instanceof Error ? error.message : JSON.stringify(error);

async function ensureTable(definition) {
  try {
    const existing = await tablesDB.getTable({
      databaseId: DATABASE_ID,
      tableId: definition.id,
    });
    console.log(`✓ Table exists: ${definition.id}`);
    return existing;
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }

  const table = await tablesDB.createTable({
    databaseId: DATABASE_ID,
    tableId: definition.id,
    name: definition.name,
    permissions: definition.permissions,
    rowSecurity: true,
    enabled: true,
  });

  console.log(`+ Created table: ${definition.id}`);
  return table;
}

async function getColumn(tableId, key) {
  try {
    return await tablesDB.getColumn({
      databaseId: DATABASE_ID,
      tableId,
      key,
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitForColumn(tableId, key) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const column = await getColumn(tableId, key);

    if (column?.status === "available") return column;

    if (column?.status === "failed") {
      throw new Error(
        `Column ${tableId}.${key} failed: ${column.error || "unknown error"}`,
      );
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for column ${tableId}.${key}`);
}

async function createColumn(tableId, columnDefinition) {
  const existing = await getColumn(tableId, columnDefinition.key);
  if (existing) {
    await waitForColumn(tableId, columnDefinition.key);
    console.log(`  ✓ Column exists: ${columnDefinition.key}`);
    return;
  }

  const common = {
    databaseId: DATABASE_ID,
    tableId,
    key: columnDefinition.key,
    required: columnDefinition.required ?? false,
    array: columnDefinition.array ?? false,
  };

  try {
    switch (columnDefinition.type) {
      case "string":
        await tablesDB.createStringColumn({
          ...common,
          size: columnDefinition.size,
          encrypt: columnDefinition.encrypt ?? false,
        });
        break;

      case "integer":
        await tablesDB.createIntegerColumn({
          ...common,
          min: columnDefinition.min,
          max: columnDefinition.max,
        });
        break;

      case "float":
        await tablesDB.createFloatColumn({
          ...common,
          min: columnDefinition.min,
          max: columnDefinition.max,
        });
        break;

      case "boolean":
        await tablesDB.createBooleanColumn(common);
        break;

      case "datetime":
        await tablesDB.createDatetimeColumn(common);
        break;

      default:
        throw new Error(`Unsupported column type: ${columnDefinition.type}`);
    }
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await waitForColumn(tableId, columnDefinition.key);
  console.log(`  + Created column: ${columnDefinition.key}`);
}

async function ensureColumns(tableId, columns) {
  for (const column of columns) {
    await createColumn(tableId, column);
  }
}

async function getIndex(tableId, key) {
  try {
    return await tablesDB.getIndex({
      databaseId: DATABASE_ID,
      tableId,
      key,
    });
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

async function waitForIndex(tableId, key) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const index = await getIndex(tableId, key);

    if (index?.status === "available") return index;

    if (index?.status === "failed") {
      throw new Error(
        `Index ${tableId}.${key} failed: ${index.error || "unknown error"}`,
      );
    }

    await sleep(1_000);
  }

  throw new Error(`Timed out waiting for index ${tableId}.${key}`);
}

async function ensureIndex(tableId, index) {
  const existing = await getIndex(tableId, index.key);
  if (existing) {
    await waitForIndex(tableId, index.key);
    console.log(`  ✓ Index exists: ${index.key}`);
    return;
  }

  try {
    await tablesDB.createIndex({
      databaseId: DATABASE_ID,
      tableId,
      key: index.key,
      type: index.type,
      columns: index.columns,
      orders: index.orders,
    });
  } catch (error) {
    if (!isConflict(error)) throw error;
  }

  await waitForIndex(tableId, index.key);
  console.log(`  + Created index: ${index.key}`);
}

async function ensureIndexes(tableId, indexes) {
  for (const index of indexes) {
    await ensureIndex(tableId, index);
  }
}

const string = (key, size, required = false, options = {}) => ({
  type: "string",
  key,
  size,
  required,
  ...options,
});

const integer = (key, required = false, options = {}) => ({
  type: "integer",
  key,
  required,
  ...options,
});

const float = (key, required = false, options = {}) => ({
  type: "float",
  key,
  required,
  ...options,
});

const boolean = (key, required = false) => ({
  type: "boolean",
  key,
  required,
});

const datetime = (key, required = false) => ({
  type: "datetime",
  key,
  required,
});

const keyIndex = (key, columns, orders) => ({
  key,
  type: "key",
  columns,
  orders: orders ?? columns.map(() => "ASC"),
});

const uniqueIndex = (key, columns) => ({
  key,
  type: "unique",
  columns,
  orders: columns.map(() => "ASC"),
});

const schema = [
  {
    id: TABLE_IDS.drivers,
    name: "Ride Drivers",
    permissions: serverOnlyPermissions,
    columns: [
      string("organizationId", 36, true),
      string("userId", 36),
      string("name", 128, true),
      string("phone", 32, true),
      string("email", 256),
      string("avatar", 2048),
      string("licenceNumber", 64, true),
      datetime("licenceExpiry"),
      string("verificationStatus", 32, true),
      float("rating", false, { min: 0, max: 5 }),
      integer("completedTrips", false, { min: 0 }),
      string("status", 32, true),
      string("emergencyContactName", 128),
      string("emergencyContactPhone", 32),
      string("createdBy", 36),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      keyIndex("drivers_org_status", ["organizationId", "status"]),
      keyIndex("drivers_user", ["userId"]),
      uniqueIndex("drivers_org_phone", ["organizationId", "phone"]),
      uniqueIndex("drivers_licence", ["licenceNumber"]),
      keyIndex("drivers_verification", ["verificationStatus", "status"]),
    ],
  },
  {
    id: TABLE_IDS.vehicles,
    name: "Ride Vehicles",
    permissions: serverOnlyPermissions,
    columns: [
      string("organizationId", 36, true),
      string("driverId", 36),
      string("registrationNumber", 64, true),
      string("make", 64, true),
      string("model", 64, true),
      string("color", 64, true),
      integer("capacity", true, { min: 1, max: 200 }),
      string("image", 2048),
      string("status", 32, true),
      datetime("insuranceExpiry"),
      datetime("fitnessExpiry"),
      string("createdBy", 36),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      keyIndex("vehicles_org_status", ["organizationId", "status"]),
      keyIndex("vehicles_driver_status", ["driverId", "status"]),
      uniqueIndex("vehicles_registration", ["registrationNumber"]),
    ],
  },
  {
    id: TABLE_IDS.routes,
    name: "Ride Routes",
    permissions: authenticatedReadPermissions,
    columns: [
      string("organizationId", 36, true),
      string("schoolLocation", 255, true),
      string("institutionId", 64),
      string("name", 128, true),
      string("originName", 255, true),
      float("originLatitude", true, { min: -90, max: 90 }),
      float("originLongitude", true, { min: -180, max: 180 }),
      string("destinationName", 255, true),
      float("destinationLatitude", true, { min: -90, max: 90 }),
      float("destinationLongitude", true, { min: -180, max: 180 }),
      integer("estimatedDurationMinutes", true, { min: 1 }),
      float("estimatedDistanceKm", true, { min: 0 }),
      float("defaultFare", true, { min: 0 }),
      string("currency", 8, true),
      string("description", 2000),
      boolean("isActive", true),
      string("createdBy", 36),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      keyIndex("routes_org_active", ["organizationId", "isActive"]),
      keyIndex("routes_school_active", ["schoolLocation", "isActive"]),
      keyIndex("routes_institution_active", ["institutionId", "isActive"]),
    ],
  },
  {
    id: TABLE_IDS.stops,
    name: "Ride Stops",
    permissions: authenticatedReadPermissions,
    columns: [
      string("routeId", 36, true),
      string("organizationId", 36, true),
      string("name", 255, true),
      float("latitude", true, { min: -90, max: 90 }),
      float("longitude", true, { min: -180, max: 180 }),
      integer("stopOrder", true, { min: 0 }),
      integer("estimatedArrivalOffsetMinutes", true, { min: 0 }),
      boolean("isPickup", true),
      boolean("isDropoff", true),
      boolean("isActive", true),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      uniqueIndex("stops_route_order", ["routeId", "stopOrder"]),
      keyIndex("stops_route_active", ["routeId", "isActive"]),
      keyIndex("stops_org_route", ["organizationId", "routeId"]),
    ],
  },
  {
    id: TABLE_IDS.rides,
    name: "Rides",
    permissions: authenticatedReadPermissions,
    columns: [
      string("organizationId", 36, true),
      string("schoolLocation", 255, true),
      string("institutionId", 64),
      string("routeId", 36, true),
      string("driverId", 36, true),
      string("vehicleId", 36, true),
      string("driverName", 128, true),
      string("driverAvatar", 2048),
      string("vehicleRegistration", 64, true),
      string("vehicleMake", 64, true),
      string("vehicleModel", 64, true),
      string("vehicleColor", 64, true),
      integer("vehicleCapacity", true, { min: 1, max: 200 }),
      string("externalReference", 64),
      datetime("departureTime", true),
      datetime("estimatedArrivalTime", true),
      float("fare", true, { min: 0 }),
      string("currency", 8, true),
      integer("totalSeats", true, { min: 1, max: 200 }),
      integer("bookedSeats", true, { min: 0, max: 200 }),
      integer("availableSeats", true, { min: 0, max: 200 }),
      string("status", 32, true),
      boolean("bookingOpen", true),
      string("driverAccessCodeHash", 255),
      float("currentLatitude", false, { min: -90, max: 90 }),
      float("currentLongitude", false, { min: -180, max: 180 }),
      float("currentHeading", false, { min: 0, max: 360 }),
      float("currentSpeedKph", false, { min: 0 }),
      float("currentAccuracyMeters", false, { min: 0 }),
      datetime("lastLocationAt"),
      datetime("startedAt"),
      datetime("completedAt"),
      datetime("cancelledAt"),
      string("cancellationReason", 500),
      string("createdBy", 36),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      keyIndex("rides_school_status_departure", [
        "schoolLocation",
        "status",
        "departureTime",
      ]),
      keyIndex("rides_org_status_departure", [
        "organizationId",
        "status",
        "departureTime",
      ]),
      keyIndex("rides_route_departure", ["routeId", "departureTime"]),
      keyIndex("rides_driver_status", ["driverId", "status"]),
      keyIndex("rides_vehicle_status", ["vehicleId", "status"]),
      keyIndex("rides_booking_departure", ["bookingOpen", "departureTime"]),
      uniqueIndex("rides_org_external_ref", [
        "organizationId",
        "externalReference",
      ]),
    ],
  },
  {
    id: TABLE_IDS.bookings,
    name: "Ride Bookings",
    permissions: serverOnlyPermissions,
    columns: [
      string("rideId", 36, true),
      string("organizationId", 36, true),
      string("studentId", 36, true),
      string("studentName", 128, true),
      string("studentPhone", 32, true),
      string("pickupStopId", 36, true),
      string("dropoffStopId", 36, true),
      integer("seatCount", true, { min: 1, max: 10 }),
      float("amount", true, { min: 0 }),
      string("currency", 8, true),
      string("paymentStatus", 32, true),
      string("status", 32, true),
      string("bookingReference", 32, true),
      datetime("bookedAt", true),
      datetime("boardedAt"),
      datetime("completedAt"),
      datetime("cancelledAt"),
      string("cancellationReason", 500),
      datetime("createdAt", true),
      datetime("updatedAt", true),
    ],
    indexes: [
      uniqueIndex("bookings_ride_student", ["rideId", "studentId"]),
      uniqueIndex("bookings_reference", ["bookingReference"]),
      keyIndex("bookings_ride_status", ["rideId", "status"]),
      keyIndex("bookings_student_status", ["studentId", "status"]),
      keyIndex("bookings_student_booked", ["studentId", "bookedAt"]),
      keyIndex("bookings_org_status", ["organizationId", "status"]),
    ],
  },
  {
    id: TABLE_IDS.locations,
    name: "Ride Locations",
    permissions: serverOnlyPermissions,
    columns: [
      string("rideId", 36, true),
      string("driverId", 36, true),
      string("vehicleId", 36, true),
      float("latitude", true, { min: -90, max: 90 }),
      float("longitude", true, { min: -180, max: 180 }),
      float("heading", false, { min: 0, max: 360 }),
      float("speedKph", false, { min: 0 }),
      float("accuracyMeters", false, { min: 0 }),
      datetime("recordedAt", true),
      string("source", 32, true),
      integer("sequence", true, { min: 0 }),
      integer("batteryLevel", false, { min: 0, max: 100 }),
      string("networkType", 32),
      boolean("isMocked"),
      datetime("createdAt", true),
    ],
    indexes: [
      uniqueIndex("locations_ride_sequence", ["rideId", "sequence"]),
      keyIndex("locations_ride_recorded", ["rideId", "recordedAt"]),
      keyIndex("locations_driver_recorded", ["driverId", "recordedAt"]),
      keyIndex("locations_vehicle_recorded", ["vehicleId", "recordedAt"]),
    ],
  },
  {
    id: TABLE_IDS.incidents,
    name: "Ride Incidents",
    permissions: serverOnlyPermissions,
    columns: [
      string("rideId", 36, true),
      string("organizationId", 36, true),
      string("reportedBy", 36, true),
      string("reporterType", 32, true),
      string("category", 64, true),
      string("description", 4000, true),
      float("latitude", false, { min: -90, max: 90 }),
      float("longitude", false, { min: -180, max: 180 }),
      string("status", 32, true),
      string("priority", 32, true),
      string("assignedTo", 36),
      string("resolutionNotes", 4000),
      datetime("createdAt", true),
      datetime("acknowledgedAt"),
      datetime("resolvedAt"),
      datetime("updatedAt", true),
    ],
    indexes: [
      keyIndex("incidents_org_status_created", [
        "organizationId",
        "status",
        "createdAt",
      ]),
      keyIndex("incidents_ride_created", ["rideId", "createdAt"]),
      keyIndex("incidents_reporter_created", ["reportedBy", "createdAt"]),
    ],
  },
  {
    id: TABLE_IDS.events,
    name: "Ride Events",
    permissions: serverOnlyPermissions,
    columns: [
      string("rideId", 36, true),
      string("organizationId", 36, true),
      string("eventType", 64, true),
      string("message", 1000, true),
      string("actorId", 36),
      string("actorType", 32),
      string("dataJson", 8000),
      datetime("createdAt", true),
    ],
    indexes: [
      keyIndex("events_ride_created", ["rideId", "createdAt"]),
      keyIndex("events_org_created", ["organizationId", "createdAt"]),
      keyIndex("events_type_created", ["eventType", "createdAt"]),
    ],
  },
];

async function main() {
  console.log("\nNookly Rides backend setup");
  console.log(`Project:  ${PROJECT_ID}`);
  console.log(`Database: ${DATABASE_ID}`);
  console.log(`Started:  ${nowIso()}\n`);

  for (const table of schema) {
    console.log(`\n[${table.id}] ${table.name}`);
    await ensureTable(table);
    await ensureColumns(table.id, table.columns);
    await ensureIndexes(table.id, table.indexes);
  }

  console.log("\n✓ Nookly Rides backend foundation is ready.\n");
  console.log("Add these values to the mobile and organization app environments:\n");
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID=${TABLE_IDS.drivers}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_VEHICLES_COLLECTION_ID=${TABLE_IDS.vehicles}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID=${TABLE_IDS.routes}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID=${TABLE_IDS.stops}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID=${TABLE_IDS.rides}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_BOOKINGS_COLLECTION_ID=${TABLE_IDS.bookings}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_LOCATIONS_COLLECTION_ID=${TABLE_IDS.locations}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_INCIDENTS_COLLECTION_ID=${TABLE_IDS.incidents}`);
  console.log(`EXPO_PUBLIC_APPWRITE_RIDE_EVENTS_COLLECTION_ID=${TABLE_IDS.events}`);
}

main().catch((error) => {
  console.error("\n✗ Rides backend setup failed.");
  console.error(describeError(error));
  process.exitCode = 1;
});
