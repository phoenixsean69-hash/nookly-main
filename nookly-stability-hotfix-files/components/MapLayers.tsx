import { Colors } from "@/constants/Colors";
import { POI_CATEGORIES, getPOIs, type POICategoryId } from "@/lib/poiService";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";

interface MapLayersProps {
  visible: boolean;
  onClose: () => void;
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  activeLayers: string[];
  centerLatitude?: number;
  centerLongitude?: number;
}

const validCoordinates = (latitude?: number, longitude?: number): latitude is number =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === "number" &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

const emptyCounts = (): Record<POICategoryId, number> => ({
  schools: 0,
  universities: 0,
  hospitals: 0,
  shopping: 0,
  busTerminals: 0,
  policeStations: 0,
  restaurants: 0,
  parks: 0,
  fuelStations: 0,
});

export const MapLayers = ({
  visible,
  onClose,
  onLayerToggle,
  activeLayers,
  centerLatitude,
  centerLongitude,
}: MapLayersProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [poiCounts, setPoiCounts] = useState<Record<POICategoryId, number>>(emptyCounts);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!visible || !validCoordinates(centerLatitude, centerLongitude)) {
      setLoading(false);
      setError(null);
      setPoiCounts(emptyCounts());
      return () => {
        cancelled = true;
      };
    }

    const loadCounts = async () => {
      setLoading(true);
      setError(null);

      try {
        const pois = await getPOIs(
          centerLatitude,
          centerLongitude,
          3,
          undefined,
          retryKey > 0,
        );
        if (cancelled) return;

        const counts = emptyCounts();
        for (const poi of pois) counts[poi.categoryId] += 1;
        setPoiCounts(counts);
      } catch (caughtError) {
        if (cancelled) return;

        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Amenity counts could not be loaded.";
        console.warn("Map-layer POIs unavailable:", message);
        setError(message);
        setPoiCounts(emptyCounts());
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadCounts();
    return () => {
      cancelled = true;
    };
  }, [visible, centerLatitude, centerLongitude, retryKey]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl p-4 pb-8" style={{ backgroundColor: theme.background, maxHeight: "72%" }}>
          <View className="mb-4 flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-xl font-rubik-bold" style={{ color: theme.title }}>Map Layers</Text>
              <Text className="mt-1 text-sm" style={{ color: theme.muted }}>Show nearby places within 3 km</Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close layers">
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading && (
            <View className="mb-3 flex-row items-center rounded-xl px-3 py-2" style={{ backgroundColor: theme.surface }}>
              <ActivityIndicator size="small" color={theme.primary[300]} />
              <Text className="ml-2 text-sm" style={{ color: theme.muted }}>Checking nearby places...</Text>
            </View>
          )}

          {error && (
            <TouchableOpacity
              onPress={() => setRetryKey((value) => value + 1)}
              className="mb-3 flex-row items-center rounded-xl bg-amber-50 px-3 py-3"
            >
              <Ionicons name="cloud-offline-outline" size={18} color="#B45309" />
              <Text className="ml-2 flex-1 text-xs text-amber-700">Could not load counts. Tap to retry.</Text>
              <Ionicons name="refresh" size={17} color="#B45309" />
            </TouchableOpacity>
          )}

          <ScrollView showsVerticalScrollIndicator={false}>
            <View className="flex-row flex-wrap gap-2">
              {POI_CATEGORIES.map((category) => {
                const isActive = activeLayers.includes(category.id);
                const count = poiCounts[category.id];

                return (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => onLayerToggle(category.id, !isActive)}
                    className={`flex-row items-center rounded-xl px-4 py-3 ${isActive ? "border-2" : "border"}`}
                    style={{
                      backgroundColor: isActive ? `${category.color}20` : theme.surface,
                      borderColor: isActive ? category.color : `${theme.muted}30`,
                      minWidth: "47%",
                    }}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isActive }}
                  >
                    <View className="mr-2 h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: `${category.color}25` }}>
                      <Ionicons name={category.icon as any} size={16} color={category.color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-rubik-medium" style={{ color: isActive ? category.color : theme.text }} numberOfLines={1}>
                        {category.label}
                      </Text>
                      <Text className="text-xs" style={{ color: theme.muted }}>
                        {loading ? "Checking..." : `${count} locations`}
                      </Text>
                    </View>
                    {isActive && <Ionicons name="checkmark-circle" size={17} color={category.color} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <TouchableOpacity
            onPress={() => activeLayers.forEach((layerId) => onLayerToggle(layerId, false))}
            disabled={activeLayers.length === 0}
            className="mt-4 rounded-xl border border-red-500 py-3"
            style={{ opacity: activeLayers.length === 0 ? 0.45 : 1 }}
          >
            <Text className="text-center font-rubik-medium text-red-500">Clear All Layers</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default MapLayers;
