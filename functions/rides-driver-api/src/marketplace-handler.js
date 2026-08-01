import crypto from "node:crypto";
import {
  Client,
  Databases,
  ID,
  Query,
  TablesDB,
} from "node-appwrite";

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

const ORGANIZATIONS_COLLECTION_ID = env(
  "APPWRITE_ORGANIZATIONS_COLLECTION_ID",
  env("EXPO_PUBLIC_APPWRITE_ORGANIZATIONS_COLLECTION_ID"),
);

const DEFAULT_ORGANIZATION_ID = env(
  "APPWRITE_RIDES_DEFAULT_ORGANIZATION_ID",
);

const REQUEST_EXPIRY_HOURS = Math.max(
  1,
  Math.min(
    48,
    Number(env("APPWRITE_RIDES_REQUEST_EXPIRY_HOURS", "12")) || 12,
  ),
);

const OFFER_EXPIRY_MINUTES = Math.max(
  10,
  Math.min(
    180,
    Number(env("APPWRITE_RIDES_OFFER_EXPIRY_MINUTES", "45")) || 45,
  ),
);

const NEARBY_DRIVER_RADIUS_KM = 1;

const NEARBY_DRIVER_LOCATION_MAX_AGE_MINUTES = Math.max(
  1,
  Math.min(
    60,
    Number(
      env(
        "APPWRITE_RIDES_NEARBY_LOCATION_MAX_AGE_MINUTES",
        "15",
      ),
    ) || 15,
  ),
);

const NEARBY_DRIVER_SCAN_LIMIT = Math.max(
  100,
  Math.min(
    5000,
    Number(env("APPWRITE_RIDES_NEARBY_SCAN_LIMIT", "2000")) ||
      2000,
  ),
);

const NEARBY_DRIVER_RESULT_LIMIT = Math.max(
  1,
  Math.min(
    100,
    Number(env("APPWRITE_RIDES_NEARBY_RESULT_LIMIT", "50")) ||
      50,
  ),
);

const TABLES = {
  drivers: env("APPWRITE_RIDE_DRIVERS_TABLE_ID", "ride_drivers"),
  vehicles: env("APPWRITE_RIDE_VEHICLES_TABLE_ID", "ride_vehicles"),
  requests: env("APPWRITE_RIDE_REQUESTS_TABLE_ID", "ride_requests"),
  offers: env("APPWRITE_RIDE_OFFERS_TABLE_ID", "ride_offers"),
  driverInstitutions: env(
    "APPWRITE_RIDE_DRIVER_INSTITUTIONS_TABLE_ID",
    "ride_driver_institutions",
  ),
  rides: env("APPWRITE_RIDES_TABLE_ID", "rides"),
  bookings: env(
    "APPWRITE_RIDE_BOOKINGS_TABLE_ID",
    "ride_bookings",
  ),
  tripCore: env(
    "APPWRITE_RIDE_TRIP_CORE_TABLE_ID",
    "ride_trip_core",
  ),
  tripWaypoints: env(
    "APPWRITE_RIDE_TRIP_WAYPOINTS_TABLE_ID",
    "ride_trip_waypoints",
  ),
  expectedRoutePoints: env(
    "APPWRITE_RIDE_EXPECTED_ROUTE_POINTS_TABLE_ID",
    "ride_expected_route_points",
  ),
  events: env("APPWRITE_RIDE_EVENTS_TABLE_ID", "ride_events"),
};

const OPEN_REQUEST_STATUSES = new Set([
  "pending",
  "quoted",
  "confirming",
]);

const OPEN_OFFER_STATUSES = new Set(["submitted"]);

const DRIVER_INSTITUTION_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const ok = (res, data, status = 200) =>
  res.json({ ok: true, data }, status);

const fail = (res, status, message) =>
  res.json({ ok: false, error: message }, status);

const nowIso = () => new Date().toISOString();

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const parseBody = (req) => {
  const bodyText =
    typeof req.bodyText === "string" ? req.bodyText.trim() : "";

  if (!bodyText) return {};

  try {
    return JSON.parse(bodyText);
  } catch {
    return {};
  }
};

const cleanData = (value) =>
  Object.fromEntries(
    Object.entries(value).filter(
      ([, item]) => item !== undefined,
    ),
  );

const statusError = (statusCode, message) =>
  Object.assign(new Error(message), { statusCode });

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const requireNumber = (
  value,
  label,
  { min = -Infinity, max = Infinity } = {},
) => {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < min ||
    parsed > max
  ) {
    throw statusError(400, `${label} is invalid.`);
  }

  return parsed;
};

const requireString = (value, label, maxLength = 1000) => {
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

const safeOptionalString = (value, maxLength = 1000) => {
  const normalized = String(value ?? "").trim();

  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
};

const isExpired = (expiresAt) => {
  const time = new Date(expiresAt ?? 0).getTime();
  return Number.isFinite(time) && time <= Date.now();
};

const effectiveRequestStatus = (request) => {
  if (
    OPEN_REQUEST_STATUSES.has(String(request.status)) &&
    request.expiresAt &&
    isExpired(request.expiresAt)
  ) {
    return "expired";
  }

  return request.status;
};

const effectiveOfferStatus = (offer) => {
  if (
    OPEN_OFFER_STATUSES.has(String(offer.status)) &&
    offer.expiresAt &&
    isExpired(offer.expiresAt)
  ) {
    return "expired";
  }

  return offer.status;
};

const deterministicId = (prefix, ...parts) => {
  const digest = crypto
    .createHash("sha256")
    .update(parts.join(":"))
    .digest("hex")
    .slice(0, 24);

  return `${prefix}${digest}`.slice(0, 36);
};

const createReference = (prefix) => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const tail = ID.unique().slice(-6).toUpperCase();
  return `${prefix}-${date}-${tail}`.slice(0, 32);
};

const addMinutes = (value, minutes) => {
  const date = new Date(value);
  return new Date(date.getTime() + minutes * 60_000).toISOString();
};

const addHours = (value, hours) => {
  const date = new Date(value);
  return new Date(date.getTime() + hours * 3_600_000).toISOString();
};

const toRadians = (degrees) => (degrees * Math.PI) / 180;

