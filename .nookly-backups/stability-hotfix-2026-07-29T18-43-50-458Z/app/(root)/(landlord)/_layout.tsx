import icons from "@/constants/icons";
import { Tabs } from "expo-router";
import {
  Image,
  ImageSourcePropType,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { Colors } from "../../../constants/Colors";

const TabIcon = ({
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

  return (
    <View className="flex-1 mt-2 flex flex-col items-center">
      <Image
        source={icon}
        tintColor={focused ? "#F97316" : theme.muted}
        resizeMode="contain"
        className="size-6"
      />
      <Text
        className={`text-xs w-full text-center mt-0 ${
          focused ? "font-rubik-medium" : "font-rubik"
        }`}
        style={{ color: focused ? "#F97316" : theme.text }}
      >
        {title}
      </Text>
    </View>
  );
};

const TabsLayout = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
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
        name="landHome"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.home} title="Home" />
          ),
        }}
      />

      <Tabs.Screen
        name="myDetailsEdit"
        options={{
          title: "Change Details",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landAbout"
        options={{
          title: "About",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landNotifications"
        options={{
          title: "Change Details",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="addProperty"
        options={{
          title: "Add Property",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landChat"
        options={{
          title: "Profile",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landCalendar"
        options={{
          title: "Profile",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landSettings"
        options={{
          title: "Profile",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landHelp"
        options={{
          title: "Profile",
          headerShown: false,
          href: null,
          tabBarStyle: { display: "none" },
        }}
      />

      <Tabs.Screen
        name="landLordNotifications"
        options={{
          title: "Profile",
          headerShown: false,
          href: null,
        }}
      />

      <Tabs.Screen
        name="landProfile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.person} title="Profile" />
          ),
        }}
      />
      <Tabs.Screen
        name="Landrequests"
        options={{
          title: "Requests",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} icon={icons.inbox} title="Requests" />
          ),
        }}
      />

      <Tabs.Screen
        name="myDashboard"
        options={{
          title: "Dashboard",
          headerShown: false,
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={icons.dashboard}
              title="Dashboard"
            />
          ),
        }}
      />
    </Tabs>
  );
};

export default TabsLayout;
