import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "metro.config.js",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\n` +
      "Run this script from the Nookly project root.",
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

if (
  !updated.includes(
    'config.resolver.assetExts.includes("wasm")',
  )
) {
  const marker =
    "const config = getDefaultConfig(__dirname);";

  if (!updated.includes(marker)) {
    throw new Error(
      "Could not locate the Expo Metro configuration. " +
        "No file was written.",
    );
  }

  updated = updated.replace(
    marker,
    `${marker}

/**
 * expo-sqlite uses a WebAssembly database engine on web.
 * Metro does not resolve .wasm files unless the extension is
 * explicitly registered as an asset.
 */
if (!config.resolver.assetExts.includes("wasm")) {
  config.resolver.assetExts.push("wasm");
}`,
  );
}

if (
  !updated.includes(
    'config.resolver.assetExts.push("wasm")',
  )
) {
  throw new Error(
    "Validation failed: wasm was not added to Metro asset extensions.",
  );
}

if (
  !updated.includes(
    'moduleName === "expo-file-system"',
  ) ||
  !updated.includes(
    '"expo-file-system/legacy"',
  )
) {
  throw new Error(
    "Validation failed: the existing Appwrite file-system resolver was lost.",
  );
}

if (
  !updated.includes(
    "module.exports = withNativeWind",
  )
) {
  throw new Error(
    "Validation failed: NativeWind Metro integration was lost.",
  );
}

if (updated === original) {
  console.log("");
  console.log(
    "metro.config.js already contains the WebAssembly fix.",
  );
  console.log(
    "No changes were required.",
  );
  process.exit(0);
}

const backupPath =
  `${targetPath}.sqlite-web-wasm-fix.bak`;

fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log(
  "Expo SQLite web WebAssembly fix applied successfully.",
);
console.log("");
console.log("Updated:");
console.log("- metro.config.js");
console.log("");
console.log("Backup:");
console.log(
  "- metro.config.js.sqlite-web-wasm-fix.bak",
);
console.log("");
console.log(
  "Restart Metro with a clean cache:",
);
console.log("npx expo start --web --clear");
