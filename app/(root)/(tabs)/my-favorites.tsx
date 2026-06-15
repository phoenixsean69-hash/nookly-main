import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  FavoriteProperty,
  getFavorites,
  removeFromFavorites,
} from "@/lib/localFavorites";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

export default function MyFavorites() {
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  useEffect(() => {
    const fetchFavorites = async () => {
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
  }, []);

  const handleRemove = async (propertyId: string) => {
    try {
      await removeFromFavorites(propertyId);
      setFavorites(favorites.filter((fav) => fav.$id !== propertyId));
    } catch (err) {
      console.error("Error removing favorite:", err);
    }
  };

  const handlePropertyPress = (id: string) => {
    router.push(`/properties/${id}`);
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
        <TouchableOpacity
          onPress={() => router.push("/profile")}
          className="mr-4 p-2"
        >
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          My Favorites
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
          favorites.map((property) => (
            <TouchableOpacity
              key={property.$id}
              onPress={() => handlePropertyPress(property.$id)}
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
              activeOpacity={0.85} // subtle feedback
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
                  <View
                    className="flex-row items-center px-3 py-1 rounded-full"
                    style={{ backgroundColor: theme.muted + "30" }}
                  >
                    <Image
                      source={icons.home}
                      className="w-3 h-3 mr-1"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text className="text-xs font-rubik-medium text-orange-500">
                      {property.type || "Property"}
                    </Text>
                  </View>
                  {property.rating && property.rating > 0 && (
                    <View className="flex-row items-center ml-2">
                      <Image source={icons.star} className="w-3 h-3 mr-1" />
                      <Text className="text-xs" style={{ color: theme.muted }}>
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

                {/* Price */}
                <Text
                  className="text-xl font-rubik-bold mt-2"
                  style={{ color: theme.primary[300] }}
                >
                  ${property.price}
                  <Text
                    className="text-xs font-rubik"
                    style={{ color: theme.muted }}
                  >
                    {property.type === "Boarding" ? "/head" : "/month"}
                  </Text>
                </Text>

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
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
