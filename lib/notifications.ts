// lib/notifications.ts

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // projectId is required for standalone (APK/IPA) builds
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    console.error("Missing EAS projectId (expoConfig/easConfig)");
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId }))
    .data;

  return token;
}
