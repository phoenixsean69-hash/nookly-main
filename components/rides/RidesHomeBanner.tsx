import { BusFront, ChevronRight, MapPin } from "lucide-react-native";
import { router } from "expo-router";
import React from "react";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

import { Colors } from "@/constants/Colors";

interface RidesHomeBannerProps {
  schoolLocation?: string;
}

const titleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const RidesHomeBanner = ({ schoolLocation }: RidesHomeBannerProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const school = schoolLocation?.trim()
    ? titleCase(schoolLocation)
    : "your institution";

  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={() => router.push("/s-rides" as any)}
      className="rounded-3xl p-4 mb-5 overflow-hidden"
      style={{
        backgroundColor: theme.primary[300],
        shadowColor: "#0061FF",
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 4,
      }}
    >
      <View className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/10" />
      <View className="absolute right-12 -bottom-10 w-24 h-24 rounded-full bg-white/10" />

      <View className="flex-row items-center">
        <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center mr-3">
          <BusFront size={25} color="#FFFFFF" />
        </View>

        <View className="flex-1 pr-2">
          <Text className="text-lg font-rubik-bold text-white">
            Nookly Rides
          </Text>
          <View className="flex-row items-center mt-1">
            <MapPin size={13} color="rgba(255,255,255,0.85)" />
            <Text
              className="text-xs font-rubik text-white/90 ml-1 flex-1"
              numberOfLines={1}
            >
              Find transport serving {school}
            </Text>
          </View>
        </View>

        <View className="w-9 h-9 rounded-full bg-white items-center justify-center">
          <ChevronRight size={20} color={theme.primary[300]} />
        </View>
      </View>

      <Text className="text-xs font-rubik text-white/80 mt-3">
        View departure times, routes, available seats and driver details.
      </Text>
    </TouchableOpacity>
  );
};

export default RidesHomeBanner;
