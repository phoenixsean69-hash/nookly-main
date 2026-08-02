import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "app",
  "(root)",
  "properties",
  "[id].tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\nRun this script from the Nookly project root.`,
  );
}

const original = fs.readFileSync(targetPath, "utf8");

const oldBlockPattern =
  /return tenantProfiles\.documents\s*\.map\(\(profile\) => \{[\s\S]*?\}\)\s*\.filter\(\s*\(tenant\): tenant is TenantWithProfile =>\s*tenant !== null,\s*\);/m;

const newBlock = `return tenantProfiles.documents.reduce<TenantWithProfile[]>(
        (tenants, profile) => {
          const userDocument = usersByAccountId.get(
            String(profile.userId || ""),
          );

          if (!userDocument) {
            return tenants;
          }

          tenants.push({
            userId: String(profile.userId || ""),
            name: userDocument.name || "Tenant",
            email: userDocument.email || "",
            phone: userDocument.phone || undefined,
            avatar:
              userDocument.avatar ||
              userDocument.customAvatar ||
              undefined,
            tenantScore: Number(profile.tenantScore || 0),
            isIdVerified: Boolean(profile.isIdVerified),
            currentProperty: profile.currentProperty || undefined,
            tenantProfileId: profile.$id,
          });

          return tenants;
        },
        [],
      );`;

if (!oldBlockPattern.test(original)) {
  throw new Error(
    "Could not locate the Step 7 tenant map/filter block. No changes were written.",
  );
}

const updated = original.replace(oldBlockPattern, newBlock);

if (updated === original) {
  throw new Error("No changes were made.");
}

if (updated.includes("tenant is TenantWithProfile")) {
  throw new Error(
    "Validation failed: old type predicate still exists.",
  );
}

if (!updated.includes("reduce<TenantWithProfile[]>")) {
  throw new Error(
    "Validation failed: typed tenant reducer is missing.",
  );
}

const backupPath = `${targetPath}.step7-types-fix.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Step 7 tenant TypeScript fix applied successfully.");
console.log("Updated: app/(root)/properties/[id].tsx");
console.log("Backup: [id].tsx.step7-types-fix.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
