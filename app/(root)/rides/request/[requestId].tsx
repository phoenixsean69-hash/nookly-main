import { Ionicons } from "@expo/vector-icons";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { getUserHomeRoute, isStudentTenant } from "@/lib/userMode";
import {
  acceptStudentRideOffer,
  cancelStudentRideRequest,
  formatMarketplaceDateTime,
  formatMarketplaceMoney,
  formatMarketplaceStatus,
  getStudentRideRequestDetails,
  isMarketplaceRequestOpen,
} from "@/services/ride-marketplace.service";
import useAuthStore from "@/store/auth.store";
import type {
  RideOffer,
  StudentRideRequestDetails,
} from "@/types/ride-marketplace";

const STATUS_COLORS: Record<string, string> = {
  pending: "#2563EB",
  quoted: "#D97706",
  confirming: "#7C3AED",
  confirmed: "#16A34A",
  cancelled: "#DC2626",
  expired: "#64748B",
};

const normalizeStatus = (value: string): string =>
  String(value || "").trim().toLowerCase();

const SummaryRow = ({
  icon,
  label,
  value,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: any;
}) => (
  <View className="flex-row items-start py-3">
    <View
      className="h-10 w-10 items-center justify-center rounded-xl"
      style={{ backgroundColor: `${theme.primary[300]}12` }}
    >
      <Ionicons name={icon} size={20} color={theme.primary[300]} />
    </View>

    <View className="ml-3 flex-1">
      <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
        {label}
      </Text>
      <Text
        className="mt-0.5 text-sm font-rubik-medium"
        style={{ color: theme.text }}
      >
        {value}
      </Text>
    </View>
  </View>
);

const FeaturePill = ({
  label,
  icon,
  theme,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  theme: any;
}) => (
  <View
    className="mr-2 mt-2 flex-row items-center rounded-full px-3 py-1.5"
    style={{ backgroundColor: theme.background }}
  >
    <Ionicons name={icon} size={14} color={theme.primary[300]} />
    <Text
      className="ml-1.5 text-[11px] font-rubik-medium"
      style={{ color: theme.text }}
    >
      {label}
    </Text>
  </View>
);

