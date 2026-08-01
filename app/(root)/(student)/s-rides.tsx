import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import {
  formatMarketplaceDateTime,
  formatMarketplaceStatus,
  getStudentRideRequests,
} from "@/services/ride-marketplace.service";
import useAuthStore from "@/store/auth.store";
import type { RideRequest } from "@/types/ride-marketplace";

type RequestFilter = "active" | "history";

const ACTIVE_STATUSES = new Set([
  "pending",
  "quoted",
  "confirming",
  "confirmed",
]);

const STATUS_COLORS: Record<string, string> = {
  pending: "#2563EB",
  quoted: "#D97706",
  confirming: "#7C3AED",
  confirmed: "#848482",
  cancelled: "#DC2626",
  expired: "#64748B",
};

const titleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const normalizeStatus = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const RideRequestCard = ({
  request,
  onPress,
  theme,
}: {
  request: RideRequest;
  onPress: () => void;
  theme: any;
}) => {
  const status = normalizeStatus(request.status);
  const statusColor = STATUS_COLORS[status] ?? theme.primary[300];
  const offerCount = Number(request.offerCount ?? 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.82}
      className="mb-3 rounded-3xl border p-4"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}22`,
      }}
    >
      <View className="flex-row items-start justify-between">
        <View className="min-w-0 flex-1 pr-3">
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Pickup
          </Text>
          <Text
            className="mt-1 text-base font-rubik-bold"
            style={{ color: theme.title }}
            numberOfLines={2}
          >
            {request.pickupAddress}
          </Text>
        </View>

        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: `${statusColor}16` }}
        >
          <Text
            className="text-xs font-rubik-bold"
            style={{ color: statusColor }}
          >
            {formatMarketplaceStatus(status)}
          </Text>
        </View>
      </View>

      <View className="my-3 flex-row items-center">
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${theme.primary[300]}12` }}
        >
          <Ionicons
            name="navigate-outline"
            size={19}
            color={theme.primary[300]}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Destination
          </Text>
          <Text
            className="mt-0.5 text-sm font-rubik-medium"
            style={{ color: theme.text }}
            numberOfLines={2}
          >
            {request.destinationAddress}
          </Text>
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2">
        <View className="flex-row items-center">
          <Ionicons name="time-outline" size={16} color={theme.muted} />
          <Text
            className="ml-1 text-xs font-rubik"
            style={{ color: theme.text }}
          >
            {formatMarketplaceDateTime(request.requestedDepartureTime)}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={16} color={theme.muted} />
          <Text
            className="ml-1 text-xs font-rubik"
            style={{ color: theme.text }}
          >
            {request.passengerCount}{" "}
            {request.passengerCount === 1 ? "passenger" : "passengers"}
          </Text>
        </View>
      </View>

      <View
        className="mt-4 flex-row items-center justify-between border-t pt-3"
        style={{ borderTopColor: `${theme.muted}18` }}
      >
        <View className="flex-row items-center">
          <Ionicons
            name="pricetags-outline"
            size={17}
            color={offerCount > 0 ? "#D97706" : theme.muted}
          />
          <Text
            className="ml-1.5 text-xs font-rubik-medium"
            style={{ color: offerCount > 0 ? "#A85D00" : theme.muted }}
          >
            {offerCount > 0
              ? `${offerCount} ${offerCount === 1 ? "driver offer" : "driver offers"}`
              : "Waiting for driver offers"}
          </Text>
        </View>

        <View className="flex-row items-center">
          <Text
            className="text-sm font-rubik-medium"
            style={{ color: theme.primary[300] }}
          >
            View
          </Text>
          <Ionicons
            name="chevron-forward"
            size={17}
            color={theme.primary[300]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function StudentRidesScreen() {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [filter, setFilter] = useState<RequestFilter>("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const schoolLocation = user?.schoolLocation?.trim() || "";

  const loadRequests = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      setRequests(await getStudentRideRequests());
    } catch (caughtError) {
      console.error("Unable to load student ride requests:", caughtError);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load your ride requests.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRequests();
    }, [loadRequests]),
  );

  const visibleRequests = useMemo(
    () =>
      requests.filter((request) => {
        const active = ACTIVE_STATUSES.has(normalizeStatus(request.status));
        return filter === "active" ? active : !active;
      }),
    [filter, requests],
  );

  const openRequest = useCallback((requestId: string) => {
    router.push({
      pathname: "/rides/request/[requestId]" as any,
      params: { requestId },
    });
  }, []);

  const renderHeader = () => (
    <View>
      <View
        className="mb-5 overflow-hidden rounded-3xl p-5"
        style={{
          backgroundColor: theme.primary[300],
          shadowColor: "#0061FF",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <View className="absolute -bottom-10 -left-8 h-24 w-24 rounded-full bg-white/10" />

        <View className="flex-row items-center">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <Ionicons name="car-sport-outline" size={30} color="#FFFFFF" />
          </View>

          <View className="ml-4 min-w-0 flex-1">
            <Text className="text-xl font-rubik-bold text-white">
              Go where you need to go
            </Text>
            <Text className="mt-1 text-sm font-rubik text-white/85">
              Request transport, compare verified driver offers and confirm the
              one that works for you.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push("/rides/request-new" as any)}
          activeOpacity={0.85}
          className="mt-5 flex-row items-center justify-center rounded-2xl bg-white px-5 py-3.5"
        >
          <Ionicons
            name="add-circle-outline"
            size={21}
            color={theme.primary[300]}
          />
          <Text
            className="ml-2 font-rubik-bold"
            style={{ color: theme.primary[300] }}
          >
            Request a ride
          </Text>
        </TouchableOpacity>
      </View>

      <View
        className="mb-4 flex-row items-start rounded-2xl border p-3"
        style={{
          backgroundColor: `${theme.primary[300]}09`,
          borderColor: `${theme.primary[300]}20`,
        }}
      >
        <Ionicons
          name="shield-checkmark-outline"
          size={20}
          color={theme.primary[300]}
        />
        <View className="ml-2 flex-1">
          <Text
            className="text-sm font-rubik-bold"
            style={{ color: theme.title }}
          >
            Independent drivers, university safety oversight
          </Text>
          <Text
            className="mt-1 text-xs font-rubik"
            style={{ color: theme.muted }}
          >
            Your institution can monitor confirmed journeys for safety without
            controlling the driver&apos;s transport business.
          </Text>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
          Institution
        </Text>
        <Text
          className="mt-1 text-base font-rubik-bold"
          style={{ color: theme.title }}
        >
          {schoolLocation ? titleCase(schoolLocation) : "Institution not set"}
        </Text>
      </View>

      <View
        className="mb-5 flex-row rounded-2xl p-1"
        style={{ backgroundColor: theme.surface }}
      >
        {(["active", "history"] as RequestFilter[]).map((item) => {
          const selected = filter === item;

          return (
            <TouchableOpacity
              key={item}
              onPress={() => setFilter(item)}
              className="flex-1 rounded-xl px-4 py-2.5"
              style={{
                backgroundColor: selected ? theme.primary[300] : "transparent",
              }}
            >
              <Text
                className="text-center text-sm font-rubik-medium capitalize"
                style={{ color: selected ? "#FFFFFF" : theme.text }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error ? (
        <TouchableOpacity
          onPress={() => void loadRequests(true)}
          className="mb-4 flex-row items-center rounded-2xl p-3"
          style={{ backgroundColor: "#FEECEC" }}
        >
          <Ionicons name="warning-outline" size={19} color="#B42318" />
          <Text className="ml-2 flex-1 text-sm font-rubik text-[#7A271A]">
            {error}
          </Text>
          <Ionicons name="refresh" size={18} color="#B42318" />
        </TouchableOpacity>
      ) : null}

      {visibleRequests.length > 0 ? (
        <View className="mb-3 flex-row items-center justify-between">
          <Text
            className="text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {filter === "active" ? "Your active requests" : "Ride history"}
          </Text>
          <Text className="text-sm font-rubik" style={{ color: theme.muted }}>
            {visibleRequests.length}
          </Text>
        </View>
      ) : null}
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View className="items-center justify-center py-16">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text
            className="mt-3 text-sm font-rubik"
            style={{ color: theme.muted }}
          >
            Loading your ride requests...
          </Text>
        </View>
      );
    }

    return (
      <View
        className="items-center justify-center rounded-3xl px-7 py-12"
        style={{ backgroundColor: theme.surface }}
      >
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.primary[300]}12` }}
        >
          <Ionicons
            name={filter === "active" ? "navigate-outline" : "time-outline"}
            size={31}
            color={theme.primary[300]}
          />
        </View>
        <Text
          className="mt-4 text-center text-lg font-rubik-bold"
          style={{ color: theme.title }}
        >
          {filter === "active"
            ? "No active ride requests"
            : "No completed request history"}
        </Text>
        <Text
          className="mt-2 text-center text-sm font-rubik"
          style={{ color: theme.muted }}
        >
          {filter === "active"
            ? "Tell verified drivers where you need to go and compare their offers."
            : "Cancelled and expired requests will appear here."}
        </Text>

        {filter === "active" ? (
          <TouchableOpacity
            onPress={() => router.push("/rides/request-new" as any)}
            className="mt-5 rounded-full px-6 py-3"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="font-rubik-medium text-white">
              Create your first request
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="flex-row items-center px-5 pb-4 pt-2">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.surface }}
        >
          <Ionicons name="chevron-back" size={24} color={theme.title} />
        </TouchableOpacity>

        <View className="ml-3 flex-1">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Nookly Rides
          </Text>
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Student-requested transport
          </Text>
        </View>
      </View>

      <FlatList
        data={visibleRequests}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <RideRequestCard
            request={item}
            onPress={() => openRequest(item.$id)}
            theme={theme}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 40,
          flexGrow: visibleRequests.length === 0 ? 1 : undefined,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRequests(true)}
            tintColor={theme.primary[300]}
          />
        }
      />
    </SafeAreaView>
  );
}
