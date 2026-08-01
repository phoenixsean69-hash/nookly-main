import { Client, Databases, ID, Query, TablesDB } from "node-appwrite";

const ACTIVE_RIDE_STATUSES = ["scheduled", "boarding", "active", "delayed"];

const STATUS_TRANSITIONS = {
  scheduled: new Set(["boarding", "delayed", "cancelled"]),
  boarding: new Set(["active", "delayed", "cancelled"]),
  delayed: new Set(["boarding", "active", "cancelled"]),
  active: new Set(["delayed", "completed"]),
  completed: new Set(),
  cancelled: new Set(),
};

const env = (name, fallback = "") => process.env[name]?.trim() || fallback;

const DATABASE_ID = env(
  "APPWRITE_DATABASE_ID",
  env("EXPO_PUBLIC_APPWRITE_DATABASE_ID"),
);
const USERS_COLLECTION_ID = env(
  "APPWRITE_USERS_COLLECTION_ID",
  env("EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID"),
);
const ORGANIZATIONS_COLLECTION_ID = env(
  "APPWRITE_ORGANIZATIONS_COLLECTION_ID",
  env("EXPO_PUBLIC_APPWRITE_ORGANIZATIONS_COLLECTION_ID"),
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
  driverInstitutions: env(
    "APPWRITE_RIDE_DRIVER_INSTITUTIONS_TABLE_ID",
    "ride_driver_institutions",
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
  if (
    !DATABASE_ID ||
    !USERS_COLLECTION_ID ||
    !ORGANIZATIONS_COLLECTION_ID
  ) {
    throw new Error(
      "The driver function is missing database, users, or organizations configuration.",
    );
  }
};

const ok = (res, data, status = 200) => res.json({ ok: true, data }, status);

const fail = (res, status, message) =>
  res.json({ ok: false, error: message }, status);

const parseBody = (req) => {
  const bodyText = typeof req.bodyText === "string" ? req.bodyText.trim() : "";

  if (!bodyText) {
    return {};
  }

  try {
    return JSON.parse(bodyText);
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


const VERIFIED_RELATIONSHIP_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const cleanData = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );

const statusError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

const requireString = (value, label, maxLength = 255) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    throw statusError(400, `${label} is required.`);
  }

  if (normalized.length > maxLength) {
    throw statusError(
      400,
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }

  return normalized;
};

const optionalString = (value, maxLength = 1000) => {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

const requireFileId = (value, label) => {
  const fileId = requireString(value, label, 36);

  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(fileId)) {
    throw statusError(400, `${label} is invalid.`);
  }

  return fileId;
};

const requireInteger = (
  value,
  label,
  { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {},
) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw statusError(400, `${label} is invalid.`);
  }

  return parsed;
};

const optionalDate = (value, label) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) return undefined;

  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    throw statusError(400, `${label} is invalid.`);
  }

  return date.toISOString();
};

const listAllRows = async (
  tablesDB,
  tableId,
  queries = [],
  limit = 500,
) => {
  const rows = [];
  const pageSize = Math.min(100, limit);

  for (let offset = 0; offset < limit; offset += pageSize) {
    const response = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [
        ...queries,
        Query.limit(pageSize),
        Query.offset(offset),
      ],
    });

    rows.push(...response.rows);

    if (
      response.rows.length < pageSize ||
      rows.length >= Number(response.total ?? rows.length)
    ) {
      break;
    }
  }

  return rows.slice(0, limit);
};

const getOrganizationName = (organization) =>
  String(
    organization?.name ||
      organization?.organizationName ||
      organization?.institutionName ||
      organization?.schoolName ||
      "Institution",
  ).trim();

const listOrganizationDocuments = async (databases, limit = 1000) => {
  const organizations = [];
  const pageSize = 100;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const response = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: ORGANIZATIONS_COLLECTION_ID,
      queries: [Query.limit(pageSize), Query.offset(offset)],
    });

    organizations.push(...response.documents);

    if (
      response.documents.length < pageSize ||
      organizations.length >=
        Number(response.total ?? organizations.length)
    ) {
      break;
    }
  }

  return organizations.slice(0, limit);
};

