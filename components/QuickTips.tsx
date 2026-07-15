// components/QuickTips.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import React, { useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const QuickTips = () => {
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const tips = [
    {
      icon: icons.document,
      title: "First time buying?",
      description: "Get pre-approved for a mortgage before you start viewing",
      color: "#3B82F6",
    },
    {
      icon: icons.location,
      title: "Location check",
      description: "Visit at different times to check noise & traffic",
      color: "#10B981",
    },
    {
      icon: icons.camera,
      title: "Virtual tours",
      description: "Request video tours before in-person visits",
      color: "#F59E0B",
    },
  ];

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <View className="py-4">
      <View className="flex-row items-center justify-between mb-4">
        <View>
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.text }}
          >
            Pro Tips
          </Text>
          <Text className="text-sm text-gray-500 font-rubik">
            Make smarter property decisions
          </Text>
        </View>
      </View>

      {tips.map((tip, index) => (
        <TouchableOpacity
          key={index}
          className="mb-3 rounded-xl overflow-hidden"
          style={{
            backgroundColor: tip.color + "10",
            borderWidth: 1,
            borderColor: tip.color + "20",
          }}
          onPress={() => setExpandedTip(expandedTip === index ? null : index)}
          activeOpacity={0.7}
        >
          <View className="p-4">
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: tip.color + "20" }}
              >
                <Image
                  source={tip.icon}
                  className="w-5 h-5"
                  style={{ tintColor: tip.color }}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-base font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  {tip.title}
                </Text>
                {expandedTip === index && (
                  <Text className="text-sm text-gray-600 mt-2 font-rubik">
                    {tip.description}
                  </Text>
                )}
              </View>
              <Image
                source={expandedTip === index ? icons.arrowUp : icons.arrowDown}
                className="w-4 h-4"
                style={{ tintColor: theme.text }}
              />
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default QuickTips;
