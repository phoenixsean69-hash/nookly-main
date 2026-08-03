import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const typesPath = path.join(root, "types", "driver.ts");
const profilePath = path.join(
  root,
  "app",
  "(root)",
  "(driver)",
  "driver-profile.tsx",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const requireFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
};

const backup = (filePath) => {
  const backupPath = `${filePath}.driver-profile-suspension-ui-v1.bak`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) {
    fail(`Could not find ${label}. The file differs from the expected current version.`);
  }
  return source.replace(search, replacement);
};

requireFile(typesPath, "Driver types file");
requireFile(profilePath, "Driver Profile screen");
backup(typesPath);
backup(profilePath);

let types = fs.readFileSync(typesPath, "utf8");

if (!types.includes("suspensionReason?: string;")) {
  types = replaceRequired(
    types,
    `  status: DriverStatus;\n  emergencyContactName?: string;`,
    `  status: DriverStatus;\n  suspensionReason?: string;\n  suspendedAt?: string;\n  suspendedBy?: string;\n  emergencyContactName?: string;`,
    "DriverProfile status fields",
  );
}

fs.writeFileSync(typesPath, types, "utf8");

let profile = fs.readFileSync(profilePath, "utf8");

if (!profile.includes("const formatSuspensionDate")) {
  profile = replaceRequired(
    profile,
    `const formatProfileExpiry = (value?: string): string =>\n  toExpiryInputValue(value) || "Not provided";`,
    `const formatProfileExpiry = (value?: string): string =>\n  toExpiryInputValue(value) || "Not provided";\n\nconst formatSuspensionDate = (value?: string): string => {\n  if (!value?.trim()) return "Not provided";\n\n  const date = new Date(value);\n\n  if (Number.isNaN(date.getTime())) {\n    return value;\n  }\n\n  return date.toLocaleString("en-ZW", {\n    day: "2-digit",\n    month: "short",\n    year: "numeric",\n    hour: "2-digit",\n    minute: "2-digit",\n  });\n};`,
    "profile date-formatting helpers",
  );
}

if (!profile.includes('const isSuspended = profile?.status === "suspended";')) {
  profile = replaceRequired(
    profile,
    `  const profile = dashboard?.profile;\n  const vehicle = dashboard?.vehicles[0];\n  const institution = dashboard?.institutions?.[0];`,
    `  const profile = dashboard?.profile;\n  const vehicle = dashboard?.vehicles[0];\n  const institution = dashboard?.institutions?.[0];\n  const isSuspended = profile?.status === "suspended";`,
    "profile, vehicle and institution variables",
  );
}

if (!profile.includes('profile?.status === "active" &&\n      profile?.verificationStatus')) {
  profile = replaceRequired(
    profile,
    `    () =>\n      profile?.verificationStatus === "verified" &&\n      Boolean(`,
    `    () =>\n      profile?.status === "active" &&\n      profile?.verificationStatus === "verified" &&\n      Boolean(`,
    "Marketplace-ready calculation",
  );
}

if (!profile.includes("      profile?.status,\n      profile?.verificationStatus,")) {
  profile = replaceRequired(
    profile,
    `    [institution, profile?.verificationStatus, vehicle?.status],`,
    `    [\n      institution,\n      profile?.status,\n      profile?.verificationStatus,\n      vehicle?.status,\n    ],`,
    "Marketplace-ready dependencies",
  );
}

if (!profile.includes("const statusColor = isSuspended")) {
  profile = replaceRequired(
    profile,
    `  const statusColor = applicationApproved\n    ? "#848482"\n    : profile?.verificationStatus === "rejected"\n      ? "#DC2626"\n      : "#D97706";`,
    `  const statusColor = isSuspended\n    ? "#DC2626"\n    : applicationApproved\n      ? "#848482"\n      : profile?.verificationStatus === "rejected"\n        ? "#DC2626"\n        : "#D97706";`,
    "profile status colour",
  );
}

if (!profile.includes("const showForm =\n    !isSuspended &&")) {
  profile = replaceRequired(
    profile,
    `  const showForm =\n    showApplicationForm ||\n    (!loading &&\n      !profile &&\n      errorMessage.toLowerCase().includes("no driver profile"));`,
    `  const showForm =\n    !isSuspended &&\n    (showApplicationForm ||\n      (!loading &&\n        !profile &&\n        errorMessage.toLowerCase().includes("no driver profile")));`,
    "application-form visibility calculation",
  );
}

if (!profile.includes('? "Driver suspended"')) {
  profile = replaceRequired(
    profile,
    `              {applicationApproved\n                ? "Marketplace ready"\n                : profile\n                  ? \`${readableStatus(profile.verificationStatus)} verification\`\n                  : "Application incomplete"}`,
    `              {isSuspended\n                ? "Driver suspended"\n                : applicationApproved\n                  ? "Marketplace ready"\n                  : profile\n                    ? \`${readableStatus(profile.verificationStatus)} verification\`\n                    : "Application incomplete"}`,
    "profile status badge",
  );
}

