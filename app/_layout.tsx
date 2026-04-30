// app/_layout.tsx
import { AuthProvider } from "@/context/AuthContext";
import notificationService from "@/services/notification.service";
import useAuthStore from "@/store/auth.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { LogBox, Platform } from "react-native";
import "./global.css";

// Ignore specific warnings that are not critical
LogBox.ignoreLogs([
  "JSON Parse error",
  "Error parsing reviews",
  "Setting a timer",
]);

// Optional: Ignore all warnings in production
if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

// Ignore specific Appwrite-related errors
LogBox.ignoreLogs([
  "JSON Parse error: Unexpected character: G",
  "Error parsing reviews",
  "Error fetchingagent",
  "Error checking like status",
]);

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Rubik-Bold": require("../assets/fonts/Rubik-Bold.ttf"),
    "Rubik-ExtraBold": require("../assets/fonts/Rubik-ExtraBold.ttf"),
    "Rubik-Light": require("../assets/fonts/Rubik-Light.ttf"),
    "Rubik-Medium": require("../assets/fonts/Rubik-Medium.ttf"),
    "Rubik-Regular": require("../assets/fonts/Rubik-Regular.ttf"),
    "Rubik-SemiBold": require("../assets/fonts/Rubik-SemiBold.ttf"),
  });

  const { fetchAuthenticatedUser, user } = useAuthStore();
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Fetch authenticated user on mount
  useEffect(() => {
    fetchAuthenticatedUser();
  }, [fetchAuthenticatedUser]);

  // Hide splash screen when fonts are loaded
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Register for push notifications when user is logged in
  useEffect(() => {
    const registerPushNotifications = async () => {
      if (!user?.accountId) return;

      try {
        // Check if user has enabled push notifications
        const pushEnabled = await AsyncStorage.getItem(
          "push_notifications_enabled",
        );
        if (pushEnabled === "false") return;

        // Register for push notifications
        const token =
          await notificationService.registerForPushNotificationsAsync(
            user.accountId,
          );

        if (token) {
          console.log("✅ Push notification registered successfully");
        }
      } catch (error) {
        console.error("Push registration error:", error);
      }
    };

    registerPushNotifications();
  }, [user]);

  // Handle notification listeners
  useEffect(() => {
    // Handle notifications received while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("📱 Notification received in foreground:", notification);

        // You can update app state or show an in-app alert here
        const { title, body } = notification.request.content;
        console.log(`Notification: ${title} - ${body}`);
      });

    // Handle notification tap (when user clicks on notification)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("🔘 Notification tapped:", response);

        const data = response.notification.request.content.data;
        const { user } = useAuthStore.getState(); // ✅ get current user outside of hook
        const isLandlord = user?.userMode === "landlord";

        if (!data) {
          router.push(isLandlord ? "/landHome" : "/tenantHome");
          return;
        }

        if (data.type === "match") {
          router.push("/match");
        } else if (data.type === "request") {
          router.push("/Landrequests");
        } else if (data.type === "property") {
          router.push("/explore");
        } else if (data.type === "request_response") {
          router.push("/tenantHome");
        } else if (data.type === "alert") {
          // ✅ Dynamic based on userMode
          router.push(isLandlord ? "/landHome" : "/tenantHome");
        } else if (data.screen && typeof data.screen === "string") {
          router.push(data.screen as any);
        } else {
          // ✅ Default fallback also dynamic
          router.push(isLandlord ? "/landHome" : "/tenantHome");
        }
      });

    // Cleanup listeners on unmount
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  // Setup Android notification channel
  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
        sound: "default",
      }).catch((error) =>
        console.error("Error setting notification channel:", error),
      );
    }
  }, []);

  // Remove push token on logout (listen for user logout)
  useEffect(() => {
    const removeTokenOnLogout = async () => {
      if (!user?.accountId) return;

      // This will run when user becomes null (logged out)
      const token = notificationService.getExpoPushToken();
      if (token) {
        await notificationService.deactivatePushToken(user.accountId, token);
        console.log("🔴 Push token deactivated on logout");
      }
    };

    // If user was logged out, remove token
    if (!user && user === null) {
      removeTokenOnLogout();
    }
  }, [user]);

  // 🚀 Render navigator
  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}
