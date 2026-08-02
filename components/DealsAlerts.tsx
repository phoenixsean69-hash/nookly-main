import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Query } from "react-native-appwrite";

interface HotDeal {
  title: string;
  description: string;
  icon: any;
  color: string;
  count: number;
  type: string;
}

interface HotDealProperty {
  $id: string;
  $createdAt?: string;
  type?: string;
  isAvailable?: boolean;
  likes?: number;
  price?: number;
}

const HOT_DEALS_CACHE_KEY = "property_hot_deals_summary_v2";
const HOT_DEALS_PROPERTY_LIMIT = 100;

const loadHotDealProperties = async (): Promise<HotDealProperty[]> => {
  const response = await databases.listDocuments(
    config.databaseId!,
    config.propertiesCollectionId!,
    [
      Query.limit(HOT_DEALS_PROPERTY_LIMIT),
      Query.orderDesc("$createdAt"),
      Query.select([
        "$id",
        "$createdAt",
        "type",
        "isAvailable",
        "likes",
        "price",
      ]),
    ],
  );

  return response.documents as unknown as HotDealProperty[];
};

const DealsAlerts = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const {
    data: properties,
    loading,
    error,
    refetch,
  } = useAppwrite({
    fn: loadHotDealProperties,
    params: {},
    cacheKey: HOT_DEALS_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const deals = useMemo<HotDeal[]>(() => {
    const documents = properties ?? [];
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;

    const newListingsCount = documents.filter((property) => {
      if (!property.$createdAt) return false;

      const createdAt = new Date(property.$createdAt).getTime();
      return Number.isFinite(createdAt) && createdAt >= fifteenDaysAgo;
    }).length;

    const boardingCount = documents.filter(
      (property) =>
        property.isAvailable === true &&
        property.type?.trim().toLowerCase() === "boarding",
    ).length;

    const trendingCount = documents.filter(
      (property) =>
        property.isAvailable === true &&
        Number(property.likes ?? 0) > 0,
    ).length;

    const availableCount = documents.filter(
      (property) => property.isAvailable === true,
    ).length;

    const nextDeals: HotDeal[] = [];

    if (newListingsCount > 0) {
      nextDeals.push({
        title: "New Listings",
        description: `${newListingsCount} added recently`,
        icon: icons.plus,
        color: "#10B981",
        count: newListingsCount,
        type: "new_listing",
      });
    }

    if (boardingCount > 0) {
      nextDeals.push({
        title: "Student Deals",
        description: `${boardingCount} boarding houses`,
        icon: icons.house,
        color: "#8B5CF6",
        count: boardingCount,
        type: "boarding",
      });
    }

    if (trendingCount > 0) {
      nextDeals.push({
        title: "Trending",
        description: `${trendingCount} most liked`,
        icon: icons.like,
        color: "#F59E0B",
        count: trendingCount,
        type: "trending",
      });
    }

    nextDeals.push({
      title: "Available Now",
      description: `${availableCount} available now`,
      icon: icons.house,
      color: "#3B82F6",
      count: availableCount,
      type: "open_properties",
    });

    return nextDeals.slice(0, 3);
  }, [properties]);

  const handlePress = (deal: HotDeal) => {
    if (deal.type === "trending") {
      router.push("/trending-properties" as any);
      return;
    }

    router.push({
      pathname: "/filtered-properties" as any,
      params: { type: deal.type },
    });
  };

  if (loading && !properties) {
    return (
      <View className="py-4 flex-row gap-3">
        {[1, 2, 3].map((item) => (
          <View
            key={item}
            className="flex-1 rounded-xl p-3 items-center"
            style={{ backgroundColor: theme.navBackground }}
          >
            <ActivityIndicator
              size="small"
              color={theme.primary[300]}
            />
          </View>
        ))}
      </View>
    );
  }

  if (error && !properties) {
    return (
      <View className="py-4">
        <TouchableOpacity
          onPress={() => void refetch()}
          activeOpacity={0.75}
          className="rounded-xl px-4 py-4 items-center"
          style={{
            backgroundColor: theme.navBackground,
            borderWidth: 1,
            borderColor: `${theme.muted}30`,
          }}
        >
          <Text
            className="text-sm font-rubik-medium"
            style={{ color: theme.text }}
          >
            Hot Deals could not load
          </Text>
          <Text
            className="text-xs mt-1"
            style={{ color: theme.primary[300] }}
          >
            Tap to retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="py-4">
      <Text
        className="text-2xl font-rubik-bold mb-1"
        style={{ color: theme.text }}
      >
        Hot Deals
      </Text>

      <Text
        className="text-sm font-rubik mb-3"
        style={{ color: theme.muted }}
      >
        Don&apos;t miss out
      </Text>

      <View className="flex-row justify-between gap-3">
        {deals.map((deal) => (
          <TouchableOpacity
            key={deal.type}
            onPress={() => handlePress(deal)}
            activeOpacity={0.78}
            className="flex-1 rounded-xl p-3 items-center"
            style={{
              backgroundColor: theme.navBackground,
              borderWidth: 1,
              borderColor: `${theme.muted}25`,
            }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: `${deal.color}20` }}
            >
              <Image
                source={deal.icon}
                className="w-5 h-5"
                style={{ tintColor: deal.color }}
                resizeMode="contain"
              />
            </View>

            <Text
              className="text-sm font-rubik-medium text-center"
              style={{ color: theme.text }}
              numberOfLines={1}
            >
              {deal.title}
            </Text>

            <Text
              className="text-xs text-center mt-1"
              style={{ color: theme.muted }}
              numberOfLines={2}
            >
              {deal.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default React.memo(DealsAlerts);
