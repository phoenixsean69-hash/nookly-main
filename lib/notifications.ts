// lib/notifications.ts

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const DEFAULT_CHANNEL_ID = "default";
const TOKEN_ATTEMPTS = 3;
const TOKEN_RETRY_DELAY_MS = 1500;

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.warn("Push registration skipped: a physical device is required.");
    return null;
  }

  try {
    // Android must have a notification channel before requesting permission
    // and before obtaining an Expo/native push token.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      });

      console.log("✅ Android notification channel is ready.");
    }

    const currentPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermissions.status;

    console.log("Push notification permission status:", finalStatus);

    if (finalStatus !== "granted") {
      const requestedPermissions =
        await Notifications.requestPermissionsAsync();

      finalStatus = requestedPermissions.status;

      console.log(
        "Push notification permission after request:",
        finalStatus,
      );
    }

    if (finalStatus !== "granted") {
      console.warn(
        `Push registration stopped: notification permission is "${finalStatus}".`,
      );
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;

    if (!projectId) {
      console.error(
        "Push registration stopped: missing EAS projectId (expoConfig/easConfig).",
      );
      return null;
    }

    console.log("Push registration EAS projectId:", projectId);

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= TOKEN_ATTEMPTS; attempt += 1) {
      try {
        const tokenResponse =
          await Notifications.getExpoPushTokenAsync({
            projectId,
          });

        const token = tokenResponse.data?.trim();

        if (!token) {
          throw new Error("Expo returned an empty push token.");
        }

        console.log(
          `✅ Expo push token acquired on attempt ${attempt}.`,
        );

        return token;
      } catch (error) {
        lastError = error;

        console.error(
          `Expo push token attempt ${attempt}/${TOKEN_ATTEMPTS} failed:`,
          error,
        );

        if (attempt < TOKEN_ATTEMPTS) {
          await wait(TOKEN_RETRY_DELAY_MS * attempt);
        }
      }
    }

    console.error(
      "Push registration stopped: Expo push token could not be acquired.",
      lastError,
    );

    return null;
  } catch (error) {
    console.error(
      "Push registration failed before backend registration:",
      error,
    );
    return null;
  }
}
