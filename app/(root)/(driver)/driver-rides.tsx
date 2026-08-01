import DriverRideCard from "@/components/driver/DriverRideCard";
import { Colors } from "@/constants/Colors";
import { getDriverRides } from "@/services/driver.service";
import {
  formatMarketplaceDateTime,
  formatMarketplaceMoney,
  formatMarketplaceStatus,
  getDriverOpenRideRequests,
  getDriverRideOffers,
} from "@/services/ride-marketplace.service";
import type { DriverRide } from "@/types/driver";
import type { RideOffer, RideRequest } from "@/types/ride-marketplace";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type DriverRidesSection = "requests" | "offers" | "trips";

const OFFER_STATUS_COLORS: Record<string, string> = {
  submitted: "#D97706",
  accepted: "#848482",
  declined: "#DC2626",
  withdrawn: "#64748B",
  expired: "#64748B",
};

const normalizeStatus = (value: string): string =>
  String(value || "")
    .trim()
    .toLowerCase();

const RequestCard = ({
  request,
  onPress,
  theme,
}: {
  request: RideRequest;
  onPress: () => void;
  theme: any;
}) => (
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
          Student pickup
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
        style={{ backgroundColor: `${theme.primary[300]}12` }}
      >
        <Text
          className="text-xs font-rubik-bold"
          style={{ color: theme.primary[300] }}
        >
          {request.passengerCount}{" "}
          {request.passengerCount === 1 ? "passenger" : "passengers"}
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

    <View className="flex-row flex-wrap gap-x-4 gap-y-2">
      <View className="flex-row items-center">
        <Ionicons name="time-outline" size={16} color={theme.muted} />
        <Text className="ml-1 text-xs font-rubik" style={{ color: theme.text }}>
          {formatMarketplaceDateTime(request.requestedDepartureTime)}
        </Text>
      </View>

      <View className="flex-row items-center">
        <Ionicons name="car-outline" size={16} color={theme.muted} />
        <Text className="ml-1 text-xs font-rubik" style={{ color: theme.text }}>
          {request.ridePreference === "requested_shared"
            ? "Shared requested"
            : "Private requested"}
        </Text>
      </View>
    </View>

    <View
      className="mt-4 flex-row items-center justify-between border-t pt-3"
      style={{ borderTopColor: `${theme.muted}18` }}
    >
      <View className="flex-row items-center">
        <Ionicons name="school-outline" size={16} color="#16824B" />
        <Text className="ml-1.5 text-xs font-rubik-medium text-[#16824B]">
          Institution-recognised request
        </Text>
      </View>

      <View className="flex-row items-center">
        <Text
          className="text-sm font-rubik-medium"
          style={{ color: theme.primary[300] }}
        >
          Quote trip
        </Text>
        <Ionicons name="chevron-forward" size={17} color={theme.primary[300]} />
      </View>
    </View>
  </TouchableOpacity>
);

