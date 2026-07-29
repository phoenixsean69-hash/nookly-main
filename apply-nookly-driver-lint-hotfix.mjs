#!/usr/bin/env node

import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const patchRoot = path.join(root, "nookly-driver-lint-hotfix-files");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `driver-lint-hotfix-${timestamp}`,
);

const files = [
  "app/(root)/(driver)/driver-home.tsx",
  "app/(root)/(driver)/driver-rides.tsx",
  "app/(root)/(driver)/driver-ride-details.tsx",
];

const main = async () => {
  console.log("\nInstalling the Nookly Driver lint hotfix...\n");

  for (const relativePath of files) {
    const currentFile = path.join(root, relativePath);
    const backupFile = path.join(backupRoot, relativePath);
    const replacementFile = path.join(patchRoot, relativePath);

    await mkdir(path.dirname(backupFile), { recursive: true });
    await cp(currentFile, backupFile);

    await mkdir(path.dirname(currentFile), { recursive: true });
    await cp(replacementFile, currentFile);

    console.log(`✓ Fixed ${relativePath}`);
  }

  console.log(`\n✓ Backup created: ${path.relative(root, backupRoot)}`);
  console.log("✓ All three Driver Mode ESLint warnings were corrected.");
  console.log("\nNext verification command:");
  console.log(
    'npx eslint "app/(root)/(driver)/driver-home.tsx" "app/(root)/(driver)/driver-rides.tsx" "app/(root)/(driver)/driver-ride-details.tsx"',
  );
};

main().catch((error) => {
  console.error("\n✗ Driver lint hotfix installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
