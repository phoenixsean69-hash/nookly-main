import { Client, Databases, Query, TablesDB } from "node-appwrite";

const env = (name, fallback = "") =>
  String(process.env[name] ?? fallback).trim();

const DATABASE_ID = env(
  "APPWRITE_DATABASE_ID",
  env("EXPO_PUBLIC_APPWRITE_DATABASE_ID"),
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
};

const VERIFIED_RELATIONSHIP_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

const ok = (res, data, status = 200) =>
  res.json({ ok: true, data }, status);

const fail = (res, status, message) =>
  res.json({ ok: false, error: message }, status);

const getHeader = (req, name) =>
  String(req.headers?.[name.toLowerCase()] ?? "").trim();

const chunk = (values, size = 100) => {
  const result = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
};

async function listRowsByValues(tables, tableId, field, values) {
  const unique = [...new Set(values.map(String).map((v) => v.trim()).filter(Boolean))];
  if (unique.length === 0) return [];

  const responses = await Promise.all(
    chunk(unique).map((batch) =>
      tables.listRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [Query.equal(field, batch), Query.limit(500)],
      }),
    ),
  );

  return responses.flatMap((response) =>
    Array.isArray(response.rows) ? response.rows : [],
  );
}

async function findOrganizationForAccount(databases, accountId) {
  for (const attribute of ["userId", "accountId", "ownerId", "creatorId"]) {
    try {
      const result = await databases.listDocuments({
        databaseId: DATABASE_ID,
        collectionId: ORGANIZATIONS_COLLECTION_ID,
        queries: [Query.equal(attribute, accountId), Query.limit(1)],
      });

      if (result.documents?.[0]) return result.documents[0];
    } catch (caught) {
      const status = Number(caught?.code ?? caught?.statusCode ?? 0);
      if (status !== 400 && status !== 404) throw caught;
    }
  }

  try {
    return await databases.getDocument({
      databaseId: DATABASE_ID,
      collectionId: ORGANIZATIONS_COLLECTION_ID,
      documentId: accountId,
    });
  } catch {
    return null;
  }
}

function newestRelationshipByDriver(relationships) {
  const map = new Map();

  for (const relationship of relationships) {
    const driverId = String(relationship?.driverId ?? "").trim();
    if (!driverId) continue;

    const current = map.get(driverId);
    if (!current) {
      map.set(driverId, relationship);
      continue;
    }

    const currentTime = new Date(
      current.$updatedAt ?? current.updatedAt ?? current.$createdAt ?? current.createdAt ?? 0,
    ).getTime();

    const nextTime = new Date(
      relationship.$updatedAt ??
        relationship.updatedAt ??
        relationship.$createdAt ??
        relationship.createdAt ??
        0,
    ).getTime();

    if (nextTime >= currentTime) map.set(driverId, relationship);
  }

  return map;
}

function choosePrimaryVehicle(vehicles) {
  if (vehicles.length === 0) return null;

  return (
    vehicles.find((vehicle) => normalize(vehicle.status) === "active") ??
    vehicles
      .slice()
      .sort(
        (left, right) =>
          new Date(right.$updatedAt ?? right.updatedAt ?? right.$createdAt ?? 0).getTime() -
          new Date(left.$updatedAt ?? left.updatedAt ?? left.$createdAt ?? 0).getTime(),
      )[0] ??
    null
  );
}

function buildRequirements(driver, primaryVehicle) {
  const hasDriverLicence = Boolean(
    String(driver?.driverLicenceFileId ?? "").trim(),
  );
  const hasNationalId = Boolean(
    String(driver?.nationalIdFileId ?? "").trim(),
  );
  const hasVehicle = Boolean(primaryVehicle);
  const hasCompleteVehicleImages = Boolean(
    primaryVehicle &&
      String(primaryVehicle.frontImageFileId ?? "").trim() &&
      String(primaryVehicle.sideImageFileId ?? "").trim() &&
      String(primaryVehicle.backImageFileId ?? "").trim(),
  );

  return {
    hasDriverLicence,
    hasNationalId,
    hasCompleteVehicleImages,
    hasVehicle,
    readyForApproval:
      hasDriverLicence &&
      hasNationalId &&
      hasCompleteVehicleImages &&
      hasVehicle,
  };
}

