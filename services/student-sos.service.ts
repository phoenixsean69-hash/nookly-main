import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";

import { isStudentTenant } from "@/lib/userMode";
import { getDriverOrganizations } from "@/services/driver.service";
import pushFunctionService from "@/services/push-function.service";
import useAuthStore from "@/store/auth.store";

import type {
  StudentSosIncidentType,
  StudentSosLocation,
  StudentSosResult,
} from "@/types/student-sos";

import type {
  DriverOrganizationOption,
} from "@/types/driver";

const LOCATION_TIMEOUT_MS = 12_000;

interface GeocodedAddressShape {
  name?: string | null;
  street?: string | null;
  streetNumber?: string | null;
  district?: string | null;
  city?: string | null;
  subregion?: string | null;
  region?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

const createClientRequestId = (): string => {
  const randomPart = Math.random()
    .toString(36)
    .slice(2, 10);

  return [
    "student-sos",
    Date.now().toString(36),
    randomPart,
  ].join("-");
};

const normalizeInstitutionName = (
  value: unknown,
): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeOrganizationType = (
  value: unknown,
): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const findInstitutionMatch = (
  organizations: DriverOrganizationOption[],
  schoolLocation: string,
): DriverOrganizationOption | null => {
  const target =
    normalizeInstitutionName(
      schoolLocation,
    );

  if (!target) {
    return null;
  }

  const schools =
    organizations.filter(
      (organization) =>
        normalizeOrganizationType(
          organization.type_of,
        ) === "school",
    );

  const exactMatch =
    schools.find(
      (organization) =>
        normalizeInstitutionName(
          organization.name,
        ) === target,
    );

  if (exactMatch) {
    return exactMatch;
  }

  const compatibleMatches =
    schools.filter(
      (organization) => {
        const candidate =
          normalizeInstitutionName(
            organization.name,
          );

        if (!candidate) {
          return false;
        }

        return (
          candidate.includes(target) ||
          target.includes(candidate)
        );
      },
    );

  return compatibleMatches.length === 1
    ? compatibleMatches[0]
    : null;
};

const addUniqueAddressPart = (
  parts: string[],
  value: unknown,
) => {
  const text =
    String(value ?? "").trim();

  if (!text) {
    return;
  }

  const alreadyPresent =
    parts.some(
      (part) =>
        part.toLowerCase() ===
        text.toLowerCase(),
    );

  if (!alreadyPresent) {
    parts.push(text);
  }
};

const formatGeocodedAddress = (
  address: GeocodedAddressShape,
): string => {
  const parts: string[] = [];

  const streetLine = [
    address.streetNumber,
    address.street,
  ]
    .map((value) =>
      String(value ?? "").trim(),
    )
    .filter(Boolean)
    .join(" ");

  addUniqueAddressPart(
    parts,
    streetLine,
  );

  addUniqueAddressPart(
    parts,
    address.name,
  );

  addUniqueAddressPart(
    parts,
    address.district,
  );

  addUniqueAddressPart(
    parts,
    address.city,
  );

  addUniqueAddressPart(
    parts,
    address.subregion,
  );

  addUniqueAddressPart(
    parts,
    address.region,
  );

  addUniqueAddressPart(
    parts,
    address.country,
  );

  return parts.join(", ");
};

const reverseGeocodeLocation = async (
  latitude: number,
  longitude: number,
): Promise<string> => {
  try {
    const addresses =
      await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

    const firstAddress =
      addresses[0] as
        | GeocodedAddressShape
        | undefined;

    if (!firstAddress) {
      return "";
    }

    return formatGeocodedAddress(
      firstAddress,
    );
  } catch (error) {
    console.warn(
      "Could not reverse-geocode SOS location:",
      error,
    );

    return "";
  }
};

const createLocation = async (
  position: Location.LocationObject,
): Promise<StudentSosLocation> => {
  const latitude =
    position.coords.latitude;

  const longitude =
    position.coords.longitude;

  const resolvedAddress =
    await reverseGeocodeLocation(
      latitude,
      longitude,
    );

  return {
    latitude,
    longitude,
    accuracy:
      typeof position.coords.accuracy ===
      "number"
        ? position.coords.accuracy
        : null,
    capturedAt: new Date(
      position.timestamp ||
        Date.now(),
    ).toISOString(),
    address:
      resolvedAddress ||
      `Latitude ${latitude.toFixed(
        6,
      )}, Longitude ${longitude.toFixed(
        6,
      )}`,
  };
};

const requireStudent = () => {
  const user =
    useAuthStore.getState().user;

  if (!user) {
    throw new Error(
      "Sign in before using Student SOS.",
    );
  }

  if (!isStudentTenant(user)) {
    throw new Error(
      "Student SOS is available only to student accounts.",
    );
  }

  return user;
};

const requireInternet =
  async (): Promise<void> => {
    const network =
      await NetInfo.fetch();

    if (
      network.isConnected === false ||
      network.isInternetReachable === false
    ) {
      throw new Error(
        "An internet connection is required to alert your university.",
      );
    }
  };

const ensureStudentUniversityLinked =
  async () => {
    const user = requireStudent();

    if (
      user.organizationId?.trim()
    ) {
      return user;
    }

    const schoolLocation =
      user.schoolLocation?.trim() ||
      "";

    if (!schoolLocation) {
      throw new Error(
        "Pick your Institution before using SOS.",
      );
    }

    await requireInternet();

    let organizations:
      DriverOrganizationOption[];

    try {
      organizations =
        await getDriverOrganizations();
    } catch (error) {
      console.error(
        "Could not load registered institutions for Student SOS:",
        error,
      );

      throw new Error(
        "Nookly could not verify your registered institution. Please try again.",
      );
    }

    const matchedOrganization =
      findInstitutionMatch(
        organizations,
        schoolLocation,
      );

    if (!matchedOrganization) {
      throw new Error(
        "Pick your Institution from the registered school list.",
      );
    }

    const result =
      await useAuthStore
        .getState()
        .updateUser({
          organizationId:
            matchedOrganization.$id,
          schoolLocation:
            matchedOrganization.name,
        });

    if (!result.success) {
      throw new Error(
        result.error ||
          "Nookly could not link your institution.",
      );
    }

    const updatedUser =
      useAuthStore.getState().user;

    if (
      !updatedUser
        ?.organizationId
        ?.trim()
    ) {
      throw new Error(
        "Nookly could not complete your institution link.",
      );
    }

    return updatedUser;
  };

const getFreshPosition =
  async (): Promise<Location.LocationObject> => {
    let timer:
      | ReturnType<typeof setTimeout>
      | undefined;

    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy:
            Location.Accuracy.High,
        }),

        new Promise<never>(
          (_, reject) => {
            timer = setTimeout(() => {
              reject(
                new Error(
                  "Getting your current location took too long.",
                ),
              );
            }, LOCATION_TIMEOUT_MS);
          },
        ),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  };

