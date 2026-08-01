import { Colors } from "@/constants/Colors";
import {
  formatDriverRideDate,
  formatDriverRideStatus,
  formatDriverRideTime,
  getDriverRideDetails,
  reportDriverIncident,
  updateDriverRideStatus,
} from "@/services/driver.service";
import type { DriverRideDetails, DriverRideStatus } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

export default function DriverRideDetailsScreen() {
  const { rideId } = useLocalSearchParams<{ rideId?: string }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const safeAreaInsets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [ride, setRide] = useState<DriverRideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const bottomClearance =
    Math.max(tabBarHeight, 80) + safeAreaInsets.bottom + 36;

  const loadRide = useCallback(async () => {
    if (!rideId) {
      setRide(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setRide(await getDriverRideDetails(rideId));
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
  }, [rideId]);

  useEffect(() => {
    void loadRide();
  }, [loadRide]);

  const changeStatus = async (status: DriverRideStatus) => {
    if (!ride || actionLoading) return;

    setActionLoading(true);

    try {
      const updatedRide = await updateDriverRideStatus(ride.$id, status);
      setRide({ ...ride, ...updatedRide });

      if (status === "boarding" || status === "active") {
        router.replace("/driver-active");
      }
    } catch (caughtError) {
      Alert.alert(
        "Update failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Please try again.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const reportIncident = () => {
    if (!ride) return;

    Alert.alert(
      "Report incident",
      "Create a general safety incident for this ride?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Report",
          style: "destructive",
          onPress: async () => {
            try {
              await reportDriverIncident(ride.$id, {
                category: "general",
                description:
                  "Driver reported an incident from the mobile driver app.",
                priority: "medium",
              });

              Alert.alert(
                "Incident reported",
                "The organization was notified.",
              );
            } catch (caughtError) {
              Alert.alert(
                "Report failed",
                caughtError instanceof Error
                  ? caughtError.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );
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

  if (!ride) {
    return (
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: theme.background }}
      >
        <Ionicons name="alert-circle-outline" size={48} color={theme.muted} />
        <Text
          className="mt-4 text-lg font-rubik-bold"
          style={{ color: theme.title }}
        >
          Ride unavailable
        </Text>
        <TouchableOpacity
          onPress={() => router.back()}
          className="mt-5 rounded-full px-5 py-3"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <Text className="font-rubik-bold text-white">Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: tabBarHeight }}
        contentContainerStyle={{
          padding: 20,
          paddingBottom: bottomClearance,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-5 h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.surface }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </TouchableOpacity>

        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          {ride.route?.name || "Ride details"}
        </Text>
        <Text className="mt-2" style={{ color: theme.muted }}>
          {ride.route
            ? `${ride.route.originName} → ${ride.route.destinationName}`
            : ride.schoolLocation}
        </Text>

        <View
          className="mt-5 rounded-2xl border p-5"
          style={{
            backgroundColor: theme.surface,
            borderColor: `${theme.muted}25`,
          }}
        >
          <View className="flex-row justify-between">
            <View>
              <Text className="text-xs" style={{ color: theme.muted }}>
                Departure
              </Text>
              <Text
                className="mt-1 font-rubik-bold"
                style={{ color: theme.title }}
              >
                {formatDriverRideDate(ride.departureTime)}
              </Text>
              <Text style={{ color: theme.text }}>
                {formatDriverRideTime(ride.departureTime)}
              </Text>
            </View>

            <View className="items-end">
              <Text className="text-xs" style={{ color: theme.muted }}>
                Status
              </Text>
              <Text
                className="mt-1 font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                {formatDriverRideStatus(ride.status)}
              </Text>
            </View>
          </View>

          <View
            className="mt-5 flex-row justify-between border-t pt-4"
            style={{ borderTopColor: `${theme.muted}20` }}
          >
            <Text style={{ color: theme.muted }}>Vehicle</Text>
            <Text className="font-rubik-medium" style={{ color: theme.text }}>
              {ride.vehicleRegistration}
            </Text>
          </View>

          <View className="mt-3 flex-row justify-between">
            <Text style={{ color: theme.muted }}>Passengers</Text>
            <Text className="font-rubik-medium" style={{ color: theme.text }}>
              {ride.bookedSeats}/{ride.totalSeats}
            </Text>
          </View>
        </View>

        <Text
          className="mb-3 mt-7 text-xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Route stops
        </Text>

        {ride.stops.map((stop, index) => (
          <View key={stop.$id} className="flex-row">
            <View className="items-center">
              <View
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: `${theme.primary[300]}18` }}
              >
                <Text
                  className="text-xs font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  {index + 1}
                </Text>
              </View>

              {index < ride.stops.length - 1 && (
                <View
                  className="w-0.5 flex-1"
                  style={{
                    minHeight: 32,
                    backgroundColor: `${theme.muted}30`,
                  }}
                />
              )}
            </View>

            <View className="ml-3 flex-1 pb-5">
              <Text
                className="font-rubik-medium"
                style={{ color: theme.title }}
              >
                {stop.name}
              </Text>
              <Text className="mt-1 text-xs" style={{ color: theme.muted }}>
                +{stop.estimatedArrivalOffsetMinutes} minutes
              </Text>
            </View>
          </View>
        ))}

        <Text
          className="mb-3 mt-5 text-xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Passenger manifest
        </Text>

        {ride.bookings.length === 0 ? (
          <View
            className="rounded-2xl border border-dashed p-5"
            style={{ borderColor: `${theme.muted}35` }}
          >
            <Text className="text-center" style={{ color: theme.muted }}>
              No passenger bookings yet.
            </Text>
          </View>
        ) : (
          ride.bookings.map((booking) => (
            <View
              key={booking.$id}
              className="mb-3 rounded-2xl border p-4"
              style={{
                backgroundColor: theme.surface,
                borderColor: `${theme.muted}25`,
              }}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text
                    className="font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {booking.studentName}
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: theme.muted }}>
                    {booking.bookingReference} · {booking.seatCount} seat
                    {booking.seatCount === 1 ? "" : "s"}
                  </Text>
                </View>

                <Text
                  className="text-xs font-rubik-medium capitalize"
                  style={{ color: theme.primary[300] }}
                >
                  {booking.status}
                </Text>
              </View>
            </View>
          ))
        )}

        <View className="mt-7 gap-3">
          {ride.status === "scheduled" && (
            <TouchableOpacity
              onPress={() => void changeStatus("boarding")}
              disabled={actionLoading}
              className="rounded-2xl py-4"
              style={{
                backgroundColor: "#D97706",
                opacity: actionLoading ? 0.65 : 1,
              }}
            >
              <Text className="text-center font-rubik-bold text-white">
                Start boarding
              </Text>
            </TouchableOpacity>
          )}

          {["boarding", "delayed"].includes(ride.status) && (
            <TouchableOpacity
              onPress={() => void changeStatus("active")}
              disabled={actionLoading}
              className="rounded-2xl py-4"
              style={{
                backgroundColor: "#848482",
                opacity: actionLoading ? 0.65 : 1,
              }}
            >
              <Text className="text-center font-rubik-bold text-white">
                Start trip
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={reportIncident}
            disabled={actionLoading}
            className="rounded-2xl border py-4"
            style={{
              borderColor: theme.danger,
              backgroundColor: `${theme.danger}06`,
              opacity: actionLoading ? 0.65 : 1,
            }}
          >
            <Text
              className="text-center font-rubik-bold"
              style={{ color: theme.danger }}
            >
              Report incident
            </Text>
          </TouchableOpacity>

          {actionLoading && <ActivityIndicator color={theme.primary[300]} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
