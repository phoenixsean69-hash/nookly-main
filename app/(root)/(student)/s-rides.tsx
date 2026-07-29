import { BusFront, ChevronLeft, RefreshCw, WifiOff } from "lucide-react-native";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import RideCard from "@/components/rides/RideCard";
import { Colors } from "@/constants/Colors";
import { getAvailableRidesForSchool } from "@/services/rides.service";
import useAuthStore from "@/store/auth.store";
import type { RideListItem } from "@/types/rides";

const titleCase = (value: string): string =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const RidesScreen = () => {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [rides, setRides] = useState<RideListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState("");

  const schoolLocation = user?.schoolLocation?.trim() || "";

  const loadRides = useCallback(
    async (showRefresh = false) => {
      if (!schoolLocation) {
        setRides([]);
        setError("Add your institution to your profile before viewing rides.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      setError("");
      try {
        const result = await getAvailableRidesForSchool(schoolLocation);
        setRides(result.rides);
        setFromCache(result.fromCache);
      } catch (loadError: any) {
        console.error("Unable to load Nookly Rides:", loadError);
        setRides([]);
        setFromCache(false);
        setError(
          loadError?.message ||
            "We could not load rides right now. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [schoolLocation],
  );

  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [loadRides]),
  );

  const openRide = useCallback((rideId: string) => {
    router.push({
      pathname: "/s-ride-details" as any,
      params: { rideId },
    });
  }, []);

  const renderHeader = () => (
    <View>
      <View
        className="rounded-3xl p-5 mb-5"
        style={{
          backgroundColor: theme.primary[300],
          shadowColor: "#0061FF",
          shadowOpacity: 0.18,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        }}
      >
        <View className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-white/10" />
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center mr-4">
            <BusFront size={30} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="text-xl font-rubik-bold text-white">
              Campus transport made simple
            </Text>
            <Text className="text-sm font-rubik text-white/85 mt-1">
              Browse verified rides, departure times and available seats.
            </Text>
          </View>
        </View>
      </View>

      <View className="mb-4">
        <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
          Rides serving
        </Text>
        <Text
          className="text-lg font-rubik-bold mt-1"
          style={{ color: theme.title }}
        >
          {schoolLocation ? titleCase(schoolLocation) : "Institution not set"}
        </Text>
      </View>

      {fromCache && (
        <View
          className="flex-row items-center rounded-2xl p-3 mb-4"
          style={{ backgroundColor: "#FFF4DE" }}
        >
          <WifiOff size={17} color="#B76A00" />
          <Text className="ml-2 flex-1 text-xs font-rubik" style={{ color: "#8A5200" }}>
            You are viewing the most recently saved ride information.
          </Text>
        </View>
      )}

      {rides.length > 0 && (
        <View className="flex-row items-center justify-between mb-3">
          <Text
            className="text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Available rides
          </Text>
          <Text className="text-sm font-rubik" style={{ color: theme.muted }}>
            {rides.length} {rides.length === 1 ? "ride" : "rides"}
          </Text>
        </View>
      )}
    </View>
  );

  const renderEmpty = () => {
    if (loading) {
      return (
        <View className="items-center justify-center py-20">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="text-sm font-rubik mt-3" style={{ color: theme.muted }}>
            Finding rides near your institution...
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
          className="w-16 h-16 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: `${theme.primary[300]}15` }}
        >
          {error ? (
            <RefreshCw size={28} color={theme.primary[300]} />
          ) : (
            <BusFront size={30} color={theme.primary[300]} />
          )}
        </View>
        <Text
          className="text-lg font-rubik-bold text-center"
          style={{ color: theme.title }}
        >
          {error ? "Unable to load rides" : "No active rides yet"}
        </Text>
        <Text
          className="text-sm font-rubik text-center mt-2"
          style={{ color: theme.muted }}
        >
          {error ||
            "Your institution has not published an active ride for this route yet."}
        </Text>
        <TouchableOpacity
          onPress={() => loadRides(true)}
          className="px-5 py-3 rounded-full mt-5"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <Text className="text-sm font-rubik-medium text-white">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
          <Text className="text-2xl font-rubik-bold" style={{ color: theme.title }}>
            Nookly Rides
          </Text>
          <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
            Safe institution-linked transport
          </Text>
        </View>
      </View>

      <FlatList
        data={rides}
        keyExtractor={(item) => item.$id}
        renderItem={({ item }) => (
          <RideCard ride={item} onPress={() => openRide(item.$id)} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadRides(true)}
            tintColor={theme.primary[300]}
          />
        }
      />
    </SafeAreaView>
  );
};

export default RidesScreen;
