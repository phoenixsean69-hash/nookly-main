import { Colors } from "@/constants/Colors";
import type { PropertyAmenities } from "@/lib/poiService";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

interface AmenitiesBadgeProps {
  amenities: PropertyAmenities | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPress?: () => void;
  compact?: boolean;
}

interface AmenityItem {
  key: string;
  label: string;
  count: number;
  icon: string;
  color: string;
}

export const AmenitiesBadge = ({
  amenities,
  loading,
  error,
  onRetry,
  onPress,
  compact = false,
}: AmenitiesBadgeProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  if (loading) {
    return (
      <View
        className="flex-row items-center rounded-xl px-3 py-2"
        style={{ backgroundColor: theme.surface }}
      >
        <ActivityIndicator size="small" color={theme.primary[300]} />
        <Text className="ml-2 text-xs" style={{ color: theme.muted }}>
          Finding nearby amenities...
        </Text>
      </View>
    );
  }

  if (error && !amenities) {
    return (
      <TouchableOpacity
        onPress={onRetry}
        disabled={!onRetry}
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{
          backgroundColor: `${theme.danger}10`,
          borderWidth: 1,
          borderColor: `${theme.danger}30`,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={19} color={theme.danger} />
        <View className="ml-2 flex-1">
          <Text
            className="text-xs font-rubik-medium"
            style={{ color: theme.text }}
          >
            Nearby amenities could not load
          </Text>
          <Text className="mt-0.5 text-[11px]" style={{ color: theme.muted }}>
            {onRetry
              ? "Tap to retry."
              : "Try again when the connection improves."}
          </Text>
        </View>
        {onRetry && (
          <Ionicons name="refresh" size={17} color={theme.primary[300]} />
        )}
      </TouchableOpacity>
    );
  }

  if (!amenities) return null;

  if (amenities.total === 0) {
    return (
      <View
        className="flex-row items-center rounded-xl px-3 py-2"
        style={{ backgroundColor: theme.surface }}
      >
        <Ionicons
          name="information-circle-outline"
          size={17}
          color={theme.muted}
        />
        <Text className="ml-2 flex-1 text-xs" style={{ color: theme.muted }}>
          No mapped amenities were found within 3 km.
        </Text>
      </View>
    );
  }

  const items: AmenityItem[] = [
    {
      key: "schools",
      label: "Schools",
      count: amenities.schools,
      icon: "school-outline",
      color: "#2563EB",
    },
    {
      key: "universities",
      label: "Universities",
      count: amenities.universities,
      icon: "library-outline",
      color: "#7C3AED",
    },
    {
      key: "hospitals",
      label: "Health",
      count: amenities.hospitals,
      icon: "medical-outline",
      color: "#DC2626",
    },
    {
      key: "shopping",
      label: "Shopping",
      count: amenities.shopping,
      icon: "cart-outline",
      color: "#D97706",
    },
    {
      key: "busTerminals",
      label: "Transport",
      count: amenities.busTerminals,
      icon: "bus-outline",
      color: "#059669",
    },
    {
      key: "policeStations",
      label: "Police",
      count: amenities.policeStations,
      icon: "shield-checkmark-outline",
      color: "#475569",
    },
    {
      key: "restaurants",
      label: "Food",
      count: amenities.restaurants,
      icon: "restaurant-outline",
      color: "#EA580C",
    },
    {
      key: "parks",
      label: "Parks",
      count: amenities.parks,
      icon: "leaf-outline",
      color: "#848482",
    },
    {
      key: "fuelStations",
      label: "Fuel",
      count: amenities.fuelStations,
      icon: "car-outline",
      color: "#0891B2",
    },
  ].filter((item) => item.count > 0);

  const content = compact ? (
    <View className="flex-row flex-wrap items-center gap-1.5">
      {items.slice(0, 5).map((item) => (
        <View
          key={item.key}
          className="flex-row items-center rounded-full px-2 py-1"
          style={{ backgroundColor: `${item.color}18` }}
        >
          <Ionicons name={item.icon as any} size={11} color={item.color} />
          <Text className="ml-1 text-[10px]" style={{ color: item.color }}>
            {item.count}
          </Text>
        </View>
      ))}
      {items.length > 5 && (
        <Text className="text-[10px]" style={{ color: theme.muted }}>
          +{items.length - 5} more
        </Text>
      )}
    </View>
  ) : (
    <View
      className="rounded-2xl border p-3"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}25`,
      }}
    >
      <View className="mb-2 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons
            name="navigate-circle-outline"
            size={20}
            color={theme.primary[300]}
          />
          <Text
            className="ml-2 font-rubik-bold text-sm"
            style={{ color: theme.title }}
          >
            Nearby amenities
          </Text>
        </View>
        <Text className="text-xs" style={{ color: theme.muted }}>
          {amenities.total} total
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {items.map((item) => (
          <View
            key={item.key}
            className="flex-row items-center rounded-full px-2.5 py-1.5"
            style={{ backgroundColor: `${item.color}15` }}
          >
            <Ionicons name={item.icon as any} size={13} color={item.color} />
            <Text className="ml-1 text-xs" style={{ color: item.color }}>
              {item.count} {item.label}
            </Text>
          </View>
        ))}
      </View>

      {amenities.nearestDistanceKm !== null && (
        <Text className="mt-2 text-[11px]" style={{ color: theme.muted }}>
          Closest mapped place is about {amenities.nearestDistanceKm.toFixed(1)}{" "}
          km away.
        </Text>
      )}
    </View>
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.75 : 1}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel="Nearby amenities"
    >
      {content}
    </TouchableOpacity>
  );
};

export default AmenitiesBadge;
