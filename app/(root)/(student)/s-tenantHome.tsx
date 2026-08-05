import { Card, FeaturedCard } from "@/components/Cards";
import FeaturedModal from "@/components/FeaturedModal";
import NoResults from "@/components/NoResults";
import QuickActions from "@/components/QuickActions";
import RidesHomeBanner from "@/components/rides/RidesHomeBanner";
import StudentFilters from "@/components/StudentFilters";
import StudentQuickTips from "@/components/StudentQuickTips";
import icons from "@/constants/icons";
import { cleanupOldAppwriteNotifications } from "@/lib/appwrite";
import {
  getStudentFeaturedProperties,
  getStudentRecommendedProperties,
  StudentProperty,
  titleCaseStudentText,
} from "@/lib/studentHousing";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

const StudentHome = () => {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ filter?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [featured, setFeatured] = useState<StudentProperty[]>([]);
  const [recommended, setRecommended] = useState<StudentProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredModalVisible, setFeaturedModalVisible] = useState(false);
  const [greeting, setGreeting] = useState(getGreeting());

  const schoolLocation = user?.schoolLocation?.trim() || "";
  const {
    loadNotifications,
    fetchAppwriteUnreadCount,
    totalUnreadCount,
    cleanupOldNotifications,
  } = useNotificationStore();

  const loadHousing = useCallback(
    async (force = false) => {
      if (!schoolLocation) {
        setFeatured([]);
        setRecommended([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [featuredResult, recommendedResult] = await Promise.all([
          getStudentFeaturedProperties(schoolLocation, 6, force),
          getStudentRecommendedProperties(schoolLocation, {
            type: params.filter || "",
            limit: 20,
            force,
          }),
        ]);
        setFeatured(featuredResult);
        setRecommended(recommendedResult);
      } catch (error) {
        console.error("Error loading student home:", error);
        setFeatured([]);
        setRecommended([]);
      } finally {
        setLoading(false);
      }
    },
    [schoolLocation, params.filter],
  );

  useEffect(() => {
    loadHousing();
  }, [loadHousing]);

  useEffect(() => {
    const interval = setInterval(() => setGreeting(getGreeting()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.accountId) return;
    loadNotifications(user.accountId);
    fetchAppwriteUnreadCount(user.accountId);
    cleanupOldAppwriteNotifications(user.accountId);
    cleanupOldNotifications(user.accountId);
  }, [user?.accountId]);

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

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadHousing(true);
    if (user?.accountId) {
      await Promise.all([
        loadNotifications(user.accountId),
        fetchAppwriteUnreadCount(user.accountId),
      ]);
    }
    setRefreshing(false);
  }, [loadHousing, user?.accountId]);

  const handlePropertyPress = useCallback(
    (id: string) => router.push(`/properties/${id}` as any),
    [],
  );

  const headerImage = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return require("@/assets/images/morning.jpg");
    if (hour >= 12 && hour < 17)
      return require("@/assets/images/afternoon.jpg");
    if (hour >= 17 && hour < 20) return require("@/assets/images/sunset.jpg");
    return require("@/assets/images/night.jpg");
  }, [greeting]);

  const Header = useCallback(
    () => (
      <View className="px-5">
        <TouchableOpacity
          onPress={() => router.push("/s-explore")}
          className="flex-row items-center px-4 py-3 rounded-full mb-3"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: `${theme.muted}40`,
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
            Search student housing near your school...
          </Text>
        </TouchableOpacity>

        <View
          className="rounded-2xl p-4 mb-5 flex-row items-center"
          style={{
            backgroundColor: `${theme.primary[300]}12`,
            borderWidth: 1,
            borderColor: `${theme.primary[300]}30`,
          }}
        >
          <View
            className="w-11 h-11 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: `${theme.primary[300]}20` }}
          >
            <Image
              source={icons.location}
              className="w-5 h-5"
              style={{ tintColor: theme.primary[300] }}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs" style={{ color: theme.muted }}>
              Showing student housing within
            </Text>
            <Text
              className="text-base font-rubik-bold"
              style={{ color: theme.title }}
            >
              {schoolLocation
                ? titleCaseStudentText(schoolLocation)
                : "School location not set"}
            </Text>
          </View>
        </View>

        <RidesHomeBanner schoolLocation={schoolLocation} />

        <View className="mb-5">
          <QuickActions />
        </View>

        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-1 pr-3">
              <Text
                className="text-2xl font-rubik-bold"
                style={{ color: theme.text }}
              >
                Featured
              </Text>
              <Text
                className="text-sm font-rubik"
                style={{ color: theme.muted }}
              >
                Best-performing student properties near your school
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setFeaturedModalVisible(true)}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: theme.primary[100] }}
            >
              <Text
                className="text-sm font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                See all
              </Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="h-48 items-center justify-center">
              <ActivityIndicator size="large" color={theme.primary[300]} />
            </View>
          ) : featured.length === 0 ? (
            <View
              className="h-40 items-center justify-center rounded-2xl px-6"
              style={{ backgroundColor: theme.surface }}
            >
              <Image
                source={icons.home}
                className="w-9 h-9 mb-3"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="font-rubik-medium text-center"
                style={{ color: theme.text }}
              >
                No supported properties found near your school
              </Text>
              <Text
                className="text-xs text-center mt-1"
                style={{ color: theme.muted }}
              >
                Student mode shows Boarding Houses, Houses, Studios and Luxury
                properties only.
              </Text>
            </View>
          ) : (
            <FlatList
              data={featured}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.$id}
              renderItem={({ item }) => (
                <View className="mr-4">
                  <FeaturedCard
                    item={item}
                    onPress={() => handlePropertyPress(item.$id)}
                  />
                </View>
              )}
            />
          )}
        </View>

        <StudentQuickTips />

        <View className="mb-2 mt-1">
          <StudentFilters />
        </View>

        <View className="mb-3">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.text }}
          >
            Recommended
          </Text>
          <Text className="text-sm font-rubik" style={{ color: theme.muted }}>
            Ranked student housing within your school location
          </Text>
        </View>
      </View>
    ),
    [theme, schoolLocation, featured, loading, handlePropertyPress],
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
          colors={["transparent", "rgba(0,0,0,0.82)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View className="absolute inset-0 flex-row items-center justify-between px-6 pt-2">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.push("/s-profile")}>
              <Image
                source={user?.avatar ? { uri: user.avatar } : icons.person}
                className="w-14 h-14 rounded-full border-2 border-white"
              />
            </TouchableOpacity>
            <View className="ml-3">
              <Text className="text-xs font-rubik text-white/90">
                {greeting}
              </Text>
              <Text className="text-lg font-rubik-bold text-white">
                {user?.name || "Student"}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={() => router.push("/s-sos" as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Open emergency SOS"
              className="h-10 px-3 rounded-full items-center justify-center mr-2"
              style={{ backgroundColor: "#DC2626" }}
            >
              <Text className="text-white text-xs font-rubik-bold">
                SOS
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/s-notifications")}
              className="bg-white/20 p-2.5 rounded-full"
            >
              <Image
                source={icons.bell}
                className="w-5 h-5"
                style={{ tintColor: "#fff" }}
              />
              {totalUnreadCount > 0 && (
                <View className="absolute -top-1 -right-1 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center">
                  <Text className="text-white text-[10px] font-rubik-bold">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <FlatList
        data={recommended}
        numColumns={2}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ paddingBottom: 130 }}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.primary[300]}
          />
        }
        renderItem={({ item }) => (
          <Card item={item} onPress={() => handlePropertyPress(item.$id)} />
        )}
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator size="large" color={theme.primary[300]} />
            </View>
          ) : (
            <NoResults />
          )
        }
        ListHeaderComponent={Header}
      />

      <FeaturedModal
        visible={featuredModalVisible}
        onClose={() => setFeaturedModalVisible(false)}
        properties={featured}
        onPropertyPress={handlePropertyPress}
      />
    </SafeAreaView>
  );
};

export default StudentHome;
