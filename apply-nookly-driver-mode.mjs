#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const filesRoot = path.join(root, "nookly-driver-mode-files");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `driver-mode-${timestamp}`,
);

const replacementFiles = [
  "lib/userMode.ts",
];

const newFiles = [
  "types/driver.ts",
  "services/driver.service.ts",
  "components/driver/DriverRideCard.tsx",
  "app/(root)/(driver)/_layout.tsx",
  "app/(root)/(driver)/driver-home.tsx",
  "app/(root)/(driver)/driver-rides.tsx",
  "app/(root)/(driver)/driver-active.tsx",
  "app/(root)/(driver)/driver-profile.tsx",
  "app/(root)/(driver)/driver-ride-details.tsx",
  "scripts/setup-driver-mode-backend.mjs",
  "scripts/create-driver-account.mjs",
  "functions/rides-driver-api/package.json",
  "functions/rides-driver-api/src/main.js",
];

const existingFilesToPatch = [
  "store/auth.store.ts",
  "services/rides.service.ts",
];

const read = (relativePath) =>
  readFile(path.join(root, relativePath), "utf8");

const write = (relativePath, content) =>
  writeFile(path.join(root, relativePath), content, "utf8");

const replaceRequired = (content, search, replacement, label) => {
  if (content.includes(replacement)) return content;

  if (!content.includes(search)) {
    throw new Error(`Could not find ${label}.`);
  }

  return content.replace(search, replacement);
};

const backupFile = async (relativePath) => {
  const source = path.join(root, relativePath);
  const destination = path.join(backupRoot, relativePath);

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
};

const copyFile = async (relativePath) => {
  const source = path.join(filesRoot, relativePath);
  const destination = path.join(root, relativePath);

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
};

const patchAuthStore = async () => {
  const relativePath = "store/auth.store.ts";
  let content = await read(relativePath);

  const oldUserModeUnion =
    '  userMode: "tenant" | "landlord" | "student";';
  const newUserModeUnion =
    '  userMode: "tenant" | "landlord" | "driver" | "student";';

  if (content.includes(oldUserModeUnion)) {
    content = content.replaceAll(oldUserModeUnion, newUserModeUnion);
  } else if (!content.includes(newUserModeUnion)) {
    throw new Error("Could not find the auth-store userMode unions.");
  }

  content = replaceRequired(
    content,
    `  const userMode: User["userMode"] =
    rawMode === "landlord"
      ? "landlord"
      : rawMode === "student"
        ? "student"
        : "tenant";`,
    `  const userMode: User["userMode"] =
    rawMode === "landlord"
      ? "landlord"
      : rawMode === "driver"
        ? "driver"
        : rawMode === "student"
          ? "student"
          : "tenant";`,
    "the user-mode normalization block",
  );

  content = replaceRequired(
    content,
    `        userData.userMode.trim().toLowerCase() as
          | "tenant"
          | "landlord"
          | "student";`,
    `        userData.userMode.trim().toLowerCase() as
          | "tenant"
          | "landlord"
          | "driver"
          | "student";`,
    "the sign-up normalized mode union",
  );

  await write(relativePath, content);
  console.log(`✓ Added driver support to ${relativePath}`);
};

const patchRidesService = async () => {
  const relativePath = "services/rides.service.ts";
  let content = await read(relativePath);

  content = replaceRequired(
    content,
    'const ACTIVE_RIDE_STATUSES = new Set(["scheduled", "boarding", "in_progress"]);',
    'const ACTIVE_RIDE_STATUSES = new Set(["scheduled", "boarding", "active", "in_progress", "delayed"]);',
    "the active ride statuses",
  );

  content = replaceRequired(
    content,
    '  if (ride.status === "in_progress") return 0;',
    '  if (ride.status === "active" || ride.status === "in_progress") return 0;',
    "the active ride sort rank",
  );

  await write(relativePath, content);
  console.log(`✓ Aligned ride statuses in ${relativePath}`);
};

const ensureEnvironment = async () => {
  const envPath = path.join(root, ".env");
  let content = "";

  try {
    content = await readFile(envPath, "utf8");
  } catch {
    console.warn("! .env was not found.");
    return;
  }

  const line =
    "EXPO_PUBLIC_APPWRITE_RIDES_DRIVER_FUNCTION_ID=rides-driver-api";

  if (!content.includes("EXPO_PUBLIC_APPWRITE_RIDES_DRIVER_FUNCTION_ID=")) {
    const separator = content.endsWith("\n") ? "" : "\n";
    await writeFile(envPath, `${content}${separator}${line}\n`, "utf8");
    console.log("✓ Added the driver function ID to .env");
  } else {
    console.log("✓ Driver function ID already exists in .env");
  }
};

const main = async () => {
  console.log("\nInstalling Nookly Driver mode...\n");

  for (const relativePath of [
    ...replacementFiles,
    ...existingFilesToPatch,
  ]) {
    await backupFile(relativePath);
  }

  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  for (const relativePath of [...replacementFiles, ...newFiles]) {
    await copyFile(relativePath);
    console.log(`✓ Installed ${relativePath}`);
  }

  await patchAuthStore();
  await patchRidesService();
  await ensureEnvironment();

  console.log("\n✓ Nookly Driver mode Batch 1 installed successfully.");
  console.log("\nNext verification command:");
  console.log(
    'npx eslint "lib/userMode.ts" "store/auth.store.ts" "types/driver.ts" "services/driver.service.ts" "components/driver/DriverRideCard.tsx" "app/(root)/(driver)/_layout.tsx" "app/(root)/(driver)/driver-home.tsx" "app/(root)/(driver)/driver-rides.tsx" "app/(root)/(driver)/driver-active.tsx" "app/(root)/(driver)/driver-profile.tsx" "app/(root)/(driver)/driver-ride-details.tsx"',
  );
};

main().catch((error) => {
  console.error("\n✗ Driver mode installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
