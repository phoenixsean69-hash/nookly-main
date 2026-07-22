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
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface ContactModalProps {
  visible: boolean;
  onClose: () => void;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  subject?: string;
  message?: string;
}

type ContactAction = "email" | "call" | "sms";

const ContactModal: React.FC<ContactModalProps> = ({
  visible,
  onClose,
  name,
  email,
  phone,
  avatar,
  subject = "Nookly enquiry",
  message = "Hello, I found your details on Nookly and would like to get in touch.",
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState<ContactAction | null>(null);

  const openContactApp = async (
    action: ContactAction,
    url: string,
    unavailableMessage: string,
  ) => {
    setLoading(action);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert("Unavailable", unavailableMessage);
        return;
      }

      await Linking.openURL(url);
      onClose();
    } catch (error) {
      console.error(`Error opening ${action}:`, error);
      Alert.alert("Unable to continue", unavailableMessage);
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = () => {
    if (!email) {
      Alert.alert("Unavailable", "No email address is available.");
      return;
    }

    const url = `mailto:${email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(message)}`;

    return openContactApp("email", url, "The email app could not be opened.");
  };

  const handleCall = () => {
    if (!phone) {
      Alert.alert("Unavailable", "No phone number is available.");
      return;
    }

    return openContactApp(
      "call",
      `tel:${phone}`,
      "The phone app could not be opened.",
    );
  };

  const handleSms = () => {
    if (!phone) {
      Alert.alert("Unavailable", "No phone number is available.");
      return;
    }

    const separator = Platform.OS === "ios" ? "&" : "?";
    const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;

    return openContactApp(
      "sms",
      url,
      "The messaging app could not be opened.",
    );
  };

  const getAvatarImage = () => {
    if (avatar?.startsWith("http")) return { uri: avatar };
    return getAvatarSource(avatar || "human-1");
  };

  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const ContactButton = ({
    action,
    title,
    value,
    icon,
    color,
    onPress,
  }: {
    action: ContactAction;
    title: string;
    value?: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    color: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading !== null}
      className="flex-row items-center p-4 rounded-xl mb-3"
      style={{
        backgroundColor: theme.background,
        borderWidth: 1,
        borderColor: `${theme.muted}20`,
        opacity: loading && loading !== action ? 0.45 : 1,
      }}
    >
      <View
        className="w-10 h-10 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: `${color}18` }}
      >
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-rubik-bold" style={{ color }}>
          {title}
        </Text>
        {value && (
          <Text
            className="text-xs mt-0.5"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
      {loading === action ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Ionicons name="arrow-forward" size={20} color={color} />
      )}
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-center items-center bg-black/50 px-5">
        <View
          className="w-full max-w-sm rounded-2xl overflow-hidden"
          style={{ backgroundColor: theme.surface }}
        >
          <View
            className="p-5 items-center border-b"
            style={{ borderBottomColor: `${theme.muted}20` }}
          >
            <View className="w-16 h-16 rounded-full overflow-hidden mb-3">
              {avatar ? (
                <Image
                  source={getAvatarImage()}
                  className="w-full h-full"
                  resizeMode="cover"
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
                    {initials}
                  </Text>
                </View>
              )}
            </View>

            <Text
              className="text-xl font-rubik-bold text-center"
              style={{ color: theme.title }}
            >
              {name}
            </Text>
            <Text className="text-sm mt-1" style={{ color: theme.muted }}>
              Choose how you want to make contact
            </Text>
          </View>

          <View className="p-5">
            {phone && (
              <>
                <ContactButton
                  action="call"
                  title="Call"
                  value={phone}
                  icon="call-outline"
                  color="#10B981"
                  onPress={handleCall}
                />
                <ContactButton
                  action="sms"
                  title="Send SMS"
                  value={phone}
                  icon="chatbubble-outline"
                  color="#3B82F6"
                  onPress={handleSms}
                />
              </>
            )}

            {email && (
              <ContactButton
                action="email"
                title="Send Email"
                value={email}
                icon="mail-outline"
                color="#F59E0B"
                onPress={handleEmail}
              />
            )}

            {!phone && !email && (
              <View className="py-5 items-center">
                <Ionicons
                  name="information-circle-outline"
                  size={28}
                  color={theme.muted}
                />
                <Text className="mt-2 text-sm" style={{ color: theme.muted }}>
                  No contact details are available.
                </Text>
              </View>
            )}

            <TouchableOpacity
              onPress={onClose}
              className="mt-1 py-3 rounded-xl"
              style={{ backgroundColor: `${theme.muted}20` }}
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