class StudentSosService {
  async getCurrentLocation():
    Promise<StudentSosLocation> {
    await ensureStudentUniversityLinked();

    const locationEnabled =
      await Location
        .hasServicesEnabledAsync();

    if (!locationEnabled) {
      throw new Error(
        "Turn on Location Services before sending an SOS.",
      );
    }

    let permission =
      await Location
        .getForegroundPermissionsAsync();

    if (
      permission.status !== "granted"
    ) {
      permission =
        await Location
          .requestForegroundPermissionsAsync();
    }

    if (
      permission.status !== "granted"
    ) {
      throw new Error(
        "Location permission is required so your institution can locate you.",
      );
    }

    try {
      const freshPosition =
        await getFreshPosition();

      return await createLocation(
        freshPosition,
      );
    } catch (freshError) {
      const lastKnown =
        await Location
          .getLastKnownPositionAsync({
            maxAge:
              5 * 60 * 1000,
            requiredAccuracy: 500,
          });

      if (lastKnown) {
        return await createLocation(
          lastKnown,
        );
      }

      throw freshError;
    }
  }

  async send(
    incidentType:
      StudentSosIncidentType,
    location:
      StudentSosLocation,
  ): Promise<StudentSosResult> {
    await requireInternet();
    await ensureStudentUniversityLinked();

    return pushFunctionService
      .sendStudentSos({
        incidentType,
        latitude:
          location.latitude,
        longitude:
          location.longitude,
        accuracy:
          location.accuracy,
        capturedAt:
          location.capturedAt,
        address:
          location.address,
        clientRequestId:
          createClientRequestId(),
      });
  }
}

export const studentSosService =
  new StudentSosService();

export default studentSosService;