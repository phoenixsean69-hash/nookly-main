import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

interface OrganizationApprovedBadgeProps {
  size?: "small" | "medium";
}

const OrganizationApprovedBadge = ({
  size = "small",
}: OrganizationApprovedBadgeProps) => {
  const isMedium = size === "medium";

  return (
    <View
      className={`self-start flex-row items-center rounded-full ${
        isMedium ? "px-3 py-2" : "px-2 py-1"
      }`}
      style={{
        backgroundColor: "#DCFCE7",
        borderWidth: 1,
        borderColor: "#86EFAC",
      }}
      accessibilityRole="text"
      accessibilityLabel="Organization approved boarding house"
    >
      <Ionicons
        name="shield-checkmark"
        size={isMedium ? 17 : 13}
        color="#15803D"
      />

      <Text
        className={`ml-1 font-rubik-bold ${
          isMedium ? "text-sm" : "text-[10px]"
        }`}
        style={{ color: "#15803D" }}
        numberOfLines={1}
      >
        Organization approved
      </Text>
    </View>
  );
};

export default OrganizationApprovedBadge;