import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config } from "@/lib/appwrite";
import { normalizeDiscoveryKeyPart } from "@/lib/discoveryQueries";
import { useAppwrite } from "@/lib/useAppwrite";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import locationService from "../../../services/location.service";

const PropertiesByLocation = () => {
  const params = useLocalSearchParams<{ city?: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const city = String(params.city || "").trim();

  const {
    data: propertyData,
    loading,
    error,
    refetch,
  } = useAppwrite<any[], { city: string }>({
    fn: ({ city: requestedCity }) =>
      locationService.getPropertiesByCity(
        requestedCity,
      ),
    params: { city },
    skip: !city,
    cacheKey: `discovery_city_${normalizeDiscoveryKeyPart(city)}`,
    watchCollections: [config.propertiesCollectionId],
  });

  const properties = propertyData ?? [];
  const isInitialLoading =
    loading && properties.length === 0;

  const renderProperty = useCallback(
    ({ item }: { item: any }) => (
      <TouchableOpacity
        className="flex-row rounded-xl shadow-sm mb-3 p-3 border"
        style={{
          backgroundColor: theme.navBackground,
          borderColor: theme.muted + "20",
        }}
        onPress={() =>
          router.push(`/properties/${item.$id}` as any)
        }
      >
        <View className="w-20 h-20 rounded-lg overflow-hidden bg-gray-200 items-center justify-center">
          <ExpoImage
            source={
              item.image1
                ? { uri: item.image1 }
                : icons.house
            }
            style={{ width: "100%", height: "100%" }}
            contentFit={
              item.image1 ? "cover" : "contain"
            }
            cachePolicy="memory-disk"
            recyclingKey={
              item.image1 || `city-${item.$id}`
            }
            transition={0}
          />
        </View>

        <View className="flex-1 ml-3">
          <Text
            className="text-base font-rubik-bold"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {item.propertyName || "Property"}
          </Text>
          <Text
            className="text-xs font-rubik mt-1"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {item.address || city}
          </Text>
          <Text
            className="font-rubik-bold mt-2"
            style={{ color: theme.primary[300] }}
          >
            ${Number(item.price ?? 0).toLocaleString()}
          </Text>
        </View>
      </TouchableOpacity>
    ),
    [city, router, theme],
  );

  if (isInitialLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator
          size="large"
          color={theme.primary[300]}
        />
        <Text className="mt-3" style={{ color: theme.muted }}>
          Finding properties in {city}...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <View
        className="flex-row items-center px-4 py-3 border-b"
        style={{ borderColor: theme.muted + "20" }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3 p-1"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.text}
          />
        </TouchableOpacity>

        <View className="flex-1">
          <Text
            className="text-xl font-rubik-bold"
            style={{ color: theme.text }}
          >
            {city || "Location"}
          </Text>
          <Text
            className="text-sm font-rubik"
            style={{ color: theme.muted }}
          >
            {properties.length} properties found
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void refetch({ city })}
          className="p-2"
          accessibilityLabel="Refresh location properties"
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={theme.primary[300]}
          />
        </TouchableOpacity>
      </View>

      {error && properties.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center" style={{ color: theme.muted }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch({ city })}
            className="mt-4 rounded-full px-5 py-3"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-medium">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={properties}
          renderItem={renderProperty}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="py-16 items-center">
              <Ionicons
                name="location-outline"
                size={48}
                color={theme.muted}
              />
              <Text
                className="font-rubik mt-3"
                style={{ color: theme.muted }}
              >
                No properties found in {city}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default PropertiesByLocation;
