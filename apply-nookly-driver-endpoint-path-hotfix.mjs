#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const relativePath = "services/driver.service.ts";
const filePath = path.join(root, relativePath);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  root,
  ".nookly-backups",
  `driver-endpoint-path-${timestamp}`,
  relativePath,
);

const oldBlock = `    async: false,
    path,
    method,`;

const newBlock = `    async: false,
    xpath: path,
    method,`;

async function main() {
  console.log("\nInstalling Nookly Driver endpoint path hotfix...\n");

  const content = await readFile(filePath, "utf8");

  if (!content.includes(oldBlock)) {
    if (content.includes("xpath: path")) {
      console.log("✓ The Driver endpoint path fix is already installed.");
      return;
    }

    throw new Error(
      "Could not find the expected createExecution path block.",
    );
  }

  await mkdir(path.dirname(backupPath), { recursive: true });
  await cp(filePath, backupPath);

  await writeFile(
    filePath,
    content.replace(oldBlock, newBlock),
    "utf8",
  );

  console.log(`✓ Backup created: ${path.relative(root, backupPath)}`);
  console.log("✓ Replaced createExecution path with xpath.");
  console.log("✓ /dashboard, /rides and other Driver routes will now reach the Function.");

  console.log("\nRun:");
  console.log('npx eslint "services/driver.service.ts"');
}

main().catch((error) => {
  console.error("\n✗ Driver endpoint path hotfix failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
