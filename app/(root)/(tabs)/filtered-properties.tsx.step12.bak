// app/(root)/filtered-properties.tsx
import { Card } from "@/components/Cards";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { getAvailableProperties, getProperties } from "@/lib/appwrite";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
    type: string;
    sort: string;
    title: string;
  }>();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const fetchFilteredProperties = useCallback(async () => {
    try {
      setLoading(true);
      let fetchedProperties: any[] = [];

      switch (params.type) {
        case "boarding":
          // Get boarding houses
          fetchedProperties = await getAvailableProperties({
            filter: "All",
            query: "",
            limit: 20,
          });
          fetchedProperties = fetchedProperties.filter(
            (p) => p.type === "Boarding" || p.type === "Boarding House",
          );
          break;

        case "open_properties":
        case "available":
          // Get ALL available properties (not just recent ones)
          const allAvailableProps = await getAvailableProperties({
            filter: "All",
            query: "",
            limit: 50,
          });

          fetchedProperties = allAvailableProps;

          // Sort by newest first
          fetchedProperties.sort(
            (a, b) =>
              new Date(b.$createdAt).getTime() -
              new Date(a.$createdAt).getTime(),
          );
          break;

        case "price_drop":
          // Get properties with price drops
          const priceDropProps = await getProperties({
            filter: "All",
            query: "",
            limit: 20,
          });
          fetchedProperties = priceDropProps.filter(
            (p) => p.hasPriceDrop === true,
          );
          break;

        case "new_listing":
          // Get newest properties (sorted by createdAt)
          const newProps = await getProperties({
            filter: "All",
            query: "",
            limit: 20,
          });
          fetchedProperties = newProps.sort(
            (a, b) =>
              new Date(b.$createdAt).getTime() -
              new Date(a.$createdAt).getTime(),
          );
          break;

        case "trending":
          // Get top liked properties
          const allProps = await getProperties({
            filter: "All",
            query: "",
            limit: 20,
          });
          fetchedProperties = allProps.sort(
            (a, b) => (b.likes || 0) - (a.likes || 0),
          );
          break;

        default:
          fetchedProperties = await getProperties({
            filter: "All",
            query: "",
            limit: 20,
          });
          break;
      }

      setProperties(fetchedProperties);
    } catch (error) {
      console.error("Error fetching filtered properties:", error);
    } finally {
      setLoading(false);
    }
  }, [params.type]);

  useEffect(() => {
    fetchFilteredProperties();
  }, [fetchFilteredProperties]);

  const handleCardPress = (id: string) => {
    router.push(`/properties/${id}`);
  };

  // Get dynamic title based on type
  const getTitle = () => {
    if (params.title) return params.title;

    switch (params.type) {
      case "boarding":
        return "Student Deals - Boarding Houses";
      case "open_properties":
        return "Open Properties";
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
    if (params.type === "open_properties" || params.type === "available") {
      return "Properties available for rent";
    }
    if (params.type === "boarding") {
      return "Boarding houses perfect for students";
    }
    if (params.type === "price_drop") {
      return "Properties with reduced prices";
    }
    if (params.type === "new_listing") {
      return "Fresh properties added recently";
    }
    if (params.type === "trending") {
      return "Most liked properties in the community";
    }
    return "Find your perfect property";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity
          onPress={() => router.push("/tenantHome")}
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
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-2" style={{ color: theme.muted }}>
            Loading properties...
          </Text>
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
            {params.type === "open_properties"
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
              <Card item={item} onPress={() => handleCardPress(item.$id)} />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default FilteredProperties;
