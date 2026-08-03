import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const installerDirectory = path.dirname(
  fileURLToPath(import.meta.url),
);

const ridesPath = path.join(
  root,
  "app",
  "(root)",
  "(driver)",
  "driver-rides.tsx",
);
const realtimePath = path.join(
  root,
  "lib",
  "driverRealtimeSync.ts",
);
const replacementPath = path.join(
  installerDirectory,
  "patch-files",
  "app",
  "(root)",
  "(driver)",
  "driver-rides.tsx",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

for (const [label, filePath] of [
  ["Driver Rides screen", ridesPath],
  ["Driver realtime bridge", realtimePath],
  ["Driver Rides replacement", replacementPath],
]) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
}

const backup = (filePath) => {
  const backupPath =
    `${filePath}.driver-rides-marketplace-v1.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

backup(ridesPath);
backup(realtimePath);

fs.copyFileSync(replacementPath, ridesPath);

let realtime = fs.readFileSync(realtimePath, "utf8");

if (!realtime.includes('"ride_requests"')) {
  const marker =
    '  process.env.EXPO_PUBLIC_APPWRITE_RIDE_VEHICLES_COLLECTION_ID?.trim() ||\n' +
    '    "ride_vehicles",\n';

  if (!realtime.includes(marker)) {
    fail(
      "Could not find the Driver realtime table list. The file differs from the expected current version.",
    );
  }

  realtime = realtime.replace(
    marker,
    marker +
      '  process.env.EXPO_PUBLIC_APPWRITE_RIDE_REQUESTS_COLLECTION_ID?.trim() ||\n' +
      '    "ride_requests",\n' +
      '  process.env.EXPO_PUBLIC_APPWRITE_RIDE_OFFERS_COLLECTION_ID?.trim() ||\n' +
      '    "ride_offers",\n',
  );
}

fs.writeFileSync(realtimePath, realtime, "utf8");

const patchFilesDirectory = path.join(
  root,
  "patch-files",
);

if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, {
    recursive: true,
    force: true,
  });
}

const finalRides = fs.readFileSync(ridesPath, "utf8");
const finalRealtime = fs.readFileSync(
  realtimePath,
  "utf8",
);

for (const marker of [
  '"driver-rides-marketplace"',
  '"confirmed"',
  '"history"',
  "subscribeToDriverRealtimeRefresh",
  "writeProfilePageCache",
  "Awaiting offers",
]) {
  if (!finalRides.includes(marker)) {
    fail(
      `Driver Rides validation failed: missing ${marker}`,
    );
  }
}

for (const marker of [
  '"ride_requests"',
  '"ride_offers"',
]) {
  if (!finalRealtime.includes(marker)) {
    fail(
      `Realtime validation failed: missing ${marker}`,
    );
  }
}

console.log(`
Nookly Driver Rides Marketplace v1 applied.

Updated:
- app/(root)/(driver)/driver-rides.tsx
- lib/driverRealtimeSync.ts

Driver Rides now has:
- Requests
- Offers
- Confirmed
- History
- Awaiting / Accepted / Closed offer filters
- Persistent account-scoped cache
- Pull-to-refresh
- Realtime request and offer refresh
- Cached-data fallback on API errors
- Suspended-driver error routing to Profile
- Live-trip transition into Active Ride
- Cleaner request, offer and trip cards

Realtime now also watches:
- ride_requests
- ride_offers

No Function deployment is required.
No package installation is required.
No APK rebuild is required.

Next run:
npx tsc --noEmit
`);
