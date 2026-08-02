import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  buildPropertyMapHtml,
  type PropertyMapRoute,
} from "@/lib/propertyMapHtml";
import {
  POI_CATEGORIES,
  type POI,
  type POICategoryId,
  type PropertyAmenities,
} from "@/lib/poiService";
import { getDrivingRoute } from "@/lib/routingService";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
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
  const amenityIconTint =
    colorScheme === "dark" ? "#F8FAFC" : "#111827";

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] =
    useState<POICategoryId | null>(null);
  const [selectedPOIId, setSelectedPOIId] = useState<string | null>(null);
  const [route, setRoute] = useState<PropertyMapRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

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

  const categories = useMemo<AmenityCategoryItem[]>(() => {
    if (!amenities) return [];

    return POI_CATEGORIES.map((category) => {
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
    }).filter((item) => item.count > 0);
  }, [allPOIs, amenities]);

  const selectedCategory =
    categories.find((item) => item.key === selectedCategoryId) ?? null;

  const selectedPOI =
    selectedCategory?.places.find((poi) => poi.id === selectedPOIId) ?? null;

  const canOpenMap = isValidCoordinate(
    propertyLatitude,
    propertyLongitude,
  );

  const closeModal = () => {
    setModalVisible(false);
    setSelectedPOIId(null);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(false);
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

  const selectPOI = async (poi: POI) => {
    if (!canOpenMap) return;

    setSelectedPOIId(poi.id);
    setRoute(null);
    setRouteError(null);
    setRouteLoading(true);

    try {
      const result = await getDrivingRoute(
        propertyLatitude,
        propertyLongitude!,
        poi.latitude,
        poi.longitude,
      );

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

      if (poi) {
        void selectPOI(poi);
      }
    } catch {
      // Ignore malformed messages from the embedded map.
    }
  };

  if (loading) {
    return (
      <View
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{ backgroundColor: theme.surface }}
      >
        <ActivityIndicator size="small" color={theme.primary[300]} />
        <Text className="ml-2 text-xs" style={{ color: theme.muted }}>
          Finding nearby amenities...
        </Text>
      </View>
    );
  }

  if (error && !amenities) {
    return (
      <TouchableOpacity
        onPress={onRetry}
        disabled={!onRetry}
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{
          backgroundColor: `${theme.danger}10`,
          borderWidth: 1,
          borderColor: `${theme.danger}30`,
        }}
      >
        <Ionicons name="cloud-offline-outline" size={19} color={theme.danger} />
        <View className="ml-2 flex-1">
          <Text
            className="text-xs font-rubik-medium"
            style={{ color: theme.text }}
          >
            Nearby amenities could not load
          </Text>
          <Text className="mt-0.5 text-[11px]" style={{ color: theme.muted }}>
            {onRetry
              ? "Tap to retry."
              : "Try again when the connection improves."}
          </Text>
        </View>
        {onRetry && (
          <Ionicons name="refresh" size={17} color={theme.primary[300]} />
        )}
      </TouchableOpacity>
    );
  }

  if (!amenities) return null;

  if (filteredTotal === 0) {
    return (
      <View
        className="flex-row items-center rounded-xl px-3 py-3"
        style={{ backgroundColor: theme.surface }}
      >
        <Ionicons
          name="information-circle-outline"
          size={18}
          color={theme.muted}
        />
        <Text className="ml-2 flex-1 text-xs" style={{ color: theme.muted }}>
          No mapped amenities were found within 2 km of this property.
        </Text>
      </View>
    );
  }

  if (compact) {
    return (
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
      </View>
    );
  }

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

  return (
    <>
      <View
        className="rounded-2xl border p-4"
        style={{
          backgroundColor: theme.surface,
          borderColor: `${theme.muted}25`,
        }}
      >
        <View className="mb-3 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <Ionicons
              name="navigate-circle-outline"
              size={22}
              color={theme.primary[300]}
            />
            <View className="ml-2">
              <Text
                className="font-rubik-bold text-base"
                style={{ color: theme.title }}
              >
                Nearby amenities within 2 km
              </Text>
              <Text className="text-[11px]" style={{ color: theme.muted }}>
                Tap a category to view places and routes
              </Text>
            </View>
          </View>
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

                  <View
                    className="mt-1 overflow-hidden"
                    style={{ height: 43 }}
                  >
                    {names.length > 0 ? (
                      names.map((name, index) => (
                        <Text
                          key={`${item.key}-${index}-${name}`}
                          className="text-[11px] leading-4"
                          style={{ color: theme.muted }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          • {name}
                        </Text>
                      ))
                    ) : (
                      <Text
                        className="text-[11px]"
                        style={{ color: theme.muted }}
                        numberOfLines={2}
                      >
                        Mapped places nearby
                      </Text>
                    )}

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
                      numberOfLines={1}
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
                  style={{
                    backgroundColor: `${selectedCategory.color}18`,
                  }}
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
          </View>

          {selectedCategory && canOpenMap && (
            <>
              <View
                className="h-[45%] overflow-hidden border-b"
                style={{ borderBottomColor: `${theme.muted}25` }}
              >
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
                        Finding route...
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
                    <View className="flex-row items-center justify-between">
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
                            Driving route: {route.distanceKm?.toFixed(1)} km •{" "}
                            {Math.max(
                              1,
                              Math.round(route.durationMinutes || 0),
                            )}{" "}
                            min
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
                        onPress={() =>
                          void openExternalDirections(
                            propertyLatitude,
                            propertyLongitude!,
                            selectedPOI,
                          )
                        }
                        className="flex-row items-center rounded-full px-3 py-2"
                        style={{
                          backgroundColor: selectedCategory.color,
                        }}
                      >
                        <Ionicons
                          name="navigate"
                          size={15}
                          color="#FFFFFF"
                        />
                        <Text className="ml-1 text-xs font-rubik-bold text-white">
                          Open
                        </Text>
                      </TouchableOpacity>
                    </View>
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
                    Tap a place to draw a driving route from the property.
                  </Text>

                  {selectedCategory.places.map((poi, index) => {
                    const selected = poi.id === selectedPOIId;

                    return (
                      <TouchableOpacity
                        key={poi.id}
                        onPress={() => void selectPOI(poi)}
                        activeOpacity={0.76}
                        className="mb-2 flex-row items-center rounded-2xl border p-3"
                        style={{
                          backgroundColor: selected
                            ? `${selectedCategory.color}12`
                            : theme.surface,
                          borderColor: selected
                            ? selectedCategory.color
                            : `${theme.muted}25`,
                        }}
                      >
                        <View
                          className="h-9 w-9 items-center justify-center rounded-full"
                          style={{
                            backgroundColor: selectedCategory.color,
                          }}
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
                    );
                  })}
                </ScrollView>
              </View>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
};

export default AmenitiesBadge;
