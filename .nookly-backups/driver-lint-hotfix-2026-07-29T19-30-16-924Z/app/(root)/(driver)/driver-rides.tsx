import DriverRideCard from "@/components/driver/DriverRideCard";
import { Colors } from "@/constants/Colors";
import { getDriverRides } from "@/services/driver.service";
import type { DriverRide } from "@/types/driver";
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

type Filter = "all" | "upcoming" | "completed";

export default function DriverRidesScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [rides, setRides] = useState<DriverRide[]>([]);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRides = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      setRides(await getDriverRides());
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load assigned rides.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadRides();
    }, [loadRides]),
  );

  const visibleRides = useMemo(() => {
    if (filter === "all") return rides;
    if (filter === "completed") {
      return rides.filter((ride) =>
        ["completed", "cancelled"].includes(ride.status),
      );
    }

    return rides.filter((ride) =>
      ["scheduled", "boarding", "active", "delayed"].includes(ride.status),
    );
  }, [filter, rides]);

  if (loading && rides.length === 0) {
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
      <View className="px-5 pb-3 pt-2">
        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Assigned rides
        </Text>
        <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
          View scheduled, active and completed assignments.
        </Text>

        <View className="mt-5 flex-row gap-2">
          {(["upcoming", "completed", "all"] as Filter[]).map((item) => {
            const selected = filter === item;

            return (
              <TouchableOpacity
                key={item}
                onPress={() => setFilter(item)}
                className="rounded-full px-4 py-2"
                style={{
                  backgroundColor: selected
                    ? theme.primary[300]
                    : theme.surface,
                  borderWidth: 1,
                  borderColor: selected
                    ? theme.primary[300]
                    : `${theme.muted}25`,
                }}
              >
                <Text
                  className="text-xs font-rubik-medium capitalize"
                  style={{
                    color: selected ? "#FFFFFF" : theme.text,
                  }}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error && (
        <TouchableOpacity
          onPress={() => void loadRides(true)}
          className="mx-5 mb-3 flex-row items-center rounded-xl p-3"
          style={{ backgroundColor: `${theme.danger}10` }}
        >
          <Ionicons name="warning-outline" size={18} color={theme.danger} />
          <Text className="ml-2 flex-1 text-sm" style={{ color: theme.text }}>
            {error}
          </Text>
          <Ionicons name="refresh" size={17} color={theme.primary[300]} />
        </TouchableOpacity>
      )}

      <FlatList
        data={visibleRides}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 110,
          flexGrow: visibleRides.length === 0 ? 1 : undefined,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadRides(true)}
          />
        }
        renderItem={({ item }) => (
          <DriverRideCard
            ride={item}
            onPress={() =>
              router.push({
                pathname: "/driver-ride-details",
                params: { rideId: item.$id },
              })
            }
          />
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center px-6">
            <Ionicons name="bus-outline" size={44} color={theme.muted} />
            <Text
              className="mt-4 text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              No rides here
            </Text>
            <Text
              className="mt-1 text-center text-sm"
              style={{ color: theme.muted }}
            >
              Your organization has not assigned rides in this category.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
