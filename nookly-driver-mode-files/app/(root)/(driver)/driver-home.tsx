import DriverRideCard from "@/components/driver/DriverRideCard";
import { Colors } from "@/constants/Colors";
import {
  getDriverDashboard,
  updateDriverAvailability,
} from "@/services/driver.service";
import type { DriverDashboard } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverHomeScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      setDashboard(await getDriverDashboard());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load your driver dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const toggleAvailability = async (value: boolean) => {
    if (!dashboard || availabilityLoading) return;

    const previousValue = dashboard.profile.isOnline ?? false;
    setDashboard({
      ...dashboard,
      profile: {
        ...dashboard.profile,
        isOnline: value,
      },
    });
    setAvailabilityLoading(true);

    try {
      await updateDriverAvailability(value);
    } catch (caughtError) {
      setDashboard({
        ...dashboard,
        profile: {
          ...dashboard.profile,
          isOnline: previousValue,
        },
      });
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update availability.",
      );
    } finally {
      setAvailabilityLoading(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-3" style={{ color: theme.muted }}>
          Loading driver dashboard...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDashboard(true)}
          />
        }
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-4">
            <Text className="text-sm" style={{ color: theme.muted }}>
              Driver dashboard
            </Text>
            <Text
              className="mt-1 text-3xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Hello, {dashboard?.profile.name || "Driver"}
            </Text>
          </View>

          <View
            className="h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${theme.primary[300]}18` }}
          >
            <Ionicons
              name="bus-outline"
              size={26}
              color={theme.primary[300]}
            />
          </View>
        </View>

        {error && (
          <TouchableOpacity
            onPress={() => void loadDashboard(true)}
            className="mt-5 flex-row items-center rounded-2xl border p-4"
            style={{
              backgroundColor: `${theme.danger}08`,
              borderColor: `${theme.danger}30`,
            }}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={theme.danger}
            />
            <Text
              className="ml-3 flex-1 text-sm"
              style={{ color: theme.text }}
            >
              {error}
            </Text>
            <Ionicons
              name="refresh"
              size={18}
              color={theme.primary[300]}
            />
          </TouchableOpacity>
        )}

        <View
          className="mt-6 flex-row items-center justify-between rounded-2xl border p-4"
          style={{
            backgroundColor: theme.surface,
            borderColor: `${theme.muted}25`,
          }}
        >
          <View className="flex-1 pr-4">
            <Text
              className="text-base font-rubik-bold"
              style={{ color: theme.title }}
            >
              Available for assignments
            </Text>
            <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
              Turn this on when you are ready to drive.
            </Text>
          </View>
          {availabilityLoading ? (
            <ActivityIndicator color={theme.primary[300]} />
          ) : (
            <Switch
              value={dashboard?.profile.isOnline ?? false}
              onValueChange={(value) => void toggleAvailability(value)}
              trackColor={{
                false: `${theme.muted}50`,
                true: `${theme.primary[300]}70`,
              }}
              thumbColor={
                dashboard?.profile.isOnline
                  ? theme.primary[300]
                  : theme.surface
              }
            />
          )}
        </View>

        <View className="mt-6 flex-row gap-3">
          <View
            className="flex-1 rounded-2xl border p-4"
            style={{
              backgroundColor: theme.surface,
              borderColor: `${theme.muted}25`,
            }}
          >
            <Ionicons
              name="checkmark-done-outline"
              size={22}
              color="#16A34A"
            />
            <Text
              className="mt-3 text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              {dashboard?.completedTrips ?? 0}
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              Completed trips
            </Text>
          </View>

          <View
            className="flex-1 rounded-2xl border p-4"
            style={{
              backgroundColor: theme.surface,
              borderColor: `${theme.muted}25`,
            }}
          >
            <Ionicons
              name="calendar-outline"
              size={22}
              color={theme.primary[300]}
            />
            <Text
              className="mt-3 text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              {dashboard?.upcomingRides.length ?? 0}
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              Upcoming rides
            </Text>
          </View>
        </View>

        <View className="mt-7">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Active assignment
            </Text>
            {dashboard?.activeRide && (
              <TouchableOpacity
                onPress={() => router.push("/driver-active")}
              >
                <Text
                  className="font-rubik-medium"
                  style={{ color: theme.primary[300] }}
                >
                  Open
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {dashboard?.activeRide ? (
            <DriverRideCard
              ride={dashboard.activeRide}
              onPress={() => router.push("/driver-active")}
            />
          ) : (
            <View
              className="items-center rounded-2xl border border-dashed p-7"
              style={{
                backgroundColor: theme.surface,
                borderColor: `${theme.muted}40`,
              }}
            >
              <Ionicons
                name="time-outline"
                size={34}
                color={theme.muted}
              />
              <Text
                className="mt-3 font-rubik-medium"
                style={{ color: theme.title }}
              >
                No active ride
              </Text>
              <Text
                className="mt-1 text-center text-sm"
                style={{ color: theme.muted }}
              >
                Your active assignment will appear here.
              </Text>
            </View>
          )}
        </View>

        <View className="mt-7">
          <View className="mb-3 flex-row items-center justify-between">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Next rides
            </Text>
            <TouchableOpacity onPress={() => router.push("/driver-rides")}>
              <Text
                className="font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                See all
              </Text>
            </TouchableOpacity>
          </View>

          {(dashboard?.upcomingRides ?? []).slice(0, 3).map((ride) => (
            <DriverRideCard
              key={ride.$id}
              ride={ride}
              onPress={() =>
                router.push({
                  pathname: "/driver-ride-details",
                  params: { rideId: ride.$id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
