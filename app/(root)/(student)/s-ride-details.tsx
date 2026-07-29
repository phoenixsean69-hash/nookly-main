import {
  BusFront,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users,
  WifiOff,
} from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import {
  formatRideDateTime,
  formatRideFare,
  formatRideStatus,
  getRideDetails,
} from "@/services/rides.service";
import type { RideDetails } from "@/types/rides";

const DetailRow = ({
  icon,
  label,
  value,
  theme,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  theme: any;
}) => (
  <View className="flex-row items-center py-3">
    <View
      className="w-10 h-10 rounded-xl items-center justify-center mr-3"
      style={{ backgroundColor: `${theme.primary[300]}12` }}
    >
      {icon}
    </View>
    <View className="flex-1">
      <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
        {label}
      </Text>
      <Text
        className="text-sm font-rubik-medium mt-0.5"
        style={{ color: theme.text }}
      >
        {value}
      </Text>
    </View>
  </View>
);

const RideDetailsScreen = () => {
  const params = useLocalSearchParams<{ rideId?: string | string[] }>();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const rideId = Array.isArray(params.rideId) ? params.rideId[0] : params.rideId;
  const [ride, setRide] = useState<RideDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState("");

  const loadRide = useCallback(
    async (refresh = false) => {
      if (!rideId) {
        setError("Ride information is missing.");
        setLoading(false);
        return;
      }

      if (refresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      try {
        const result = await getRideDetails(rideId);
        setRide(result.ride);
        setFromCache(result.fromCache);
      } catch (loadError: any) {
        console.error("Unable to load ride details:", loadError);
        setError(
          loadError?.message ||
            "We could not load this ride. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [rideId],
  );

  useEffect(() => {
    loadRide();
  }, [loadRide]);

  const departure = useMemo(
    () => (ride ? formatRideDateTime(ride.departureTime) : null),
    [ride],
  );
  const arrival = useMemo(
    () => (ride ? formatRideDateTime(ride.estimatedArrivalTime) : null),
    [ride],
  );

  const showBookingMessage = () => {
    Alert.alert(
      "Secure booking is next",
      "Ride discovery is working. Seat reservations will be enabled through a secure Appwrite Function so students cannot change seat totals directly.",
      [{ text: "Okay" }],
    );
  };

  if (loading && !ride) {
    return (
      <SafeAreaView
        style={{ flex: 1, backgroundColor: theme.background }}
        className="items-center justify-center"
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="text-sm font-rubik mt-3" style={{ color: theme.muted }}>
          Loading ride details...
        </Text>
      </SafeAreaView>
    );
  }

  if (!ride) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-row items-center px-5 pt-2 pb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: theme.surface }}
          >
            <ChevronLeft size={24} color={theme.title} />
          </TouchableOpacity>
          <Text className="text-xl font-rubik-bold ml-3" style={{ color: theme.title }}>
            Ride details
          </Text>
        </View>
        <View className="flex-1 items-center justify-center px-7">
          <RefreshCw size={40} color={theme.primary[300]} />
          <Text
            className="text-lg font-rubik-bold text-center mt-4"
            style={{ color: theme.title }}
          >
            Unable to load this ride
          </Text>
          <Text
            className="text-sm font-rubik text-center mt-2"
            style={{ color: theme.muted }}
          >
            {error}
          </Text>
          <TouchableOpacity
            onPress={() => loadRide(true)}
            className="px-6 py-3 rounded-full mt-5"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-medium">Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const routeName = ride.route?.name || "Campus ride";
  const originName = ride.route?.originName || ride.stops[0]?.name || "Pickup point";
  const destinationName =
    ride.route?.destinationName ||
    ride.stops[ride.stops.length - 1]?.name ||
    "Destination";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View className="flex-row items-center px-5 pt-2 pb-4">
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-11 h-11 rounded-full items-center justify-center"
          style={{ backgroundColor: theme.surface }}
        >
          <ChevronLeft size={24} color={theme.title} />
        </TouchableOpacity>
        <View className="ml-3 flex-1">
          <Text className="text-xl font-rubik-bold" style={{ color: theme.title }}>
            Ride details
          </Text>
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            {ride.externalReference || ride.$id}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRide(true)}
            tintColor={theme.primary[300]}
          />
        }
      >
        {fromCache && (
          <View
            className="flex-row items-center rounded-2xl p-3 mb-4"
            style={{ backgroundColor: "#FFF4DE" }}
          >
            <WifiOff size={17} color="#B76A00" />
            <Text className="ml-2 flex-1 text-xs font-rubik" style={{ color: "#8A5200" }}>
              Showing saved ride information. Pull down to reconnect.
            </Text>
          </View>
        )}

        <View
          className="rounded-3xl p-5 mb-4"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <View className="absolute -right-8 -top-10 w-32 h-32 rounded-full bg-white/10" />
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xs font-rubik text-white/75">Route</Text>
              <Text className="text-2xl font-rubik-bold text-white mt-1">
                {routeName}
              </Text>
            </View>
            <View className="px-3 py-1.5 rounded-full bg-white/20">
              <Text className="text-xs font-rubik-medium text-white">
                {formatRideStatus(ride.status)}
              </Text>
            </View>
          </View>

          <View className="mt-5">
            <View className="flex-row items-center">
              <MapPin size={18} color="#FFFFFF" />
              <Text className="ml-2 text-sm font-rubik-medium text-white flex-1">
                {originName}
              </Text>
            </View>
            <View className="ml-2 my-1 h-6 w-[2px] rounded-full bg-white/35" />
            <View className="flex-row items-center">
              <Navigation size={18} color="#FFFFFF" />
              <Text className="ml-2 text-sm font-rubik-medium text-white flex-1">
                {destinationName}
              </Text>
            </View>
          </View>
        </View>

        <View
          className="rounded-3xl px-4 py-2 mb-4"
          style={{ backgroundColor: theme.surface }}
        >
          <DetailRow
            icon={<CalendarDays size={20} color={theme.primary[300]} />}
            label="Departure date"
            value={departure?.date || "Unavailable"}
            theme={theme}
          />
          <DetailRow
            icon={<Clock3 size={20} color={theme.primary[300]} />}
            label="Departure and estimated arrival"
            value={`${departure?.time || "—"} – ${arrival?.time || "—"}`}
            theme={theme}
          />
          <DetailRow
            icon={<Users size={20} color={theme.primary[300]} />}
            label="Seat availability"
            value={`${ride.availableSeats} of ${ride.totalSeats} seats available`}
            theme={theme}
          />
          <DetailRow
            icon={<CheckCircle2 size={20} color={theme.primary[300]} />}
            label="Fare per seat"
            value={formatRideFare(ride.fare, ride.currency)}
            theme={theme}
          />
        </View>

        <Text className="text-xl font-rubik-bold mb-3" style={{ color: theme.title }}>
          Driver and vehicle
        </Text>
        <View
          className="rounded-3xl p-4 mb-4"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row items-center mb-4">
            <View
              className="w-14 h-14 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: `${theme.primary[300]}16` }}
            >
              <UserRound size={27} color={theme.primary[300]} />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>
                {ride.driverName}
              </Text>
              <View className="flex-row items-center mt-1">
                <ShieldCheck size={15} color="#11824B" />
                <Text className="text-xs font-rubik ml-1" style={{ color: "#11824B" }}>
                  Institution-linked driver
                </Text>
              </View>
            </View>
          </View>

          <View
            className="rounded-2xl p-3"
            style={{ backgroundColor: theme.background }}
          >
            <View className="flex-row items-center">
              <BusFront size={20} color={theme.primary[300]} />
              <Text className="ml-2 text-sm font-rubik-medium flex-1" style={{ color: theme.text }}>
                {ride.vehicleColor} {ride.vehicleMake} {ride.vehicleModel}
              </Text>
            </View>
            <Text className="text-xs font-rubik mt-2 ml-7" style={{ color: theme.muted }}>
              Registration: {ride.vehicleRegistration}
            </Text>
          </View>
        </View>

        {ride.stops.length > 0 && (
          <>
            <Text className="text-xl font-rubik-bold mb-3" style={{ color: theme.title }}>
              Route stops
            </Text>
            <View
              className="rounded-3xl p-4 mb-4"
              style={{ backgroundColor: theme.surface }}
            >
              {ride.stops.map((stop, index) => (
                <View key={stop.$id} className="flex-row">
                  <View className="items-center mr-3">
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{
                        backgroundColor:
                          index === ride.stops.length - 1
                            ? "#FF6E6E"
                            : theme.primary[300],
                      }}
                    >
                      <Text className="text-xs font-rubik-bold text-white">
                        {index + 1}
                      </Text>
                    </View>
                    {index < ride.stops.length - 1 && (
                      <View className="w-[2px] h-12 bg-gray-300" />
                    )}
                  </View>
                  <View className="flex-1 pb-5">
                    <Text className="text-sm font-rubik-medium" style={{ color: theme.text }}>
                      {stop.name}
                    </Text>
                    <Text className="text-xs font-rubik mt-1" style={{ color: theme.muted }}>
                      About {stop.estimatedArrivalOffsetMinutes} min after departure
                    </Text>
                    <View className="flex-row mt-1">
                      {stop.isPickup && (
                        <Text className="text-[11px] font-rubik-medium mr-3" style={{ color: theme.primary[300] }}>
                          Pickup
                        </Text>
                      )}
                      {stop.isDropoff && (
                        <Text className="text-[11px] font-rubik-medium" style={{ color: "#FF6E6E" }}>
                          Drop-off
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {typeof ride.currentLatitude === "number" &&
          typeof ride.currentLongitude === "number" && (
            <>
              <Text className="text-xl font-rubik-bold mb-3" style={{ color: theme.title }}>
                Latest vehicle update
              </Text>
              <View
                className="rounded-3xl p-4 mb-4"
                style={{ backgroundColor: theme.surface }}
              >
                <DetailRow
                  icon={<Navigation size={20} color={theme.primary[300]} />}
                  label="Current coordinates"
                  value={`${ride.currentLatitude.toFixed(5)}, ${ride.currentLongitude.toFixed(5)}`}
                  theme={theme}
                />
                <DetailRow
                  icon={<Gauge size={20} color={theme.primary[300]} />}
                  label="Reported speed"
                  value={`${Math.round(ride.currentSpeedKph || 0)} km/h`}
                  theme={theme}
                />
              </View>
            </>
          )}

        <View
          className="rounded-3xl p-4 mb-3"
          style={{
            backgroundColor: `${theme.primary[300]}0D`,
            borderWidth: 1,
            borderColor: `${theme.primary[300]}25`,
          }}
        >
          <View className="flex-row items-start">
            <ShieldCheck size={21} color={theme.primary[300]} />
            <View className="flex-1 ml-3">
              <Text className="text-sm font-rubik-bold" style={{ color: theme.title }}>
                Secure booking protection
              </Text>
              <Text className="text-xs font-rubik mt-1" style={{ color: theme.muted }}>
                Seat changes will be processed by a secure backend function, not directly from the phone.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-3 pb-7"
        style={{
          backgroundColor: theme.navBackground,
          borderTopWidth: 1,
          borderTopColor: `${theme.muted}20`,
        }}
      >
        <TouchableOpacity
          onPress={showBookingMessage}
          disabled={!ride.bookingOpen || ride.availableSeats <= 0}
          className="rounded-2xl py-4 items-center justify-center"
          style={{
            backgroundColor:
              ride.bookingOpen && ride.availableSeats > 0
                ? theme.primary[300]
                : `${theme.muted}55`,
          }}
        >
          <Text className="text-base font-rubik-bold text-white">
            {!ride.bookingOpen
              ? "Booking closed"
              : ride.availableSeats <= 0
                ? "Ride is full"
                : "Reserve a seat"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default RideDetailsScreen;
