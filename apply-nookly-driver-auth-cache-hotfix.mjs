#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const payloadRoot = path.join(root, "nookly-driver-auth-cache-files");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `driver-auth-cache-${timestamp}`,
);

const touchedFiles = [
  "app/(auth)/sign-up.tsx",
  "context/AuthContext.ts",
  "lib/appwrite.ts",
  "lib/offline/types.ts",
  "services/localDatabase.service.ts",
  "store/auth.store.ts",
];

const replaceOnce = (content, oldValue, newValue, label) => {
  const index = content.indexOf(oldValue);

  if (index < 0) {
    throw new Error(`Could not find ${label}. The file may have changed.`);
  }

  if (content.indexOf(oldValue, index + oldValue.length) >= 0) {
    throw new Error(
      `Found more than one ${label}. Refusing an ambiguous replacement.`,
    );
  }

  return (
    content.slice(0, index) +
    newValue +
    content.slice(index + oldValue.length)
  );
};

const replaceExpectedCount = (
  content,
  oldValue,
  newValue,
  expectedCount,
  label,
) => {
  const actualCount = content.split(oldValue).length - 1;

  if (actualCount !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} ${label}, but found ${actualCount}.`,
    );
  }

  return content.split(oldValue).join(newValue);
};

const backupFiles = async () => {
  for (const relativePath of touchedFiles) {
    const source = path.join(root, relativePath);
    const destination = path.join(backupRoot, relativePath);

    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
};

const installFullReplacement = async (relativePath) => {
  const source = path.join(payloadRoot, relativePath);
  const destination = path.join(root, relativePath);

  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
  console.log(`✓ Installed ${relativePath}`);
};

const patchSignUp = async () => {
  const relativePath = "app/(auth)/sign-up.tsx";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  content = replaceOnce(
    content,
    'import { getUserHomeRoute, TenantType } from "@/lib/userMode";',
    'import {\n  getUserHomeRoute,\n  PrimaryUserMode,\n  TenantType,\n} from "@/lib/userMode";',
    "sign-up userMode import",
  );

  content = replaceOnce(
    content,
    '\ntype PrimaryUserMode = "tenant" | "landlord";\n',
    "\n",
    "old local PrimaryUserMode type",
  );

  content = replaceOnce(
    content,
    `interface TenantOption {
  value: TenantType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}
`,
    `interface TenantOption {
  value: TenantType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ModeOption {
  value: PrimaryUserMode;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}
`,
    "sign-up mode option interface location",
  );

  content = replaceOnce(
    content,
    `];

const getInitials = (name: string): string =>`,
    `];

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "tenant",
    title: "Tenant",
    description: "Find and manage a place to live.",
    icon: "home-outline",
  },
  {
    value: "landlord",
    title: "Landlord",
    description: "List properties and manage tenants.",
    icon: "business-outline",
  },
  {
    value: "driver",
    title: "Driver",
    description:
      "Manage assigned rides after your driver profile is verified.",
    icon: "car-sport-outline",
  },
];

