// components/ProfileHeader.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
  ViewStyle,
} from "react-native";

interface ProfileHeaderProps {
  title: string;
  showBackButton?: boolean;
  containerStyle?: ViewStyle;
}

const ProfileHeader = ({
  title,
  showBackButton = true,
  containerStyle,
}: ProfileHeaderProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  return (
    <View style={containerStyle} className="flex-row items-center px-5 py-4">
      {showBackButton && (
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
          <Image source={icons.backArrow} className="w-6 h-6" />
        </TouchableOpacity>
      )}
      <Text className="text-2xl font-rubik-bold" style={{ color: theme.text }}>
        {title}
      </Text>
    </View>
  );
};

export default ProfileHeader;
