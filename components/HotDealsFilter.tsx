// components/HotDealsFilter.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

interface HotDealsFilterProps {
  isActive: boolean;
  onToggle: () => void;
  count?: number;
}

export const HotDealsFilter = ({
  isActive,
  onToggle,
  count = 0,
}: HotDealsFilterProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      className={`px-3 py-2 rounded-full flex-row items-center ${
        isActive ? "bg-red-500" : "bg-gray-100 dark:bg-gray-800"
      }`}
      style={{
        backgroundColor: isActive ? "#DC2626" : theme.surface,
        borderWidth: isActive ? 0 : 1,
        borderColor: theme.muted + "30",
        shadowColor: isActive ? "#DC2626" : "transparent",
        shadowOffset: { width: 0, height: isActive ? 4 : 0 },
        shadowOpacity: isActive ? 0.3 : 0,
        shadowRadius: isActive ? 8 : 0,
        elevation: isActive ? 4 : 0,
      }}
    >
      <Ionicons
        name="flame"
        size={16}
        color={isActive ? "#FFFFFF" : "#DC2626"}
      />
      <Text
        className={`font-rubik-bold text-xs ml-1.5 ${
          isActive ? "text-white" : "text-red-600 dark:text-red-400"
        }`}
      >
        Hot Deals
      </Text>
      {count > 0 && (
        <View
          className={`ml-1.5 px-1.5 py-0.5 rounded-full ${
            isActive ? "bg-white/20" : "bg-red-100 dark:bg-red-900/30"
          }`}
        >
          <Text
            className={`text-[10px] font-rubik-bold ${
              isActive ? "text-white" : "text-red-600 dark:text-red-400"
            }`}
          >
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

export default HotDealsFilter;
