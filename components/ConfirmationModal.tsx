// components/ConfirmationModal.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  title = "Confirm",
  message = "Are you sure?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  isLoading = false,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="w-80 rounded-2xl p-6 items-center"
          style={{ backgroundColor: theme.surface }}
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: "#EF444420" }}
          >
            <Ionicons name="warning" size={40} color="#EF4444" />
          </View>
          <Text
            className="text-lg font-rubik-bold mb-2 text-center"
            style={{ color: theme.title }}
          >
            {title}
          </Text>
          <Text
            className="text-sm text-center mb-4"
            style={{ color: theme.muted }}
          >
            {message}
          </Text>
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity
              onPress={onCancel}
              className="flex-1 py-3 rounded-full border"
              style={{
                borderColor: theme.muted + "30",
                backgroundColor: theme.surface,
              }}
            >
              <Text
                className="text-center font-rubik-medium"
                style={{ color: theme.text }}
              >
                {cancelText}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-full"
              style={{
                backgroundColor: isLoading ? theme.muted : "#EF4444",
              }}
            >
              <Text className="text-white text-center font-rubik-medium">
                {isLoading ? "Deleting..." : confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmationModal;
