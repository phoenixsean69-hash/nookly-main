// components/AccreditedBadge.tsx
import React from "react";
import { Image, Text, View } from "react-native";

interface AccreditedBadgeProps {
  showTooltip?: boolean;
}

export const AccreditedBadge = ({
  showTooltip = false,
}: AccreditedBadgeProps) => {
  return (
    <View className="relative">
      <Image
        source={require("@/assets/icons/medal.png")}
        style={{
          width: 30,
          height: 30,
          resizeMode: "contain",
        }}
      />

      {showTooltip && (
        <View
          className="absolute top-full mt-1 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: "#1F2937",
            borderWidth: 1,
            borderColor: "#374151",
          }}
        >
          <Text className="text-xs text-white font-rubik-medium">
            Accredited by Nookly
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5">
            3+ positive reviews • 90+ days trusted
          </Text>
        </View>
      )}
    </View>
  );
};
