import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Text, TouchableOpacity, useColorScheme, View } from "react-native";

const tips = [
  {
    icon: "walk-outline" as const,
    title: "Check the daily commute",
    description:
      "Visit the property at the time your lectures normally start. Check transport, walking distance, lighting and road safety.",
    color: "#3B82F6",
  },
  {
    icon: "wifi-outline" as const,
    title: "Confirm study essentials",
    description:
      "Ask about Wi-Fi reliability, electricity backup, water availability, a study desk and quiet hours before paying.",
    color: "#10B981",
  },
  {
    icon: "document-text-outline" as const,
    title: "Read before paying",
    description:
      "Confirm rent, deposit, curfew, visitor rules, shared costs and refund terms in writing. Keep every receipt.",
    color: "#F59E0B",
  },
  {
    icon: "people-outline" as const,
    title: "Meet your housemates",
    description:
      "Discuss cleaning, groceries, noise, guests and study schedules early. Use Nookly Match to find compatible roommates.",
    color: "#8B5CF6",
  },
];

const StudentQuickTips = () => {
  const [expandedTip, setExpandedTip] = useState<number | null>(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <View className="py-4">
      <Text className="text-2xl font-rubik-bold" style={{ color: theme.text }}>
        Student Pro Tips
      </Text>
      <Text className="text-sm text-gray-500 font-rubik mb-4">
        Find a safe, affordable place that supports your studies
      </Text>

      {tips.map((tip, index) => (
        <TouchableOpacity
          key={tip.title}
          className="mb-3 rounded-xl overflow-hidden"
          style={{
            backgroundColor: `${tip.color}10`,
            borderWidth: 1,
            borderColor: `${tip.color}25`,
          }}
          onPress={() => setExpandedTip(expandedTip === index ? null : index)}
          activeOpacity={0.75}
        >
          <View className="p-4 flex-row items-center">
            <View
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${tip.color}20` }}
            >
              <Ionicons name={tip.icon} size={21} color={tip.color} />
            </View>

            <View className="flex-1">
              <Text
                className="text-base font-rubik-medium"
                style={{ color: theme.text }}
              >
                {tip.title}
              </Text>
              {expandedTip === index && (
                <Text
                  className="text-sm mt-2 leading-5 font-rubik"
                  style={{ color: theme.muted }}
                >
                  {tip.description}
                </Text>
              )}
            </View>

            <Ionicons
              name={expandedTip === index ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.muted}
            />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default StudentQuickTips;
