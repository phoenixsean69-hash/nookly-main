import { Colors } from "@/constants/Colors";
import { getDriverDashboard } from "@/services/driver.service";
import useAuthStore from "@/store/auth.store";
import type { DriverDashboard } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { user, signOut } = useAuthStore();
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        setLoading(true);

        try {
          const result = await getDriverDashboard();
          if (active) setDashboard(result);
        } catch (caughtError) {
          console.warn("Could not load driver profile:", caughtError);
        } finally {
          if (active) setLoading(false);
        }
      };

      void load();

      return () => {
        active = false;
      };
    }, []),
  );

  const handleSignOut = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert("Sign out", "Sign out of the driver account?", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]);
    });

    if (!confirmed) return;

    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);

    if (result.success) {
      router.replace("/sign-in");
    } else {
      Alert.alert("Sign out failed", result.error || "Please try again.");
    }
  };

  const profile = dashboard?.profile;
  const vehicle = dashboard?.vehicles[0];

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Driver profile
        </Text>

        <View
          className="mt-6 items-center rounded-2xl border p-6"
          style={{
            backgroundColor: theme.surface,
            borderColor: `${theme.muted}25`,
          }}
        >
          {profile?.avatar || user?.avatar ? (
            <Image
              source={{ uri: profile?.avatar || user?.avatar }}
              className="h-24 w-24 rounded-full"
            />
          ) : (
            <View
              className="h-24 w-24 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primary[300]}18` }}
            >
              <Ionicons
                name="person"
                size={42}
                color={theme.primary[300]}
              />
            </View>
          )}

          <Text
            className="mt-4 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {profile?.name || user?.name || "Driver"}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
            {profile?.email || user?.email}
          </Text>

          <View
            className="mt-4 rounded-full px-4 py-1.5"
            style={{
              backgroundColor:
                profile?.verificationStatus === "verified"
                  ? "#16A34A18"
                  : "#D9770618",
            }}
          >
            <Text
              className="text-xs font-rubik-bold capitalize"
              style={{
                color:
                  profile?.verificationStatus === "verified"
                    ? "#16A34A"
                    : "#D97706",
              }}
            >
              {profile?.verificationStatus || "Loading"} driver
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator
            className="mt-7"
            color={theme.primary[300]}
          />
        ) : (
          <>
            <View
              className="mt-5 rounded-2xl border p-5"
              style={{
                backgroundColor: theme.surface,
                borderColor: `${theme.muted}25`,
              }}
            >
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                Licence information
              </Text>

              <View className="mt-4 gap-3">
                <View className="flex-row justify-between">
                  <Text style={{ color: theme.muted }}>Licence number</Text>
                  <Text
                    className="font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {profile?.licenceNumber || "Not available"}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text style={{ color: theme.muted }}>Completed trips</Text>
                  <Text
                    className="font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {profile?.completedTrips ?? 0}
                  </Text>
                </View>
                <View className="flex-row justify-between">
                  <Text style={{ color: theme.muted }}>Rating</Text>
                  <Text
                    className="font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {profile?.rating?.toFixed(1) || "0.0"}
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="mt-5 rounded-2xl border p-5"
              style={{
                backgroundColor: theme.surface,
                borderColor: `${theme.muted}25`,
              }}
            >
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                Assigned vehicle
              </Text>

              {vehicle ? (
                <View className="mt-4">
                  <Text
                    className="text-base font-rubik-bold"
                    style={{ color: theme.text }}
                  >
                    {vehicle.color} {vehicle.make} {vehicle.model}
                  </Text>
                  <Text className="mt-1" style={{ color: theme.muted }}>
                    {vehicle.registrationNumber} · {vehicle.capacity} seats
                  </Text>
                </View>
              ) : (
                <Text className="mt-3 text-sm" style={{ color: theme.muted }}>
                  No vehicle is currently assigned.
                </Text>
              )}
            </View>
          </>
        )}

        <TouchableOpacity
          onPress={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-7 rounded-2xl border py-4"
          style={{
            borderColor: theme.danger,
            backgroundColor: `${theme.danger}08`,
          }}
        >
          {signingOut ? (
            <ActivityIndicator color={theme.danger} />
          ) : (
            <Text
              className="text-center font-rubik-bold"
              style={{ color: theme.danger }}
            >
              Sign out
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
