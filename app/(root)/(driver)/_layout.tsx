import { Colors } from "@/constants/Colors";
import { getUserHomeRoute, isDriverUser } from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Text,
  View,
  useColorScheme,
} from "react-native";

const DriverTabIcon = ({
  focused,
  icon,
  title,
}: {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const color = focused ? theme.primary[300] : theme.muted;

  return (
    <View className="mt-2 flex-1 items-center">
      <Ionicons name={icon} size={23} color={color} />
      <Text
        className={`mt-0.5 text-[11px] ${
          focused ? "font-rubik-medium" : "font-rubik"
        }`}
        style={{ color }}
      >
        {title}
      </Text>
    </View>
  );
};

export default function DriverTabsLayout() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { user, isHydrated, isInitialized, isLoading } = useAuthStore();

  if (!isHydrated || !isInitialized || isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!isDriverUser(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.navBackground,
          borderTopColor: `${theme.primary[300]}20`,
          borderTopWidth: 1,
          minHeight: 78,
          paddingBottom: 10,
          paddingTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="driver-home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon focused={focused} icon="home-outline" title="Home" />
          ),
        }}
      />

      <Tabs.Screen
        name="driver-rides"
        options={{
          title: "Rides",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon focused={focused} icon="bus-outline" title="Rides" />
          ),
        }}
      />

      <Tabs.Screen
        name="driver-active"
        options={{
          title: "Active",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon
              focused={focused}
              icon="navigate-circle-outline"
              title="Active"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="driver-profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon
              focused={focused}
              icon="person-outline"
              title="Profile"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="driver-ride-details"
        options={{
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