const listDriverOrganizations = async (databases) => {
  const organizations = await listOrganizationDocuments(databases);

  return organizations
    .map((organization) => ({
      $id: String(organization.$id || "").trim(),
      name: getOrganizationName(organization),
      email: optionalString(organization.email, 160),
      phone: optionalString(organization.phone, 32),
      avatar: optionalString(organization.avatar, 2048),
      city: optionalString(
        organization.city ||
          organization.location ||
          organization.schoolLocation,
        128,
      ),
    }))
    .filter((organization) => organization.$id && organization.name)
    .sort((left, right) => left.name.localeCompare(right.name));
};

const resolveDriverOrganization = async (
  databases,
  organizationId,
  institutionName,
) => {
  const normalizedOrganizationId = optionalString(organizationId, 36);

  if (normalizedOrganizationId) {
    try {
      return await databases.getDocument({
        databaseId: DATABASE_ID,
        collectionId: ORGANIZATIONS_COLLECTION_ID,
        documentId: normalizedOrganizationId,
      });
    } catch {
      throw statusError(
        409,
        "That institution is no longer available on Nookly Web. Refresh the institution list and choose again.",
      );
    }
  }

  const target = normalize(institutionName);

  if (!target) {
    throw statusError(
      400,
      "Select an institution registered on Nookly Web.",
    );
  }

  const organizations = await listOrganizationDocuments(databases);
  const match = organizations.find((organization) =>
    [
      organization.name,
      organization.organizationName,
      organization.institutionName,
      organization.schoolName,
    ]
      .map(normalize)
      .filter(Boolean)
      .includes(target),
  );

  if (!match?.$id) {
    throw statusError(
      409,
      "That institution has not completed its Nookly organization setup yet.",
    );
  }

  return match;
};

const getDriverRelationships = async (tablesDB, driverId) => {
  if (!driverId) return [];

  return listAllRows(
    tablesDB,
    TABLES.driverInstitutions,
    [Query.equal("driverId", driverId)],
    100,
  );
};

const attachOrganizationNames = async (databases, relationships) =>
  Promise.all(
    relationships.map(async (relationship) => {
      try {
        const organization = await databases.getDocument({
          databaseId: DATABASE_ID,
          collectionId: ORGANIZATIONS_COLLECTION_ID,
          documentId: relationship.organizationId,
        });

        return {
          ...relationship,
          organizationName: getOrganizationName(organization),
        };
      } catch {
        return relationship;
      }
    }),
  );

const isMarketplaceReady = (driver, relationships, vehicles) =>
  normalize(driver?.status) === "active" &&
  normalize(driver?.verificationStatus) === "verified" &&
  relationships.some((relationship) =>
    VERIFIED_RELATIONSHIP_STATUSES.has(normalize(relationship.status)),
  ) &&
  vehicles.some(
    (vehicle) =>
      normalize(vehicle.status) === "active" &&
      Boolean(vehicle.frontImageFileId) &&
      Boolean(vehicle.sideImageFileId) &&
      Boolean(vehicle.backImageFileId),
  );

