import ContactModal from "@/components/ContactModal";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  FavoriteProperty,
  getFavorites,
  removeFromFavorites,
} from "@/lib/localFavorites";
import { isStudentPropertyType } from "@/lib/studentHousing";
import useAuthStore from "@/store/auth.store";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const getPriceSuffix = (propertyType: string) => {
  const normalized = propertyType?.trim().toLowerCase();
  return normalized === "boarding" || normalized === "boarding house"
    ? "/head/room"
    : "/month";
};

export default function OfflineFavorites() {
  const { user } = useAuthStore();
  const [favorites, setFavorites] = useState<FavoriteProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProperty, setSelectedProperty] =
    useState<FavoriteProperty | null>(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      const fetchFavorites = async () => {
        setLoading(true);
        try {
          const storedFavorites = await getFavorites();
          if (mounted) setFavorites(storedFavorites);
        } catch (error) {
          console.error("Error fetching favorites:", error);
          if (mounted) setFavorites([]);
        } finally {
          if (mounted) setLoading(false);
        }
      };

      fetchFavorites();
      return () => {
        mounted = false;
      };
    }, []),
  );

  const visibleFavorites = useMemo(() => {
    if (user?.userMode !== "student") return favorites;
    return favorites.filter((property) => isStudentPropertyType(property.type));
  }, [favorites, user?.userMode]);

  const handleRemove = async (propertyId: string) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await removeFromFavorites(propertyId);
      setFavorites((current) =>
        current.filter((favorite) => favorite.$id !== propertyId),
      );
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  const openContact = (property: FavoriteProperty) => {
    if (!property.creatorEmail && !property.creatorPhone) {
      Alert.alert(
        "Contact unavailable",
        "This older cached favorite does not contain owner contact details. Open it while online and save it again to refresh the cache.",
      );
      return;
    }
    setSelectedProperty(property);
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
      <View
        className="flex-row items-center px-5 py-4"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: `${theme.muted}30`,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="text-xl" style={{ color: theme.title }}>
            ‹
          </Text>
        </TouchableOpacity>
        <View>
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Offline Favorites
          </Text>
          <Text className="text-xs" style={{ color: theme.muted }}>
            Cached property and owner details
          </Text>
        </View>
      </View>

      <View
        className="flex-row items-center p-3 mx-5 my-2 rounded-lg"
        style={{ backgroundColor: theme.navBackground }}
      >
        <Image
          source={icons.info}
          className="w-5 h-5 mr-3"
          style={{ tintColor: theme.primary[300] }}
        />
        <Text className="text-xs flex-1" style={{ color: theme.muted }}>
          Property details are cached. Calls, SMS and email open directly in
          your phone apps, even while Nookly is offline.
        </Text>
      </View>

      <ScrollView
        className="px-5 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {visibleFavorites.length === 0 ? (
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
              No cached favorites yet
            </Text>
            <Text
              className="text-sm text-center mt-2 px-10"
              style={{ color: theme.muted }}
            >
              Save a property while online to keep its details and owner
              contacts available here.
            </Text>
          </View>
        ) : (
          visibleFavorites.map((property, index) => (
            <Animated.View
              key={property.$id}
              layout={Layout.springify()}
              entering={FadeInDown.delay(index * 80).duration(300)}
            >
              <View
                className="mb-4 rounded-xl overflow-hidden"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: `${theme.muted}30`,
                  elevation: 3,
                }}
              >
                {property.image1 && (
                  <Image
                    source={{ uri: property.image1 }}
                    className="w-full h-48"
                    resizeMode="cover"
                  />
                )}

                <View className="p-4">
                  <Text
                    className="text-lg font-rubik-bold mb-1"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {property.propertyName || "Property"}
                  </Text>

                  <View className="flex-row items-center mb-2">
                    <View className="px-3 py-1 bg-primary-100 rounded-full">
                      <Text className="text-xs font-rubik-medium text-primary-300">
                        {property.type || "Property"}
                      </Text>
                    </View>
                    {!!property.rating && property.rating > 0 && (
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

                  <View className="flex-row items-center mb-2">
                    <Image
                      source={icons.location}
                      className="w-4 h-4 mr-1"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text
                      className="text-sm flex-1"
                      style={{ color: theme.muted }}
                      numberOfLines={2}
                    >
                      {property.address}
                    </Text>
                  </View>

                  <Text
                    className="text-xl font-rubik-bold mt-2"
                    style={{ color: theme.primary[300] }}
                  >
                    ${property.price}
                    <Text style={{ color: theme.muted, fontSize: 12 }}>
                      {getPriceSuffix(property.type)}
                    </Text>
                  </Text>

                  <View
                    className="flex-row items-center mt-4 pt-3"
                    style={{
                      borderTopWidth: 1,
                      borderTopColor: `${theme.muted}20`,
                    }}
                  >
                    {property.creatorAvatar ? (
                      <Image
                        source={{ uri: property.creatorAvatar }}
                        className="w-10 h-10 rounded-full mr-3"
                      />
                    ) : (
                      <View
                        className="w-10 h-10 rounded-full mr-3 items-center justify-center"
                        style={{ backgroundColor: theme.primary[100] }}
                      >
                        <Image
                          source={icons.person}
                          className="w-5 h-5"
                          style={{ tintColor: theme.primary[300] }}
                        />
                      </View>
                    )}

                    <View className="flex-1">
                      <Text
                        className="text-sm font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {property.creatorName || "Property Owner"}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: theme.muted }}
                        numberOfLines={1}
                      >
                        {property.creatorEmail ||
                          property.creatorPhone ||
                          "Contact not cached"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row gap-2 mt-4">
                    <TouchableOpacity
                      onPress={() => openContact(property)}
                      className="flex-1 py-3 rounded-full items-center justify-center"
                      style={{ backgroundColor: theme.primary[300] }}
                    >
                      <Text className="text-white font-rubik-medium">
                        Contact Owner
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleRemove(property.$id)}
                      className="px-5 py-3 rounded-full"
                      style={{ backgroundColor: `${theme.danger}18` }}
                    >
                      <Text
                        className="font-rubik-medium"
                        style={{ color: theme.danger }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          ))
        )}
      </ScrollView>

      <ContactModal
        visible={selectedProperty !== null}
        onClose={() => setSelectedProperty(null)}
        name={selectedProperty?.creatorName || "Property Owner"}
        email={selectedProperty?.creatorEmail}
        phone={selectedProperty?.creatorPhone}
        avatar={selectedProperty?.creatorAvatar}
        subject={`Nookly enquiry: ${
          selectedProperty?.propertyName || "Property"
        }`}
        message={`Hello, I am interested in ${
          selectedProperty?.propertyName || "your property"
        } at ${selectedProperty?.address || "the listed address"}.`}
      />
    </SafeAreaView>
  );
}
