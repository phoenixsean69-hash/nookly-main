import OfflinePOIFavoritesModal from "@/components/OfflinePOIFavoritesModal";
import OfflineRoutePreview from "@/components/OfflineRoutePreview";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { buildPropertyMapHtml } from "@/lib/propertyMapHtml";
import {
  buildPOIFavoriteId,
  getOfflinePOIFavorites,
  removePOIFavorite,
  savePOIRouteOffline,
  subscribeToOfflinePOIFavorites,
  togglePOIFavorite,
  type OfflinePOIFavorite,
  type SavePOIFavoriteInput,
} from "@/lib/poiOfflineService";
import {
  POI_CATEGORIES,
  type POI,
  type POICategoryId,
  type PropertyAmenities,
} from "@/lib/poiService";
import {
  getCachedDrivingRoute,
  getDrivingRoute,
  saveDrivingRouteOffline,
  type DrivingRoute,
} from "@/lib/routingService";
import { useNetInfo } from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  WebView,
  type WebViewMessageEvent,
} from "react-native-webview";

interface AmenitiesBadgeProps {
  amenities: PropertyAmenities | null;
  pois?: POI[];
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPress?: () => void;
  compact?: boolean;
  propertyLatitude?: number | null;
  propertyLongitude?: number | null;
  propertyName?: string;
}

interface AmenityCategoryItem {
  key: POICategoryId;
  label: string;
  count: number;
  icon: ImageSourcePropType;
  color: string;
  places: POI[];
}

const MAX_DISPLAY_DISTANCE_KM = 2;

const CATEGORY_ICONS: Record<POICategoryId, ImageSourcePropType> = {
  schools: icons.openBook,
  universities: icons.mortarboard,
  hospitals: icons.hospital,
  shopping: icons.store,
  busTerminals: icons.busStation,
  policeStations: icons.policeStation,
  restaurants: icons.dinner,
  parks: icons.park,
  fuelStations: icons.gasStation,
};

const isValidCoordinate = (
  latitude?: number | null,
  longitude?: number | null,
): latitude is number =>
  typeof latitude === "number" &&
  Number.isFinite(latitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  typeof longitude === "number" &&
  Number.isFinite(longitude) &&
  longitude >= -180 &&
  longitude <= 180;

const openExternalDirections = async (
  propertyLatitude: number,
  propertyLongitude: number,
  poi: POI,
) => {
  const destination = `${poi.latitude},${poi.longitude}`;
  const origin = `${propertyLatitude},${propertyLongitude}`;
  const label = encodeURIComponent(poi.name);

  const nativeUrl = Platform.select({
    ios:
      `http://maps.apple.com/?saddr=${origin}` +
      `&daddr=${destination}&dirflg=d&q=${label}`,
    android: `google.navigation:q=${destination}&mode=d`,
    default:
      "https://www.openstreetmap.org/directions" +
      `?engine=fossgis_osrm_car&route=${encodeURIComponent(
        `${origin};${destination}`,
      )}`,
  })!;

  const fallbackUrl =
    "https://www.openstreetmap.org/directions" +
    `?engine=fossgis_osrm_car&route=${encodeURIComponent(
      `${origin};${destination}`,
    )}`;

  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(supported ? nativeUrl : fallbackUrl);
  } catch {
    await Linking.openURL(fallbackUrl);
  }
};

