// components/QuickActions.tsx
import icons from "@/constants/icons";
import { router } from "expo-router";
import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

const actions = [
  {
    label: "Favorites",
    icon: icons.heart,
    tintColor: "#EF4444",
    route: "/my-favorites" as const,
  },

    {
    label: "Landlords",
    icon: icons.owner,
    route: "/landlords" as any,
  },

  {
    label: "Chat Help",
    icon: icons.chat,
    tintColor: "#10B981",
    route: "/message" as const,
  },
  {
    label: "Schedules",
    icon: icons.calendar,
    tintColor: "#F59E0B",
    route: "/calendar" as const,
  },
];

const QuickActions = () => (
  <View className="flex-row justify-between px-5 mt-4">
    {actions.map((action) => (
      <TouchableOpacity
        key={action.label}
        className="items-center justify-center"
        onPress={() => router.push(action.route)}
      >
        <Image
          source={action.icon}
          className="size-10 mb-1"
          style={{ tintColor: action.tintColor }}
        />
        <Text className="text-xs font-rubik text-black-200">
          {action.label}
        </Text>
      </TouchableOpacity>
    ))}
  </View>
);

export default QuickActions;
