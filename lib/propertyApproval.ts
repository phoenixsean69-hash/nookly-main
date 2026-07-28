export interface OrganizationApprovalProperty {
  type?: unknown;
  organizationApproved?: unknown;
}

const normalizePropertyType = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export const isBoardingHouseProperty = (
  property?: OrganizationApprovalProperty | null,
): boolean => {
  const type = normalizePropertyType(property?.type);

  return (
    type === "boarding" ||
    type === "boarding house" ||
    type === "boardinghouse" ||
    type === "student boarding" ||
    type === "student boarding house"
  );
};

const isApprovedValue = (value: unknown): boolean => {
  if (value === true) return true;

  // This keeps the UI resilient if an older cached document stored the
  // Appwrite Boolean as a serialized value.
  if (typeof value === "string") {
    return value.trim().toLowerCase() === "true";
  }

  return value === 1;
};

export const isOrganizationApprovedBoardingHouse = (
  property?: OrganizationApprovalProperty | null,
): boolean =>
  isBoardingHouseProperty(property) &&
  isApprovedValue(property?.organizationApproved);