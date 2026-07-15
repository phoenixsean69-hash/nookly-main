// components/Filters.tsx
import { categories } from "@/constants/data";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/Colors";

const Filters = () => {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [selectedCategory, setSelectedCategory] = useState(
    params.filter || "All",
  );
  const isUpdating = useRef(false);

  // Sync with URL params when they change externally
  useEffect(() => {
    if (!isUpdating.current) {
      setSelectedCategory(params.filter || "All");
    }
  }, [params.filter]);

  const handleCategoryPress = useCallback(
    (category: string) => {
      // Prevent multiple rapid updates
      if (isUpdating.current) return;

      isUpdating.current = true;

      try {
        const newFilter = selectedCategory === category ? "" : category;

        // Update local state immediately for responsive UI
        setSelectedCategory(newFilter || "All");

        // Update URL params
        router.setParams({ filter: newFilter });

        // Reset the updating flag after a short delay
        setTimeout(() => {
          isUpdating.current = false;
        }, 100);
      } catch (error) {
        console.error("Error updating filter:", error);
        isUpdating.current = false;
      }
    },
    [selectedCategory],
  );

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-3 mb-2"
    >
      {categories.map((item, index) => {
        const isSelected = selectedCategory === item.category;

        return (
          <TouchableOpacity
            onPress={() => handleCategoryPress(item.category)}
            key={index}
            className={`flex flex-col items-start mr-4 px-4 py-2 rounded-full ${
              isSelected
                ? "bg-primary-300"
                : "bg-primary-100 border border-primary-200"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm ${
                isSelected ? "font-rubik-bold mt-0.5" : "font-rubik"
              }`}
              style={{
                color: isSelected ? "#FFFFFF" : theme.title,
              }}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export default Filters;
