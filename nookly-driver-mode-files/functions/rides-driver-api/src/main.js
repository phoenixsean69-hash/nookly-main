import {
  Client,
  Databases,
  ID,
  Query,
  TablesDB,
} from "node-appwrite";

const ACTIVE_RIDE_STATUSES = ["scheduled", "boarding", "active", "delayed"];

const STATUS_TRANSITIONS = {
  scheduled: new Set(["boarding", "delayed", "cancelled"]),
  boarding: new Set(["active", "delayed", "cancelled"]),
  delayed: new Set(["boarding", "active", "cancelled"]),
  active: new Set(["delayed", "completed"]),
  completed: new Set(),
  cancelled: new Set(),
};

const env = (name, fallback = "") =>
  process.env[name]?.trim() || fallback;

const DATABASE_ID = env(
  "APPWRITE_DATABASE_ID",
  env("EXPO_PUBLIC_APPWRITE_DATABASE_ID"),
);
const USERS_COLLECTION_ID = env(
  "APPWRITE_USERS_COLLECTION_ID",
  env("EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID"),
);

const TABLES = {
  drivers: env(
    "APPWRITE_RIDE_DRIVERS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID", "ride_drivers"),
  ),
  vehicles: env(
    "APPWRITE_RIDE_VEHICLES_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_VEHICLES_COLLECTION_ID", "ride_vehicles"),
  ),
  routes: env(
    "APPWRITE_RIDE_ROUTES_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID", "ride_routes"),
  ),
  stops: env(
    "APPWRITE_RIDE_STOPS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID", "ride_stops"),
  ),
  rides: env(
    "APPWRITE_RIDES_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID", "rides"),
  ),
  bookings: env(
    "APPWRITE_RIDE_BOOKINGS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_BOOKINGS_COLLECTION_ID", "ride_bookings"),
  ),
  locations: env(
    "APPWRITE_RIDE_LOCATIONS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_LOCATIONS_COLLECTION_ID", "ride_locations"),
  ),
  incidents: env(
    "APPWRITE_RIDE_INCIDENTS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_INCIDENTS_COLLECTION_ID", "ride_incidents"),
  ),
  events: env(
    "APPWRITE_RIDE_EVENTS_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDE_EVENTS_COLLECTION_ID", "ride_events"),
  ),
};

const requiredConfig = () => {
  if (!DATABASE_ID || !USERS_COLLECTION_ID) {
    throw new Error(
      "The driver function is missing database or users collection configuration.",
    );
  }
};

const ok = (res, data, status = 200) =>
  res.json({ ok: true, data }, status);

const fail = (res, status, message) =>
  res.json({ ok: false, error: message }, status);

const parseBody = (req) => {
  if (req.bodyJson && typeof req.bodyJson === "object") {
    return req.bodyJson;
  }

  if (!req.bodyText) return {};

  try {
    return JSON.parse(req.bodyText);
  } catch {
    return {};
  }
};

const sortRides = (rides) =>
  [...rides].sort(
    (left, right) =>
      new Date(left.departureTime).getTime() -
      new Date(right.departureTime).getTime(),
  );

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const nowIso = () => new Date().toISOString();

