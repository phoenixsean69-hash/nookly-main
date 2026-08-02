import { Colors } from "@/constants/Colors";
import { config } from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import locationService, {
  PopularLocation,
} from "../../../services/location.service";

const LOCATION_LIMIT = 20;
const LOCATIONS_CACHE_KEY = "discovery_all_locations_20";

const AllLocations = () => {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const {
    data: locationData,
    loading,
    error,
    refetch,
  } = useAppwrite<PopularLocation[], { limit: number }>({
    fn: ({ limit }) =>
      locationService.getPopularLocations(limit),
    params: { limit: LOCATION_LIMIT },
    cacheKey: LOCATIONS_CACHE_KEY,
    watchCollections: [config.propertiesCollectionId],
  });

  const locations = locationData ?? [];
  const isInitialLoading = loading && locations.length === 0;

  const getLocationIcon = (name: string) => {
    const icons: Record<string, string> = {
      Harare: "🏙️",
      Bulawayo: "🏛️",
      Mutare: "⛰️",
      Gweru: "🌳",
      Kwekwe: "🏭",
      Masvingo: "🏺",
      "Victoria Falls": "💦",
      Zvishavane: "⛏️",
      Marondera: "🌾",
      Chinhoyi: "🦁",
      Kadoma: "🔧",
      Hwange: "🐘",
      Beitbridge: "🌉",
      Chiredzi: "🌴",
      Rusape: "🍎",
    };

    return icons[name] || "📍";
  };

  const getLocationColor = (name: string) => {
    const colors = [
      "#FF6B6B",
      "#4ECDC4",
      "#45B7D1",
      "#96CEB4",
      "#FFEAA7",
      "#DDA0DD",
      "#98D8C8",
      "#F7D794",
      "#786FA6",
      "#F8A5C2",
      "#63CDDA",
      "#EA868F",
      "#A8E6CF",
      "#FFD93D",
      "#6C5CE7",
      "#00CEC9",
      "#FF7675",
      "#74B9FF",
      "#FD79A8",
      "#E84393",
    ];

    let hash = 0;

    for (let index = 0; index < name.length; index += 1) {
      hash =
        name.charCodeAt(index) +
        ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

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
          Loading locations...
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
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-4 p-2"
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={theme.title}
          />
        </TouchableOpacity>

        <View className="flex-1">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Explore Locations
          </Text>
          <Text className="text-sm mt-1" style={{ color: theme.muted }}>
            Find properties in these amazing areas
          </Text>
        </View>

        <TouchableOpacity
          onPress={() =>
            void refetch({ limit: LOCATION_LIMIT })
          }
          className="p-2"
          accessibilityLabel="Refresh locations"
        >
          <Ionicons
            name="refresh-outline"
            size={22}
            color={theme.primary[300]}
          />
        </TouchableOpacity>
      </View>

      {error && locations.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-center" style={{ color: theme.muted }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={() =>
              void refetch({ limit: LOCATION_LIMIT })
            }
            className="mt-4 rounded-full px-5 py-3"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-medium">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View
            className="mx-5 mt-4 p-4 rounded-2xl flex-row justify-between items-center"
            style={{ backgroundColor: theme.surface }}
          >
            <View>
              <Text
                className="text-2xl text-center font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                {locations.length}
              </Text>
              <Text className="text-sm" style={{ color: theme.muted }}>
                Locations Available
              </Text>
            </View>

            <View
              className="w-px h-10"
              style={{ backgroundColor: theme.muted + "30" }}
            />

            <View>
              <Text
                className="text-2xl text-center font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                {locations.reduce(
                  (sum, location) =>
                    sum + (location.propertyCount || 0),
                  0,
                )}
              </Text>
              <Text className="text-sm" style={{ color: theme.muted }}>
                Total Properties
              </Text>
            </View>

            <View
              className="w-px h-10"
              style={{ backgroundColor: theme.muted + "30" }}
            />

            <View className="items-center">
              <Ionicons
                name="location-outline"
                size={28}
                color={theme.primary[300]}
              />
              <Text
                className="text-sm text-center mt-1"
                style={{ color: theme.muted }}
              >
                Zimbabwe Wide
              </Text>
            </View>
          </View>

          <View className="px-5 mt-5 mb-2">
            <Text
              className="text-base font-rubik-medium"
              style={{ color: theme.muted }}
            >
              Popular Cities & Towns
            </Text>
            <Text
              className="text-xs mt-1"
              style={{ color: theme.muted + "80" }}
            >
              Tap on any location to see available properties
            </Text>
          </View>

          <FlatList
            data={locations}
            numColumns={2}
            renderItem={({ item }) => {
              const locationColor =
                getLocationColor(item.name);

              return (
                <TouchableOpacity
                  onPress={() =>
                    router.push({
                      pathname:
                        "/s-properties-by-location" as any,
                      params: { city: item.name },
                    })
                  }
                  className="flex-1 m-2 p-4 rounded-2xl"
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.muted + "20",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 4,
                    elevation: 2,
                  }}
                  activeOpacity={0.8}
                >
                  <View className="flex-row justify-between items-start mb-3">
                    <View
                      className="w-12 h-12 rounded-2xl items-center justify-center"
                      style={{
                        backgroundColor:
                          locationColor + "20",
                      }}
                    >
                      <Text className="text-2xl">
                        {getLocationIcon(item.name)}
                      </Text>
                    </View>

                    <View
                      className="px-2 py-1 rounded-full"
                      style={{
                        backgroundColor:
                          locationColor + "15",
                      }}
                    >
                      <Text
                        className="text-xs font-rubik-medium"
                        style={{ color: locationColor }}
                      >
                        {item.propertyCount || 0} listings
                      </Text>
                    </View>
                  </View>

                  <Text
                    className="text-lg font-rubik-bold mt-1"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>

                  <Text
                    className="text-xs mt-1"
                    style={{ color: theme.muted }}
                    numberOfLines={2}
                  >
                    {getLocationDescription(item.name)}
                  </Text>

                  <View className="flex-row items-center mt-3">
                    <Text
                      className="text-xs font-rubik-medium"
                      style={{ color: locationColor }}
                    >
                      Explore
                    </Text>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={locationColor}
                      style={{ marginLeft: 4 }}
                    />
                  </View>
                </TouchableOpacity>
              );
            }}
            keyExtractor={(item) => item.id}
            contentContainerClassName="p-2 pb-10"
            showsVerticalScrollIndicator={false}
          />
        </>
      )}
    </SafeAreaView>
  );
};

const getLocationDescription = (name: string): string => {
  const descriptions: Record<string, string> = {
    Harare: "Capital city with vibrant culture",
    Bulawayo: "City of kings and heritage",
    Mutare: "Gateway to the Eastern Highlands",
    Gweru: "Midlands heartland",
    Kwekwe: "Gold mining town",
    Masvingo: "Home to Great Zimbabwe",
    "Victoria Falls": "Adventure capital",
    Zvishavane: "Mining community",
    Marondera: "Agricultural hub",
    Chinhoyi: "Caves and wilderness",
    Kadoma: "Industrial center",
    Hwange: "Wildlife paradise",
    Beitbridge: "Border town",
    Chiredzi: "Sugar estate region",
    Rusape: "Fruit growing area",
  };

  return descriptions[name] || "Find great properties here";
};

export default AllLocations;
