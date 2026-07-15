// components/PopularLocations.tsx - FAST VERSION
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { useAppwrite } from "@/lib/useAppwrite";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import locationService from "../services/location.service";

interface PopularLocationsProps {
  limit?: number;
}

const PopularLocations = ({ limit = 4 }: PopularLocationsProps) => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme?? "light"];

  const { data: locations, loading, error, refetch } = useAppwrite({
    fn: (p: { limit: number }) => locationService.getPopularLocations(p.limit),
    params: { limit },
    cacheKey: `popular_locations_${limit}`,
    ttl: 5 * 60 * 1000,
  });

  const handleLocationPress = (city: string) => {
    router.push({
      pathname: "/properties-by-location" as any,
      params: { city },
    });
  };

  const safeLocations = useMemo(() => locations || [], [locations]);

  if (loading && safeLocations.length === 0) {
    return (
      <View className="py-6 items-center justify-center">
        <ActivityIndicator size="small" color={theme.primary[300]} />
      </View>
    );
  }

  if (error && safeLocations.length === 0) {
    return (
      <View className="py-6 items-center">
        <TouchableOpacity onPress={() => refetch({ limit })} className="bg-surface px-4 py-2 rounded-full">
          <Text style={{ color: theme.primary[300] }}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (safeLocations.length === 0) return null;

  return (
    <View className="py-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-rubik-bold" style={{ color: theme.text }}>
          Popular Locations
        </Text>
        <TouchableOpacity onPress={() => router.push("/all-locations" as any)}>
          <Text className="font-rubik-medium" style={{ color: theme.primary[300] }}>
            View All
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row flex-wrap justify-between">
        {safeLocations.map((location) => (
          <TouchableOpacity
            key={location.id}
            onPress={() => handleLocationPress(location.name)}
            className="w-[48%] mb-3 rounded-xl overflow-hidden p-4"
            style={{
              backgroundColor: location.color + "10",
              borderWidth: 1,
              borderColor: location.color + "30",
            }}
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mb-2" style={{ backgroundColor: location.color + "20" }}>
              <Image source={icons.location} className="w-5 h-5" style={{ tintColor: location.color }} />
            </View>
            <Text className="text-base font-rubik-bold" style={{ color: theme.text }}>
              {location.name}
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              {location.propertyCount} {location.propertyCount === 1? "property" : "properties"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

export default React.memo(PopularLocations);