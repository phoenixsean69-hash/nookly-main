import { Colors } from "@/constants/Colors";
import {
  getDriverDashboard,
  sendDriverLocation,
  updateDriverRideStatus,
} from "@/services/driver.service";
import type { DriverDashboard, DriverRideStatus } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function DriverActiveRideScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [lastLocationAt, setLastLocationAt] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(
    null,
  );

  const loadDashboard = useCallback(async () => {
    setLoading(true);

    try {
      setDashboard(await getDriverDashboard());
    } catch (caughtError) {
      Alert.alert(
        "Could not load ride",
        caughtError instanceof Error
          ? caughtError.message
          : "Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();

      return () => {
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        setSharingLocation(false);
      };
    }, [loadDashboard]),
  );

  const activeRide = dashboard?.activeRide ?? null;

  const changeStatus = async (status: DriverRideStatus) => {
    if (!activeRide || statusLoading) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert(
        "Update ride status",
        `Change this ride to ${status.replace("_", " ")}?`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Continue", onPress: () => resolve(true) },
        ],
      );
    });

    if (!confirmed) return;

    setStatusLoading(true);

    try {
      const updatedRide = await updateDriverRideStatus(activeRide.$id, status);

      setDashboard((current) =>
        current
          ? {
              ...current,
              activeRide: ["completed", "cancelled"].includes(
                updatedRide.status,
              )
                ? null
                : {
                    ...activeRide,
                    ...updatedRide,
                  },
            }
          : current,
      );

      if (["completed", "cancelled"].includes(updatedRide.status)) {
        locationSubscription.current?.remove();
        locationSubscription.current = null;
        setSharingLocation(false);
      }
    } catch (caughtError) {
      Alert.alert(
        "Status update failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Please try again.",
      );
    } finally {
      setStatusLoading(false);
    }
  };

  const startLocationSharing = async () => {
    if (!activeRide || sharingLocation) return;

    const permission = await Location.requestForegroundPermissionsAsync();

    if (permission.status !== "granted") {
      Alert.alert(
        "Location permission required",
        "Nookly needs location access while you are driving so passengers can follow the ride.",
      );
      return;
    }

    setSharingLocation(true);

    try {
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10_000,
          distanceInterval: 10,
        },
        async (position) => {
          try {
            await sendDriverLocation(activeRide.$id, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              heading: position.coords.heading,
              speedKph:
                position.coords.speed !== null && position.coords.speed >= 0
                  ? position.coords.speed * 3.6
                  : null,
              accuracyMeters: position.coords.accuracy,
              isMocked: position.mocked,
            });

            setLastLocationAt(new Date().toISOString());
          } catch (caughtError) {
            console.warn("Could not publish driver location:", caughtError);
          }
        },
      );
    } catch (caughtError) {
      setSharingLocation(false);
      Alert.alert(
        "Location sharing failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Please try again.",
      );
    }
  };

  const stopLocationSharing = () => {
    locationSubscription.current?.remove();
    locationSubscription.current = null;
    setSharingLocation(false);
  };

  if (loading) {
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
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Active ride
        </Text>
        <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
          Control the trip and share the vehicle location.
        </Text>

        {!activeRide ? (
          <View
            className="mt-8 items-center rounded-2xl border border-dashed p-8"
            style={{
              backgroundColor: theme.surface,
              borderColor: `${theme.muted}40`,
            }}
          >
            <Ionicons
              name="navigate-circle-outline"
              size={48}
              color={theme.muted}
            />
            <Text
              className="mt-4 text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              No active assignment
            </Text>
            <Text
              className="mt-1 text-center text-sm"
              style={{ color: theme.muted }}
            >
              Start boarding from an assigned ride when passengers are ready.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/driver-rides")}
              className="mt-5 rounded-full px-5 py-3"
              style={{ backgroundColor: theme.primary[300] }}
            >
              <Text className="font-rubik-bold text-white">
                View assigned rides
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              className="mt-6 rounded-2xl border p-5"
              style={{
                backgroundColor: theme.surface,
                borderColor: `${theme.muted}25`,
              }}
            >
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                {activeRide.route?.name ||
                  `${activeRide.vehicleMake} ${activeRide.vehicleModel}`}
              </Text>
              <Text className="mt-2" style={{ color: theme.muted }}>
                {activeRide.route
                  ? `${activeRide.route.originName} → ${activeRide.route.destinationName}`
                  : activeRide.schoolLocation}
              </Text>

              <View className="mt-5 flex-row justify-between">
                <View>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    Status
                  </Text>
                  <Text
                    className="mt-1 font-rubik-bold capitalize"
                    style={{ color: theme.primary[300] }}
                  >
                    {activeRide.status}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    Passengers
                  </Text>
                  <Text
                    className="mt-1 font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {activeRide.bookedSeats}/{activeRide.totalSeats}
                  </Text>
                </View>
                <View>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    Vehicle
                  </Text>
                  <Text
                    className="mt-1 font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {activeRide.vehicleRegistration}
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="mt-5 rounded-2xl border p-5"
              style={{
                backgroundColor: sharingLocation ? "#ECFDF5" : theme.surface,
                borderColor: sharingLocation ? "#84848240" : `${theme.muted}25`,
              }}
            >
              <View className="flex-row items-center">
                <Ionicons
                  name={
                    sharingLocation
                      ? "navigate-circle"
                      : "navigate-circle-outline"
                  }
                  size={30}
                  color={sharingLocation ? "#848482" : theme.muted}
                />
                <View className="ml-3 flex-1">
                  <Text
                    className="font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Live location
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: theme.muted }}>
                    {sharingLocation
                      ? `Sharing now${
                          lastLocationAt
                            ? ` · updated ${new Date(
                                lastLocationAt,
                              ).toLocaleTimeString()}`
                            : ""
                        }`
                      : "Location sharing is off"}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={
                  sharingLocation
                    ? stopLocationSharing
                    : () => void startLocationSharing()
                }
                className="mt-4 rounded-xl py-3"
                style={{
                  backgroundColor: sharingLocation
                    ? "#DC2626"
                    : theme.primary[300],
                }}
              >
                <Text className="text-center font-rubik-bold text-white">
                  {sharingLocation ? "Stop sharing" : "Start sharing location"}
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              className="mb-3 mt-7 text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Trip controls
            </Text>

            <View className="gap-3">
              {activeRide.status === "scheduled" && (
                <TouchableOpacity
                  onPress={() => void changeStatus("boarding")}
                  disabled={statusLoading}
                  className="rounded-2xl py-4"
                  style={{ backgroundColor: "#D97706" }}
                >
                  <Text className="text-center font-rubik-bold text-white">
                    Start boarding
                  </Text>
                </TouchableOpacity>
              )}

              {["boarding", "delayed"].includes(activeRide.status) && (
                <TouchableOpacity
                  onPress={() => void changeStatus("active")}
                  disabled={statusLoading}
                  className="rounded-2xl py-4"
                  style={{ backgroundColor: "#848482" }}
                >
                  <Text className="text-center font-rubik-bold text-white">
                    Start trip
                  </Text>
                </TouchableOpacity>
              )}

              {activeRide.status === "active" && (
                <TouchableOpacity
                  onPress={() => void changeStatus("completed")}
                  disabled={statusLoading}
                  className="rounded-2xl py-4"
                  style={{ backgroundColor: theme.primary[300] }}
                >
                  <Text className="text-center font-rubik-bold text-white">
                    Complete trip
                  </Text>
                </TouchableOpacity>
              )}

              {["scheduled", "boarding", "active"].includes(
                activeRide.status,
              ) && (
                <TouchableOpacity
                  onPress={() => void changeStatus("delayed")}
                  disabled={statusLoading}
                  className="rounded-2xl border py-4"
                  style={{
                    borderColor: "#D97706",
                    backgroundColor: theme.surface,
                  }}
                >
                  <Text
                    className="text-center font-rubik-bold"
                    style={{ color: "#D97706" }}
                  >
                    Mark as delayed
                  </Text>
                </TouchableOpacity>
              )}

              {statusLoading && (
                <ActivityIndicator color={theme.primary[300]} />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
