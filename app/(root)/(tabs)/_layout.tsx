import { client, config } from "@/lib/appwrite";
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import {
  Image,
  ImageSourcePropType,
  LogBox,
  Text,
  View,
  useColorScheme,
} from "react-native";

import icons from "@/constants/icons";
import useAuthStore from "@/store/auth.store";
import { useMatchStore } from "@/store/match.store";
import { Colors } from "../../../constants/Colors";

LogBox.ignoreLogs([
  "JSON Parse error",
  "Error parsing reviews",
  "Setting a timer",
  "JSON Parse error: Unexpected character: G",
  "Error fetchingagent",
  "Error checking like status",
]);

if (!__DEV__) {
  LogBox.ignoreAllLogs();
}

const TabIcon = ({
  focused,
  icon,
  title,
  badgeCount,
}: {
  focused: boolean;
  icon: ImageSourcePropType;
  title: string;
  badgeCount?: number;
}) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <View className="flex-1 mt-2 flex flex-col items-center relative">
      <Image
        source={icon}
        tintColor={focused ? theme.primary[300] : theme.muted}
        resizeMode="contain"
        className="size-6"
      />
      <Text
        className={`text-xs w-full text-center mt-0 ${
          focused ? "font-rubik-medium" : "font-rubik"
        }`}
        style={{ color: focused ? theme.primary[300] : theme.text }}
      >
        {title}
      </Text>

      {badgeCount !== undefined && badgeCount > 0 && (
        <View className="absolute -top-1 -right-2 bg-red-500 rounded-full min-w-[18px] h-[18px] px-1 items-center justify-center">
          <Text className="text-white text-xs font-bold">
            {badgeCount > 99 ? "99+" : badgeCount}
          </Text>
        </View>
      )}
    </View>
  );
};

const TabsLayout = () => {
  const { user } = useAuthStore();
  // ✅ Removed markMatchesAsViewed since it's unused here
  const { matchCount, fetchMatchCount } = useMatchStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // ✅ Merged into one effect, added fetchMatchCount to deps
  useEffect(() => {
    if (!user?.accountId) return;

    fetchMatchCount(user.accountId);

    const unsubscribe = client.subscribe(
      `databases.${config.databaseId}.collections.${config.matchProfilesCollectionId}.documents`,
      (response) => {
        if (
          response.events.includes(
            "databases.*.collections.*.documents.*.create",
          ) ||
          response.events.includes(
            "databases.*.collections.*.documents.*.update",
          )
        ) {
          fetchMatchCount(user.accountId);
        }
      },
    );

    return () => unsubscribe();
  }, [user?.accountId, fetchMatchCount]); // ✅ fetchMatchCount added to deps

  // Keep focus effect for when user navigates back to tab layout
  useFocusEffect(
    useCallback(() => {
      if (user?.accountId) {
        fetchMatchCount(user.accountId);
      }
    }, [user?.accountId, fetchMatchCount]),
  );

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.navBackground },
        headerTintColor: theme.title,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: theme.navBackground,
          position: "absolute",
          borderTopColor: "#0061FF1A",
          borderTopWidth: 2,
          minHeight: 80,
          paddingTop: 0,
          paddingBottom: 10,
        },
      }}
    >
      <Tabs.Screen
        name="tenantHome"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Home" />
          ),
        }}
      />

      <Tabs.Screen
        name="help"
        options={{
          href: null,
          title: "help",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="detailsEdit"
        options={{
          href: null,
          title: "detailsEdit",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="calendar"
        options={{
          href: null,
          title: "calendar",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="about"
        options={{
          href: null,
          title: "about",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="language"
        options={{
          href: null,
          title: "language",
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="all-locations"
        options={{
          href: null,
          title: "all-locations",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "notifications",
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="properties-by-location"
        options={{
          href: null,
          title: "properties-by-location",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="trending-properties"
        options={{
          href: null,
          title: "trending-properties",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="filtered-properties"
        options={{
          href: null,
          title: "filtered-properties",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: "settings",
          headerShown: false,
        }}
      />

      <Tabs.Screen
        name="my-favorites"
        options={{
          href: null,
          title: "my-favorites",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="message"
        options={{
          href: null,
          title: "message",
          headerShown: false,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.person} title="Profile" />
          ),
        }}
      />

      <Tabs.Screen
        name="myRequests"
        options={{
          title: "Requests",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={icons.request}
              title="Requests"
            />
          ),
        }}
      />

      <Tabs.Screen
        name="match"
        options={{
          title: "Match",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={icons.send}
              title="Match"
              badgeCount={matchCount}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: "Explore",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.search} title="Explore" />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
