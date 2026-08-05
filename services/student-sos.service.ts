import NetInfo from "@react-native-community/netinfo";
import * as Location from "expo-location";

import { isStudentTenant } from "@/lib/userMode";
import pushFunctionService from "@/services/push-function.service";
import useAuthStore from "@/store/auth.store";

import type {
  StudentSosIncidentType,
  StudentSosLocation,
  StudentSosResult,
} from "@/types/student-sos";

const LOCATION_TIMEOUT_MS = 12_000;

const createClientRequestId = (): string =>
  [
    "student-sos",
    Date.now().toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join("-");

const createLocation = (
  position: Location.LocationObject,
): StudentSosLocation => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy:
    typeof position.coords.accuracy === "number"
      ? position.coords.accuracy
      : null,
  capturedAt: new Date(
    position.timestamp || Date.now(),
  ).toISOString(),
});

const requireStudent = () => {
  const user = useAuthStore.getState().user;

  if (!user) {
    throw new Error("Sign in before using Student SOS.");
  }

  if (!isStudentTenant(user)) {
    throw new Error(
      "Student SOS is available only to student accounts.",
    );
  }

  if (!user.organizationId?.trim()) {
    throw new Error(
      "Your student account is not linked to a registered university.",
    );
  }

  return user;
};

const requireInternet = async (): Promise<void> => {
  const network = await NetInfo.fetch();

  if (
    network.isConnected === false ||
    network.isInternetReachable === false
  ) {
    throw new Error(
      "An internet connection is required to alert your university.",
    );
  }
};

const getFreshPosition =
  async (): Promise<Location.LocationObject> => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
      return await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                "Getting your current location took too long.",
              ),
            );
          }, LOCATION_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

class StudentSosService {
  async getCurrentLocation(): Promise<StudentSosLocation> {
    requireStudent();

    const enabled =
      await Location.hasServicesEnabledAsync();

    if (!enabled) {
      throw new Error(
        "Turn on Location Services before sending an SOS.",
      );
    }

    let permission =
      await Location.getForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      permission =
        await Location.requestForegroundPermissionsAsync();
    }

    if (permission.status !== "granted") {
      throw new Error(
        "Location permission is required so your university can locate you.",
      );
    }

    try {
      return createLocation(
        await getFreshPosition(),
      );
    } catch (freshError) {
      const lastKnown =
        await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000,
          requiredAccuracy: 500,
        });

      if (lastKnown) {
        return createLocation(lastKnown);
      }

      throw freshError;
    }
  }

  async send(
    incidentType: StudentSosIncidentType,
    location: StudentSosLocation,
  ): Promise<StudentSosResult> {
    requireStudent();
    await requireInternet();

    return pushFunctionService.sendStudentSos({
      incidentType,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      capturedAt: location.capturedAt,
      clientRequestId: createClientRequestId(),
    });
  }
}

export const studentSosService =
  new StudentSosService();

export default studentSosService;