// components/PriceHistory.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

interface PriceHistoryEntry {
  price: number;
  date: string;
  type: "drop" | "hike";
}

interface PriceHistoryProps {
  history: PriceHistoryEntry[];
  currentPrice: number;
  theme: any;
}

export const PriceHistory = ({ history, currentPrice, theme }: PriceHistoryProps) => {
  if (!history || history.length === 0) {
    return (
      <View className="p-4 bg-gray-50 rounded-xl bg-[theme.navBackground]">
        <Text className="text-gray-500 text-sm">No price history available</Text>
      </View>
    );
  }

  return (
    <View className="p-4 bg-gray-50 border border-gray-200 rounded-xl bg-[#0061FF1A]">
      <Text className="font-rubik-bold text-base mb-3 text-gray-700">Price History</Text>
      
      {history.map((entry, index) => (
        <View key={index} className="flex-row items-center justify-between py-2 border-b border-gray-200">
          <View className="flex-row items-center">
            <Ionicons
              name={entry.type === "drop" ? "trending-down" : "trending-up"}
              size={16}
              color={entry.type === "drop" ? "#DC2626" : "#059669"}
            />
            <Text className="ml-2 font-rubik-medium text-gray-500">
              ${entry.price}/month
            </Text>
          </View>
          <Text className="text-sm text-gray-500">
            {new Date(entry.date).toLocaleDateString()}
          </Text>
          <View
            className={`px-2 py-0.5 rounded-full ${
              entry.type === "drop" ? "bg-red-100" : "bg-green-100"
            }`}
          >
            <Text
              className={`text-xs font-rubik-bold ${
                entry.type === "drop" ? "text-red-600" : "text-green-600"
              }`}
            >
              {entry.type === "drop" ? "▼" : "▲"}
            </Text>
          </View>
        </View>
      ))}
      
      <View className="flex-row items-center justify-between pt-2 mt-2 border-t-2 border-gray-300">
        <Text className="font-rubik-bold text-gray-500">Current</Text>
        <Text className="font-rubik-bold text-lg text-gray-500">
          ${currentPrice}/month
        </Text>
      </View>
    </View>
  );
};