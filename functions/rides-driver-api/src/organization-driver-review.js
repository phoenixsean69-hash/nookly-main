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
  rides: env(
    "APPWRITE_RIDES_TABLE_ID",
    env("EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID", "rides"),
  ),
};

const VERIFIED_RELATIONSHIP_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const ACTIVE_RIDE_STATUSES = new Set([
  "boarding",
  "active",
  "delayed",
]);

const normalize = (value) =>
  String(value ?? "").trim().toLowerCase();

const ok = (res, data, status = 200) =>
  res.json({ ok: true, data }, status);

const fail = (res, status, message) =>
  res.json({ ok: false, error: message }, status);

const getHeader = (req, name) =>
  String(req.headers?.[name.toLowerCase()] ?? "").trim();

const parseBody = (req) => {
  const text =
    typeof req.bodyText === "string"
      ? req.bodyText.trim()
      : "";

  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

const nowIso = () =>
  new Date().toISOString();

async function findOrganizationForAccount(
  databases,
  accountId,
) {
  for (const attribute of [
    "userId",
    "accountId",
    "ownerId",
    "creatorId",
  ]) {
    try {
      const result =
        await databases.listDocuments({
          databaseId: DATABASE_ID,
          collectionId:
            ORGANIZATIONS_COLLECTION_ID,
          queries: [
            Query.equal(
              attribute,
              accountId,
            ),
            Query.limit(1),
          ],
        });

      if (result.documents?.[0]) {
        return result.documents[0];
      }
    } catch (caught) {
      const status =
        Number(
          caught?.code ??
            caught?.statusCode ??
            0,
        );

      if (
        status !== 400 &&
        status !== 404
      ) {
        throw caught;
      }
    }
  }

  try {
    return await databases.getDocument({
      databaseId: DATABASE_ID,
      collectionId:
        ORGANIZATIONS_COLLECTION_ID,
      documentId: accountId,
    });
  } catch {
    return null;
  }
}

function newestRow(rows) {
  return (
    rows
      .slice()
      .sort(
        (left, right) =>
          new Date(
            right.$updatedAt ??
              right.updatedAt ??
              right.$createdAt ??
              right.createdAt ??
              0,
          ).getTime() -
          new Date(
            left.$updatedAt ??
              left.updatedAt ??
              left.$createdAt ??
              left.createdAt ??
              0,
          ).getTime(),
      )[0] ?? null
  );
}

function choosePrimaryVehicle(vehicles) {
  if (vehicles.length === 0) {
    return null;
  }

  return (
    vehicles.find(
      (vehicle) =>
        normalize(vehicle.status) ===
        "active",
    ) ??
    newestRow(vehicles)
  );
}

function buildRequirements(
  driver,
  primaryVehicle,
) {
  const hasDriverLicence =
    Boolean(
      String(
        driver?.driverLicenceFileId ??
          "",
      ).trim(),
    );

  const hasNationalId =
    Boolean(
      String(
        driver?.nationalIdFileId ??
          "",
      ).trim(),
    );

  const hasVehicle =
    Boolean(primaryVehicle);

  const hasCompleteVehicleImages =
    Boolean(
      primaryVehicle &&
        String(
          primaryVehicle
            .frontImageFileId ??
            "",
        ).trim() &&
        String(
          primaryVehicle
            .sideImageFileId ??
            "",
        ).trim() &&
        String(
          primaryVehicle
            .backImageFileId ??
            "",
        ).trim(),
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

function marketplaceReady(
  driver,
  relationship,
  vehicles,
) {
  return (
    normalize(driver?.status) ===
      "active" &&
    normalize(
      driver?.verificationStatus,
    ) === "verified" &&
    VERIFIED_RELATIONSHIP_STATUSES.has(
      normalize(
        relationship?.status,
      ),
    ) &&
    vehicles.some(
      (vehicle) =>
        normalize(
          vehicle?.status,
        ) === "active" &&
        Boolean(
          String(
            vehicle
              ?.frontImageFileId ??
              "",
          ).trim(),
        ) &&
        Boolean(
          String(
            vehicle
              ?.sideImageFileId ??
              "",
          ).trim(),
        ) &&
        Boolean(
          String(
            vehicle
              ?.backImageFileId ??
              "",
          ).trim(),
        ),
    )
  );
}

function buildApplication(
  driver,
  relationship,
  vehicles,
) {
  const primaryVehicle =
    choosePrimaryVehicle(
      vehicles,
    );

  return {
    profile: driver,
    institution: relationship,
    vehicles,
    primaryVehicle,
    requirements:
      buildRequirements(
        driver,
        primaryVehicle,
      ),
    marketplaceReady:
      marketplaceReady(
        driver,
        relationship,
        vehicles,
      ),
  };
}

async function loadOwnedApplication({
  tables,
  organizationId,
  driverId,
}) {
  let driver;

  try {
    driver =
      await tables.getRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.drivers,
        rowId: driverId,
      });
  } catch (caught) {
    const status =
      Number(
        caught?.code ??
          caught?.statusCode ??
          0,
      );

    if (
      status === 404
    ) {
      const error =
        new Error(
          "Driver application was not found.",
        );

      error.statusCode = 404;
      throw error;
    }

    throw caught;
  }

  const [
    relationshipsResult,
    vehiclesResult,
  ] =
    await Promise.all([
      tables.listRows({
        databaseId:
          DATABASE_ID,
        tableId:
          TABLES.driverInstitutions,
        queries: [
          Query.equal(
            "organizationId",
            organizationId,
          ),
          Query.equal(
            "driverId",
            driverId,
          ),
          Query.limit(50),
        ],
      }),
      tables.listRows({
        databaseId:
          DATABASE_ID,
        tableId:
          TABLES.vehicles,
        queries: [
          Query.equal(
            "driverId",
            driverId,
          ),
          Query.limit(100),
        ],
      }),
    ]);

  const relationships =
    Array.isArray(
      relationshipsResult.rows,
    )
      ? relationshipsResult.rows
      : [];

  const relationship =
    newestRow(
      relationships,
    );

  if (!relationship) {
    const error =
      new Error(
        "This driver did not apply to your organization.",
      );

    error.statusCode = 404;
    throw error;
  }

  const vehicles =
    Array.isArray(
      vehiclesResult.rows,
    )
      ? vehiclesResult.rows
      : [];

  return buildApplication(
    driver,
    relationship,
    vehicles,
  );
}

async function bestEffortUpdate(
  tables,
  {
    tableId,
    rowId,
    data,
  },
) {
  try {
    return await tables.updateRow({
      databaseId: DATABASE_ID,
      tableId,
      rowId,
      data,
    });
  } catch {
    return null;
  }
}

async function approveApplication({
  tables,
  organizationId,
  accountId,
  driverId,
}) {
  const before =
    await loadOwnedApplication({
      tables,
      organizationId,
      driverId,
    });

  if (
    normalize(
      before.institution.status,
    ) === "suspended"
  ) {
    const error =
      new Error(
        "Reinstate this driver before approving the application.",
      );

    error.statusCode = 409;
    throw error;
  }

  if (
    !before.requirements
      .readyForApproval
  ) {
    const error =
      new Error(
        "The driver has not submitted all required documents and vehicle images.",
      );

    error.statusCode = 409;
    throw error;
  }

  const timestamp = nowIso();

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.drivers,
    rowId: driverId,
    data: {
      verificationStatus:
        "verified",
      status: "active",
      updatedAt: timestamp,
    },
  });

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId:
      TABLES.driverInstitutions,
    rowId:
      before.institution.$id,
    data: {
      status: "approved",
      verifiedBy:
        accountId,
      verifiedAt:
        timestamp,
      acknowledgedAt:
        before.institution
          .acknowledgedAt ||
        timestamp,
      updatedAt:
        timestamp,
    },
  });

  await Promise.all(
    before.vehicles.map(
      async (vehicle) => {
        await tables.updateRow({
          databaseId:
            DATABASE_ID,
          tableId:
            TABLES.vehicles,
          rowId:
            vehicle.$id,
          data: {
            status:
              "active",
            conditionStatus:
              "approved",
            roadworthinessStatus:
              "approved",
            lastInspectionAt:
              timestamp,
            updatedAt:
              timestamp,
          },
        });
      },
    ),
  );

  return loadOwnedApplication({
    tables,
    organizationId,
    driverId,
  });
}

