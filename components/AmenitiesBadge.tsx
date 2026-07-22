// components/AmenitiesBadge.tsx
import { PropertyAmenities } from "@/lib/poiService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

interface AmenitiesBadgeProps {
  amenities: PropertyAmenities | null;
  loading: boolean;
  onPress?: () => void;
  compact?: boolean;
}

export const AmenitiesBadge = ({
  amenities,
  loading,
  onPress,
  compact = false,
}: AmenitiesBadgeProps) => {
  if (loading) {
    return (
      <View className="px-3 py-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          Loading...
        </Text>
      </View>
    );
  }

  if (!amenities || amenities.total === 0) {
    return null;
  }

  const hasAmenities = amenities.total > 0;
  const hasSchools = amenities.schools > 0;
  const hasHospitals = amenities.hospitals > 0;
  const hasShops = amenities.shopping > 0;
  const hasTransport = amenities.busTerminals > 0;
  const hasUniversities = amenities.universities > 0;

  if (compact) {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={!onPress}
        className="flex-row items-center"
      >
        <View className="flex-row items-center gap-1">
          {hasSchools && (
            <View className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30">
              <Text className="text-[10px] text-blue-600 dark:text-blue-400">
                🏫 {amenities.schools}
              </Text>
            </View>
          )}
          {hasHospitals && (
            <View className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30">
              <Text className="text-[10px] text-red-600 dark:text-red-400">
                🏥 {amenities.hospitals}
              </Text>
            </View>
          )}
          {hasShops && (
            <View className="px-1.5 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30">
              <Text className="text-[10px] text-yellow-600 dark:text-yellow-400">
                🛒 {amenities.shopping}
              </Text>
            </View>
          )}
          {hasTransport && (
            <View className="px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30">
              <Text className="text-[10px] text-green-600 dark:text-green-400">
                🚌 {amenities.busTerminals}
              </Text>
            </View>
          )}
          {hasUniversities && (
            <View className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30">
              <Text className="text-[10px] text-purple-600 dark:text-purple-400">
                🎓 {amenities.universities}
              </Text>
            </View>
          )}
          {amenities.total > 0 && (
            <Text className="text-[10px] text-gray-500 dark:text-gray-400">
              +
              {amenities.total -
                (amenities.schools +
                  amenities.hospitals +
                  amenities.shopping +
                  amenities.busTerminals +
                  amenities.universities)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className="flex-row flex-wrap gap-1"
    >
      <View className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 flex-row items-center">
        <Ionicons name="school" size={12} color="#3B82F6" />
        <Text className="text-xs text-blue-600 dark:text-blue-400 ml-1">
          {amenities.schools} schools
        </Text>
      </View>
      <View className="px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 flex-row items-center">
        <Ionicons name="medical" size={12} color="#EF4444" />
        <Text className="text-xs text-red-600 dark:text-red-400 ml-1">
          {amenities.hospitals} hospitals
        </Text>
      </View>
      <View className="px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex-row items-center">
        <Ionicons name="cart" size={12} color="#F59E0B" />
        <Text className="text-xs text-yellow-600 dark:text-yellow-400 ml-1">
          {amenities.shopping} shops
        </Text>
      </View>
      <View className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 flex-row items-center">
        <Ionicons name="bus" size={12} color="#10B981" />
        <Text className="text-xs text-green-600 dark:text-green-400 ml-1">
          {amenities.busTerminals} bus stops
        </Text>
      </View>
      <View className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 flex-row items-center">
        <Ionicons name="school" size={12} color="#8B5CF6" />
        <Text className="text-xs text-purple-600 dark:text-purple-400 ml-1">
          {amenities.universities} universities
        </Text>
      </View>
      {amenities.total > 0 && (
        <View className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 flex-row items-center">
          <Text className="text-xs text-gray-600 dark:text-gray-400">
            +{amenities.total} total
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default AmenitiesBadge;
