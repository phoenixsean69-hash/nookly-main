// components/PropertyMapCard.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

interface PropertyMapCardProps {
  latitude?: number | null;
  longitude?: number | null;
  propertyName?: string;
  address?: string;
  propertyImage?: string | null;
  propertyPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  isInline?: boolean;
  isFullScreen?: boolean;
  onClose?: () => void;
}

type Origin = {
  latitude: number;
  longitude: number;
  label: string;
};

type RouteInfo = {
  coords: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
};

type TravelMode = "driving" | "walking";

const WALKING_SPEED_KMH = 5;

const PropertyMapCard = ({
  latitude,
  longitude,
  propertyName,
  address,
  propertyImage,
  propertyPrice,
  propertyType,
  bedrooms,
  bathrooms,
  isInline = false,
  isFullScreen = false,
  onClose,
}: PropertyMapCardProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const mapRef = useRef<MapView>(null);

  // Map state
  const [mapType, setMapType] = useState<"standard" | "hybrid">("standard");

  // Directions state
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [originPickerVisible, setOriginPickerVisible] = useState(false);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("driving");

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const hasValidCoordinates = latitude && longitude;

  if (!hasValidCoordinates) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-gray-500">Location not available</Text>
      </View>
    );
  }

  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  // ==========================================================================
  // TOGGLE MAP TYPE
  // ==========================================================================
  const toggleMapType = () =>
    setMapType((prev) => (prev === "standard" ? "hybrid" : "standard"));

  // ==========================================================================
  // ROUTING (OSRM - OpenStreetMap Routing Machine) - FREE
  // ==========================================================================
  const fetchRoute = async (mode: TravelMode, from: Origin) => {
    if (!latitude || !longitude) return;
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${longitude},${latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== "Ok" || !data.routes?.length) {
        setRouteError("No route found");
        setLoadingRoute(false);
        return;
      }

      const r = data.routes[0];
      const coords = r.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({
          latitude: lat,
          longitude: lng,
        })
      );

      const distanceKm = r.distance / 1000;
      const durationMin =
        mode === "driving"
          ? r.duration / 60
          : (distanceKm / WALKING_SPEED_KMH) * 60;

      setRoute({ coords, distanceKm, durationMin });

      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 260, left: 60 },
          animated: true,
        });
      }, 300);
    } catch (e) {
      console.error("Error fetching route:", e);
      setRouteError("Could not get directions. Check your connection.");
    } finally {
      setLoadingRoute(false);
    }
  };

  // ==========================================================================
  // ORIGIN SELECTION
  // ==========================================================================
  const useMyLocation = async () => {
    setLoadingRoute(true);
    setRouteError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setRouteError("Location permission denied");
        setLoadingRoute(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const from: Origin = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        label: "Your location",
      };
      setOrigin(from);
      setOriginPickerVisible(false);
      await fetchRoute(travelMode, from);
    } catch {
      setRouteError("Could not get your location");
      setLoadingRoute(false);
    }
  };

  const startMapPick = () => {
    setOriginPickerVisible(false);
    setPickingOnMap(true);
  };

  const handleMapPress = async (e: any) => {
    if (!pickingOnMap) return;
    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
    const from: Origin = {
      latitude: lat,
      longitude: lng,
      label: "Pinned location",
    };
    setPickingOnMap(false);
    setOrigin(from);
    await fetchRoute(travelMode, from);
  };

  // ==========================================================================
  // SEARCH USING NOMINATIM (OpenStreetMap) - FREE
  // ==========================================================================
  const searchPlaces = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=5`,
        { headers: { "User-Agent": "RentifyApp/1.0" } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
      setSearchError("Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = async (item: any) => {
    const from: Origin = {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      label: item.display_name.split(",")[0],
    };
    setSearchQuery("");
    setSearchResults([]);
    setOriginPickerVisible(false);
    setOrigin(from);
    await fetchRoute(travelMode, from);
  };

  const switchTravelMode = (mode: TravelMode) => {
    setTravelMode(mode);
    if (route && origin) fetchRoute(mode, origin);
  };

  const clearRoute = () => {
    setRoute(null);
    setOrigin(null);
    setRouteError(null);
    mapRef.current?.animateToRegion(region, 400);
  };

  const closeFullMap = () => {
    if (onClose) {
      onClose();
    }
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}min`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return "";
    return `$${price}/month`;
  };

  // ==========================================================================
  // RENDER INLINE MAP
  // ==========================================================================
  if (isInline && !isFullScreen) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => {
          // This will be handled by the parent's onPress
        }}
        style={{ height: 200, borderRadius: 12, overflow: "hidden" }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          region={region}
          mapType={mapType}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Marker coordinate={{ latitude, longitude }} pinColor="#0061FF" />
        </MapView>

        {/* Property Info Overlay */}
        <View
          className="absolute bottom-0 left-0 right-0 p-3"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          {propertyImage && (
            <Image
              source={{ uri: propertyImage }}
              className="w-12 h-12 rounded-lg mr-3"
              resizeMode="cover"
            />
          )}

          <View className="flex-1">
            <Text className="text-white font-rubik-bold text-sm" numberOfLines={1}>
              {propertyName || "Property"}
            </Text>
            <Text className="text-white/70 text-xs" numberOfLines={1}>
              {address || "Address not available"}
            </Text>
            <View className="flex-row items-center mt-1">
              {propertyPrice && (
                <Text className="text-primary-300 font-rubik-bold text-xs">
                  {formatPrice(propertyPrice)}
                </Text>
              )}
              {bedrooms && (
                <View className="flex-row items-center ml-3">
                  <Ionicons name="bed-outline" size={12} color="#9CA3AF" />
                  <Text className="text-white/70 text-xs ml-1">{bedrooms}</Text>
                </View>
              )}
              {bathrooms && (
                <View className="flex-row items-center ml-3">
                  <Ionicons name="water-outline" size={12} color="#9CA3AF" />
                  <Text className="text-white/70 text-xs ml-1">{bathrooms}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Map Type Toggle Button */}
        <TouchableOpacity
          onPress={toggleMapType}
          className="absolute top-2 right-2 bg-white/90 px-3 py-1.5 rounded-full shadow"
        >
          <Text className="font-rubik-medium text-xs" style={{ color: "#191D31" }}>
            {mapType === "standard" ? "Satellite" : "Map"}
          </Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }

  // ==========================================================================
  // RENDER FULL SCREEN MAP - ONLY ONE HEADER
  // ==========================================================================
  if (isFullScreen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ✅ SINGLE HEADER - Only this one */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: theme.muted + '30' }}>
          <TouchableOpacity onPress={closeFullMap} className="p-2">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>
            {propertyName || "Property Location"}
          </Text>
          <TouchableOpacity onPress={toggleMapType} className="p-2">
            <Ionicons name="layers-outline" size={24} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Property Preview Bar */}
        <View
          className="flex-row items-center p-3 border-b"
          style={{ borderBottomColor: theme.muted + '20', backgroundColor: theme.surface }}
        >
          {propertyImage && (
            <Image
              source={{ uri: propertyImage }}
              className="w-14 h-14 rounded-lg mr-3"
              resizeMode="cover"
            />
          )}
          <View className="flex-1">
            <Text className="font-rubik-bold text-base" style={{ color: theme.title }} numberOfLines={1}>
              {propertyName || "Property"}
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }} numberOfLines={1}>
              {address || "Address not available"}
            </Text>
            <View className="flex-row items-center mt-1">
              {propertyPrice && (
                <Text className="font-rubik-bold text-primary-300 text-sm">
                  {formatPrice(propertyPrice)}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            onPress={() => {
              mapRef.current?.animateToRegion(region, 500);
            }}
            className="bg-primary-300 px-3 py-1.5 rounded-full"
          >
            <Text className="text-white text-xs font-rubik-bold">Center</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={region}
            mapType={mapType}
            showsUserLocation
            onPress={handleMapPress}
          >
            <Marker
              coordinate={{ latitude, longitude }}
              title={propertyName || "Property"}
              description={address}
              pinColor="#0061FF"
            />

            {origin && (
              <Marker
                coordinate={{
                  latitude: origin.latitude,
                  longitude: origin.longitude,
                }}
                title={origin.label}
                pinColor="#10B981"
              />
            )}

            {route && (
              <Polyline
                coordinates={route.coords}
                strokeWidth={5}
                strokeColor="#0061FF"
              />
            )}
          </MapView>

          {/* "Tap on map" instruction banner while picking origin */}
          {pickingOnMap && (
            <View className="absolute top-4 left-5 right-5 bg-black/75 rounded-2xl px-4 py-3">
              <Text className="text-white text-center font-rubik-medium">
                Tap anywhere on the map to set your starting point
              </Text>
              <TouchableOpacity onPress={() => setPickingOnMap(false)} className="mt-2">
                <Text className="text-center text-red-400 font-rubik-medium text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Directions Card - ALL IN-APP */}
          {!pickingOnMap && (
            <View
              className="absolute bottom-6 left-4 right-4 rounded-2xl p-4 shadow-lg"
              style={{
                backgroundColor: theme.background,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 8,
                elevation: 6,
              }}
            >
              {originPickerVisible ? (
                // Origin Picker
                <View>
                  <Text className="text-base font-rubik-bold mb-3" style={{ color: theme.title }}>
                    Directions from...
                  </Text>

                  <TouchableOpacity
                    onPress={useMyLocation}
                    className="flex flex-row items-center gap-2 py-3 border-b border-gray-100"
                  >
                    <Ionicons name="location" size={20} color="#0061FF" />
                    <Text className="font-rubik-medium text-primary-300">Your location</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={startMapPick}
                    className="flex flex-row items-center gap-2 py-3 border-b border-gray-100"
                  >
                    <Ionicons name="map-outline" size={20} color={theme.text} />
                    <Text className="font-rubik-medium" style={{ color: theme.text }}>
                      Choose on map
                    </Text>
                  </TouchableOpacity>

                  <TextInput
                    value={searchQuery}
                    onChangeText={searchPlaces}
                    placeholder="Search a place or address..."
                    placeholderTextColor={theme.muted}
                    className="mt-3 rounded-xl px-4 py-3 font-rubik"
                    style={{
                      backgroundColor: theme.surface,
                      color: theme.text,
                    }}
                  />

                  {searching && <ActivityIndicator size="small" color="#0061FF" className="mt-2" />}
                  {searchError && <Text className="text-red-500 text-sm mt-1">{searchError}</Text>}

                  {searchResults.length > 0 && (
                    <FlatList
                      data={searchResults}
                      keyExtractor={(item) => item.place_id?.toString()}
                      style={{ maxHeight: 160 }}
                      keyboardShouldPersistTaps="handled"
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => selectSearchResult(item)}
                          className="py-3 border-b border-gray-100"
                        >
                          <Text className="font-rubik text-sm" style={{ color: theme.text }} numberOfLines={2}>
                            {item.display_name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    />
                  )}

                  <TouchableOpacity
                    onPress={() => setOriginPickerVisible(false)}
                    className="mt-3 py-3 rounded-full"
                    style={{ backgroundColor: theme.surface }}
                  >
                    <Text className="text-center font-rubik-bold" style={{ color: theme.text }}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                // Directions Info
                <View>
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {propertyName || "Property Location"}
                  </Text>
                  {address && (
                    <Text
                      className="text-sm font-rubik mt-1"
                      style={{ color: theme.text }}
                      numberOfLines={2}
                    >
                      {address}
                    </Text>
                  )}

                  {origin && route && (
                    <Text
                      className="text-xs font-rubik mt-2"
                      style={{ color: theme.muted }}
                    >
                      From: {origin.label}
                    </Text>
                  )}

                  {route && (
                    <View className="flex flex-row items-center justify-between mt-3 bg-primary-100 rounded-xl px-4 py-3">
                      <View>
                        <Text className="font-rubik-bold text-base text-primary-300">
                          ~{formatDuration(route.durationMin)}
                        </Text>
                        <Text className="font-rubik text-xs" style={{ color: theme.text }}>
                          {route.distanceKm.toFixed(1)} km
                        </Text>
                      </View>

                      <View className="flex flex-row gap-2">
                        <TouchableOpacity
                          onPress={() => switchTravelMode("driving")}
                          className={`px-3 py-2 rounded-full ${
                            travelMode === "driving"
                              ? "bg-primary-300"
                              : "bg-gray-200"
                          }`}
                        >
                          <Text
                            className="font-rubik-medium text-xs"
                            style={{
                              color: travelMode === "driving" ? "#fff" : "#191D31",
                            }}
                          >
                            Drive
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => switchTravelMode("walking")}
                          className={`px-3 py-2 rounded-full ${
                            travelMode === "walking"
                              ? "bg-primary-300"
                              : "bg-gray-200"
                          }`}
                        >
                          <Text
                            className="font-rubik-medium text-xs"
                            style={{
                              color: travelMode === "walking" ? "#fff" : "#191D31",
                            }}
                          >
                            Walk
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {routeError && (
                    <Text className="text-red-500 text-sm font-rubik mt-2">
                      {routeError}
                    </Text>
                  )}

                  {!route ? (
                    <TouchableOpacity
                      onPress={() => setOriginPickerVisible(true)}
                      disabled={loadingRoute}
                      className="mt-3 py-3 rounded-full bg-primary-300 flex flex-row items-center justify-center"
                    >
                      {loadingRoute ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text className="text-white text-center font-rubik-bold">
                          Get Directions
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={clearRoute}
                      className="mt-3 py-3 rounded-full"
                      style={{ backgroundColor: theme.surface }}
                    >
                      <Text
                        className="text-center font-rubik-bold"
                        style={{ color: theme.text }}
                      >
                        Clear Route
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ==========================================================================
  // DEFAULT: This should not be reached
  // ==========================================================================
  return null;
};

export default PropertyMapCard;