import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View, useColorScheme } from "react-native";

import { Colors } from "@/constants/Colors";
import {
  formatDriverRideDate,
  formatDriverRideStatus,
  formatDriverRideTime,
} from "@/services/driver.service";
import type { DriverRide } from "@/types/driver";

interface DriverRideCardProps {
  ride: DriverRide;
  onPress: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#2563EB",
  boarding: "#D97706",
  active: "#16A34A",
  delayed: "#DC2626",
  completed: "#64748B",
  cancelled: "#991B1B",
};

export default function DriverRideCard({
  ride,
  onPress,
}: DriverRideCardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const statusColor = STATUS_COLORS[ride.status] ?? theme.primary[300];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      className="mb-3 rounded-2xl border p-4"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}25`,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text
            className="text-base font-rubik-bold"
            style={{ color: theme.title }}
          >
            {ride.route?.name || `${ride.vehicleMake} ${ride.vehicleModel}`}
          </Text>
          <Text
            className="mt-1 text-sm"
            style={{ color: theme.muted }}
            numberOfLines={2}
          >
            {ride.route
              ? `${ride.route.originName} → ${ride.route.destinationName}`
              : ride.schoolLocation}
          </Text>
        </View>

        <View
          className="rounded-full px-3 py-1"
          style={{ backgroundColor: `${statusColor}18` }}
        >
          <Text
            className="text-xs font-rubik-bold"
            style={{ color: statusColor }}
          >
            {formatDriverRideStatus(ride.status)}
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row flex-wrap gap-3">
        <View className="flex-row items-center">
          <Ionicons
            name="calendar-outline"
            size={16}
            color={theme.muted}
          />
          <Text className="ml-1 text-xs" style={{ color: theme.text }}>
            {formatDriverRideDate(ride.departureTime)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={16} color={theme.muted} />
          <Text className="ml-1 text-xs" style={{ color: theme.text }}>
            {formatDriverRideTime(ride.departureTime)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={16} color={theme.muted} />
          <Text className="ml-1 text-xs" style={{ color: theme.text }}>
            {ride.bookedSeats}/{ride.totalSeats} booked
          </Text>
        </View>
      </View>

      <View
        className="mt-4 flex-row items-center justify-between border-t pt-3"
        style={{ borderTopColor: `${theme.muted}20` }}
      >
        <Text className="text-xs" style={{ color: theme.muted }}>
          {ride.vehicleRegistration}
        </Text>
        <View className="flex-row items-center">
          <Text
            className="text-sm font-rubik-medium"
            style={{ color: theme.primary[300] }}
          >
            Open ride
          </Text>
          <Ionicons
            name="chevron-forward"
            size={17}
            color={theme.primary[300]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}
