import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const installerDirectory = path.dirname(fileURLToPath(import.meta.url));

const paths = {
  service: path.join(root, "lib", "driverRealtimeSync.ts"),
  serviceSource: path.join(
    installerDirectory,
    "patch-files",
    "lib",
    "driverRealtimeSync.ts",
  ),
  driverLayout: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "_layout.tsx",
  ),
  rootLayout: path.join(root, "app", "_layout.tsx"),
  home: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "driver-home.tsx",
  ),
  active: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "driver-active.tsx",
  ),
  profile: path.join(
    root,
    "app",
    "(root)",
    "(driver)",
    "driver-profile.tsx",
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
  const backupPath = `${filePath}.driver-realtime-sync-v1.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const insertBefore = (
  source,
  marker,
  insertion,
  label,
) => {
  if (source.includes(insertion.trim())) return source;

  const index = source.indexOf(marker);

  if (index < 0) {
    fail(`Could not find ${label}.`);
  }

  return (
    source.slice(0, index) +
    insertion +
    source.slice(index)
  );
};

const replaceRequired = (
  source,
  search,
  replacement,
  label,
) => {
  if (source.includes(replacement)) return source;

  if (!source.includes(search)) {
    fail(`Could not find ${label}.`);
  }

  return source.replace(search, replacement);
};

Object.entries(paths).forEach(([label, filePath]) => {
  if (label === "service") return;
  requireFile(filePath, label);
});

[
  paths.driverLayout,
  paths.rootLayout,
  paths.home,
  paths.active,
  paths.profile,
].forEach(backup);

fs.mkdirSync(path.dirname(paths.service), {
  recursive: true,
});
fs.copyFileSync(paths.serviceSource, paths.service);

// ---------------------------------------------------------------------------
// Driver tabs layout: own the single TablesDB realtime connection.
// ---------------------------------------------------------------------------

let driverLayout = fs.readFileSync(
  paths.driverLayout,
  "utf8",
);

driverLayout = insertBefore(
  driverLayout,
  'import { getUserHomeRoute, isDriverUser } from "@/lib/userMode";',
  'import {\n' +
    '  startDriverRealtimeSync,\n' +
    '  stopDriverRealtimeSync,\n' +
    '} from "@/lib/driverRealtimeSync";\n',
  "the Driver layout user-mode import",
);

driverLayout = replaceRequired(
  driverLayout,
  'import React from "react";',
  'import React, { useEffect } from "react";',
  "the Driver layout React import",
);

if (!driverLayout.includes("startDriverRealtimeSync(user.accountId)")) {
  driverLayout = insertBefore(
    driverLayout,
    "  if (!isHydrated || !isInitialized || isLoading) {",
    '  useEffect(() => {\n' +
      '    if (!user?.accountId || !isDriverUser(user)) {\n' +
      '      stopDriverRealtimeSync();\n' +
      '      return;\n' +
      '    }\n\n' +
      '    startDriverRealtimeSync(user.accountId);\n\n' +
      '    return () => {\n' +
      '      stopDriverRealtimeSync();\n' +
      '    };\n' +
      '  }, [user?.accountId, user?.userMode]);\n\n',
    "the Driver layout loading guard",
  );
}

fs.writeFileSync(
  paths.driverLayout,
  driverLayout,
  "utf8",
);

// ---------------------------------------------------------------------------
// Root notification listener: foreground/background push is the permission-
// safe fallback when TablesDB rows are server-readable only.
// ---------------------------------------------------------------------------

let rootLayout = fs.readFileSync(paths.rootLayout, "utf8");

rootLayout = insertBefore(
  rootLayout,
  'import { registerForPushNotifications } from "@/lib/notifications";',
  'import { requestDriverRealtimeRefresh } from "@/lib/driverRealtimeSync";\n',
  "the root notification import",
);

if (
  !rootLayout.includes(
    'requestDriverRealtimeRefresh("push-received")',
  )
) {
  rootLayout = replaceRequired(
    rootLayout,
    '        console.log(`Notification received: ${title} - ${body}`);',
    '        console.log(`Notification received: ${title} - ${body}`);\n' +
      '        requestDriverRealtimeRefresh("push-received");',
    "the foreground notification listener",
  );
}

if (
  !rootLayout.includes(
    'requestDriverRealtimeRefresh("push-opened")',
  )
) {
  rootLayout = replaceRequired(
    rootLayout,
    '      Notifications.addNotificationResponseReceivedListener((response) => {\n' +
      '        handleNotificationNavigation(',
    '      Notifications.addNotificationResponseReceivedListener((response) => {\n' +
      '        requestDriverRealtimeRefresh("push-opened");\n' +
      '        handleNotificationNavigation(',
    "the notification-response listener",
  );
}

fs.writeFileSync(
  paths.rootLayout,
  rootLayout,
  "utf8",
);

// ---------------------------------------------------------------------------
// Visible Driver screens: refresh through their existing working API loaders.
// Their existing cache writes then keep the other screens current.
// ---------------------------------------------------------------------------

const realtimeImport =
  'import { subscribeToDriverRealtimeRefresh } from "@/lib/driverRealtimeSync";\n';

let home = fs.readFileSync(paths.home, "utf8");

home = insertBefore(
  home,
  'import useAuthStore from "@/store/auth.store";',
  realtimeImport,
  "the Driver Home auth import",
);

if (
  !home.includes(
    'subscribeToDriverRealtimeRefresh(() => {\n      void loadDashboard(false);',
  )
) {
  home = insertBefore(
    home,
    "  const toggleAvailability = async (value: boolean) => {",
    '  useEffect(\n' +
      '    () =>\n' +
      '      subscribeToDriverRealtimeRefresh(() => {\n' +
      '        void loadDashboard(false);\n' +
      '      }),\n' +
      '    [loadDashboard],\n' +
      '  );\n\n',
    "the Driver Home availability action",
  );
}

fs.writeFileSync(paths.home, home, "utf8");

let active = fs.readFileSync(paths.active, "utf8");

active = insertBefore(
  active,
  'import type {\n  DriverDashboard,',
  realtimeImport,
  "the Active Ride driver type import",
);

if (
  !active.includes(
    'subscribeToDriverRealtimeRefresh(() => {\n        void loadDashboard(false);',
  )
) {
  active = insertBefore(
    active,
    "  const routeCoordinates = useMemo<MapCoordinate[]>(() => {",
    '  useEffect(\n' +
      '    () =>\n' +
      '      subscribeToDriverRealtimeRefresh(() => {\n' +
      '        void loadDashboard(false);\n' +
      '      }),\n' +
      '    [loadDashboard],\n' +
      '  );\n\n',
    "the Active Ride route coordinates",
  );
}

fs.writeFileSync(paths.active, active, "utf8");

let profile = fs.readFileSync(paths.profile, "utf8");

profile = insertBefore(
  profile,
  'import useAuthStore from "@/store/auth.store";',
  realtimeImport,
  "the Driver Profile auth import",
);

if (
  !profile.includes(
    'subscribeToDriverRealtimeRefresh(() => {\n        void loadDashboard();',
  )
) {
  profile = insertBefore(
    profile,
    "  const updateForm = <K extends keyof OnboardingFormState>(",
    '  useEffect(\n' +
      '    () =>\n' +
      '      subscribeToDriverRealtimeRefresh(() => {\n' +
      '        void loadDashboard();\n' +
      '      }),\n' +
      '    [loadDashboard],\n' +
      '  );\n\n',
    "the Driver Profile updateForm function",
  );
}

fs.writeFileSync(paths.profile, profile, "utf8");

// Remove extracted source payloads from the project after installation.
const extractedPatchDirectory = path.join(
  root,
  "patch-files",
);

if (fs.existsSync(extractedPatchDirectory)) {
  fs.rmSync(extractedPatchDirectory, {
    recursive: true,
    force: true,
  });
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const checks = [
  [
    paths.service,
    "tablesdb.${config.databaseId}.tables.${tableId}.rows",
  ],
  [
    paths.driverLayout,
    "startDriverRealtimeSync(user.accountId)",
  ],
  [
    paths.rootLayout,
    'requestDriverRealtimeRefresh("push-received")',
  ],
  [
    paths.home,
    "subscribeToDriverRealtimeRefresh",
  ],
  [
    paths.active,
    "subscribeToDriverRealtimeRefresh",
  ],
  [
    paths.profile,
    "subscribeToDriverRealtimeRefresh",
  ],
];

for (const [filePath, marker] of checks) {
  const source = fs.readFileSync(filePath, "utf8");

  if (!source.includes(marker)) {
    fail(
      `Validation failed in ${filePath}: missing ${marker}`,
    );
  }
}

console.log(`
Nookly Driver realtime sync v1 applied.

Added:
- lib/driverRealtimeSync.ts

Updated:
- app/_layout.tsx
- app/(root)/(driver)/_layout.tsx
- app/(root)/(driver)/driver-home.tsx
- app/(root)/(driver)/driver-active.tsx
- app/(root)/(driver)/driver-profile.tsx

Realtime sources:
- ride_drivers
- ride_driver_institutions
- ride_vehicles
- rides
- ride_bookings

Fallback refreshes:
- foreground push received
- push opened
- app returns to foreground
- internet reconnects

The currently visible Driver screen refreshes through the existing Driver API
and updates its persistent cache. Repeated location-only ride updates are
deduplicated to avoid unnecessary dashboard requests.

No package installation is required.
No Function deployment is required.
No APK rebuild is required.

Next run:
npx tsc --noEmit
`);
