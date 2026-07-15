// components/ErrorModal.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import {
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ErrorModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  autoClose?: number; // milliseconds (0 = no auto-close)
}

const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  onClose,
  title = "Error",
  message = "Something went wrong. Please try again.",
  autoClose = 3000,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    if (visible && autoClose > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, autoClose);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, onClose]);

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="w-80 rounded-2xl p-6 items-center"
          style={{ backgroundColor: theme.surface }}
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-3"
            style={{ backgroundColor: theme.danger + "20" }}
          >
            <Ionicons name="alert-circle" size={40} color={theme.danger} />
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
          <TouchableOpacity
            onPress={onClose}
            className="px-6 py-2 rounded-full"
            style={{ backgroundColor: theme.danger }}
          >
            <Text className="text-white font-rubik-medium">OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ErrorModal;
