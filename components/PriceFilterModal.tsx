// components/PriceFilterModal.tsx
import { Colors } from "@/constants/Colors";
import { PRICE_RANGES, PriceRange } from "@/lib/appwrite";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface PriceFilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (
    priceRange?: PriceRange,
    customPrice?: { min: number; max: number },
  ) => void;
  currentPriceRange?: PriceRange;
  currentCustomPrice?: { min: number; max: number };
}

export const PriceFilterModal: React.FC<PriceFilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentPriceRange,
  currentCustomPrice,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [selectedRange, setSelectedRange] = useState<PriceRange | undefined>(
    currentPriceRange,
  );
  const [customMin, setCustomMin] = useState(
    currentCustomPrice?.min?.toString() || "",
  );
  const [customMax, setCustomMax] = useState(
    currentCustomPrice?.max?.toString() || "",
  );
  const [showCustom, setShowCustom] = useState(!!currentCustomPrice);

  const handleApply = () => {
    if (showCustom && customMin && customMax) {
      onApply(undefined, {
        min: parseInt(customMin),
        max: parseInt(customMax),
      });
    } else if (selectedRange) {
      onApply(selectedRange, undefined);
    } else {
      onApply(undefined, undefined);
    }
    onClose();
  };

  const handleClear = () => {
    setSelectedRange(undefined);
    setCustomMin("");
    setCustomMax("");
    setShowCustom(false);
    onApply(undefined, undefined);
    onClose();
  };

  const renderPriceCard = (range: PriceRange) => {
    const isSelected = selectedRange === range && !showCustom;

    return (
      <TouchableOpacity
        key={range.label}
        onPress={() => {
          setSelectedRange(range);
          setShowCustom(false);
        }}
        className={`p-4 rounded-xl mb-3 flex-row justify-between items-center ${
          isSelected ? "border-2" : "border"
        }`}
        style={{
          backgroundColor: isSelected ? theme.primary[100] : theme.surface,
          borderColor: isSelected ? theme.primary[300] : theme.muted + "40",
        }}
      >
        <View>
          <Text
            className="text-base font-rubik-medium"
            style={{ color: isSelected ? theme.primary[300] : theme.text }}
          >
            {range.label}
          </Text>
          {range.max === 10000 ? (
            <Text className="text-xs mt-1" style={{ color: theme.muted }}>
              Properties ${range.min}+
            </Text>
          ) : (
            <Text className="text-xs mt-1" style={{ color: theme.muted }}>
              {range.min} - {range.max} per month
            </Text>
          )}
        </View>
        {isSelected && (
          <View
            className="w-6 h-6 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View
          className="flex-1 mt-20 rounded-t-3xl"
          style={{ backgroundColor: theme.background }}
        >
          {/* Header */}

          <View className="flex-row justify-between items-center p-5">
            <Text className="text-white text-xl font-rubik-bold">
              Filter by Price
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-3 px-5 pb-5">
            <TouchableOpacity
              onPress={handleClear}
              className="flex-1 py-3 rounded-xl"
              style={{
                backgroundColor: theme.navBackground,
                borderWidth: 1.5,
                borderColor: "#EF4444",
              }}
            >
              <Text
                className="text-center font-rubik-bold"
                style={{ color: "#EF4444" }}
              >
                Clear All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApply}
              className="flex-1 py-3 rounded-xl"
              style={{
                backgroundColor: theme.navBackground,
                borderWidth: 1.5,
                borderColor: theme.primary[300],
              }}
            >
              <Text
                className="text-center font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                Apply Filters
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            className="flex-1 p-5"
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Select Title */}
            <Text
              className="text-lg font-rubik-bold mb-3"
              style={{ color: theme.title }}
            >
              Quick Select
            </Text>

            {/* Price Range Buttons */}
            {PRICE_RANGES.map(renderPriceCard)}

            {/* Custom Range Toggle */}
            <TouchableOpacity
              onPress={() => {
                setShowCustom(!showCustom);
                if (!showCustom) {
                  setSelectedRange(undefined);
                }
              }}
              className="flex-row items-center justify-between p-4 rounded-xl mb-3"
              style={{
                backgroundColor: showCustom
                  ? theme.primary[100]
                  : theme.surface,
                borderWidth: 1,
                borderColor: showCustom
                  ? theme.primary[300]
                  : theme.muted + "40",
              }}
            >
              <View>
                <Text
                  className="text-base font-rubik-medium"
                  style={{
                    color: showCustom ? theme.primary[300] : theme.text,
                  }}
                >
                  Custom Range
                </Text>
                <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                  Set your own minimum and maximum
                </Text>
              </View>
              <Ionicons
                name={showCustom ? "chevron-up" : "chevron-down"}
                size={20}
                color={showCustom ? theme.primary[300] : theme.muted}
              />
            </TouchableOpacity>

            {/* Custom Range Inputs */}
            {showCustom && (
              <View className="flex-row gap-3 mb-5">
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Min Price ($)
                  </Text>
                  <TextInput
                    value={customMin}
                    onChangeText={setCustomMin}
                    keyboardType="numeric"
                    placeholder="Min"
                    placeholderTextColor={theme.muted}
                    className="border rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "40",
                      color: theme.text,
                    }}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Max Price ($)
                  </Text>
                  <TextInput
                    value={customMax}
                    onChangeText={setCustomMax}
                    keyboardType="numeric"
                    placeholder="Max"
                    placeholderTextColor={theme.muted}
                    className="border rounded-xl px-4 py-3"
                    style={{
                      backgroundColor: theme.surface,
                      borderColor: theme.muted + "40",
                      color: theme.text,
                    }}
                  />
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};
