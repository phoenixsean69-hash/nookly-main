// app/offline-favorites.tsx

import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  FavoriteProperty,
  getFavorites,
  removeFromFavorites,
} from "@/lib/localFavorites";
import { useFocusEffect } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// --- Imports for a more "lively" UI ---
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";

// Helper function to get price suffix based on property type
const getPriceSuffix = (propertyType: string) => {
  return propertyType?.toLowerCase() === "boarding" ? "/head/room" : "/month";
};

export default function OfflineFavorites() {
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Use useFocusEffect to refetch favorites every time the screen is viewed
  useFocusEffect(
    React.useCallback(() => {
      const fetchFavorites = async () => {
        setLoading(true); // Show loader while refetching
        try {
          const storedFavorites = await getFavorites();
          setFavorites(storedFavorites);
        } catch (err) {
          console.error("Error fetching favorites:", err);
          setFavorites([]);
        } finally {
          setLoading(false);
        }
      };

      fetchFavorites();
    }, []),
  );

  const handleRemove = async (propertyId: string) => {
    try {
      // 💥 Add Haptic feedback for a satisfying feel
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // The animation will be handled automatically by the Layout prop
      await removeFromFavorites(propertyId);
      setFavorites(favorites.filter((fav) => fav.$id !== propertyId));
    } catch (err) {
      console.error("Error removing favorite:", err);
    }
  };

  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Custom Header */}
      <View
        className="flex-row items-center px-5 py-4"
        style={{
          backgroundColor: theme.background,
          borderBottomWidth: 1,
          borderBottomColor: theme.muted + "30",
        }}
      >
        <Text
          className="text-2xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Offline Favorites
        </Text>
      </View>

      {/* --- Info Banner --- */}
      <View
        className="flex-row items-center p-3 mx-5 my-2 rounded-lg"
        style={{ backgroundColor: theme.navBackground }}
      >
        <Image
          source={icons.info}
          className="w-5 h-5 mr-3"
          style={{ tintColor: theme.primary[400] }}
        />
        <Text className="text-xs flex-1" style={{ color: theme.muted }}>
          You&apos;re offline. Connect to the internet to view property details.
        </Text>
      </View>

      <ScrollView
        className="px-5 pt-4"
        style={{ backgroundColor: theme.background }}
        showsVerticalScrollIndicator={false}
      >
        {favorites.length === 0 ? (
          <View className="items-center mt-20">
            <Image
              source={icons.heart}
              className="w-20 h-20 opacity-30 mb-4"
              style={{ tintColor: theme.muted }}
            />
            <Text
              className="text-lg font-rubik-medium text-center"
              style={{ color: theme.text }}
            >
              No favorites yet
            </Text>
            <Text
              className="text-sm text-center mt-2 px-10"
              style={{ color: theme.muted }}
            >
              Tap the heart icon on properties you love to save them here
            </Text>
          </View>
        ) : (
          favorites.map((property, index) => (
            <Animated.View
              key={property.$id}
              layout={Layout.springify()}
              entering={FadeInDown.delay(index * 100).duration(300)}
            >
              <View
                className="mb-4 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 6,
                  elevation: 3,
                }}
              >
                {/* Property Image */}
                {property.image1 && (
                  <Image
                    source={{ uri: property.image1 }}
                    className="w-full h-48"
                    resizeMode="cover"
                  />
                )}

                {/* Property Details */}
                <View className="p-4">
                  <Text
                    className="text-lg font-rubik-bold mb-1"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {property.propertyName}
                  </Text>

                  {/* Type + Rating */}
                  <View className="flex-row items-center mb-2">
                    <View className="flex-row items-center px-3 py-1 bg-primary-100 rounded-full">
                      <Text className="text-xs font-rubik-medium text-primary-300">
                        {property.type || "Property"}
                      </Text>
                    </View>
                    {property.rating && property.rating > 0 && (
                      <View className="flex-row items-center ml-2">
                        <Image source={icons.star} className="w-3 h-3 mr-1" />
                        <Text
                          className="text-xs"
                          style={{ color: theme.muted }}
                        >
                          {property.rating}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Address */}
                  <View className="flex-row items-center mb-2">
                    <Image
                      source={icons.location}
                      className="w-4 h-4 mr-1"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text
                      className="text-sm flex-1"
                      style={{ color: theme.muted }}
                      numberOfLines={1}
                    >
                      {property.address}
                    </Text>
                  </View>

                  {/* Price with conditional suffix */}
                  <Text
                    className="text-xl font-rubik-bold mt-2"
                    style={{ color: theme.primary[300] }}
                  >
                    ${property.price}
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      {getPriceSuffix(property.type)}
                    </Text>
                  </Text>

                  {/*Owner info and contact button*/}
                  <View className="flex-row items-center mt-4">
                    <Image
                      source={{ uri: property.creatorAvatar }}
                      className="w-10 h-10 rounded-full mr-3"
                    />
                    <View className="flex-1">
                      <Text
                        className="text-sm font-rubik-medium"
                        style={{ color: theme.muted }}
                      >
                        {property.creatorName || "Owner"}
                      </Text>
                      <Text className="text-xs" style={{ color: theme.muted }}>
                        {property.creatorEmail}
                      </Text>
                    </View>
                    <Text
                      className="text-xs font-rubik"
                      style={{ color: theme.muted }}
                    >
                      {property.creatorPhone}
                    </Text>
                  </View>

                  {/* Remove button */}
                  <TouchableOpacity
                    onPress={() => handleRemove(property.$id)}
                    className="mt-4 py-3 rounded-full"
                    style={{ backgroundColor: theme.danger + "20" }}
                    activeOpacity={0.8}
                  >
                    <Text
                      className="text-center font-rubik-medium"
                      style={{ color: theme.danger }}
                    >
                      ✖ Remove from Favorites
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
