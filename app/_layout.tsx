import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

import { AuthProvider } from "@/context/AuthContext";
import {
  getModeAwareRoute,
  getUserHomeRoute,
  isLandlordUser,
} from "@/lib/userMode";
import notificationService from "@/services/notification.service";
import useAuthStore from "@/store/auth.store";
import useOfflineStore from "@/store/offline.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { router, Slot } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, LogBox, Platform, View } from "react-native";
import "./global.css";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

LogBox.ignoreLogs([
  "JSON Parse error",
  "Error parsing reviews",
  "Setting a timer",
  "JSON Parse error: Unexpected character: G",
  "Error fetchingagent",
  "Error checking like status",
]);

if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

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

  const { fetchAuthenticatedUser, user, hydrate } = useAuthStore();
  const initializeOffline = useOfflineStore((state) => state.initialize);
  const [appIsReady, setAppIsReady] = useState(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    initializeOffline().catch((error) => {
      console.error("Offline storage initialization failed:", error);
    });
  }, [initializeOffline]);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await hydrate();
        await fetchAuthenticatedUser();
      } catch (error) {
        console.error("App initialization failed:", error);
      } finally {
        setAppIsReady(true);
      }
    };

    initializeApp();
  }, [fetchAuthenticatedUser, hydrate]);

  useEffect(() => {
    if (!fontsLoaded || !appIsReady) return;

    SplashScreen.hideAsync().catch(() => undefined);
  }, [appIsReady, fontsLoaded]);

  useEffect(() => {
    const registerPushNotifications = async () => {
      if (!user?.accountId) return;

      try {
        const pushEnabled = await AsyncStorage.getItem(
          "push_notifications_enabled",
        );

        if (pushEnabled === "false") return;

        await notificationService.registerForPushNotificationsAsync(
          user.accountId,
        );
      } catch (error) {
        console.error("Push registration error:", error);
      }
    };

    registerPushNotifications();
  }, [user?.accountId]);

  useEffect(() => {
    const handleNotificationNavigation = (
      data?: Record<string, any>,
    ) => {
      const currentUser = useAuthStore.getState().user;
      const homeRoute = getUserHomeRoute(currentUser);

      if (!data) {
        router.push(homeRoute as any);
        return;
      }

      switch (data.type) {
        case "match":
          router.push(getModeAwareRoute("/match", currentUser) as any);
          return;

        case "request":
          router.push(
            isLandlordUser(currentUser)
              ? ("/Landrequests" as any)
              : (getModeAwareRoute("/myRequests", currentUser) as any),
          );
          return;

        case "property":
          router.push(getModeAwareRoute("/explore", currentUser) as any);
          return;

        case "request_response":
        case "alert":
          router.push(homeRoute as any);
          return;

        default:
          if (typeof data.screen === "string") {
            router.push(
              getModeAwareRoute(data.screen, currentUser) as any,
            );
          } else {
            router.push(homeRoute as any);
          }
      }
    };

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { title, body } = notification.request.content;
        console.log(`Notification received: ${title} - ${body}`);
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        handleNotificationNavigation(
          response.notification.request.content.data as Record<string, any>,
        );
      });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response) return;

        handleNotificationNavigation(
          response.notification.request.content.data as Record<string, any>,
        );
      })
      .catch((error) => {
        console.error("Failed to read launch notification:", error);
      });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
      sound: "default",
    }).catch((error) => {
      console.error("Error setting notification channel:", error);
    });
  }, []);

  const previousAccountIdRef = useRef<string | null>(null);

  useEffect(() => {
    const removeTokenOnLogout = async (accountId: string) => {
      const token = notificationService.getExpoPushToken();

      if (!token) return;

      try {
        await notificationService.deactivatePushToken(accountId, token);
      } catch (error) {
        console.error("Failed to deactivate push token:", error);
      }
    };

    if (user?.accountId) {
      previousAccountIdRef.current = user.accountId;
      return;
    }

    if (!user && previousAccountIdRef.current) {
      const accountId = previousAccountIdRef.current;
      previousAccountIdRef.current = null;
      removeTokenOnLogout(accountId);
    }
  }, [user]);

  if (!fontsLoaded || !appIsReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <Slot />
    </AuthProvider>
  );
}