const haversineKm = (lat1, lon1, lat2, lon2) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const assertRequiredConfig = () => {
  if (!DATABASE_ID || !USERS_COLLECTION_ID) {
    throw new Error(
      "The rides marketplace function is missing APPWRITE_DATABASE_ID or APPWRITE_USERS_COLLECTION_ID.",
    );
  }
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

const getRowOrNull = async (tablesDB, tableId, rowId) => {
  try {
    return await tablesDB.getRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
    });
  } catch (error) {
    if (Number(error?.code) === 404) return null;
    throw error;
  }
};

const createOrGetRow = async (
  tablesDB,
  tableId,
  rowId,
  data,
) => {
  try {
    return await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      data: cleanData(data),
    });
  } catch (error) {
    if (Number(error?.code) !== 409) throw error;

    const existing = await getRowOrNull(
      tablesDB,
      tableId,
      rowId,
    );

    if (!existing) throw error;
    return existing;
  }
};

const getCurrentUser = async (databases, accountId) => {
  const result = await databases.listDocuments({
    databaseId: DATABASE_ID,
    collectionId: USERS_COLLECTION_ID,
    queries: [
      Query.equal("accountId", accountId),
      Query.limit(1),
    ],
  });

  const user = result.documents[0];

  if (!user) {
    throw statusError(
      403,
      "No Nookly user profile is linked to this account.",
    );
  }

  return user;
};

const isStudentUser = (user) => {
  const userMode = normalize(user.userMode);
  const tenantType = normalize(user.tenantType);

  return (
    userMode === "student" ||
    (userMode === "tenant" && tenantType === "student")
  );
};

const isDriverUser = (user) =>
  normalize(user.userMode) === "driver";