const upsertDriverOnboarding = async ({
  databases,
  tablesDB,
  user,
  accountId,
  body,
}) => {
  const requestedOrganizationId = optionalString(
    body.organizationId,
    36,
  );
  const requestedInstitutionName = optionalString(
    body.institutionName,
    160,
  );
  const driverLicenceFileId = requireFileId(
    body.driverLicenceFileId,
    "Driver licence document",
  );
  const nationalIdFileId = requireFileId(
    body.nationalIdFileId,
    "National ID document",
  );
  const frontImageFileId = requireFileId(
    body.frontImageFileId,
    "Vehicle front-view image",
  );
  const sideImageFileId = requireFileId(
    body.sideImageFileId,
    "Vehicle side-view image",
  );
  const backImageFileId = requireFileId(
    body.backImageFileId,
    "Vehicle back-view image",
  );
  const emergencyContactName = requireString(
    body.emergencyContactName,
    "Emergency contact name",
    128,
  );
  const emergencyContactPhone = requireString(
    body.emergencyContactPhone,
    "Emergency contact phone",
    32,
  );
  const registrationNumber = requireString(
    body.vehicleRegistrationNumber,
    "Vehicle registration number",
    32,
  ).toUpperCase();
  const make = requireString(body.vehicleMake, "Vehicle make", 80);
  const model = requireString(body.vehicleModel, "Vehicle model", 80);
  const color = requireString(body.vehicleColor, "Vehicle color", 48);
  const capacity = requireInteger(
    body.vehicleCapacity,
    "Vehicle passenger capacity",
    { min: 1, max: 200 },
  );
  const vehicleType =
    optionalString(body.vehicleType, 32) || "car";
  const manufactureYear =
    body.manufactureYear === null ||
    body.manufactureYear === undefined ||
    body.manufactureYear === ""
      ? undefined
      : requireInteger(
          body.manufactureYear,
          "Vehicle manufacture year",
          {
            min: 1900,
            max: new Date().getFullYear() + 1,
          },
        );
  const insuranceExpiry = optionalDate(
    body.insuranceExpiry,
    "Insurance expiry",
  );
  const fitnessExpiry = optionalDate(
    body.fitnessExpiry,
    "Vehicle fitness expiry",
  );

  const organization = await resolveDriverOrganization(
    databases,
    requestedOrganizationId,
    requestedInstitutionName,
  );
  const organizationId = organization.$id;
  const institutionName = getOrganizationName(organization);
  const timestamp = nowIso();

  const existingDrivers = await listAllRows(
    tablesDB,
    TABLES.drivers,
    [Query.equal("userId", accountId)],
    5,
  );
  let driver = existingDrivers[0] ?? null;
  const legacyLicenceNumber =
    optionalString(driver?.licenceNumber, 64) ||
    `DOC-${driverLicenceFileId}`.slice(0, 64).toUpperCase();

  const matchingVehicles = await listAllRows(
    tablesDB,
    TABLES.vehicles,
    [Query.equal("registrationNumber", registrationNumber)],
    10,
  );
  const vehicleOwnedByAnotherDriver = matchingVehicles.find(
    (vehicle) =>
      !driver ||
      String(vehicle.driverId || "") !== String(driver.$id),
  );

  if (vehicleOwnedByAnotherDriver) {
    throw statusError(
      409,
      "That vehicle registration number is already linked to another driver.",
    );
  }

  const approvedDriver =
    normalize(driver?.verificationStatus) === "verified";

  const driverData = cleanData({
    organizationId,
    userId: accountId,
    name: requireString(user.name, "Driver name", 128),
    phone: requireString(user.phone, "Driver phone", 32),
    email: optionalString(user.email, 160),
    avatar: optionalString(user.avatar, 2048) || "",
    // The legacy licenceNumber column is still required and uniquely indexed.
    // Keep an existing value, or derive an internal reference from the uploaded
    // document ID. It is no longer collected or shown in the mobile form.
    licenceNumber: legacyLicenceNumber,
    licenceExpiry: driver?.licenceExpiry || undefined,
    driverLicenceFileId,
    nationalIdFileId,
    documentsSubmittedAt: timestamp,
    verificationStatus: approvedDriver ? "verified" : "pending",
    rating: Number(driver?.rating || 0),
    completedTrips: Number(driver?.completedTrips || 0),
    status: approvedDriver
      ? String(driver?.status || "active")
      : "active",
    emergencyContactName,
    emergencyContactPhone,
    isOnline: approvedDriver ? driver?.isOnline === true : false,
    currentRideId: String(driver?.currentRideId || ""),
    lastSeenAt: timestamp,
    serviceAreas: [institutionName],
    acceptsPrivateRides:
      driver?.acceptsPrivateRides === false ? false : true,
    acceptsSharedRides:
      driver?.acceptsSharedRides === false ? false : true,
    pricingModel: String(driver?.pricingModel || "offer"),
    maxPickupDistanceKm: Number(
      driver?.maxPickupDistanceKm || 1,
    ),
    availabilityNote: approvedDriver
      ? optionalString(driver?.availabilityNote, 500)
      : `Awaiting verification by ${getOrganizationName(organization)}.`,
    updatedAt: timestamp,
  });

  if (driver) {
    driver = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.drivers,
      rowId: driver.$id,
      data: driverData,
    });
  } else {
    driver = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.drivers,
      rowId: ID.unique(),
      data: {
        ...driverData,
        createdBy: user.$id,
        createdAt: timestamp,
      },
    });
  }

  const relationships = await listAllRows(
    tablesDB,
    TABLES.driverInstitutions,
    [
      Query.equal("driverId", driver.$id),
      Query.equal("organizationId", organizationId),
    ],
    5,
  );
  let relationship = relationships[0] ?? null;
  const approvedRelationship = VERIFIED_RELATIONSHIP_STATUSES.has(
    normalize(relationship?.status),
  );

  const relationshipData = cleanData({
    driverId: driver.$id,
    organizationId,
    status: approvedRelationship
      ? String(relationship.status)
      : "pending",
    notes:
      optionalString(body.applicationNotes, 2000) ||
      "Submitted from Nookly Mobile driver onboarding.",
    updatedAt: timestamp,
  });

  if (relationship) {
    relationship = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.driverInstitutions,
      rowId: relationship.$id,
      data: relationshipData,
    });
  } else {
    relationship = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.driverInstitutions,
      rowId: ID.unique(),
      data: {
        ...relationshipData,
        createdAt: timestamp,
      },
    });
  }

  let vehicle =
    matchingVehicles.find(
      (candidate) =>
        String(candidate.driverId || "") === String(driver.$id),
    ) ?? null;

  if (!vehicle) {
    const driverVehicles = await listAllRows(
      tablesDB,
      TABLES.vehicles,
      [Query.equal("driverId", driver.$id)],
      20,
    );
    vehicle = driverVehicles[0] ?? null;
  }

  const preserveActiveVehicle =
    approvedDriver && normalize(vehicle?.status) === "active";

  const vehicleData = cleanData({
    organizationId,
    driverId: driver.$id,
    registrationNumber,
    make,
    model,
    color,
    capacity,
    image: String(vehicle?.image || ""),
    frontImageFileId,
    sideImageFileId,
    backImageFileId,
    vehicleImagesSubmittedAt: timestamp,
    status: preserveActiveVehicle ? "active" : "inactive",
    insuranceExpiry,
    fitnessExpiry,
    vehicleType,
    manufactureYear,
    passengerCapacity: capacity,
    availableSeats: capacity,
    conditionStatus: preserveActiveVehicle
      ? String(vehicle?.conditionStatus || "approved")
      : "pending_review",
    roadworthinessStatus: preserveActiveVehicle
      ? String(vehicle?.roadworthinessStatus || "approved")
      : "pending_review",
    allowsSharedRides:
      vehicle?.allowsSharedRides === false ? false : true,
    updatedAt: timestamp,
  });

  if (vehicle) {
    vehicle = await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.vehicles,
      rowId: vehicle.$id,
      data: vehicleData,
    });
  } else {
    vehicle = await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.vehicles,
      rowId: ID.unique(),
      data: {
        ...vehicleData,
        createdAt: timestamp,
      },
    });
  }

  return {
    profile: driver,
    vehicle,
    institution: {
      ...relationship,
      organizationName: getOrganizationName(organization),
    },
    organization: {
      $id: organizationId,
      name: getOrganizationName(organization),
    },
    marketplaceReady: isMarketplaceReady(
      driver,
      [relationship],
      [vehicle],
    ),
    applicationStatus: relationship.status,
  };
};

