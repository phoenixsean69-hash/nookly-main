#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || "").trim() : "";
}

function fail(message) {
  console.error("\n❌ STAGE 1 INSTALL FAILED");
  console.error(message);
  process.exit(1);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function runCmd(cwd, command) {
  return spawnSync(
    "cmd.exe",
    ["/d", "/s", "/c", command],
    {
      cwd,
      encoding: "utf8",
      windowsHide: false,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
}

const profile = process.env.USERPROFILE || "";
const projectRoot =
  arg("--mobile-project") ||
  path.join(profile, "Desktop", "nookly-with-students");

if (!fs.existsSync(projectRoot)) {
  fail(`Mobile project not found:\n${projectRoot}`);
}

const packageJsonPath = path.join(projectRoot, "package.json");
const addPropertyPath = path.join(
  projectRoot,
  "app",
  "(root)",
  "(landlord)",
  "addProperty.tsx",
);
const appwritePath = path.join(projectRoot, "lib", "appwrite.ts");

for (const required of [
  packageJsonPath,
  addPropertyPath,
  appwritePath,
]) {
  if (!fs.existsSync(required)) {
    fail(`Required file missing:\n${required}`);
  }
}

const helperSource = path.join(
  __dirname,
  "propertyVideoCompression.ts",
);
if (!fs.existsSync(helperSource)) {
  fail(
    "propertyVideoCompression.ts is missing beside the installer. Re-extract the ZIP.",
  );
}

const helperDestination = path.join(
  projectRoot,
  "lib",
  "propertyVideoCompression.ts",
);

const backupRoot = path.join(
  projectRoot,
  ".nookly-backups",
  "landlord-video-compression-stage1-v1",
  timestamp(),
);
ensureDir(backupRoot);

for (const relative of [
  "package.json",
  "package-lock.json",
  path.join("lib", "propertyVideoCompression.ts"),
]) {
  const source = path.join(projectRoot, relative);
  if (!fs.existsSync(source)) continue;

  const destination = path.join(backupRoot, relative);
  ensureDir(path.dirname(destination));
  fs.copyFileSync(source, destination);
}

console.log("");
console.log("# Nookly Landlord Video Compression — Stage 1 v1");
console.log("");
console.log(`Project: ${projectRoot}`);
console.log(`Backup:  ${backupRoot}`);

console.log(
  "\n📦 Installing @bsky.app/video-compressor@0.2.0...",
);

const install = runCmd(
  projectRoot,
  "npm install @bsky.app/video-compressor@0.2.0 --save-exact",
);

if (install.stdout) process.stdout.write(install.stdout);
if (install.stderr) process.stderr.write(install.stderr);

if (install.status !== 0) {
  fail(
    `npm install exited with code ${install.status}. No addProperty/appwrite integration was attempted.`,
  );
}

ensureDir(path.dirname(helperDestination));
fs.copyFileSync(helperSource, helperDestination);

console.log("\n✅ Compression service installed:");
console.log("- lib/propertyVideoCompression.ts");

const packageJson = JSON.parse(
  fs.readFileSync(packageJsonPath, "utf8"),
);
const installedVersion =
  packageJson.dependencies?.["@bsky.app/video-compressor"];

const helperText = fs.readFileSync(
  helperDestination,
  "utf8",
);

const checks = [
  [
    "Pinned compressor dependency is 0.2.0",
    installedVersion === "0.2.0",
  ],
  [
    "500 MB source safety limit",
    helperText.includes(
      "maximumSourceBytes: 500 * 1024 * 1024",
    ),
  ],
  [
    "90 second duration limit",
    helperText.includes(
      "maximumDurationSeconds: 90",
    ),
  ],
  [
    "18 MB compressed-file limit",
    helperText.includes(
      "maximumOutputBytes: 18 * 1024 * 1024",
    ),
  ],
  [
    "1 Mbps target video bitrate",
    helperText.includes(
      "targetVideoBitrate: 1_000_000",
    ),
  ],
  [
    "1280 px long-edge / 720p envelope",
    helperText.includes(
      "maximumLongEdge: 1280",
    ),
  ],
  [
    "30 FPS cap",
    helperText.includes(
      "maximumFrameRate: 30",
    ),
  ],
  [
    "Forced H.264 encode",
    helperText.includes('codec: "h264"'),
  ],
  [
    "Small inputs are not passed through unchanged",
    helperText.includes(
      "passthroughBelowBytes: 0",
    ),
  ],
  [
    "MP4 output verification",
    helperText.includes(
      'outputMimeType: "video/mp4"',
    ),
  ],
  [
    "Progress callback exposed",
    helperText.includes(
      "onProgress?: (progress: number) => void",
    ),
  ],
];

console.log("\nStatic verification:");

let verificationFailed = false;
for (const [label, passed] of checks) {
  console.log(`${passed ? "✅" : "❌"} ${label}`);
  if (!passed) verificationFailed = true;
}

if (verificationFailed) {
  fail("One or more Stage 1 source checks failed.");
}

console.log("\n🔎 Running TypeScript...");

const tsc = runCmd(projectRoot, "npx tsc --noEmit");

if (tsc.stdout) process.stdout.write(tsc.stdout);
if (tsc.stderr) process.stderr.write(tsc.stderr);

if (tsc.status === 0) {
  console.log("\n✅ TypeScript passed.");
} else {
  console.log(`\n⚠️ TypeScript exited with code ${tsc.status}.`);
  console.log(
    "Do not continue to Stage 2 yet. Paste the complete TypeScript output.",
  );
}

console.log("");
console.log("=======================================");
console.log("STAGE 1 RESULT");
console.log("=======================================");
console.log(
  "✅ Mobile video compression dependency installed.",
);
console.log(
  "✅ Central Nookly property-video policy/helper installed.",
);
console.log(
  "✅ addProperty.tsx was NOT modified in this stage.",
);
console.log(
  "✅ lib/appwrite.ts was NOT modified in this stage.",
);
console.log(
  "✅ No Appwrite file/document was created, changed, or deleted.",
);
console.log("");
console.log(
  "IMPORTANT: this compressor contains native mobile code.",
);
console.log(
  "After Stage 2 source integration, rebuild the Expo development client before runtime compression testing.",
);
