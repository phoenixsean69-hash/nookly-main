// app/(root)/landHome.tsx
import FeaturedModal from "@/components/FeaturedModal";
import NooklyAssistantLauncher from "@/components/assistant/NooklyAssistantLauncher";
import SearchModal from "@/components/SearchModal";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card, FeaturedCard } from "@/components/Cards";
import { Colors } from "@/constants/Colors";
import { getAvatarSource } from "@/constants/data";
import icons from "@/constants/icons";
import {
  client,
  config,
  getAvailableProperties,
  getBestProperties,
  getLatestProperties,
} from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import { getSavedAvatar } from "@/utils/avatarStorage";

const FEATURED_PROPERTIES_CACHE_KEY = "featured_properties_ranked_6";

const loadFeaturedProperties = async () => getBestProperties(6);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const getHeaderImage = () => {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return require("@/assets/images/morning.jpg");
  if (hour >= 12 && hour < 17) return require("@/assets/images/afternoon.jpg");
  if (hour >= 17 && hour < 20) return require("@/assets/images/sunset.jpg");
  return require("@/assets/images/night.jpg");
};

export default function LandLordHome() {
  const { user } = useAuthStore();
  const [avatarId, setAvatarId] = useState<string | null>("human-1");
  const [greeting, setGreeting] = useState(getGreeting());
  const [refreshing, setRefreshing] = useState(false);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);

  const params = useLocalSearchParams<{ filter?: string; refresh?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const displayName = user?.name?.trim() || "Landlord";

  const { loadNotifications, fetchAppwriteUnreadCount, totalUnreadCount } =
    useNotificationStore();
  const userId = user?.accountId;

  const backPressCountRef = useRef(0);

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

  // Refresh the badge whenever the landlord homepage gains focus.
  // This is a lightweight unread-count query and must not be throttled for
  // several minutes because push notifications can arrive at any time.
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        console.log(
          "🔄 Refreshing landlord notification badge...",
        );

        void Promise.all([
          loadNotifications(userId),
          fetchAppwriteUnreadCount(userId),
        ]);
      }

      // The property collection Realtime event updates cached property queries.
      // Only clear the navigation flag so it cannot retrigger on focus.
      if (params.refresh === "true") {
        setTimeout(() => {
          router.setParams({});
        }, 100);
      }
    }, [
      fetchAppwriteUnreadCount,
      loadNotifications,
      params.refresh,
      userId,
    ]),
  );

  // Update the badge immediately when the notifications collection changes.
  useEffect(() => {
    if (
      !userId ||
      !config.databaseId ||
      !config.notificationsCollectionId
    ) {
      return;
    }

    const channel =
      `databases.${config.databaseId}.collections.${config.notificationsCollectionId}.documents`;

    const unsubscribe = client.subscribe(
      channel,
      () => {
        void fetchAppwriteUnreadCount(userId);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [fetchAppwriteUnreadCount, userId]);

  // Android can receive a push while the app is in the background and its
  // Realtime socket is paused. Refresh as soon as Nookly becomes active again.
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void fetchAppwriteUnreadCount(userId);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [fetchAppwriteUnreadCount, userId]);

  // Update greeting every minute
  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Render the current/default avatar immediately, then refresh quietly.
  useEffect(() => {
    let active = true;

    void getSavedAvatar().then((saved) => {
      if (active && saved) {
        setAvatarId(saved);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Get latest properties
  const {
    data: latestProperties,
    loading: latestPropertiesLoading,
    refetch: refetchLatest,
  } = useAppwrite({
    fn: async () => {
      const allLatest = await getLatestProperties();
      return allLatest.filter((p) => p.isAvailable === true);
    },
  });

  const {
    data: featuredPropertyData,
    loading: featuredPropertiesLoading,
    refetch: refetchFeaturedProperties,
  } = useAppwrite({
    fn: loadFeaturedProperties,
    params: {},
    cacheKey: FEATURED_PROPERTIES_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const featuredProperties = (featuredPropertyData ?? []).slice(0, 5);
  const loadingFeatured =
    featuredPropertiesLoading && featuredPropertyData === null;

  // Get landlord's own properties
  const {
    data: myProperties,
    refetch: refetchMyProperties,
    loading: loadingMyProperties,
  } = useAppwrite({
    fn: getAvailableProperties,
    params: {
      filter: params.filter || "",
      query: "",
      limit: 20,
      creatorId: user?.accountId,
    },
    skip: !user?.accountId,
    cacheKey: `landlord_properties_${user?.accountId || "anonymous"}_${params.filter || "all"}`,
    watchCollections: [config.propertiesCollectionId],
  });

  // Pull to refresh - forces all data
  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.accountId) {
      try {
        await Promise.all([
          refetchLatest(),
          refetchMyProperties({
            filter: params.filter || "",
            query: "",
            limit: 20,
            creatorId: user?.accountId,
          }),
          refetchFeaturedProperties(),
          loadNotifications(user.accountId),
          fetchAppwriteUnreadCount(user.accountId),
        ]);
        console.log("✅ Manual refresh completed");
      } catch (error) {
        console.error("❌ Error during manual refresh:", error);
      }
    }
    setRefreshing(false);
  };

  const handleCardPress = (id: string) => router.push(`/properties/${id}`);
  const handleAddProperty = () => router.push("/addProperty");
  const handleViewStats = () => router.push("/myDashboard");

  const showFeatured = latestProperties && latestProperties.length > 0;

  // Calculate totals
  const totalProperties = myProperties?.length || 0;
  const totalLikes =
    myProperties?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0;
  const totalViews =
    myProperties?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;

  const isLoading = loadingMyProperties && !myProperties;


  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header with background image */}
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

        {/* User info overlay */}
        <View className="absolute inset-0 flex-row items-center justify-between px-6 pt-2">
          <View className="flex-row items-center flex-1 mr-2">
            <TouchableOpacity
              onPress={() => router.push("/landProfile")}
              className="shadow-lg"
            >
              <Image
                source={
                  user?.avatar
                    ? { uri: user.avatar }
                    : getAvatarSource(avatarId)
                }
                className="w-14 h-14 rounded-full border-2 border-white"
              />
            </TouchableOpacity>
            <View className="ml-3 flex-1">
              <Text
                className="text-xs font-rubik text-white/90"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {greeting}
              </Text>
              <Text
                className="text-lg font-rubik-bold text-white"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {displayName.length > 20
                  ? `${displayName.substring(0, 18)}...`
                  : displayName}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/landLordNotifications")}
            className="bg-white/20 p-2.5 rounded-full relative flex-shrink-0"
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
        data={myProperties}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ paddingBottom: 100 }}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary[300]]}
            tintColor={theme.primary[300]}
          />
        }
        ListHeaderComponent={() => (
          <View className="px-5">
            {/* Search button */}
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

            <View className="mb-5">
              <NooklyAssistantLauncher variant="card" />
            </View>

            {/* Quick stats */}
            <View className="flex-row justify-between gap-3 mb-6 mt-2">
              <TouchableOpacity
                onPress={handleViewStats}
                className="flex-1 rounded-xl p-4 items-center"
                style={{ backgroundColor: theme.surface }}
              >
                <Image
                  source={icons.dashboard}
                  className="w-6 h-6 mb-2"
                  style={{ tintColor: theme.primary[300] }}
                />
                <Text
                  className="text-lg font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {totalProperties}
                </Text>
                <Text className="text-xs" style={{ color: theme.muted }}>
                  Total Listings
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleViewStats}
                className="flex-1 rounded-xl p-4 items-center"
                style={{ backgroundColor: theme.surface }}
              >
                <Image
                  source={icons.eye}
                  className="w-6 h-6 mb-2"
                  style={{ tintColor: theme.primary[300] }}
                />
                <Text
                  className="text-lg font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {totalViews}
                </Text>
                <Text className="text-xs" style={{ color: theme.muted }}>
                  Total Views
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleViewStats}
                className="flex-1 rounded-xl p-4 items-center"
                style={{ backgroundColor: theme.surface }}
              >
                <Image
                  source={icons.like}
                  className="w-6 h-6 mb-2"
                  style={{ tintColor: "#FF69B4" }}
                />
                <Text
                  className="text-lg font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {totalLikes}
                </Text>
                <Text className="text-xs" style={{ color: theme.muted }}>
                  Total Likes
                </Text>
              </TouchableOpacity>
            </View>

            {/* Add property button */}
            <TouchableOpacity
              onPress={handleAddProperty}
              className="bg-primary-300 py-4 rounded-2xl mb-6 flex-row items-center justify-center"
            >
              <Image
                source={icons.plus}
                className="w-5 h-5 mr-2"
                style={{ tintColor: "#FFFFFF" }}
              />
              <Text className="text-white font-rubik-bold text-lg">
                Add New Property
              </Text>
            </TouchableOpacity>

            {/* Featured Section - Using Best Properties Ranking */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-4 px-1">
                <View>
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.text }}
                  >
                    Featured
                  </Text>
                  <Text className="text-sm text-gray-500 font-rubik mt-0.5">
                    Top ranked properties for tenants
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

              {loadingFeatured && featuredProperties.length === 0 ? (
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
                  contentContainerStyle={{ paddingHorizontal: 4 }}
                  keyExtractor={(item) => item.$id}
                  renderItem={({ item, index }) => (
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

            {/* My properties header */}
            <View className="flex-row items-center justify-between mb-3">
              <View>
                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  My Properties
                </Text>
                <Text className="text-sm text-gray-500 font-rubik">
                  Properties you've listed
                </Text>
              </View>
              {(myProperties?.length ?? 0) > 0 && (
                <TouchableOpacity onPress={() => router.push("/myDashboard")}>
                  <Text className="text-sm font-rubik-medium text-primary-300">
                    View All
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View className="items-center justify-center py-10">
              <ActivityIndicator size="large" color={theme.title} />
            </View>
          ) : myProperties?.length === 0 ? (
            <View className="items-center justify-center py-16 px-5">
              <Image
                source={icons.house}
                className="w-20 h-20 opacity-30 mb-4"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="text-lg font-rubik-medium text-center"
                style={{ color: theme.text }}
              >
                No properties yet
              </Text>
              <Text
                className="text-sm text-center mt-2"
                style={{ color: theme.muted }}
              >
                Tap "Add New Property" to list your first property
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Card item={item} onPress={() => handleCardPress(item.$id)} />
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
}