export const AmenitiesBadge = ({
  amenities,
  pois = [],
  loading,
  error,
  onRetry,
  onPress,
  compact = false,
  propertyLatitude,
  propertyLongitude,
  propertyName = "Property",
}: AmenitiesBadgeProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const netInfo = useNetInfo();
  const isOffline =
    netInfo.isConnected === false || netInfo.isInternetReachable === false;
  const amenityIconTint =
    colorScheme === "dark" ? "#F8FAFC" : "#111827";

  const [modalVisible, setModalVisible] = useState(false);
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<POICategoryId | null>(null);
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeSaving, setRouteSaving] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const [offlineFavorites, setOfflineFavorites] = useState<
    OfflinePOIFavorite[]
  >([]);

  const canOpenMap = isValidCoordinate(
    propertyLatitude,
    propertyLongitude,
  );

  const loadOfflineFavorites = useCallback(async () => {
    setOfflineFavorites(await getOfflinePOIFavorites());
  }, []);

  useEffect(() => {
    void loadOfflineFavorites();
    return subscribeToOfflinePOIFavorites(setOfflineFavorites);
  }, [loadOfflineFavorites]);

  const allPOIs = useMemo(
    () =>
      (pois.length > 0 ? pois : amenities?.nearbyPOIs ?? [])
        .filter(
          (poi) =>
            Number.isFinite(poi.distanceKm) &&
            poi.distanceKm <= MAX_DISPLAY_DISTANCE_KM,
        )
        .sort((first, second) => first.distanceKm - second.distanceKm),
    [amenities, pois],
  );

  const filteredTotal = allPOIs.length;
  const filteredNearestDistanceKm = allPOIs[0]?.distanceKm ?? null;

  const categories = useMemo<AmenityCategoryItem[]>(
    () =>
      POI_CATEGORIES.map((category) => {
        const places = allPOIs.filter(
          (poi) => poi.categoryId === category.id,
        );

        return {
          key: category.id,
          label: category.label,
          count: places.length,
          icon: CATEGORY_ICONS[category.id],
          color: category.color,
          places,
        };
      }).filter((item) => item.count > 0),
    [allPOIs],
  );

  const selectedCategory =
    categories.find((item) => item.key === selectedCategoryId) ?? null;
  const selectedPOI =
    selectedCategory?.places.find((poi) => poi.id === selectedPOIId) ?? null;

  const buildFavoriteInput = useCallback(
    (poi: POI): SavePOIFavoriteInput | null => {
      if (!canOpenMap) return null;

      return {
        poi,
        propertyName,
        propertyLatitude,
        propertyLongitude: propertyLongitude!,
      };
    }, [canOpenMap, propertyLatitude, propertyLongitude, propertyName],
  );

  const getFavoriteId = useCallback(
    (poi: POI): string | null => {
      if (!canOpenMap) return null;
      return buildPOIFavoriteId(
        propertyLatitude,
        propertyLongitude!,
        poi.id,
      );
    }, [canOpenMap, propertyLatitude, propertyLongitude],
  );

  const getFavorite = useCallback(
    (poi: POI): OfflinePOIFavorite | null => {
      const favoriteId = getFavoriteId(poi);
      if (!favoriteId) return null;
      return (
        offlineFavorites.find((favorite) => favorite.id === favoriteId) ?? null
      );
    }, [getFavoriteId, offlineFavorites],
  );

  const selectedFavorite = selectedPOI ? getFavorite(selectedPOI) : null;
  const selectedRouteSavedOffline = !!selectedFavorite?.route;

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPOIId(null);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(false);
    setRouteSaving(false);
  };

  const openSavedFavorites = () => {
    closeModal();
    setSavedModalVisible(true);
  };

  const openCategory = (categoryId: POICategoryId) => {
    if (!canOpenMap) {
      onPress?.();
      return;
    }

    setSelectedCategoryId(categoryId);
    setSelectedPOIId(null);
    setRoute(null);
    setRouteError(null);
    setModalVisible(true);
  };

  const toggleSavedPOI = async (poi: POI) => {
    const input = buildFavoriteInput(poi);
    const favoriteId = getFavoriteId(poi);
    if (!input || !favoriteId || favoriteBusyId) return;

    setFavoriteBusyId(favoriteId);
    try {
      await togglePOIFavorite(input);
    } catch (caughtError) {
      console.warn("Unable to update the offline POI favorite:", caughtError);
    } finally {
      setFavoriteBusyId(null);
    }
  };

  const selectPOI = async (poi: POI) => {
    if (!canOpenMap) return;

    setSelectedPOIId(poi.id);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);

    try {
      const result = isOffline
        ? await getCachedDrivingRoute(
            propertyLatitude,
            propertyLongitude!,
            poi.latitude,
            poi.longitude,
          )
        : await getDrivingRoute(
            propertyLatitude,
            propertyLongitude!,
            poi.latitude,
            poi.longitude,
          );

      if (!result) {
        throw new Error(
          "No offline route has been saved for this amenity yet.",
        );
      }

      setRoute(result);
    } catch (caughtError) {
      setRouteError(
        caughtError instanceof Error
          ? caughtError.message
          : "The route could not be loaded.",
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const saveSelectedRoute = async () => {
    if (!selectedPOI || !route || !canOpenMap || routeSaving) return;

    const input = buildFavoriteInput(selectedPOI);
    if (!input) return;

    setRouteSaving(true);
    try {
      const cachedRoute = await saveDrivingRouteOffline(
        propertyLatitude,
        propertyLongitude!,
        selectedPOI.latitude,
        selectedPOI.longitude,
        route,
      );

      await savePOIRouteOffline(input, cachedRoute);
      setRoute(cachedRoute);
    } catch (caughtError) {
      setRouteError(
        caughtError instanceof Error
          ? caughtError.message
          : "The route could not be saved offline.",
      );
    } finally {
      setRouteSaving(false);
    }
  };

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        poiId?: string;
      };

      if (message.type !== "poi-pressed" || !message.poiId) return;

      const poi = selectedCategory?.places.find(
        (item) => item.id === message.poiId,
      );

      if (poi) void selectPOI(poi);
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  };

  const mapHtml =
    selectedCategory && canOpenMap
      ? buildPropertyMapHtml({
          propertyLatitude,
          propertyLongitude: propertyLongitude!,
          propertyName,
          pois: selectedCategory.places,
          selectedPOIId,
          route,
          categoryColor: selectedCategory.color,
          initialZoom: 14,
          initialMapType: "hybrid",
          showMapTypeToggle: true,
        })
      : "";

  const savedButton = (
    <TouchableOpacity
      onPress={openSavedFavorites}
      activeOpacity={0.75}
      className="flex-row items-center rounded-full px-2.5 py-1.5"
      style={{ backgroundColor: `${theme.primary[300]}14` }}
      accessibilityLabel="Open offline amenity favorites"
    >
      <Ionicons name="heart" size={14} color={theme.primary[300]} />
      <Text
        className="ml-1 text-[11px] font-rubik-bold"
        style={{ color: theme.primary[300] }}
      >
        {offlineFavorites.length}
      </Text>
    </TouchableOpacity>
  );

  let content: React.ReactNode;

  if (loading) {
    content = (
      <View
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{ backgroundColor: theme.surface }}
      >
        <ActivityIndicator size="small" color={theme.primary[300]} />
        <Text className="ml-2 flex-1 text-xs" style={{ color: theme.muted }}>
          Loading cached nearby amenities...
        </Text>
        {savedButton}
      </View>
    );
  } else if (error && !amenities) {
    content = (
      <View
        className="rounded-xl border px-3 py-3"
        style={{
          backgroundColor: `${theme.danger}10`,
          borderColor: `${theme.danger}30`,
        }}
      >
        <View className="flex-row items-center">
          <Ionicons
            name="cloud-offline-outline"
            size={19}
            color={theme.danger}
          />
          <View className="ml-2 flex-1">
            <Text
              className="text-xs font-rubik-medium"
              style={{ color: theme.text }}
            >
              Nearby amenities could not load
            </Text>
            <Text className="mt-0.5 text-[11px]" style={{ color: theme.muted }}>
              Cached and saved amenities remain available offline.
            </Text>
          </View>
          {savedButton}
        </View>

        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            className="mt-3 flex-row items-center justify-center rounded-full py-2.5"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" />
            <Text className="ml-1.5 text-xs font-rubik-bold text-white">
              Refresh amenities
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  } else if (!amenities || filteredTotal === 0) {
    content = (
      <View
        className="rounded-xl border px-3 py-3"
        style={{
          backgroundColor: theme.surface,
          borderColor: `${theme.muted}25`,
        }}
      >
        <View className="flex-row items-center">
          <Ionicons
            name="information-circle-outline"
            size={18}
            color={theme.muted}
          />
          <Text className="ml-2 flex-1 text-xs" style={{ color: theme.muted }}>
            No mapped amenities were found within 2 km of this property.
          </Text>
          {savedButton}
        </View>
      </View>
    );
  } else if (compact) {
    content = (
      <View className="flex-row flex-wrap items-center gap-2">
        {categories.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={item.key}
            onPress={() => openCategory(item.key)}
            className="flex-row items-center rounded-full px-2 py-1"
            style={{ backgroundColor: `${item.color}18` }}
          >
            <Image
              source={item.icon}
              className="h-3.5 w-3.5"
              resizeMode="contain"
              style={{ tintColor: amenityIconTint }}
            />
            <Text className="ml-1 text-[10px]" style={{ color: item.color }}>
              {item.count}
            </Text>
          </TouchableOpacity>
        ))}
        {savedButton}
      </View>
    );
  } else {
    content = (
      <View
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: theme.surface,
          borderColor: `${theme.muted}25`,
        }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View className="mr-3 flex-1 flex-row items-center">
            <Ionicons
              name="navigate-circle-outline"
              size={22}
              color={theme.primary[300]}
            />
            <View className="ml-2 flex-1">
              <Text
                className="font-rubik-bold text-base"
                style={{ color: theme.title }}
              >
                Nearby amenities within 2 km
              </Text>
              <Text className="text-[11px]" style={{ color: theme.muted }}>
                Cached locally • tap a category for routes
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-2">
            {savedButton}
            {onRetry && (
              <TouchableOpacity
                onPress={onRetry}
                className="h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.primary[100] }}
                accessibilityLabel="Refresh nearby amenities"
              >
                <Ionicons
                  name="refresh"
                  size={15}
                  color={theme.primary[300]}
                />
              </TouchableOpacity>
            )}
            <View
              className="rounded-full px-2.5 py-1"
              style={{ backgroundColor: theme.primary[100] }}
            >
              <Text
                className="text-xs font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                {filteredTotal}
              </Text>
            </View>
          </View>
        </View>

        <View className="-mx-1 flex-row flex-wrap">
          {categories.map((item) => {
            const names = item.places.slice(0, 2).map((place) => place.name);
            const remaining = Math.max(0, item.count - names.length);

            return (
              <View key={item.key} className="mb-2 w-1/2 px-1">
                <TouchableOpacity
                  onPress={() => openCategory(item.key)}
                  activeOpacity={0.78}
                  className="overflow-hidden rounded-2xl border p-3"
                  style={{
                    height: 174,
                    backgroundColor: `${item.color}0D`,
                    borderColor: `${item.color}30`,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`View ${item.label} on map`}
                >
                  <View className="flex-row items-start justify-between">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${item.color}18` }}
                    >
                      <Image
                        source={item.icon}
                        className="h-7 w-7"
                        resizeMode="contain"
                        style={{ tintColor: amenityIconTint }}
                      />
                    </View>

                    <View
                      className="min-w-[28px] items-center rounded-full px-2 py-1"
                      style={{ backgroundColor: `${item.color}18` }}
                    >
                      <Text
                        className="text-[11px] font-rubik-bold"
                        style={{ color: item.color }}
                        numberOfLines={1}
                      >
                        {item.count}
                      </Text>
                    </View>
                  </View>

                  <Text
                    className="mt-2 text-sm font-rubik-bold"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>

                  <View className="mt-1 overflow-hidden" style={{ height: 43 }}>
                    {names.map((name, index) => (
                      <Text
                        key={`${item.key}-${index}-${name}`}
                        className="text-[11px] leading-4"
                        style={{ color: theme.muted }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        • {name}
                      </Text>
                    ))}

                    {remaining > 0 && (
                      <Text
                        className="text-[10px] font-rubik-medium"
                        style={{ color: item.color }}
                        numberOfLines={1}
                      >
                        +{remaining} more
                      </Text>
                    )}
                  </View>

                  <View
                    className="mt-auto flex-row items-center"
                    style={{ minHeight: 18 }}
                  >
                    <Text
                      className="text-[11px] font-rubik-bold"
                      style={{ color: item.color }}
                    >
                      View on map
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={13}
                      color={item.color}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {filteredNearestDistanceKm !== null && (
          <Text className="mt-1 text-[11px]" style={{ color: theme.muted }}>
            Closest mapped place is about{" "}
            {filteredNearestDistanceKm.toFixed(1)} km away.
          </Text>
        )}
      </View>
    );
  }

  return (
    <>
      {content}

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
        onRequestClose={closeModal}
      >
        <SafeAreaView
          className="flex-1"
          edges={["top", "right", "bottom", "left"]}
          style={{ backgroundColor: theme.background }}
        >
          <View
            className="flex-row items-center border-b px-4 py-3"
            style={{
              backgroundColor: theme.navBackground,
              borderBottomColor: `${theme.muted}25`,
            }}
          >
            <TouchableOpacity
              onPress={closeModal}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.surface }}
            >
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>

            {selectedCategory && (
              <>
                <View
                  className="ml-3 h-10 w-10 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${selectedCategory.color}18` }}
                >
                  <Image
                    source={selectedCategory.icon}
                    className="h-6 w-6"
                    resizeMode="contain"
                    style={{ tintColor: amenityIconTint }}
                  />
                </View>

                <View className="ml-3 flex-1">
                  <Text
                    className="font-rubik-bold text-lg"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {selectedCategory.label}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    {selectedCategory.count} near {propertyName}
                  </Text>
                </View>
              </>
            )}

            <TouchableOpacity
              onPress={openSavedFavorites}
              className="h-10 min-w-[42px] flex-row items-center justify-center rounded-full px-2"
              style={{ backgroundColor: `${theme.primary[300]}14` }}
            >
              <Ionicons name="heart" size={16} color={theme.primary[300]} />
              <Text
                className="ml-1 text-xs font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                {offlineFavorites.length}
              </Text>
            </TouchableOpacity>
          </View>

          {selectedCategory && canOpenMap && (
            <>
              <View
                className="h-[45%] overflow-hidden border-b"
                style={{ borderBottomColor: `${theme.muted}25` }}
              >
                {isOffline ? (
                  route ? (
                    <View
                      className="flex-1 justify-center p-3"
                      style={{ backgroundColor: theme.background }}
                    >
                      <OfflineRoutePreview
                        route={route}
                        startLabel={propertyName}
                        destinationLabel={selectedPOI?.name || "Destination"}
                      />
                    </View>
                  ) : (
                    <View
                      className="flex-1 items-center justify-center px-8"
                      style={{ backgroundColor: theme.surface }}
                    >
                      <Ionicons
                        name="cloud-offline-outline"
                        size={40}
                        color={theme.muted}
                      />
                      <Text
                        className="mt-3 text-center text-base font-rubik-bold"
                        style={{ color: theme.title }}
                      >
                        Offline map mode
                      </Text>
                      <Text
                        className="mt-2 text-center text-sm"
                        style={{ color: theme.muted }}
                      >
                        Tap a place with a previously saved route to display its
                        route without internet.
                      </Text>
                    </View>
                  )
                ) : (
                  <WebView
                    key={`${selectedCategory.key}-${selectedPOIId || "all"}-${
                      route?.coordinates.length || 0
                    }`}
                    source={{ html: mapHtml }}
                    originWhitelist={["*"]}
                    javaScriptEnabled
                    domStorageEnabled
                    onMessage={handleMapMessage}
                    setSupportMultipleWindows={false}
                    startInLoadingState
                    renderLoading={() => (
                      <View
                        className="absolute inset-0 items-center justify-center"
                        style={{ backgroundColor: theme.surface }}
                      >
                        <ActivityIndicator
                          size="large"
                          color={theme.primary[300]}
                        />
                        <Text
                          className="mt-2 text-xs"
                          style={{ color: theme.muted }}
                        >
                          Loading map...
                        </Text>
                      </View>
                    )}
                  />
                )}

                {routeLoading && (
                  <View className="absolute inset-0 items-center justify-center bg-black/20">
                    <View
                      className="flex-row items-center rounded-full px-4 py-3"
                      style={{ backgroundColor: theme.navBackground }}
                    >
                      <ActivityIndicator
                        size="small"
                        color={theme.primary[300]}
                      />
                      <Text
                        className="ml-2 text-sm font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {isOffline
                          ? "Checking saved route..."
                          : "Finding route..."}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View className="flex-1">
                {selectedPOI && (
                  <View
                    className="border-b px-4 py-3"
                    style={{
                      backgroundColor: theme.navBackground,
                      borderBottomColor: `${theme.muted}20`,
                    }}
                  >
                    <View className="flex-row items-center">
                      <View className="mr-3 flex-1">
                        <Text
                          className="font-rubik-bold text-sm"
                          style={{ color: theme.title }}
                          numberOfLines={1}
                        >
                          {selectedPOI.name}
                        </Text>

                        {route ? (
                          <Text
                            className="mt-1 text-xs"
                            style={{ color: selectedCategory.color }}
                          >
                            Driving route: {route.distanceKm.toFixed(1)} km •{" "}
                            {Math.max(1, Math.round(route.durationMinutes))} min
                            {route.source === "cache" ? " • cached" : ""}
                          </Text>
                        ) : routeError ? (
                          <Text
                            className="mt-1 text-xs"
                            style={{ color: theme.danger }}
                          >
                            {routeError}
                          </Text>
                        ) : (
                          <Text
                            className="mt-1 text-xs"
                            style={{ color: theme.muted }}
                          >
                            {selectedPOI.distanceKm.toFixed(1)} km straight-line
                            distance
                          </Text>
                        )}
                      </View>

                      <TouchableOpacity
                        onPress={() => void toggleSavedPOI(selectedPOI)}
                        disabled={favoriteBusyId === getFavoriteId(selectedPOI)}
                        className="mr-2 h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: `${selectedCategory.color}15` }}
                        accessibilityLabel={
                          selectedFavorite
                            ? `Remove ${selectedPOI.name} from favorites`
                            : `Save ${selectedPOI.name} to offline favorites`
                        }
                      >
                        {favoriteBusyId === getFavoriteId(selectedPOI) ? (
                          <ActivityIndicator
                            size="small"
                            color={selectedCategory.color}
                          />
                        ) : (
                          <Ionicons
                            name={selectedFavorite ? "heart" : "heart-outline"}
                            size={20}
                            color={selectedCategory.color}
                          />
                        )}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() =>
                          void openExternalDirections(
                            propertyLatitude,
                            propertyLongitude!,
                            selectedPOI,
                          )
                        }
                        className="flex-row items-center rounded-full px-3 py-2.5"
                        style={{ backgroundColor: selectedCategory.color }}
                      >
                        <Ionicons name="navigate" size={15} color="#FFFFFF" />
                        <Text className="ml-1 text-xs font-rubik-bold text-white">
                          Open
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {route && (
                      <TouchableOpacity
                        onPress={() => void saveSelectedRoute()}
                        disabled={routeSaving || selectedRouteSavedOffline}
                        className="mt-3 flex-row items-center justify-center rounded-full border py-2.5"
                        style={{
                          backgroundColor: selectedRouteSavedOffline
                            ? `${theme.primary[300]}12`
                            : theme.surface,
                          borderColor: selectedRouteSavedOffline
                            ? theme.primary[300]
                            : `${theme.muted}30`,
                        }}
                      >
                        {routeSaving ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.primary[300]}
                          />
                        ) : (
                          <Ionicons
                            name={
                              selectedRouteSavedOffline
                                ? "cloud-done-outline"
                                : "cloud-download-outline"
                            }
                            size={17}
                            color={theme.primary[300]}
                          />
                        )}
                        <Text
                          className="ml-2 text-xs font-rubik-bold"
                          style={{ color: theme.primary[300] }}
                        >
                          {selectedRouteSavedOffline
                            ? "Route saved for offline use"
                            : "Save route offline"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <ScrollView
                  className="flex-1 px-4"
                  contentContainerStyle={{ paddingVertical: 12 }}
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    className="mb-2 text-xs font-rubik-medium"
                    style={{ color: theme.muted }}
                  >
                    Tap a place to draw a driving route. Heart buttons save full
                    POI details for offline use.
                  </Text>

                  {selectedCategory.places.map((poi, index) => {
                    const selected = poi.id === selectedPOIId;
                    const favorite = getFavorite(poi);
                    const favoriteId = getFavoriteId(poi);
                    const favoriteBusy = favoriteBusyId === favoriteId;

                    return (
                      <View
                        key={poi.id}
                        className="mb-2 flex-row overflow-hidden rounded-2xl border"
                        style={{
                          backgroundColor: selected
                            ? `${selectedCategory.color}12`
                            : theme.surface,
                          borderColor: selected
                            ? selectedCategory.color
                            : `${theme.muted}25`,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => void selectPOI(poi)}
                          activeOpacity={0.76}
                          className="flex-1 flex-row items-center p-3"
                        >
                          <View
                            className="h-9 w-9 items-center justify-center rounded-full"
                            style={{ backgroundColor: selectedCategory.color }}
                          >
                            <Text className="text-xs font-rubik-bold text-white">
                              {index + 1}
                            </Text>
                          </View>

                          <View className="ml-3 flex-1">
                            <Text
                              className="text-sm font-rubik-bold"
                              style={{ color: theme.title }}
                              numberOfLines={1}
                            >
                              {poi.name}
                            </Text>
                            <Text
                              className="mt-0.5 text-xs"
                              style={{ color: theme.muted }}
                              numberOfLines={1}
                            >
                              {poi.address ||
                                `${poi.distanceKm.toFixed(1)} km from property`}
                            </Text>
                            {favorite?.route && (
                              <Text
                                className="mt-0.5 text-[10px] font-rubik-medium"
                                style={{ color: theme.primary[300] }}
                              >
                                Offline route saved
                              </Text>
                            )}
                          </View>

                          <View className="ml-2 items-end">
                            <Text
                              className="text-xs font-rubik-bold"
                              style={{ color: selectedCategory.color }}
                            >
                              {poi.distanceKm.toFixed(1)} km
                            </Text>
                            <Ionicons
                              name={
                                selected
                                  ? "navigate-circle"
                                  : "navigate-circle-outline"
                              }
                              size={20}
                              color={selectedCategory.color}
                            />
                          </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => void toggleSavedPOI(poi)}
                          disabled={favoriteBusy}
                          className="w-12 items-center justify-center"
                          accessibilityLabel={
                            favorite
                              ? `Remove ${poi.name} from favorites`
                              : `Save ${poi.name} to offline favorites`
                          }
                        >
                          {favoriteBusy ? (
                            <ActivityIndicator
                              size="small"
                              color={selectedCategory.color}
                            />
                          ) : (
                            <Ionicons
                              name={favorite ? "heart" : "heart-outline"}
                              size={21}
                              color={selectedCategory.color}
                            />
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <OfflinePOIFavoritesModal
        visible={savedModalVisible}
        favorites={offlineFavorites}
        onClose={() => setSavedModalVisible(false)}
        onRemove={removePOIFavorite}
      />
    </>
  );
};

export default AmenitiesBadge;