export default async ({ req, res, log, error }) => {
  try {
    requiredConfig();

    const accountId = req.headers["x-appwrite-user-id"];

    if (!accountId) {
      return fail(res, 401, "Sign in with a driver account to continue.");
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers["x-appwrite-key"]);

    const databases = new Databases(client);
    const tablesDB = new TablesDB(client);

    const userResult = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION_ID,
      queries: [Query.equal("accountId", accountId), Query.limit(1)],
    });

    const user = userResult.documents[0];

    if (!user || String(user.userMode).toLowerCase() !== "driver") {
      return fail(res, 403, "This account is not registered as a driver.");
    }

    const driverResult = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.drivers,
      queries: [Query.equal("userId", accountId), Query.limit(1)],
    });

    const driver = driverResult.rows[0];

    if (!driver) {
      return fail(
        res,
        403,
        "No driver profile is linked to this account.",
      );
    }

    if (driver.status !== "active") {
      return fail(
        res,
        403,
        `Driver account is ${driver.status || "inactive"}.`,
      );
    }

    if (driver.verificationStatus !== "verified") {
      return fail(
        res,
        403,
        `Driver verification is ${driver.verificationStatus || "pending"}.`,
      );
    }

    const getRide = async (rideId) => {
      const ride = await tablesDB.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.rides,
        rowId: rideId,
      });

      if (ride.driverId !== driver.$id) {
        throw Object.assign(
          new Error("This ride is not assigned to the signed-in driver."),
          { statusCode: 403 },
        );
      }

      return ride;
    };

    const getRoute = async (routeId) => {
      try {
        return await tablesDB.getRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.routes,
          rowId: routeId,
        });
      } catch {
        return null;
      }
    };

    const getStops = async (routeId) => {
      const result = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.stops,
        queries: [
          Query.equal("routeId", routeId),
          Query.equal("isActive", true),
          Query.limit(100),
        ],
      });

      return [...result.rows].sort(
        (left, right) => left.stopOrder - right.stopOrder,
      );
    };

    const getBookings = async (rideId) => {
      const result = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.bookings,
        queries: [
          Query.equal("rideId", rideId),
          Query.limit(200),
          Query.orderAsc("bookedAt"),
        ],
      });

      return result.rows;
    };

    const enrichRide = async (ride) => ({
      ...ride,
      route: await getRoute(ride.routeId),
    });

    const createEvent = async (ride, eventType, message, data = {}) => {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.events,
        rowId: ID.unique(),
        data: {
          rideId: ride.$id,
          organizationId: ride.organizationId,
          eventType,
          message,
          actorId: driver.$id,
          actorType: "driver",
          dataJson: JSON.stringify(data),
          createdAt: nowIso(),
        },
      });
    };

    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/").replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);
    const body = parseBody(req);

    if (method === "GET" && path === "/dashboard") {
      const [vehicleResult, rideResult] = await Promise.all([
        tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: TABLES.vehicles,
          queries: [
            Query.equal("driverId", driver.$id),
            Query.limit(20),
          ],
        }),
        tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: TABLES.rides,
          queries: [
            Query.equal("driverId", driver.$id),
            Query.limit(100),
          ],
        }),
      ]);

      const allRides = sortRides(rideResult.rows);
      const activeRideRaw =
        allRides.find((ride) =>
          ["boarding", "active", "delayed"].includes(ride.status),
        ) ?? null;
      const upcomingRaw = allRides.filter((ride) =>
        ["scheduled", "boarding", "active", "delayed"].includes(ride.status),
      );

      const activeRide = activeRideRaw
        ? await enrichRide(activeRideRaw)
        : null;
      const upcomingRides = await Promise.all(
        upcomingRaw.map(enrichRide),
      );

      return ok(res, {
        profile: driver,
        vehicles: vehicleResult.rows,
        activeRide,
        upcomingRides,
        completedTrips:
          driver.completedTrips ??
          allRides.filter((ride) => ride.status === "completed").length,
      });
    }

    if (method === "GET" && path === "/rides") {
      const result = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.rides,
        queries: [
          Query.equal("driverId", driver.$id),
          Query.limit(100),
        ],
      });

      return ok(
        res,
        await Promise.all(sortRides(result.rows).map(enrichRide)),
      );
    }

    if (
      method === "GET" &&
      parts.length === 2 &&
      parts[0] === "rides"
    ) {
      const ride = await getRide(parts[1]);
      const [route, stops, bookings] = await Promise.all([
        getRoute(ride.routeId),
        getStops(ride.routeId),
        getBookings(ride.$id),
      ]);

      return ok(res, {
        ...ride,
        route,
        stops,
        bookings,
      });
    }

    if (method === "POST" && path === "/availability") {
      const isOnline = body.isOnline === true;

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.drivers,
        rowId: driver.$id,
        data: {
          isOnline,
          lastSeenAt: nowIso(),
          updatedAt: nowIso(),
        },
      });

      return ok(res, { isOnline });
    }

    if (
      method === "POST" &&
      parts.length === 3 &&
      parts[0] === "rides" &&
      parts[2] === "status"
    ) {
      const ride = await getRide(parts[1]);
      const nextStatus = String(body.status || "").trim().toLowerCase();
      const allowed = STATUS_TRANSITIONS[ride.status] ?? new Set();

      if (!allowed.has(nextStatus)) {
        return fail(
          res,
          409,
          `Ride cannot move from ${ride.status} to ${nextStatus || "unknown"}.`,
        );
      }

      const timestamp = nowIso();
      const updateData = {
        status: nextStatus,
        updatedAt: timestamp,
      };

      if (nextStatus === "boarding") {
        updateData.bookingOpen = true;
      }

      if (nextStatus === "active") {
        updateData.startedAt = ride.startedAt || timestamp;
        updateData.bookingOpen = false;
      }

      if (nextStatus === "completed") {
        updateData.completedAt = timestamp;
        updateData.bookingOpen = false;
      }

      if (nextStatus === "cancelled") {
        updateData.cancelledAt = timestamp;
        updateData.cancellationReason =
          String(body.reason || "").trim() || "Cancelled by driver";
        updateData.bookingOpen = false;
      }

      const updatedRide = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.rides,
        rowId: ride.$id,
        data: updateData,
      });

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.drivers,
        rowId: driver.$id,
        data: {
          currentRideId: ["completed", "cancelled"].includes(nextStatus)
            ? ""
            : ride.$id,
          isOnline: !["completed", "cancelled"].includes(nextStatus),
          lastSeenAt: timestamp,
          updatedAt: timestamp,
          ...(nextStatus === "completed"
            ? {
                completedTrips: Number(driver.completedTrips || 0) + 1,
              }
            : {}),
        },
      });

      await createEvent(
        ride,
        "ride_status_changed",
        `Driver changed ride status to ${nextStatus}.`,
        {
          previousStatus: ride.status,
          nextStatus,
        },
      );

      return ok(res, updatedRide);
    }

    if (
      method === "POST" &&
      parts.length === 3 &&
      parts[0] === "rides" &&
      parts[2] === "location"
    ) {
      const ride = await getRide(parts[1]);

      if (!["boarding", "active", "delayed"].includes(ride.status)) {
        return fail(
          res,
          409,
          "Location can only be shared during boarding or an active trip.",
        );
      }

      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const heading =
        body.heading === null || body.heading === undefined
          ? null
          : Number(body.heading);
      const speedKph =
        body.speedKph === null || body.speedKph === undefined
          ? null
          : Number(body.speedKph);
      const accuracyMeters =
        body.accuracyMeters === null || body.accuracyMeters === undefined
          ? null
          : Number(body.accuracyMeters);

      if (
        !isFiniteNumber(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !isFiniteNumber(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return fail(res, 400, "Invalid location coordinates.");
      }

      if (body.isMocked === true) {
        return fail(res, 400, "Mocked locations are not accepted.");
      }

      if (speedKph !== null && (!isFiniteNumber(speedKph) || speedKph > 220)) {
        return fail(res, 400, "Invalid vehicle speed.");
      }

      const timestamp = nowIso();

      const recentLocations = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.locations,
        queries: [
          Query.equal("rideId", ride.$id),
          Query.orderDesc("sequence"),
          Query.limit(1),
        ],
      });

      const sequence =
        Number(recentLocations.rows[0]?.sequence ?? -1) + 1;

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.rides,
        rowId: ride.$id,
        data: {
          currentLatitude: latitude,
          currentLongitude: longitude,
          ...(heading !== null ? { currentHeading: heading } : {}),
          ...(speedKph !== null ? { currentSpeedKph: speedKph } : {}),
          ...(accuracyMeters !== null
            ? { currentAccuracyMeters: accuracyMeters }
            : {}),
          lastLocationAt: timestamp,
          updatedAt: timestamp,
        },
      });

      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.locations,
        rowId: ID.unique(),
        data: {
          rideId: ride.$id,
          driverId: driver.$id,
          vehicleId: ride.vehicleId,
          latitude,
          longitude,
          ...(heading !== null ? { heading } : {}),
          ...(speedKph !== null ? { speedKph } : {}),
          ...(accuracyMeters !== null ? { accuracyMeters } : {}),
          recordedAt: timestamp,
          source: "driver_app",
          sequence,
          ...(isFiniteNumber(body.batteryLevel)
            ? { batteryLevel: body.batteryLevel }
            : {}),
          ...(body.networkType
            ? { networkType: String(body.networkType) }
            : {}),
          isMocked: false,
          createdAt: timestamp,
        },
      });

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.drivers,
        rowId: driver.$id,
        data: {
          currentRideId: ride.$id,
          isOnline: true,
          lastSeenAt: timestamp,
          updatedAt: timestamp,
        },
      });

      return ok(res, {
        accepted: true,
        recordedAt: timestamp,
      });
    }

    if (
      method === "POST" &&
      parts.length === 3 &&
      parts[0] === "rides" &&
      parts[2] === "incidents"
    ) {
      const ride = await getRide(parts[1]);
      const category = String(body.category || "").trim();
      const description = String(body.description || "").trim();

      if (!category || !description) {
        return fail(
          res,
          400,
          "Incident category and description are required.",
        );
      }

      const timestamp = nowIso();
      const incident = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.incidents,
        rowId: ID.unique(),
        data: {
          rideId: ride.$id,
          organizationId: ride.organizationId,
          reportedBy: driver.$id,
          reporterType: "driver",
          category,
          description,
          ...(isFiniteNumber(body.latitude)
            ? { latitude: body.latitude }
            : {}),
          ...(isFiniteNumber(body.longitude)
            ? { longitude: body.longitude }
            : {}),
          status: "open",
          priority: String(body.priority || "medium"),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });

      await createEvent(
        ride,
        "incident_reported",
        `Driver reported a ${category} incident.`,
        { incidentId: incident.$id },
      );

      return ok(res, { incidentId: incident.$id }, 201);
    }

    return fail(res, 404, "Driver endpoint not found.");
  } catch (caughtError) {
    error(caughtError?.stack || caughtError?.message || String(caughtError));
    const statusCode = Number(caughtError?.statusCode || 500);

    return fail(
      res,
      statusCode,
      statusCode === 500
        ? "Driver service encountered an unexpected error."
        : caughtError.message,
    );
  }
};