const resolveStudentOrganizationId = async (
  databases,
  user,
) => {
  const directId = String(
    user.organizationId || user.institutionId || "",
  ).trim();

  if (directId) return directId;

  const schoolLocation = String(user.schoolLocation || "").trim();

  if (
    ORGANIZATIONS_COLLECTION_ID &&
    schoolLocation
  ) {
    const organizations = [];
    const pageSize = 100;

    for (let offset = 0; offset < 1000; offset += pageSize) {
      const response = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: ORGANIZATIONS_COLLECTION_ID,
        queries: [
          Query.limit(pageSize),
          Query.offset(offset),
        ],
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

    const target = normalize(schoolLocation);

    const match = organizations.find((organization) => {
      const names = [
        organization.name,
        organization.organizationName,
        organization.institutionName,
        organization.schoolName,
      ]
        .map(normalize)
        .filter(Boolean);

      return names.includes(target);
    });

    if (match?.$id) return match.$id;
  }

  if (DEFAULT_ORGANIZATION_ID) {
    return DEFAULT_ORGANIZATION_ID;
  }

  throw statusError(
    409,
    "Your institution is not linked to a Nookly organization yet. Ask the institution to complete its Nookly setup.",
  );
};

const getDriverProfile = async (
  tablesDB,
  accountId,
) => {
  const rows = await listAllRows(
    tablesDB,
    TABLES.drivers,
    [Query.equal("userId", accountId)],
    5,
  );

  const driver = rows[0];

  if (!driver) {
    throw statusError(
      403,
      "No driver profile is linked to this account.",
    );
  }

  if (normalize(driver.status) !== "active") {
    throw statusError(
      403,
      `Driver account is ${driver.status || "inactive"}.`,
    );
  }

  if (normalize(driver.verificationStatus) !== "verified") {
    throw statusError(
      403,
      `Driver verification is ${driver.verificationStatus || "pending"}.`,
    );
  }

  return driver;
};

const getDriverOrganizationIds = async (
  tablesDB,
  driver,
) => {
  const organizationIds = new Set();

  const relationships = await listAllRows(
    tablesDB,
    TABLES.driverInstitutions,
    [Query.equal("driverId", driver.$id)],
    200,
  );

  relationships.forEach((relationship) => {
    if (
      DRIVER_INSTITUTION_STATUSES.has(
        normalize(relationship.status),
      ) &&
      String(relationship.organizationId || "").trim()
    ) {
      organizationIds.add(
        String(relationship.organizationId).trim(),
      );
    }
  });

  // Legacy verified drivers may predate the institution relationship table.
  // Use the direct organization only when no relationship rows exist. A new
  // pending relationship must never be bypassed by driver.organizationId.
  if (
    relationships.length === 0 &&
    String(driver.organizationId || "").trim()
  ) {
    organizationIds.add(String(driver.organizationId).trim());
  }

  return organizationIds;
};

const ensureDriverCanServeOrganization = async (
  tablesDB,
  driver,
  organizationId,
) => {
  const organizationIds = await getDriverOrganizationIds(
    tablesDB,
    driver,
  );

  if (!organizationIds.has(organizationId)) {
    throw statusError(
      403,
      "Your driver profile is not recognised by this student's institution.",
    );
  }
};

const getActiveDriverVehicles = async (
  tablesDB,
  driverId,
) => {
  const vehicles = await listAllRows(
    tablesDB,
    TABLES.vehicles,
    [Query.equal("driverId", driverId)],
    100,
  );

  return vehicles.filter(
    (vehicle) => normalize(vehicle.status) === "active",
  );
};

const vehicleCapacity = (vehicle) =>
  Math.max(
    1,
    Number(
      vehicle.passengerCapacity ??
        vehicle.capacity ??
        vehicle.availableSeats ??
        1,
    ) || 1,
  );

const vehicleAvailableSeats = (vehicle) =>
  Math.max(
    0,
    Math.min(
      vehicleCapacity(vehicle),
      Number(
        vehicle.availableSeats ??
          vehicle.passengerCapacity ??
          vehicle.capacity ??
          0,
      ) || 0,
    ),
  );

const sanitizeRequestForDriver = (request) => {
  const { studentPhone, ...safeRequest } = request;

  return {
    ...safeRequest,
    status: effectiveRequestStatus(request),
  };
};

const sanitizeDriverSummary = (driver) => ({
  $id: driver.$id,
  name: driver.name,
  avatar: driver.avatar || undefined,
  rating: Number(driver.rating || 0),
  completedTrips: Number(driver.completedTrips || 0),
  verificationStatus: driver.verificationStatus,
});

const sanitizeVehicleSummary = (vehicle) => ({
  $id: vehicle.$id,
  registrationNumber: vehicle.registrationNumber,
  make: vehicle.make,
  model: vehicle.model,
  color: vehicle.color,
  capacity: Number(vehicle.capacity || 0),
  passengerCapacity:
    vehicle.passengerCapacity === null ||
    vehicle.passengerCapacity === undefined
      ? undefined
      : Number(vehicle.passengerCapacity),
  availableSeats:
    vehicle.availableSeats === null ||
    vehicle.availableSeats === undefined
      ? undefined
      : Number(vehicle.availableSeats),
  vehicleType: vehicle.vehicleType || undefined,
  hasAirConditioning:
    vehicle.hasAirConditioning ?? undefined,
  hasSeatbelts: vehicle.hasSeatbelts ?? undefined,
  allowsLuggage: vehicle.allowsLuggage ?? undefined,
});

const isDemoDriver = (driver) => {
  const licenceNumber = normalize(driver.licenceNumber);
  const email = normalize(driver.email);

  return (
    licenceNumber.startsWith("nookly-demo-") ||
    email.endsWith("@nookly.local")
  );
};

const getNearbyDriversForStudent = async (
  tablesDB,
  organizationId,
  latitude,
  longitude,
) => {
  const [drivers, vehicles, relationships] = await Promise.all([
    listAllRows(
      tablesDB,
      TABLES.drivers,
      [],
      NEARBY_DRIVER_SCAN_LIMIT,
    ),
    listAllRows(
      tablesDB,
      TABLES.vehicles,
      [],
      NEARBY_DRIVER_SCAN_LIMIT,
    ),
    listAllRows(
      tablesDB,
      TABLES.driverInstitutions,
      [],
      NEARBY_DRIVER_SCAN_LIMIT,
    ),
  ]);

  const permittedDriverIds = new Set();

  relationships.forEach((relationship) => {
    if (
      String(relationship.organizationId || "").trim() ===
        organizationId &&
      DRIVER_INSTITUTION_STATUSES.has(
        normalize(relationship.status),
      ) &&
      String(relationship.driverId || "").trim()
    ) {
      permittedDriverIds.add(
        String(relationship.driverId).trim(),
      );
    }
  });

  drivers.forEach((driver) => {
    if (
      String(driver.organizationId || "").trim() ===
      organizationId
    ) {
      permittedDriverIds.add(driver.$id);
    }
  });

  const activeVehicleByDriverId = new Map();

  vehicles.forEach((vehicle) => {
    const driverId = String(vehicle.driverId || "").trim();

    if (
      !driverId ||
      normalize(vehicle.status) !== "active" ||
      vehicleAvailableSeats(vehicle) < 1
    ) {
      return;
    }

    const existing = activeVehicleByDriverId.get(driverId);

    if (
      !existing ||
      vehicleAvailableSeats(vehicle) >
        vehicleAvailableSeats(existing)
    ) {
      activeVehicleByDriverId.set(driverId, vehicle);
    }
  });

  const maximumLocationAgeMs =
    NEARBY_DRIVER_LOCATION_MAX_AGE_MINUTES * 60_000;
  const timestamp = Date.now();

  return drivers
    .filter((driver) => permittedDriverIds.has(driver.$id))
    .filter(
      (driver) =>
        normalize(driver.status) === "active" &&
        normalize(driver.verificationStatus) === "verified" &&
        driver.isOnline === true &&
        !String(driver.currentRideId || "").trim(),
    )
    .map((driver) => {
      const driverLatitude = numberOrNull(
        driver.currentLatitude,
      );
      const driverLongitude = numberOrNull(
        driver.currentLongitude,
      );
      const locationTime = new Date(
        driver.currentLocationAt || 0,
      ).getTime();
      const demo = isDemoDriver(driver);

      if (
        driverLatitude === null ||
        driverLatitude < -90 ||
        driverLatitude > 90 ||
        driverLongitude === null ||
        driverLongitude < -180 ||
        driverLongitude > 180 ||
        !Number.isFinite(locationTime)
      ) {
        return null;
      }

      const locationAgeMs = Math.max(
        0,
        timestamp - locationTime,
      );

      if (
        !demo &&
        (locationTime > timestamp + 5 * 60_000 ||
          locationAgeMs > maximumLocationAgeMs)
      ) {
        return null;
      }

      const distanceKm = haversineKm(
        latitude,
        longitude,
        driverLatitude,
        driverLongitude,
      );

      if (
        !Number.isFinite(distanceKm) ||
        distanceKm > NEARBY_DRIVER_RADIUS_KM
      ) {
        return null;
      }

      const vehicle = activeVehicleByDriverId.get(
        driver.$id,
      );

      if (!vehicle) {
        return null;
      }

      return {
        ...sanitizeDriverSummary(driver),
        isOnline: true,
        isDemo: demo,
        distanceKm: Number(distanceKm.toFixed(3)),
        distanceMeters: Math.round(distanceKm * 1000),
        estimatedPickupMinutes: Math.max(
          1,
          Math.ceil((distanceKm / 24) * 60),
        ),
        location: {
          latitude: driverLatitude,
          longitude: driverLongitude,
          accuracyMeters:
            numberOrNull(driver.currentAccuracyMeters) ??
            undefined,
          updatedAt: driver.currentLocationAt,
          ageSeconds: Math.round(locationAgeMs / 1000),
        },
        pricing: {
          model: driver.pricingModel || undefined,
          baseFare:
            numberOrNull(driver.baseFare) ?? undefined,
          pricePerKm:
            numberOrNull(driver.pricePerKm) ?? undefined,
        },
        vehicle: sanitizeVehicleSummary(vehicle),
      };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        left.distanceKm - right.distanceKm ||
        Number(right.rating || 0) -
          Number(left.rating || 0),
    )
    .slice(0, NEARBY_DRIVER_RESULT_LIMIT);
};

const getRequestOrThrow = async (
  tablesDB,
  requestId,
) => {
  const request = await getRowOrNull(
    tablesDB,
    TABLES.requests,
    requestId,
  );

  if (!request) {
    throw statusError(404, "Ride request was not found.");
  }

  return request;
};

const getOfferOrThrow = async (
  tablesDB,
  offerId,
) => {
  const offer = await getRowOrNull(
    tablesDB,
    TABLES.offers,
    offerId,
  );

  if (!offer) {
    throw statusError(404, "Ride offer was not found.");
  }

  return offer;
};

const getOffersForRequest = async (
  tablesDB,
  requestId,
) =>
  listAllRows(
    tablesDB,
    TABLES.offers,
    [Query.equal("requestId", requestId)],
    200,
  );

const enrichOfferForStudent = async (
  tablesDB,
  offer,
) => {
  const [driver, vehicle] = await Promise.all([
    getRowOrNull(tablesDB, TABLES.drivers, offer.driverId),
    getRowOrNull(tablesDB, TABLES.vehicles, offer.vehicleId),
  ]);

  return {
    ...offer,
    status: effectiveOfferStatus(offer),
    driver: driver ? sanitizeDriverSummary(driver) : null,
    vehicle: vehicle ? sanitizeVehicleSummary(vehicle) : null,
  };
};

const getTripReferences = async (
  tablesDB,
  requestId,
  studentId,
) => {
  const [tripRows, bookingRows] = await Promise.all([
    listAllRows(
      tablesDB,
      TABLES.tripCore,
      [Query.equal("requestId", requestId)],
      5,
    ),
    listAllRows(
      tablesDB,
      TABLES.bookings,
      [
        Query.equal("requestId", requestId),
        Query.equal("studentId", studentId),
      ],
      5,
    ),
  ]);

  return {
    confirmedRideId: tripRows[0]?.rideId ?? null,
    bookingId: bookingRows[0]?.$id ?? null,
  };
};

const createRideEvent = async (
  tablesDB,
  {
    rideId,
    organizationId,
    eventType,
    message,
    actorId,
    actorType,
    requestId,
    offerId,
    bookingId,
    studentId,
    driverId,
    data = {},
  },
) => {
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.events,
    rowId: ID.unique(),
    data: cleanData({
      rideId,
      organizationId,
      eventType,
      message,
      actorId,
      actorType,
      dataJson: JSON.stringify(data),
      requestId,
      offerId,
      bookingId,
      studentId,
      driverId,
      createdAt: nowIso(),
    }),
  });
};

