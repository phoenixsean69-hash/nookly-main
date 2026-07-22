import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

interface PriceChangeBadgeProps {
  newPrice: number;
  oldPrice: number;
  changeDate?: string;
  showDate?: boolean;
}

export const PriceChangeBadge = ({
  newPrice,
  oldPrice,
  changeDate,
  showDate = false,
}: PriceChangeBadgeProps) => {
  if (!newPrice || !oldPrice || newPrice === oldPrice) return null;

  const priceDiff = newPrice - oldPrice;
  const isDrop = priceDiff < 0;
  const percentChange = Math.round((Math.abs(priceDiff) / oldPrice) * 100);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <View className="flex-row items-center">
      {/* Price change badge */}
      <View
        className={`px-3 py-1.5 rounded-full flex-row items-center ${
          isDrop ? "bg-red-100" : "bg-green-100"
        }`}
        style={{
          backgroundColor: isDrop ? "#FEE2E2" : "#D1FAE5",
        }}
      >
        <Ionicons
          name={isDrop ? "trending-down" : "trending-up"}
          size={14}
          color={isDrop ? "#DC2626" : "#059669"}
        />
        <Text
          className={`font-rubik-bold text-sm ml-1 ${
            isDrop ? "text-red-600" : "text-green-600"
          }`}
        >
          {isDrop ? "-" : "+"}${Math.abs(priceDiff)}
        </Text>
        <Text
          className={`font-rubik-medium text-xs ml-1 ${
            isDrop ? "text-red-500" : "text-green-500"
          }`}
        >
          ({percentChange}%)
        </Text>
      </View>

      {/* Date */}
      {showDate && changeDate && (
        <Text className="text-xs text-gray-500 ml-2">
          {formatDate(changeDate)}
        </Text>
      )}
    </View>
  );
};
