import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const installerDirectory = path.dirname(
  fileURLToPath(import.meta.url),
);

const paths = {
  marketplace: path.join(
    root,
    "functions",
    "rides-driver-api",
    "src",
    "marketplace-handler.js",
  ),
  ridePushHelper: path.join(
    root,
    "functions",
    "rides-driver-api",
    "src",
    "ride-push-events.js",
  ),
  helperSource: path.join(
    installerDirectory,
    "patch-files",
    "functions",
    "rides-driver-api",
    "src",
    "ride-push-events.js",
  ),
  ridesPackage: path.join(
    root,
    "functions",
    "rides-driver-api",
    "package.json",
  ),
  rootLayout: path.join(
    root,
    "app",
    "_layout.tsx",
  ),
  driverRides: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "driver-rides.tsx",
  ),
  driverRidesSource: path.join(
    installerDirectory,
    "patch-files",
    "app",
    "(root)",
    "(driver)",
    "driver-rides.tsx",
  ),
};

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const requireFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
};

const backup = (filePath) => {
  const backupPath =
    `${filePath}.driver-rides-push-v1.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const replaceRequired = (
  source,
  search,
  replacement,
  label,
) => {
  if (source.includes(replacement)) {
    return source;
  }

  if (!source.includes(search)) {
    fail(
      `Could not find ${label}. The file differs from the expected current version.`,
    );
  }

  return source.replace(
    search,
    replacement,
  );
};

for (const [label, filePath] of [
  ["Marketplace handler", paths.marketplace],
  ["Rides Function package", paths.ridesPackage],
  ["Root layout", paths.rootLayout],
  ["Driver Rides screen", paths.driverRides],
  ["Ride push helper source", paths.helperSource],
  ["Driver Rides replacement", paths.driverRidesSource],
]) {
  requireFile(filePath, label);
}

[
  paths.marketplace,
  paths.ridesPackage,
  paths.rootLayout,
  paths.driverRides,
].forEach(backup);

fs.mkdirSync(
  path.dirname(paths.ridePushHelper),
  { recursive: true },
);
fs.copyFileSync(
  paths.helperSource,
  paths.ridePushHelper,
);

// ---------------------------------------------------------------------------
// Rides Function: queue verified ride events to Nookly Push API.
// ---------------------------------------------------------------------------

let marketplace = fs.readFileSync(
  paths.marketplace,
  "utf8",
);

if (
  !marketplace.includes(
    'import { queueDriverRidePushEvent } from "./ride-push-events.js";',
  )
) {
  marketplace = replaceRequired(
    marketplace,
    '} from "node-appwrite";\n',
    '} from "node-appwrite";\n' +
      'import { queueDriverRidePushEvent } from "./ride-push-events.js";\n',
    "the node-appwrite import",
  );
}

if (
  !marketplace.includes(
    '"request_created",\n        { requestId: request.$id },',
  )
) {
  marketplace = replaceRequired(
    marketplace,
    '      });\n\n' +
      '      return ok(res, {\n' +
      '        ...request,\n' +
      '        offerCount: 0,\n' +
      '      }, 201);',
    '      });\n\n' +
      '      await queueDriverRidePushEvent(\n' +
      '        client,\n' +
      '        "request_created",\n' +
      '        { requestId: request.$id },\n' +
      '        { log, error },\n' +
      '      );\n\n' +
      '      return ok(res, {\n' +
      '        ...request,\n' +
      '        offerCount: 0,\n' +
      '      }, 201);',
    "the student ride-request creation response",
  );
}

if (
  !marketplace.includes(
    '"request_cancelled",\n        { requestId: updated.$id },',
  )
) {
  marketplace = replaceRequired(
    marketplace,
    '      );\n\n' +
      '      return ok(res, updated);\n' +
      '    }\n\n' +
      '    if (\n' +
      '      method === "POST" &&\n' +
      '      parts.length === 4 &&\n' +
      '      parts[0] === "student" &&\n' +
      '      parts[1] === "requests" &&\n' +
      '      parts[3] === "accept-offer"\n' +
      '    ) {',
    '      );\n\n' +
      '      await queueDriverRidePushEvent(\n' +
      '        client,\n' +
      '        "request_cancelled",\n' +
      '        { requestId: updated.$id },\n' +
      '        { log, error },\n' +
      '      );\n\n' +
      '      return ok(res, updated);\n' +
      '    }\n\n' +
      '    if (\n' +
      '      method === "POST" &&\n' +
      '      parts.length === 4 &&\n' +
      '      parts[0] === "student" &&\n' +
      '      parts[1] === "requests" &&\n' +
      '      parts[3] === "accept-offer"\n' +
      '    ) {',
    "the student ride-request cancellation response",
  );
}

if (
  !marketplace.includes(
    '"offer_accepted",\n        {\n          requestId: result.requestId,',
  )
) {
  marketplace = replaceRequired(
    marketplace,
    '      const result = await confirmOffer(\n' +
      '        tablesDB,\n' +
      '        request,\n' +
      '        offer,\n' +
      '        user,\n' +
      '        accountId,\n' +
      '      );\n\n' +
      '      return ok(res, result);',
    '      const result = await confirmOffer(\n' +
      '        tablesDB,\n' +
      '        request,\n' +
      '        offer,\n' +
      '        user,\n' +
      '        accountId,\n' +
      '      );\n\n' +
      '      await queueDriverRidePushEvent(\n' +
      '        client,\n' +
      '        "offer_accepted",\n' +
      '        {\n' +
      '          requestId: result.requestId,\n' +
      '          offerId: result.offerId,\n' +
      '          rideId: result.rideId,\n' +
      '        },\n' +
      '        { log, error },\n' +
      '      );\n\n' +
      '      return ok(res, result);',
    "the accepted-offer response",
  );
}

fs.writeFileSync(
  paths.marketplace,
  marketplace,
  "utf8",
);

// Keep function source version visible in deployments.
try {
  const packageJson = JSON.parse(
    fs.readFileSync(
      paths.ridesPackage,
      "utf8",
    ).replace(/^\uFEFF/, ""),
  );

  packageJson.version = "2.1.0";

  fs.writeFileSync(
    paths.ridesPackage,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
} catch (caught) {
  fail(
    `Could not update the Rides Function package version: ${
      caught instanceof Error
        ? caught.message
        : String(caught)
    }`,
  );
}

// ---------------------------------------------------------------------------
// Mobile: deep-link driver ride pushes and restore requested Rides section.
// ---------------------------------------------------------------------------

let rootLayout = fs.readFileSync(
  paths.rootLayout,
  "utf8",
);

if (
  !rootLayout.includes(
    'case "driver_ride": {',
  )
) {
  rootLayout = replaceRequired(
    rootLayout,
    '        case "request_response":\n',
    '        case "driver_ride": {\n' +
      '          const rideEvent =\n' +
      '            typeof data.rideEvent === "string"\n' +
      '              ? data.rideEvent\n' +
      '              : "";\n' +
      '          const requestId =\n' +
      '            typeof data.requestId === "string"\n' +
      '              ? data.requestId\n' +
      '              : "";\n\n' +
      '          if (\n' +
      '            rideEvent === "request_created" &&\n' +
      '            requestId\n' +
      '          ) {\n' +
      '            router.push({\n' +
      '              pathname:\n' +
      '                "/rides/driver-request/[requestId]" as any,\n' +
      '              params: { requestId },\n' +
      '            });\n' +
      '            return;\n' +
      '          }\n\n' +
      '          router.push({\n' +
      '            pathname: "/driver-rides" as any,\n' +
      '            params: {\n' +
      '              section:\n' +
      '                rideEvent === "offer_accepted"\n' +
      '                  ? "confirmed"\n' +
      '                  : rideEvent === "request_cancelled"\n' +
      '                    ? "offers"\n' +
      '                    : "requests",\n' +
      '              offerFilter:\n' +
      '                rideEvent === "request_cancelled"\n' +
      '                  ? "closed"\n' +
      '                  : "",\n' +
      '              requestId,\n' +
      '              offerId:\n' +
      '                typeof data.offerId === "string"\n' +
      '                  ? data.offerId\n' +
      '                  : "",\n' +
      '              rideId:\n' +
      '                typeof data.rideId === "string"\n' +
      '                  ? data.rideId\n' +
      '                  : "",\n' +
      '            },\n' +
      '          });\n' +
      '          return;\n' +
      '        }\n\n' +
      '        case "request_response":\n',
    "the root notification navigation switch",
  );
}

fs.writeFileSync(
  paths.rootLayout,
  rootLayout,
  "utf8",
);

fs.copyFileSync(
  paths.driverRidesSource,
  paths.driverRides,
);

// Remove extracted patch payloads after installation.
const patchFilesDirectory = path.join(
  root,
  "patch-files",
);

if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(
    patchFilesDirectory,
    {
      recursive: true,
      force: true,
    },
  );
}

// ---------------------------------------------------------------------------
// Final validation.
// ---------------------------------------------------------------------------

const validation = [
  [
    paths.marketplace,
    'queueDriverRidePushEvent',
  ],
  [
    paths.marketplace,
    '"request_created"',
  ],
  [
    paths.marketplace,
    '"request_cancelled"',
  ],
  [
    paths.marketplace,
    '"offer_accepted"',
  ],
  [
    paths.ridePushHelper,
    'x-nookly-rides-secret',
  ],
  [
    paths.rootLayout,
    'case "driver_ride": {',
  ],
  [
    paths.driverRides,
    'useLocalSearchParams',
  ],
  [
    paths.driverRides,
    'requestedOfferFilter',
  ],
];

for (const [filePath, marker] of validation) {
  const source = fs.readFileSync(
    filePath,
    "utf8",
  );

  if (!source.includes(marker)) {
    fail(
      `Validation failed in ${filePath}: missing ${marker}`,
    );
  }
}

console.log(`
Nookly Driver Rides push integration v1 applied.

Added:
- functions/rides-driver-api/src/ride-push-events.js

Updated:
- functions/rides-driver-api/src/marketplace-handler.js
- functions/rides-driver-api/package.json
- app/_layout.tsx
- app/(root)/(driver)/driver-rides.tsx

Queued driver push events:
- request_created
- request_cancelled
- offer_accepted

Mobile deep links:
- New request -> request quote screen
- Accepted offer -> Confirmed trips
- Cancelled request -> Offers / Closed

Important:
- The Push API v1.5.0 source is included separately in this package.
- Both Appwrite Functions must use the same NOOKLY_RIDES_PUSH_SECRET.
- The Rides Function needs the execution.write dynamic API-key scope.

Next run:
npx tsc --noEmit
`);
