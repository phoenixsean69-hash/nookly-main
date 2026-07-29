// lib/userMode.ts
//
// Central user-mode helpers for Nookly.
//
// New account model:
//   userMode: "landlord" | "tenant"
//   tenantType: "student" | "family" | "single"
//
// Legacy compatibility:
//   Existing accounts with userMode === "student" are still treated as
//   student tenants until they are migrated in Appwrite.

export type PrimaryUserMode = "tenant" | "landlord";
export type TenantType = "student" | "family" | "single";
export type LegacyUserMode = PrimaryUserMode | "student";

export interface ModeAwareUser {
  userMode?: LegacyUserMode | string | null;
  tenantType?: TenantType | string | null;
}

const VALID_TENANT_TYPES = new Set<TenantType>([
  "student",
  "family",
  "single",
]);

const STUDENT_TAB_ROUTES = new Set<string>([
  "/about",
  "/all-locations",
  "/calendar",
  "/detailsEdit",
  "/explore",
  "/filtered-properties",
  "/help",
  "/landlords",
  "/language",
  "/match",
  "/message",
  "/my-favorites",
  "/myRequests",
  "/notifications",
  "/profile",
  "/properties-by-location",
  "/settings",
  "/tenantHome",
  "/trending-properties",
]);

export const normalizeTenantType = (
  value?: string | null,
): TenantType | null => {
  const normalized = value?.trim().toLowerCase() as TenantType | undefined;

  if (!normalized || !VALID_TENANT_TYPES.has(normalized)) {
    return null;
  }

  return normalized;
};

export const getPrimaryUserMode = (
  user?: ModeAwareUser | null,
): PrimaryUserMode | null => {
  if (!user?.userMode) return null;

  return user.userMode === "landlord" ? "landlord" : "tenant";
};

export const getTenantType = (
  user?: ModeAwareUser | null,
): TenantType | null => {
  if (!user || user.userMode === "landlord") return null;

  // Backward compatibility for existing student accounts.
  if (user.userMode === "student") return "student";

  return normalizeTenantType(user.tenantType);
};

export const isLandlordUser = (user?: ModeAwareUser | null): boolean =>
  getPrimaryUserMode(user) === "landlord";

export const isTenantUser = (user?: ModeAwareUser | null): boolean =>
  getPrimaryUserMode(user) === "tenant";

export const isStudentTenant = (user?: ModeAwareUser | null): boolean =>
  getTenantType(user) === "student";

export const isFamilyTenant = (user?: ModeAwareUser | null): boolean =>
  getTenantType(user) === "family";

export const isSingleTenant = (user?: ModeAwareUser | null): boolean =>
  getTenantType(user) === "single";

export const needsTenantTypeSetup = (
  user?: ModeAwareUser | null,
): boolean => isTenantUser(user) && getTenantType(user) === null;

export const getUserHomeRoute = (
  user?: ModeAwareUser | null,
):
  | "/sign-up"
  | "/landHome"
  | "/tenant-type-setup"
  | "/s-tenantHome"
  | "/tenantHome" => {
  if (!user?.userMode) return "/sign-up";
  if (isLandlordUser(user)) return "/landHome";
  if (isStudentTenant(user)) return "/s-tenantHome";
  if (needsTenantTypeSetup(user)) return "/tenant-type-setup";

  return "/tenantHome";
};

export const getModeAwareRoute = (
  route: string,
  user?: ModeAwareUser | null,
): string => {
  if (!isStudentTenant(user) || route.startsWith("/s-")) {
    return route;
  }

  const suffixIndex = route.search(/[?#]/);
  const pathname = suffixIndex >= 0 ? route.slice(0, suffixIndex) : route;
  const suffix = suffixIndex >= 0 ? route.slice(suffixIndex) : "";

  if (!STUDENT_TAB_ROUTES.has(pathname)) {
    return route;
  }

  return `/s-${pathname.slice(1)}${suffix}`;
};

export const getUserModeLabel = (
  user?: ModeAwareUser | null,
): string => {
  if (isLandlordUser(user)) return "Landlord";

  const tenantType = getTenantType(user);

  switch (tenantType) {
    case "student":
      return "Student tenant";
    case "family":
      return "Family tenant";
    case "single":
      return "Single tenant";
    default:
      return "Tenant";
  }
};

export const getTenantFeedKey = (
  user?: ModeAwareUser | null,
): "student" | "family" | "single" | "tenant" | "landlord" => {
  if (isLandlordUser(user)) return "landlord";

  return getTenantType(user) ?? "tenant";
};
