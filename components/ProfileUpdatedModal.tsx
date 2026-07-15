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

interface ProfileUpdatedModalProps {
  visible: boolean;
  onClose: () => void;
}

const ProfileUpdatedModal: React.FC<ProfileUpdatedModalProps> = ({
  visible,
  onClose,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="w-80 rounded-2xl p-6"
          style={{ backgroundColor: theme.surface }}
        >
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4 self-center"
            style={{ backgroundColor: theme.primary[100] }}
          >
            <Ionicons
              name="checkmark-circle"
              size={40}
              color={theme.primary[300]}
            />
          </View>

          <Text
            className="text-lg font-rubik-bold mb-2 text-center"
            style={{ color: theme.title }}
          >
            Profile Updated!
          </Text>

          <Text
            className="text-sm text-center mb-6"
            style={{ color: theme.muted }}
          >
            Your profile has been successfully updated.
          </Text>

          <TouchableOpacity
            onPress={onClose}
            className="py-3 rounded-xl"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white text-center font-rubik-medium">
              Great!
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default ProfileUpdatedModal;