export default async ({ req, res, log, error }) => {
  try {
    requiredConfig();

    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/").replace(/\/+$/, "") || "/";

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(req.headers["x-appwrite-key"]);

    const databases = new Databases(client);
    const tablesDB = new TablesDB(client);

    if (method === "GET" && path === "/organizations") {
      const organizations = await listDriverOrganizations(databases);
      return ok(res, organizations);
    }

    const accountId = req.headers["x-appwrite-user-id"];

    if (!accountId) {
      return fail(res, 401, "Sign in with a driver account to continue.");
    }

    const userResult = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: USERS_COLLECTION_ID,
      queries: [Query.equal("accountId", accountId), Query.limit(1)],
    });

    const user = userResult.documents[0];

    if (!user || String(user.userMode).toLowerCase() !== "driver") {
      return fail(res, 403, "This account is not registered as a driver.");
    }

    const parts = path.split("/").filter(Boolean);
    const body = parseBody(req);

    if (method === "POST" && path === "/onboarding") {
      const result = await upsertDriverOnboarding({
        databases,
        tablesDB,
        user,
        accountId,
        body,
      });

      log?.(
        `Driver onboarding submitted for ${accountId} to organization ${result.organization.$id}.`,
      );

      return ok(res, result, 201);
    }

    const driverResult = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.drivers,
      queries: [Query.equal("userId", accountId), Query.limit(1)],
    });

    const driver = driverResult.rows[0] ?? null;
    const relationships = driver
      ? await getDriverRelationships(tablesDB, driver.$id)
      : [];
    const institutions = await attachOrganizationNames(
      databases,
      relationships,
    );
    const vehicleResult = driver
      ? await tablesDB.listRows({
          databaseId: DATABASE_ID,
          tableId: TABLES.vehicles,
          queries: [Query.equal("driverId", driver.$id), Query.limit(20)],
        })
      : { rows: [] };
    const vehicles = vehicleResult.rows;
    const marketplaceReady = isMarketplaceReady(
      driver,
      relationships,
      vehicles,
    );

    if (method === "GET" && path === "/onboarding") {
      return ok(res, {
        profile: driver,
        vehicles,
        institutions,
        marketplaceReady,
      });
    }

    if (!driver) {
      return fail(res, 403, "No driver profile is linked to this account.");
    }

    const dashboardRequest = method === "GET" && path === "/dashboard";

    if (!dashboardRequest && driver.status !== "active") {
      return fail(
        res,
        403,
        `Driver account is ${driver.status || "inactive"}.`,
      );
    }

    if (!dashboardRequest && driver.verificationStatus !== "verified") {
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

    if (method === "GET" && path === "/dashboard") {
      const rideResult = await tablesDB.listRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.rides,
        queries: [Query.equal("driverId", driver.$id), Query.limit(100)],
      });

      const allRides = sortRides(rideResult.rows);
      const activeRideRaw =
        allRides.find((ride) =>
          ["boarding", "active", "delayed"].includes(ride.status),
        ) ?? null;
      const upcomingRaw = allRides.filter((ride) =>
        ["scheduled", "boarding", "active", "delayed"].includes(ride.status),
      );

      const activeRide = activeRideRaw ? await enrichRide(activeRideRaw) : null;
      const upcomingRides = await Promise.all(upcomingRaw.map(enrichRide));

      return ok(res, {
        profile: driver,
        vehicles,
        institutions,
        marketplaceReady,
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
        queries: [Query.equal("driverId", driver.$id), Query.limit(100)],
      });

      return ok(res, await Promise.all(sortRides(result.rows).map(enrichRide)));
    }

    if (method === "GET" && parts.length === 2 && parts[0] === "rides") {
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
      const nextStatus = String(body.status || "")
        .trim()
        .toLowerCase();
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

      const sequence = Number(recentLocations.rows[0]?.sequence ?? -1) + 1;

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
          ...(isFiniteNumber(body.latitude) ? { latitude: body.latitude } : {}),
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
