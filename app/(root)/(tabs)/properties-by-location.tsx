// app/properties-by-location.tsx - FIXED
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import locationService from "../../../services/location.service";

const PropertiesByLocation = () => {
  const { city } = useLocalSearchParams<{ city: string }>();
  const router = useRouter();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme?? "light"];

  const loadProperties = useCallback(async () => {
    if (!city) return;
    try {
      setLoading(true);
      const data = await locationService.getPropertiesByCity(city as string);
      setProperties(data);
    } catch (e) {
      console.log("Failed to load by city", e);
      setProperties([]);
    } finally {
      setLoading(false); // <-- THIS WAS MISSING IN CATCH, CAUSED INFINITE LOADING
    }
  }, [city]);

  useEffect(() => {
    loadProperties();
  }, [loadProperties]);

  const renderProperty = ({ item }: { item: any }) => (
    <TouchableOpacity
      className="flex-row rounded-xl shadow-sm mb-3 p-3 border"
      style={{ backgroundColor: theme.navBackground, borderColor: theme.muted + "20" }}
      onPress={() => router.push(`/properties/${item.$id}` as any)}
    >
      <Image source={{ uri: item.image1 || "https://via.placeholder.com/100" }} className="w-20 h-20 rounded-lg" />
      <View className="flex-1 ml-3">
        <Text className="text-base font-rubik-bold" style={{ color: theme.text }} numberOfLines={1}>
          {item.propertyName}
        </Text>
        <Text className="text-xs font-rubik mt-1" style={{ color: theme.muted }} numberOfLines={1}>
          {item.address}
        </Text>
        <Text className="font-rubik-bold mt-2" style={{ color: theme.primary[300] }}>
          ${item.price}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-3" style={{ color: theme.muted }}>Finding properties in {city}...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
      <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: theme.muted + "20" }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <View>
          <Text className="text-xl font-rubik-bold" style={{ color: theme.text }}>{city}</Text>
          <Text className="text-sm font-rubik" style={{ color: theme.muted }}>{properties.length} properties found</Text>
        </View>
      </View>

      <FlatList
        data={properties}
        renderItem={renderProperty}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="py-16 items-center">
            <Ionicons name="location-outline" size={48} color={theme.muted} />
            <Text className="font-rubik mt-3" style={{ color: theme.muted }}>No properties found in {city}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

export default PropertiesByLocation;