const getInitials = (name: string): string =>`,
    "MODE_OPTIONS insertion point",
  );

  content = replaceOnce(
    content,
    `  const { signUp, updateUser } = useAuthStore();`,
    `  const signUp = useAuthStore((state) => state.signUp);`,
    "sign-up auth-store selector",
  );

  content = replaceOnce(
    content,
    `        message: "Choose whether you are a tenant or landlord.",`,
    `        message: "Choose whether you are a tenant, landlord or driver.",`,
    "sign-up mode validation message",
  );

  content = replaceOnce(
    content,
    `      const signupResult = await signUp({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        userMode: formData.userMode as any,
        avatar: uploadedAvatarUrl,
      });`,
    `      const signupResult = await signUp({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        userMode: formData.userMode,
        tenantType:
          formData.userMode === "tenant" && formData.tenantType
            ? formData.tenantType
            : undefined,
        schoolLocation:
          formData.userMode === "tenant" &&
          formData.tenantType === "student"
            ? formData.schoolLocation.trim()
            : undefined,
        avatar: uploadedAvatarUrl,
      });`,
    "sign-up payload",
  );

  content = replaceOnce(
    content,
    `      let destinationUser: Record<string, unknown> = {
        userMode: formData.userMode,
      };

      if (formData.userMode === "tenant") {
        const tenantUpdates: Record<string, unknown> = {
          tenantType: formData.tenantType,
        };

        if (formData.tenantType === "student") {
          // Store the selected canonical institution name as a normal string.
          tenantUpdates.schoolLocation = formData.schoolLocation.trim();
        }

        const updateResult = await updateUser(tenantUpdates as any);

        if (!updateResult.success) {
          throw new Error(
            \`\${updateResult.error || "The tenant details could not be saved."} \` +
              "Confirm that tenantType and schoolLocation exist in the Appwrite users collection.",
          );
        }

        destinationUser = {
          ...destinationUser,
          ...tenantUpdates,
        };
      }
`,
    `      const destinationUser: Record<string, unknown> = {
        userMode: formData.userMode,
        ...(formData.userMode === "tenant" && formData.tenantType
          ? { tenantType: formData.tenantType }
          : {}),
        ...(formData.userMode === "tenant" &&
        formData.tenantType === "student"
          ? { schoolLocation: formData.schoolLocation.trim() }
          : {}),
      };
`,
    "two-stage tenant update block",
  );

  content = replaceOnce(
    content,
    `                  <View className="flex-row gap-3">
                    {(["tenant", "landlord"] as const).map((mode) => {
                      const selected = formData.userMode === mode;

                      return (
                        <TouchableOpacity
                          key={mode}
                          activeOpacity={0.85}
                          onPress={() => {
                            updateField("userMode", mode);

                            if (mode === "landlord") {
                              setFormData((current) => ({
                                ...current,
                                userMode: mode,
                                tenantType: "",
                                schoolLocation: "",
                              }));
                              setValidationErrors((current) =>
                                current.filter(
                                  (error) =>
                                    error.field !== "tenantType" &&
                                    error.field !== "schoolLocation" &&
                                    error.field !== "userMode",
                                ),
                              );
                            }
                          }}
                          className="flex-1 rounded-2xl p-4 items-center"
                          style={{
                            backgroundColor: selected
                              ? theme.primary[300]
                              : theme.surface,
                            borderWidth: 1,
                            borderColor: selected
                              ? theme.primary[300]
                              : \`\${theme.muted}30\`,
                          }}
                        >
                          <Text
                            className="font-rubik-bold capitalize"
                            style={{
                              color: selected ? "#FFFFFF" : theme.title,
                            }}
                          >
                            {mode}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>`,
    `                  <View className="gap-3">
                    {MODE_OPTIONS.map((option) => {
                      const selected = formData.userMode === option.value;

                      return (
                        <TouchableOpacity
                          key={option.value}
                          activeOpacity={0.85}
                          onPress={() => {
                            setFormData((current) => ({
                              ...current,
                              userMode: option.value,
                              ...(option.value === "tenant"
                                ? {}
                                : {
                                    tenantType: "",
                                    schoolLocation: "",
                                  }),
                            }));

                            setValidationErrors((current) =>
                              current.filter(
                                (error) =>
                                  error.field !== "tenantType" &&
                                  error.field !== "schoolLocation" &&
                                  error.field !== "userMode",
                              ),
                            );
                          }}
                          className="rounded-2xl p-4 flex-row items-center"
                          style={{
                            backgroundColor: selected
                              ? \`\${theme.primary[300]}12\`
                              : theme.surface,
                            borderWidth: 1.5,
                            borderColor: selected
                              ? theme.primary[300]
                              : \`\${theme.muted}28\`,
                          }}
                        >
                          <View
                            className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                            style={{
                              backgroundColor: selected
                                ? theme.primary[300]
                                : \`\${theme.primary[300]}12\`,
                            }}
                          >
                            <Ionicons
                              name={option.icon}
                              size={22}
                              color={
                                selected ? "#FFFFFF" : theme.primary[300]
                              }
                            />
                          </View>

                          <View className="flex-1">
                            <Text
                              className="font-rubik-bold"
                              style={{ color: theme.title }}
                            >
                              {option.title}
                            </Text>
                            <Text
                              className="text-xs mt-1"
                              style={{ color: theme.muted }}
                            >
                              {option.description}
                            </Text>
                          </View>

                          <Ionicons
                            name={
                              selected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={
                              selected ? theme.primary[300] : theme.muted
                            }
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>`,
    "tenant/landlord mode selector",
  );

  content = replaceOnce(
    content,
    `          message="Your personalised Nookly account is ready."`,
    `          message={
            formData.userMode === "driver"
              ? "Your driver account is ready. Ride access starts after your driver profile is verified and assigned."
              : "Your personalised Nookly account is ready."
          }`,
    "sign-up success message",
  );

  await writeFile(filePath, content, "utf8");
  console.log(`✓ Added first-class driver sign-up to ${relativePath}`);
};

const patchAuthStore = async () => {
  const relativePath = "store/auth.store.ts";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  content = replaceOnce(content, "interface User {", "export interface User {", "User export");
  content = replaceOnce(
    content,
    "interface Organization {",
    "export interface Organization {",
    "Organization export",
  );
  content = replaceOnce(
    content,
    "interface SignUpData {",
    "export interface SignUpData {",
    "SignUpData export",
  );
  content = replaceOnce(
    content,
    "interface AuthState {",
    "export interface AuthState {",
    "AuthState export",
  );

  content = replaceOnce(
    content,
    `  let tenantType =
    normalizeTenantType(candidate.tenantType) ||
    normalizeTenantType(sameAccountFallback?.tenantType);

  if (userMode === "student") tenantType = "student";

  const schoolLocation =
    candidate.schoolLocation || sameAccountFallback?.schoolLocation;

  // Old student accounts may already have been changed to userMode="tenant"
  // while an older cache/server document still lacks tenantType.
  if (userMode === "tenant" && !tenantType && schoolLocation?.trim()) {
    tenantType = "student";
  }

  return {
    ...(sameAccountFallback || {}),
    ...candidate,
    userMode,
    ...(tenantType ? { tenantType } : {}),
    ...(schoolLocation ? { schoolLocation } : {}),
  };`,
    `  const isTenantLike = userMode === "tenant" || userMode === "student";

  let tenantType = isTenantLike
    ? normalizeTenantType(candidate.tenantType) ||
      normalizeTenantType(sameAccountFallback?.tenantType)
    : undefined;

  if (userMode === "student") tenantType = "student";

  const schoolLocation = isTenantLike
    ? candidate.schoolLocation || sameAccountFallback?.schoolLocation
    : undefined;

  // Old student accounts may already have been changed to userMode="tenant"
  // while an older cache/server document still lacks tenantType.
  if (userMode === "tenant" && !tenantType && schoolLocation?.trim()) {
    tenantType = "student";
  }

  const normalizedUser = {
    ...(sameAccountFallback || {}),
    ...candidate,
    userMode,
  } as User;

  if (isTenantLike) {
    if (tenantType) normalizedUser.tenantType = tenantType;
    if (schoolLocation) normalizedUser.schoolLocation = schoolLocation;
  } else {
    delete normalizedUser.tenantType;
    delete normalizedUser.schoolLocation;
  }

  return normalizedUser;`,
    "auth cache user normalization",
  );

  content = replaceOnce(
    content,
    `      const normalizedUserMode =
        userData.userMode.trim().toLowerCase() as
          | "tenant"
          | "landlord"
          | "driver"
          | "student";
      const schoolLocation =
        userData.schoolLocation?.trim() ?? "";

      if (normalizedUserMode === "student" && !schoolLocation) {
        set({ isLoading: false });

        return {
          success: false,
          error: "School location is required for student accounts",
        };
      }`,
    `      const rawUserMode = userData.userMode.trim().toLowerCase();

      if (
        rawUserMode !== "tenant" &&
        rawUserMode !== "landlord" &&
        rawUserMode !== "driver" &&
        rawUserMode !== "student"
      ) {
        set({ isLoading: false });

        return {
          success: false,
          error: "Choose a valid Nookly account mode.",
        };
      }

      const normalizedUserMode = rawUserMode as User["userMode"];
      const rawTenantType = userData.tenantType?.trim().toLowerCase();
      const tenantType: User["tenantType"] =
        normalizedUserMode === "student"
          ? "student"
          : normalizedUserMode === "tenant" &&
              VALID_TENANT_TYPES.has(rawTenantType as any)
            ? (rawTenantType as User["tenantType"])
            : undefined;
      const schoolLocation = userData.schoolLocation?.trim() ?? "";

      if (normalizedUserMode === "tenant" && !tenantType) {
        set({ isLoading: false });

        return {
          success: false,
          error: "Choose a tenant type before creating the account.",
        };
      }

      if (tenantType === "student" && !schoolLocation) {
        set({ isLoading: false });

        return {
          success: false,
          error: "School location is required for student accounts",
        };
      }`,
    "auth-store sign-up mode normalization",
  );

  content = replaceOnce(
    content,
    `          userMode: normalizedUserMode,
          ...(normalizedUserMode === "student"
            ? { schoolLocation }
            : {}),
          email: userData.email,`,
    `          userMode: normalizedUserMode,
          ...(tenantType ? { tenantType } : {}),
          ...(tenantType === "student" ? { schoolLocation } : {}),
          email: userData.email,`,
    "auth-store user document mode fields",
  );

  await writeFile(filePath, content, "utf8");
  console.log(`✓ Strengthened driver-aware auth caching in ${relativePath}`);
};

const patchAppwrite = async () => {
  const relativePath = "lib/appwrite.ts";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  content = replaceOnce(
    content,
    `import notificationService from "@/services/notification.service";`,
    `import type {
  LegacyUserMode,
  TenantType,
} from "@/lib/userMode";
import notificationService from "@/services/notification.service";`,
    "appwrite user-mode type import",
  );

  content = replaceOnce(
    content,
    `interface CreateUserParams {
  email: string;
  password: string;
  phone: string;
  name: string;
  userMode: string;
  schoolLocation?: string;
  avatar?: string;
  pushToken?: string | null;
}`,
    `interface CreateUserParams {
  email: string;
  password: string;
  phone: string;
  name: string;
  userMode: LegacyUserMode;
  tenantType?: TenantType;
  schoolLocation?: string;
  avatar?: string;
  pushToken?: string | null;
}`,
    "CreateUserParams",
  );

  content = replaceOnce(
    content,
    `  userMode,
  schoolLocation,
  avatar,`,
    `  userMode,
  tenantType,
  schoolLocation,
  avatar,`,
    "createUser parameter destructuring",
  );

  content = replaceOnce(
    content,
    `    const normalizedUserMode = userMode.trim().toLowerCase();
    const normalizedSchoolLocation = schoolLocation?.trim().toLowerCase() ?? "";

    if (normalizedUserMode === "student" && !normalizedSchoolLocation) {
      throw new Error("School location is required for student accounts");
    }`,
    `    const rawUserMode = userMode.trim().toLowerCase();

    if (
      rawUserMode !== "tenant" &&
      rawUserMode !== "landlord" &&
      rawUserMode !== "driver" &&
      rawUserMode !== "student"
    ) {
      throw new Error("Choose a valid Nookly account mode");
    }

    const normalizedUserMode = rawUserMode as LegacyUserMode;
    const rawTenantType = tenantType?.trim().toLowerCase();
    const normalizedTenantType: TenantType | undefined =
      normalizedUserMode === "student"
        ? "student"
        : normalizedUserMode === "tenant" &&
            ["student", "family", "single"].includes(rawTenantType || "")
          ? (rawTenantType as TenantType)
          : undefined;
    const normalizedSchoolLocation =
      schoolLocation?.trim().toLowerCase() ?? "";
    const isTenantAccount =
      normalizedUserMode === "tenant" || normalizedUserMode === "student";

    if (normalizedUserMode === "tenant" && !normalizedTenantType) {
      throw new Error("Choose a tenant type before creating the account");
    }

    if (
      normalizedTenantType === "student" &&
      !normalizedSchoolLocation
    ) {
      throw new Error("School location is required for student accounts");
    }`,
    "legacy createUser mode normalization",
  );

  content = replaceOnce(
    content,
    `        userMode: normalizedUserMode,
        ...(normalizedUserMode === "student"
          ? { schoolLocation: normalizedSchoolLocation }
          : {}),
      },`,
    `        userMode: normalizedUserMode,
        ...(normalizedTenantType
          ? { tenantType: normalizedTenantType }
          : {}),
        ...(normalizedTenantType === "student"
          ? { schoolLocation: normalizedSchoolLocation }
          : {}),
      },`,
    "legacy createUser document mode fields",
  );

  content = replaceExpectedCount(
    content,
    `if (normalizedUserMode === "tenant")`,
    `if (isTenantAccount)`,
    2,
    "tenant profile conditions inside createUser",
  );

  await writeFile(filePath, content, "utf8");
  console.log(`✓ Added driver support to legacy createUser in ${relativePath}`);
};

const patchLocalDatabase = async () => {
  const relativePath = "services/localDatabase.service.ts";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  content = replaceOnce(
    content,
    `  userMode: "tenant" | "landlord" | "student";
  lastSync: string;`,
    `  userMode: "tenant" | "landlord" | "driver" | "student";
  tenantType?: "student" | "family" | "single";
  schoolLocation?: string;
  lastSync: string;`,
    "LocalUser mode fields",
  );

  content = replaceOnce(
    content,
    `      if (userStr) {
        return JSON.parse(userStr);
      }`,
    `      if (userStr) {
        const parsed = JSON.parse(userStr) as LocalUser;
        const rawMode = String(parsed.userMode || "tenant")
          .trim()
          .toLowerCase();

        const userMode: LocalUser["userMode"] =
          rawMode === "landlord"
            ? "landlord"
            : rawMode === "driver"
              ? "driver"
              : rawMode === "student"
                ? "student"
                : "tenant";

        const normalizedUser: LocalUser = {
          ...parsed,
          userMode,
        };

        if (userMode === "driver" || userMode === "landlord") {
          delete normalizedUser.tenantType;
          delete normalizedUser.schoolLocation;
        }

        return normalizedUser;
      }`,
    "local cached-user hydration",
  );

  await writeFile(filePath, content, "utf8");
  console.log(`✓ Added driver to the legacy local user cache`);
};

const main = async () => {
  console.log("\nInstalling Nookly Driver auth + cache hotfix...\n");

  await backupFiles();
  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  await installFullReplacement("context/AuthContext.ts");
  await installFullReplacement("lib/offline/types.ts");
  await patchSignUp();
  await patchAuthStore();
  await patchAppwrite();
  await patchLocalDatabase();

  console.log("\n✓ Driver is now included in:");
  console.log("  - public account-mode selection");
  console.log("  - Zustand sign-up and user-document creation");
  console.log("  - legacy createUser");
  console.log("  - AuthContext compatibility");
  console.log("  - AsyncStorage auth hydration");
  console.log("  - legacy local user caching");
  console.log("  - offline user-mode types");

  console.log("\nNext verification command:");
  console.log(
    'npx eslint "app/(auth)/sign-up.tsx" "context/AuthContext.ts" "lib/appwrite.ts" "lib/offline/types.ts" "services/localDatabase.service.ts" "store/auth.store.ts"',
  );
};

main().catch((error) => {
  console.error("\n✗ Driver auth + cache hotfix installation failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
