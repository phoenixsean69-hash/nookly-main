// components/CustomInput.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import React, { useState } from "react";

import {
  Image,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface CustomInputProps extends TextInputProps {
  label: string;
  error?: string;
}

const CustomInput = ({
  label,
  error,
  secureTextEntry,
  ...props
}: CustomInputProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <View className="mb-4">
      <Text className="text-sm font-rubik-medium text-gray-500 mb-2">
        {label}
      </Text>
      <View
        className={`
    flex-row items-center border rounded-2xl px-4
    ${error ? "border-red-400" : "border-gray-300"}
  `}
        style={{ backgroundColor: theme.navBackground }}
      >
        <TextInput
          className="flex-1 py-4 text-base"
          style={{ color: theme.title }}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry && !showPassword}
          {...props}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="ml-2"
          >
            <Image
              source={showPassword ? icons.eyeHide : icons.eye}
              className="w-5 h-5"
              style={{ tintColor: "#6B7280" }}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text className="text-red-500 text-xs mt-2">{error}</Text>}
    </View>
  );
};

export default CustomInput;
