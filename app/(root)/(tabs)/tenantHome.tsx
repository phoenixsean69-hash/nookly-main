import DealsAlerts from "@/components/DealsAlerts";
import FeaturedModal from "@/components/FeaturedModal";
import QuickActions from "@/components/QuickActions";
import QuickTips from "@/components/QuickTips";
import SearchModal from "@/components/SearchModal";
import {
  cleanupOldAppwriteNotifications,
  config,
  getAvailableProperties,
  getBestProperties,
} from "@/lib/appwrite";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Card, FeaturedCard } from "@/components/Cards";
import Filters from "@/components/Filters";
import NoResults from "@/components/NoResults";
import PopularLocations from "@/components/popularLocations";
import { getAvatarSource } from "@/constants/data";
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

const STALE_TIME = 5 * 60 * 1000;
const FEATURED_PROPERTIES_CACHE_KEY = "featured_properties_ranked_6";

const loadFeaturedProperties = async () => getBestProperties(6);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

// HEADER IS NOW OUTSIDE HOME - IT NEVER RE-CREATES
const HomeHeader = React.memo(
  ({
    theme,
    featuredProperties,
    loadingFeatured,
    onSeeAllFeatured,
    onSearchPress,
    onCardPress,
  }: any) => {
    return (
      <View className="px-5">
        <TouchableOpacity
          onPress={onSearchPress}
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

        <View className="mb-6">
          <QuickActions />
        </View>

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
              onPress={onSeeAllFeatured}
              className="bg-primary-50 px-4 py-2 rounded-full"
            >
              <Text
                className="text-sm font-rubik-medium"
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
              <Text style={{ color: theme.muted }}>
                No featured properties yet
              </Text>
            </View>
          ) : (
            <FlatList
              data={featuredProperties}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              renderItem={({ item }) => (
                <View className="mr-4">
                  <FeaturedCard
                    item={item}
                    onPress={() => onCardPress(item.$id)}
                  />
                </View>
              )}
            />
          )}
        </View>

        {/* THESE 2 WILL NOW ONLY MOUNT ONCE */}
        <PopularLocations />
        <DealsAlerts />
        <QuickTips />

        <View className="mb-4 mt-2">
          <Filters />
        </View>
        <View className="mb-3">
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
    );
  },
);

const Home = () => {
  const { user } = useAuthStore();
  const [avatarId, setAvatarId] = useState<string | null>("human-1");
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting());
  const [searchModalVisible, setSearchModalVisible] = useState(false);

  const params = useLocalSearchParams<{ filter?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const {
    loadNotifications,
    fetchAppwriteUnreadCount,
    totalUnreadCount,
    cleanupOldNotifications,
  } = useNotificationStore();
  const userId = user?.accountId;

  const lastNotificationsFetch = useRef(0);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        BackHandler.exitApp();
        return true;
      });
      return () => sub.remove();
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (userId && now - lastNotificationsFetch.current > STALE_TIME) {
        loadNotifications(userId);
        fetchAppwriteUnreadCount(userId);
        lastNotificationsFetch.current = now;
      }
    }, [userId]),
  );

  useEffect(() => {
    if (userId) {
      cleanupOldAppwriteNotifications(userId);
      cleanupOldNotifications(userId);
    }
  }, [userId]);

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

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

  const {
    data: featuredPropertyData,
    loading: featuredPropertiesLoading,
  } = useAppwrite({
    fn: loadFeaturedProperties,
    params: {},
    cacheKey: FEATURED_PROPERTIES_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const featuredProperties = featuredPropertyData ?? [];
  const loadingFeatured =
    featuredPropertiesLoading && featuredPropertyData === null;

  const { data: properties, loading } = useAppwrite({
    fn: getAvailableProperties,
    params: { filter: params.filter || "", query: "", limit: 6 },
    cacheKey: `available_${params.filter || "all"}`,
  });

  const handleCardPress = useCallback(
    (id: string) => router.push(`/properties/${id}` as any),
    [],
  );
  const handleSearchPress = useCallback(() => setSearchModalVisible(true), []);
  const handleSeeAllFeatured = useCallback(
    () => setFeaturedModalVisible(true),
    [],
  );

  const getHeaderImage = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return require("@/assets/images/morning.jpg");
    if (hour >= 12 && hour < 17)
      return require("@/assets/images/afternoon.jpg");
    if (hour >= 17 && hour < 20) return require("@/assets/images/sunset.jpg");
    return require("@/assets/images/night.jpg");
  }, []);

  const headerImage = useMemo(() => getHeaderImage(), [getHeaderImage]);

  // THIS IS THE FIX - stable reference
  const ListHeaderComponent = useCallback(
    () => (
      <HomeHeader
        theme={theme}
        featuredProperties={featuredProperties}
        loadingFeatured={loadingFeatured}
        onSeeAllFeatured={handleSeeAllFeatured}
        onSearchPress={handleSearchPress}
        onCardPress={handleCardPress}
      />
    ),
    [
      theme,
      featuredProperties,
      loadingFeatured,
      handleSeeAllFeatured,
      handleSearchPress,
      handleCardPress,
    ],
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="relative mb-2">
        <Image
          source={headerImage}
          className="w-full h-36"
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
          }}
        />
        <View className="absolute inset-0 flex-row items-center justify-between px-6 pt-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <Image
                source={
                  user?.avatar
                    ? { uri: user.avatar }
                    : getAvatarSource(avatarId)
                }
                className="w-14 h-14 rounded-full border-2 border-white"
              />
            </TouchableOpacity>
            <View className="ml-3">
              <Text className="text-xs font-rubik text-white/90">
                {greeting}
              </Text>
              <Text className="text-lg font-rubik-bold text-white">
                {user?.name || "Guest"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            className="bg-white/20 p-2.5 rounded-full"
          >
            <Image
              source={icons.bell}
              className="w-5 h-5"
              style={{ tintColor: "#fff" }}
            />
            {totalUnreadCount > 0 && (
              <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w- h- px-1 items-center justify-center">
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
          ) : (
            <NoResults />
          )
        }
        ListHeaderComponent={ListHeaderComponent} // <-- stable now
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


