import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const installerDirectory = path.dirname(fileURLToPath(import.meta.url));

const targetPath = path.join(
  root,
  "app",
  "(root)",
  "(driver)",
  "driver-active.tsx",
);

const replacementPath = path.join(
  installerDirectory,
  "patch-files",
  "app",
  "(root)",
  "(driver)",
  "driver-active.tsx",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

if (!fs.existsSync(targetPath)) {
  fail(`Current Active Ride screen was not found at ${targetPath}`);
}

if (!fs.existsSync(replacementPath)) {
  fail(`Replacement Active Ride screen was not found at ${replacementPath}`);
}

const backupPath = `${targetPath}.driver-active-live-map-v1.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(targetPath, backupPath);
}

const replacement = fs.readFileSync(replacementPath, "utf8");

const requiredMarkers = [
  "getDriverRideDetails",
  "sendDriverLocation",
  "reportDriverIncident",
  "OpenStreetMap contributors",
  "Start sharing location",
  "Open navigation",
  "Passenger",
];

for (const marker of requiredMarkers) {
  if (!replacement.includes(marker)) {
    fail(`Replacement validation failed: missing ${marker}`);
  }
}

fs.writeFileSync(targetPath, replacement, "utf8");

const extractedPatchDirectory = path.join(root, "patch-files");

if (fs.existsSync(extractedPatchDirectory)) {
  fs.rmSync(extractedPatchDirectory, {
    recursive: true,
    force: true,
  });
}

console.log(`
Nookly Driver Active Ride v1 applied.

Updated:
- app/(root)/(driver)/driver-active.tsx

Added:
- Built-in OpenStreetMap live route
- Driver, origin, stop, and destination markers
- Approximate remaining distance and ETA
- Open-navigation action
- Passenger list and call controls
- Online/offline and GPS publishing states
- Structured incident-report modal
- Cleaner ride-status progression
- Existing Driver APIs retained

No new package was added.
No new APK build is required.

Next run:
npx tsc --noEmit
`);
