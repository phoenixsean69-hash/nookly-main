import { STUDENT_PROPERTY_FILTERS } from "@/lib/studentHousing";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native";
import { Colors } from "../constants/Colors";

const StudentFilters = () => {
  const params = useLocalSearchParams<{ filter?: string }>();
  const [selectedCategory, setSelectedCategory] = useState(
    params.filter || "All",
  );
  const isUpdating = useRef(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    if (!isUpdating.current) {
      setSelectedCategory(params.filter || "All");
    }
  }, [params.filter]);

  const handleCategoryPress = useCallback(
    (category: string) => {
      if (isUpdating.current) return;
      isUpdating.current = true;

      const newFilter =
        selectedCategory === category && category !== "All" ? "" : category;

      setSelectedCategory(newFilter || "All");
      router.setParams({ filter: newFilter === "All" ? "" : newFilter });

      setTimeout(() => {
        isUpdating.current = false;
      }, 100);
    },
    [selectedCategory],
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mt-3 mb-2"
    >
      {STUDENT_PROPERTY_FILTERS.map((item) => {
        const isSelected =
          selectedCategory === item.category ||
          (!params.filter && item.category === "All");

        return (
          <TouchableOpacity
            onPress={() => handleCategoryPress(item.category)}
            key={item.category}
            className={`mr-3 px-4 py-2 rounded-full ${
              isSelected
                ? "bg-primary-300"
                : "bg-primary-100 border border-primary-200"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm ${
                isSelected ? "font-rubik-bold" : "font-rubik"
              }`}
              style={{ color: isSelected ? "#FFFFFF" : theme.title }}
            >
              {item.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};

export default StudentFilters;