const OfferCard = ({
  offer,
  onPress,
  theme,
}: {
  offer: RideOffer;
  onPress: () => void;
  theme: any;
}) => {
  const status = normalizeStatus(offer.status);
  const statusColor = OFFER_STATUS_COLORS[status] ?? theme.primary[300];
  const request = offer.request;

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
            Your total trip quote
          </Text>
          <Text
            className="mt-1 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {formatMarketplaceMoney(offer.quotedFare, offer.currency)}
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

      {request ? (
        <View className="mt-4">
          <View className="flex-row items-start">
            <Ionicons
              name="location-outline"
              size={18}
              color={theme.primary[300]}
            />
            <Text
              className="ml-2 flex-1 text-sm font-rubik-medium"
              style={{ color: theme.text }}
              numberOfLines={2}
            >
              {request.pickupAddress}
            </Text>
          </View>

          <View className="ml-2 my-1 h-5 w-[2px] bg-gray-300" />

          <View className="flex-row items-start">
            <Ionicons
              name="navigate-outline"
              size={18}
              color={theme.primary[300]}
            />
            <Text
              className="ml-2 flex-1 text-sm font-rubik-medium"
              style={{ color: theme.text }}
              numberOfLines={2}
            >
              {request.destinationAddress}
            </Text>
          </View>
        </View>
      ) : null}

      <View className="mt-4 flex-row gap-2">
        <View
          className="flex-1 rounded-2xl p-3"
          style={{ backgroundColor: theme.background }}
        >
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Pickup
          </Text>
          <Text
            className="mt-1 text-sm font-rubik-bold"
            style={{ color: theme.title }}
          >
            {offer.estimatedPickupMinutes} min
          </Text>
        </View>

        <View
          className="flex-1 rounded-2xl p-3"
          style={{ backgroundColor: theme.background }}
        >
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Journey
          </Text>
          <Text
            className="mt-1 text-sm font-rubik-bold"
            style={{ color: theme.title }}
          >
            {offer.estimatedJourneyMinutes} min
          </Text>
        </View>
      </View>

      <View
        className="mt-4 flex-row items-center justify-between border-t pt-3"
        style={{ borderTopColor: `${theme.muted}18` }}
      >
        <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
          {offer.vehicle
            ? `${offer.vehicle.registrationNumber} • ${offer.availableSeats} seats`
            : `${offer.availableSeats} seats`}
        </Text>

        <View className="flex-row items-center">
          <Text
            className="text-sm font-rubik-medium"
            style={{ color: theme.primary[300] }}
          >
            View offer
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

export default function DriverRidesScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [section, setSection] = useState<DriverRidesSection>("requests");
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [offers, setOffers] = useState<RideOffer[]>([]);
  const [trips, setTrips] = useState<DriverRide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadMarketplace = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    setError("");

    const results = await Promise.allSettled([
      getDriverOpenRideRequests(),
      getDriverRideOffers(),
      getDriverRides(),
    ]);

    const messages: string[] = [];

    const [requestResult, offerResult, tripResult] = results;

    if (requestResult.status === "fulfilled") {
      setRequests(requestResult.value);
    } else {
      messages.push(
        requestResult.reason instanceof Error
          ? requestResult.reason.message
          : "Could not load student requests.",
      );
    }

    if (offerResult.status === "fulfilled") {
      setOffers(offerResult.value);
    } else {
      messages.push(
        offerResult.reason instanceof Error
          ? offerResult.reason.message
          : "Could not load your offers.",
      );
    }

    if (tripResult.status === "fulfilled") {
      setTrips(tripResult.value);
    } else {
      messages.push(
        tripResult.reason instanceof Error
          ? tripResult.reason.message
          : "Could not load confirmed trips.",
      );
    }

    setError(Array.from(new Set(messages)).join(" "));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadMarketplace();
    }, [loadMarketplace]),
  );

  const sectionCount = useMemo(
    () => ({
      requests: requests.length,
      offers: offers.length,
      trips: trips.length,
    }),
    [offers.length, requests.length, trips.length],
  );

  const openRequest = useCallback((requestId: string) => {
    router.push({
      pathname: "/rides/driver-request/[requestId]" as any,
      params: { requestId },
    });
  }, []);

  const openTrip = useCallback((ride: DriverRide) => {
    if (!String(ride.routeId || "").trim()) {
      Alert.alert(
        "Direct ride confirmed",
        "This student-requested trip is ready. Pickup, journey-start and live-tracking controls are added in the next Nookly Rides phase.",
      );
      return;
    }

    router.push({
      pathname: "/driver-ride-details",
      params: { rideId: ride.$id },
    });
  }, []);

  const renderSectionButtons = () => (
    <View
      className="mb-5 flex-row rounded-2xl p-1"
      style={{ backgroundColor: theme.surface }}
    >
      {(
        [
          {
            value: "requests",
            label: "Requests",
            icon: "navigate-outline",
          },
          {
            value: "offers",
            label: "Offers",
            icon: "pricetags-outline",
          },
          {
            value: "trips",
            label: "Trips",
            icon: "car-sport-outline",
          },
        ] as const
      ).map((item) => {
        const selected = section === item.value;

        return (
          <TouchableOpacity
            key={item.value}
            onPress={() => setSection(item.value)}
            className="flex-1 items-center rounded-xl px-2 py-2.5"
            style={{
              backgroundColor: selected ? theme.primary[300] : "transparent",
            }}
          >
            <View className="flex-row items-center">
              <Ionicons
                name={item.icon}
                size={17}
                color={selected ? "#FFFFFF" : theme.muted}
              />
              <Text
                className="ml-1.5 text-xs font-rubik-medium"
                style={{ color: selected ? "#FFFFFF" : theme.text }}
              >
                {item.label}
              </Text>
            </View>
            <Text
              className="mt-0.5 text-[10px] font-rubik"
              style={{
                color: selected ? "#FFFFFFCC" : theme.muted,
              }}
            >
              {sectionCount[item.value]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderEmpty = () => {
    const content = {
      requests: {
        icon: "navigate-outline" as const,
        title: "No student requests right now",
        message:
          "Open requests from institutions that recognise your driver profile will appear here.",
      },
      offers: {
        icon: "pricetags-outline" as const,
        title: "You have not submitted offers",
        message:
          "Open a student request, choose your vehicle and submit your total trip price.",
      },
      trips: {
        icon: "car-sport-outline" as const,
        title: "No confirmed trips",
        message:
          "Trips appear after a student accepts one of your driver offers.",
      },
    }[section];

    return (
      <View className="flex-1 items-center justify-center px-7 py-16">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.primary[300]}12` }}
        >
          <Ionicons name={content.icon} size={31} color={theme.primary[300]} />
        </View>
        <Text
          className="mt-4 text-center text-lg font-rubik-bold"
          style={{ color: theme.title }}
        >
          {content.title}
        </Text>
        <Text
          className="mt-2 text-center text-sm font-rubik"
          style={{ color: theme.muted }}
        >
          {content.message}
        </Text>
      </View>
    );
  };

  const showLoading =
    loading &&
    requests.length === 0 &&
    offers.length === 0 &&
    trips.length === 0;

  if (showLoading) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text
          className="mt-3 text-sm font-rubik"
          style={{ color: theme.muted }}
        >
          Loading your Nookly Rides marketplace...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <View className="px-5 pb-3 pt-2">
        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Driver marketplace
        </Text>
        <Text
          className="mt-1 text-sm font-rubik"
          style={{ color: theme.muted }}
        >
          Price student requests, manage offers and run confirmed trips.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
        style={{ flexGrow: 0 }}
      >
        <View
          className="mr-3 flex-row items-center rounded-2xl border px-3 py-2"
          style={{
            backgroundColor: "#EAF8EF",
            borderColor: "#B7E4C8",
          }}
        >
          <Ionicons name="business-outline" size={17} color="#16824B" />
          <Text className="ml-2 text-xs font-rubik-medium text-[#11653B]">
            Institution-recognised driver
          </Text>
        </View>

        <View
          className="flex-row items-center rounded-2xl border px-3 py-2"
          style={{
            backgroundColor: "#FFF8E7",
            borderColor: "#F4D79A",
          }}
        >
          <Ionicons name="wallet-outline" size={17} color="#A15C00" />
          <Text className="ml-2 text-xs font-rubik-medium text-[#7A4500]">
            You control your quoted price
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pt-5">
        {renderSectionButtons()}

        {error ? (
          <TouchableOpacity
            onPress={() => void loadMarketplace(true)}
            className="mb-4 flex-row items-center rounded-2xl bg-[#FEECEC] p-3"
          >
            <Ionicons name="warning-outline" size={18} color="#B42318" />
            <Text className="ml-2 flex-1 text-xs font-rubik text-[#7A271A]">
              {error}
            </Text>
            <Ionicons name="refresh" size={17} color="#B42318" />
          </TouchableOpacity>
        ) : null}
      </View>

      {section === "requests" ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.$id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              onPress={() => openRequest(item.$id)}
              theme={theme}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 110,
            flexGrow: requests.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadMarketplace(true)}
              tintColor={theme.primary[300]}
            />
          }
        />
      ) : section === "offers" ? (
        <FlatList
          data={offers}
          keyExtractor={(item) => item.$id}
          renderItem={({ item }) => (
            <OfferCard
              offer={item}
              onPress={() =>
                item.requestId ? openRequest(item.requestId) : undefined
              }
              theme={theme}
            />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 110,
            flexGrow: offers.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadMarketplace(true)}
              tintColor={theme.primary[300]}
            />
          }
        />
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.$id}
          renderItem={({ item }) => (
            <DriverRideCard ride={item} onPress={() => openTrip(item)} />
          )}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 110,
            flexGrow: trips.length === 0 ? 1 : undefined,
          }}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadMarketplace(true)}
              tintColor={theme.primary[300]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