const confirmOffer = async (
  tablesDB,
  request,
  offer,
  user,
  accountId,
) => {
  const existingReferences = await getTripReferences(
    tablesDB,
    request.$id,
    accountId,
  );

  if (
    request.status === "confirmed" &&
    existingReferences.confirmedRideId &&
    existingReferences.bookingId
  ) {
    return {
      requestId: request.$id,
      offerId: request.selectedOfferId || offer.$id,
      rideId: existingReferences.confirmedRideId,
      bookingId: existingReferences.bookingId,
    };
  }

  if (!["pending", "quoted", "confirming"].includes(request.status)) {
    throw statusError(
      409,
      `This request is ${request.status} and cannot accept an offer.`,
    );
  }

  if (effectiveRequestStatus(request) === "expired") {
    throw statusError(
      409,
      "This ride request has expired.",
    );
  }

  if (offer.requestId !== request.$id) {
    throw statusError(
      409,
      "The selected offer does not belong to this request.",
    );
  }

  if (effectiveOfferStatus(offer) !== "submitted") {
    throw statusError(
      409,
      `This offer is ${effectiveOfferStatus(offer)} and can no longer be accepted.`,
    );
  }

  const [driver, vehicle] = await Promise.all([
    getRowOrNull(tablesDB, TABLES.drivers, offer.driverId),
    getRowOrNull(tablesDB, TABLES.vehicles, offer.vehicleId),
  ]);

  if (
    !driver ||
    normalize(driver.status) !== "active" ||
    normalize(driver.verificationStatus) !== "verified"
  ) {
    throw statusError(
      409,
      "The selected driver is no longer available.",
    );
  }

  if (!vehicle || normalize(vehicle.status) !== "active") {
    throw statusError(
      409,
      "The selected vehicle is no longer available.",
    );
  }

  if (vehicle.driverId !== driver.$id) {
    throw statusError(
      409,
      "The selected vehicle is not linked to this driver.",
    );
  }

  await ensureDriverCanServeOrganization(
    tablesDB,
    driver,
    request.organizationId,
  );

  const passengerCount = Math.max(
    1,
    Number(request.passengerCount || 1),
  );

  if (passengerCount > vehicleCapacity(vehicle)) {
    throw statusError(
      409,
      "The selected vehicle cannot carry all passengers.",
    );
  }

  const timestamp = nowIso();

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: {
      status: "confirming",
      selectedDriverId: driver.$id,
      selectedOfferId: offer.$id,
      updatedAt: timestamp,
    },
  });

  const rideId = deterministicId("r_", request.$id);
  const bookingId = deterministicId("b_", request.$id);
  const tripCoreId = deterministicId("t_", request.$id);
  const pickupWaypointId = deterministicId(
    "w_",
    request.$id,
    "pickup",
  );
  const destinationWaypointId = deterministicId(
    "w_",
    request.$id,
    "destination",
  );
  const firstRoutePointId = deterministicId(
    "p_",
    request.$id,
    "0",
  );
  const lastRoutePointId = deterministicId(
    "p_",
    request.$id,
    "1",
  );

  const departureTime = new Date(
    request.requestedDepartureTime,
  ).toISOString();

  const journeyMinutes = Math.max(
    1,
    Number(offer.estimatedJourneyMinutes || 1),
  );

  const estimatedArrivalTime = addMinutes(
    departureTime,
    journeyMinutes,
  );

  const capacity = vehicleCapacity(vehicle);
  const totalFare = Number(offer.quotedFare || 0);

  const straightLineDistance = haversineKm(
    Number(request.pickupLatitude),
    Number(request.pickupLongitude),
    Number(request.destinationLatitude),
    Number(request.destinationLongitude),
  );

  const estimatedDistanceKm = Number(
    Math.max(straightLineDistance * 1.25, straightLineDistance)
      .toFixed(2),
  );

  const ride = await createOrGetRow(
    tablesDB,
    TABLES.rides,
    rideId,
    {
      organizationId: request.organizationId,
      schoolLocation: safeOptionalString(user.schoolLocation, 255),
      routeId: undefined,
      driverId: driver.$id,
      vehicleId: vehicle.$id,
      driverName: driver.name,
      driverAvatar: driver.avatar || undefined,
      vehicleRegistration: vehicle.registrationNumber,
      vehicleMake: vehicle.make,
      vehicleModel: vehicle.model,
      vehicleColor: vehicle.color,
      vehicleCapacity: capacity,
      externalReference: createReference("NR"),
      departureTime,
      estimatedArrivalTime,
      fare: totalFare,
      currency: offer.currency || request.currency || "USD",
      totalSeats: capacity,
      bookedSeats: passengerCount,
      availableSeats: Math.max(0, capacity - passengerCount),
      status: "scheduled",
      bookingOpen: false,
      createdBy: accountId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  );

  const booking = await createOrGetRow(
    tablesDB,
    TABLES.bookings,
    bookingId,
    {
      rideId: ride.$id,
      organizationId: request.organizationId,
      studentId: accountId,
      studentName: user.name || request.studentName,
      studentPhone: requireString(
        user.phone || request.studentPhone,
        "Student phone",
        32,
      ),
      pickupStopId: undefined,
      dropoffStopId: undefined,
      seatCount: passengerCount,
      amount: totalFare,
      currency: offer.currency || request.currency || "USD",
      paymentStatus: "pending",
      status: "confirmed",
      bookingReference: createReference("NB"),
      bookedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      requestId: request.$id,
      offerId: offer.$id,
      pickupAddress: request.pickupAddress,
      pickupLatitude: Number(request.pickupLatitude),
      pickupLongitude: Number(request.pickupLongitude),
      destinationAddress: request.destinationAddress,
      destinationLatitude: Number(request.destinationLatitude),
      destinationLongitude: Number(request.destinationLongitude),
      passengerCount,
    },
  );

  await createOrGetRow(
    tablesDB,
    TABLES.tripCore,
    tripCoreId,
    {
      rideId: ride.$id,
      requestId: request.$id,
      offerId: offer.$id,
      studentId: accountId,
      organizationId: request.organizationId,
      rideType:
        request.ridePreference || "requested_private",
      passengerCount,
      expectedDistanceKm: estimatedDistanceKm,
      expectedDurationMinutes: journeyMinutes,
      routeCorridorMeters: 300,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  );

  await Promise.all([
    createOrGetRow(
      tablesDB,
      TABLES.tripWaypoints,
      pickupWaypointId,
      {
        rideId: ride.$id,
        organizationId: request.organizationId,
        waypointType: "pickup",
        address: request.pickupAddress,
        latitude: Number(request.pickupLatitude),
        longitude: Number(request.pickupLongitude),
        stopOrder: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ),
    createOrGetRow(
      tablesDB,
      TABLES.tripWaypoints,
      destinationWaypointId,
      {
        rideId: ride.$id,
        organizationId: request.organizationId,
        waypointType: "destination",
        address: request.destinationAddress,
        latitude: Number(request.destinationLatitude),
        longitude: Number(request.destinationLongitude),
        stopOrder: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ),
  ]);

  await Promise.all([
    createOrGetRow(
      tablesDB,
      TABLES.expectedRoutePoints,
      firstRoutePointId,
      {
        rideId: ride.$id,
        sequence: 0,
        latitude: Number(request.pickupLatitude),
        longitude: Number(request.pickupLongitude),
        createdAt: timestamp,
      },
    ),
    createOrGetRow(
      tablesDB,
      TABLES.expectedRoutePoints,
      lastRoutePointId,
      {
        rideId: ride.$id,
        sequence: 1,
        latitude: Number(request.destinationLatitude),
        longitude: Number(request.destinationLongitude),
        createdAt: timestamp,
      },
    ),
  ]);

  const requestOffers = await getOffersForRequest(
    tablesDB,
    request.$id,
  );

  await Promise.all(
    requestOffers.map(async (requestOffer) => {
      const nextStatus =
        requestOffer.$id === offer.$id
          ? "accepted"
          : OPEN_OFFER_STATUSES.has(
                effectiveOfferStatus(requestOffer),
              )
            ? "declined"
            : requestOffer.status;

      if (nextStatus === requestOffer.status) return;

      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.offers,
        rowId: requestOffer.$id,
        data: {
          status: nextStatus,
          updatedAt: timestamp,
        },
      });
    }),
  );

  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.requests,
    rowId: request.$id,
    data: {
      status: "confirmed",
      selectedDriverId: driver.$id,
      selectedOfferId: offer.$id,
      updatedAt: timestamp,
    },
  });

  await createRideEvent(tablesDB, {
    rideId: ride.$id,
    organizationId: request.organizationId,
    eventType: "student_offer_accepted",
    message: "Student accepted a driver offer.",
    actorId: accountId,
    actorType: "student",
    requestId: request.$id,
    offerId: offer.$id,
    bookingId: booking.$id,
    studentId: accountId,
    driverId: driver.$id,
    data: {
      quotedFare: totalFare,
      currency: offer.currency,
      passengerCount,
    },
  });

  await createRideEvent(tablesDB, {
    rideId: ride.$id,
    organizationId: request.organizationId,
    eventType: "ride_created",
    message: "A direct student-requested ride was created.",
    actorId: accountId,
    actorType: "student",
    requestId: request.$id,
    offerId: offer.$id,
    bookingId: booking.$id,
    studentId: accountId,
    driverId: driver.$id,
    data: {
      source: "rides-driver-api",
      rideType:
        request.ridePreference || "requested_private",
    },
  });

  return {
    requestId: request.$id,
    offerId: offer.$id,
    rideId: ride.$id,
    bookingId: booking.$id,
  };
};

