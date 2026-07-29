import {
  BusFront,
  ChevronRight,
  Clock3,
  MapPin,
  Users,
} from "lucide-react-native";
import React, { memo, useMemo } from "react";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

import { Colors } from "@/constants/Colors";
import {
  formatRideDateTime,
  formatRideFare,
  formatRideStatus,
} from "@/services/rides.service";
import type { RideListItem } from "@/types/rides";

interface RideCardProps {
  ride: RideListItem;
  onPress: () => void;
}

const STATUS_COLORS: Record<string, { background: string; text: string }> = {
  scheduled: { background: "#EAF1FF", text: "#0061FF" },
  boarding: { background: "#FFF4DE", text: "#B76A00" },
  in_progress: { background: "#E6F8EF", text: "#11824B" },
};

const RideCard = ({ ride, onPress }: RideCardProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const departure = useMemo(
    () => formatRideDateTime(ride.departureTime),
    [ride.departureTime],
  );
  const statusColors = STATUS_COLORS[ride.status] ?? {
    background: `${theme.primary[300]}18`,
    text: theme.primary[300],
  };

  const routeName = ride.route?.name || "Campus ride";
  const origin = ride.route?.originName || "Pickup point";
  const destination = ride.route?.destinationName || "Destination";

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      className="rounded-3xl p-4 mb-4"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: `${theme.muted}22`,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-row flex-1 pr-3">
          <View
            className="w-12 h-12 rounded-2xl items-center justify-center mr-3"
            style={{ backgroundColor: `${theme.primary[300]}16` }}
          >
            <BusFront size={24} color={theme.primary[300]} />
          </View>

          <View className="flex-1">
            <Text
              className="text-base font-rubik-bold"
              style={{ color: theme.title }}
              numberOfLines={2}
            >
              {routeName}
            </Text>
            <Text
              className="text-xs font-rubik mt-1"
              style={{ color: theme.muted }}
              numberOfLines={1}
            >
              {ride.vehicleColor} {ride.vehicleMake} {ride.vehicleModel}
            </Text>
          </View>
        </View>

        <View
          className="px-3 py-1.5 rounded-full"
          style={{ backgroundColor: statusColors.background }}
        >
          <Text
            className="text-[11px] font-rubik-medium"
            style={{ color: statusColors.text }}
          >
            {formatRideStatus(ride.status)}
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <View className="flex-row items-center mb-2">
          <MapPin size={16} color={theme.primary[300]} />
          <Text
            className="ml-2 flex-1 text-sm font-rubik"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {origin}
          </Text>
        </View>
        <View className="ml-[7px] h-4 w-[2px] rounded-full bg-gray-300" />
        <View className="flex-row items-center mt-1">
          <MapPin size={16} color="#FF6E6E" />
          <Text
            className="ml-2 flex-1 text-sm font-rubik"
            style={{ color: theme.text }}
            numberOfLines={1}
          >
            {destination}
          </Text>
        </View>
      </View>

      <View
        className="mt-4 pt-4 flex-row items-center justify-between"
        style={{ borderTopWidth: 1, borderTopColor: `${theme.muted}22` }}
      >
        <View className="flex-row items-center flex-1">
          <Clock3 size={16} color={theme.muted} />
          <View className="ml-2">
            <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
              {departure.date}
            </Text>
            <Text
              className="text-sm font-rubik-medium"
              style={{ color: theme.text }}
            >
              {departure.time}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center flex-1 justify-center">
          <Users size={16} color={theme.muted} />
          <View className="ml-2">
            <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
              Seats
            </Text>
            <Text
              className="text-sm font-rubik-medium"
              style={{ color: theme.text }}
            >
              {ride.availableSeats} available
            </Text>
          </View>
        </View>

        <View className="items-end ml-2">
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Fare
          </Text>
          <View className="flex-row items-center">
            <Text
              className="text-sm font-rubik-bold"
              style={{ color: theme.primary[300] }}
            >
              {formatRideFare(ride.fare, ride.currency)}
            </Text>
            <ChevronRight size={16} color={theme.primary[300]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default memo(RideCard);
