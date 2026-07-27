// app/(auth)/tenant-type-setup.tsx
import CustomInput from "@/components/CustomInput";
import ErrorModal from "@/components/ErrorModal";
import OperationSuccesfull from "@/components/OperationSuccesfull";
import { Colors } from "@/constants/Colors";
import {
  TenantType,
  getTenantType,
  getUserHomeRoute,
  isLandlordUser,
} from "@/lib/userMode";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface TenantOption {
  value: TenantType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TENANT_OPTIONS: TenantOption[] = [
  {
    value: "student",
    title: "Student",
    description: "Housing near your school, campus-friendly listings and sharing.",
    icon: "school-outline",
  },
  {
    value: "family",
    title: "Family",
    description: "More space, family-friendly facilities, safety and neighbourhoods.",
    icon: "people-outline",
  },
  {
    value: "single",
    title: "Single person",
    description: "Studios, rooms and affordable places suited to one person.",
    icon: "person-outline",
  },
];

export default function TenantTypeSetup() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { user, isAuthenticated, isLoading, updateUser } = useAuthStore();

  const existingTenantType = useMemo(() => getTenantType(user), [user]);
  const [tenantType, setTenantType] = useState<TenantType | null>(
    existingTenantType,
  );
  const [schoolLocation, setSchoolLocation] = useState(
    user?.schoolLocation ?? "",
  );
  const [saving, setSaving] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      router.replace("/sign-in");
      return;
    }

    if (isLandlordUser(user)) {
      router.replace("/landHome");
    }
  }, [isAuthenticated, isLoading, user]);

  const saveTenantType = async () => {
    if (!tenantType) {
      setErrorMessage("Choose the type of tenant that best describes you.");
      setErrorVisible(true);
      return;
    }

    if (tenantType === "student" && !schoolLocation.trim()) {
      setErrorMessage("Enter your school or university location.");
      setErrorVisible(true);
      return;
    }

    setSaving(true);

    try {
      const updates: Record<string, unknown> = {
        // This also migrates legacy userMode === "student" accounts.
        userMode: "tenant",
        tenantType,
      };

      if (tenantType === "student") {
        updates.schoolLocation = schoolLocation.trim().toLowerCase();
      }

      const result = await updateUser(updates as any);

      if (!result.success) {
        throw new Error(result.error || "Could not save your tenant type.");
      }

      setSuccessVisible(true);

      setTimeout(() => {
        const updatedUser = {
          ...user,
          ...updates,
        };
        router.replace(getUserHomeRoute(updatedUser as any) as any);
      }, 700);
    } catch (error: any) {
      setErrorMessage(
        error?.message || "Could not save your tenant type. Please try again.",
      );
      setErrorVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <StatusBar
        barStyle={colorScheme === "dark" ? "light-content" : "dark-content"}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 44 }}
      >
        <View className="mt-3 mb-8">
          <View
            className="w-14 h-14 rounded-2xl items-center justify-center mb-5"
            style={{ backgroundColor: `${theme.primary[300]}18` }}
          >
            <Ionicons
              name="options-outline"
              size={28}
              color={theme.primary[300]}
            />
          </View>

          <Text
            className="text-3xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Personalise your Nookly
          </Text>
          <Text
            className="text-base mt-3 leading-6"
            style={{ color: theme.muted }}
          >
            Tell us what kind of tenant you are. We will use this to tailor your
            feed, filters and recommendations.
          </Text>
        </View>

        <Text
          className="text-sm font-rubik-medium mb-3"
          style={{ color: theme.text }}
        >
          I am looking as a:
        </Text>

        <View className="gap-3">
          {TENANT_OPTIONS.map((option) => {
            const selected = tenantType === option.value;

            return (
              <TouchableOpacity
                key={option.value}
                activeOpacity={0.85}
                onPress={() => {
                  setTenantType(option.value);
                  if (option.value !== "student") {
                    setSchoolLocation("");
                  }
                }}
                className="rounded-2xl p-4 flex-row items-center"
                style={{
                  backgroundColor: selected
                    ? `${theme.primary[300]}12`
                    : theme.surface,
                  borderWidth: 1.5,
                  borderColor: selected
                    ? theme.primary[300]
                    : `${theme.muted}28`,
                }}
              >
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                  style={{
                    backgroundColor: selected
                      ? theme.primary[300]
                      : `${theme.primary[300]}12`,
                  }}
                >
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={selected ? "#FFFFFF" : theme.primary[300]}
                  />
                </View>

                <View className="flex-1">
                  <Text
                    className="text-base font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    className="text-sm mt-1 leading-5"
                    style={{ color: theme.muted }}
                  >
                    {option.description}
                  </Text>
                </View>

                <Ionicons
                  name={selected ? "checkmark-circle" : "ellipse-outline"}
                  size={24}
                  color={selected ? theme.primary[300] : theme.muted}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {tenantType === "student" && (
          <View className="mt-5">
            <CustomInput
              label="School or university location"
              value={schoolLocation}
              onChangeText={setSchoolLocation}
              placeholder="e.g. Bindura University"
              autoCapitalize="words"
            />
          </View>
        )}

        <View
          className="rounded-2xl p-4 mt-6 flex-row items-start"
          style={{ backgroundColor: `${theme.primary[300]}0D` }}
        >
          <Ionicons
            name="sparkles-outline"
            size={20}
            color={theme.primary[300]}
          />
          <Text
            className="text-sm leading-5 ml-3 flex-1"
            style={{ color: theme.text }}
          >
            You can change this later from your profile. Your choice is stored
            in your Nookly account and remains available on another device.
          </Text>
        </View>

        <TouchableOpacity
          onPress={saveTenantType}
          disabled={saving}
          activeOpacity={0.85}
          className="rounded-2xl py-4 mt-8 items-center justify-center"
          style={{
            backgroundColor: saving ? theme.muted : theme.primary[300],
          }}
        >
          {saving ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text className="text-white font-rubik-bold ml-2">
                Saving...
              </Text>
            </View>
          ) : (
            <Text className="text-white text-base font-rubik-bold">
              Continue
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <OperationSuccesfull
        visible={successVisible}
        onClose={() => setSuccessVisible(false)}
        title="Preferences saved"
        message="Your Nookly experience is now personalised."
      />

      <ErrorModal
        visible={errorVisible}
        onClose={() => setErrorVisible(false)}
        title="Could not save"
        message={errorMessage}
      />
    </SafeAreaView>
  );
}
