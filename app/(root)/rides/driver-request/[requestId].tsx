import { Ionicons } from "@expo/vector-icons";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import { getUserHomeRoute, isDriverUser } from "@/lib/userMode";
import {
  formatMarketplaceDateTime,
  formatMarketplaceMoney,
  formatMarketplaceStatus,
  getDriverRideRequestDetails,
  isMarketplaceRequestOpen,
  submitDriverRideOffer,
  withdrawDriverRideOffer,
} from "@/services/ride-marketplace.service";
import useAuthStore from "@/store/auth.store";
import type {
  DriverRideRequestDetails,
  MarketplaceVehicleSummary,
} from "@/types/ride-marketplace";

const normalizeStatus = (value: string): string =>
  String(value || "").trim().toLowerCase();

const InfoRow = ({
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

const VehicleCard = ({
  vehicle,
  selected,
  onPress,
  theme,
}: {
  vehicle: MarketplaceVehicleSummary;
  selected: boolean;
  onPress: () => void;
  theme: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.82}
    className="mb-3 rounded-2xl border p-3"
    style={{
      backgroundColor: selected
        ? `${theme.primary[300]}0D`
        : theme.background,
      borderColor: selected
        ? theme.primary[300]
        : `${theme.muted}22`,
      borderWidth: selected ? 2 : 1,
    }}
  >
    <View className="flex-row items-center">
      <View
        className="h-11 w-11 items-center justify-center rounded-xl"
        style={{
          backgroundColor: selected
            ? `${theme.primary[300]}18`
            : theme.surface,
        }}
      >
        <Ionicons
          name="car-sport-outline"
          size={23}
          color={selected ? theme.primary[300] : theme.muted}
        />
      </View>

      <View className="ml-3 min-w-0 flex-1">
        <Text
          className="text-sm font-rubik-bold"
          style={{ color: theme.title }}
          numberOfLines={1}
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

      <Ionicons
        name={selected ? "radio-button-on" : "radio-button-off"}
        size={22}
        color={selected ? theme.primary[300] : theme.muted}
      />
    </View>

    <View className="mt-3 flex-row flex-wrap gap-2">
      <View
        className="rounded-full px-3 py-1.5"
        style={{ backgroundColor: theme.surface }}
      >
        <Text className="text-[11px] font-rubik-medium" style={{ color: theme.text }}>
          {Number(
            vehicle.availableSeats ??
              vehicle.passengerCapacity ??
              vehicle.capacity,
          ) || 0}{" "}
          seats available
        </Text>
      </View>

      {vehicle.hasSeatbelts ? (
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="text-[11px] font-rubik-medium" style={{ color: theme.text }}>
            Seatbelts
          </Text>
        </View>
      ) : null}

      {vehicle.allowsLuggage ? (
        <View
          className="rounded-full px-3 py-1.5"
          style={{ backgroundColor: theme.surface }}
        >
          <Text className="text-[11px] font-rubik-medium" style={{ color: theme.text }}>
            Luggage
          </Text>
        </View>
      ) : null}
    </View>
  </TouchableOpacity>
);

export default function DriverRideRequestDetailsScreen() {
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
    useState<DriverRideRequestDetails | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");
  const [quotedFare, setQuotedFare] = useState("");
  const [pickupMinutes, setPickupMinutes] = useState("10");
  const [journeyMinutes, setJourneyMinutes] = useState("20");
  const [availableSeats, setAvailableSeats] = useState("1");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState("");

  const inputStyle = useMemo(
    () => ({
      backgroundColor: theme.background,
      color: theme.text,
      borderColor: `${theme.muted}25`,
    }),
    [theme],
  );

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
        setDetails(await getDriverRideRequestDetails(requestId));
      } catch (caughtError) {
        console.error("Unable to load driver request details:", caughtError);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Could not load this student request.",
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

  useEffect(() => {
    if (!details) return;

    const offer = details.myOffer;
    const firstVehicle = details.vehicles[0];

    setSelectedVehicleId(
      offer?.vehicleId || firstVehicle?.$id || "",
    );
    setQuotedFare(
      offer ? String(offer.quotedFare) : "",
    );
    setPickupMinutes(
      offer ? String(offer.estimatedPickupMinutes) : "10",
    );
    setJourneyMinutes(
      offer ? String(offer.estimatedJourneyMinutes) : "20",
    );
    setAvailableSeats(
      offer
        ? String(offer.availableSeats)
        : String(
            Number(
              firstVehicle?.availableSeats ??
                firstVehicle?.passengerCapacity ??
                firstVehicle?.capacity ??
                details.request.passengerCount ??
                1,
            ) || 1,
          ),
    );
    setMessage(offer?.message || "");
  }, [details]);

  if (!isHydrated || !isInitialized || (loading && !details)) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-3 text-sm font-rubik" style={{ color: theme.muted }}>
          Loading student request...
        </Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!isDriverUser(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

  const chooseVehicle = (vehicle: MarketplaceVehicleSummary) => {
    if (!details) return;

    setSelectedVehicleId(vehicle.$id);
    setAvailableSeats(
      String(
        Number(
          vehicle.availableSeats ??
            vehicle.passengerCapacity ??
            vehicle.capacity ??
            details.request.passengerCount ??
            1,
        ) || 1,
      ),
    );
  };

  const submitOffer = async () => {
    if (!requestId || !details) return;

    if (!selectedVehicleId) {
      Alert.alert(
        "Vehicle required",
        "Select one of your active vehicles before submitting a price.",
      );
      return;
    }

    const fare = Number(quotedFare);
    const pickup = Number(pickupMinutes);
    const journey = Number(journeyMinutes);
    const seats = Number(availableSeats);

    if (!Number.isFinite(fare) || fare < 0) {
      Alert.alert(
        "Invalid fare",
        "Enter the total price for the requested trip.",
      );
      return;
    }

    if (!Number.isFinite(pickup) || pickup < 0) {
      Alert.alert(
        "Invalid pickup estimate",
        "Enter the number of minutes until pickup.",
      );
      return;
    }

    if (!Number.isFinite(journey) || journey < 1) {
      Alert.alert(
        "Invalid journey estimate",
        "Enter a journey estimate of at least one minute.",
      );
      return;
    }

    if (
      !Number.isFinite(seats) ||
      seats < details.request.passengerCount
    ) {
      Alert.alert(
        "Not enough seats",
        `This request needs at least ${details.request.passengerCount} seats.`,
      );
      return;
    }

    setSubmitting(true);

    try {
      await submitDriverRideOffer(requestId, {
        vehicleId: selectedVehicleId,
        quotedFare: fare,
        currency: details.request.currency || "USD",
        estimatedPickupMinutes: Math.round(pickup),
        estimatedJourneyMinutes: Math.round(journey),
        availableSeats: Math.round(seats),
        message: message.trim() || undefined,
      });

      await loadDetails(true);

      Alert.alert(
        details.myOffer ? "Offer updated" : "Offer submitted",
        "The student can now compare your price and vehicle with other driver offers.",
      );
    } catch (caughtError) {
      Alert.alert(
        "Could not save offer",
        caughtError instanceof Error
          ? caughtError.message
          : "Your driver offer could not be saved.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const withdrawOffer = () => {
    const offer = details?.myOffer;

    if (!offer) return;

    Alert.alert(
      "Withdraw your offer?",
      "The student will no longer be able to select this price.",
      [
        { text: "Keep offer", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            setWithdrawing(true);

            try {
              await withdrawDriverRideOffer(offer.$id);
              await loadDetails(true);
            } catch (caughtError) {
              Alert.alert(
                "Could not withdraw offer",
                caughtError instanceof Error
                  ? caughtError.message
                  : "The offer could not be withdrawn.",
              );
            } finally {
              setWithdrawing(false);
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
            Student request
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
  const open = isMarketplaceRequestOpen(requestStatus);
  const offerStatus = normalizeStatus(details.myOffer?.status || "");
  const offerEditable =
    open &&
    (!details.myOffer ||
      ["submitted", "withdrawn", "expired"].includes(offerStatus));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
              Price student trip
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
            style={{ backgroundColor: `${theme.primary[300]}12` }}
          >
            <Text
              className="text-xs font-rubik-bold"
              style={{ color: theme.primary[300] }}
            >
              {formatMarketplaceStatus(requestStatus)}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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

            <Text className="text-xs font-rubik text-white/75">
              Student pickup
            </Text>
            <View className="mt-1 flex-row items-start">
              <Ionicons name="location-outline" size={20} color="#FFFFFF" />
              <Text className="ml-2 flex-1 text-sm font-rubik-bold text-white">
                {request.pickupAddress}
              </Text>
            </View>

            <View className="ml-[9px] my-1.5 h-7 w-[2px] bg-white/35" />

            <Text className="text-xs font-rubik text-white/75">
              Destination
            </Text>
            <View className="mt-1 flex-row items-start">
              <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              <Text className="ml-2 flex-1 text-sm font-rubik-bold text-white">
                {request.destinationAddress}
              </Text>
            </View>
          </View>

          <View
            className="mb-5 rounded-3xl px-4 py-1"
            style={{ backgroundColor: theme.surface }}
          >
            <InfoRow
              icon="time-outline"
              label="Requested departure"
              value={formatMarketplaceDateTime(request.requestedDepartureTime)}
              theme={theme}
            />
            <InfoRow
              icon="people-outline"
              label="Passengers"
              value={`${request.passengerCount} ${
                request.passengerCount === 1 ? "passenger" : "passengers"
              }`}
              theme={theme}
            />
            <InfoRow
              icon="car-outline"
              label="Ride preference"
              value={
                request.ridePreference === "requested_shared"
                  ? "Shared ride requested"
                  : "Private ride requested"
              }
              theme={theme}
            />
            {request.proposedBudget !== undefined &&
            request.proposedBudget !== null ? (
              <InfoRow
                icon="wallet-outline"
                label="Student proposed budget"
                value={formatMarketplaceMoney(
                  request.proposedBudget,
                  request.currency,
                )}
                theme={theme}
              />
            ) : null}
            {request.notes ? (
              <InfoRow
                icon="document-text-outline"
                label="Student notes"
                value={request.notes}
                theme={theme}
              />
            ) : null}
          </View>

          {!open ? (
            <View
              className="mb-5 flex-row items-start rounded-2xl border p-3"
              style={{
                backgroundColor: "#FFF8E7",
                borderColor: "#F4D79A",
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={20}
                color="#A15C00"
              />
              <Text className="ml-2 flex-1 text-xs font-rubik text-[#7A4500]">
                This request is {formatMarketplaceStatus(requestStatus)} and is
                no longer accepting new prices.
              </Text>
            </View>
          ) : null}

          <Text
            className="mb-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Choose your vehicle
          </Text>

          <View
            className="mb-5 rounded-3xl p-4"
            style={{ backgroundColor: theme.surface }}
          >
            {details.vehicles.length > 0 ? (
              details.vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle.$id}
                  vehicle={vehicle}
                  selected={selectedVehicleId === vehicle.$id}
                  onPress={() =>
                    offerEditable
                      ? chooseVehicle(vehicle)
                      : undefined
                  }
                  theme={theme}
                />
              ))
            ) : (
              <View className="items-center px-4 py-8">
                <Ionicons name="car-outline" size={36} color={theme.muted} />
                <Text
                  className="mt-3 text-center text-sm font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  No active vehicle available
                </Text>
                <Text
                  className="mt-1 text-center text-xs font-rubik"
                  style={{ color: theme.muted }}
                >
                  Add and activate a driver-owned vehicle before submitting
                  ride prices.
                </Text>
              </View>
            )}
          </View>

          <Text
            className="mb-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Your offer
          </Text>

          <View
            className="mb-5 rounded-3xl p-4"
            style={{ backgroundColor: theme.surface }}
          >
            {details.myOffer ? (
              <View
                className="mb-4 flex-row items-center rounded-2xl p-3"
                style={{
                  backgroundColor:
                    offerStatus === "accepted" ? "#EAF8EF" : "#FFF8E7",
                }}
              >
                <Ionicons
                  name={
                    offerStatus === "accepted"
                      ? "checkmark-circle"
                      : "pricetag-outline"
                  }
                  size={21}
                  color={offerStatus === "accepted" ? "#16824B" : "#A15C00"}
                />
                <Text
                  className="ml-2 flex-1 text-sm font-rubik-bold"
                  style={{
                    color:
                      offerStatus === "accepted" ? "#11653B" : "#7A4500",
                  }}
                >
                  Current offer: {formatMarketplaceStatus(offerStatus)}
                </Text>
              </View>
            ) : null}

            <Text
              className="mb-2 text-sm font-rubik-medium"
              style={{ color: theme.title }}
            >
              Total trip fare
            </Text>
            <View
              className="flex-row items-center rounded-2xl border px-4"
              style={inputStyle}
            >
              <Text className="font-rubik-bold" style={{ color: theme.text }}>
                {request.currency || "USD"}
              </Text>
              <TextInput
                value={quotedFare}
                onChangeText={setQuotedFare}
                editable={offerEditable}
                placeholder="e.g. 6.00"
                placeholderTextColor={theme.muted}
                keyboardType="decimal-pad"
                className="ml-3 flex-1 py-3 font-rubik"
                style={{ color: theme.text }}
              />
            </View>
            <Text
              className="mt-2 text-xs font-rubik"
              style={{ color: theme.muted }}
            >
              Quote the total amount for the requested group, not a
              university-created fare.
            </Text>

            <View className="mt-5 flex-row gap-2">
              <View className="flex-1">
                <Text
                  className="mb-2 text-sm font-rubik-medium"
                  style={{ color: theme.title }}
                >
                  Pickup minutes
                </Text>
                <TextInput
                  value={pickupMinutes}
                  onChangeText={setPickupMinutes}
                  editable={offerEditable}
                  placeholder="10"
                  placeholderTextColor={theme.muted}
                  keyboardType="number-pad"
                  className="rounded-2xl border px-4 py-3 font-rubik"
                  style={inputStyle}
                />
              </View>

              <View className="flex-1">
                <Text
                  className="mb-2 text-sm font-rubik-medium"
                  style={{ color: theme.title }}
                >
                  Journey minutes
                </Text>
                <TextInput
                  value={journeyMinutes}
                  onChangeText={setJourneyMinutes}
                  editable={offerEditable}
                  placeholder="20"
                  placeholderTextColor={theme.muted}
                  keyboardType="number-pad"
                  className="rounded-2xl border px-4 py-3 font-rubik"
                  style={inputStyle}
                />
              </View>
            </View>

            <View className="mt-5">
              <Text
                className="mb-2 text-sm font-rubik-medium"
                style={{ color: theme.title }}
              >
                Seats available
              </Text>
              <TextInput
                value={availableSeats}
                onChangeText={setAvailableSeats}
                editable={offerEditable}
                placeholder={String(request.passengerCount)}
                placeholderTextColor={theme.muted}
                keyboardType="number-pad"
                className="rounded-2xl border px-4 py-3 font-rubik"
                style={inputStyle}
              />
            </View>

            <View className="mt-5">
              <Text
                className="mb-2 text-sm font-rubik-medium"
                style={{ color: theme.title }}
              >
                Message to student (optional)
              </Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                editable={offerEditable}
                placeholder="Pickup instructions or useful trip information"
                placeholderTextColor={theme.muted}
                multiline
                maxLength={1000}
                className="min-h-[96px] rounded-2xl border px-4 py-3 font-rubik"
                style={[
                  inputStyle,
                  { textAlignVertical: "top" },
                ]}
              />
            </View>
          </View>

          {offerEditable && details.vehicles.length > 0 ? (
            <TouchableOpacity
              onPress={() => void submitOffer()}
              disabled={submitting}
              className="flex-row items-center justify-center rounded-2xl py-4"
              style={{
                backgroundColor: theme.primary[300],
                opacity: submitting ? 0.65 : 1,
              }}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name="paper-plane-outline"
                  size={20}
                  color="#FFFFFF"
                />
              )}
              <Text className="ml-2 text-base font-rubik-bold text-white">
                {submitting
                  ? "Saving offer..."
                  : details.myOffer
                    ? "Update driver offer"
                    : "Submit driver offer"}
              </Text>
            </TouchableOpacity>
          ) : null}

          {details.myOffer && offerStatus === "submitted" ? (
            <TouchableOpacity
              onPress={withdrawOffer}
              disabled={withdrawing}
              className="mt-3 flex-row items-center justify-center rounded-2xl border py-3.5"
              style={{
                borderColor: "#DC2626",
                opacity: withdrawing ? 0.6 : 1,
              }}
            >
              {withdrawing ? (
                <ActivityIndicator size="small" color="#DC2626" />
              ) : (
                <Ionicons name="close-circle-outline" size={20} color="#DC2626" />
              )}
              <Text className="ml-2 font-rubik-bold text-[#DC2626]">
                {withdrawing ? "Withdrawing..." : "Withdraw offer"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
