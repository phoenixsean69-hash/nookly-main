export const EXISTING_TABLE_IDS = [
  "ride_drivers",
  "ride_vehicles",
  "ride_routes",
  "ride_stops",
  "rides",
  "ride_bookings",
  "ride_locations",
  "ride_incidents",
  "ride_events",
];

export const NEW_TABLE_IDS = [
  "ride_requests",
  "ride_offers",
  "ride_driver_institutions",
  "ride_safety_alerts",
  "ride_trip_core",
  "ride_trip_waypoints",
  "ride_expected_route_points",
];

export const ALL_RIDES_TABLE_IDS = [
  ...EXISTING_TABLE_IDS,
  ...NEW_TABLE_IDS,
];

const varchar = (
  key,
  size,
  {
    required = false,
    array = false,
    xdefault,
    encrypt = false,
  } = {},
) => ({
  key,
  kind: "varchar",
  size,
  required,
  array,
  xdefault,
  encrypt,
});

const integer = (
  key,
  {
    required = false,
    min,
    max,
    xdefault,
    array = false,
  } = {},
) => ({
  key,
  kind: "integer",
  required,
  min,
  max,
  xdefault,
  array,
});

const float = (
  key,
  {
    required = false,
    min,
    max,
    xdefault,
    array = false,
  } = {},
) => ({
  key,
  kind: "float",
  required,
  min,
  max,
  xdefault,
  array,
});

const boolean = (
  key,
  {
    required = false,
    xdefault,
    array = false,
  } = {},
) => ({
  key,
  kind: "boolean",
  required,
  xdefault,
  array,
});

const datetime = (
  key,
  {
    required = false,
    xdefault,
    array = false,
  } = {},
) => ({
  key,
  kind: "datetime",
  required,
  xdefault,
  array,
});

const keyIndex = (key, columns, orders = columns.map(() => "ASC")) => ({
  key,
  type: "key",
  columns,
  orders,
});

const uniqueIndex = (
  key,
  columns,
  orders = columns.map(() => "ASC"),
) => ({
  key,
  type: "unique",
  columns,
  orders,
});

