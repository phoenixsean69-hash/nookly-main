import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import studentSosService from "@/services/student-sos.service";
import type { StudentSosLocation } from "@/types/student-sos";

export const STUDENT_SOS_NOTIFICATION_TASK =
  "NOOKLY_STUDENT_SOS_NOTIFICATION_TASK";

export const STUDENT_SOS_CATEGORY_ID =
  "nooklysosready";

export const STUDENT_SOS_SEND_ACTION_ID =
  "NOOKLY_SEND_STUDENT_SOS";

export const STUDENT_SOS_SAFETY_CHANNEL_ID =
  "nookly-safety-mode";

export const STUDENT_SOS_STATUS_CHANNEL_ID =
  "nookly-safety-status";

const SAFETY_MODE_ENABLED_KEY =
  "nookly_student_sos_safety_mode_enabled";

const SAFETY_NOTIFICATION_ID_KEY =
  "nookly_student_sos_safety_notification_id";

const CACHED_LOCATION_KEY =
  "nookly_student_sos_cached_location";

const MAX_CACHED_LOCATION_AGE_MS =
  25 * 60 * 1000;

export interface StudentSosSafetyModeStatus {
  enabled: boolean;
  notificationId: string | null;
  cachedLocation: StudentSosLocation | null;
}

const parseCachedLocation = (
  raw: string | null,
): StudentSosLocation | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      raw,
    ) as Partial<StudentSosLocation>;

    if (
      typeof parsed.latitude !== "number" ||
      !Number.isFinite(parsed.latitude) ||
      typeof parsed.longitude !== "number" ||
      !Number.isFinite(parsed.longitude) ||
      typeof parsed.capturedAt !== "string" ||
      !parsed.capturedAt
    ) {
      return null;
    }

    return {
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      accuracy:
        typeof parsed.accuracy === "number" &&
        Number.isFinite(parsed.accuracy)
          ? parsed.accuracy
          : null,
      capturedAt: parsed.capturedAt,
      address:
        typeof parsed.address === "string" &&
        parsed.address.trim()
          ? parsed.address.trim()
          : `Latitude ${parsed.latitude.toFixed(
              6,
            )}, Longitude ${parsed.longitude.toFixed(
              6,
            )}`,
    };
  } catch {
    return null;
  }
};

export const cacheStudentSosLocationAsync =
  async (
    location: StudentSosLocation,
  ): Promise<void> => {
    await AsyncStorage.setItem(
      CACHED_LOCATION_KEY,
      JSON.stringify(location),
    );
  };

export const getCachedStudentSosLocationAsync =
  async (
    maximumAgeMs =
      MAX_CACHED_LOCATION_AGE_MS,
  ): Promise<StudentSosLocation | null> => {
    const raw =
      await AsyncStorage.getItem(
        CACHED_LOCATION_KEY,
      );

    const location =
      parseCachedLocation(raw);

    if (!location) {
      return null;
    }

    const capturedTime = new Date(
      location.capturedAt,
    ).getTime();

    if (
      !Number.isFinite(capturedTime) ||
      Date.now() - capturedTime >
        maximumAgeMs
    ) {
      return null;
    }

    return location;
  };

const hasNotificationPermission =
  async (): Promise<boolean> => {
    const permission =
      await Notifications
        .getPermissionsAsync();

    return (
      permission.granted === true ||
      permission.status === "granted"
    );
  };

const requireNotificationPermission =
  async (): Promise<void> => {
    if (
      await hasNotificationPermission()
    ) {
      return;
    }

    const permission =
      await Notifications
        .requestPermissionsAsync();

    if (
      permission.granted !== true &&
      permission.status !== "granted"
    ) {
      throw new Error(
        "Notification permission is required for lock-screen SOS.",
      );
    }
  };

export const configureStudentSosNotificationsAsync =
  async (): Promise<void> => {
    if (Platform.OS !== "android") {
      return;
    }

    await Notifications
      .setNotificationChannelAsync(
        STUDENT_SOS_SAFETY_CHANNEL_ID,
        {
          name: "Nookly Safety Mode",
          description:
            "Persistent lock-screen SOS controls.",
          importance:
            Notifications
              .AndroidImportance.HIGH,
          lockscreenVisibility:
            Notifications
              .AndroidNotificationVisibility
              .PUBLIC,
          sound: null,
          enableVibrate: false,
          vibrationPattern: [0],
          showBadge: false,
          lightColor: "#DC2626",
        },
      );

    await Notifications
      .setNotificationChannelAsync(
        STUDENT_SOS_STATUS_CHANNEL_ID,
        {
          name: "Nookly SOS Status",
          description:
            "Results from lock-screen SOS actions.",
          importance:
            Notifications
              .AndroidImportance.HIGH,
          lockscreenVisibility:
            Notifications
              .AndroidNotificationVisibility
              .PUBLIC,
          sound: "default",
          enableVibrate: true,
          vibrationPattern: [
            0,
            250,
            150,
            250,
          ],
          showBadge: true,
          lightColor: "#DC2626",
        },
      );

    await Notifications
      .setNotificationCategoryAsync(
        STUDENT_SOS_CATEGORY_ID,
        [
          {
            identifier:
              STUDENT_SOS_SEND_ACTION_ID,
            buttonTitle: "SEND SOS",
            options: {
              opensAppToForeground:
                false,
              isAuthenticationRequired:
                false,
              isDestructive: true,
            },
          },
        ],
      );
  };

