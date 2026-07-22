// components/HotDeals.tsx - FIXED NO SCHEMA ERRORS
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

let cachedDeals: HotDeal[] | null = null;
let lastFetchTime = 0;
let isFetching = false;
const CACHE_TTL = 5 * 60 * 1000;

const HotDeals = () => {
  const [deals, setDeals] = useState<HotDeal[]>(cachedDeals || []);
  const [loading, setLoading] = useState(!cachedDeals);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (cachedDeals) {
      setDeals(cachedDeals);
      setLoading(false);
    }
    const now = Date.now();
    if ((!cachedDeals || now - lastFetchTime >= CACHE_TTL) && !isFetching) {
      fetchHotDeals();
    }
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchHotDeals = async () => {
    if (isFetching) return;
    isFetching = true;
    try {
      if (isMounted.current) setLoading(true);

      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      // Only 3 queries, all using fields that EXIST in every schema
      const [newListings, boarding, availableSample] = await Promise.all([
        databases.listDocuments(
          config.databaseId!,
          config.propertiesCollectionId!,
          [
            Query.greaterThan("$createdAt", fifteenDaysAgo.toISOString()),
            Query.limit(1),
            Query.select(["$id"]), // FIX: must select at least $id, not []
          ],
        ),
        databases.listDocuments(
          config.databaseId!,
          config.propertiesCollectionId!,
          [
            Query.equal("type", "Boarding"),
            Query.equal("isAvailable", true),
            Query.limit(1),
            Query.select(["$id"]),
          ],
        ),
        databases.listDocuments(
          config.databaseId!,
          config.propertiesCollectionId!,
          [
            Query.equal("isAvailable", true),
            Query.limit(50),
            // Only select fields we KNOW exist: $id, likes, price, type
            Query.select(["$id", "likes", "price", "type"]),
          ],
        ),
      ]);

      const realDeals: HotDeal[] = [];

      if (newListings.total > 0) {
        realDeals.push({
          title: "New Listings",
          description: `${newListings.total} added recently`,
          icon: icons.plus,
          color: "#10B981",
          count: newListings.total,
          type: "new_listing",
        });
      }

      if (boarding.total > 0) {
        realDeals.push({
          title: "Student Deals",
          description: `${boarding.total} boarding houses`,
          icon: icons.house,
          color: "#8B5CF6",
          count: boarding.total,
          type: "boarding",
        });
      }

      const trendingCount = availableSample.documents.filter(
        (p: any) => (p.likes || 0) > 0,
      ).length;
      if (trendingCount > 0) {
        realDeals.push({
          title: "Trending",
          description: `${trendingCount} most liked`,
          icon: icons.like,
          color: "#F59E0B",
          count: trendingCount,
          type: "trending",
        });
      }

      // Always show available count
      realDeals.push({
        title: "Available Now",
        description: `${availableSample.total} available now`,
        icon: icons.house,
        color: "#3B82F6",
        count: availableSample.total,
        type: "open_properties",
      });

      const finalDeals = realDeals.slice(0, 3);
      if (isMounted.current) {
        setDeals(finalDeals);
        cachedDeals = finalDeals;
        lastFetchTime = Date.now();
      }
    } catch (e) {
      console.log("HotDeals error", e);
    } finally {
      if (isMounted.current) setLoading(false);
      isFetching = false;
    }
  };

  const handlePress = (deal: HotDeal) => {
    if (deal.type === "trending") router.push("/trending-properties" as any);
    else
      router.push({
        pathname: "/filtered-properties" as any,
        params: { type: deal.type },
      });
  };

  if (loading && !cachedDeals) {
    return (
      <View className="py-4 flex-row gap-3">
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            className="flex-1 rounded-xl p-3 items-center"
            style={{ backgroundColor: theme.navBackground }}
          >
            <ActivityIndicator size="small" color={theme.primary[300]} />
          </View>
        ))}
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
      <Text className="text-sm text-gray-500 font-rubik mb-3">
        Don't miss out
      </Text>
      <View className="flex-row justify-between gap-3">
        {deals.map((deal, idx) => (
          <TouchableOpacity
            key={idx}
            onPress={() => handlePress(deal)}
            className="flex-1 rounded-xl p-3 items-center"
            style={{
              backgroundColor: theme.navBackground,
              borderWidth: 1,
              borderColor: "#E5E7EB",
            }}
          >
            <View
              className="w-10 h-10 rounded-full items-center justify-center mb-2"
              style={{ backgroundColor: deal.color + "20" }}
            >
              <Image
                source={deal.icon}
                className="w-5 h-5"
                style={{ tintColor: deal.color }}
              />
            </View>
            <Text
              className="text-sm font-rubik-medium text-center"
              style={{ color: theme.text }}
            >
              {deal.title}
            </Text>
            <Text className="text-xs text-gray-500 text-center mt-1">
              {deal.description}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default HotDeals;