export const TABLE_SCHEMAS = {
  ride_requests: {
    name: "Ride Requests",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("organizationId", 36, { required: true }),
      varchar("studentId", 36, { required: true }),
      varchar("studentName", 128, { required: true }),
      varchar("studentPhone", 32),
      varchar("pickupAddress", 255, { required: true }),
      float("pickupLatitude", {
        required: true,
        min: -90,
        max: 90,
      }),
      float("pickupLongitude", {
        required: true,
        min: -180,
        max: 180,
      }),
      varchar("destinationAddress", 255, { required: true }),
      float("destinationLatitude", {
        required: true,
        min: -90,
        max: 90,
      }),
      float("destinationLongitude", {
        required: true,
        min: -180,
        max: 180,
      }),
      integer("passengerCount", {
        required: true,
        min: 1,
        max: 10,
      }),
      datetime("requestedDepartureTime", { required: true }),
      varchar("ridePreference", 32, { required: true }),
      float("proposedBudget", { min: 0 }),
      varchar("currency", 8, { required: true }),
      varchar("notes", 1000),
      varchar("status", 32, { required: true }),
      varchar("selectedDriverId", 36),
      varchar("selectedOfferId", 36),
      datetime("expiresAt"),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      keyIndex(
        "requests_org_status_created",
        ["organizationId", "status", "createdAt"],
      ),
      keyIndex(
        "requests_student_status",
        ["studentId", "status", "createdAt"],
      ),
      keyIndex(
        "requests_status_departure",
        ["status", "requestedDepartureTime"],
      ),
      keyIndex(
        "requests_selected_driver",
        ["selectedDriverId", "status"],
      ),
    ],
  },

  ride_offers: {
    name: "Ride Offers",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("requestId", 36, { required: true }),
      varchar("organizationId", 36, { required: true }),
      varchar("driverId", 36, { required: true }),
      varchar("vehicleId", 36, { required: true }),
      float("quotedFare", { required: true, min: 0 }),
      varchar("currency", 8, { required: true }),
      integer("estimatedPickupMinutes", {
        required: true,
        min: 0,
      }),
      integer("estimatedJourneyMinutes", {
        required: true,
        min: 1,
      }),
      integer("availableSeats", {
        required: true,
        min: 1,
        max: 200,
      }),
      varchar("message", 1000),
      varchar("status", 32, { required: true }),
      datetime("expiresAt", { required: true }),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      keyIndex(
        "offers_request_status",
        ["requestId", "status", "createdAt"],
      ),
      keyIndex(
        "offers_driver_status",
        ["driverId", "status", "createdAt"],
      ),
      keyIndex(
        "offers_org_status",
        ["organizationId", "status", "createdAt"],
      ),
    ],
  },

  ride_driver_institutions: {
    name: "Ride Driver Institutions",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("driverId", 36, { required: true }),
      varchar("organizationId", 36, { required: true }),
      varchar("status", 32, { required: true }),
      varchar("verifiedBy", 36),
      datetime("acknowledgedAt"),
      datetime("verifiedAt"),
      datetime("suspendedAt"),
      varchar("notes", 2000),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      uniqueIndex(
        "driver_institution_unique",
        ["driverId", "organizationId"],
      ),
      keyIndex(
        "driver_institution_org",
        ["organizationId", "status"],
      ),
      keyIndex(
        "driver_institution_driver",
        ["driverId", "status"],
      ),
    ],
  },

  ride_safety_alerts: {
    name: "Ride Safety Alerts",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("rideId", 36, { required: true }),
      varchar("bookingId", 36),
      varchar("studentId", 36),
      varchar("driverId", 36, { required: true }),
      varchar("organizationId", 36, { required: true }),
      varchar("alertType", 64, { required: true }),
      varchar("severity", 32, { required: true }),
      float("expectedLatitude", { min: -90, max: 90 }),
      float("expectedLongitude", { min: -180, max: 180 }),
      float("actualLatitude", {
        required: true,
        min: -90,
        max: 90,
      }),
      float("actualLongitude", {
        required: true,
        min: -180,
        max: 180,
      }),
      float("distanceFromRouteMeters", { min: 0 }),
      integer("deviationDurationSeconds", { min: 0 }),
      varchar("status", 32, { required: true }),
      varchar("driverExplanation", 2000),
      varchar("studentResponse", 2000),
      datetime("detectedAt", { required: true }),
      datetime("acknowledgedAt"),
      datetime("resolvedAt"),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      keyIndex(
        "alerts_org_status_detected",
        ["organizationId", "status", "detectedAt"],
      ),
      keyIndex("alerts_ride_detected", ["rideId", "detectedAt"]),
      keyIndex(
        "alerts_student_status",
        ["studentId", "status", "detectedAt"],
      ),
      keyIndex(
        "alerts_driver_status",
        ["driverId", "status", "detectedAt"],
      ),
    ],
  },

  ride_trip_core: {
    name: "Ride Trip Core",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("rideId", 36, { required: true }),
      varchar("requestId", 36),
      varchar("offerId", 36),
      varchar("studentId", 36, { required: true }),
      varchar("organizationId", 36, { required: true }),
      varchar("rideType", 32, { required: true }),
      integer("passengerCount", {
        required: true,
        min: 1,
        max: 200,
      }),
      float("expectedDistanceKm", { min: 0 }),
      integer("expectedDurationMinutes", { min: 0 }),
      integer("routeCorridorMeters", {
        min: 25,
        max: 10000,
        xdefault: 300,
      }),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      uniqueIndex("trip_core_ride", ["rideId"]),
      keyIndex("trip_core_request", ["requestId", "createdAt"]),
      keyIndex("trip_core_student", ["studentId", "createdAt"]),
      keyIndex(
        "trip_core_org_type",
        ["organizationId", "rideType", "createdAt"],
      ),
    ],
  },

  ride_trip_waypoints: {
    name: "Ride Trip Waypoints",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("rideId", 36, { required: true }),
      varchar("organizationId", 36, { required: true }),
      varchar("waypointType", 32, { required: true }),
      varchar("address", 255, { required: true }),
      float("latitude", {
        required: true,
        min: -90,
        max: 90,
      }),
      float("longitude", {
        required: true,
        min: -180,
        max: 180,
      }),
      integer("stopOrder", {
        required: true,
        min: 0,
        max: 1000,
      }),
      datetime("createdAt", { required: true }),
      datetime("updatedAt", { required: true }),
    ],
    indexes: [
      uniqueIndex(
        "trip_waypoint_unique",
        ["rideId", "waypointType", "stopOrder"],
      ),
      keyIndex(
        "trip_waypoints_ride",
        ["rideId", "stopOrder"],
      ),
      keyIndex(
        "trip_waypoints_org",
        ["organizationId", "createdAt"],
      ),
    ],
  },

  ride_expected_route_points: {
    name: "Ride Expected Route Points",
    rowSecurity: true,
    permissions: [],
    columns: [
      varchar("rideId", 36, { required: true }),
      integer("sequence", {
        required: true,
        min: 0,
      }),
      float("latitude", {
        required: true,
        min: -90,
        max: 90,
      }),
      float("longitude", {
        required: true,
        min: -180,
        max: 180,
      }),
      datetime("createdAt", { required: true }),
    ],
    indexes: [
      uniqueIndex(
        "expected_route_ride_sequence",
        ["rideId", "sequence"],
      ),
      keyIndex(
        "expected_route_ride_created",
        ["rideId", "createdAt"],
      ),
    ],
  },


};

