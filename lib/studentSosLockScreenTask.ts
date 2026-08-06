import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import {
  cacheStudentSosLocationAsync,
  configureStudentSosNotificationsAsync,
  getCachedStudentSosLocationAsync,
  isStudentSosSafetyModeEnabledAsync,
  presentStudentSosSafetyNotificationAsync,
  STUDENT_SOS_NOTIFICATION_TASK,
  STUDENT_SOS_SEND_ACTION_ID,
  STUDENT_SOS_STATUS_CHANNEL_ID,
} from "@/services/student-sos-lock-screen.service";

import pushFunctionService from "@/services/push-function.service";
import studentSosService from "@/services/student-sos.service";
import useAuthStore from "@/store/auth.store";

import type {
  StudentSosLocation,
  StudentSosResult,
} from "@/types/student-sos";

const ACTION_LOCK_KEY =
  "nookly_student_sos_action_lock_time";

const ACTION_LOCK_WINDOW_MS =
  12_000;

const isActionResponse = (
  value: unknown,
): value is {
  actionIdentifier: string;
} =>
  Boolean(
    value &&
      typeof value === "object" &&
      "actionIdentifier" in value &&
      typeof (
        value as {
          actionIdentifier?: unknown;
        }
      ).actionIdentifier === "string",
  );

const buildLockScreenRequestId = (
  accountId: string,
  timestamp: number,
): string => {
  const safeAccountId =
    accountId
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "",
      )
      .slice(0, 12) || "student";

  const timeWindow =
    Math.floor(
      timestamp /
        ACTION_LOCK_WINDOW_MS,
    ).toString(36);

  return [
    "lockscreen",
    safeAccountId,
    timeWindow,
  ].join("-");
};

const showStatusNotificationAsync =
  async (
    title: string,
    body: string,
    result?: StudentSosResult,
  ): Promise<void> => {
    await configureStudentSosNotificationsAsync();

    await Notifications
      .scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            type:
              "student_sos_status",
            alertId:
              result?.alertId ?? "",
            organizationId:
              result?.organizationId ??
              "",
          },
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
            STUDENT_SOS_STATUS_CHANNEL_ID,
        },
      });
  };

const acquireActionLockAsync =
  async (): Promise<boolean> => {
    const now = Date.now();

    const previousValue =
      await AsyncStorage.getItem(
        ACTION_LOCK_KEY,
      );

    const previousTime =
      Number(previousValue ?? 0);

    if (
      Number.isFinite(previousTime) &&
      now - previousTime <
        ACTION_LOCK_WINDOW_MS
    ) {
      return false;
    }

    await AsyncStorage.setItem(
      ACTION_LOCK_KEY,
      String(now),
    );

    return true;
  };

const getBestLockScreenLocationAsync =
  async (): Promise<StudentSosLocation> => {
    try {
      const location =
        await studentSosService
          .getCurrentLocation();

      await cacheStudentSosLocationAsync(
        location,
      );

      return location;
    } catch (freshLocationError) {
      const cachedLocation =
        await getCachedStudentSosLocationAsync();

      if (cachedLocation) {
        return cachedLocation;
      }

      throw freshLocationError;
    }
  };

const executeLockScreenSosAsync =
  async (): Promise<void> => {
    if (
      !(
        await isStudentSosSafetyModeEnabledAsync()
      )
    ) {
      return;
    }

    if (
      !(
        await acquireActionLockAsync()
      )
    ) {
      return;
    }

    await useAuthStore
      .getState()
      .hydrate();

    const user =
      useAuthStore.getState().user;

    if (!user?.accountId) {
      throw new Error(
        "Open Nookly and sign in again before using lock-screen SOS.",
      );
    }

    const location =
      await getBestLockScreenLocationAsync();

    const requestTime =
      Date.now();

    const result =
      await pushFunctionService
        .sendStudentSos({
          incidentType:
            "other_danger",
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
            buildLockScreenRequestId(
              user.accountId,
              requestTime,
            ),
        });

    const pushAccepted =
      Number(
        result.push?.accepted ?? 0,
      );

    const message =
      pushAccepted > 0
        ? `SOS recorded. A mobile push alert was accepted for ${result.organizationName}.`
        : `SOS recorded for ${result.organizationName}. The in-app alert was saved.`;

    await showStatusNotificationAsync(
      result.duplicate
        ? "SOS already recorded"
        : "SOS recorded",
      message,
      result,
    );
  };

if (
  !TaskManager.isTaskDefined(
    STUDENT_SOS_NOTIFICATION_TASK,
  )
) {
  TaskManager.defineTask<Notifications.NotificationTaskPayload>(
    STUDENT_SOS_NOTIFICATION_TASK,
    async ({
      data,
      error,
    }) => {
      if (error) {
        console.error(
          "Lock-screen SOS task error:",
          error,
        );

        return;
      }

      if (
        !isActionResponse(data) ||
        data.actionIdentifier !==
          STUDENT_SOS_SEND_ACTION_ID
      ) {
        return;
      }

      try {
        await executeLockScreenSosAsync();
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Lock-screen SOS could not be sent.";

        console.error(
          "Lock-screen SOS failed:",
          caughtError,
        );

        await showStatusNotificationAsync(
          "SOS not sent",
          message,
        ).catch(() => undefined);
      } finally {
        await presentStudentSosSafetyNotificationAsync()
          .catch(() => undefined);
      }
    },
  );
}

void (async () => {
  try {
    const registered =
      await TaskManager
        .isTaskRegisteredAsync(
          STUDENT_SOS_NOTIFICATION_TASK,
        );

    if (!registered) {
      await Notifications
        .registerTaskAsync(
          STUDENT_SOS_NOTIFICATION_TASK,
        );
    }
  } catch (error) {
    console.error(
      "Could not register lock-screen SOS task:",
      error,
    );
  }
})();