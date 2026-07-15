// app/(root)/settings.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface SettingItem {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
  rightElement?: React.ReactNode;
  danger?: boolean;
}

export default function SettingsScreen() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, loadNotifications, clearAll } =
    useNotificationStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);

  const [clearDataLoading, setClearDataLoading] = useState(false);

  // Load saved preferences
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const push = await AsyncStorage.getItem("push_notifications");
      const email = await AsyncStorage.getItem("email_notifications");


      if (push !== null) setPushEnabled(push === "true");
      if (email !== null) setEmailEnabled(email === "true");

    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSetting = async (key: string, value: boolean) => {
    try {
      await AsyncStorage.setItem(key, value.toString());
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  };

  const handlePushToggle = async (value: boolean) => {
    setPushEnabled(value);
    await saveSetting("push_notifications", value);
    // Here you would also update your push notification service
    Alert.alert(
      "Notifications",
      value ? "Push notifications enabled" : "Push notifications disabled",
    );
  };

  const handleEmailToggle = async (value: boolean) => {
    setEmailEnabled(value);
    await saveSetting("email_notifications", value);
  };

  const handleClearAllData = async () => {
    Alert.alert(
      "Clear All Data",
      "This will delete all your app data including notifications, cached properties, and preferences. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All Data",
          style: "destructive",
          onPress: async () => {
            setClearDataLoading(true);
            try {
              // Clear notifications
              if (user?.accountId) {
                await clearAll(user.accountId);
              }

              // Clear cached properties
              await AsyncStorage.multiRemove([
                "cached_latest_properties",
                "cached_available_properties",
                "cached_properties_by_creator",
              ]);

              // Clear user preferences
              await AsyncStorage.multiRemove([
                "push_notifications",
                "email_notifications",
              ]);

              // Clear avatar cache
              await AsyncStorage.removeItem("saved_avatar");

              Alert.alert("Success", "All app data has been cleared");
            } catch (error) {
              console.error("Error clearing data:", error);
              Alert.alert("Error", "Failed to clear data");
            } finally {
              setClearDataLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleExportData = async () => {
    Alert.alert(
      "Export Data",
      "Your data will be exported and saved to your device",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: async () => {
            try {
              const userData = {
                user: user,
                preferences: {
                  pushNotifications: pushEnabled,
                  emailNotifications: emailEnabled,
                },
                notificationsCount: notifications.length,
                exportDate: new Date().toISOString(),
              };

              // In a real app, you'd save this to a file
              await AsyncStorage.setItem(
                "exported_data",
                JSON.stringify(userData),
              );

              Alert.alert(
                "Export Complete",
                "Your data has been exported successfully",
              );
            } catch (error) {
              console.error("Export error:", error);
              Alert.alert("Error", "Failed to export data");
            }
          },
        },
      ],
    );
  };

  const settingsSections = [
    {
      title: "Account",
      items: [
        {
          icon: icons.person,
          title: "Profile Information",
          subtitle: user?.name || "Not set",
          onPress: () => {
            if (user?.userMode === "landlord") {
              router.push("/landProfile");
            } else {
              router.push("/profile");
            }
          },
        },
        {
          icon: icons.mail,
          title: "Edit my info.",
          subtitle: user?.email || "Not set",
          onPress: () => router.push("/myDetailsEdit"),
        },
      ] as SettingItem[],
    },
    {
      title: "Notifications",
      items: [
        {
          icon: icons.bell,
          title: "Push Notifications",
          subtitle: "Receive real-time updates",
          onPress: () => {},
          rightElement: (
            <Switch
              value={pushEnabled}
              onValueChange={handlePushToggle}
              trackColor={{ false: "#767577", true: theme.primary[300] }}
            />
          ),
        },
        {
          icon: icons.mail,
          title: "Email Notifications",
          subtitle: "Get email updates",
          onPress: () => {},
          rightElement: (
            <Switch
              value={emailEnabled}
              onValueChange={handleEmailToggle}
              trackColor={{ false: "#767577", true: theme.primary[300] }}
            />
          ),
        },
        {
          icon: icons.eye,
          title: "View All Notifications",
          subtitle: `${unreadCount} unread`,
          onPress: () => router.push("/landNotifications"),
        },
      ] as SettingItem[],
    },

    {
      title: "Privacy & Security",
      items: [
        {
          icon: icons.eye,
          title: "Privacy Policy",
          subtitle: "Read our privacy policy",
          onPress: () => router.push("/landAbout"),
        },
      ] as SettingItem[],
    },
    {
      title: "Data & Storage",
      items: [
        {
          icon: icons.download,
          title: "Export Data",
          subtitle: "Download your data",
          onPress: handleExportData,
        },
        {
          icon: icons.trash,
          title: "Clear All Data",
          subtitle: "Delete all app data",
          onPress: handleClearAllData,
          danger: true,
        },
      ] as SettingItem[],
    },
    {
      title: "Support",
      items: [
        {
          icon: icons.chat,
          title: "Help & Support",
          subtitle: "Get help with the app",
          onPress: () => router.push("/landHelp"),
        },
        {
          icon: icons.info,
          title: "About",
          subtitle: "App information and credits",
          onPress: () => router.push("/landAbout"),
        },
        {
          icon: icons.star,
          title: "Rate the App",
          subtitle: "Leave a review",
          onPress: () => {
            // In a real app, you'd link to App Store/Play Store
            Alert.alert("Rate App", "Would you like to rate this app?", [
              { text: "Not Now", style: "cancel" },
              { text: "Rate", onPress: () => console.log("Rate app") },
            ]);
          },
        },
      ] as SettingItem[],
    },
  ];

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-4" style={{ color: theme.muted }}>
          Logging out...
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity
          onPress={() => {
            router.back();
          }}
          className="mr-4 p-2"
        >
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          Settings
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* User Profile Card */}
        <View
          className="mx-5 mt-4 p-4 rounded-2xl mb-4"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.muted + "30",
          }}
        >
          <View className="flex-row items-center">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: theme.primary[100] }}
            >
              {user?.avatar ? (
                <Image
                  source={{ uri: user.avatar }}
                  className="w-14 h-14 rounded-full"
                />
              ) : (
                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              )}
            </View>
            <View className="ml-4 flex-1">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.text }}
              >
                {user?.name || "User"}
              </Text>
              <Text className="text-sm" style={{ color: theme.muted }}>
                {user?.email || "No email"}
              </Text>
              <Text
                className="text-xs mt-1 capitalize"
                style={{ color: theme.primary[300] }}
              >
                {user?.userMode || "Tenant"} Account
              </Text>
            </View>
          </View>
        </View>

        {/* Settings Sections */}
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} className="mb-6">
            <Text
              className="text-sm font-rubik-medium uppercase px-5 mb-2"
              style={{ color: theme.muted }}
            >
              {section.title}
            </Text>
            <View
              className="mx-5 rounded-2xl overflow-hidden"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  onPress={item.onPress}
                  className={`flex-row items-center px-4 py-3 ${
                    itemIndex !== section.items.length - 1 ? "border-b" : ""
                  }`}
                  style={{
                    borderBottomColor: theme.muted + "20",
                    opacity: item.danger ? 0.9 : 1,
                  }}
                >
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: item.danger
                        ? theme.danger + "20"
                        : theme.primary[100],
                    }}
                  >
                    <Image
                      source={item.icon}
                      className="w-5 h-5"
                      style={{
                        tintColor: item.danger
                          ? theme.danger
                          : theme.primary[300],
                      }}
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-rubik-medium"
                      style={{
                        color: item.danger ? theme.danger : theme.text,
                      }}
                    >
                      {item.title}
                    </Text>
                    {item.subtitle && (
                      <Text
                        className="text-xs mt-0.5"
                        style={{ color: theme.muted }}
                      >
                        {item.subtitle}
                      </Text>
                    )}
                  </View>
                  {item.rightElement || (
                    <Image
                      source={icons.rightArrow}
                      className="w-5 h-5"
                      style={{ tintColor: theme.muted }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View className="px-5 mt-4 mb-8">
          <Text
            className="text-center text-xs mt-4"
            style={{ color: theme.muted }}
          >
            App Version 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Clear Data Loading Overlay */}
      {clearDataLoading && (
        <View
          className="absolute inset-0 justify-center items-center"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <View
            className="p-6 rounded-2xl items-center"
            style={{ backgroundColor: theme.background }}
          >
            <ActivityIndicator size="large" color={theme.primary[300]} />
            <Text
              className="mt-4 font-rubik-medium"
              style={{ color: theme.text }}
            >
              Clearing data...
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}