export const EXISTING_TABLE_ADDITIONS = {
  ride_drivers: {
    columns: [
      varchar("serviceAreas", 255, { array: true }),
      boolean("acceptsPrivateRides"),
      boolean("acceptsSharedRides"),
      varchar("pricingModel", 32),
      float("baseFare", { min: 0 }),
      float("pricePerKm", { min: 0 }),
      float("maxPickupDistanceKm", { min: 0 }),
      varchar("availabilityNote", 500),
    ],
    indexes: [
      keyIndex("drivers_online_status", ["isOnline", "status"]),
      keyIndex(
        "drivers_private_status",
        ["acceptsPrivateRides", "status"],
      ),
      keyIndex(
        "drivers_shared_status",
        ["acceptsSharedRides", "status"],
      ),
    ],
  },

  ride_vehicles: {
    columns: [
      varchar("vehicleType", 32),
      integer("manufactureYear", { min: 1900, max: 2200 }),
      integer("numberOfDoors", { min: 1, max: 10 }),
      integer("passengerCapacity", { min: 1, max: 200 }),
      integer("availableSeats", { min: 0, max: 200 }),
      varchar("conditionStatus", 32),
      varchar("roadworthinessStatus", 32),
      varchar("insuranceProvider", 128),
      varchar("insurancePolicyNumber", 128),
      datetime("licenceDiskExpiry"),
      varchar("fitnessCertificateNumber", 128),
      boolean("hasSeatbelts"),
      boolean("hasAirConditioning"),
      boolean("allowsLuggage"),
      boolean("allowsSharedRides"),
      datetime("lastInspectionAt"),
    ],
    indexes: [
      keyIndex(
        "vehicles_driver_condition",
        ["driverId", "conditionStatus"],
      ),
      keyIndex(
        "vehicles_shared_status",
        ["allowsSharedRides", "status"],
      ),
    ],
  },

  rides: {
    // The legacy rides table has reached Appwrite's supported column/row-size
    // limit. V2-only journey data lives in compact extension tables.
    columns: [],
    indexes: [],
  },

  ride_bookings: {
    columns: [
      varchar("requestId", 36),
      varchar("offerId", 36),
      varchar("pickupAddress", 255),
      float("pickupLatitude", { min: -90, max: 90 }),
      float("pickupLongitude", { min: -180, max: 180 }),
      varchar("destinationAddress", 255),
      float("destinationLatitude", { min: -90, max: 90 }),
      float("destinationLongitude", { min: -180, max: 180 }),
      integer("passengerCount", { min: 1, max: 10 }),
      datetime("trackingStartedAt"),
      datetime("trackingEndedAt"),
    ],
    indexes: [
      keyIndex(
        "bookings_request_student",
        ["requestId", "studentId"],
      ),
      keyIndex("bookings_offer_status", ["offerId", "status"]),
      keyIndex(
        "bookings_tracking",
        ["studentId", "status", "trackingStartedAt"],
      ),
    ],
  },

  ride_locations: {
    columns: [
      varchar("bookingId", 36),
      varchar("studentId", 36),
      varchar("organizationId", 36),
    ],
    indexes: [
      keyIndex(
        "locations_booking_recorded",
        ["bookingId", "recordedAt"],
      ),
      keyIndex(
        "locations_student_recorded",
        ["studentId", "recordedAt"],
      ),
      keyIndex(
        "locations_org_recorded",
        ["organizationId", "recordedAt"],
      ),
    ],
  },

  ride_incidents: {
    columns: [
      varchar("bookingId", 36),
      varchar("studentId", 36),
      varchar("driverId", 36),
      varchar("alertId", 36),
    ],
    indexes: [
      keyIndex(
        "incidents_student_created",
        ["studentId", "createdAt"],
      ),
      keyIndex(
        "incidents_driver_created",
        ["driverId", "createdAt"],
      ),
      keyIndex("incidents_alert", ["alertId"]),
    ],
  },

  ride_events: {
    columns: [
      varchar("requestId", 36),
      varchar("offerId", 36),
      varchar("bookingId", 36),
      varchar("studentId", 36),
      varchar("driverId", 36),
    ],
    indexes: [
      keyIndex("events_request_created", ["requestId", "createdAt"]),
      keyIndex("events_offer_created", ["offerId", "createdAt"]),
      keyIndex(
        "events_booking_created",
        ["bookingId", "createdAt"],
      ),
    ],
  },
};

export const REQUIRED_FLAG_CHANGES = [
  {
    tableId: "ride_drivers",
    key: "organizationId",
    required: false,
    reason:
      "Drivers are independent providers; institutions recognise them through ride_driver_institutions.",
  },
  {
    tableId: "ride_vehicles",
    key: "organizationId",
    required: false,
    reason:
      "Vehicles are controlled by drivers rather than owned by one institution.",
  },
  {
    tableId: "ride_vehicles",
    key: "driverId",
    required: true,
    reason:
      "A vehicle must belong to the independent driver controlling it.",
  },
  {
    tableId: "rides",
    key: "schoolLocation",
    required: false,
    reason:
      "A direct student-requested ride is not limited to a university-created school route.",
  },
  {
    tableId: "rides",
    key: "routeId",
    required: false,
    reason:
      "Direct rides use pickup and destination coordinates; routes remain optional for shared trips.",
  },
  {
    tableId: "ride_bookings",
    key: "pickupStopId",
    required: false,
    reason:
      "Direct rides use pickup coordinates instead of a predefined route stop.",
  },
  {
    tableId: "ride_bookings",
    key: "dropoffStopId",
    required: false,
    reason:
      "Direct rides use destination coordinates instead of a predefined route stop.",
  },
];
