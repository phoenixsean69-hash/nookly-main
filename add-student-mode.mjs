#!/usr/bin/env node

/**
 * Nookly Student Mode Migration
 *
 * Run from the Nookly project root:
 *   node add-student-mode.mjs
 *
 * What it does:
 * - Adds "student" to auth user-mode types.
 * - Adds Student to sign-up mode selection.
 * - Routes students to /s-tenantHome after sign-up/sign-in/app startup.
 * - Makes notification navigation student-aware.
 * - Duplicates app/(root)/(tabs) into app/(root)/(student).
 * - Prefixes every regular student route filename with "s-".
 * - Rewrites copied student routes/imports to their prefixed equivalents.
 * - Treats students as accommodation seekers where existing code checks tenant mode.
 * - Does not read, write, rename, or delete any .env file.
 *
 * Backups are placed in the operating system's temporary directory.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PROJECT_ROOT = process.cwd();
const APP_DIR = path.join(PROJECT_ROOT, "app");
const TABS_DIR = path.join(APP_DIR, "(root)", "(tabs)");
const STUDENT_DIR = path.join(APP_DIR, "(root)", "(student)");
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-");
const BACKUP_DIR = path.join(
  os.tmpdir(),
  `nookly-student-mode-backup-${TIMESTAMP}`,
);
const REPORT_PATH = path.join(PROJECT_ROOT, "student-mode-migration-report.txt");

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx"]);
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".expo",
  ".next",
  ".turbo",
  ".student-mode-backup",
  "android",
  "build",
  "coverage",
  "dist",
  "ios",
  "node_modules",
]);

const changedFiles = [];
const createdFiles = [];
const backedUpFiles = [];
const warnings = [];

function normalizeRelative(filePath) {
  return path.relative(PROJECT_ROOT, filePath).split(path.sep).join("/");
}

function fail(message) {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

function ensureProject() {
  const required = [
    path.join(PROJECT_ROOT, "package.json"),
    path.join(APP_DIR, "_layout.tsx"),
    path.join(APP_DIR, "index.tsx"),
    path.join(APP_DIR, "(auth)", "sign-in.tsx"),
    path.join(APP_DIR, "(auth)", "sign-up.tsx"),
    path.join(PROJECT_ROOT, "store", "auth.store.ts"),
    path.join(TABS_DIR, "_layout.tsx"),
  ];

  const missing = required.filter((filePath) => !fs.existsSync(filePath));

  if (missing.length > 0) {
    fail(
      `Run this script from the Nookly project root.\nMissing:\n${missing
        .map((filePath) => `  - ${normalizeRelative(filePath)}`)
        .join("\n")}`,
    );
  }

  if (fs.existsSync(STUDENT_DIR)) {
    fail(
      `${normalizeRelative(
        STUDENT_DIR,
      )} already exists. Remove it or restore your project before running this migration again.`,
    );
  }
}

function isEnvFile(filePath) {
  const baseName = path.basename(filePath);
  return baseName === ".env" || baseName.startsWith(".env.");
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath) || isEnvFile(filePath)) return;

  const relative = path.relative(PROJECT_ROOT, filePath);
  const destination = path.join(BACKUP_DIR, relative);
  ensureParent(destination);
  fs.copyFileSync(filePath, destination);
  backedUpFiles.push(normalizeRelative(filePath));
}

function writeFile(filePath, content) {
  if (isEnvFile(filePath)) {
    warnings.push(`Skipped environment file: ${normalizeRelative(filePath)}`);
    return;
  }

  const existed = fs.existsSync(filePath);
  const previous = existed ? fs.readFileSync(filePath, "utf8") : null;

  if (previous === content) return;

  if (existed) backupFile(filePath);

  ensureParent(filePath);
  fs.writeFileSync(filePath, content, "utf8");

  if (existed) {
    changedFiles.push(normalizeRelative(filePath));
  } else {
    createdFiles.push(normalizeRelative(filePath));
  }
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];

  const output = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".env")) continue;

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      output.push(...walkFiles(fullPath));
      continue;
    }

    if (entry.isFile()) output.push(fullPath);
  }

  return output;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function addStudentToModeUnions(content) {
  return content
    .replace(
      /"tenant"\s*\|\s*"landlord"(?!\s*\|\s*"student")/g,
      '"tenant" | "landlord" | "student"',
    )
    .replace(
      /'tenant'\s*\|\s*'landlord'(?!\s*\|\s*'student')/g,
      "'tenant' | 'landlord' | 'student'",
    )
    .replace(
      /"landlord"\s*\|\s*"tenant"(?!\s*\|\s*"student")/g,
      '"landlord" | "tenant" | "student"',
    )
    .replace(
      /'landlord'\s*\|\s*'tenant'(?!\s*\|\s*'student')/g,
      "'landlord' | 'tenant' | 'student'",
    );
}

function updateUserModeCopy(content) {
  return content
    .replace(/\btenant or landlord\b/gi, "tenant, student, or landlord")
    .replace(/\btenants and landlords\b/gi, "tenants, students, and landlords")
    .replace(/\blandlords and tenants\b/gi, "landlords, tenants, and students");
}

function expandTenantModeChecks(content) {
  const accessor =
    String.raw`[A-Za-z_$][\w$]*(?:(?:\?\.)|\.)[A-Za-z_$][\w$]*(?:(?:\?\.)|\.[A-Za-z_$][\w$]*)*|[A-Za-z_$][\w$]*`;

  content = content.replace(
    new RegExp(`(${accessor})\\s*===\\s*["']tenant["']`, "g"),
    '($1 === "tenant" || $1 === "student")',
  );

  content = content.replace(
    new RegExp(`(${accessor})\\s*!==\\s*["']tenant["']`, "g"),
    '($1 !== "tenant" && $1 !== "student")',
  );

  content = content.replace(
    /case\s+["']tenant["']\s*:(?!\s*case\s+["']student["']\s*:)/g,
    'case "tenant":\n      case "student":',
  );

  return content;
}

function makeLandlordHomeTernariesStudentAware(content) {
  const accessor =
    String.raw`[A-Za-z_$][\w$]*(?:(?:\?\.)|\.)[A-Za-z_$][\w$]*(?:(?:\?\.)|\.[A-Za-z_$][\w$]*)*`;

  return content.replace(
    new RegExp(
      `(${accessor})\\s*===\\s*["']landlord["']\\s*\\?\\s*["']\\/landHome["']\\s*:\\s*["']\\/tenantHome["']`,
      "g",
    ),
    '$1 === "landlord" ? "/landHome" : $1 === "student" ? "/s-tenantHome" : "/tenantHome"',
  );
}

function updateTenantQueries(content) {
  return content.replace(
    /Query\.equal\(\s*(["'])userMode\1\s*,\s*(["'])tenant\2\s*\)/g,
    'Query.equal("userMode", ["tenant", "student"])',
  );
}

function patchGeneralModeSupport(content, { expandTenantChecks = true } = {}) {
  let result = addStudentToModeUnions(content);
  result = updateUserModeCopy(result);
  result = makeLandlordHomeTernariesStudentAware(result);
  result = updateTenantQueries(result);

  if (expandTenantChecks) {
    result = expandTenantModeChecks(result);
  }

  return result;
}

function addStudentRedirectBranch(content) {
  if (
    content.includes('user.userMode === "student"') &&
    content.includes('router.replace("/s-tenantHome")')
  ) {
    return content;
  }

  const landlordBranch =
    /(\}\s*else if\s*\(\s*user\.userMode\s*===\s*["']landlord["']\s*\)\s*\{\s*router\.replace\(\s*["']\/landHome["']\s*\);\s*\})/;

  if (!landlordBranch.test(content)) {
    warnings.push(
      "Could not automatically locate the landlord redirect branch in an auth screen.",
    );
    return content;
  }

  return content.replace(
    landlordBranch,
    `$1 else if (user.userMode === "student") {
        router.replace("/s-tenantHome");
      }`,
  );
}

function patchSignIn() {
  const filePath = path.join(APP_DIR, "(auth)", "sign-in.tsx");
  let content = fs.readFileSync(filePath, "utf8");

  content = addStudentToModeUnions(content);
  content = addStudentRedirectBranch(content);

  writeFile(filePath, content);
}

function buildModeSelectorBlock(indent = "                ") {
  return `${indent}{/* User Mode Toggle */}
