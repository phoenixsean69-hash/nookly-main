import icons from "@/constants/icons";
import { Colors } from "@/constants/Colors";
import { getUserHomeRoute, isDriverUser } from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Image,
  ImageSourcePropType,
  Platform,
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
  icon: ImageSourcePropType;
  title: string;
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const color = focused ? theme.primary[300] : theme.muted;

  return (
    <View
      className="relative mt-2 flex-1 flex-col items-center"
      style={{
        width: "100%",
        minWidth: 0,
        overflow: "visible",
      }}
    >
      <Image
        source={icon}
        tintColor={color}
        resizeMode="contain"
        className="size-6"
      />

      <Text
        numberOfLines={1}
        ellipsizeMode="clip"
        className={`mt-0 w-full text-center text-xs ${
          focused ? "font-rubik-medium" : "font-rubik"
        }`}
        style={{
          color,
          width: "100%",
          minWidth: 0,
          lineHeight: 16,
          includeFontPadding: true,
          paddingHorizontal: Platform.OS === "android" ? 2 : 0,
        }}
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
        tabBarItemStyle: {
          minWidth: 0,
          paddingHorizontal: 0,
        },
        tabBarStyle: {
          backgroundColor: theme.navBackground,
          position: "absolute",
          borderTopColor: "#0061FF1A",
          borderTopWidth: 2,
          minHeight: 80,
          paddingTop: 0,
          paddingBottom: 10,
          overflow: "visible",
        },
      }}
    >
      <Tabs.Screen
        name="driver-home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon
              focused={focused}
              icon={icons.home}
              title="Home"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="driver-rides"
        options={{
          title: "Rides",
          tabBarIcon: ({ focused }) => (
            <DriverTabIcon
              focused={focused}
              icon={icons.calendar}
              title="Rides"
            />
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
              icon={icons.location}
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
              icon={icons.person}
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
