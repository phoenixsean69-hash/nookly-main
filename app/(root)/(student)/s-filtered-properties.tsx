import { Card } from "@/components/Cards";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config } from "@/lib/appwrite";
import {
  getFilteredDiscoveryProperties,
  normalizeDiscoveryKeyPart,
} from "@/lib/discoveryQueries";
import { useAppwrite } from "@/lib/useAppwrite";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FilteredProperties = () => {
  const params = useLocalSearchParams<{
    type?: string;
    sort?: string;
    title?: string;
  }>();

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const type = String(params.type || "all");

  const {
    data: propertyData,
    loading,
    error,
    refetch,
  } = useAppwrite({
    fn: getFilteredDiscoveryProperties,
    params: { type },
    cacheKey: `discovery_filtered_${normalizeDiscoveryKeyPart(type)}`,
    watchCollections: [config.propertiesCollectionId],
  });

  const properties = propertyData ?? [];
  const isInitialLoading = loading && properties.length === 0;

  const handleCardPress = (id: string) => {
    router.push(`/properties/${id}`);
  };

  const getTitle = () => {
    if (params.title) return String(params.title);

    switch (type) {
      case "boarding":
        return "Student Deals - Boarding Houses";
      case "open_properties":
      case "available":
        return "Available Properties";
      case "price_drop":
        return "Price Drop Properties";
      case "new_listing":
        return "New Listings";
      case "trending":
        return "Trending Properties";
      default:
        return "Properties";
    }
  };

  const getSubtitle = () => {
    if (type === "open_properties" || type === "available") {
      return "Properties available for rent";
    }
    if (type === "boarding") {
      return "Boarding houses perfect for students";
    }
    if (type === "price_drop") {
      return "Properties with reduced prices";
    }
    if (type === "new_listing") {
      return "Fresh properties added recently";
    }
    if (type === "trending") {
      return "Most liked properties in the community";
    }
    return "Find your perfect property";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          onPress={() => router.push("/s-tenantHome" as any)}
          className="mr-4"
        >
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>

        <View className="flex-1">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {getTitle()}
          </Text>
          <Text className="text-sm mt-1" style={{ color: theme.muted }}>
            {getSubtitle()}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => void refetch({ type })}
          className="p-2"
          accessibilityLabel="Refresh properties"
        >
          <Image
            source={icons.refresh}
            className="w-5 h-5"
            style={{ tintColor: theme.primary[300] }}
          />
        </TouchableOpacity>
      </View>

      {isInitialLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-2" style={{ color: theme.muted }}>
            Loading properties...
          </Text>
        </View>
      ) : error && properties.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Text
            className="text-base text-center"
            style={{ color: theme.muted }}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => void refetch({ type })}
            className="mt-4 px-5 py-3 rounded-full"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-medium">Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : properties.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Image
            source={icons.info}
            className="w-16 h-16 opacity-30 mb-4"
            style={{ tintColor: theme.muted }}
          />
          <Text
            className="text-lg font-rubik-medium text-center"
            style={{ color: theme.text }}
          >
            No properties found
          </Text>
          <Text
            className="text-sm text-center mt-2"
            style={{ color: theme.muted }}
          >
            {type === "open_properties"
              ? "No available properties at the moment. Check back soon!"
              : "Check back later for new listings"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.$id}
          numColumns={2}
          contentContainerStyle={{ padding: 16 }}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: 16,
          }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View className="w-[48%]">
              <Card
                item={item}
                onPress={() => handleCardPress(item.$id)}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default FilteredProperties;
