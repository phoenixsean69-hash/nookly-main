import "expo-sqlite/localStorage/install";
import "react-native-url-polyfill/auto";

import OfflineStatusBanner from "@/components/OfflineStatusBanner";
import { requestDriverRealtimeRefresh } from "@/lib/driverRealtimeSync";
import { registerForPushNotifications } from "@/lib/notifications";
import {
  getModeAwareRoute,
  getUserHomeRoute,
  isLandlordUser,
} from "@/lib/userMode";
import pushFunctionService from "@/services/push-function.service";
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

const EXPO_PUSH_TOKEN_STORAGE_KEY = "nookly_expo_push_token";

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

  const fetchAuthenticatedUser = useAuthStore(
    (state) => state.fetchAuthenticatedUser,
  );
  const user = useAuthStore((state) => state.user);
  const hydrate = useAuthStore((state) => state.hydrate);

  const initializeOffline = useOfflineStore((state) => state.initialize);
  const offlineInitialized = useOfflineStore((state) => state.isInitialized);
  const isOnline = useOfflineStore((state) => state.isOnline);

  const [appIsReady, setAppIsReady] = useState(false);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const previousOnlineRef = useRef(false);

  useEffect(() => {
    let active = true;

    const initializeApp = async () => {
      try {
        await Promise.all([
          hydrate(),
          initializeOffline().catch((error) => {
            console.error("Offline storage initialization failed:", error);
          }),
        ]);

        const online = useOfflineStore.getState().isOnline;
        const cachedUser = useAuthStore.getState().user;

        previousOnlineRef.current = online;

        if (online && !cachedUser) {
          await fetchAuthenticatedUser();
        } else if (online) {
          void fetchAuthenticatedUser();
        }
      } catch (error) {
        console.error("App initialization failed:", error);
      } finally {
        if (active) {
          setAppIsReady(true);
        }
      }
    };

    void initializeApp();

    return () => {
      active = false;
    };
  }, [fetchAuthenticatedUser, hydrate, initializeOffline]);

  useEffect(() => {
    if (!appIsReady || !offlineInitialized) return;

    if (isOnline && !previousOnlineRef.current) {
      void fetchAuthenticatedUser();
    }

    previousOnlineRef.current = isOnline;
  }, [appIsReady, fetchAuthenticatedUser, isOnline, offlineInitialized]);

  useEffect(() => {
    if (!fontsLoaded || !appIsReady) return;

    SplashScreen.hideAsync().catch(() => undefined);
  }, [appIsReady, fontsLoaded]);

  useEffect(() => {
    let cancelled = false;

    const registerPushNotifications = async () => {
      if (!isOnline || !user?.accountId) return;

      try {
        const pushEnabled = await AsyncStorage.getItem(
          "push_notifications_enabled",
        );

        if (pushEnabled === "false") return;

        const token = await registerForPushNotifications();

        if (!token || cancelled) return;

        const result = await pushFunctionService.registerDevice(
          token,
          Platform.OS,
        );

        if (cancelled) return;

        await AsyncStorage.setItem(EXPO_PUSH_TOKEN_STORAGE_KEY, token);

        console.log(
          "Push device registered through Nookly Push API",
          {
            tokenRowId: result.tokenRowId,
            created: result.created,
            isActive: result.isActive,
            duplicatesDeactivated:
              result.duplicatesDeactivated ?? 0,
          },
        );
      } catch (error) {
        console.error("Push registration error:", error);
      }
    };

    void registerPushNotifications();

    return () => {
      cancelled = true;
    };
  }, [isOnline, user?.accountId]);

  useEffect(() => {
    const handleNotificationNavigation = (data?: Record<string, any>) => {
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

        case "property": {
          const propertyId =
            typeof data.propertyId === "string"
              ? data.propertyId.trim()
              : "";

          if (propertyId) {
            router.push(
              `/properties/${propertyId}` as any,
            );
            return;
          }

          // Older property notifications may not include a property ID.
          router.push(
            getModeAwareRoute(
              "/explore",
              currentUser,
            ) as any,
          );
          return;
        }
        case "lease":
          router.push({
            pathname: getModeAwareRoute(
              "/myRequests",
              currentUser,
            ),
            params: {
              requestId:
                typeof data.requestId === "string"
                  ? data.requestId
                  : "",
            },
          } as any);
          return;

        case "driver_ride": {
          const rideEvent =
            typeof data.rideEvent === "string"
              ? data.rideEvent
              : "";
          const requestId =
            typeof data.requestId === "string"
              ? data.requestId
              : "";

          if (
            rideEvent === "request_created" &&
            requestId
          ) {
            router.push({
              pathname:
                "/rides/driver-request/[requestId]" as any,
              params: { requestId },
            });
            return;
          }

          router.push({
            pathname: "/driver-rides" as any,
            params: {
              section:
                rideEvent === "offer_accepted"
                  ? "confirmed"
                  : rideEvent === "request_cancelled"
                    ? "offers"
                    : "requests",
              offerFilter:
                rideEvent === "request_cancelled"
                  ? "closed"
                  : "",
              requestId,
              offerId:
                typeof data.offerId === "string"
                  ? data.offerId
                  : "",
              rideId:
                typeof data.rideId === "string"
                  ? data.rideId
                  : "",
            },
          });
          return;
        }

        // NOOKLY_REQUEST_RESPONSE_PUSH_V1_MOBILE
        case "request_response":
          router.push({
            pathname: getModeAwareRoute(
              "/myRequests",
              currentUser,
            ),
            params: {
              requestId:
                typeof data.requestId === "string"
                  ? data.requestId
                  : "",
            },
          } as any);
          return;

        case "alert":
          router.push(homeRoute as any);
          return;

        default:
          if (typeof data.screen === "string") {
            router.push(getModeAwareRoute(data.screen, currentUser) as any);
          } else {
            router.push(homeRoute as any);
          }
      }
    };

    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        const { title, body } = notification.request.content;
        console.log(`Notification received: ${title} - ${body}`);
        requestDriverRealtimeRefresh("push-received");
      });

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        requestDriverRealtimeRefresh("push-opened");
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

  if (!fontsLoaded || !appIsReady) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <OfflineStatusBanner />
      <View className="flex-1">
        <Slot />
      </View>
    </View>
  );
}

