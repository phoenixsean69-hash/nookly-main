#!/usr/bin/env node

/**
 * Nookly: Student School Location Migration
 *
 * Run from the project root:
 *   node add-student-school-location.mjs
 *
 * Updates:
 * - app/(auth)/sign-up.tsx
 * - store/auth.store.ts
 * - lib/appwrite.ts (createUser)
 * - context/AuthContext.ts / context/AuthContext.tsx when present
 *
 * Behaviour:
 * - School Location is shown and required only for Student mode.
 * - userMode is persisted in lowercase.
 * - schoolLocation is trimmed and persisted in lowercase.
 * - No .env file is read or modified.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(os.tmpdir(), `nookly-school-location-backup-${stamp}`);
const changed = [];
const warnings = [];

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function backup(file) {
  const destination = path.join(backupRoot, path.relative(ROOT, file));
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(file, destination);
}

function save(file, content) {
  const before = fs.readFileSync(file, "utf8");
  if (before === content) return;
  backup(file);
  fs.writeFileSync(file, content, "utf8");
  changed.push(rel(file));
}

function insertAfter(content, marker, insertion, label) {
  if (content.includes(insertion.trim())) return content;
  const index = content.indexOf(marker);
  if (index < 0) {
    warnings.push(`Could not locate ${label}.`);
    return content;
  }
  return content.slice(0, index + marker.length) + insertion + content.slice(index + marker.length);
}

function replaceOne(content, pattern, replacement, label) {
  if (typeof pattern === "string") {
    if (!content.includes(pattern)) {
      warnings.push(`Could not locate ${label}.`);
      return content;
    }
    return content.replace(pattern, replacement);
  }

  if (!pattern.test(content)) {
    warnings.push(`Could not locate ${label}.`);
    return content;
  }
  return content.replace(pattern, replacement);
}

function addOptionalFieldToInterface(content, interfaceName, fieldLine) {
  const interfacePattern = new RegExp(
    `(?:export\\s+)?interface\\s+${interfaceName}\\s*\\{`,
  );
  const match = interfacePattern.exec(content);

  if (!match || match.index === undefined) {
    warnings.push(`Could not locate ${interfaceName}.`);
    return content;
  }

  const blockStart = match.index;
  const blockEnd = content.indexOf("\n}", blockStart);
  if (blockEnd < 0) {
    warnings.push(`Could not locate the end of ${interfaceName}.`);
    return content;
  }

  const block = content.slice(blockStart, blockEnd);
  const fieldName = fieldLine.split(":")[0].trim();
  if (new RegExp(`\\b${fieldName}\\??\\s*:`).test(block)) return content;

  const userModeLine = /(^\s*userMode:[^;]+;)/m;
  if (!userModeLine.test(block)) {
    warnings.push(`Could not add ${fieldLine.trim()} to ${interfaceName}.`);
    return content;
  }

  const updatedBlock = block.replace(userModeLine, `$1\n  ${fieldLine}`);
  return content.slice(0, blockStart) + updatedBlock + content.slice(blockEnd);
}

function patchSignUp(file) {
  let content = fs.readFileSync(file, "utf8");

  content = addOptionalFieldToInterface(content, "FormData", "schoolLocation: string;");

  if (!/schoolLocation:\s*""/.test(content)) {
    content = replaceOne(
      content,
      /(const \[formData, setFormData\][\s\S]*?userMode:\s*"",)/,
      `$1\n    schoolLocation: "",`,
      "the sign-up form's initial userMode value",
    );
  }

  if (!content.includes('field: "schoolLocation"')) {
    const emailValidation = /\n\s*if \(!formData\.email\?\.trim\(\)\) \{/;
    const match = content.match(emailValidation);
    if (match && match.index !== undefined) {
      const validation = `\n\n    if (\n      formData.userMode === "student" &&\n      !formData.schoolLocation.trim()\n    ) {\n      errors.push({\n        field: "schoolLocation",\n        message: "Please enter your school location",\n      });\n    }`;
      content = content.slice(0, match.index) + validation + content.slice(match.index);
    } else {
      warnings.push("Could not insert student school-location validation.");
    }
  }

  content = content.replace(
    /setFormData\(\{ \.\.\.formData, userMode: mode \}\);/g,
    `setFormData({\n                                ...formData,\n                                userMode: mode,\n                                schoolLocation:\n                                  mode === "student"\n                                    ? formData.schoolLocation\n                                    : "",\n                              });\n                              if (\n                                mode !== "student" &&\n                                getFieldError("schoolLocation")\n                              ) {\n                                clearError("schoolLocation");\n                              }`,
  );

  if (!content.includes('label="School location"')) {
    const passwordMarker = /\n(\s*)<CustomInput\s*\n\s*label="Password"/;
    const match = content.match(passwordMarker);
    if (match && match.index !== undefined) {
      const indent = match[1];
      const block = `\n${indent}{formData.userMode === "student" && (\n${indent}  <CustomInput\n${indent}    label="School location"\n${indent}    value={formData.schoolLocation}\n${indent}    onChangeText={(text) => {\n${indent}      setFormData({ ...formData, schoolLocation: text });\n${indent}      if (getFieldError("schoolLocation")) {\n${indent}        clearError("schoolLocation");\n${indent}      }\n${indent}    }}\n${indent}    placeholder="Enter your school location"\n${indent}    autoCapitalize="words"\n${indent}    error={getFieldError("schoolLocation")}\n${indent}  />\n${indent})}\n`;
      content = content.slice(0, match.index) + block + content.slice(match.index);
    } else {
      warnings.push("Could not insert the School location input before Password.");
    }
  }

  if (!content.includes("schoolLocation:")) {
    warnings.push("School location was not added to sign-up.tsx.");
  }

  if (!content.includes("formData.schoolLocation.trim().toLowerCase()")) {
    content = replaceOne(
      content,
      /(userMode:\s*formData\.userMode(?:\.toLowerCase\(\))?\s+as\s+"tenant"\s*\|\s*"landlord"\s*\|\s*"student",)/,
      `userMode: formData.userMode.toLowerCase() as\n          | "tenant"\n          | "landlord"\n          | "student",\n        schoolLocation:\n          formData.userMode === "student"\n            ? formData.schoolLocation.trim().toLowerCase()\n            : undefined,`,
      "the signUp payload's userMode field",
    );
  }

  save(file, content);
}

function patchAuthStore(file) {
  let content = fs.readFileSync(file, "utf8");

  content = addOptionalFieldToInterface(content, "User", "schoolLocation?: string;");
  content = addOptionalFieldToInterface(content, "SignUpData", "schoolLocation?: string;");

  if (!content.includes("const normalizedUserMode =")) {
    const signUpStart = content.indexOf("signUp: async (userData: SignUpData) => {");
    const loadingMarker = "set({ isLoading: true });";
    const loadingIndex =
      signUpStart >= 0 ? content.indexOf(loadingMarker, signUpStart) : -1;

    if (loadingIndex >= 0) {
      const insertionPoint = loadingIndex + loadingMarker.length;
      const normalization = `\n\n      const normalizedUserMode = userData.userMode.trim().toLowerCase() as\n        | "tenant"\n        | "landlord"\n        | "student";\n      const normalizedSchoolLocation =\n        userData.schoolLocation?.trim().toLowerCase() ?? "";\n\n      if (normalizedUserMode === "student" && !normalizedSchoolLocation) {\n        set({ isLoading: false });\n        return {\n          success: false,\n          error: "School location is required for student accounts",\n        };\n      }`;
      content =
        content.slice(0, insertionPoint) +
        normalization +
        content.slice(insertionPoint);
    } else {
      warnings.push("Could not locate auth.store signUp initialization.");
    }
  }

  content = content.replace(
    /userMode:\s*userData\.userMode,/g,
    `userMode: normalizedUserMode,\n          ...(normalizedUserMode === "student"\n            ? { schoolLocation: normalizedSchoolLocation }\n            : {}),`,
  );

  content = content.replace(
    /userData\.userMode\s*===\s*"landlord"/g,
    'normalizedUserMode === "landlord"',
  );

  save(file, content);
}

function patchAppwrite(file) {
  let content = fs.readFileSync(file, "utf8");

  content = addOptionalFieldToInterface(content, "CreateUserParams", "schoolLocation?: string;");

  if (!/\n\s*schoolLocation,\n\s*avatar,/.test(content)) {
    content = replaceOne(
      content,
      /(export const createUser = async \(\{[\s\S]*?userMode,\n)(\s*avatar,)/,
      `$1  schoolLocation,\n$2`,
      "createUser parameter destructuring",
    );
  }

  if (!content.includes("const normalizedSchoolLocation =")) {
    const createUserStart = content.indexOf("export const createUser = async");
    const accountMarker = "const accountId =";
    const accountIndex =
      createUserStart >= 0 ? content.indexOf(accountMarker, createUserStart) : -1;

    if (accountIndex >= 0) {
      const lineStart = content.lastIndexOf("\n", accountIndex) + 1;
      const normalization = `    const normalizedUserMode = userMode.trim().toLowerCase();\n    const normalizedSchoolLocation = schoolLocation?.trim().toLowerCase() ?? "";\n\n    if (normalizedUserMode === "student" && !normalizedSchoolLocation) {\n      throw new Error("School location is required for student accounts");\n    }\n\n`;
      content =
        content.slice(0, lineStart) +
        normalization +
        content.slice(lineStart);
    } else {
      warnings.push("Could not locate createUser normalization block.");
    }
  }

  content = content.replace(
    /userMode,\n(\s*\})/,
    `userMode: normalizedUserMode,\n        ...(normalizedUserMode === "student"\n          ? { schoolLocation: normalizedSchoolLocation }\n          : {}),\n$1`,
  );

  content = content.replace(
    /userMode\?\.toLowerCase\(\)\s*===\s*"tenant"/g,
    'normalizedUserMode === "tenant"',
  );
  content = content.replace(
    /userMode\?\.toLowerCase\(\)\s*===\s*"landlord"/g,
    'normalizedUserMode === "landlord"',
  );

  save(file, content);
}

function patchAuthContext(file) {
  let content = fs.readFileSync(file, "utf8");

  content = addOptionalFieldToInterface(content, "User", "schoolLocation?: string;");
  content = addOptionalFieldToInterface(content, "SignUpData", "schoolLocation?: string;");

  if (!content.includes("const normalizedSchoolLocation =")) {
    content = replaceOne(
      content,
      /(const avatarUrl = userData\.avatar\?\.trim\(\) \|\| getDefaultAvatarUrl\(userData\.name\);)/,
      `$1\n      const normalizedUserMode = userData.userMode.trim().toLowerCase() as\n        | "tenant"\n        | "landlord"\n        | "student";\n      const normalizedSchoolLocation =\n        userData.schoolLocation?.trim().toLowerCase() ?? "";`,
      "AuthContext signup normalization",
    );
  }

  if (!content.includes("School location is required for student accounts")) {
    content = replaceOne(
      content,
      /(return \{ success: false, error: "Please fill in all required fields" \};\n\s*\})/,
      `$1\n\n      if (normalizedUserMode === "student" && !normalizedSchoolLocation) {\n        return {\n          success: false,\n          error: "School location is required for student accounts",\n        };\n      }`,
      "AuthContext student validation",
    );
  }

  content = content.replace(
    /userMode:\s*userData\.userMode,/g,
    `userMode: normalizedUserMode,\n            ...(normalizedUserMode === "student"\n              ? { schoolLocation: normalizedSchoolLocation }\n              : {}),`,
  );

  save(file, content);
}

const packageJson = path.join(ROOT, "package.json");
if (!fs.existsSync(packageJson)) {
  fail("Run this script from the Nookly project root, beside package.json.");
}

const signUpFile = path.join(ROOT, "app", "(auth)", "sign-up.tsx");
const authStoreFile = path.join(ROOT, "store", "auth.store.ts");
const appwriteFile = path.join(ROOT, "lib", "appwrite.ts");
const authContextCandidates = [
  path.join(ROOT, "context", "AuthContext.ts"),
  path.join(ROOT, "context", "AuthContext.tsx"),
];

for (const required of [signUpFile, authStoreFile, appwriteFile]) {
  if (!fs.existsSync(required)) fail(`Missing required file: ${rel(required)}`);
}

patchSignUp(signUpFile);
patchAuthStore(authStoreFile);
patchAppwrite(appwriteFile);

const authContextFile = authContextCandidates.find((candidate) => fs.existsSync(candidate));
if (authContextFile) patchAuthContext(authContextFile);

const report = [
  "NOOKLY STUDENT SCHOOL LOCATION MIGRATION",
  "========================================",
  "",
  `Backup directory: ${backupRoot}`,
  "",
  "Changed files:",
  ...(changed.length ? changed.map((file) => `- ${file}`) : ["- No files changed"]),
  "",
  "Warnings:",
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- None"]),
  "",
  "IMPORTANT APPWRITE STEP:",
  "Add an optional String attribute named schoolLocation to the users collection.",
  "A size of 255 is sufficient. No environment-variable change is needed.",
  "",
].join("\n");

fs.writeFileSync(path.join(ROOT, "student-school-location-report.txt"), report, "utf8");

console.log("\n✅ Student school-location support added.");
console.log(`📦 Backups: ${backupRoot}`);
console.log(`📝 Report: ${path.join(ROOT, "student-school-location-report.txt")}`);
if (warnings.length) {
  console.log("\n⚠️ Warnings:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}
console.log("\nNext commands:");
console.log('  npx prettier --write "app/(auth)/sign-up.tsx" "store/auth.store.ts" "lib/appwrite.ts" "context/AuthContext.ts"');
console.log("  npx tsc --noEmit");
