import { Alert, Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { databases, config } from "./appwrite";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    Alert.alert(
      "Push Notifications",
      "Push notifications require a physical device.",
    );
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    Alert.alert(
      "Push Notifications",
      "Permission denied. Please enable notifications in your device settings.",
    );
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  return token;
}

export async function updateUserPushToken(
  userDocId: string,
  token: string | null,
) {
  if (!userDocId) return;

  try {
    await databases.updateDocument(
      config.databaseId!,
      config.usersCollectionId!,
      userDocId,
      {
        expoPushToken: token || "",
      },
    );
  } catch (error) {
    console.error("Error updating push token for user:", error);
  }
}