if (!profile.includes("Driver account suspended")) {
  profile = replaceRequired(
    profile,
    `        </View>\n\n        {loading ? (`,
    `        </View>\n\n        {isSuspended && profile && (\n          <View\n            className="mt-5 rounded-2xl border p-5"\n            style={{\n              backgroundColor: "#FEF2F2",\n              borderColor: "#FCA5A5",\n            }}\n          >\n            <View className="flex-row items-start">\n              <View\n                className="h-11 w-11 items-center justify-center rounded-xl"\n                style={{ backgroundColor: "#FEE2E2" }}\n              >\n                <Ionicons name="ban-outline" size={24} color="#DC2626" />\n              </View>\n\n              <View className="ml-3 flex-1">\n                <Text\n                  className="text-lg font-rubik-bold"\n                  style={{ color: "#991B1B" }}\n                >\n                  Driver account suspended\n                </Text>\n                <Text\n                  className="mt-1 text-sm leading-5"\n                  style={{ color: "#7F1D1D" }}\n                >\n                  You cannot receive or operate rides until the organization\n                  reactivates your driver account.\n                </Text>\n              </View>\n            </View>\n\n            <View\n              className="mt-5 rounded-xl p-4"\n              style={{ backgroundColor: "#FFFFFF" }}\n            >\n              <Text\n                className="text-xs font-rubik-medium uppercase"\n                style={{ color: "#B91C1C" }}\n              >\n                Suspension reason\n              </Text>\n              <Text\n                className="mt-2 text-sm leading-5"\n                style={{ color: "#450A0A" }}\n              >\n                {profile.suspensionReason?.trim() ||\n                  "No suspension reason was provided."}\n              </Text>\n            </View>\n\n            <View className="mt-4 gap-3">\n              <View className="flex-row items-start justify-between gap-4">\n                <Text style={{ color: "#7F1D1D" }}>Suspended on</Text>\n                <Text\n                  className="flex-1 text-right font-rubik-medium"\n                  style={{ color: "#450A0A" }}\n                >\n                  {formatSuspensionDate(profile.suspendedAt)}\n                </Text>\n              </View>\n\n              <View className="flex-row items-start justify-between gap-4">\n                <Text style={{ color: "#7F1D1D" }}>Suspended by</Text>\n                <Text\n                  selectable\n                  className="flex-1 text-right font-rubik-medium"\n                  style={{ color: "#450A0A" }}\n                >\n                  {profile.suspendedBy?.trim() ||\n                    institution?.organizationName ||\n                    "Organization administrator"}\n                </Text>\n              </View>\n            </View>\n\n            <TouchableOpacity\n              onPress={() => void loadDashboard()}\n              className="mt-5 flex-row items-center justify-center rounded-xl border py-3"\n              style={{\n                borderColor: "#DC2626",\n                backgroundColor: "#FFFFFF",\n              }}\n            >\n              <Ionicons name="refresh" size={18} color="#DC2626" />\n              <Text\n                className="ml-2 font-rubik-bold"\n                style={{ color: "#DC2626" }}\n              >\n                Check suspension status\n              </Text>\n            </TouchableOpacity>\n          </View>\n        )}\n\n        {loading ? (`,
    "area below the driver identity card",
  );
}

if (!profile.includes("!applicationApproved && profile && !isSuspended")) {
  profile = replaceRequired(
    profile,
    `                {!applicationApproved && profile && (`,
    `                {!applicationApproved && profile && !isSuspended && (`,
    "institution-review warning condition",
  );
}

fs.writeFileSync(profilePath, profile, "utf8");

const patchFilesDirectory = path.join(root, "patch-files");
if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, { recursive: true, force: true });
}

const finalTypes = fs.readFileSync(typesPath, "utf8");
const finalProfile = fs.readFileSync(profilePath, "utf8");

for (const marker of [
  "suspensionReason?: string;",
  "suspendedAt?: string;",
  "suspendedBy?: string;",
]) {
  if (!finalTypes.includes(marker)) fail(`Type validation failed: missing ${marker}`);
}

for (const marker of [
  'const isSuspended = profile?.status === "suspended";',
  'profile?.status === "active"',
  "Driver account suspended",
  "Suspension reason",
  "formatSuspensionDate(profile.suspendedAt)",
  "profile.suspendedBy?.trim()",
  "!applicationApproved && profile && !isSuspended",
]) {
  if (!finalProfile.includes(marker)) fail(`Profile validation failed: missing ${marker}`);
}

console.log(`
Nookly Driver Profile suspension UI applied.

Updated:
- types/driver.ts
- app/(root)/(driver)/driver-profile.tsx

Behaviour:
- Suspended drivers are never labelled Marketplace ready.
- The header badge changes to Driver suspended.
- A suspension panel shows reason, date/time, and suspended-by.
- Application editing and the generic review warning are hidden while suspended.
- Existing profile details, vehicle information, refresh, and Sign out remain available.

No Function deployment is required.
No new package or APK build is required.

Next run:
npx tsc --noEmit
`);
