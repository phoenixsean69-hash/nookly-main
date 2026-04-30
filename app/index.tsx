// app/index.tsx
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
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

import foundHome from "@/assets/images/foundHome.jpg";
import happyStudents from "@/assets/images/happyStudents.jpg";
import manageProperty from "@/assets/images/manageProperty.jpg";
import meetingAgent from "@/assets/images/meetingAgent.jpg";
import morning from "@/assets/images/morning.jpg";
import sunset from "@/assets/images/sunset.jpg";

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
    fetchAuthenticatedUser,
    hydrate,
  } = useAuthStore();

  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [offlineMessageShown, setOfflineMessageShown] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Step 1: Hydrate cache on mount
  useEffect(() => {
    hydrate();
  }, []);

  // Step 2: Fetch fresh user from server on mount
  useEffect(() => {
    fetchAuthenticatedUser();
  }, [fetchAuthenticatedUser]);

  // Step 3: Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      setIsConnected(connected);

      // Re-fetch auth when coming back online
      // so isAuthenticated is up to date before navigation fires
      if (connected) {
        fetchAuthenticatedUser();
      }
    });

    return unsubscribe;
  }, []);

  // Step 4: Navigate based on auth + connectivity — only when fully ready
  useEffect(() => {
    // Wait until network state is known
    if (isConnected === null) return;

    // Wait until auth is fully resolved
    if (isLoading || !isInitialized) return;

    if (isConnected) {
      setOfflineMessageShown(false);

      if (isAuthenticated && user?.userMode === "tenant") {
        // Debug: Log cached user data when online
        console.log("🔍 Online - Cached User Data:", user);
        console.log("👤 User Name:", user.name);
        console.log("🏠 User Mode:", user.userMode);
        router.replace("/tenantHome");
      } else if (isAuthenticated && user?.userMode === "landlord") {
        // Debug: Log cached user data when online
        console.log("🔍 Online - Cached User Data:", user);
        console.log("👤 User Name:", user.name);
        console.log("🏠 User Mode:", user.userMode);
        router.replace("/landHome");
      } else if (!isAuthenticated) {
        router.replace("/sign-up");
      }
    } else {
      // Offline - show offline screen regardless of auth status
      setOfflineMessageShown(true);
    }
  }, [isLoading, isConnected, isAuthenticated, user, isInitialized]);

  // Step 5: Auto-swipe background images on offline screen
  useEffect(() => {
    if (!offlineMessageShown) return;

    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => {
        setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start();
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [offlineMessageShown, fadeAnim]);

  const handleRetry = () => {
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        setOfflineMessageShown(false);
        fetchAuthenticatedUser();
      }
    });
  };

  // Offline screen
  if (offlineMessageShown) {
    if (isAuthenticated && user) {
      // Personalized offline screen for authenticated users
      return (
        <View style={{ flex: 1, backgroundColor: theme.navBackground }}>
          {/* Animated Background */}
          <Animated.Image
            source={backgroundImages[currentImageIndex]}
            style={{
              position: "absolute",
              width: width,
              height: height,
              opacity: fadeAnim,
            }}
            resizeMode="cover"
          />

          {/* Dark Overlay */}
          <View
            style={{
              position: "absolute",
              width: width,
              height: height,
              backgroundColor: "rgba(0,0,0,0.6)",
            }}
          />

          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 items-center justify-center px-6 py-12 min-h-screen">
              {/* Logo */}
              <View className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-lg items-center justify-center mb-6">
                <Image source={images.icon} className="w-12 h-12" />
              </View>

              <Text className="text-3xl font-rubik-bold text-center mb-2 text-white">
                Hi {user.name}!
              </Text>

              <Text className="text-base text-center mb-8 text-white/90">
                You're currently offline
              </Text>

              <View className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-8 w-full">
                <Text className="text-center text-sm text-white">
                  You can still browse cached content and favorites.
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-4 w-full">
                <TouchableOpacity
                  onPress={handleRetry}
                  className="bg-primary-300 py-3 rounded-full flex-1"
                >
                  <Text className="text-white font-rubik-bold text-center">
                    Retry Connection
                  </Text>
                </TouchableOpacity>

                {user.userMode === "tenant" && (
                  <TouchableOpacity
                    onPress={() => router.replace("/offline-favorites")}
                    className="bg-orange-500 py-3 rounded-full flex-1"
                  >
                    <Text className="text-white font-rubik-bold text-center">
                      See Favorites
                    </Text>
                  </TouchableOpacity>
                )}

                {user.userMode !== "tenant" && (
                  <TouchableOpacity
                    onPress={() =>
                      router.replace(
                        user.userMode === "landlord"
                          ? "/landHome"
                          : "/tenantHome",
                      )
                    }
                    className="bg-green-500 py-3 rounded-full flex-1"
                  >
                    <Text className="text-white font-rubik-bold text-center">
                      Continue Offline
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
    } else {
      // Welcome screen for unauthenticated users
      return (
        <View style={{ flex: 1, backgroundColor: theme.navBackground }}>
          {/* Animated Background */}
          <Animated.Image
            source={backgroundImages[currentImageIndex]}
            style={{
              position: "absolute",
              width: width,
              height: height,
              opacity: fadeAnim,
            }}
            resizeMode="cover"
          />

          {/* Dark Overlay */}
          <View
            style={{
              position: "absolute",
              width: width,
              height: height,
              backgroundColor: "rgba(0,0,0,0.6)",
            }}
          />

          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}
          >
            <View className="flex-1 items-center justify-center px-6 py-12 min-h-screen">
              {/* Logo */}
              <View className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-lg items-center justify-center mb-6">
                <Image source={images.icon} className="w-12 h-12" />
              </View>

              <Text className="text-3xl font-rubik-bold text-center mb-2 text-white">
                Welcome to Nookly
              </Text>

              <Text className="text-base text-center mb-8 text-white/90">
                Your cozy corner in the world of renting
              </Text>

              <View className="mb-8">
                <Text className="text-xl font-rubik-bold text-center mb-3 text-white">
                  Our Story
                </Text>
                <Text className="text-sm text-center leading-6 text-white/90">
                  Nookly was born from a simple idea: finding a home
                  shouldn&apos;t feel like a job. We believe everyone deserves a
                  cozy nook to call their own.
                </Text>
              </View>

              <View className="mb-8">
                <Text className="text-xl font-rubik-bold text-center mb-3 text-white">
                  Our Mission
                </Text>
                <Text className="text-sm text-center leading-6 text-white/90">
                  To connect tenants with their perfect space and empower
                  landlords with tools that make property management effortless.
                </Text>
              </View>

              <View className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-8 w-full">
                <Text className="text-center text-sm text-white">
                  You&apos;re currently offline
                </Text>
                <Text className="text-center text-xs mt-1 text-white/80">
                  Connect to the internet to explore Nookly
                </Text>
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-4 w-full">
                <TouchableOpacity
                  onPress={handleRetry}
                  className="bg-primary-300 py-3 rounded-full flex-1"
                >
                  <Text className="text-white font-rubik-bold text-center">
                    Retry
                  </Text>
                </TouchableOpacity>

                {user?.userMode !== "landlord" && (
                  <TouchableOpacity
                    onPress={() => router.replace("/offline-favorites")}
                    className="bg-orange-500 py-3 rounded-full flex-1"
                  >
                    <Text className="text-white font-rubik-bold text-center">
                      See Favorites
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
  }

  // Loading screen
  return (
    <View
      className="flex-1 items-center justify-center"
      style={{ backgroundColor: theme.navBackground }}
    >
      <ActivityIndicator size="large" color="#2196F3" />
      <Text
        className="mt-4 text-lg font-rubik-medium"
        style={{ color: theme.title }}
      >
        {isLoading ? "Please Wait" : "Loading Nookly..."}
      </Text>
    </View>
  );
}