async function suspendApplication({
  tables,
  organizationId,
  accountId,
  driverId,
  reason,
}) {
  const normalizedReason =
    String(reason ?? "").trim();

  if (
    normalizedReason.length < 5
  ) {
    const error =
      new Error(
        "Enter a suspension reason of at least 5 characters.",
      );

    error.statusCode = 400;
    throw error;
  }

  if (
    normalizedReason.length > 500
  ) {
    const error =
      new Error(
        "The suspension reason must be 500 characters or fewer.",
      );

    error.statusCode = 400;
    throw error;
  }

  const before =
    await loadOwnedApplication({
      tables,
      organizationId,
      driverId,
    });

  const timestamp = nowIso();

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId:
      TABLES.driverInstitutions,
    rowId:
      before.institution.$id,
    data: {
      status:
        "suspended",
      suspendedAt:
        timestamp,
      suspendedBy:
        accountId,
      suspensionReason:
        normalizedReason,
      updatedAt:
        timestamp,
    },
  });

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.drivers,
    rowId: driverId,
    data: {
      status:
        "suspended",
      isOnline:
        false,
      updatedAt:
        timestamp,
    },
  });

  /*
   * Driver-profile suspension metadata exists in some schema versions.
   * Store it when available without making suspension depend on it.
   */
  await bestEffortUpdate(
    tables,
    {
      tableId:
        TABLES.drivers,
      rowId:
        driverId,
      data: {
        suspensionReason:
          normalizedReason,
        suspendedAt:
          timestamp,
        suspendedBy:
          accountId,
      },
    },
  );

  let activeRideContinues =
    false;

  let activeRideId;

  const currentRideId =
    String(
      before.profile
        ?.currentRideId ??
        "",
    ).trim();

  if (currentRideId) {
    try {
      const ride =
        await tables.getRow({
          databaseId:
            DATABASE_ID,
          tableId:
            TABLES.rides,
          rowId:
            currentRideId,
        });

      if (
        ACTIVE_RIDE_STATUSES.has(
          normalize(
            ride?.status,
          ),
        )
      ) {
        activeRideContinues =
          true;
        activeRideId =
          currentRideId;
      }
    } catch {
      // A stale currentRideId must not block suspension.
    }
  }

  const application =
    await loadOwnedApplication({
      tables,
      organizationId,
      driverId,
    });

  return {
    application,
    activeRideContinues,
    ...(activeRideId
      ? { activeRideId }
      : {}),
  };
}

