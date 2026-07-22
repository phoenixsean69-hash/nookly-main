import { Colors } from "@/constants/Colors";
import { titleCaseStudentText } from "@/lib/studentHousing";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import {
  ActivityIndicator,
  Text,
  useColorScheme,
  View,
} from "react-native";

type Props = {
  user?: {
    name?: string;
    email?: string;
    phone?: string;
    avatar?: string;
    schoolLocation?: string;
  } | null;
  favorites: number;
  applications: number;
  viewed: number;
  loading?: boolean;
};

const StudentProfileHighlights = ({
  user,
  favorites,
  applications,
  viewed,
  loading = false,
}: Props) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const completion = useMemo(() => {
    const fields = [
      user?.name,
      user?.email,
      user?.phone,
      user?.avatar,
      user?.schoolLocation,
    ];
    return Math.round(
      (fields.filter((value) => String(value ?? "").trim().length > 0).length /
        fields.length) *
        100,
    );
  }, [user]);

  return (
    <>
      <View
        className="rounded-2xl p-4 mb-6"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: `${theme.primary[300]}35`,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="w-11 h-11 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: `${theme.primary[300]}18` }}
          >
            <Ionicons
              name="school-outline"
              size={23}
              color={theme.primary[300]}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs" style={{ color: theme.muted }}>
              My school location
            </Text>
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              {user?.schoolLocation
                ? titleCaseStudentText(user.schoolLocation)
                : "Not set"}
            </Text>
          </View>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: `${theme.primary[300]}15` }}
          >
            <Text
              className="text-xs font-rubik-medium"
              style={{ color: theme.primary[300] }}
            >
              Student
            </Text>
          </View>
        </View>

        <Text className="text-xs mt-3" style={{ color: theme.muted }}>
          Nookly uses this location to show nearby Boarding Houses, Houses,
          Studios and Luxury properties.
        </Text>
      </View>

      <View
        className="rounded-2xl p-4 mb-6"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: `${theme.muted}25`,
        }}
      >
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-lg font-rubik-bold"
            style={{ color: theme.title }}
          >
            Student Housing Journey
          </Text>
          <Text
            className="text-xs font-rubik-medium"
            style={{ color: theme.primary[300] }}
          >
            {completion}% profile
          </Text>
        </View>

        <View
          className="h-2 rounded-full overflow-hidden mb-4"
          style={{ backgroundColor: `${theme.muted}20` }}
        >
          <View
            className="h-2 rounded-full"
            style={{
              width: `${completion}%`,
              backgroundColor: theme.primary[300],
            }}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="small" color={theme.primary[300]} />
        ) : (
          <View className="flex-row">
            {[
              { label: "Saved", value: favorites, icon: "heart-outline" as const },
              { label: "Applied", value: applications, icon: "document-text-outline" as const },
              { label: "Viewed", value: viewed, icon: "eye-outline" as const },
            ].map((item) => (
              <View key={item.label} className="flex-1 items-center">
                <Ionicons
                  name={item.icon}
                  size={19}
                  color={theme.primary[300]}
                />
                <Text
                  className="text-xl font-rubik-bold mt-1"
                  style={{ color: theme.title }}
                >
                  {item.value}
                </Text>
                <Text className="text-xs" style={{ color: theme.muted }}>
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );
};

export default StudentProfileHighlights;
