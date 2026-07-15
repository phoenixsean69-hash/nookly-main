// components/PriceFilterButton.tsx
import { Colors } from "@/constants/Colors";
import { PriceRange } from "@/lib/appwrite";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, useColorScheme } from "react-native";
import { PriceFilterModal } from "./PriceFilterModal";

interface PriceFilterButtonProps {
  onPriceChange: (
    priceRange?: PriceRange,
    customPrice?: { min: number; max: number },
  ) => void;
  currentPriceRange?: PriceRange;
  currentCustomPrice?: { min: number; max: number };
}

export const PriceFilterButton: React.FC<PriceFilterButtonProps> = ({
  onPriceChange,
  currentPriceRange,
  currentCustomPrice,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const getActiveFilterLabel = () => {
    if (currentCustomPrice) {
      return `$${currentCustomPrice.min} - $${currentCustomPrice.max}`;
    }
    if (currentPriceRange) {
      return currentPriceRange.label;
    }
    return "All Prices";
  };

  const hasActiveFilter = !!(currentPriceRange || currentCustomPrice);

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        className="flex-row items-center px-4 py-2 rounded-full mr-2"
        style={{
          backgroundColor: hasActiveFilter ? theme.primary[300] : theme.surface,
          borderWidth: 1,
          borderColor: hasActiveFilter
            ? theme.primary[300]
            : theme.muted + "40",
        }}
      >
        <Ionicons
          name="pricetag-outline"
          size={18}
          color={hasActiveFilter ? "#fff" : theme.text}
        />
        <Text
          className="ml-2 font-rubik-medium text-sm"
          style={{ color: hasActiveFilter ? "#fff" : theme.text }}
        >
          {getActiveFilterLabel()}
        </Text>
        {hasActiveFilter && (
          <TouchableOpacity
            onPress={() => onPriceChange(undefined, undefined)}
            className="ml-2"
          >
            <Ionicons name="close-circle" size={16} color="#fff" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <PriceFilterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onApply={onPriceChange}
        currentPriceRange={currentPriceRange}
        currentCustomPrice={currentCustomPrice}
      />
    </>
  );
};
