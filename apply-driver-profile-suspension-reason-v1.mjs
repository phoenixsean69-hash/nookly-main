import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
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

if (!fs.existsSync(profilePath)) {
  fail(`Driver Profile was not found at ${profilePath}`);
}

const backupPath = `${profilePath}.suspension-reason-card-v1.bak`;
if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(profilePath, backupPath);
}

let source = fs.readFileSync(profilePath, "utf8");

const replaceRequired = (search, replacement, label) => {
  if (!source.includes(search)) {
    fail(`Could not find ${label}. The file differs from the expected current version.`);
  }
  source = source.replace(search, replacement);
};

if (!source.includes("const suspensionReason =")) {
  replaceRequired(
    '  const isSuspended = profile?.status === "suspended";',
    '  const isSuspended =\n' +
      '    profile?.status === "suspended" ||\n' +
      '    institution?.status === "suspended";\n' +
      '  const suspensionReason =\n' +
      '    profile?.suspensionReason?.trim() ||\n' +
      '    institution?.notes?.trim() ||\n' +
      '    "No suspension reason was provided.";',
    "the suspension-state declaration",
  );
}

const standalonePanelPattern = /\n        \{isSuspended && profile && \(\n[\s\S]*?\n        \)\}\n\n        \{loading \? \(/;
if (standalonePanelPattern.test(source)) {
  source = source.replace(standalonePanelPattern, "\n\n        {loading ? (");
}

source = source.replace(
  "{!applicationApproved && profile && !isSuspended && (",
  "{!applicationApproved && profile && (",
);

const oldIcon =
  '                        name={\n' +
  '                          profile.verificationStatus === "rejected"\n' +
  '                            ? "close-circle-outline"\n' +
  '                            : "time-outline"\n' +
  '                        }';
const newIcon =
  '                        name={\n' +
  '                          isSuspended\n' +
  '                            ? "ban-outline"\n' +
  '                            : profile.verificationStatus === "rejected"\n' +
  '                              ? "close-circle-outline"\n' +
  '                              : "time-outline"\n' +
  '                        }';
if (!source.includes(newIcon)) {
  replaceRequired(oldIcon, newIcon, "the profile status-card icon");
}

const oldTitle =
  '                          {profile.verificationStatus === "rejected"\n' +
  '                            ? "Application needs changes"\n' +
  '                            : "Institution review pending"}';
const newTitle =
  '                          {isSuspended\n' +
  '                            ? "Driver account suspended"\n' +
  '                            : profile.verificationStatus === "rejected"\n' +
  '                              ? "Application needs changes"\n' +
  '                              : "Institution review pending"}';
if (!source.includes(newTitle)) {
  replaceRequired(oldTitle, newTitle, "the Institution review pending title");
}

const oldDescription =
  '                          {institution?.organizationName || "Your institution"}\n' +
  '                          {\n' +
  '                            " reviews this application through Nookly Web. You cannot receive student ride requests until both the driver and vehicle are approved."\n' +
  '                          }';
const newDescription =
  '                          {isSuspended ? (\n' +
  '                            suspensionReason\n' +
  '                          ) : (\n' +
  '                            <>\n' +
  '                              {institution?.organizationName ||\n' +
  '                                "Your institution"}\n' +
  '                              {\n' +
  '                                " reviews this application through Nookly Web. You cannot receive student ride requests until both the driver and vehicle are approved."\n' +
  '                              }\n' +
  '                            </>\n' +
  '                          )}';
if (!source.includes(newDescription)) {
  replaceRequired(oldDescription, newDescription, "the institution-review description");
}

const updateButtonPattern = /(\n                    <TouchableOpacity\n                      onPress=\{\(\) => setShowApplicationForm\(true\)\}[\s\S]*?\n                    <\/TouchableOpacity>)/;
if (!source.includes("{!isSuspended && (\n                    <TouchableOpacity\n                      onPress={() => setShowApplicationForm(true)}")) {
  const buttonMatch = source.match(updateButtonPattern);
  if (!buttonMatch) {
    fail("Could not locate the status-card Update application button.");
  }
  source = source.replace(
    buttonMatch[1],
    "\n                    {!isSuspended && (" + buttonMatch[1] + "\n                    )}",
  );
}

fs.writeFileSync(profilePath, source, "utf8");

const patchFilesDirectory = path.join(root, "patch-files");
if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, { recursive: true, force: true });
}

const finalSource = fs.readFileSync(profilePath, "utf8");
for (const marker of [
  'institution?.status === "suspended"',
  "const suspensionReason =",
  '? "Driver account suspended"',
  "{!applicationApproved && profile && (",
  "{!isSuspended && (",
]) {
  if (!finalSource.includes(marker)) {
    fail(`Final validation failed: missing ${marker}`);
  }
}

console.log(`
Nookly Driver Profile suspension-reason card applied.

Updated:
- app/(root)/(driver)/driver-profile.tsx

When suspended:
- The status card says Driver account suspended.
- Institution review pending is not shown.
- The real suspension reason is displayed.
- The Update application button is hidden.
- Suspension is detected from the driver status or institution status.

No Function deployment is required.
No APK rebuild is required.

Next run:
npx tsc --noEmit
`);
