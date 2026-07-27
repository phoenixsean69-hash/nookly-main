import {
  getInstitutionLocationTerms,
  normalizeInstitutionText,
} from "@/constants/zimbabweTertiaryInstitutions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Query } from "react-native-appwrite";
import { config, databases } from "../lib/appwrite";

export const STUDENT_PROPERTY_FILTERS = [
  { title: "All", category: "All" },
  { title: "Boarding House", category: "Boarding" },
  { title: "House", category: "House" },
  { title: "Apartment", category: "Apartment" },
  { title: "Cottage", category: "Cottage" },
  { title: "Duplex", category: "Duplex" },
  { title: "Studio", category: "Studio" },
  { title: "Luxury", category: "Luxury" },
] as const;

const NON_RESIDENTIAL_TYPES = new Set([
  "commercial",
  "farm",
  "industrial",
  "land",
  "office",
  "shop",
  "warehouse",
  "workplace",
]);

const BOARDING_TYPES = new Set([
  "boarding",
  "boarding house",
  "boardinghouse",
  "hostel",
  "student hostel",
]);

const CACHE_TTL = 15 * 60 * 1000;
const CACHE_VERSION = "v4";
const PAGE_SIZE = 100;
const MAX_PROPERTY_PAGES = 20;

type CacheEnvelope<T> = {
  savedAt: number;
  data: T;
};

export type StudentProperty = Record<string, any> & {
  $id: string;
  type?: string;
  address?: string;
  propertyName?: string;
  rating?: number;
  reviewCount?: number;
  studentPerformanceScore?: number;
  organizationId?: string;
  organizationName?: string;
  organizationCity?: string;
  isUniversityApproved?: boolean;
};

export type ApprovedOrganization = {
  $id: string;
  userId?: string;
  name: string;
  city: string;
  email?: string;
  phone?: string;
  avatar?: string;
};

export const normalizeStudentText = (value?: unknown): string =>
  normalizeInstitutionText(value);

export const titleCaseStudentText = (value?: string): string =>
  String(value ?? "")
    .trim()
    .split(/\s+/)
    .map((part) =>
      part ? `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}` : "",
    )
    .join(" ");

export const isStudentPropertyType = (type?: string): boolean => {
  const normalizedType = normalizeStudentText(type);
  if (!normalizedType) return true;
  return !NON_RESIDENTIAL_TYPES.has(normalizedType);
};

export const isBoardingHouseType = (type?: string): boolean =>
  BOARDING_TYPES.has(normalizeStudentText(type));

const containsLocationTerm = (address: string, term: string): boolean => {
  if (!address || !term) return false;

  const paddedAddress = ` ${address} `;
  const paddedTerm = ` ${term} `;

  return (
    address === term ||
    paddedAddress.includes(paddedTerm) ||
    address.startsWith(`${term} `) ||
    address.endsWith(` ${term}`)
  );
};

/**
 * Matches a property address against the selected institution's actual city,
 * town and known location aliases.
 *
 * Example:
 * "Bindura University" resolves to BUSE, whose location terms include
 * "Bindura". Therefore an address such as "Chipadze, Bindura" matches.
 */
export const propertyMatchesSchoolLocation = (
  address?: string,
  schoolLocation?: string,
): boolean => {
  const normalizedAddress = normalizeStudentText(address);
  if (!normalizedAddress) return false;

  const locationTerms = getInstitutionLocationTerms(schoolLocation)
    .map(normalizeStudentText)
    .filter((term) => term.length >= 3);

  if (locationTerms.length === 0) return false;

  return locationTerms.some((term) =>
    containsLocationTerm(normalizedAddress, term),
  );
};

const parseFacilities = (value: unknown): string => {
  if (Array.isArray(value)) return value.join(" ");
  if (typeof value === "object" && value !== null) {
    return Object.values(value).join(" ");
  }
  return String(value ?? "");
};

const parseReviewStats = (
  reviews: unknown,
): { rating: number; reviewCount: number } => {
  if (!reviews) return { rating: 0, reviewCount: 0 };

  try {
    const parsed = typeof reviews === "string" ? JSON.parse(reviews) : reviews;
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { rating: 0, reviewCount: 0 };
    }

    const validRatings = parsed
      .map((review) => Number(review?.rating ?? 0))
      .filter((rating) => Number.isFinite(rating) && rating > 0);

    if (validRatings.length === 0) {
      return { rating: 0, reviewCount: parsed.length };
    }

    const rating =
      validRatings.reduce((total, value) => total + value, 0) /
      validRatings.length;

    return {
      rating: Number(rating.toFixed(1)),
      reviewCount: parsed.length,
    };
  } catch {
    return { rating: 0, reviewCount: 0 };
  }
};