export default async ({ req, res, log, error }) => {
  try {
    assertRequiredConfig();

    const accountId = String(
      req.headers["x-appwrite-user-id"] || "",
    ).trim();

    if (!accountId) {
      return fail(res, 401, "Sign in to continue.");
    }

    const client = new Client()
      .setEndpoint(
        process.env.APPWRITE_FUNCTION_API_ENDPOINT,
      )
      .setProject(
        process.env.APPWRITE_FUNCTION_PROJECT_ID,
      )
      .setKey(req.headers["x-appwrite-key"]);

    const databases = new Databases(client);
    const tablesDB = new TablesDB(client);

    const user = await getCurrentUser(databases, accountId);

    const method = String(req.method || "GET").toUpperCase();
    const path =
      String(req.path || "/").replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);
    const body = parseBody(req);

    const requireStudent = () => {
      if (!isStudentUser(user)) {
        throw statusError(
          403,
          "This action is available only to student accounts.",
        );
      }
    };

    const requireDriver = async () => {
      if (!isDriverUser(user)) {
        throw statusError(
          403,
          "This action is available only to driver accounts.",
        );
      }

      return getDriverProfile(tablesDB, accountId);
    };

    if (
      method === "POST" &&
      path === "/student/nearby-drivers"
    ) {
      requireStudent();

      const latitude = requireNumber(
        body.latitude ??
          body.currentLatitude ??
          body.location?.latitude,
        "Current latitude",
        { min: -90, max: 90 },
      );

      const longitude = requireNumber(
        body.longitude ??
          body.currentLongitude ??
          body.location?.longitude,
        "Current longitude",
        { min: -180, max: 180 },
      );

      const organizationId =
        await resolveStudentOrganizationId(
          databases,
          user,
        );

      const nearbyDrivers =
        await getNearbyDriversForStudent(
          tablesDB,
          organizationId,
          latitude,
          longitude,
        );

      log?.(
        `Nearby drivers: ${nearbyDrivers.length} within ${NEARBY_DRIVER_RADIUS_KM} km for organization ${organizationId}.`,
      );

      return ok(res, {
        radiusKm: NEARBY_DRIVER_RADIUS_KM,
        organizationId,
        origin: {
          latitude,
          longitude,
        },
        count: nearbyDrivers.length,
        generatedAt: nowIso(),
        drivers: nearbyDrivers,
      });
    }

    if (
      method === "POST" &&
      path === "/student/requests"
    ) {
      requireStudent();

      const organizationId =
        await resolveStudentOrganizationId(
          databases,
          user,
        );

      const pickupAddress = requireString(
        body.pickupAddress,
        "Pickup address",
        255,
      );

      const pickupLatitude = requireNumber(
        body.pickupLatitude,
        "Pickup latitude",
        { min: -90, max: 90 },
      );

      const pickupLongitude = requireNumber(
        body.pickupLongitude,
        "Pickup longitude",
        { min: -180, max: 180 },
      );

      const destinationAddress = requireString(
        body.destinationAddress,
        "Destination address",
        255,
      );

      const destinationLatitude = requireNumber(
        body.destinationLatitude,
        "Destination latitude",
        { min: -90, max: 90 },
      );

      const destinationLongitude = requireNumber(
        body.destinationLongitude,
        "Destination longitude",
        { min: -180, max: 180 },
      );

      const passengerCount = requireNumber(
        body.passengerCount,
        "Passenger count",
        { min: 1, max: 10 },
      );

      const requestedDeparture = new Date(
        requireString(
          body.requestedDepartureTime,
          "Requested departure time",
          64,
        ),
      );

      if (Number.isNaN(requestedDeparture.getTime())) {
        throw statusError(
          400,
          "Requested departure time is invalid.",
        );
      }

      if (
        requestedDeparture.getTime() <
        Date.now() - 5 * 60_000
      ) {
        throw statusError(
          400,
          "Requested departure time cannot be in the past.",
        );
      }

      const ridePreference = [
        "requested_private",
        "requested_shared",
      ].includes(String(body.ridePreference))
        ? String(body.ridePreference)
        : "requested_private";

      const proposedBudget = numberOrNull(
        body.proposedBudget,
      );

      if (
        proposedBudget !== null &&
        proposedBudget < 0
      ) {
        throw statusError(
          400,
          "Proposed budget cannot be negative.",
        );
      }

      const currency =
        requireString(
          body.currency || "USD",
          "Currency",
          8,
        ).toUpperCase();

      const timestamp = nowIso();
      const requestId = ID.unique();

      const requestedExpiry = addHours(
        timestamp,
        REQUEST_EXPIRY_HOURS,
      );

      const departureExpiry = addMinutes(
        requestedDeparture.toISOString(),
        60,
      );

      const expiresAt =
        new Date(requestedExpiry).getTime() <
        new Date(departureExpiry).getTime()
          ? requestedExpiry
          : departureExpiry;

      const request = await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        rowId: requestId,
        data: cleanData({
          organizationId,
          studentId: accountId,
          studentName:
            requireString(user.name, "Student name", 128),
          studentPhone: safeOptionalString(
            user.phone,
            32,
          ),
          pickupAddress,
          pickupLatitude,
          pickupLongitude,
          destinationAddress,
          destinationLatitude,
          destinationLongitude,
          passengerCount: Math.round(passengerCount),
          requestedDepartureTime:
            requestedDeparture.toISOString(),
          ridePreference,
          proposedBudget:
            proposedBudget === null
              ? undefined
              : proposedBudget,
          currency,
          notes: safeOptionalString(body.notes, 1000),
          status: "pending",
          expiresAt,
          createdAt: timestamp,
          updatedAt: timestamp,
        }),
      });

      return ok(res, {
        ...request,
        offerCount: 0,
      }, 201);
    }

    if (
      method === "GET" &&
      path === "/student/requests"
    ) {
      requireStudent();

      const requests = await listAllRows(
        tablesDB,
        TABLES.requests,
        [Query.equal("studentId", accountId)],
        200,
      );

      const enriched = await Promise.all(
        requests.map(async (request) => {
          const offers = await getOffersForRequest(
            tablesDB,
            request.$id,
          );

          return {
            ...request,
            status: effectiveRequestStatus(request),
            offerCount: offers.filter(
              (offer) =>
                effectiveOfferStatus(offer) ===
                "submitted",
            ).length,
          };
        }),
      );

      enriched.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );

      return ok(res, enriched);
    }

    if (
      method === "GET" &&
      parts.length === 3 &&
      parts[0] === "student" &&
      parts[1] === "requests"
    ) {
      requireStudent();

      const request = await getRequestOrThrow(
        tablesDB,
        parts[2],
      );

      if (request.studentId !== accountId) {
        throw statusError(
          403,
          "This ride request belongs to another student.",
        );
      }

      const offers = await getOffersForRequest(
        tablesDB,
        request.$id,
      );

      const enrichedOffers = await Promise.all(
        offers.map((offer) =>
          enrichOfferForStudent(tablesDB, offer),
        ),
      );

      enrichedOffers.sort(
        (left, right) =>
          Number(left.quotedFare || 0) -
          Number(right.quotedFare || 0),
      );

      const references = await getTripReferences(
        tablesDB,
        request.$id,
        accountId,
      );

      return ok(res, {
        request: {
          ...request,
          status: effectiveRequestStatus(request),
          offerCount: enrichedOffers.filter(
            (offer) => offer.status === "submitted",
          ).length,
        },
        offers: enrichedOffers,
        ...references,
      });
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[0] === "student" &&
      parts[1] === "requests" &&
      parts[3] === "cancel"
    ) {
      requireStudent();

      const request = await getRequestOrThrow(
        tablesDB,
        parts[2],
      );

      if (request.studentId !== accountId) {
        throw statusError(
          403,
          "This ride request belongs to another student.",
        );
      }

      if (
        !["pending", "quoted"].includes(
          effectiveRequestStatus(request),
        )
      ) {
        throw statusError(
          409,
          `A ${effectiveRequestStatus(request)} request cannot be cancelled here.`,
        );
      }

      const timestamp = nowIso();

      const updated = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.requests,
        rowId: request.$id,
        data: {
          status: "cancelled",
          updatedAt: timestamp,
        },
      });

      const offers = await getOffersForRequest(
        tablesDB,
        request.$id,
      );

      await Promise.all(
        offers
          .filter(
            (offer) =>
              effectiveOfferStatus(offer) ===
              "submitted",
          )
          .map((offer) =>
            tablesDB.updateRow({
              databaseId: DATABASE_ID,
              tableId: TABLES.offers,
              rowId: offer.$id,
              data: {
                status: "declined",
                updatedAt: timestamp,
              },
            }),
          ),
      );

      return ok(res, updated);
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[0] === "student" &&
      parts[1] === "requests" &&
      parts[3] === "accept-offer"
    ) {
      requireStudent();

      const request = await getRequestOrThrow(
        tablesDB,
        parts[2],
      );

      if (request.studentId !== accountId) {
        throw statusError(
          403,
          "This ride request belongs to another student.",
        );
      }

      const offerId = requireString(
        body.offerId,
        "Offer ID",
        36,
      );

      const offer = await getOfferOrThrow(
        tablesDB,
        offerId,
      );

      const result = await confirmOffer(
        tablesDB,
        request,
        offer,
        user,
        accountId,
      );

      return ok(res, result);
    }

    if (
      method === "GET" &&
      path === "/driver/requests"
    ) {
      const driver = await requireDriver();
      const organizationIds =
        await getDriverOrganizationIds(
          tablesDB,
          driver,
        );

      if (organizationIds.size === 0) {
        return ok(res, []);
      }

      const requests = await listAllRows(
        tablesDB,
        TABLES.requests,
        [],
        500,
      );

      const visible = requests
        .filter((request) =>
          organizationIds.has(request.organizationId),
        )
        .filter((request) =>
          ["pending", "quoted"].includes(
            effectiveRequestStatus(request),
          ),
        )
        .map(sanitizeRequestForDriver)
        .sort(
          (left, right) =>
            new Date(
              left.requestedDepartureTime,
            ).getTime() -
            new Date(
              right.requestedDepartureTime,
            ).getTime(),
        );

      return ok(res, visible);
    }

    if (
      method === "GET" &&
      path === "/driver/offers"
    ) {
      const driver = await requireDriver();

      const offers = await listAllRows(
        tablesDB,
        TABLES.offers,
        [Query.equal("driverId", driver.$id)],
        300,
      );

      const enriched = await Promise.all(
        offers.map(async (offer) => {
          const [request, vehicle] =
            await Promise.all([
              getRowOrNull(
                tablesDB,
                TABLES.requests,
                offer.requestId,
              ),
              getRowOrNull(
                tablesDB,
                TABLES.vehicles,
                offer.vehicleId,
              ),
            ]);

          return {
            ...offer,
            status: effectiveOfferStatus(offer),
            request: request
              ? sanitizeRequestForDriver(request)
              : null,
            vehicle: vehicle
              ? sanitizeVehicleSummary(vehicle)
              : null,
          };
        }),
      );

      enriched.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );

      return ok(res, enriched);
    }

    if (
      method === "GET" &&
      parts.length === 3 &&
      parts[0] === "driver" &&
      parts[1] === "requests"
    ) {
      const driver = await requireDriver();
      const request = await getRequestOrThrow(
        tablesDB,
        parts[2],
      );

      await ensureDriverCanServeOrganization(
        tablesDB,
        driver,
        request.organizationId,
      );

      const [offers, vehicles] = await Promise.all([
        getOffersForRequest(tablesDB, request.$id),
        getActiveDriverVehicles(tablesDB, driver.$id),
      ]);

      const myOffer =
        offers.find(
          (offer) => offer.driverId === driver.$id,
        ) ?? null;

      return ok(res, {
        request: sanitizeRequestForDriver(request),
        myOffer: myOffer
          ? {
              ...myOffer,
              status: effectiveOfferStatus(myOffer),
            }
          : null,
        vehicles: vehicles.map(
          sanitizeVehicleSummary,
        ),
      });
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[0] === "driver" &&
      parts[1] === "requests" &&
      parts[3] === "offers"
    ) {
      const driver = await requireDriver();
      const request = await getRequestOrThrow(
        tablesDB,
        parts[2],
      );

      await ensureDriverCanServeOrganization(
        tablesDB,
        driver,
        request.organizationId,
      );

      if (
        !["pending", "quoted"].includes(
          effectiveRequestStatus(request),
        )
      ) {
        throw statusError(
          409,
          `This request is ${effectiveRequestStatus(request)} and is not accepting offers.`,
        );
      }

      const vehicleId = requireString(
        body.vehicleId,
        "Vehicle",
        36,
      );

      const vehicle = await getRowOrNull(
        tablesDB,
        TABLES.vehicles,
        vehicleId,
      );

      if (
        !vehicle ||
        vehicle.driverId !== driver.$id ||
        normalize(vehicle.status) !== "active"
      ) {
        throw statusError(
          400,
          "Select one of your active vehicles.",
        );
      }

      const quotedFare = requireNumber(
        body.quotedFare,
        "Quoted fare",
        { min: 0, max: 1_000_000 },
      );

      const estimatedPickupMinutes =
        requireNumber(
          body.estimatedPickupMinutes,
          "Estimated pickup time",
          { min: 0, max: 720 },
        );

      const estimatedJourneyMinutes =
        requireNumber(
          body.estimatedJourneyMinutes,
          "Estimated journey time",
          { min: 1, max: 1440 },
        );

      const availableSeats = requireNumber(
        body.availableSeats,
        "Available seats",
        {
          min: Number(request.passengerCount || 1),
          max: vehicleCapacity(vehicle),
        },
      );

      if (
        availableSeats >
        vehicleAvailableSeats(vehicle)
      ) {
        throw statusError(
          400,
          "Available seats exceed the vehicle's current availability.",
        );
      }

      const currency =
        requireString(
          body.currency ||
            request.currency ||
            "USD",
          "Currency",
          8,
        ).toUpperCase();

      const timestamp = nowIso();

      const existingOffers =
        await getOffersForRequest(
          tablesDB,
          request.$id,
        );

      const existing = existingOffers.find(
        (offer) => offer.driverId === driver.$id,
      );

      const expiresAtCandidate = addMinutes(
        timestamp,
        OFFER_EXPIRY_MINUTES,
      );

      const requestExpiryTime = new Date(
        request.expiresAt || expiresAtCandidate,
      ).getTime();

      const expiresAt =
        requestExpiryTime <
        new Date(expiresAtCandidate).getTime()
          ? new Date(requestExpiryTime).toISOString()
          : expiresAtCandidate;

      const offerData = cleanData({
        requestId: request.$id,
        organizationId: request.organizationId,
        driverId: driver.$id,
        vehicleId: vehicle.$id,
        quotedFare,
        currency,
        estimatedPickupMinutes: Math.round(
          estimatedPickupMinutes,
        ),
        estimatedJourneyMinutes: Math.round(
          estimatedJourneyMinutes,
        ),
        availableSeats: Math.round(availableSeats),
        message: safeOptionalString(
          body.message,
          1000,
        ),
        status: "submitted",
        expiresAt,
        updatedAt: timestamp,
      });

      let offer;

      if (existing) {
        if (
          ["accepted", "declined"].includes(
            effectiveOfferStatus(existing),
          )
        ) {
          throw statusError(
            409,
            `This offer is already ${effectiveOfferStatus(existing)}.`,
          );
        }

        offer = await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.offers,
          rowId: existing.$id,
          data: offerData,
        });
      } else {
        offer = await tablesDB.createRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.offers,
          rowId: ID.unique(),
          data: {
            ...offerData,
            createdAt: timestamp,
          },
        });
      }

      if (request.status === "pending") {
        await tablesDB.updateRow({
          databaseId: DATABASE_ID,
          tableId: TABLES.requests,
          rowId: request.$id,
          data: {
            status: "quoted",
            updatedAt: timestamp,
          },
        });
      }

      return ok(
        res,
        {
          ...offer,
          vehicle: sanitizeVehicleSummary(vehicle),
        },
        existing ? 200 : 201,
      );
    }

    if (
      method === "POST" &&
      parts.length === 4 &&
      parts[0] === "driver" &&
      parts[1] === "offers" &&
      parts[3] === "withdraw"
    ) {
      const driver = await requireDriver();
      const offer = await getOfferOrThrow(
        tablesDB,
        parts[2],
      );

      if (offer.driverId !== driver.$id) {
        throw statusError(
          403,
          "This offer belongs to another driver.",
        );
      }

      if (
        effectiveOfferStatus(offer) !== "submitted"
      ) {
        throw statusError(
          409,
          `A ${effectiveOfferStatus(offer)} offer cannot be withdrawn.`,
        );
      }

      const timestamp = nowIso();

      const updated = await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.offers,
        rowId: offer.$id,
        data: {
          status: "withdrawn",
          updatedAt: timestamp,
        },
      });

      const request = await getRowOrNull(
        tablesDB,
        TABLES.requests,
        offer.requestId,
      );

      if (
        request &&
        request.status === "quoted"
      ) {
        const offers = await getOffersForRequest(
          tablesDB,
          request.$id,
        );

        const remaining = offers.some(
          (item) =>
            item.$id !== offer.$id &&
            effectiveOfferStatus(item) ===
              "submitted",
        );

        if (!remaining) {
          await tablesDB.updateRow({
            databaseId: DATABASE_ID,
            tableId: TABLES.requests,
            rowId: request.$id,
            data: {
              status: "pending",
              updatedAt: timestamp,
            },
          });
        }
      }

      return ok(res, updated);
    }

    return fail(
      res,
      404,
      "Nookly Rides marketplace endpoint not found.",
    );
  } catch (caughtError) {
    error?.(caughtError);

    const statusCode = Number(
      caughtError?.statusCode ||
        (Number(caughtError?.code) >= 400 &&
        Number(caughtError?.code) <= 599
          ? caughtError.code
          : 500),
    );

    const message =
      statusCode >= 500
        ? "The Nookly Rides service could not complete this request."
        : caughtError?.message ||
          "The Nookly Rides request failed.";

    log?.(
      JSON.stringify({
        statusCode,
        message: caughtError?.message,
        code: caughtError?.code,
      }),
    );

    return fail(res, statusCode, message);
  }
};
