import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "app",
  "(root)",
  "(landlord)",
  "landProfile.tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\n` +
      "Run this script from the Nookly project root.",
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

const replaceRequired = (
  pattern,
  replacement,
  label,
) => {
  if (typeof pattern === "string") {
    if (!updated.includes(pattern)) {
      throw new Error(
        `Could not locate ${label}. No file was written.`,
      );
    }

    updated = updated.replace(pattern, replacement);
    return;
  }

  if (!pattern.test(updated)) {
    throw new Error(
      `Could not locate ${label}. No file was written.`,
    );
  }

  updated = updated.replace(pattern, replacement);
};

// Remove the direct AsyncStorage cleanup. The auth store owns session/cache
// cleanup and already handles the account-scoped caches added in Steps 11–12.
updated = updated.replace(
  'import AsyncStorage from "@react-native-async-storage/async-storage";\n',
  "",
);

// Stop importing the lightweight standalone Appwrite logout helper.
replaceRequired(
  /import \{\s*config,\s*databases,\s*logout,\s*uploadImage\s*\} from "@\/lib\/appwrite";/,
  'import { config, databases, uploadImage } from "@/lib/appwrite";',
  "the landlord Appwrite import",
);

// Use the same complete signOut path as the other account modes.
replaceRequired(
  "  const { user, fetchAuthenticatedUser } = useAuthStore();",
  "  const { user, fetchAuthenticatedUser, signOut } = useAuthStore();",
  "the landlord auth-store selector",
);

replaceRequired(
  /  const handleLogout = async \(\) => \{\s*Alert\.alert\("Logout", "Are you sure you want to logout\?", \[\s*\{ text: "Cancel", style: "cancel" \},\s*\{\s*text: "Logout",\s*style: "destructive",\s*onPress: async \(\) => \{\s*setLogoutLoading\(true\);\s*try \{[\s\S]*?\}\s*finally \{\s*setLogoutLoading\(false\);\s*\}\s*\},\s*\},\s*\]\);\s*\};/m,
`  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            setLogoutLoading(true);

            try {
              // Prevent a locally selected avatar from leaking into
              // another account on the same device.
              await clearSavedAvatar();

              const result = await signOut();

              if (!result.success) {
                throw new Error(
                  result.error || "Failed to logout",
                );
              }

              router.replace("/sign-in");
            } catch (error) {
              console.error(
                "Landlord logout error:",
                error,
              );

              Alert.alert(
                "Error",
                error instanceof Error
                  ? error.message
                  : "Failed to logout. Please try again.",
              );
            } finally {
              setLogoutLoading(false);
            }
          },
        },
      ],
    );
  };`,
  "the landlord logout handler",
);

// Validation.
if (updated === original) {
  throw new Error("No changes were made.");
}

if (updated.includes("logout, uploadImage")) {
  throw new Error(
    "Validation failed: standalone Appwrite logout is still imported.",
  );
}

if (updated.includes("await logout()")) {
  throw new Error(
    "Validation failed: landlord profile still calls standalone logout().",
  );
}

if (updated.includes("AsyncStorage.multiRemove")) {
  throw new Error(
    "Validation failed: duplicate manual logout storage cleanup remains.",
  );
}

if (!updated.includes("const result = await signOut();")) {
  throw new Error(
    "Validation failed: auth-store signOut is missing.",
  );
}

if (
  !updated.includes(
    "const { user, fetchAuthenticatedUser, signOut } = useAuthStore();",
  )
) {
  throw new Error(
    "Validation failed: signOut was not selected from the auth store.",
  );
}

const backupPath = `${targetPath}.landlord-logout-fix.bak`;

fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Landlord logout fix applied successfully.");
console.log("");
console.log("Updated:");
console.log("- app/(root)/(landlord)/landProfile.tsx");
console.log("");
console.log("Backup:");
console.log("- landProfile.tsx.landlord-logout-fix.bak");
console.log("");
console.log("Landlord logout now uses useAuthStore().signOut().");
console.log("Now run: npx tsc --noEmit");