function isMarketplaceReady(driver, relationship, vehicles) {
  return (
    normalize(driver?.status) === "active" &&
    normalize(driver?.verificationStatus) === "verified" &&
    VERIFIED_RELATIONSHIP_STATUSES.has(normalize(relationship?.status)) &&
    vehicles.some(
      (vehicle) =>
        normalize(vehicle?.status) === "active" &&
        Boolean(String(vehicle?.frontImageFileId ?? "").trim()) &&
        Boolean(String(vehicle?.sideImageFileId ?? "").trim()) &&
        Boolean(String(vehicle?.backImageFileId ?? "").trim()),
    )
  );
}

export default async ({ req, res, log, error }) => {
  const startedAt = Date.now();

  try {
    if (!DATABASE_ID || !ORGANIZATIONS_COLLECTION_ID) {
      return fail(res, 500, "Driver review configuration is incomplete.");
    }

    const accountId = getHeader(req, "x-appwrite-user-id");
    if (!accountId) {
      return fail(res, 401, "Sign in with an organization account to continue.");
    }

    const client = new Client()
      .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
      .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
      .setKey(getHeader(req, "x-appwrite-key"));

    const databases = new Databases(client);
    const tables = new TablesDB(client);

    const organization = await findOrganizationForAccount(databases, accountId);
    if (!organization) {
      return fail(res, 403, "No Nookly organization is linked to this account.");
    }

    const organizationId = String(organization.$id ?? "").trim();

    const relationshipResult = await tables.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.driverInstitutions,
      queries: [Query.equal("organizationId", organizationId), Query.limit(500)],
    });

    const relationships = Array.isArray(relationshipResult.rows)
      ? relationshipResult.rows
      : [];

    const relationshipByDriver = newestRelationshipByDriver(relationships);
    const driverIds = [...relationshipByDriver.keys()];

    if (driverIds.length === 0) {
      log?.(
        JSON.stringify({
          event: "organization-drivers-fast",
          organizationId,
          relationshipCount: 0,
          driverCount: 0,
          vehicleCount: 0,
          durationMs: Date.now() - startedAt,
        }),
      );
      return ok(res, []);
    }

    const [drivers, vehicles] = await Promise.all([
      listRowsByValues(tables, TABLES.drivers, "$id", driverIds),
      listRowsByValues(tables, TABLES.vehicles, "driverId", driverIds),
    ]);

    const vehiclesByDriver = new Map();
    for (const vehicle of vehicles) {
      const driverId = String(vehicle?.driverId ?? "").trim();
      if (!driverId) continue;
      const list = vehiclesByDriver.get(driverId) ?? [];
      list.push(vehicle);
      vehiclesByDriver.set(driverId, list);
    }

    const applications = drivers
      .map((driver) => {
        const driverId = String(driver?.$id ?? "").trim();
        const institution = relationshipByDriver.get(driverId);
        if (!institution) return null;

        const driverVehicles = vehiclesByDriver.get(driverId) ?? [];
        const primaryVehicle = choosePrimaryVehicle(driverVehicles);

        return {
          profile: driver,
          institution,
          vehicles: driverVehicles,
          primaryVehicle,
          requirements: buildRequirements(driver, primaryVehicle),
          marketplaceReady: isMarketplaceReady(
            driver,
            institution,
            driverVehicles,
          ),
        };
      })
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = new Date(
          left.profile?.documentsSubmittedAt ??
            left.institution?.$createdAt ??
            left.profile?.$createdAt ??
            0,
        ).getTime();

        const rightTime = new Date(
          right.profile?.documentsSubmittedAt ??
            right.institution?.$createdAt ??
            right.profile?.$createdAt ??
            0,
        ).getTime();

        return rightTime - leftTime;
      });

    log?.(
      JSON.stringify({
        event: "organization-drivers-fast",
        organizationId,
        relationshipCount: relationships.length,
        driverCount: drivers.length,
        vehicleCount: vehicles.length,
        applicationCount: applications.length,
        durationMs: Date.now() - startedAt,
      }),
    );

    return ok(res, applications);
  } catch (caught) {
    const status = Number(caught?.statusCode ?? caught?.code ?? 500);
    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to load driver applications.";

    error?.(
      JSON.stringify({
        event: "organization-drivers-fast-error",
        status,
        message,
        durationMs: Date.now() - startedAt,
      }),
    );

    return fail(
      res,
      status >= 400 && status <= 599 ? status : 500,
      message,
    );
  }
};
