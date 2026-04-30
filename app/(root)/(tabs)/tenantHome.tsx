import DealsAlerts from "@/components/DealsAlerts";
import FeaturedModal from "@/components/FeaturedModal";
import QuickActions from "@/components/QuickActions";
import QuickTips from "@/components/QuickTips";
import SearchModal from "@/components/SearchModal";
import {
  cleanupOldAppwriteNotifications,
  getAvailableProperties,
  getBestProperties,
} from "@/lib/appwrite";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";

import { Card, FeaturedCard } from "@/components/Cards";
import Filters from "@/components/Filters";
import NoResults from "@/components/NoResults";
import PopularLocations from "@/components/popularLocations";
import icons from "@/constants/icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";

import { useAppwrite } from "@/lib/useAppwrite";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import { getSavedAvatar } from "@/utils/avatarStorage";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const Home = () => {
  const { user } = useAuthStore();
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(true);
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting());
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const params = useLocalSearchParams<{ filter?: string }>();

  // Get notification unread count
  const {
    loadNotifications,
    cleanupOldNotifications,
    fetchAppwriteUnreadCount,
    totalUnreadCount,
  } = useNotificationStore();
  const userId = user?.accountId;

  // Load unread count on mount
  useEffect(() => {
    if (userId) {
      loadNotifications(userId);
      fetchAppwriteUnreadCount(userId);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          BackHandler.exitApp();
          return true;
        },
      );

      return () => subscription.remove();
    }, []),
  );

  // Run cleanup on mount
  useEffect(() => {
    const runCleanup = async () => {
      if (userId) {
        await cleanupOldAppwriteNotifications(userId);
        await cleanupOldNotifications(userId);
      }
    };
    runCleanup();

    // Optional: Run cleanup every hour
    const interval = setInterval(
      () => {
        if (userId) {
          cleanupOldAppwriteNotifications(userId);
          cleanupOldNotifications(userId);
        }
      },
      60 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, [userId]);

  const getHeaderImage = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return require("@/assets/images/morning.jpg");
    if (hour >= 12 && hour < 17)
      return require("@/assets/images/afternoon.jpg");
    if (hour >= 17 && hour < 20) return require("@/assets/images/sunset.jpg");
    return require("@/assets/images/night.jpg");
  };

  // Update greeting every minute
  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadNotifications(userId);
        fetchAppwriteUnreadCount(userId);
      }
    }, [userId]),
  );

  // Load avatar once on mount
  useEffect(() => {
    let isActive = true;

    const loadAvatar = async () => {
      const saved = await getSavedAvatar();
      if (isActive) {
        setAvatarId(saved || "human-1");
        setLoadingAvatar(false);
      }
    };

    loadAvatar();

    return () => {
      isActive = false;
    };
  }, []);

  // Fetch best properties for Featured section
  const fetchBestProperties = async () => {
    try {
      setLoadingFeatured(true);
      const best = await getBestProperties(6); // Get top 6 best properties
      setFeaturedProperties(best);
    } catch (error) {
      console.error("Error fetching best properties:", error);
      setFeaturedProperties([]);
    } finally {
      setLoadingFeatured(false);
    }
  };

  // Load featured properties on mount
  useEffect(() => {
    fetchBestProperties();
  }, []);

  // Get recommended properties with manual refetch
  const {
    data: properties,
    refetch,
    loading,
  } = useAppwrite({
    fn: getAvailableProperties,
    params: { filter: params.filter || "", query: "", limit: 6 },
    ttl: 30000,
    skip: false, // initial fetch on mount
  });

  // 🔁 Manual refetch when filter changes
  useEffect(() => {
    refetch({
      filter: params.filter || "",
      query: "",
      limit: 6,
    });
  }, [params.filter]);

  const handleCardPress = (id: string) => router.push(`/properties/${id}`);

  // In your home screen component (where the bell icon is), add this:

  useFocusEffect(
    useCallback(() => {
      // Refresh unread count when screen comes into focus
      const refreshUnreadCount = async () => {
        if (userId) {
          await fetchAppwriteUnreadCount(userId);
          await loadNotifications(userId);
        }
      };

      refreshUnreadCount();
    }, [userId, fetchAppwriteUnreadCount, loadNotifications]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      if (userId) {
        loadNotifications(userId);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [userId, loadNotifications]);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top Header - Enhanced with better overlay */}
      <View className="relative mb-2">
        <View className="relative">
          <Image
            source={getHeaderImage()}
            className="w-full h-36 "
            style={{ opacity: 0.95 }}
          />
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.8)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: "100%",
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
            }}
          />
        </View>

        {/* Overlay User Info */}
        <View className="absolute inset-0 flex-row items-center justify-between px-6 pt-2">
          <View className="flex-row items-center">
            {!loadingAvatar ? (
              <TouchableOpacity
                onPress={() => router.push("/profile")}
                className="shadow-lg"
              >
                <Image
                  source={user?.avatar ? { uri: user.avatar } : icons.person}
                  className="w-14 h-14 rounded-full border-2 border-white"
                />
              </TouchableOpacity>
            ) : (
              <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center">
                <ActivityIndicator size="small" color="#ffffff" />
              </View>
            )}
            <View className="ml-3">
              <Text className="text-xs font-rubik text-white/90">
                {greeting}
              </Text>
              <Text className="text-lg font-rubik-bold text-white">
                {user?.name || "Guest"}
              </Text>
            </View>
          </View>

          {/* Bell Icon with Notification Badge */}
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            className="bg-white/20 p-2.5 rounded-full relative"
          >
            <Image
              source={icons.bell}
              className="w-5 h-5"
              style={{ tintColor: "#ffffff" }}
            />
            {totalUnreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center">
                <Text className="text-white text-xs font-bold">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={properties}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        contentContainerClassName="pb-32"
        columnWrapperClassName="flex gap-5 px-5"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card item={item} onPress={() => handleCardPress(item.$id)} />
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center py-10">
              <ActivityIndicator size="large" color={theme.title} />
            </View>
          ) : !properties || properties.length === 0 ? (
            <NoResults />
          ) : null
        }
        ListHeaderComponent={() => (
          <View className="px-5">
            {/* Search Button */}
            <TouchableOpacity
              onPress={() => setSearchModalVisible(true)}
              className="flex-row items-center px-4 py-3 rounded-full mb-3"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "40",
              }}
            >
              <Image
                source={icons.search}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="flex-1 ml-2 text-base"
                style={{ color: theme.muted }}
              >
                Search properties...
              </Text>
            </TouchableOpacity>

            {/* Quick Actions */}
            <View className="mb-6">
              <QuickActions />
            </View>

            {/* Featured Section */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-4">
                <View>
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.text }}
                  >
                    Featured
                  </Text>
                  <Text className="text-sm text-gray-500 font-rubik mt-0.5">
                    Top ranked properties for you
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setFeaturedModalVisible(true)}
                  className="bg-primary-50 px-4 py-2 rounded-full"
                >
                  <Text
                    className="text-sm font-rubik-medium text-primary-600"
                    style={{ color: theme.primary[300] }}
                  >
                    See all
                  </Text>
                </TouchableOpacity>
              </View>

              {loadingFeatured ? (
                <View className="h-48 items-center justify-center">
                  <ActivityIndicator size="large" color={theme.primary[300]} />
                </View>
              ) : featuredProperties.length === 0 ? (
                <View
                  className="h-48 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: theme.surface }}
                >
                  <Image
                    source={icons.house}
                    className="w-12 h-12 opacity-30 mb-2"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="text-sm font-rubik"
                    style={{ color: theme.muted }}
                  >
                    No featured properties yet
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={featuredProperties}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingRight: 20 }}
                  keyExtractor={(item) => item.$id}
                  renderItem={({ item }) => (
                    <View className="mr-4 relative">
                      <FeaturedCard
                        item={item}
                        onPress={() => handleCardPress(item.$id)}
                      />
                    </View>
                  )}
                />
              )}
            </View>

            <PopularLocations />
            <DealsAlerts />
            <QuickTips />

            <View className="flex-row items-center justify-between mb-3">
              <View>
                {/* Filters */}
                <View className="mb-4">
                  <Filters />
                </View>

                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  Recommended
                </Text>
                <Text className="text-sm text-gray-500 font-rubik">
                  Places you might like
                </Text>
              </View>
            </View>
          </View>
        )}
      />

      <FeaturedModal
        visible={featuredModalVisible}
        onClose={() => setFeaturedModalVisible(false)}
        properties={featuredProperties}
        onPropertyPress={handleCardPress}
      />

      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
      />
    </SafeAreaView>
  );
};

export default Home;
