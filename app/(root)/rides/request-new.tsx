import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { Redirect, router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RideLocationPickerMap, {
  type RideLocationPickerMapHandle,
  type RideMapCoordinate,
} from "@/components/rides/RideLocationPickerMap";
import { Colors } from "@/constants/Colors";
import { getUserHomeRoute, isStudentTenant } from "@/lib/userMode";
import {
  createStudentRideRequest,
  formatMarketplaceMoney,
  getNearbyDrivers,
} from "@/services/ride-marketplace.service";
import useAuthStore from "@/store/auth.store";
import type {
  NearbyDriver,
  NearbyDriversResponse,
  RequestedRideType,
} from "@/types/ride-marketplace";

type PickerMode = "date" | "time" | null;

interface Coordinates {
  latitude: string;
  longitude: string;
}

const formatAddress = (place: Location.LocationGeocodedAddress): string =>
  [
    place.name,
    place.street,
    place.district,
    place.city,
    place.region,
    place.country,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .filter((part, index, values) => values.indexOf(part) === index)
    .join(", ");

const readCoordinate = (
  value: string,
  min: number,
  max: number,
): number | undefined => {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : undefined;
};

const parseCoordinate = (
  value: string,
  label: string,
  min: number,
  max: number,
): number => {
  const parsed = Number(value.trim());

  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be between ${min} and ${max}.`);
  }

  return parsed;
};

const formatDateLabel = (value: Date): string =>
  value.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const formatTimeLabel = (value: Date): string =>
  value.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatNearbyDistance = (distanceMeters: number): string => {
  if (!Number.isFinite(distanceMeters)) return "Distance unavailable";
  if (distanceMeters < 1000) {
    return `${Math.max(1, Math.round(distanceMeters))} m away`;
  }

  return `${(distanceMeters / 1000).toFixed(1)} km away`;
};

const vehicleDisplayName = (driver: NearbyDriver): string =>
  [driver.vehicle?.color, driver.vehicle?.make, driver.vehicle?.model]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ") || "Active vehicle";

const availableSeatCount = (driver: NearbyDriver): number =>
  Math.max(
    0,
    Number(
      driver.vehicle?.availableSeats ??
        driver.vehicle?.passengerCapacity ??
        driver.vehicle?.capacity ??
        0,
    ) || 0,
  );

const FieldLabel = ({
  label,
  required = false,
  theme,
}: {
  label: string;
  required?: boolean;
  theme: any;
}) => (
  <Text
    className="mb-2 text-sm font-rubik-medium"
    style={{ color: theme.title }}
  >
    {label}
    {required ? <Text style={{ color: "#DC2626" }}> *</Text> : null}
  </Text>
);

export default function NewRideRequestScreen() {
  const { user, isHydrated, isInitialized } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const destinationMapRef = useRef<RideLocationPickerMapHandle>(null);
  const nearbyRequestIdRef = useRef(0);

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupCoordinates, setPickupCoordinates] = useState<Coordinates>({
    latitude: "",
    longitude: "",
  });
  const [destinationAddress, setDestinationAddress] = useState("");
  const [destinationCoordinates, setDestinationCoordinates] =
    useState<Coordinates>({
      latitude: "",
      longitude: "",
    });
  const [passengerCount, setPassengerCount] = useState(1);
  const [ridePreference, setRidePreference] =
    useState<RequestedRideType>("requested_private");
  const [departureTime, setDepartureTime] = useState(
    () => new Date(Date.now() + 45 * 60_000),
  );
  const [proposedBudget, setProposedBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [locatingDestination, setLocatingDestination] = useState(false);
  const [reverseGeocodingDestination, setReverseGeocodingDestination] =
    useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriver[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyRadiusKm, setNearbyRadiusKm] = useState(1);
  const [nearbyGeneratedAt, setNearbyGeneratedAt] = useState("");
  const [selectedNearbyDriverId, setSelectedNearbyDriverId] = useState<
    string | null
  >(null);

  const schoolLocation = user?.schoolLocation?.trim() || "";

  const inputStyle = useMemo(
    () => ({
      backgroundColor: theme.surface,
      color: theme.text,
      borderColor: `${theme.muted}25`,
    }),
    [theme],
  );

  const pickupLatitudeValue = readCoordinate(
    pickupCoordinates.latitude,
    -90,
    90,
  );
  const pickupLongitudeValue = readCoordinate(
    pickupCoordinates.longitude,
    -180,
    180,
  );
  const destinationLatitudeValue = readCoordinate(
    destinationCoordinates.latitude,
    -90,
    90,
  );
  const destinationLongitudeValue = readCoordinate(
    destinationCoordinates.longitude,
    -180,
    180,
  );

  const selectedDestination =
    destinationLatitudeValue !== undefined &&
    destinationLongitudeValue !== undefined
      ? {
          latitude: destinationLatitudeValue,
          longitude: destinationLongitudeValue,
        }
      : null;

  const mapCenter =
    pickupLatitudeValue !== undefined && pickupLongitudeValue !== undefined
      ? {
          latitude: pickupLatitudeValue,
          longitude: pickupLongitudeValue,
        }
      : undefined;

  const nearbyDriverMarkers = useMemo(
    () =>
      nearbyDrivers.map((driver) => ({
        id: driver.$id,
        name: driver.name,
        latitude: driver.location.latitude,
        longitude: driver.location.longitude,
        distanceMeters: driver.distanceMeters,
        estimatedPickupMinutes: driver.estimatedPickupMinutes,
        vehicleLabel: vehicleDisplayName(driver),
        registrationNumber: driver.vehicle.registrationNumber,
        isDemo: driver.isDemo,
      })),
    [nearbyDrivers],
  );

  const loadNearbyDrivers = useCallback(
    async (latitude: number, longitude: number, showFailureAlert = false) => {
      const requestId = ++nearbyRequestIdRef.current;
      setNearbyLoading(true);
      setNearbyError("");

      try {
        const result: NearbyDriversResponse = await getNearbyDrivers({
          latitude,
          longitude,
        });

        if (requestId !== nearbyRequestIdRef.current) return;

        const suitableDrivers = result.drivers.filter(
          (driver) => availableSeatCount(driver) >= passengerCount,
        );

        setNearbyDrivers(suitableDrivers);
        setNearbyRadiusKm(result.radiusKm);
        setNearbyGeneratedAt(result.generatedAt);
        setSelectedNearbyDriverId((current) =>
          suitableDrivers.some((driver) => driver.$id === current)
            ? current
            : null,
        );
      } catch (error) {
        if (requestId !== nearbyRequestIdRef.current) return;

        const message =
          error instanceof Error
            ? error.message
            : "Nearby drivers could not be loaded.";

        setNearbyDrivers([]);
        setNearbyGeneratedAt("");
        setNearbyError(message);

        if (showFailureAlert) {
          Alert.alert("Nearby drivers unavailable", message);
        }
      } finally {
        if (requestId === nearbyRequestIdRef.current) {
          setNearbyLoading(false);
        }
      }
    },
    [passengerCount],
  );

  useEffect(() => {
    if (
      !isHydrated ||
      !isInitialized ||
      !user ||
      !isStudentTenant(user) ||
      pickupLatitudeValue === undefined ||
      pickupLongitudeValue === undefined
    ) {
      nearbyRequestIdRef.current += 1;
      setNearbyLoading(false);
      setNearbyDrivers([]);
      setNearbyError("");
      setNearbyGeneratedAt("");
      setSelectedNearbyDriverId(null);
      return;
    }

    const timer = setTimeout(() => {
      void loadNearbyDrivers(pickupLatitudeValue, pickupLongitudeValue);
    }, 550);

    return () => clearTimeout(timer);
  }, [
    isHydrated,
    isInitialized,
    user,
    pickupLatitudeValue,
    pickupLongitudeValue,
    loadNearbyDrivers,
  ]);

  if (!isHydrated || !isInitialized) {
    return (
      <View
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!isStudentTenant(user)) {
    return <Redirect href={getUserHomeRoute(user) as any} />;
  }

  const useCurrentPickup = async () => {
    setLocatingPickup(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        throw new Error(
          "Location permission is needed to use your current pickup point.",
        );
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      setPickupCoordinates({
        latitude: latitude.toFixed(6),
        longitude: longitude.toFixed(6),
      });

      try {
        const places = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        const readable = places[0] ? formatAddress(places[0]) : "";
        if (readable) setPickupAddress(readable);
      } catch (reverseError) {
        console.warn("Could not reverse geocode pickup:", reverseError);
      }
    } catch (error) {
      Alert.alert(
        "Pickup location unavailable",
        error instanceof Error
          ? error.message
          : "Could not read your current location.",
      );
    } finally {
      setLocatingPickup(false);
    }
  };

  const refreshNearbyDrivers = async () => {
    if (
      pickupLatitudeValue === undefined ||
      pickupLongitudeValue === undefined
    ) {
      await useCurrentPickup();
      return;
    }

    await loadNearbyDrivers(pickupLatitudeValue, pickupLongitudeValue, true);
  };

  const showNearbyDriverOnMap = (driverId: string) => {
    setSelectedNearbyDriverId(driverId);
    destinationMapRef.current?.openFullScreen(driverId);
  };

  const selectDestinationFromMap = async ({
    latitude,
    longitude,
  }: RideMapCoordinate) => {
    setDestinationCoordinates({
      latitude: latitude.toFixed(6),
      longitude: longitude.toFixed(6),
    });
    setReverseGeocodingDestination(true);

    try {
      const places = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      const readable = places[0] ? formatAddress(places[0]) : "";

      if (readable) {
        setDestinationAddress(readable);
      }
    } catch (error) {
      console.warn("Could not reverse geocode destination:", error);
    } finally {
      setReverseGeocodingDestination(false);
    }
  };

  const findAddressCoordinates = async (
    address: string,
    setter: React.Dispatch<React.SetStateAction<Coordinates>>,
    setBusy: React.Dispatch<React.SetStateAction<boolean>>,
    label: string,
  ) => {
    const normalizedAddress = address.trim();

    if (!normalizedAddress) {
      Alert.alert(
        `${label} required`,
        `Enter the ${label.toLowerCase()} first.`,
      );
      return;
    }

    setBusy(true);

    try {
      const results = await Location.geocodeAsync(normalizedAddress);
      const first = results[0];

      if (!first) {
        throw new Error(
          `No coordinates were found for this ${label.toLowerCase()}. Enter the latitude and longitude manually.`,
        );
      }

      setter({
        latitude: first.latitude.toFixed(6),
        longitude: first.longitude.toFixed(6),
      });
    } catch (error) {
      Alert.alert(
        `${label} not found`,
        error instanceof Error
          ? error.message
          : `Could not locate this ${label.toLowerCase()}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const resolveCoordinates = async (
    address: string,
    current: Coordinates,
    label: string,
  ): Promise<{ latitude: number; longitude: number }> => {
    const currentLatitude = Number(current.latitude);
    const currentLongitude = Number(current.longitude);

    if (
      Number.isFinite(currentLatitude) &&
      currentLatitude >= -90 &&
      currentLatitude <= 90 &&
      Number.isFinite(currentLongitude) &&
      currentLongitude >= -180 &&
      currentLongitude <= 180
    ) {
      return {
        latitude: currentLatitude,
        longitude: currentLongitude,
      };
    }

    const results = await Location.geocodeAsync(address.trim());
    const first = results[0];

    if (!first) {
      throw new Error(
        `${label} coordinates are missing. Use the location button or enter valid latitude and longitude values.`,
      );
    }

    return {
      latitude: first.latitude,
      longitude: first.longitude,
    };
  };

  const onPickerChange = (event: DateTimePickerEvent, selectedValue?: Date) => {
    const activeMode = pickerMode;
    setPickerMode(null);

    if (event.type === "dismissed" || !selectedValue || !activeMode) {
      return;
    }

    const next = new Date(departureTime);

    if (activeMode === "date") {
      next.setFullYear(
        selectedValue.getFullYear(),
        selectedValue.getMonth(),
        selectedValue.getDate(),
      );
    } else {
      next.setHours(selectedValue.getHours(), selectedValue.getMinutes(), 0, 0);
    }

    setDepartureTime(next);
  };

  const submitRequest = async () => {
    const normalizedPickup = pickupAddress.trim();
    const normalizedDestination = destinationAddress.trim();

    if (!schoolLocation) {
      Alert.alert(
        "Institution missing",
        "Add your institution to your Nookly profile before requesting transport.",
      );
      return;
    }

    if (!normalizedPickup || !normalizedDestination) {
      Alert.alert(
        "Journey details required",
        "Enter both your pickup point and destination.",
      );
      return;
    }

    if (departureTime.getTime() < Date.now() - 60_000) {
      Alert.alert(
        "Choose a future time",
        "The requested departure time cannot be in the past.",
      );
      return;
    }

    const budget = proposedBudget.trim()
      ? Number(proposedBudget.trim())
      : undefined;

    if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) {
      Alert.alert(
        "Invalid budget",
        "Enter a valid proposed budget or leave it empty.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const [pickup, destination] = await Promise.all([
        resolveCoordinates(normalizedPickup, pickupCoordinates, "Pickup"),
        resolveCoordinates(
          normalizedDestination,
          destinationCoordinates,
          "Destination",
        ),
      ]);

      const created = await createStudentRideRequest({
        pickupAddress: normalizedPickup,
        pickupLatitude: parseCoordinate(
          String(pickup.latitude),
          "Pickup latitude",
          -90,
          90,
        ),
        pickupLongitude: parseCoordinate(
          String(pickup.longitude),
          "Pickup longitude",
          -180,
          180,
        ),
        destinationAddress: normalizedDestination,
        destinationLatitude: parseCoordinate(
          String(destination.latitude),
          "Destination latitude",
          -90,
          90,
        ),
        destinationLongitude: parseCoordinate(
          String(destination.longitude),
          "Destination longitude",
          -180,
          180,
        ),
        passengerCount,
        requestedDepartureTime: departureTime.toISOString(),
        ridePreference,
        proposedBudget: budget,
        currency: "USD",
        notes: notes.trim() || undefined,
      });

      router.replace({
        pathname: "/rides/request/[requestId]" as any,
        params: { requestId: created.$id },
      });
    } catch (error) {
      Alert.alert(
        "Could not create request",
        error instanceof Error
          ? error.message
          : "The ride request could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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

          <View className="ml-3 flex-1">
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Request a ride
            </Text>
            <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
              Drivers will respond with their prices
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        >
          <View
            className="mb-5 rounded-3xl border p-4"
            style={{
              backgroundColor: `${theme.primary[300]}09`,
              borderColor: `${theme.primary[300]}20`,
            }}
          >
            <View className="flex-row items-start">
              <Ionicons
                name="school-outline"
                size={22}
                color={theme.primary[300]}
              />
              <View className="ml-3 flex-1">
                <Text
                  className="text-xs font-rubik"
                  style={{ color: theme.muted }}
                >
                  Safety-monitoring institution
                </Text>
                <Text
                  className="mt-1 text-sm font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {schoolLocation || "Not set"}
                </Text>
              </View>
            </View>
          </View>

          <Text
            className="mb-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Pickup
          </Text>

          <View
            className="mb-5 rounded-3xl p-4"
            style={{ backgroundColor: theme.surface }}
          >
            <FieldLabel label="Pickup address" required theme={theme} />
            <TextInput
              value={pickupAddress}
              onChangeText={setPickupAddress}
              placeholder="Residence, gate, street or landmark"
              placeholderTextColor={theme.muted}
              multiline
              className="min-h-[54px] rounded-2xl border px-4 py-3 font-rubik"
              style={inputStyle}
            />

            <View className="mt-3 flex-row gap-2">
              <TouchableOpacity
                onPress={() => void useCurrentPickup()}
                disabled={locatingPickup}
                className="flex-1 flex-row items-center justify-center rounded-2xl px-3 py-3"
                style={{ backgroundColor: `${theme.primary[300]}12` }}
              >
                {locatingPickup ? (
                  <ActivityIndicator size="small" color={theme.primary[300]} />
                ) : (
                  <Ionicons
                    name="locate-outline"
                    size={18}
                    color={theme.primary[300]}
                  />
                )}
                <Text
                  className="ml-2 text-xs font-rubik-medium"
                  style={{ color: theme.primary[300] }}
                >
                  Current location
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  void findAddressCoordinates(
                    pickupAddress,
                    setPickupCoordinates,
                    setLocatingPickup,
                    "Pickup",
                  )
                }
                disabled={locatingPickup}
                className="flex-1 flex-row items-center justify-center rounded-2xl px-3 py-3"
                style={{ backgroundColor: theme.background }}
              >
                <Ionicons name="search-outline" size={18} color={theme.text} />
                <Text
                  className="ml-2 text-xs font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  Find address
                </Text>
              </TouchableOpacity>
            </View>

            <View className="mt-3 flex-row gap-2">
              <View className="flex-1">
                <FieldLabel label="Latitude" theme={theme} />
                <TextInput
                  value={pickupCoordinates.latitude}
                  onChangeText={(value) =>
                    setPickupCoordinates((current) => ({
                      ...current,
                      latitude: value,
                    }))
                  }
                  placeholder="-17.301000"
                  placeholderTextColor={theme.muted}
                  keyboardType="numbers-and-punctuation"
                  className="rounded-2xl border px-3 py-3 font-rubik"
                  style={inputStyle}
                />
              </View>

              <View className="flex-1">
                <FieldLabel label="Longitude" theme={theme} />
                <TextInput
                  value={pickupCoordinates.longitude}
                  onChangeText={(value) =>
                    setPickupCoordinates((current) => ({
                      ...current,
                      longitude: value,
                    }))
                  }
                  placeholder="31.331000"
                  placeholderTextColor={theme.muted}
                  keyboardType="numbers-and-punctuation"
                  className="rounded-2xl border px-3 py-3 font-rubik"
                  style={inputStyle}
                />
              </View>
            </View>
          </View>

          <View className="mb-5">
            <View className="mb-3 flex-row items-center justify-between">
              <View className="flex-1 pr-3">
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  Drivers near you
                </Text>
                <Text
                  className="mt-1 text-xs font-rubik"
                  style={{ color: theme.muted }}
                >
                  Online verified drivers within {nearbyRadiusKm.toFixed(0)} km
                  of your pickup
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => void refreshNearbyDrivers()}
                disabled={nearbyLoading}
                activeOpacity={0.75}
                className="h-11 min-w-[92px] flex-row items-center justify-center rounded-2xl border px-3"
                style={{
                  borderColor: `${theme.primary[300]}45`,
                  backgroundColor: `${theme.primary[300]}0B`,
                  opacity: nearbyLoading ? 0.65 : 1,
                }}
              >
                {nearbyLoading ? (
                  <ActivityIndicator size="small" color={theme.primary[300]} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={theme.primary[300]}
                  />
                )}
                <Text
                  className="ml-1.5 text-xs font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  Refresh
                </Text>
              </TouchableOpacity>
            </View>

            {pickupLatitudeValue === undefined ||
            pickupLongitudeValue === undefined ? (
              <TouchableOpacity
                onPress={() => void useCurrentPickup()}
                activeOpacity={0.8}
                className="flex-row items-center rounded-3xl border p-4"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: `${theme.muted}25`,
                }}
              >
                <View
                  className="h-11 w-11 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: `${theme.primary[300]}12` }}
                >
                  <Ionicons
                    name="navigate-outline"
                    size={22}
                    color={theme.primary[300]}
                  />
                </View>
                <View className="ml-3 flex-1">
                  <Text
                    className="text-sm font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Set your pickup location
                  </Text>
                  <Text
                    className="mt-1 text-xs font-rubik"
                    style={{ color: theme.muted }}
                  >
                    We use it only to find drivers within 1 km.
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.muted}
                />
              </TouchableOpacity>
            ) : nearbyLoading && nearbyDrivers.length === 0 ? (
              <View
                className="items-center justify-center rounded-3xl p-6"
                style={{ backgroundColor: theme.surface }}
              >
                <ActivityIndicator size="small" color={theme.primary[300]} />
                <Text
                  className="mt-3 text-sm font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  Finding nearby drivers…
                </Text>
              </View>
            ) : nearbyError ? (
              <View
                className="rounded-3xl border p-4"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: "#FCA5A5",
                }}
              >
                <View className="flex-row items-start">
                  <Ionicons
                    name="alert-circle-outline"
                    size={21}
                    color="#DC2626"
                  />
                  <View className="ml-2 flex-1">
                    <Text
                      className="text-sm font-rubik-bold"
                      style={{ color: theme.title }}
                    >
                      Could not load nearby drivers
                    </Text>
                    <Text
                      className="mt-1 text-xs font-rubik"
                      style={{ color: theme.muted }}
                    >
                      {nearbyError}
                    </Text>
                  </View>
                </View>
              </View>
            ) : nearbyDrivers.length === 0 ? (
              <View
                className="rounded-3xl border p-4"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: `${theme.muted}25`,
                }}
              >
                <View className="flex-row items-start">
                  <Ionicons name="car-outline" size={22} color={theme.muted} />
                  <View className="ml-3 flex-1">
                    <Text
                      className="text-sm font-rubik-bold"
                      style={{ color: theme.title }}
                    >
                      No suitable driver within 1 km
                    </Text>
                    <Text
                      className="mt-1 text-xs font-rubik"
                      style={{ color: theme.muted }}
                    >
                      Drivers may come online shortly. You can still submit a
                      request for verified drivers to review.
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    paddingRight: 8,
                    gap: 12,
                  }}
                >
                  {nearbyDrivers.map((driver) => {
                    const selected = selectedNearbyDriverId === driver.$id;
                    const pricingText =
                      driver.pricing.baseFare !== undefined
                        ? `From ${formatMarketplaceMoney(
                            driver.pricing.baseFare,
                            "USD",
                          )}`
                        : driver.pricing.pricePerKm !== undefined
                          ? `${formatMarketplaceMoney(
                              driver.pricing.pricePerKm,
                              "USD",
                            )}/km`
                          : "Driver sets the fare";

                    return (
                      <TouchableOpacity
                        key={driver.$id}
                        onPress={() => showNearbyDriverOnMap(driver.$id)}
                        activeOpacity={0.82}
                        className="rounded-3xl border p-4"
                        style={{
                          width: 286,
                          backgroundColor: theme.surface,
                          borderColor: selected
                            ? theme.primary[300]
                            : `${theme.muted}25`,
                          borderWidth: selected ? 2 : 1,
                        }}
                      >
                        <View className="flex-row items-start">
                          <View
                            className="h-12 w-12 items-center justify-center rounded-full"
                            style={{
                              backgroundColor: driver.isDemo
                                ? "#EDE9FE"
                                : `${theme.primary[300]}12`,
                            }}
                          >
                            <Ionicons
                              name="person"
                              size={22}
                              color={
                                driver.isDemo ? "#2a52be" : theme.primary[300]
                              }
                            />
                          </View>

                          <View className="ml-3 flex-1">
                            <View className="flex-row items-center">
                              <Text
                                numberOfLines={1}
                                className="flex-1 text-sm font-rubik-bold"
                                style={{ color: theme.title }}
                              >
                                {driver.name}
                              </Text>
                              <Ionicons
                                name="shield-checkmark"
                                size={17}
                                color="#DAA520"
                              />
                            </View>

                            <Text
                              className="mt-1 text-xs font-rubik"
                              style={{ color: theme.muted }}
                              numberOfLines={1}
                            >
                              {vehicleDisplayName(driver)}
                            </Text>

                            {driver.isDemo ? (
                              <View
                                className="mt-2 self-start rounded-full px-2 py-1"
                                style={{ backgroundColor: "#EDE9FE" }}
                              >
                                <Text className="text-[10px] font-rubik-bold text-[#2a52be]">
                                  Demo driver
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <View className="mt-4 flex-row gap-2">
                          <View
                            className="flex-1 rounded-2xl px-3 py-2.5"
                            style={{ backgroundColor: theme.background }}
                          >
                            <Text
                              className="text-[10px] font-rubik"
                              style={{ color: theme.muted }}
                            >
                              Distance
                            </Text>
                            <Text
                              className="mt-1 text-xs font-rubik-bold"
                              style={{ color: theme.title }}
                            >
                              {formatNearbyDistance(driver.distanceMeters)}
                            </Text>
                          </View>

                          <View
                            className="flex-1 rounded-2xl px-3 py-2.5"
                            style={{ backgroundColor: theme.background }}
                          >
                            <Text
                              className="text-[10px] font-rubik"
                              style={{ color: theme.muted }}
                            >
                              Pickup
                            </Text>
                            <Text
                              className="mt-1 text-xs font-rubik-bold"
                              style={{ color: theme.title }}
                            >
                              ~{driver.estimatedPickupMinutes} min
                            </Text>
                          </View>
                        </View>

                        <View className="mt-3 flex-row items-center justify-between">
                          <View className="flex-row items-center">
                            <Ionicons name="star" size={15} color="#F59E0B" />
                            <Text
                              className="ml-1 text-xs font-rubik-bold"
                              style={{ color: theme.title }}
                            >
                              {Number(driver.rating || 0).toFixed(1)}
                            </Text>
                            <Text
                              className="ml-2 text-xs font-rubik"
                              style={{ color: theme.muted }}
                            >
                              {availableSeatCount(driver)} seats
                            </Text>
                          </View>

                          <Text
                            className="text-xs font-rubik-bold"
                            style={{ color: theme.primary[300] }}
                          >
                            {pricingText}
                          </Text>
                        </View>

                        <View
                          className="mt-4 flex-row items-center justify-center rounded-2xl py-3"
                          style={{
                            backgroundColor: `${theme.primary[300]}10`,
                          }}
                        >
                          <Ionicons
                            name="map-outline"
                            size={17}
                            color={theme.primary[300]}
                          />
                          <Text
                            className="ml-2 text-xs font-rubik-bold"
                            style={{ color: theme.primary[300] }}
                          >
                            View driver on map
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text
                  className="mt-2 text-[10px] font-rubik"
                  style={{ color: theme.muted }}
                >
                  {nearbyDrivers.length} driver
                  {nearbyDrivers.length === 1 ? "" : "s"} available
                  {nearbyGeneratedAt
                    ? ` · Updated ${new Date(
                        nearbyGeneratedAt,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`
                    : ""}
                </Text>
              </>
            )}
          </View>

          <Text
            className="mb-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Destination
          </Text>

          <View
            className="mb-5 rounded-3xl p-4"
            style={{ backgroundColor: theme.surface }}
          >
            <FieldLabel label="Destination address" required theme={theme} />
            <TextInput
              value={destinationAddress}
              onChangeText={setDestinationAddress}
              placeholder="Where do you need to go?"
              placeholderTextColor={theme.muted}
              multiline
              className="min-h-[54px] rounded-2xl border px-4 py-3 font-rubik"
              style={inputStyle}
            />

            <TouchableOpacity
              onPress={() =>
                void findAddressCoordinates(
                  destinationAddress,
                  setDestinationCoordinates,
                  setLocatingDestination,
                  "Destination",
                )
              }
              disabled={locatingDestination}
              className="mt-3 flex-row items-center justify-center rounded-2xl px-3 py-3"
              style={{ backgroundColor: `${theme.primary[300]}12` }}
            >
              {locatingDestination ? (
                <ActivityIndicator size="small" color={theme.primary[300]} />
              ) : (
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.primary[300]}
                />
              )}
              <Text
                className="ml-2 text-xs font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                Find typed destination
              </Text>
            </TouchableOpacity>

            <View className="mt-4 overflow-hidden rounded-[18px]">
              <RideLocationPickerMap
                ref={destinationMapRef}
                selectedCoordinate={selectedDestination}
                initialCenter={mapCenter}
                originCoordinate={mapCenter}
                nearbyDrivers={nearbyDriverMarkers}
                onNearbyDriverPress={(driverId) =>
                  setSelectedNearbyDriverId(driverId)
                }
                onSelect={(coordinate) =>
                  void selectDestinationFromMap(coordinate)
                }
                darkMode={colorScheme === "dark"}
                height={270}
              />
            </View>

            <View
              className="mt-3 flex-row items-center rounded-2xl px-3 py-3"
              style={{ backgroundColor: theme.background }}
            >
              {reverseGeocodingDestination ? (
                <ActivityIndicator size="small" color={theme.primary[300]} />
              ) : (
                <Ionicons
                  name={selectedDestination ? "location" : "map-outline"}
                  size={18}
                  color={theme.primary[300]}
                />
              )}
              <View className="ml-2 flex-1 pr-3">
                <Text
                  className="text-xs font-rubik-medium"
                  style={{ color: theme.title }}
                >
                  {selectedDestination
                    ? "Destination selected"
                    : "Tap the map to choose your destination"}
                </Text>
                {selectedDestination ? (
                  <Text
                    className="mt-0.5 text-[11px] font-rubik"
                    style={{ color: theme.muted }}
                  >
                    {selectedDestination.latitude.toFixed(6)},{" "}
                    {selectedDestination.longitude.toFixed(6)}
                  </Text>
                ) : null}
              </View>

              <TouchableOpacity
                onPress={() => destinationMapRef.current?.openFullScreen()}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel="Open destination map in full screen"
                className="items-center justify-center rounded-2xl px-4 py-3"
                style={{
                  minWidth: 132,
                  minHeight: 48,
                  borderWidth: 1.5,
                  borderColor: colorScheme === "dark" ? "#F8FAFC" : "#0F172A",
                  backgroundColor:
                    colorScheme === "dark" ? "#F8FAFC" : "#0F172A",
                }}
              >
                <Text
                  className="text-sm font-rubik-bold"
                  style={{
                    color: colorScheme === "dark" ? "#0F172A" : "#F8FAFC",
                  }}
                >
                  Full Screen
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              className="mt-3 text-xs font-rubik"
              style={{ color: theme.muted }}
            >
              Search by name, then fine-tune the pin by tapping or dragging it
              on the map.
            </Text>
          </View>

          <Text
            className="mb-3 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Trip preferences
          </Text>

          <View
            className="mb-5 rounded-3xl p-4"
            style={{ backgroundColor: theme.surface }}
          >
            <FieldLabel label="Ride type" required theme={theme} />

            <View className="flex-row gap-2">
              {(
                [
                  {
                    value: "requested_private",
                    title: "Private",
                    subtitle: "Only your group",
                    icon: "person-outline",
                  },
                  {
                    value: "requested_shared",
                    title: "Shared",
                    subtitle: "Lower-cost option",
                    icon: "people-outline",
                  },
                ] as const
              ).map((option) => {
                const selected = ridePreference === option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => setRidePreference(option.value)}
                    className="flex-1 rounded-2xl border p-3"
                    style={{
                      borderColor: selected
                        ? theme.primary[300]
                        : `${theme.muted}25`,
                      backgroundColor: selected
                        ? `${theme.primary[300]}0D`
                        : theme.background,
                    }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={22}
                      color={selected ? theme.primary[300] : theme.muted}
                    />
                    <Text
                      className="mt-2 text-sm font-rubik-bold"
                      style={{ color: theme.title }}
                    >
                      {option.title}
                    </Text>
                    <Text
                      className="mt-0.5 text-xs font-rubik"
                      style={{ color: theme.muted }}
                    >
                      {option.subtitle}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View className="mt-5">
              <FieldLabel label="Passengers" required theme={theme} />
              <View className="flex-row items-center">
                <TouchableOpacity
                  onPress={() =>
                    setPassengerCount((current) => Math.max(1, current - 1))
                  }
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: theme.background }}
                >
                  <Ionicons name="remove" size={22} color={theme.text} />
                </TouchableOpacity>

                <Text
                  className="mx-6 min-w-[30px] text-center text-xl font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {passengerCount}
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    setPassengerCount((current) => Math.min(10, current + 1))
                  }
                  className="h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: theme.background }}
                >
                  <Ionicons name="add" size={22} color={theme.text} />
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-5">
              <FieldLabel label="Requested departure" required theme={theme} />

              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setPickerMode("date")}
                  className="flex-1 flex-row items-center rounded-2xl border px-3 py-3"
                  style={inputStyle}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={theme.primary[300]}
                  />
                  <Text
                    className="ml-2 flex-1 text-xs font-rubik-medium"
                    style={{ color: theme.text }}
                    numberOfLines={1}
                  >
                    {formatDateLabel(departureTime)}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setPickerMode("time")}
                  className="flex-1 flex-row items-center rounded-2xl border px-3 py-3"
                  style={inputStyle}
                >
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={theme.primary[300]}
                  />
                  <Text
                    className="ml-2 flex-1 text-xs font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {formatTimeLabel(departureTime)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View className="mt-5">
              <FieldLabel label="Proposed budget (optional)" theme={theme} />
              <View
                className="flex-row items-center rounded-2xl border px-4"
                style={inputStyle}
              >
                <Text className="font-rubik-bold" style={{ color: theme.text }}>
                  USD
                </Text>
                <TextInput
                  value={proposedBudget}
                  onChangeText={setProposedBudget}
                  placeholder="e.g. 5.00"
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
                Drivers still control the final quoted price.
              </Text>
            </View>

            <View className="mt-5">
              <FieldLabel label="Notes for drivers (optional)" theme={theme} />
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Luggage, accessibility needs, landmark, or other details"
                placeholderTextColor={theme.muted}
                multiline
                maxLength={1000}
                className="min-h-[100px] rounded-2xl border px-4 py-3 font-rubik"
                style={[inputStyle, { textAlignVertical: "top" }]}
              />
            </View>
          </View>

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
              Creating a request does not book a driver. Review the offers and
              confirm one driver before the ride is created.
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => void submitRequest()}
            disabled={submitting}
            activeOpacity={0.85}
            className="flex-row items-center justify-center rounded-2xl py-4"
            style={{
              backgroundColor: theme.primary[300],
              opacity: submitting ? 0.65 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="paper-plane-outline" size={20} color="#FFFFFF" />
            )}
            <Text className="ml-2 text-base font-rubik-bold text-white">
              {submitting ? "Sending request..." : "Send to verified drivers"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {pickerMode ? (
          <DateTimePicker
            value={departureTime}
            mode={pickerMode}
            minimumDate={new Date()}
            onChange={onPickerChange}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
