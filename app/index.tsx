import NetInfo from "@react-native-community/netinfo";

import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { getUserHomeRoute } from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import useOfflineStore from "@/store/offline.store";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

export default function Index() {
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const hydrate = useAuthStore((state) => state.hydrate);

  const networkInitialized = useOfflineStore((state) => state.isInitialized);
  const isOnline = useOfflineStore((state) => state.isOnline);
  const syncNow = useOfflineStore((state) => state.syncNow);

  const hasNavigated = useRef(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    if (!isHydrated) {
      void hydrate();
    }
  }, [hydrate, isHydrated]);

  useEffect(() => {
    if (
      hasNavigated.current ||
      !isHydrated ||
      !isInitialized ||
      isLoading
    ) {
      return;
    }

    if (user && isAuthenticated) {
      hasNavigated.current = true;
      router.replace(getUserHomeRoute(user) as any);
      return;
    }

    if (!networkInitialized) return;

    if (isOnline) {
      hasNavigated.current = true;
      router.replace("/sign-up");
    }
  }, [
    isAuthenticated,
    isHydrated,
    isInitialized,
    isLoading,
    isOnline,
    networkInitialized,
    user,
  ]);

  const retryConnection = async () => {
    const networkState = await NetInfo.fetch();
    const online =
      networkState.isConnected === true &&
      networkState.isInternetReachable !== false;

    if (!online) return;

    await syncNow();

    const currentUser = useAuthStore.getState().user;

    if (currentUser) {
      router.replace(getUserHomeRoute(currentUser) as any);
      return;
    }

    router.replace("/sign-up");
  };

  if (
    !isHydrated ||
    !isInitialized ||
    isLoading ||
    !networkInitialized
  ) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.navBackground }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text
          className="mt-4 text-lg font-rubik-medium"
          style={{ color: theme.title }}
        >
          Loading your saved data...
        </Text>
      </View>
    );
  }

  if (!user && !isOnline) {
    return (
      <View
        className="flex-1 items-center justify-center px-7"
        style={{ backgroundColor: theme.navBackground }}
      >
        <View
          className="h-24 w-24 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primary[100] }}
        >
          <Image source={images.icon} className="h-12 w-12" />
        </View>

        <Text
          className="mt-7 text-center text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          You are offline
        </Text>

        <Text
          className="mt-3 text-center text-base font-rubik"
          style={{ color: theme.muted }}
        >
          Sign in once while connected so Nookly can save your account and
          property information for offline use.
        </Text>

        <TouchableOpacity
          onPress={retryConnection}
          className="mt-8 w-full rounded-full py-4"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <Text className="text-center font-rubik-bold text-white">
            Retry connection
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: theme.navBackground }}
    >
      <ActivityIndicator size="large" color={theme.primary[300]} />
      <Text
        className="mt-4 text-lg font-rubik-medium"
        style={{ color: theme.title }}
      >
        Opening Nookly...
      </Text>
    </View>
  );
}