${indent}<View className="mb-4">
${indent}  <Text
${indent}    className="text-sm font-medium mb-2 font-rubik-medium"
${indent}    style={{
${indent}      color: getFieldError("userMode")
${indent}        ? "#EF4444"
${indent}        : theme.muted,
${indent}    }}
${indent}  >
${indent}    Select Your User Mode
${indent}  </Text>

${indent}  <View
${indent}    className="flex-row justify-between rounded-2xl p-1.5"
${indent}    style={{
${indent}      backgroundColor: theme.surface,
${indent}      borderWidth: getFieldError("userMode") ? 1 : 0,
${indent}      borderColor: "#EF4444",
${indent}    }}
${indent}  >
${indent}    {(["tenant", "student", "landlord"] as const).map((mode) => {
${indent}      const isSelected = formData.userMode === mode;

${indent}      return (
${indent}        <TouchableOpacity
${indent}          key={mode}
${indent}          onPress={() => {
${indent}            setFormData({ ...formData, userMode: mode });
${indent}            if (getFieldError("userMode")) clearError("userMode");
${indent}          }}
${indent}          className={\`flex-1 py-3 px-1 rounded-xl items-center \${
${indent}            isSelected ? "bg-blue-600" : ""
${indent}          }\`}
${indent}        >
${indent}          <Text
${indent}            className={\`font-semibold text-xs \${
${indent}              isSelected ? "text-white" : "text-gray-700"
${indent}            }\`}
${indent}          >
${indent}            {mode.charAt(0).toUpperCase() + mode.slice(1)}
${indent}          </Text>
${indent}        </TouchableOpacity>
${indent}      );
${indent}    })}
${indent}  </View>

${indent}  {getFieldError("userMode") && (
${indent}    <Text className="text-red-500 text-xs mt-1 font-rubik">
${indent}      {getFieldError("userMode")}
${indent}    </Text>
${indent}  )}
${indent}</View>

`;
}

function replaceSignUpModeSelector(content) {
  const startMarker = "{/* User Mode Toggle */}";
  const start = content.indexOf(startMarker);

  if (start < 0) {
    warnings.push("Could not locate the sign-up user-mode selector.");
    return content;
  }

  const passwordInputPattern =
    /\s*<CustomInput\s*\n\s*label=["']Password["']/g;
  passwordInputPattern.lastIndex = start;
  const passwordInput = passwordInputPattern.exec(content);

  if (!passwordInput) {
    warnings.push(
      "Could not locate the password field after the sign-up user-mode selector.",
    );
    return content;
  }

  const lineStart = content.lastIndexOf("\n", start) + 1;
  const indentation = content.slice(lineStart, start);
  const passwordStart = passwordInput.index;
  const replacement = buildModeSelectorBlock(indentation);

  return content.slice(0, lineStart) + replacement + content.slice(passwordStart);
}

function patchSignUp() {
  const filePath = path.join(APP_DIR, "(auth)", "sign-up.tsx");
  let content = fs.readFileSync(filePath, "utf8");

  content = addStudentToModeUnions(content);
  content = addStudentRedirectBranch(content);
  content = content.replace(
    /Please select whether you(?:'|’)?re a tenant or landlord/g,
    "Please select whether you're a tenant, student, or landlord",
  );
  content = replaceSignUpModeSelector(content);

  writeFile(filePath, content);
}

function insertAfterBackgroundImages(content, helper) {
  if (content.includes("const getHomeRoute =")) return content;

  const declarationStart = content.indexOf("const backgroundImages");
  if (declarationStart < 0) {
    warnings.push("Could not locate backgroundImages in app/index.tsx.");
    return content;
  }

  const arrayEnd = content.indexOf("];", declarationStart);
  if (arrayEnd < 0) {
    warnings.push("Could not locate the end of backgroundImages.");
    return content;
  }

  const insertionPoint = arrayEnd + 2;
  return (
    content.slice(0, insertionPoint) +
    `\n\n${helper}` +
    content.slice(insertionPoint)
  );
}

function patchIndex() {
  const filePath = path.join(APP_DIR, "index.tsx");
  let content = fs.readFileSync(filePath, "utf8");

  const helper = `const getHomeRoute = (
  userMode: "tenant" | "landlord" | "student",
) => {
  if (userMode === "landlord") return "/landHome";
  if (userMode === "student") return "/s-tenantHome";
  return "/tenantHome";
};`;

  content = insertAfterBackgroundImages(content, helper);

  const navigationPattern =
    /if\s*\(\s*isAuthenticated\s*&&\s*user\?\.userMode\s*\)\s*\{[\s\S]*?\}\s*else if\s*\(\s*localUser\?\.userMode\s*\)\s*\{[\s\S]*?\}\s*else if\s*\(\s*!isLoading\s*\)\s*\{/;

  if (navigationPattern.test(content)) {
    content = content.replace(
      navigationPattern,
      `if (isAuthenticated && user?.userMode) {
        console.log("✅ Online - Authenticated user, navigating...");
        router.replace(getHomeRoute(user.userMode));
      } else if (localUser?.userMode) {
        console.log("📦 Using stored user data for navigation");
        router.replace(getHomeRoute(localUser.userMode));
      } else if (!isLoading) {`,
    );
  } else if (!content.includes("router.replace(getHomeRoute(user.userMode))")) {
    warnings.push(
      "Could not automatically replace the online navigation block in app/index.tsx.",
    );
  }

  content = patchGeneralModeSupport(content);
  content = content.replace(
    "To connect tenants with their perfect space and empower",
    "To connect tenants and students with their perfect space and empower",
  );

  writeFile(filePath, content);
}

function getTopLevelRouteNames(sourceFiles) {
  return sourceFiles
    .map((filePath) => path.relative(TABS_DIR, filePath))
    .filter((relative) => !relative.includes(path.sep))
    .filter((relative) => CODE_EXTENSIONS.has(path.extname(relative)))
    .filter((relative) => !relative.startsWith("_"))
    .filter((relative) => !relative.startsWith("+"))
    .map((relative) => path.basename(relative, path.extname(relative)))
    .sort();
}

function insertRootNavigationHelpers(content, routeNames) {
  if (content.includes("const getModeAwareRoute =")) return content;

  const marker = "export default function RootLayout()";
  const markerIndex = content.indexOf(marker);

  if (markerIndex < 0) {
    warnings.push("Could not locate RootLayout declaration.");
    return content;
  }

  const studentRoutes = routeNames.map((name) => `  "/${name}",`).join("\n");

  const helpers = `type UserMode = "tenant" | "landlord" | "student";

const STUDENT_TAB_ROUTES = new Set<string>([
${studentRoutes}
]);

const getHomeRoute = (userMode?: UserMode) => {
  if (userMode === "landlord") return "/landHome";
  if (userMode === "student") return "/s-tenantHome";
  return "/tenantHome";
};

const getModeAwareRoute = (route: string, userMode?: UserMode) => {
  if (userMode !== "student" || route.startsWith("/s-")) {
    return route;
  }

  const suffixIndex = route.search(/[?#]/);
  const pathname = suffixIndex >= 0 ? route.slice(0, suffixIndex) : route;
  const suffix = suffixIndex >= 0 ? route.slice(suffixIndex) : "";

  if (!STUDENT_TAB_ROUTES.has(pathname)) {
    return route;
  }

  return \`/s-\${pathname.slice(1)}\${suffix}\`;
};

`;

  return content.slice(0, markerIndex) + helpers + content.slice(markerIndex);
}

function patchRootLayout(routeNames) {
  const filePath = path.join(APP_DIR, "_layout.tsx");
  let content = fs.readFileSync(filePath, "utf8");

  content = addStudentToModeUnions(content);

  content = content.replace(
    /const\s+isLandlord\s*=\s*user\?\.userMode\s*===\s*["']landlord["'];?/,
    `const userMode = user?.userMode;
      const homeRoute = getHomeRoute(userMode);`,
  );

  content = content.replace(
    /router\.push\(\s*isLandlord\s*\?\s*["']\/landHome["']\s*:\s*["']\/tenantHome["']\s*\);/g,
    "router.push(homeRoute);",
  );

  content = content.replace(
    /router\.push\(\s*["']\/match["']\s*\);/g,
    'router.push(getModeAwareRoute("/match", userMode) as any);',
  );

  content = content.replace(
    /router\.push\(\s*["']\/explore["']\s*\);/g,
    'router.push(getModeAwareRoute("/explore", userMode) as any);',
  );

  content = content.replace(
    /router\.push\(\s*["']\/tenantHome["']\s*\);/g,
    "router.push(homeRoute);",
  );

  content = content.replace(
    /router\.push\(\s*data\.screen\s+as\s+any\s*\);/g,
    "router.push(getModeAwareRoute(data.screen, userMode) as any);",
  );

  content = insertRootNavigationHelpers(content, routeNames);

  writeFile(filePath, content);
}

function patchAuthStore() {
  const filePath = path.join(PROJECT_ROOT, "store", "auth.store.ts");
  let content = fs.readFileSync(filePath, "utf8");

  content = addStudentToModeUnions(content);
  content = updateUserModeCopy(content);

  writeFile(filePath, content);
}

function getStudentDestination(relativePath) {
  const directory = path.dirname(relativePath);
  const extension = path.extname(relativePath);
  const baseName = path.basename(relativePath, extension);

  let studentBaseName;

  if (baseName === "_layout" || baseName.startsWith("+")) {
    studentBaseName = baseName;
  } else {
    studentBaseName = `s-${baseName}`;
  }

  const destinationName = `${studentBaseName}${extension}`;
  return directory === "." ? destinationName : path.join(directory, destinationName);
}

function resolveMappedImport({
  specifier,
  sourceFile,
  destinationFile,
  sourceToDestination,
}) {
  if (!specifier.startsWith(".")) return specifier;

  const sourceDirectory = path.dirname(sourceFile);
  const rawTarget = path.resolve(sourceDirectory, specifier);
  const candidates = [
    rawTarget,
    ...Array.from(CODE_EXTENSIONS).map((extension) => `${rawTarget}${extension}`),
    ...Array.from(CODE_EXTENSIONS).map((extension) =>
      path.join(rawTarget, `index${extension}`),
    ),
  ];

  const mappedTarget = candidates.find((candidate) =>
    sourceToDestination.has(path.normalize(candidate)),
  );

  if (!mappedTarget) return specifier;

  const destinationTarget = sourceToDestination.get(path.normalize(mappedTarget));
  let relative = path
    .relative(path.dirname(destinationFile), destinationTarget)
    .split(path.sep)
    .join("/");

  if (!relative.startsWith(".")) relative = `./${relative}`;

  const originalHadExtension = CODE_EXTENSIONS.has(path.extname(specifier));
  if (!originalHadExtension) {
    relative = relative.replace(/\.(tsx?|jsx?)$/, "");
    relative = relative.replace(/\/index$/, "");
  }

  return relative;
}

function rewriteRelativeImports(
  content,
  sourceFile,
  destinationFile,
  sourceToDestination,
) {
  const importPattern =
    /(\bfrom\s*|\brequire\(\s*|\bimport\(\s*)(["'])([^"']+)\2/g;

  let result = content.replace(
    importPattern,
    (full, prefix, quote, specifier) => {
      const rewritten = resolveMappedImport({
        specifier,
        sourceFile,
        destinationFile,
        sourceToDestination,
      });

      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );

  const sideEffectImportPattern = /(\bimport\s*)(["'])([^"']+)\2/g;
  result = result.replace(
    sideEffectImportPattern,
    (full, prefix, quote, specifier) => {
      const rewritten = resolveMappedImport({
        specifier,
        sourceFile,
        destinationFile,
        sourceToDestination,
      });

      return `${prefix}${quote}${rewritten}${quote}`;
    },
  );

  return result;
}

function getRoutePath(relativeFile) {
  const extension = path.extname(relativeFile);
  let withoutExtension = relativeFile.slice(0, -extension.length);
  withoutExtension = withoutExtension.split(path.sep).join("/");

  if (withoutExtension.endsWith("/index")) {
    withoutExtension = withoutExtension.slice(0, -"/index".length);
  } else if (withoutExtension === "index") {
    withoutExtension = "";
  }

  return `/${withoutExtension}`.replace(/\/+/g, "/");
}

function buildRouteMap(sourceToDestination) {
  const routeMap = new Map();

  for (const [sourceFile, destinationFile] of sourceToDestination.entries()) {
    const sourceRelative = path.relative(TABS_DIR, sourceFile);
    const destinationRelative = path.relative(STUDENT_DIR, destinationFile);
    const baseName = path.basename(sourceRelative, path.extname(sourceRelative));

    if (
      baseName === "_layout" ||
      baseName.startsWith("+") ||
      !CODE_EXTENSIONS.has(path.extname(sourceRelative))
    ) {
      continue;
    }

    routeMap.set(getRoutePath(sourceRelative), getRoutePath(destinationRelative));
  }

  return routeMap;
}

function rewriteRouteStrings(content, routeMap) {
  const entries = Array.from(routeMap.entries()).sort(
    ([left], [right]) => right.length - left.length,
  );

  let result = content;

  for (const [sourceRoute, studentRoute] of entries) {
    const pattern = new RegExp(
      `(["'\\\`])${escapeRegExp(sourceRoute)}(?=(?:[?#"'\\\`]|$))`,
      "g",
    );
    result = result.replace(
      pattern,
      (full, quote) => `${quote}${studentRoute}`,
    );
  }

  return result;
}

function rewriteTabsLayoutNames(content, routeMap) {
  let result = content;

  result = result.replace(
    /name=(["'])([^"']+)\1/g,
    (full, quote, routeName) => {
      const sourceRoute = `/${routeName}`;
      const destinationRoute = routeMap.get(sourceRoute);
      if (!destinationRoute) return full;

      return `name=${quote}${destinationRoute.slice(1)}${quote}`;
    },
  );

  result = result
    .replace(/\bTabsLayout\b/g, "StudentTabsLayout")
    .replace(
      /const\s+StudentTabsLayout\s*=\s*\(\)\s*=>/,
      "const StudentTabsLayout = () =>",
    );

  return result;
}

function transformStudentFile({
  content,
  sourceFile,
  destinationFile,
  sourceToDestination,
  routeMap,
}) {
  let result = content;

  if (CODE_EXTENSIONS.has(path.extname(sourceFile))) {
    result = rewriteRelativeImports(
      result,
      sourceFile,
      destinationFile,
      sourceToDestination,
    );

    result = result.replace(
      /@\/app\/\(root\)\/\(tabs\)\//g,
      "@/app/(root)/(student)/",
    );

    result = rewriteRouteStrings(result, routeMap);
    result = addStudentToModeUnions(result);
    result = expandTenantModeChecks(result);

    if (path.basename(sourceFile).startsWith("_layout.")) {
      result = rewriteTabsLayoutNames(result, routeMap);
    }
  }

  return result;
}

function duplicateTabsForStudents() {
  const sourceFiles = walkFiles(TABS_DIR);
  const sourceToDestination = new Map();

  for (const sourceFile of sourceFiles) {
    const relative = path.relative(TABS_DIR, sourceFile);
    const studentRelative = getStudentDestination(relative);
    const destination = path.join(STUDENT_DIR, studentRelative);

    sourceToDestination.set(path.normalize(sourceFile), path.normalize(destination));
  }

  const routeMap = buildRouteMap(sourceToDestination);

  for (const [sourceFile, destinationFile] of sourceToDestination.entries()) {
    const isCode = CODE_EXTENSIONS.has(path.extname(sourceFile));

    if (!isCode) {
      ensureParent(destinationFile);
      fs.copyFileSync(sourceFile, destinationFile);
      createdFiles.push(normalizeRelative(destinationFile));
      continue;
    }

    const content = fs.readFileSync(sourceFile, "utf8");
    const transformed = transformStudentFile({
      content,
      sourceFile,
      destinationFile,
      sourceToDestination,
      routeMap,
    });

    writeFile(destinationFile, transformed);
  }

  return {
    sourceFiles,
    routeMap,
    routeNames: getTopLevelRouteNames(sourceFiles),
  };
}

function patchRemainingProjectFiles() {
  const uniqueFiles = walkFiles(PROJECT_ROOT)
    .filter((filePath) => CODE_EXTENSIONS.has(path.extname(filePath)))
    .filter((filePath) => !filePath.startsWith(STUDENT_DIR));

  const specificallyPatched = new Set(
    [
      path.join(APP_DIR, "_layout.tsx"),
      path.join(APP_DIR, "index.tsx"),
      path.join(APP_DIR, "(auth)", "sign-in.tsx"),
      path.join(APP_DIR, "(auth)", "sign-up.tsx"),
      path.join(PROJECT_ROOT, "store", "auth.store.ts"),
    ].map((filePath) => path.normalize(filePath)),
  );

  for (const filePath of uniqueFiles) {
    if (specificallyPatched.has(path.normalize(filePath))) continue;
    if (isEnvFile(filePath)) continue;

    const original = fs.readFileSync(filePath, "utf8");

    if (
      !original.includes("userMode") &&
      !original.includes('"tenant" | "landlord"') &&
      !original.includes("'tenant' | 'landlord'") &&
      !original.includes("/tenantHome")
    ) {
      continue;
    }

    const updated = patchGeneralModeSupport(original);
    writeFile(filePath, updated);
  }
}

function verifyMigration(sourceFiles) {
  const verificationWarnings = [];

  for (const sourceFile of sourceFiles) {
    const relative = path.relative(TABS_DIR, sourceFile);
    const destination = path.join(STUDENT_DIR, getStudentDestination(relative));

    if (!fs.existsSync(destination)) {
      verificationWarnings.push(
        `Missing student copy: ${normalizeRelative(destination)}`,
      );
    }
  }

  const keyFiles = [
    path.join(APP_DIR, "_layout.tsx"),
    path.join(APP_DIR, "index.tsx"),
    path.join(APP_DIR, "(auth)", "sign-in.tsx"),
    path.join(APP_DIR, "(auth)", "sign-up.tsx"),
    path.join(PROJECT_ROOT, "store", "auth.store.ts"),
    path.join(STUDENT_DIR, "_layout.tsx"),
  ];

  for (const filePath of keyFiles) {
    if (!fs.existsSync(filePath)) {
      verificationWarnings.push(`Missing key file: ${normalizeRelative(filePath)}`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf8");
    if (
      !content.toLowerCase().includes("student") &&
      !content.includes('name="s-') &&
      !content.includes("name='s-")
    ) {
      verificationWarnings.push(
        `Student mode was not detected in ${normalizeRelative(filePath)}`,
      );
    }
  }

  const unresolved = [];

  for (const filePath of walkFiles(PROJECT_ROOT)) {
    if (!CODE_EXTENSIONS.has(path.extname(filePath))) continue;

    const content = fs.readFileSync(filePath, "utf8");

    if (
      /["']tenant["']\s*\|\s*["']landlord["'](?!\s*\|\s*["']student["'])/.test(
        content,
      )
    ) {
      unresolved.push(
        `${normalizeRelative(filePath)} still has a tenant/landlord-only type union.`,
      );
    }
  }

  return [...verificationWarnings, ...unresolved];
}

function writeReport({ sourceFiles, routeMap, verificationWarnings }) {
  const lines = [
    "Nookly Student Mode Migration Report",
    "====================================",
    "",
    `Created: ${new Date().toISOString()}`,
    `Project: ${PROJECT_ROOT}`,
    `Backup: ${BACKUP_DIR}`,
    "",
    "Summary",
    "-------",
    `Changed files: ${changedFiles.length}`,
    `Created files: ${createdFiles.length}`,
    `Backed-up files: ${backedUpFiles.length}`,
    `Copied tab files: ${sourceFiles.length}`,
    "",
    "Student route mapping",
    "---------------------",
    ...Array.from(routeMap.entries()).map(
      ([source, destination]) => `${source} -> ${destination}`,
    ),
    "",
    "Changed files",
    "-------------",
    ...(changedFiles.length > 0 ? changedFiles : ["None"]),
    "",
    "Created files",
    "-------------",
    ...(createdFiles.length > 0 ? createdFiles : ["None"]),
    "",
    "Warnings",
    "--------",
    ...([...warnings, ...verificationWarnings].length > 0
      ? [...warnings, ...verificationWarnings]
      : ["None"]),
    "",
    "Environment files",
    "-----------------",
    "No .env file was read, written, renamed, or deleted.",
    "",
    "Recommended checks",
    "------------------",
    "1. npx prettier --write \"app/**/*.{ts,tsx}\" \"store/**/*.{ts,tsx}\"",
    "2. npx tsc --noEmit",
    "3. npx expo start -c",
    "4. Test sign-up and sign-in using userMode=student.",
    "5. Confirm the Appwrite users.userMode attribute accepts the value student.",
    "",
  ];

  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8");
}

function main() {
  console.log("\n🎓 Adding Student Mode to Nookly...\n");
  ensureProject();

  fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const { sourceFiles, routeMap, routeNames } = duplicateTabsForStudents();

  patchAuthStore();
  patchSignIn();
  patchSignUp();
  patchIndex();
  patchRootLayout(routeNames);
  patchRemainingProjectFiles();

  const verificationWarnings = verifyMigration(sourceFiles);
  writeReport({ sourceFiles, routeMap, verificationWarnings });

  console.log("✅ Student mode migration completed.");
  console.log(`\nChanged files: ${changedFiles.length}`);
  console.log(`Created files: ${createdFiles.length}`);
  console.log(`Backup folder: ${BACKUP_DIR}`);
  console.log(`Report: ${REPORT_PATH}`);

  const allWarnings = [...warnings, ...verificationWarnings];
  if (allWarnings.length > 0) {
    console.log("\n⚠️ Review these warnings:");
    for (const warning of allWarnings) {
      console.log(`  - ${warning}`);
    }
  }

  console.log("\nNext, run:");
  console.log('  npx prettier --write "app/**/*.{ts,tsx}" "store/**/*.{ts,tsx}"');
  console.log("  npx tsc --noEmit");
  console.log("  npx expo start -c\n");
}

main();