const getPropertyPerformanceScore = (property: StudentProperty): number => {
  const { rating, reviewCount } = parseReviewStats(property.reviews);
  const finalRating = rating || Number(property.rating ?? 0);
  const likes = Number(property.likes ?? 0);
  const views = Number(property.views ?? 0);
  const requests = Number(property.requests ?? 0);
  const availableSlots = Number(property.availableSlots ?? 0);

  return (
    finalRating * 40 +
    reviewCount * 7 +
    likes * 2.5 +
    views * 0.2 +
    requests * 4 +
    Math.max(availableSlots, 0)
  );
};

const hydrateStudentProperty = (
  document: Record<string, any>,
): StudentProperty => {
  const reviewStats = parseReviewStats(document.reviews);
  const property = document as StudentProperty;

  return {
    ...property,
    rating: reviewStats.rating || Number(document.rating ?? 0),
    reviewCount: reviewStats.reviewCount,
    studentPerformanceScore: getPropertyPerformanceScore(property),
  };
};

const sortByStudentPerformance = (
  properties: StudentProperty[],
): StudentProperty[] =>
  [...properties].sort((left, right) => {
    const scoreDifference =
      Number(right.studentPerformanceScore ?? 0) -
      Number(left.studentPerformanceScore ?? 0);

    if (scoreDifference !== 0) return scoreDifference;

    const rightCreated = new Date(right.$createdAt ?? 0).getTime();
    const leftCreated = new Date(left.$createdAt ?? 0).getTime();
    return rightCreated - leftCreated;
  });

const studentCacheKey = (schoolLocation: string) =>
  `@nookly:student-housing:${CACHE_VERSION}:${normalizeStudentText(
    schoolLocation,
  )}`;

const approvedCacheKey = (schoolLocation: string) =>
  `@nookly:approved-student-housing:${CACHE_VERSION}:${normalizeStudentText(
    schoolLocation,
  )}`;

const readCache = async <T>(key: string): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CACHE_TTL) {
      return null;
    }

    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = async <T>(key: string, data: T): Promise<void> => {
  try {
    const envelope: CacheEnvelope<T> = {
      savedAt: Date.now(),
      data,
    };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    console.warn("Could not cache student housing:", error);
  }
};

const fetchAllAvailablePropertyDocuments = async (): Promise<
  Record<string, any>[]
> => {
  const documents: Record<string, any>[] = [];

  for (let page = 0; page < MAX_PROPERTY_PAGES; page += 1) {
    const response = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [
        Query.limit(PAGE_SIZE),
        Query.offset(page * PAGE_SIZE),
        Query.orderDesc("$createdAt"),
      ],
    );

    documents.push(...response.documents);

    if (
      response.documents.length < PAGE_SIZE ||
      documents.length >= response.total
    ) {
      break;
    }
  }

  return documents;
};

export const fetchStudentHousing = async (
  schoolLocation: string,
  options: { force?: boolean; limit?: number } = {},
): Promise<StudentProperty[]> => {
  const normalizedLocation = normalizeStudentText(schoolLocation);
  if (!normalizedLocation) return [];

  const key = studentCacheKey(schoolLocation);

  if (!options.force) {
    const cached = await readCache<StudentProperty[]>(key);
    if (cached) return cached;
  }

  try {
    const allDocuments = await fetchAllAvailablePropertyDocuments();

    const ranked = sortByStudentPerformance(
      allDocuments
        .map((document) => hydrateStudentProperty(document))
        .filter((property) => property.isAvailable !== false)
        .filter((property) => isStudentPropertyType(property.type))
        .filter((property) =>
          propertyMatchesSchoolLocation(property.address, schoolLocation),
        ),
    );

    const result =
      options.limit && options.limit > 0
        ? ranked.slice(0, options.limit)
        : ranked;

    await writeCache(key, result);
    return result;
  } catch (error) {
    console.error("Error loading student housing:", error);
    return (await readCache<StudentProperty[]>(key)) ?? [];
  }
};

