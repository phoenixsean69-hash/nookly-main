// components/TenantScoreBadge.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, useColorScheme, View } from "react-native";

interface TenantScoreBadgeProps {
  score: number;
  idVerified?: boolean;
  reviewCount?: number;
  previousLandlords?: number;
  size?: "small" | "medium" | "large";
  showDetails?: boolean;
}

export const TenantScoreBadge = ({
  score,
  idVerified = false,
  reviewCount = 0,
  previousLandlords = 0,
  size = "medium",
  showDetails = false,
}: TenantScoreBadgeProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const getScoreColor = (score: number) => {
    if (score >= 4.5) return "#10B981"; // Green - Excellent
    if (score >= 4.0) return "#3B82F6"; // Blue - Good
    if (score >= 3.0) return "#F59E0B"; // Yellow - Average
    return "#EF4444"; // Red - Needs improvement
  };

  const scoreColor = getScoreColor(score);
  const sizes = {
    small: {
      fontSize: "text-xs",
      scoreSize: "text-sm",
      padding: "px-2 py-1",
      iconSize: 12,
      gap: "gap-1",
    },
    medium: {
      fontSize: "text-sm",
      scoreSize: "text-lg",
      padding: "px-3 py-1.5",
      iconSize: 16,
      gap: "gap-1.5",
    },
    large: {
      fontSize: "text-base",
      scoreSize: "text-2xl",
      padding: "px-4 py-2",
      iconSize: 20,
      gap: "gap-2",
    },
  };

  const selectedSize = sizes[size] || sizes.medium;

  return (
    <View className="flex-col">
      {/* Main Badge */}
      <View
        className={`flex-row items-center ${selectedSize.gap} ${selectedSize.padding} rounded-full self-start`}
        style={{
          backgroundColor: scoreColor + "20",
          borderWidth: 1,
          borderColor: scoreColor + "40",
        }}
      >
        <Ionicons
          name="shield-checkmark"
          size={selectedSize.iconSize}
          color={scoreColor}
        />
        <Text
          className={`font-rubik-bold ${selectedSize.scoreSize}`}
          style={{ color: scoreColor }}
        >
          {score.toFixed(1)}
        </Text>
        <Text
          className={`font-rubik-medium ${selectedSize.fontSize}`}
          style={{ color: theme.muted }}
        >
          / 5
        </Text>
        {idVerified && (
          <View className="flex-row items-center ml-1">
            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
          </View>
        )}
      </View>

      {/* Details (optional) */}
      {showDetails && (
        <View className="mt-2 gap-1">
          <View className="flex-row items-center gap-2">
            <Text className="text-xs font-rubik-medium" style={{ color: theme.muted }}>
              Tenant Score
            </Text>
            <Text className="text-xs font-rubik-bold" style={{ color: scoreColor }}>
              {score.toFixed(1)}/5
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            {idVerified && (
              <View className="flex-row items-center bg-green-100 px-2 py-0.5 rounded-full">
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <Text className="text-[10px] font-rubik-medium ml-0.5 text-green-700">
                  Verified
                </Text>
              </View>
            )}
            {reviewCount > 0 && (
              <View className="flex-row items-center bg-blue-100 px-2 py-0.5 rounded-full">
                <Ionicons name="star" size={12} color="#3B82F6" />
                <Text className="text-[10px] font-rubik-medium ml-0.5 text-blue-700">
                  {reviewCount} review{reviewCount > 1 ? "s" : ""}
                </Text>
              </View>
            )}
            {previousLandlords > 0 && (
              <View className="flex-row items-center bg-purple-100 px-2 py-0.5 rounded-full">
                <Ionicons name="business" size={12} color="#8B5CF6" />
                <Text className="text-[10px] font-rubik-medium ml-0.5 text-purple-700">
                  {previousLandlords} landlord{previousLandlords > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
};