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
        backgroundColor: "#FFF",
        borderWidth: 1,
        borderColor: "#DA9100",
      }}
      accessibilityRole="text"
      accessibilityLabel="Organization approved boarding house"
    >
      <Ionicons
        name="shield-checkmark"
        size={isMedium ? 17 : 13}
        color="#DA9100"
      />

      <Text
        className={`ml-1 font-rubik-bold ${
          isMedium ? "text-sm" : "text-[10px]"
        }`}
        style={{ color: "#DA9100" }}
        numberOfLines={1}
      >
        B.U.S.E approved
      </Text>
    </View>
  );
};

export default OrganizationApprovedBadge;
