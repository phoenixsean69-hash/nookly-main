#!/usr/bin/env node

import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const patchRoot = path.join(root, "nookly-poi-hotfix-files");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(root, ".nookly-backups", `poi-hotfix-${timestamp}`);

const replacementFiles = [
  "lib/poiService.ts",
  "hooks/usePOIs.ts",
  "components/MapLayers.tsx",
  "components/AmenitiesBadge.tsx",
];

const propertyFile = "app/(root)/properties/[id].tsx";

const backupFile = async (relativePath) => {
  const source = path.join(root, relativePath);
  const destination = path.join(backupRoot, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
};

const copyReplacement = async (relativePath) => {
  const source = path.join(patchRoot, relativePath);
  const destination = path.join(root, relativePath);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
};

const patchPropertyPage = async () => {
  const absolutePath = path.join(root, propertyFile);
  let content = await readFile(absolutePath, "utf8");

  if (!content.includes('import AmenitiesBadge from "@/components/AmenitiesBadge";')) {
    const importAnchor = 'import ConfirmationModal from "@/components/ConfirmationModal";';
    if (!content.includes(importAnchor)) {
      throw new Error(`Could not find the import anchor in ${propertyFile}.`);
    }

    content = content.replace(
      importAnchor,
      `import AmenitiesBadge from "@/components/AmenitiesBadge";\n${importAnchor}`,
    );
  }

  if (!content.includes("<AmenitiesBadge")) {
    const mapEndPattern = /(\s+isInline=\{true\}\r?\n\s+\/>)/g;
    const matches = [...content.matchAll(mapEndPattern)];

    if (matches.length === 0) {
      throw new Error(`Could not find inline map cards in ${propertyFile}.`);
    }

    content = content.replace(
      mapEndPattern,
      `$1\n                <View className="mt-3">\n                  <AmenitiesBadge\n                    amenities={amenities}\n                    loading={amenitiesLoading}\n                  />\n                </View>`,
    );

    console.log(`✓ Added nearby-amenities cards after ${matches.length} map section(s)`);
  } else {
    console.log("✓ Nearby-amenities cards already exist");
  }

  await writeFile(absolutePath, content, "utf8");
};

const main = async () => {
  console.log("\nInstalling the Nookly POI hotfix...\n");

  await mkdir(backupRoot, { recursive: true });

  for (const relativePath of [...replacementFiles, propertyFile]) {
    await backupFile(relativePath);
  }

  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  for (const relativePath of replacementFiles) {
    await copyReplacement(relativePath);
    console.log(`✓ Replaced ${relativePath}`);
  }

  await patchPropertyPage();

  console.log("\n✓ Nookly POI functionality has been restored.");
  console.log("\nNext verification command:");
  console.log(
    'npx eslint "lib/poiService.ts" "hooks/usePOIs.ts" "components/MapLayers.tsx" "components/AmenitiesBadge.tsx"',
  );
};

main().catch((error) => {
  console.error("\n✗ POI hotfix installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
