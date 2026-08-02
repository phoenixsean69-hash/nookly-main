import {
  getAvailableProperties,
  getProperties,
} from "@/lib/appwrite";
import {
  ApprovedOrganization,
  fetchStudentHousing,
  getUniversityApprovedBoardingProperties,
  StudentProperty,
} from "@/lib/studentHousing";

export interface FilteredDiscoveryParams {
  type?: string;
}

export interface StudentExploreDiscoveryData {
  allProperties: StudentProperty[];
  approvedProperties: StudentProperty[];
  organizations: ApprovedOrganization[];
}

export const normalizeDiscoveryKeyPart = (
  value: unknown,
): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "") || "all";

const sortNewest = (properties: any[]): any[] =>
  [...properties].sort(
    (left, right) =>
      new Date(right.$createdAt ?? 0).getTime() -
      new Date(left.$createdAt ?? 0).getTime(),
  );

export const getFilteredDiscoveryProperties = async ({
  type,
}: FilteredDiscoveryParams): Promise<any[]> => {
  const normalizedType = normalizeDiscoveryKeyPart(type);

  switch (normalizedType) {
    case "boarding": {
      const properties = await getAvailableProperties({
        filter: "All",
        query: "",
        limit: 20,
      });

      return properties.filter(
        (property) =>
          property.type === "Boarding" ||
          property.type === "Boarding House",
      );
    }

    case "open_properties":
    case "open-properties":
    case "available": {
      const properties = await getAvailableProperties({
        filter: "All",
        query: "",
        limit: 50,
      });

      return sortNewest(properties);
    }

    case "price_drop":
    case "price-drop": {
      const properties = await getProperties({
        filter: "All",
        query: "",
        limit: 20,
      });

      return properties.filter((property) => {
        if (property.hasPriceDrop === true) return true;

        const originalPrice = Number(property.price ?? 0);
        const newPrice = Number(
          property.new_price ?? originalPrice,
        );

        return (
          originalPrice > 0 &&
          newPrice > 0 &&
          newPrice < originalPrice
        );
      });
    }

    case "new_listing":
    case "new-listing": {
      const properties = await getProperties({
        filter: "All",
        query: "",
        limit: 20,
      });

      return sortNewest(properties);
    }

    case "trending": {
      const properties = await getProperties({
        filter: "All",
        query: "",
        limit: 20,
      });

      return [...properties].sort(
        (left, right) =>
          Number(right.likes ?? 0) -
          Number(left.likes ?? 0),
      );
    }

    default:
      return getProperties({
        filter: "All",
        query: "",
        limit: 20,
      });
  }
};

export const getStudentExploreDiscovery = async ({
  schoolLocation,
}: {
  schoolLocation: string;
}): Promise<StudentExploreDiscoveryData> => {
  if (!schoolLocation.trim()) {
    return {
      allProperties: [],
      approvedProperties: [],
      organizations: [],
    };
  }

  // useAppwrite decides whether a network refresh is needed.
  // When it does call this function, bypass the older TTL layer so a
  // Realtime collection change always produces genuinely fresh data.
  const allProperties = await fetchStudentHousing(
    schoolLocation,
    { force: true },
  );

  const approved =
    await getUniversityApprovedBoardingProperties(
      schoolLocation,
      allProperties,
      true,
    );

  return {
    allProperties,
    approvedProperties: approved.properties,
    organizations: approved.organizations,
  };
};
