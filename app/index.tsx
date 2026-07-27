// app/index.tsx
import foundHome from "@/assets/images/foundHome.jpg";
import happyStudents from "@/assets/images/happyStudents.jpg";
import manageProperty from "@/assets/images/manageProperty.jpg";
import meetingAgent from "@/assets/images/meetingAgent.jpg";
import morning from "@/assets/images/morning.jpg";
import sunset from "@/assets/images/sunset.jpg";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import {
  getUserHomeRoute,
  getUserModeLabel,
  isTenantUser,
} from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");

const backgroundImages = [
  happyStudents,
  foundHome,
  manageProperty,
  meetingAgent,
  morning,
  sunset,
];

export default function Index() {
  const {
    user,
    isLoading,
    isAuthenticated,
    isInitialized,
    isHydrated,
    fetchAuthenticatedUser,
    hydrate,
    loadUserFromStorage,
  } = useAuthStore();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [offlineMessageShown, setOfflineMessageShown] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [localUser, setLocalUser] = useState<typeof user>(null);
  const [isStorageLoaded, setIsStorageLoaded] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    let mounted = true;

    const loadStoredUser = async () => {
      try {
        const storedUser = await loadUserFromStorage();
        if (mounted) setLocalUser(storedUser);
      } catch (error) {
        console.error("Failed to load stored user:", error);
        if (mounted) setLocalUser(null);
      } finally {
        if (mounted) setIsStorageLoaded(true);
      }
    };

    loadStoredUser();

    return () => {
      mounted = false;
    };
  }, [loadUserFromStorage]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (isConnected !== true || !isStorageLoaded) return;

    fetchAuthenticatedUser();
  }, [fetchAuthenticatedUser, isConnected, isStorageLoaded]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(Boolean(state.isConnected));
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (
      !isStorageLoaded ||
      isConnected === null ||
      !isInitialized ||
      !isHydrated
    ) {
      return;
    }

    if (!isConnected) {
      setOfflineMessageShown(true);
      return;
    }

    setOfflineMessageShown(false);

    const activeUser = user || localUser;

    if (activeUser && (isAuthenticated || localUser)) {
      router.replace(getUserHomeRoute(activeUser) as any);
      return;
    }

    if (!isLoading) {
      router.replace("/sign-up");
    }
  }, [
    isAuthenticated,
    isConnected,
    isHydrated,
    isInitialized,
    isLoading,
    isStorageLoaded,
    localUser,
    user,
  ]);

  useEffect(() => {
    if (!offlineMessageShown) return;

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }).start(() => {
        setCurrentImageIndex((current) => {
          return (current + 1) % backgroundImages.length;
        });

        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [fadeAnim, offlineMessageShown]);

  const handleRetry = async () => {
    const state = await NetInfo.fetch();

    if (!state.isConnected) return;

    setOfflineMessageShown(false);
    await fetchAuthenticatedUser();

    const currentUser = useAuthStore.getState().user || localUser;
    if (currentUser) {
      router.replace(getUserHomeRoute(currentUser) as any);
    }
  };

  const activeUser = user || localUser;

  if (!isStorageLoaded) {
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
          Loading your data...
        </Text>
      </View>
    );
  }

  if (offlineMessageShown && activeUser) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.navBackground }}>
        <Animated.Image
          source={backgroundImages[currentImageIndex]}
          style={{
            position: "absolute",
            width,
            height,
            opacity: fadeAnim,
          }}
          resizeMode="cover"
        />

        <View
          style={{
            position: "absolute",
            width,
            height,
            backgroundColor: "rgba(0,0,0,0.62)",
          }}
        />

        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 py-12 min-h-screen">
            <View className="flex-row items-center justify-end mb-8">
              <View className="mr-3">
                <Text className="text-white/90 text-right text-sm">
                  {activeUser.email}
                </Text>
                <Text className="text-white/60 text-right text-xs mt-1">
                  {getUserModeLabel(activeUser)}
                </Text>
              </View>

              <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center overflow-hidden">
                {activeUser.avatar ? (
                  <Image
                    source={{ uri: activeUser.avatar }}
                    className="w-full h-full"
                  />
                ) : (
                  <Text className="text-white text-xl font-rubik-bold">
                    {activeUser.name?.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
            </View>

            <View className="items-center mb-8">
              <Text className="text-3xl font-rubik-bold text-center mb-2 text-white">
                Hi {activeUser.name}!
              </Text>
              <Text className="text-base text-center text-white/90">
                You&apos;re currently offline
              </Text>
            </View>

            <View className="bg-white/20 rounded-2xl p-4 mb-auto w-full">
              <Text className="text-center text-sm text-white">
                You can still browse content that has been saved on this
                device, including your offline favourites.
              </Text>
            </View>

            <View className="flex-row gap-3 w-full mt-8">
              <TouchableOpacity
                onPress={handleRetry}
                className="py-4 rounded-full flex-1"
                style={{ backgroundColor: theme.primary[300] }}
              >
                <Text className="text-white font-rubik-bold text-center">
                  Retry connection
                </Text>
              </TouchableOpacity>

              {isTenantUser(activeUser) && (
                <TouchableOpacity
                  onPress={() => router.replace("/offline-favorites")}
                  className="bg-orange-500 py-4 rounded-full flex-1"
                >
                  <Text className="text-white font-rubik-bold text-center">
                    See favourites
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text className="text-center text-xs mt-8 text-white/60">
              Nookly v1.0.0 • Find Your Cozy Corner
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (offlineMessageShown && !activeUser) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.navBackground }}>
        <Animated.Image
          source={backgroundImages[currentImageIndex]}
          style={{
            position: "absolute",
            width,
            height,
            opacity: fadeAnim,
          }}
          resizeMode="cover"
        />

        <View
          style={{
            position: "absolute",
            width,
            height,
            backgroundColor: "rgba(0,0,0,0.62)",
          }}
        />

        <View className="flex-1 px-6 items-center justify-center">
          <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
            <Image source={images.icon} className="w-12 h-12" />
          </View>

          <Text className="text-3xl font-rubik-bold text-center text-white">
            Welcome to Nookly
          </Text>
          <Text className="text-base text-center mt-3 text-white/90">
            Connect to the internet to create or access your account.
          </Text>

          <TouchableOpacity
            onPress={handleRetry}
            className="w-full py-4 rounded-full mt-8"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-bold text-center">
              Retry connection
            </Text>
          </TouchableOpacity>
        </View>
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
        {isLoading ? "Loading your data..." : "Starting Nookly..."}
      </Text>
    </View>
  );
}
