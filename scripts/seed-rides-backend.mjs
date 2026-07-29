#!/usr/bin/env node

/**
 * Nookly Rides — sample backend data
 *
 * Run after setup-rides-backend.mjs:
 *   node scripts/seed-rides-backend.mjs
 *
 * Required environment variables:
 *   EXPO_PUBLIC_APPWRITE_ENDPOINT
 *   EXPO_PUBLIC_APPWRITE_PROJECT_ID
 *   EXPO_PUBLIC_APPWRITE_DATABASE_ID
 *   APPWRITE_API_KEY
 *
 * Optional:
 *   NOOKLY_SEED_ORGANIZATION_ID
 *   NOOKLY_SEED_CREATED_BY
 *   NOOKLY_SEED_SCHOOL_LOCATION
 */

import { Client, ID, Query, TablesDB } from "node-appwrite";

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const client = new Client()
  .setEndpoint(requiredEnv("EXPO_PUBLIC_APPWRITE_ENDPOINT"))
  .setProject(requiredEnv("EXPO_PUBLIC_APPWRITE_PROJECT_ID"))
  .setKey(requiredEnv("APPWRITE_API_KEY"));

const tablesDB = new TablesDB(client);
const DATABASE_ID = requiredEnv("EXPO_PUBLIC_APPWRITE_DATABASE_ID");

const ORGANIZATION_ID =
  process.env.NOOKLY_SEED_ORGANIZATION_ID?.trim() || "demo-organization";
const CREATED_BY = process.env.NOOKLY_SEED_CREATED_BY?.trim() || "seed-script";
const SCHOOL_LOCATION =
  process.env.NOOKLY_SEED_SCHOOL_LOCATION?.trim().toLowerCase() ||
  "bindura university of science education";

const TABLES = {
  drivers: "ride_drivers",
  vehicles: "ride_vehicles",
  routes: "ride_routes",
  stops: "ride_stops",
  rides: "rides",
  events: "ride_events",
};

const now = new Date();
const nowIso = () => new Date().toISOString();
const inHours = (hours) => new Date(now.getTime() + hours * 3_600_000).toISOString();

async function findOne(tableId, queries) {
  const result = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [...queries, Query.limit(1)],
  });
  return result.rows[0] ?? null;
}

async function ensureRow(tableId, queries, data) {
  const existing = await findOne(tableId, queries);
  if (existing) {
    console.log(`✓ Existing ${tableId}: ${existing.$id}`);
    return existing;
  }

  const row = await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId,
    rowId: ID.unique(),
    data,
  });

  console.log(`+ Created ${tableId}: ${row.$id}`);
  return row;
}

async function main() {
  console.log("\nSeeding Nookly Rides demo data...\n");

  const driver = await ensureRow(
    TABLES.drivers,
    [
      Query.equal("organizationId", [ORGANIZATION_ID]),
      Query.equal("phone", ["+263771000001"]),
    ],
    {
      organizationId: ORGANIZATION_ID,
      name: "Tendai Moyo",
      phone: "+263771000001",
      email: "driver.demo@nookly.co.zw",
      licenceNumber: "DEMO-DL-001",
      verificationStatus: "verified",
      rating: 4.8,
      completedTrips: 24,
      status: "active",
      emergencyContactName: "Demo Contact",
      emergencyContactPhone: "+263772000001",
      createdBy: CREATED_BY,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  );

  const vehicle = await ensureRow(
    TABLES.vehicles,
    [Query.equal("registrationNumber", ["NOOKLY-DEMO-01"])],
    {
      organizationId: ORGANIZATION_ID,
      driverId: driver.$id,
      registrationNumber: "NOOKLY-DEMO-01",
      make: "Toyota",
      model: "Hiace",
      color: "White",
      capacity: 15,
      status: "active",
      createdBy: CREATED_BY,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  );

  const route = await ensureRow(
    TABLES.routes,
    [
      Query.equal("organizationId", [ORGANIZATION_ID]),
      Query.equal("name", ["Campus Gate to Bindura CBD"]),
    ],
    {
      organizationId: ORGANIZATION_ID,
      schoolLocation: SCHOOL_LOCATION,
      name: "Campus Gate to Bindura CBD",
      originName: "Demo Campus Main Gate",
      originLatitude: -17.312,
      originLongitude: 31.325,
      destinationName: "Bindura CBD",
      destinationLatitude: -17.301,
      destinationLongitude: 31.331,
      estimatedDurationMinutes: 20,
      estimatedDistanceKm: 7.5,
      defaultFare: 1.5,
      currency: "USD",
      description: "Demo student route for the first Nookly Rides backend test.",
      isActive: true,
      createdBy: CREATED_BY,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  );

  const stopDefinitions = [
    {
      name: "Demo Campus Main Gate",
      latitude: -17.312,
      longitude: 31.325,
      stopOrder: 0,
      estimatedArrivalOffsetMinutes: 0,
      isPickup: true,
      isDropoff: false,
    },
    {
      name: "Demo Student Residence Stop",
      latitude: -17.307,
      longitude: 31.328,
      stopOrder: 1,
      estimatedArrivalOffsetMinutes: 8,
      isPickup: true,
      isDropoff: true,
    },
    {
      name: "Bindura CBD",
      latitude: -17.301,
      longitude: 31.331,
      stopOrder: 2,
      estimatedArrivalOffsetMinutes: 20,
      isPickup: false,
      isDropoff: true,
    },
  ];

  for (const stop of stopDefinitions) {
    await ensureRow(
      TABLES.stops,
      [
        Query.equal("routeId", [route.$id]),
        Query.equal("stopOrder", [stop.stopOrder]),
      ],
      {
        routeId: route.$id,
        organizationId: ORGANIZATION_ID,
        ...stop,
        isActive: true,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    );
  }

  const ride = await ensureRow(
    TABLES.rides,
    [
      Query.equal("organizationId", [ORGANIZATION_ID]),
      Query.equal("externalReference", ["DEMO-RIDE-001"]),
    ],
    {
      organizationId: ORGANIZATION_ID,
      schoolLocation: SCHOOL_LOCATION,
      routeId: route.$id,
      driverId: driver.$id,
      vehicleId: vehicle.$id,
      driverName: driver.name,
      vehicleRegistration: vehicle.registrationNumber,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleColor: vehicle.color,
      vehicleCapacity: vehicle.capacity,
      externalReference: "DEMO-RIDE-001",
      departureTime: inHours(2),
      estimatedArrivalTime: inHours(2.35),
      fare: 1.5,
      currency: "USD",
      totalSeats: 15,
      bookedSeats: 3,
      availableSeats: 12,
      status: "scheduled",
      bookingOpen: true,
      createdBy: CREATED_BY,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    },
  );

  await ensureRow(
    TABLES.events,
    [
      Query.equal("rideId", [ride.$id]),
      Query.equal("eventType", ["ride_created"]),
    ],
    {
      rideId: ride.$id,
      organizationId: ORGANIZATION_ID,
      eventType: "ride_created",
      message: "Demo ride created by the Nookly seed script.",
      actorId: CREATED_BY,
      actorType: "system",
      dataJson: JSON.stringify({ source: "seed-rides-backend.mjs" }),
      createdAt: nowIso(),
    },
  );

  console.log("\n✓ Demo rides data is ready.\n");
  console.log(`Organization: ${ORGANIZATION_ID}`);
  console.log(`School:       ${SCHOOL_LOCATION}`);
  console.log(`Route ID:     ${route.$id}`);
  console.log(`Ride ID:      ${ride.$id}\n`);
}

main().catch((error) => {
  console.error("\n✗ Failed to seed Nookly Rides data.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
