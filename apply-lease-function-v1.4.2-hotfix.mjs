import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const filePath = path.join(
  root,
  "functions",
  "nookly-push-api",
  "src",
  "main.js",
);

if (!fs.existsSync(filePath)) {
  throw new Error(
    `Function source not found: ${filePath}\n` +
      "Run this installer from the Nookly project root.",
  );
}

const original = fs.readFileSync(
  filePath,
  "utf8",
);

const marker =
  "const getUserRowByReference = async";

const first = original.indexOf(marker);
const second = original.indexOf(
  marker,
  first + marker.length,
);

if (first < 0) {
  throw new Error(
    "getUserRowByReference was not found. No file was changed.",
  );
}

let patched = original;

if (second >= 0) {
  const blockStart = second;
  const nextMarker =
    "const notifyLeaseSent = async";

  const blockEnd = original.indexOf(
    nextMarker,
    second,
  );

  if (blockEnd < 0) {
    throw new Error(
      "Could not locate the end of the duplicate helper. No file was changed.",
    );
  }

  patched =
    original.slice(0, blockStart) +
    original.slice(blockEnd);
}

patched = patched.replaceAll(
  'version: "1.4.1"',
  'version: "1.4.2"',
);

const declarationCount = (
  patched.match(
    /const getUserRowByReference = async/g,
  ) || []
).length;

if (declarationCount !== 1) {
  throw new Error(
    `Expected one getUserRowByReference declaration after patching, found ${declarationCount}. No file was changed.`,
  );
}

if (
  !patched.includes(
    'path === "/lease-sent"',
  ) ||
  !patched.includes(
    'path === "/lease-access"',
  )
) {
  throw new Error(
    "Lease routes are missing. No file was changed.",
  );
}

const backupPath =
  `${filePath}.lease-function-v1.4.2.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(
    filePath,
    backupPath,
  );
}

fs.writeFileSync(
  filePath,
  patched,
  "utf8",
);

const syntax = spawnSync(
  process.execPath,
  ["--check", filePath],
  {
    encoding: "utf8",
  },
);

if (syntax.status !== 0) {
  fs.copyFileSync(
    backupPath,
    filePath,
  );

  throw new Error(
    "The patched Function failed syntax validation and was rolled back:\n" +
      String(
        syntax.stderr ||
          syntax.stdout ||
          "Unknown syntax error",
      ),
  );
}

console.log("");
console.log(
  "Nookly Push Function v1.4.2 hotfix applied.",
);
console.log("");
console.log(
  "Duplicate getUserRowByReference declaration removed.",
);
console.log(
  "Function syntax validation passed.",
);
console.log("");
console.log(
  "Updated: functions/nookly-push-api/src/main.js",
);