async function reinstateApplication({
  tables,
  organizationId,
  driverId,
}) {
  const before =
    await loadOwnedApplication({
      tables,
      organizationId,
      driverId,
    });

  if (
    normalize(
      before.institution.status,
    ) !== "suspended"
  ) {
    return before;
  }

  const timestamp = nowIso();

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId:
      TABLES.driverInstitutions,
    rowId:
      before.institution.$id,
    data: {
      status:
        "approved",
      updatedAt:
        timestamp,
    },
  });

  await tables.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.drivers,
    rowId: driverId,
    data: {
      verificationStatus:
        "verified",
      status:
        "active",
      isOnline:
        false,
      updatedAt:
        timestamp,
    },
  });

  /*
   * Clear optional historical suspension fields when the live schema
   * allows nullable values. Core reinstatement has already succeeded.
   */
  await bestEffortUpdate(
    tables,
    {
      tableId:
        TABLES.drivers,
      rowId:
        driverId,
      data: {
        suspensionReason:
          null,
        suspendedAt:
          null,
        suspendedBy:
          null,
      },
    },
  );

  return loadOwnedApplication({
    tables,
    organizationId,
    driverId,
  });
}

export default async ({
  req,
  res,
  log,
  error,
}) => {
  const startedAt =
    Date.now();

  try {
    if (
      !DATABASE_ID ||
      !ORGANIZATIONS_COLLECTION_ID
    ) {
      return fail(
        res,
        500,
        "Driver review configuration is incomplete.",
      );
    }

    const accountId =
      getHeader(
        req,
        "x-appwrite-user-id",
      );

    if (!accountId) {
      return fail(
        res,
        401,
        "Sign in with an organization account to continue.",
      );
    }

    const client =
      new Client()
        .setEndpoint(
          process.env
            .APPWRITE_FUNCTION_API_ENDPOINT,
        )
        .setProject(
          process.env
            .APPWRITE_FUNCTION_PROJECT_ID,
        )
        .setKey(
          getHeader(
            req,
            "x-appwrite-key",
          ),
        );

    const databases =
      new Databases(client);

    const tables =
      new TablesDB(client);

    const organization =
      await findOrganizationForAccount(
        databases,
        accountId,
      );

    if (!organization) {
      return fail(
        res,
        403,
        "No Nookly organization is linked to this account.",
      );
    }

    const organizationId =
      String(
        organization.$id ??
          "",
      ).trim();

    const path =
      String(
        req.path ?? "/",
      ).replace(
        /\/+$/,
        "",
      ) || "/";

    const method =
      String(
        req.method ?? "GET",
      ).toUpperCase();

    const match =
      path.match(
        /^\/organization\/drivers\/([^/]+)(?:\/(approve|suspend|reinstate))?$/,
      );

    if (!match) {
      return fail(
        res,
        404,
        "Organization driver-review route not found.",
      );
    }

    const driverId =
      decodeURIComponent(
        match[1],
      ).trim();

    const action =
      match[2] ?? "";

    if (!driverId) {
      return fail(
        res,
        400,
        "Driver ID is required.",
      );
    }

    let result;

    if (
      method === "GET" &&
      !action
    ) {
      result =
        await loadOwnedApplication({
          tables,
          organizationId,
          driverId,
        });
    } else if (
      method === "POST" &&
      action === "approve"
    ) {
      result =
        await approveApplication({
          tables,
          organizationId,
          accountId,
          driverId,
        });
    } else if (
      method === "POST" &&
      action === "suspend"
    ) {
      const body =
        parseBody(req);

      result =
        await suspendApplication({
          tables,
          organizationId,
          accountId,
          driverId,
          reason:
            body.reason,
        });
    } else if (
      method === "POST" &&
      action === "reinstate"
    ) {
      result =
        await reinstateApplication({
          tables,
          organizationId,
          driverId,
        });
    } else {
      return fail(
        res,
        405,
        "Method not allowed for this organization driver-review route.",
      );
    }

    log?.(
      JSON.stringify({
        event:
          "organization-driver-review",
        method,
        action:
          action || "detail",
        organizationId,
        driverId,
        durationMs:
          Date.now() -
          startedAt,
      }),
    );

    return ok(
      res,
      result,
    );
  } catch (caught) {
    const status =
      Number(
        caught?.statusCode ??
          caught?.code ??
          500,
      );

    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to process driver review.";

    error?.(
      JSON.stringify({
        event:
          "organization-driver-review-error",
        status,
        message,
        durationMs:
          Date.now() -
          startedAt,
      }),
    );

    return fail(
      res,
      status >= 400 &&
        status <= 599
        ? status
        : 500,
      message,
    );
  }
};
