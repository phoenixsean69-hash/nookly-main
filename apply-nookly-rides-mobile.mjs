#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const studentLayoutPath = path.join(
  projectRoot,
  "app",
  "(root)",
  "(student)",
  "_layout.tsx",
);
const studentHomePath = path.join(
  projectRoot,
  "app",
  "(root)",
  "(student)",
  "s-tenantHome.tsx",
);

const requiredNewFiles = [
  path.join(projectRoot, "types", "rides.ts"),
  path.join(projectRoot, "services", "rides.service.ts"),
  path.join(projectRoot, "components", "rides", "RideCard.tsx"),
  path.join(projectRoot, "components", "rides", "RidesHomeBanner.tsx"),
  path.join(projectRoot, "app", "(root)", "(student)", "s-rides.tsx"),
  path.join(projectRoot, "app", "(root)", "(student)", "s-ride-details.tsx"),
];

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function ensureFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at:\n${filePath}`);
  }
}

function createBackup(files) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupRoot = path.join(
    projectRoot,
    ".nookly-backups",
    `rides-mobile-${timestamp}`,
  );

  for (const filePath of files) {
    const relativePath = path.relative(projectRoot, filePath);
    const backupPath = path.join(backupRoot, relativePath);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    fs.copyFileSync(filePath, backupPath);
  }

  console.log(`✓ Backup created: ${path.relative(projectRoot, backupRoot)}`);
}

function patchStudentHome() {
  let content = fs.readFileSync(studentHomePath, "utf8");
  let changed = false;

  if (!content.includes('import RidesHomeBanner from "@/components/rides/RidesHomeBanner";')) {
    const importAnchor = 'import QuickActions from "@/components/QuickActions";';
    if (!content.includes(importAnchor)) {
      fail("Could not find the QuickActions import in s-tenantHome.tsx.");
    }

    content = content.replace(
      importAnchor,
      `${importAnchor}\nimport RidesHomeBanner from "@/components/rides/RidesHomeBanner";`,
    );
    changed = true;
  }

  if (!content.includes("<RidesHomeBanner schoolLocation={schoolLocation} />")) {
    const bannerAnchor = `        </View>\n\n        <View className="mb-5">\n          <QuickActions />\n        </View>`;

    if (!content.includes(bannerAnchor)) {
      fail(
        "Could not find the QuickActions section in s-tenantHome.tsx. The file may have changed since the repo check.",
      );
    }

    content = content.replace(
      bannerAnchor,
      `        </View>\n\n        <RidesHomeBanner schoolLocation={schoolLocation} />\n\n        <View className="mb-5">\n          <QuickActions />\n        </View>`,
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(studentHomePath, content, "utf8");
    console.log("✓ Updated student home with the Nookly Rides banner");
  } else {
    console.log("✓ Student home already contains the Nookly Rides banner");
  }
}

function patchStudentLayout() {
  let content = fs.readFileSync(studentLayoutPath, "utf8");

  if (
    content.includes('name="s-rides"') &&
    content.includes('name="s-ride-details"')
  ) {
    console.log("✓ Student navigation already contains the Rides screens");
    return;
  }

  const layoutAnchor = `      <Tabs.Screen\n        name="s-profile"`;
  if (!content.includes(layoutAnchor)) {
    fail(
      "Could not find the s-profile navigation entry in the student layout. The file may have changed since the repo check.",
    );
  }

  const ridesScreens = `      <Tabs.Screen
        name="s-rides"
        options={{
          href: null,
          title: "Rides",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="s-ride-details"
        options={{
          href: null,
          title: "Ride details",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

`;

  content = content.replace(layoutAnchor, `${ridesScreens}${layoutAnchor}`);
  fs.writeFileSync(studentLayoutPath, content, "utf8");
  console.log("✓ Added Rides screens to student navigation");
}

function verifyEnvironmentFile() {
  const envPath = path.join(projectRoot, ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("! .env was not found. Add the Nookly Rides environment variables before testing.");
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const requiredVariables = [
    "EXPO_PUBLIC_APPWRITE_RIDE_ROUTES_COLLECTION_ID",
    "EXPO_PUBLIC_APPWRITE_RIDE_STOPS_COLLECTION_ID",
    "EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID",
  ];
  const missing = requiredVariables.filter(
    (variable) => !new RegExp(`^${variable}=.+$`, "m").test(envContent),
  );

  if (missing.length > 0) {
    console.warn(`! Missing from .env: ${missing.join(", ")}`);
  } else {
    console.log("✓ Required Rides environment variables are present");
  }
}

console.log("\nInstalling the Nookly Rides mobile batch...\n");

ensureFileExists(studentLayoutPath, "Student navigation layout");
ensureFileExists(studentHomePath, "Student home screen");
requiredNewFiles.forEach((filePath) =>
  ensureFileExists(filePath, path.relative(projectRoot, filePath)),
);

createBackup([studentLayoutPath, studentHomePath]);
patchStudentHome();
patchStudentLayout();
verifyEnvironmentFile();

console.log("\n✓ Nookly Rides mobile batch installed successfully.\n");
console.log("Next verification command:");
console.log("npx tsc --noEmit\n");
