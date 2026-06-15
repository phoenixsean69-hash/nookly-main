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

  // =============================================
  // STEP 1: Load user from AsyncStorage FIRST and wait for it
  // =============================================
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        console.log("📦 Loading user from AsyncStorage...");
        const storedUser = await loadUserFromStorage();

        if (storedUser) {
          console.log("✅ Stored user found:", storedUser.name);
          console.log("👤 User details:", {
            name: storedUser.name,
            email: storedUser.email,
            userMode: storedUser.userMode,
            accountId: storedUser.accountId,
          });
          setLocalUser(storedUser);
        } else {
          console.log("❌ No stored user found");
          setLocalUser(null);
        }
      } catch (error) {
        console.error("❌ Failed to load stored user:", error);
        setLocalUser(null);
      } finally {
        setIsStorageLoaded(true);
      }
    };

    loadStoredUser();
  }, [loadUserFromStorage]);

  // =============================================
  // STEP 2: Hydrate auth state
  // =============================================
  useEffect(() => {
    console.log("💧 Hydrating auth state...");
    hydrate();
  }, [hydrate]);

  // =============================================
  // STEP 3: Fetch fresh user from server (if online)
  // =============================================
  useEffect(() => {
    const fetchUserIfOnline = async () => {
      if (isConnected) {
        console.log("🌐 Online - Fetching fresh user data...");
        await fetchAuthenticatedUser();
      } else {
        console.log("📱 Offline - Using stored user data");
      }
    };

    if (isConnected !== null && isStorageLoaded) {
      fetchUserIfOnline();
    }
  }, [isConnected, fetchAuthenticatedUser, isStorageLoaded]);

  // =============================================
  // STEP 4: Monitor network connectivity
  // =============================================
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected;
      console.log(
        `🔌 Network state changed: ${connected ? "Online" : "Offline"}`,
      );

      // Only re-fetch when transitioning from offline → online
      if (connected && isConnected === false && isStorageLoaded) {
        console.log("🔄 Reconnecting - Fetching auth state...");
        fetchAuthenticatedUser();
      }

      setIsConnected(connected);
    });

    return () => unsubscribe();
  }, [fetchAuthenticatedUser, isStorageLoaded, isConnected]);

  // =============================================
  // STEP 5: Navigation logic
  // =============================================
  useEffect(() => {
    // Wait until storage is loaded
    if (!isStorageLoaded) {
      console.log("⏳ Waiting for storage to load...");
      return;
    }

    // Wait for network state
    if (isConnected === null) {
      console.log("⏳ Waiting for network state...");
      return;
    }

    // Wait for auth initialization
    if (!isInitialized || !isHydrated) {
      console.log("⏳ Waiting for auth initialization...");
      return;
    }

    console.log("🚦 Navigation check:", {
      isConnected,
      isAuthenticated,
      isLoading,
      userMode: user?.userMode || localUser?.userMode,
      hasUser: !!user || !!localUser,
    });

    if (isConnected) {
      // ONLINE - Use fresh auth state
      setOfflineMessageShown(false);

      if (isAuthenticated && user?.userMode) {
        console.log("✅ Online - Authenticated user, navigating...");
        if (user.userMode === "tenant") {
          router.replace("/tenantHome");
        } else if (user.userMode === "landlord") {
          router.replace("/landHome");
        }
      } else if (localUser?.userMode) {
        // Fallback to stored user if auth check fails
        console.log("📦 Using stored user data for navigation");
        if (localUser.userMode === "tenant") {
          router.replace("/tenantHome");
        } else if (localUser.userMode === "landlord") {
          router.replace("/landHome");
        }
      } else if (!isLoading) {
        console.log("👋 No user found, redirecting to sign up");
        router.replace("/sign-up");
      }
    } else {
      // OFFLINE - Only show offline screen after storage is confirmed loaded
      // This guarantees localUser is settled before we decide which screen to show
      console.log("📱 Offline - Showing offline screen");
      console.log("👤 Offline user available:", !!(user || localUser));
      setOfflineMessageShown(true);
    }
  }, [
    isLoading,
    isConnected,
    isAuthenticated,
    user,
    localUser,
    isInitialized,
    isHydrated,
    isStorageLoaded,
  ]);

  // =============================================
  // STEP 6: Auto-swipe background images on offline screen
  // =============================================
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

  // =============================================
  // HANDLERS
  // =============================================
  const handleRetry = async () => {
    console.log("🔄 Retrying connection...");
    const state = await NetInfo.fetch();
    if (state.isConnected) {
      setOfflineMessageShown(false);
      await fetchAuthenticatedUser();
    }
  };

  const handleSeeFavorites = () => {
    router.replace("/offline-favorites");
  };

  // =============================================
  // GET ACTIVE USER (for display purposes)
  // Use store user first, fall back to localUser from AsyncStorage
  // =============================================
  const activeUser = user || localUser;

  // Show loading while storage is being loaded
  if (!isStorageLoaded) {
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
          Loading your data...
        </Text>
      </View>
    );
  }

  // =============================================
  // OFFLINE SCREEN - AUTHENTICATED USER
  // Check activeUser which includes localUser loaded from AsyncStorage
  // =============================================
  if (offlineMessageShown && activeUser) {
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
          <View className="flex-1 px-6 py-12 min-h-screen">
            {/* Header with Avatar and Email */}
            <View className="flex-row items-center justify-end mb-8">
              <View className="flex-row items-center">
                <View className="mr-3">
                  <Text className="text-white/90 text-right text-sm">
                    {activeUser.email}
                  </Text>
                  <Text className="text-white/60 text-right text-xs capitalize mt-1">
                    {activeUser.userMode}
                  </Text>
                </View>
                <View className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-lg items-center justify-center overflow-hidden">
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
            </View>

            {/* Welcome Message */}
            <View className="items-center mb-8">
              <Text className="text-3xl font-rubik-bold text-center mb-2 text-white">
                Hi {activeUser.name}!
              </Text>
              <Text className="text-base text-center text-white/90">
                You&apos;re currently offline
              </Text>
            </View>

            {/* Info Card */}
            <View className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-auto w-full">
              <Text className="text-center text-sm text-white">
                You can still browse cached content and favorites.
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 w-full mt-8">
              <TouchableOpacity
                onPress={handleRetry}
                className="bg-primary-300 py-4 rounded-full flex-1"
              >
                <Text className="text-white font-rubik-bold text-center text-base">
                  Retry Connection
                </Text>
              </TouchableOpacity>

              {activeUser.userMode === "tenant" && (
                <TouchableOpacity
                  onPress={handleSeeFavorites}
                  className="bg-orange-500 py-4 rounded-full flex-1"
                >
                  <Text className="text-white font-rubik-bold text-center text-base">
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

  // =============================================
  // OFFLINE SCREEN - UNAUTHENTICATED USER
  // Only shown when storage is loaded AND no user found anywhere
  // =============================================
  if (offlineMessageShown && !activeUser) {
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

            <View className="w-full">
              <TouchableOpacity
                onPress={handleRetry}
                className="bg-primary-300 py-3 rounded-full"
              >
                <Text className="text-white font-rubik-bold text-center">
                  Retry Connection
                </Text>
              </TouchableOpacity>
            </View>

            <Text className="text-center text-xs mt-8 text-white/60">
              Nookly v1.0.0 • Find Your Cozy Corner
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  // =============================================
  // LOADING SCREEN
  // =============================================
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
        {isLoading ? "Loading your data..." : "Starting Nookly..."}
      </Text>

      {/* Debug Info (remove in production) */}
      {__DEV__ && (
        <View className="mt-4 px-4">
          <Text className="text-xs text-gray-500 text-center">
            {isHydrated ? "✅ Storage loaded" : "⏳ Loading storage..."}
          </Text>
          <Text className="text-xs text-gray-500 text-center mt-1">
            {isInitialized ? "✅ Auth initialized" : "⏳ Initializing auth..."}
          </Text>
        </View>
      )}
    </View>
  );
}
