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
const relativePath = "lib/appwrite.ts";
const filePath = path.join(root, relativePath);
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(
  root,
  ".nookly-backups",
  `avatar-url-${timestamp}`,
  relativePath,
);

const oldBlock = `    return storage
      .getFileView(config.bucketId, uploadedFile.$id)
      .toString();`;

const newBlock = `    const endpoint = config.endpoint?.replace(/\\/+$/, "");
    const projectId = config.projectId?.trim();

    if (!endpoint || !projectId) {
      throw new Error(
        "The Appwrite endpoint or project ID is not configured.",
      );
    }

    const avatarUrl =
      \`\${endpoint}/storage/buckets/\` +
      \`\${encodeURIComponent(config.bucketId)}/files/\` +
      \`\${encodeURIComponent(uploadedFile.$id)}/view\` +
      \`?project=\${encodeURIComponent(projectId)}\`;

    if (!/^https?:\\/\\//i.test(avatarUrl)) {
      throw new Error("The uploaded avatar URL is invalid.");
    }

    return avatarUrl;`;

const main = async () => {
  console.log("\nInstalling Nookly avatar URL hotfix...\n");

  const content = await readFile(filePath, "utf8");

  if (!content.includes(oldBlock)) {
    throw new Error(
      "Could not find the existing avatar URL block in lib/appwrite.ts.",
    );
  }

  await mkdir(path.dirname(backupPath), { recursive: true });
  await cp(filePath, backupPath);

  const updated = content.replace(oldBlock, newBlock);
  await writeFile(filePath, updated, "utf8");

  console.log(`✓ Backup created: ${path.relative(root, backupPath)}`);
  console.log("✓ Avatar uploads now return a guaranteed HTTPS Appwrite URL.");
  console.log("\nNext verification command:");
  console.log('npx eslint "lib/appwrite.ts"');
};

main().catch((error) => {
  console.error("\n✗ Avatar URL hotfix failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
