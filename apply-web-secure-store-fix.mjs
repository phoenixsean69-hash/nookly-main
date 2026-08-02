import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const authPath = path.join(
  root,
  "store",
  "auth.store.ts",
);

const helperPath = path.join(
  root,
  "lib",
  "secureStorage.ts",
);

if (!fs.existsSync(authPath)) {
  throw new Error(
    `File not found: ${authPath}\n` +
      "Run this script from the Nookly project root.",
  );
}

const originalAuth = fs.readFileSync(
  authPath,
  "utf8",
);

let auth = originalAuth;

const replaceRequired = (
  pattern,
  replacement,
  label,
) => {
  if (typeof pattern === "string") {
    if (!auth.includes(pattern)) {
      throw new Error(
        `Could not locate ${label}. No files were written.`,
      );
    }

    auth = auth.replace(pattern, replacement);
    return;
  }

  if (!pattern.test(auth)) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  auth = auth.replace(pattern, replacement);
};

// Remove the direct native-only SecureStore import.
auth = auth.replace(
  'import * as SecureStore from "expo-secure-store";\n',
  "",
);

// Add the platform-safe adapter.
if (
  !auth.includes(
    'from "@/lib/secureStorage"',
  )
) {
  replaceRequired(
    'import { getData, removeData, storeData } from "@/lib/cache";',
    `import { getData, removeData, storeData } from "@/lib/cache";
import {
  deleteSecureValue,
  setSecureValue,
} from "@/lib/secureStorage";`,
    "the auth cache import",
  );
}

// Replace all native-only calls.
auth = auth.replaceAll(
  "SecureStore.setItemAsync(",
  "setSecureValue(",
);

auth = auth.replaceAll(
  "SecureStore.deleteItemAsync(",
  "deleteSecureValue(",
);

// Validation.
if (
  auth.includes("SecureStore.")
) {
  throw new Error(
    "Validation failed: direct SecureStore calls remain in auth.store.ts.",
  );
}

if (
  !auth.includes("setSecureValue(") ||
  !auth.includes("deleteSecureValue(")
) {
  throw new Error(
    "Validation failed: platform-safe auth storage calls are missing.",
  );
}

if (
  !auth.includes(
    'from "@/lib/secureStorage"',
  )
) {
  throw new Error(
    "Validation failed: secure-storage adapter import is missing.",
  );
}

const helperContent = "import AsyncStorage from \"@react-native-async-storage/async-storage\";\nimport * as SecureStore from \"expo-secure-store\";\nimport { Platform } from \"react-native\";\n\nconst WEB_KEY_PREFIX = \"@nookly:web-secure:\";\n\nconst getWebKey = (key: string): string =>\n  `${WEB_KEY_PREFIX}${key}`;\n\nexport const setSecureValue = async (\n  key: string,\n  value: string,\n): Promise<void> => {\n  if (Platform.OS === \"web\") {\n    await AsyncStorage.setItem(\n      getWebKey(key),\n      value,\n    );\n    return;\n  }\n\n  await SecureStore.setItemAsync(key, value);\n};\n\nexport const getSecureValue = async (\n  key: string,\n): Promise<string | null> => {\n  if (Platform.OS === \"web\") {\n    return AsyncStorage.getItem(getWebKey(key));\n  }\n\n  return SecureStore.getItemAsync(key);\n};\n\nexport const deleteSecureValue = async (\n  key: string,\n): Promise<void> => {\n  if (Platform.OS === \"web\") {\n    await AsyncStorage.removeItem(getWebKey(key));\n    return;\n  }\n\n  await SecureStore.deleteItemAsync(key);\n};\n";

if (
  !helperContent.includes(
    'Platform.OS === "web"',
  ) ||
  !helperContent.includes(
    "SecureStore.setItemAsync",
  ) ||
  !helperContent.includes(
    "AsyncStorage.setItem",
  )
) {
  throw new Error(
    "Validation failed: secure-storage adapter is incomplete.",
  );
}

// Back up only after all validation succeeds.
fs.copyFileSync(
  authPath,
  `${authPath}.web-secure-store-fix.bak`,
);

if (fs.existsSync(helperPath)) {
  fs.copyFileSync(
    helperPath,
    `${helperPath}.web-secure-store-fix.bak`,
  );
}

fs.mkdirSync(
  path.dirname(helperPath),
  { recursive: true },
);

fs.writeFileSync(
  helperPath,
  helperContent,
  "utf8",
);

fs.writeFileSync(
  authPath,
  auth,
  "utf8",
);

console.log("");
console.log(
  "Web SecureStore compatibility fix applied successfully.",
);
console.log("");
console.log("Added:");
console.log("- lib/secureStorage.ts");
console.log("");
console.log("Updated:");
console.log("- store/auth.store.ts");
console.log("");
console.log("Android and iOS still use expo-secure-store.");
console.log("Web now uses AsyncStorage for this adapter.");
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
console.log("");
console.log("Then restart web:");
console.log("npx expo start --web --clear");
