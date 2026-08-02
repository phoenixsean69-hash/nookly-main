import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const testScriptPath = path.join(
  root,
  "scripts",
  "lucan-send-lease-test.mjs",
);

if (!fs.existsSync(testScriptPath)) {
  throw new Error(
    `Lease test script not found: ${testScriptPath}\n` +
      "Run this installer from the Nookly project root.",
  );
}

const original = fs.readFileSync(
  testScriptPath,
  "utf8",
);

const backupPath =
  `${testScriptPath}.inputfile-import-fix.bak`;

const mainImportPattern =
  /import\s*\{([\s\S]*?)\}\s*from\s*["']node-appwrite["'];/;

const match = original.match(
  mainImportPattern,
);

if (!match) {
  throw new Error(
    'Could not locate the import from "node-appwrite". No file was changed.',
  );
}

const importedNames = match[1]
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

if (
  !importedNames.includes(
    "InputFile",
  ) &&
  original.includes(
    'from "node-appwrite/file"',
  )
) {
  console.log(
    "The InputFile import is already correct.",
  );
  process.exit(0);
}

if (
  !importedNames.includes(
    "InputFile",
  )
) {
  throw new Error(
    "InputFile was not found in the main node-appwrite import. No file was changed.",
  );
}

const remainingNames =
  importedNames.filter(
    (name) =>
      name !== "InputFile",
  );

const formattedMainImport =
  `import {\n${remainingNames
    .map((name) => `  ${name},`)
    .join("\n")}\n} from "node-appwrite";`;

const correctedImport =
  `${formattedMainImport}\n` +
  `import { InputFile } from "node-appwrite/file";`;

const patched = original.replace(
  mainImportPattern,
  correctedImport,
);

if (
  !patched.includes(
    'import { InputFile } from "node-appwrite/file";',
  )
) {
  throw new Error(
    "InputFile import validation failed. No file was changed.",
  );
}

const updatedMainImport =
  patched.match(
    mainImportPattern,
  );

if (
  !updatedMainImport ||
  updatedMainImport[1]
    .split(",")
    .map((name) => name.trim())
    .includes("InputFile")
) {
  throw new Error(
    "InputFile still exists in the main node-appwrite import. No file was changed.",
  );
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(
    testScriptPath,
    backupPath,
  );
}

fs.writeFileSync(
  testScriptPath,
  patched,
  "utf8",
);

console.log("");
console.log(
  "Lease terminal InputFile import fixed.",
);
console.log("");
console.log(
  'Now using: import { InputFile } from "node-appwrite/file";',
);
console.log("");
console.log(
  "Updated: scripts/lucan-send-lease-test.mjs",
);