const DriverOfferCard = ({
  offer,
  requestOpen,
  selected,
  accepting,
  onAccept,
  theme,
}: {
  offer: RideOffer;
  requestOpen: boolean;
  selected: boolean;
  accepting: boolean;
  onAccept: () => void;
  theme: any;
}) => {
  const offerStatus = normalizeStatus(offer.status);
  const canAccept = requestOpen && offerStatus === "submitted";
  const driver = offer.driver;
  const vehicle = offer.vehicle;

  return (
    <View
      className="mb-4 rounded-3xl border p-4"
      style={{
        backgroundColor: theme.surface,
        borderColor: selected ? "#16A34A" : `${theme.muted}22`,
        borderWidth: selected ? 2 : 1,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.primary[300]}12` }}
        >
          <Ionicons
            name="person-outline"
            size={27}
            color={theme.primary[300]}
          />
        </View>

        <View className="ml-3 min-w-0 flex-1">
          <View className="flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-2">
              <Text
                className="text-base font-rubik-bold"
                style={{ color: theme.title }}
                numberOfLines={1}
              >
                {driver?.name || "Verified Nookly driver"}
              </Text>

              <View className="mt-1 flex-row flex-wrap items-center">
                <View className="mr-3 flex-row items-center">
                  <Ionicons name="star" size={15} color="#E8A000" />
                  <Text
                    className="ml-1 text-xs font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {Number(driver?.rating || 0).toFixed(1)}
                  </Text>
                </View>

                <View className="flex-row items-center">
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={15}
                    color="#16824B"
                  />
                  <Text className="ml-1 text-xs font-rubik text-[#16824B]">
                    {Number(driver?.completedTrips || 0)} completed
                  </Text>
                </View>
              </View>
            </View>

            <View
              className="rounded-xl px-3 py-2"
              style={{ backgroundColor: "#EAF8EF" }}
            >
              <Text className="text-[10px] font-rubik text-[#16824B]">
                TOTAL FARE
              </Text>
              <Text className="mt-0.5 text-base font-rubik-bold text-[#11653B]">
                {formatMarketplaceMoney(offer.quotedFare, offer.currency)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {vehicle ? (
        <View
          className="mt-4 rounded-2xl p-3"
          style={{ backgroundColor: theme.background }}
        >
          <View className="flex-row items-center">
            <Ionicons
              name="car-sport-outline"
              size={21}
              color={theme.primary[300]}
            />
            <View className="ml-2 flex-1">
              <Text
                className="text-sm font-rubik-bold"
                style={{ color: theme.title }}
              >
                {vehicle.color} {vehicle.make} {vehicle.model}
              </Text>
              <Text
                className="mt-0.5 text-xs font-rubik"
                style={{ color: theme.muted }}
              >
                {vehicle.registrationNumber}
                {vehicle.vehicleType ? ` • ${vehicle.vehicleType}` : ""}
              </Text>
            </View>
          </View>

          <View className="flex-row flex-wrap">
            <FeaturePill
              label={`${offer.availableSeats} seats available`}
              icon="people-outline"
              theme={theme}
            />
            {vehicle.hasSeatbelts ? (
              <FeaturePill
                label="Seatbelts"
                icon="shield-checkmark-outline"
                theme={theme}
              />
            ) : null}
            {vehicle.hasAirConditioning ? (
              <FeaturePill
                label="Air conditioning"
                icon="snow-outline"
                theme={theme}
              />
            ) : null}
            {vehicle.allowsLuggage ? (
              <FeaturePill
                label="Luggage"
                icon="bag-handle-outline"
                theme={theme}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <View className="mt-4 flex-row gap-2">
        <View
          className="flex-1 rounded-2xl p-3"
          style={{ backgroundColor: `${theme.primary[300]}09` }}
        >
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Pickup estimate
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
          style={{ backgroundColor: `${theme.primary[300]}09` }}
        >
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Journey estimate
          </Text>
          <Text
            className="mt-1 text-sm font-rubik-bold"
            style={{ color: theme.title }}
          >
            {offer.estimatedJourneyMinutes} min
          </Text>
        </View>
      </View>

      {offer.message ? (
        <View
          className="mt-3 flex-row items-start rounded-2xl p-3"
          style={{ backgroundColor: "#FFF8E7" }}
        >
          <Ionicons name="chatbubble-outline" size={17} color="#A15C00" />
          <Text className="ml-2 flex-1 text-xs font-rubik text-[#7A4500]">
            {offer.message}
          </Text>
        </View>
      ) : null}

      {selected ? (
        <View className="mt-4 flex-row items-center rounded-2xl bg-[#EAF8EF] p-3">
          <Ionicons name="checkmark-circle" size={21} color="#16824B" />
          <Text className="ml-2 flex-1 text-sm font-rubik-bold text-[#11653B]">
            You selected this driver
          </Text>
        </View>
      ) : canAccept ? (
        <TouchableOpacity
          onPress={onAccept}
          disabled={accepting}
          className="mt-4 flex-row items-center justify-center rounded-2xl py-3.5"
          style={{
            backgroundColor: theme.primary[300],
            opacity: accepting ? 0.65 : 1,
          }}
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
          )}
          <Text className="ml-2 font-rubik-bold text-white">
            {accepting ? "Confirming..." : "Choose this driver"}
          </Text>
        </TouchableOpacity>
      ) : (
        <View
          className="mt-4 rounded-2xl px-3 py-2.5"
          style={{ backgroundColor: theme.background }}
        >
          <Text
            className="text-center text-xs font-rubik-medium"
            style={{ color: theme.muted }}
          >
            {formatMarketplaceStatus(offerStatus)}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function StudentRideRequestDetailsScreen() {
  const { user, isHydrated, isInitialized } = useAuthStore();
  const params = useLocalSearchParams<{
    requestId?: string | string[];
  }>();
  const requestId = Array.isArray(params.requestId)
    ? params.requestId[0]
    : params.requestId;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [details, setDetails] =
    useState<StudentRideRequestDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingOfferId, setAcceptingOfferId] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  const loadDetails = useCallback(
    async (refresh = false) => {
      if (!requestId) {
        setError("Ride request information is missing.");
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError("");

      try {
        setDetails(await getStudentRideRequestDetails(requestId));
      } catch (caughtError) {
        console.error("Unable to load ride request:", caughtError);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this ride request.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [requestId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadDetails();
    }, [loadDetails]),
  );

  const submittedOffers = useMemo(
    () =>
      (details?.offers ?? []).filter((offer) =>
        ["submitted", "accepted"].includes(normalizeStatus(offer.status)),
      ),
    [details?.offers],
  );

  if (!isHydrated || !isInitialized || (loading && !details)) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-3 text-sm font-rubik" style={{ color: theme.muted }}>
          Loading ride request...
        </Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!isStudentTenant(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

  const confirmOffer = (offer: RideOffer) => {
    Alert.alert(
      "Choose this driver?",
      `Confirm ${offer.driver?.name || "this driver"} for ${formatMarketplaceMoney(
        offer.quotedFare,
        offer.currency,
      )}. This creates the ride and booking.`,
      [
        { text: "Not yet", style: "cancel" },
        {
          text: "Confirm driver",
          onPress: async () => {
            if (!requestId) return;

            setAcceptingOfferId(offer.$id);

            try {
              await acceptStudentRideOffer(requestId, offer.$id);
              await loadDetails(true);
              Alert.alert(
                "Ride confirmed",
                "The driver has been selected and your ride booking is ready.",
              );
            } catch (caughtError) {
              Alert.alert(
                "Could not confirm driver",
                caughtError instanceof Error
                  ? caughtError.message
                  : "The offer could not be accepted.",
              );
            } finally {
              setAcceptingOfferId("");
            }
          },
        },
      ],
    );
  };

  const cancelRequest = () => {
    Alert.alert(
      "Cancel ride request?",
      "Drivers will no longer be able to submit offers for this request.",
      [
        { text: "Keep request", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: async () => {
            if (!requestId) return;

            setCancelling(true);

            try {
              await cancelStudentRideRequest(requestId);
              await loadDetails(true);
            } catch (caughtError) {
              Alert.alert(
                "Could not cancel request",
                caughtError instanceof Error
                  ? caughtError.message
                  : "The request could not be cancelled.",
              );
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  if (!details) {
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
          <Text
            className="ml-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Ride request
          </Text>
        </View>

        <View className="flex-1 items-center justify-center px-8">
          <Ionicons
            name="warning-outline"
            size={42}
            color={theme.primary[300]}
          />
          <Text
            className="mt-4 text-center text-lg font-rubik-bold"
            style={{ color: theme.title }}
          >
            Unable to load request
          </Text>
          <Text
            className="mt-2 text-center text-sm font-rubik"
            style={{ color: theme.muted }}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => void loadDetails(true)}
            className="mt-5 rounded-full px-6 py-3"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="font-rubik-medium text-white">Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const request = details.request;
  const requestStatus = normalizeStatus(request.status);
  const statusColor =
    STATUS_COLORS[requestStatus] ?? theme.primary[300];
  const requestOpen = isMarketplaceRequestOpen(requestStatus);
  const selectedOfferId = request.selectedOfferId || "";

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

        <View className="ml-3 min-w-0 flex-1">
          <Text
            className="text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Ride request
          </Text>
          <Text
            className="text-xs font-rubik"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {request.$id}
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
            {formatMarketplaceStatus(requestStatus)}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadDetails(true)}
            tintColor={theme.primary[300]}
          />
        }
      >
        {error ? (
          <TouchableOpacity
            onPress={() => void loadDetails(true)}
            className="mb-4 flex-row items-center rounded-2xl bg-[#FEECEC] p-3"
          >
            <Ionicons name="warning-outline" size={18} color="#B42318" />
            <Text className="ml-2 flex-1 text-xs font-rubik text-[#7A271A]">
              {error}
            </Text>
            <Ionicons name="refresh" size={17} color="#B42318" />
          </TouchableOpacity>
        ) : null}

        <View
          className="mb-4 overflow-hidden rounded-3xl p-5"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <View className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />

          <View className="flex-row items-center">
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
            <Text className="ml-2 flex-1 text-sm font-rubik-medium text-white">
              {request.pickupAddress}
            </Text>
          </View>

          <View className="ml-[9px] my-1.5 h-7 w-[2px] rounded-full bg-white/35" />

          <View className="flex-row items-center">
            <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
            <Text className="ml-2 flex-1 text-sm font-rubik-medium text-white">
              {request.destinationAddress}
            </Text>
          </View>
        </View>

        <View
          className="mb-5 rounded-3xl px-4 py-1"
          style={{ backgroundColor: theme.surface }}
        >
          <SummaryRow
            icon="time-outline"
            label="Requested departure"
            value={formatMarketplaceDateTime(request.requestedDepartureTime)}
            theme={theme}
          />
          <SummaryRow
            icon="people-outline"
            label="Passengers"
            value={`${request.passengerCount} ${
              request.passengerCount === 1 ? "passenger" : "passengers"
            }`}
            theme={theme}
          />
          <SummaryRow
            icon="car-sport-outline"
            label="Ride preference"
            value={
              request.ridePreference === "requested_shared"
                ? "Shared ride"
                : "Private ride"
            }
            theme={theme}
          />
          {request.proposedBudget !== undefined &&
          request.proposedBudget !== null ? (
            <SummaryRow
              icon="wallet-outline"
              label="Your proposed budget"
              value={formatMarketplaceMoney(
                request.proposedBudget,
                request.currency,
              )}
              theme={theme}
            />
          ) : null}
          {request.notes ? (
            <SummaryRow
              icon="document-text-outline"
              label="Notes"
              value={request.notes}
              theme={theme}
            />
          ) : null}
        </View>

        {requestStatus === "confirmed" ? (
          <View
            className="mb-5 rounded-3xl border p-4"
            style={{
              backgroundColor: "#EAF8EF",
              borderColor: "#A6DFC0",
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={26} color="#16824B" />
              <View className="ml-3 flex-1">
                <Text className="text-base font-rubik-bold text-[#11653B]">
                  Driver confirmed
                </Text>
                <Text className="mt-1 text-xs font-rubik text-[#256D47]">
                  The selected driver, vehicle and agreed price are now linked
                  to this booking.
                </Text>
              </View>
            </View>

            {details.confirmedRideId ? (
              <Text className="mt-3 text-xs font-rubik text-[#256D47]">
                Ride ID: {details.confirmedRideId}
              </Text>
            ) : null}
            {details.bookingId ? (
              <Text className="mt-1 text-xs font-rubik text-[#256D47]">
                Booking ID: {details.bookingId}
              </Text>
            ) : null}

            <View className="mt-3 rounded-2xl bg-white/70 p-3">
              <Text className="text-xs font-rubik text-[#256D47]">
                Driver pickup controls, live tracking and route-deviation
                monitoring are added in the next implementation phase.
              </Text>
            </View>
          </View>
        ) : null}

        <View className="mb-3 flex-row items-center justify-between">
          <View>
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Driver offers
            </Text>
            <Text
              className="mt-1 text-xs font-rubik"
              style={{ color: theme.muted }}
            >
              Compare the full trip price, vehicle and pickup estimate.
            </Text>
          </View>

          <View
            className="h-9 min-w-[36px] items-center justify-center rounded-full px-2"
            style={{ backgroundColor: `${theme.primary[300]}12` }}
          >
            <Text
              className="font-rubik-bold"
              style={{ color: theme.primary[300] }}
            >
              {submittedOffers.length}
            </Text>
          </View>
        </View>

        {submittedOffers.length > 0 ? (
          submittedOffers.map((offer) => (
            <DriverOfferCard
              key={offer.$id}
              offer={offer}
              requestOpen={requestOpen}
              selected={selectedOfferId === offer.$id}
              accepting={acceptingOfferId === offer.$id}
              onAccept={() => confirmOffer(offer)}
              theme={theme}
            />
          ))
        ) : (
          <View
            className="mb-5 items-center rounded-3xl px-6 py-10"
            style={{ backgroundColor: theme.surface }}
          >
            <Ionicons
              name="hourglass-outline"
              size={36}
              color={theme.primary[300]}
            />
            <Text
              className="mt-3 text-center text-base font-rubik-bold"
              style={{ color: theme.title }}
            >
              {requestOpen
                ? "Waiting for verified drivers"
                : "No active driver offers"}
            </Text>
            <Text
              className="mt-2 text-center text-xs font-rubik"
              style={{ color: theme.muted }}
            >
              {requestOpen
                ? "Drivers recognised by your institution can view this request and submit their prices."
                : "This request is no longer accepting offers."}
            </Text>
          </View>
        )}

        {["pending", "quoted"].includes(requestStatus) ? (
          <TouchableOpacity
            onPress={cancelRequest}
            disabled={cancelling}
            className="flex-row items-center justify-center rounded-2xl border py-3.5"
            style={{
              borderColor: "#DC2626",
              opacity: cancelling ? 0.6 : 1,
            }}
          >
            {cancelling ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
            )}
            <Text className="ml-2 font-rubik-bold text-[#DC2626]">
              {cancelling ? "Cancelling..." : "Cancel request"}
            </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