const cancelStoredSafetyNotificationAsync =
  async (): Promise<void> => {
    const notificationId =
      await AsyncStorage.getItem(
        SAFETY_NOTIFICATION_ID_KEY,
      );

    if (!notificationId) {
      return;
    }

    await Promise.all([
      Notifications
        .dismissNotificationAsync(
          notificationId,
        )
        .catch(() => undefined),

      Notifications
        .cancelScheduledNotificationAsync(
          notificationId,
        )
        .catch(() => undefined),
    ]);

    await AsyncStorage.removeItem(
      SAFETY_NOTIFICATION_ID_KEY,
    );
  };

export const presentStudentSosSafetyNotificationAsync =
  async (): Promise<string> => {
    if (Platform.OS !== "android") {
      throw new Error(
        "Lock-screen Safety Mode is currently available on Android only.",
      );
    }

    await configureStudentSosNotificationsAsync();

    await cancelStoredSafetyNotificationAsync();

    const notificationId =
      await Notifications
        .scheduleNotificationAsync({
          content: {
            title:
              "Nookly Safety Mode",
            body:
              "Emergency button ready. SEND SOS alerts your Institution as Other danger.",
            data: {
              type:
                "nookly_student_sos_ready",
              source:
                "student_safety_mode",
            },
            categoryIdentifier:
              STUDENT_SOS_CATEGORY_ID,
            sticky: true,
            autoDismiss: false,
            color: "#DC2626",
            priority:
              Notifications
                .AndroidNotificationPriority
                .HIGH,
          },
          trigger: {
            type:
              Notifications
                .SchedulableTriggerInputTypes
                .TIME_INTERVAL,
            seconds: 1,
            repeats: false,
            channelId:
              STUDENT_SOS_SAFETY_CHANNEL_ID,
          },
        });

    await AsyncStorage.setItem(
      SAFETY_NOTIFICATION_ID_KEY,
      notificationId,
    );

    return notificationId;
  };

export const enableStudentSosSafetyModeAsync =
  async (): Promise<StudentSosSafetyModeStatus> => {
    if (Platform.OS !== "android") {
      throw new Error(
        "Lock-screen Safety Mode is currently available on Android only.",
      );
    }

    await requireNotificationPermission();

    const currentLocation =
      await studentSosService
        .getCurrentLocation();

    await cacheStudentSosLocationAsync(
      currentLocation,
    );

    await AsyncStorage.setItem(
      SAFETY_MODE_ENABLED_KEY,
      "true",
    );

    const notificationId =
      await presentStudentSosSafetyNotificationAsync();

    return {
      enabled: true,
      notificationId,
      cachedLocation:
        currentLocation,
    };
  };

export const disableStudentSosSafetyModeAsync =
  async (): Promise<StudentSosSafetyModeStatus> => {
    await AsyncStorage.setItem(
      SAFETY_MODE_ENABLED_KEY,
      "false",
    );

    await cancelStoredSafetyNotificationAsync();

    return {
      enabled: false,
      notificationId: null,
      cachedLocation:
        await getCachedStudentSosLocationAsync(),
    };
  };

export const isStudentSosSafetyModeEnabledAsync =
  async (): Promise<boolean> =>
    (await AsyncStorage.getItem(
      SAFETY_MODE_ENABLED_KEY,
    )) === "true";

export const getStudentSosSafetyModeStatusAsync =
  async (): Promise<StudentSosSafetyModeStatus> => ({
    enabled:
      await isStudentSosSafetyModeEnabledAsync(),

    notificationId:
      await AsyncStorage.getItem(
        SAFETY_NOTIFICATION_ID_KEY,
      ),

    cachedLocation:
      await getCachedStudentSosLocationAsync(),
  });

export const refreshStudentSosSafetyLocationAsync =
  async (): Promise<StudentSosLocation> => {
    const location =
      await studentSosService
        .getCurrentLocation();

    await cacheStudentSosLocationAsync(
      location,
    );

    return location;
  };

export const restoreStudentSosSafetyNotificationAsync =
  async (): Promise<void> => {
    if (
      Platform.OS !== "android" ||
      !(
        await isStudentSosSafetyModeEnabledAsync()
      )
    ) {
      return;
    }

    await requireNotificationPermission();
    await presentStudentSosSafetyNotificationAsync();
  };