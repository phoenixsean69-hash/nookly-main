import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Alert,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

type EmergencyContact = {
  name: string;
  description: string;
  phone?: string;
  email?: string;
};

const BUSE_CONTACTS: EmergencyContact[] = [
  {
    name: "Campus Clinic",
    description: "Student health and emergency medical support",
    phone: "+263662107309",
    email: "info@buse.ac.zw",
  },
  {
    name: "Dean of Students",
    description: "Student welfare, accommodation and urgent support",
    phone: "+263662107618",
    email: "info@buse.ac.zw",
  },
  {
    name: "Off-Campus Life",
    description: "Off-campus accommodation and student safety support",
    phone: "+263772898387",
    email: "wbarure@buse.ac.zw",
  },
  {
    name: "University Switchboard",
    description: "General university assistance and call routing",
    phone: "+263719528691",
    email: "info@buse.ac.zw",
  },
];

const openExternalApp = async (
  url: string,
  fallbackMessage: string,
): Promise<void> => {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert("Unavailable", fallbackMessage);
      return;
    }
    await Linking.openURL(url);
  } catch (error) {
    console.error("Could not open contact app:", error);
    Alert.alert("Unable to continue", fallbackMessage);
  }
};

const StudentEmergencyPanel = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const call = (phone: string) =>
    openExternalApp(`tel:${phone}`, "The phone app could not be opened.");

  const sms = (phone: string, contactName: string) => {
    const body = encodeURIComponent(
      `Hello ${contactName}, I am a BUSE student and I need assistance.`,
    );
    const separator = Platform.OS === "ios" ? "&" : "?";
    return openExternalApp(
      `sms:${phone}${separator}body=${body}`,
      "The messaging app could not be opened.",
    );
  };

  const email = (address: string, contactName: string) => {
    const subject = encodeURIComponent(`Student assistance: ${contactName}`);
    const body = encodeURIComponent(
      "Hello,\n\nI am a BUSE student and I need assistance.\n\n",
    );
    return openExternalApp(
      `mailto:${address}?subject=${subject}&body=${body}`,
      "The email app could not be opened.",
    );
  };

  return (
    <View
      className="rounded-2xl p-4 mb-6"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: "#EF444440",
      }}
    >
      <View className="flex-row items-center mb-1">
        <View className="w-10 h-10 rounded-full bg-red-100 items-center justify-center mr-3">
          <Ionicons name="alert-circle" size={23} color="#EF4444" />
        </View>
        <View className="flex-1">
          <Text
            className="text-lg font-rubik-bold"
            style={{ color: theme.title }}
          >
            Emergency & School Contacts
          </Text>
          <Text className="text-xs" style={{ color: theme.muted }}>
            BUSE pilot contacts — call, text or email directly
          </Text>
        </View>
      </View>

      {BUSE_CONTACTS.map((contact) => (
        <View
          key={contact.name}
          className="mt-3 rounded-xl p-3"
          style={{
            backgroundColor: theme.background,
            borderWidth: 1,
            borderColor: `${theme.muted}25`,
          }}
        >
          <Text className="font-rubik-bold" style={{ color: theme.text }}>
            {contact.name}
          </Text>
          <Text className="text-xs mt-1" style={{ color: theme.muted }}>
            {contact.description}
          </Text>

          <View className="flex-row gap-2 mt-3">
            {contact.phone && (
              <>
                <TouchableOpacity
                  onPress={() => call(contact.phone!)}
                  className="flex-1 py-2 rounded-lg flex-row items-center justify-center"
                  style={{ backgroundColor: "#10B98120" }}
                >
                  <Ionicons name="call-outline" size={16} color="#10B981" />
                  <Text className="ml-1 text-xs font-rubik-medium text-blue-700">
                    Call
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => sms(contact.phone!, contact.name)}
                  className="flex-1 py-2 rounded-lg flex-row items-center justify-center"
                  style={{ backgroundColor: "#3B82F620" }}
                >
                  <Ionicons
                    name="chatbubble-outline"
                    size={16}
                    color="#3B82F6"
                  />
                  <Text className="ml-1 text-xs font-rubik-medium text-blue-600">
                    SMS
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {contact.email && (
              <TouchableOpacity
                onPress={() => email(contact.email!, contact.name)}
                className="flex-1 py-2 rounded-lg flex-row items-center justify-center"
                style={{ backgroundColor: "#F59E0B20" }}
              >
                <Ionicons name="mail-outline" size={16} color="#F59E0B" />
                <Text className="ml-1 text-xs font-rubik-medium text-amber-600">
                  Email
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

export default StudentEmergencyPanel;
