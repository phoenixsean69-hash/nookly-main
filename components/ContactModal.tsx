// components/ContactModal.tsx
import { Colors } from "@/constants/Colors";
import { getAvatarSource } from "@/constants/data";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
}

const ContactModal: React.FC<ContactModalProps> = ({
  visible,
  onClose,
  name,
  email,
  phone,
  avatar,
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState<"email" | "call" | "sms" | null>(null);

  const handleEmail = async () => {
    if (!email) {
      Alert.alert("Error", "No email address available");
      return;
    }
    setLoading("email");
    try {
      const url = `mailto:${email}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert("Error", "Cannot open email app");
      }
    } catch (error) {
      console.error("Error opening email:", error);
      Alert.alert("Error", "Failed to open email");
    } finally {
      setLoading(null);
    }
  };

  const handleCall = async () => {
    if (!phone) {
      Alert.alert("Error", "No phone number available");
      return;
    }
    setLoading("call");
    try {
      const url = `tel:${phone}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        onClose();
      } else {
        Alert.alert("Error", "Cannot make phone call");
      }
    } catch (error) {
      console.error("Error making phone call:", error);
      Alert.alert("Error", "Failed to make phone call");
    } finally {
      setLoading(null);
    }
  };
  // Get the correct avatar source
  const getAvatarImage = () => {
    if (avatar && avatar.startsWith("http")) {
      return { uri: avatar };
    }
    return getAvatarSource(avatar || "human-1");
  };

  // Get initials for fallback
  const getInitials = () => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="w-80 rounded-2xl overflow-hidden"
          style={{ backgroundColor: theme.surface }}
        >
          {/* Header */}
          <View
            className="p-5 items-center border-b"
            style={{ borderBottomColor: theme.muted + "20" }}
          >
            <View className="w-16 h-16 rounded-full overflow-hidden mb-3">
              {avatar ? (
                <Image
                  source={getAvatarImage()}
                  className="w-full h-full"
                  style={{ resizeMode: "cover" }}
                />
              ) : (
                <View
                  className="w-full h-full items-center justify-center"
                  style={{ backgroundColor: theme.primary[100] }}
                >
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {getInitials()}
                  </Text>
                </View>
              )}
            </View>
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              {name}
            </Text>
            <Text className="text-sm mt-1" style={{ color: theme.muted }}>
              Choose how to connect with them
            </Text>
          </View>

          {/* Contact Options */}
          <View className="p-5">
            {/* Email Option */}
            <TouchableOpacity
              onPress={handleEmail}
              disabled={loading === "email"}
              className="flex-row items-center p-4 rounded-xl mb-3"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "20",
                opacity: loading === "email" ? 0.6 : 1,
              }}
            >
              <View className="w-10 h-10 rounded-full items-center justify-center mr-3">
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={theme.primary[300]}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  Send Email
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: theme.muted }}
                  numberOfLines={1}
                >
                  {email}
                </Text>
              </View>
              {loading === "email" ? (
                <ActivityIndicator size="small" color={theme.primary[300]} />
              ) : (
                <Ionicons
                  name="arrow-forward"
                  size={20}
                  color={theme.primary[300]}
                />
              )}
            </TouchableOpacity>

            {/* Phone Option (if available) */}
            {phone && (
              <>
                {/* Call Option */}
                <TouchableOpacity
                  onPress={handleCall}
                  disabled={loading === "call"}
                  className="flex-row items-center p-4 rounded-xl mb-3"
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.muted + "20",
                    opacity: loading === "call" ? 0.6 : 1,
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: theme.primary[300] + "20" }}
                  >
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color={theme.primary[300]}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="text-sm font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      Call
                    </Text>
                    <Text
                      className="text-xs mt-0.5"
                      style={{ color: theme.muted }}
                    >
                      {phone}
                    </Text>
                  </View>
                  {loading === "call" ? (
                    <ActivityIndicator size="small" color={theme.primary[300]} />
                  ) : (
                    <Ionicons
                      name="arrow-forward"
                      size={20}
                      color={theme.primary[300]}
                    />
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Close Button */}
            <TouchableOpacity
              onPress={onClose}
              className="mt-2 py-3 rounded-xl"
              style={{ backgroundColor: theme.muted + "20" }}
            >
              <Text
                className="text-center font-rubik-medium"
                style={{ color: theme.text }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ContactModal;