#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const payloadRoot = path.join(
  root,
  "nookly-driver-tabs-text-rendering-files",
);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `driver-tabs-text-rendering-${timestamp}`,
);

const files = [
  "app/(root)/(driver)/_layout.tsx",
  "babel.config.js",
  "plugins/fix-android-text-clipping.cjs",
];

const requiredExistingFiles = [
  "app/(root)/(driver)/_layout.tsx",
  "babel.config.js",
];

async function assertExpectedProject() {
  const packagePath = path.join(root, "package.json");
  const packageText = await readFile(packagePath, "utf8");
  const packageJson = JSON.parse(packageText);

  const reactNativeVersion =
    packageJson.dependencies?.["react-native"] || "";

  if (!reactNativeVersion.includes("0.81")) {
    throw new Error(
      `Expected React Native 0.81.x, found "${reactNativeVersion}".`,
    );
  }

  const driverLayout = await readFile(
    path.join(root, "app/(root)/(driver)/_layout.tsx"),
    "utf8",
  );

  if (!driverLayout.includes("DriverTabsLayout")) {
    throw new Error(
      "The current driver tab layout was not recognized.",
    );
  }
}

async function backupExistingFiles() {
  for (const relativePath of requiredExistingFiles) {
    const source = path.join(root, relativePath);
    const destination = path.join(backupRoot, relativePath);

    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
}

async function installFile(relativePath) {
  const source = path.join(payloadRoot, relativePath);
  const destination = path.join(root, relativePath);

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);

  console.log(`✓ Installed ${relativePath}`);
}

async function main() {
  console.log(
    "\nInstalling Nookly driver tabs + Android text rendering hotfix...\n",
  );

  await assertExpectedProject();
  await backupExistingFiles();

  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  for (const relativePath of files) {
    await installFile(relativePath);
  }

  console.log("\n✓ Driver tabs now match the tenant visual style.");
  console.log("✓ Driver labels have stable full-width measurements.");
  console.log("✓ Android Text receives the RN 0.81 clipping workaround.");

  console.log("\nRun these checks:");
  console.log(
    'node --check "plugins/fix-android-text-clipping.cjs"',
  );
  console.log('node --check "babel.config.js"');
  console.log(
    'npx eslint "app/(root)/(driver)/_layout.tsx"',
  );

  console.log(
    "\nDo not restart Expo until all three commands complete without errors.",
  );
}

main().catch((error) => {
  console.error("\n✗ Installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
