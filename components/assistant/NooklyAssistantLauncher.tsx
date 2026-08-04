import { Colors } from "@/constants/Colors";
import {
  getPrimaryUserMode,
  getTenantType,
} from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  Pressable,
  Text,
  useColorScheme,
  View,
} from "react-native";

export type NooklyAssistantLauncherVariant =
  | "floating"
  | "card";

export interface NooklyAssistantLauncherProps {
  variant?: NooklyAssistantLauncherVariant;
  bottom?: number;
  right?: number;
}

interface LauncherCopy {
  badge: string;
  title: string;
  description: string;
}

const getLauncherCopy = (
  user: ReturnType<typeof useAuthStore.getState>["user"],
): LauncherCopy => {
  const primaryMode = getPrimaryUserMode(user);
  const tenantType = getTenantType(user);

  if (primaryMode === "landlord") {
    return {
      badge: "Landlord intelligence",
      title: "Ask Nookly Assistant",
      description:
        "Analyse your listings, views, likes and saved requests.",
    };
  }

  switch (tenantType) {
    case "student":
      return {
        badge: "Student housing intelligence",
        title: "Ask Nookly Assistant",
        description:
          "Find suitable housing using your school, budget and saved Nookly data.",
      };

    case "family":
      return {
        badge: "Family housing intelligence",
        title: "Ask Nookly Assistant",
        description:
          "Prioritise bedrooms, space, security and family-friendly features.",
      };

    case "single":
      return {
        badge: "Personal housing intelligence",
        title: "Ask Nookly Assistant",
        description:
          "Find affordable studios, rooms and private options suited to you.",
      };

    default:
      return {
        badge: "Nookly intelligence",
        title: "Ask Nookly Assistant",
        description:
          "Search and compare properties using your saved Nookly data.",
      };
  }
};

const openAssistant = () => {
  router.push("/nookly-assistant" as any);
};

const FloatingLauncher = ({
  bottom,
  right,
  title,
  theme,
}: {
  bottom: number;
  right: number;
  title: string;
  theme: (typeof Colors)["light"];
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    accessibilityHint="Opens Nookly Assistant"
    onPress={openAssistant}
    className="absolute flex-row items-center rounded-full px-4 py-3"
    style={({ pressed }) => ({
      right,
      bottom,
      zIndex: 100,
      elevation: 10,
      opacity: pressed ? 0.88 : 1,
      backgroundColor: theme.primary[300],
      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 5,
      },
      shadowOpacity: 0.22,
      shadowRadius: 8,
    })}
  >
    <View
      className="w-8 h-8 rounded-full items-center justify-center mr-2"
      style={{
        backgroundColor: "rgba(255,255,255,0.20)",
      }}
    >
      <Ionicons
        name="sparkles"
        size={17}
        color="#FFFFFF"
      />
    </View>

    <View>
      <Text className="text-white text-xs font-rubik-medium">
        Ask Nookly
      </Text>

      <Text
        className="text-white text-[10px]"
        style={{
          opacity: 0.82,
        }}
      >
        Smart assistant
      </Text>
    </View>
  </Pressable>
);

const CardLauncher = ({
  copy,
  theme,
}: {
  copy: LauncherCopy;
  theme: (typeof Colors)["light"];
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={copy.title}
    accessibilityHint="Opens Nookly Assistant"
    onPress={openAssistant}
    className="rounded-3xl p-4"
    style={({ pressed }) => ({
      opacity: pressed ? 0.9 : 1,
      backgroundColor: `${theme.primary[300]}10`,
      borderColor: `${theme.primary[300]}32`,
      borderWidth: 1,
    })}
  >
    <View className="flex-row items-center">
      <View
        className="w-12 h-12 rounded-2xl items-center justify-center"
        style={{
          backgroundColor: theme.primary[300],
        }}
      >
        <Ionicons
          name="sparkles"
          size={23}
          color="#FFFFFF"
        />
      </View>

      <View className="flex-1 ml-3">
        <Text
          className="text-[10px] font-rubik-medium uppercase"
          style={{
            color: theme.primary[300],
            letterSpacing: 0.6,
          }}
        >
          {copy.badge}
        </Text>

        <Text
          className="text-base font-rubik-bold mt-0.5"
          style={{
            color: theme.title,
          }}
        >
          {copy.title}
        </Text>
      </View>

      <View
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{
          backgroundColor: `${theme.primary[300]}18`,
        }}
      >
        <Ionicons
          name="arrow-forward"
          size={18}
          color={theme.primary[300]}
        />
      </View>
    </View>

    <Text
      className="text-sm leading-5 mt-3"
      style={{
        color: theme.muted,
      }}
    >
      {copy.description}
    </Text>

    <View className="flex-row items-center mt-3">
      <Ionicons
        name="cloud-offline-outline"
        size={14}
        color={theme.primary[300]}
      />

      <Text
        className="text-xs font-rubik-medium ml-1.5"
        style={{
          color: theme.primary[300],
        }}
      >
        Works with saved Nookly data
      </Text>
    </View>
  </Pressable>
);

const NooklyAssistantLauncher = ({
  variant = "floating",
  bottom = 96,
  right = 18,
}: NooklyAssistantLauncherProps) => {
  const colorScheme = useColorScheme();
  const theme =
    Colors[colorScheme ?? "light"] as
      (typeof Colors)["light"];

  const user = useAuthStore(
    (state) => state.user,
  );

  const copy = useMemo(
    () => getLauncherCopy(user),
    [user],
  );

  if (!user) {
    return null;
  }

  if (variant === "card") {
    return (
      <CardLauncher
        copy={copy}
        theme={theme}
      />
    );
  }

  return (
    <FloatingLauncher
      bottom={bottom}
      right={right}
      title={copy.title}
      theme={theme}
    />
  );
};

export default NooklyAssistantLauncher;