export const filterStudentHousing = (
  properties: StudentProperty[],
  options: {
    type?: string;
    query?: string;
    facilities?: string[];
    bedrooms?: number;
    hotDealsOnly?: boolean;
  },
): StudentProperty[] => {
  const normalizedType = normalizeStudentText(options.type);
  const normalizedQuery = normalizeStudentText(options.query);
  const selectedFacilities = (options.facilities ?? []).map(
    normalizeStudentText,
  );

  const filtered = properties.filter((property) => {
    if (
      normalizedType &&
      normalizedType !== "all" &&
      normalizeStudentText(property.type) !== normalizedType
    ) {
      if (
        !(
          normalizedType === "boarding" &&
          isBoardingHouseType(property.type)
        )
      ) {
        return false;
      }
    }

    if (normalizedQuery) {
      const haystack = normalizeStudentText(
        [
          property.propertyName,
          property.address,
          property.type,
          property.description,
          parseFacilities(property.facilities),
        ].join(" "),
      );

      if (!haystack.includes(normalizedQuery)) return false;
    }

    if (
      options.bedrooms &&
      Number(property.bedrooms ?? 0) < options.bedrooms
    ) {
      return false;
    }

    if (selectedFacilities.length > 0) {
      const propertyFacilities = normalizeStudentText(
        parseFacilities(property.facilities),
      );

      if (
        !selectedFacilities.every((facility) =>
          propertyFacilities.includes(facility),
        )
      ) {
        return false;
      }
    }

    if (options.hotDealsOnly) {
      const originalPrice = Number(property.price ?? 0);
      const newPrice = Number(property.new_price ?? originalPrice);

      if (!(newPrice > 0 && originalPrice > 0 && newPrice < originalPrice)) {
        return false;
      }
    }

    return true;
  });

  return sortByStudentPerformance(filtered);
};

export const getStudentFeaturedProperties = async (
  schoolLocation: string,
  limit = 6,
  force = false,
): Promise<StudentProperty[]> => {
  const properties = await fetchStudentHousing(schoolLocation, { force });
  return properties.slice(0, limit);
};

export const getStudentRecommendedProperties = async (
  schoolLocation: string,
  options: {
    type?: string;
    query?: string;
    limit?: number;
    force?: boolean;
  } = {},
): Promise<StudentProperty[]> => {
  const properties = await fetchStudentHousing(schoolLocation, {
    force: options.force,
  });

  return filterStudentHousing(properties, {
    type: options.type,
    query: options.query,
  }).slice(0, options.limit ?? 20);
};

export const getUniversityApprovedBoardingProperties = async (
  schoolLocation: string,
  properties?: StudentProperty[],
  force = false,
): Promise<{
  properties: StudentProperty[];
  organizations: ApprovedOrganization[];
}> => {
  const normalizedLocation = normalizeStudentText(schoolLocation);
  if (!normalizedLocation) return { properties: [], organizations: [] };

  const key = approvedCacheKey(schoolLocation);

  if (!force) {
    const cached = await readCache<{
      properties: StudentProperty[];
      organizations: ApprovedOrganization[];
    }>(key);

    if (cached) return cached;
  }

  try {
    const organizationResponse = await databases.listDocuments(
      config.databaseId!,
      config.organizationsCollectionId!,
      [Query.limit(100)],
    );

    const organizations = organizationResponse.documents
      .filter((organization) =>
        propertyMatchesSchoolLocation(organization.city, schoolLocation),
      )
      .map(
        (organization): ApprovedOrganization => ({
          $id: organization.$id,
          userId: organization.userId,
          name: organization.name || "University",
          city: organization.city || schoolLocation,
          email: organization.email,
          phone: organization.phone,
          avatar: organization.avatar,
        }),
      );

    const organizationByCreator = new Map<string, ApprovedOrganization>();

    organizations.forEach((organization) => {
      organizationByCreator.set(organization.$id, organization);

      if (organization.userId) {
        organizationByCreator.set(organization.userId, organization);
      }
    });

    const studentProperties =
      properties ?? (await fetchStudentHousing(schoolLocation, { force }));

    const approvedProperties = studentProperties
      .filter((property) => isBoardingHouseType(property.type))
      .map((property) => {
        const organization = organizationByCreator.get(
          String(property.creatorId ?? ""),
        );

        if (!organization) return null;

        return {
          ...property,
          organizationId: organization.$id,
          organizationName: organization.name,
          organizationCity: organization.city,
          isUniversityApproved: true,
          agent:
            property.agent ??
            {
              $id: organization.$id,
              name: organization.name,
              email: organization.email,
              phone: organization.phone,
              avatar: organization.avatar,
              isOrganization: true,
            },
        } as StudentProperty;
      })
      .filter((property): property is StudentProperty => property !== null);

    const result = {
      properties: sortByStudentPerformance(approvedProperties),
      organizations,
    };

    await writeCache(key, result);
    return result;
  } catch (error) {
    console.error(
      "Error loading university-approved boarding houses:",
      error,
    );

    return (
      (await readCache<{
        properties: StudentProperty[];
        organizations: ApprovedOrganization[];
      }>(key)) ?? { properties: [], organizations: [] }
    );
  }
};