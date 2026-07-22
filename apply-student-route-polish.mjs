import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = process.cwd();
const templatesRoot = path.join(scriptDir, "student-polish-files");

if (!fs.existsSync(path.join(projectRoot, "package.json"))) {
  console.error("Run this script from the Nookly project root, beside package.json.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  projectRoot,
  ".nookly-backups",
  `student-route-polish-${stamp}`,
);
const changed = [];
const warnings = [];

const isEnvFile = (filePath) => {
  const name = path.basename(filePath);
  return name === ".env" || name.startsWith(".env.");
};

const ensureParent = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const backup = (absolutePath, relativePath) => {
  if (!fs.existsSync(absolutePath)) return;
  const backupPath = path.join(backupRoot, relativePath);
  ensureParent(backupPath);
  fs.copyFileSync(absolutePath, backupPath);
};

const writeProjectFile = (relativePath, content) => {
  if (isEnvFile(relativePath)) {
    warnings.push(`Skipped environment file: ${relativePath}`);
    return;
  }

  const target = path.join(projectRoot, relativePath);
  backup(target, relativePath);
  ensureParent(target);
  fs.writeFileSync(target, content, "utf8");
  changed.push(relativePath);
};

const walkTemplates = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkTemplates(absolute);
      continue;
    }

    const relative = path.relative(templatesRoot, absolute);
    if (isEnvFile(relative)) continue;
    writeProjectFile(relative, fs.readFileSync(absolute, "utf8"));
  }
};

const patchFile = (relativePath, transform) => {
  const absolute = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolute)) {
    warnings.push(`Could not patch missing file: ${relativePath}`);
    return;
  }
  if (isEnvFile(relativePath)) return;

  const before = fs.readFileSync(absolute, "utf8");
  const after = transform(before);

  if (before === after) {
    warnings.push(`No patch was needed or marker was not found: ${relativePath}`);
    return;
  }

  backup(absolute, relativePath);
  fs.writeFileSync(absolute, after, "utf8");
  changed.push(relativePath);
};

walkTemplates(templatesRoot);

for (const relativePath of [
  "store/auth.store.ts",
  "context/AuthContext.ts",
  "context/AuthContext.tsx",
]) {
  patchFile(relativePath, (source) => {
    if (source.includes("schoolLocation?: string;")) return source;
    return source.replace(
      /(\s+phone:\s*string;\s*\n)/,
      `$1  schoolLocation?: string;\n`,
    );
  });
}

patchFile("app/(root)/(student)/s-profile.tsx", (source) => {
  let next = source;

  if (!next.includes('StudentProfileHighlights from "@/components/StudentProfileHighlights"')) {
    next = next.replace(
      'import AvatarSuccessModal from "@/components/AvatarSuccessModal";',
      'import AvatarSuccessModal from "@/components/AvatarSuccessModal";\nimport StudentProfileHighlights from "@/components/StudentProfileHighlights";',
    );
  }

  if (!next.includes("<StudentProfileHighlights")) {
    const marker = "        {/* ✅ Tenant Score Section - INTEGERS ONLY */}";
    const block = `        <StudentProfileHighlights
          user={user}
          favorites={stats.totalFavorites}
          applications={stats.totalApplications}
          viewed={stats.viewedProperties}
          loading={loadingStats}
        />

`;
    next = next.replace(marker, `${block}${marker}`);
  }

  next = next.replace(/(\n\s*)Tenant(\n\s*<\/Text>)/, "$1Student$2");
  next = next.replace("🛡️ Tenant Score", "🛡️ Student Rental Score");
  next = next.replace("No tenant score available yet", "No rental score available yet");
  next = next.replace(
    "Start renting to build your reputation",
    "Complete rentals and receive reviews to build your student rental reputation",
  );
  next = next.replace("My Activity", "My Student Housing Activity");

  return next;
});

// Remove only invalid custom timestamps from the tenant-profile block.
patchFile("lib/appwrite.ts", (source) =>
  source.replace(
    /(screeningStatus:\s*"none",)\s*\n\s*createdAt:\s*now,\s*\n\s*updatedAt:\s*now,/g,
    "$1",
  ),
);

const uniqueChanged = [...new Set(changed)].sort();
const report = [
  "NOOKLY STUDENT ROUTE POLISH REPORT",
  "==================================",
  `Applied: ${new Date().toISOString()}`,
  `Project: ${projectRoot}`,
  `Backup: ${backupRoot}`,
  "",
  "Changed files:",
  ...uniqueChanged.map((file) => `- ${file}`),
  "",
  "Warnings:",
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ["- None"]),
  "",
  "Environment files were not read or changed.",
].join("\n");

fs.writeFileSync(
  path.join(projectRoot, "student-route-polish-report.txt"),
  report,
  "utf8",
);

console.log(report);
console.log("\nNext commands:");
console.log('npx prettier --write "app/**/*.{ts,tsx}" "components/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}"');
console.log("npx tsc --noEmit");
console.log("npx expo start -c");
