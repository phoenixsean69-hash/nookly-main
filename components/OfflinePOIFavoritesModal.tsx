import OfflineRoutePreview from "@/components/OfflineRoutePreview";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import type { OfflinePOIFavorite } from "@/lib/poiOfflineService";
import type { POICategoryId } from "@/lib/poiService";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  type ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface OfflinePOIFavoritesModalProps {
  visible: boolean;
  favorites: OfflinePOIFavorite[];
  onClose: () => void;
  onRemove: (favoriteId: string) => Promise<void>;
}

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

const OfflinePOIFavoritesModal = ({
  visible,
  favorites,
  onClose,
  onRemove,
}: OfflinePOIFavoritesModalProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const iconTint = colorScheme === "dark" ? "#F8FAFC" : "#111827";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;

    setSelectedId((current) => {
      if (current && favorites.some((favorite) => favorite.id === current)) {
        return current;
      }
      return favorites[0]?.id ?? null;
    });
  }, [favorites, visible]);

  const selectedFavorite = useMemo(
    () => favorites.find((favorite) => favorite.id === selectedId) ?? null,
    [favorites, selectedId],
  );

  const removeFavorite = async (favoriteId: string) => {
    if (removingId) return;

    setRemovingId(favoriteId);
    try {
      await onRemove(favoriteId);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      navigationBarTranslucent={false}
      onRequestClose={onClose}
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
            onPress={onClose}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.surface }}
            accessibilityLabel="Close offline favorites"
          >
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </TouchableOpacity>

          <View className="ml-3 flex-1">
            <Text
              className="font-rubik-bold text-lg"
              style={{ color: theme.title }}
            >
              Offline amenity favorites
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              {favorites.length} saved place{favorites.length === 1 ? "" : "s"}
            </Text>
          </View>

          <View
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: `${theme.primary[300]}18` }}
          >
            <Ionicons name="heart" size={20} color={theme.primary[300]} />
          </View>
        </View>

        {selectedFavorite?.route ? (
          <View className="px-4 pt-4">
            <OfflineRoutePreview
              route={selectedFavorite.route}
              startLabel={selectedFavorite.propertyName}
              destinationLabel={selectedFavorite.poi.name}
              compact
            />
          </View>
        ) : selectedFavorite ? (
          <View
            className="mx-4 mt-4 flex-row items-center rounded-2xl border p-4"
            style={{
              backgroundColor: theme.surface,
              borderColor: `${theme.muted}25`,
            }}
          >
            <Ionicons
              name="cloud-offline-outline"
              size={24}
              color={theme.muted}
            />
            <View className="ml-3 flex-1">
              <Text
                className="text-sm font-rubik-bold"
                style={{ color: theme.title }}
              >
                Place saved offline
              </Text>
              <Text className="mt-1 text-xs" style={{ color: theme.muted }}>
                Its route has not been saved yet. Open it while online, draw the
                route, then tap Save route offline.
              </Text>
            </View>
          </View>
        ) : null}

        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingBottom: 28, paddingTop: 14 }}
          showsVerticalScrollIndicator={false}
        >
          {favorites.length === 0 ? (
            <View className="items-center px-8 py-16">
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.primary[100] }}
              >
                <Ionicons
                  name="heart-outline"
                  size={30}
                  color={theme.primary[300]}
                />
              </View>
              <Text
                className="mt-4 text-center text-base font-rubik-bold"
                style={{ color: theme.title }}
              >
                No offline amenity favorites
              </Text>
              <Text
                className="mt-2 text-center text-sm"
                style={{ color: theme.muted }}
              >
                Save a nearby place using its heart button. Its name, location,
                category and address will remain available without internet.
              </Text>
            </View>
          ) : (
            favorites.map((favorite) => {
              const selected = favorite.id === selectedId;
              const removing = favorite.id === removingId;

              return (
                <View
                  key={favorite.id}
                  className="mb-3 flex-row overflow-hidden rounded-2xl border"
                  style={{
                    backgroundColor: selected
                      ? `${theme.primary[300]}10`
                      : theme.surface,
                    borderColor: selected
                      ? theme.primary[300]
                      : `${theme.muted}25`,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedId(favorite.id)}
                    activeOpacity={0.76}
                    className="flex-1 flex-row items-center p-3"
                  >
                    <View
                      className="h-11 w-11 items-center justify-center rounded-xl"
                      style={{ backgroundColor: theme.primary[100] }}
                    >
                      <Image
                        source={CATEGORY_ICONS[favorite.poi.categoryId]}
                        className="h-6 w-6"
                        resizeMode="contain"
                        style={{ tintColor: iconTint }}
                      />
                    </View>

                    <View className="ml-3 flex-1">
                      <Text
                        className="text-sm font-rubik-bold"
                        style={{ color: theme.title }}
                        numberOfLines={1}
                      >
                        {favorite.poi.name}
                      </Text>
                      <Text
                        className="mt-0.5 text-xs"
                        style={{ color: theme.muted }}
                        numberOfLines={1}
                      >
                        {favorite.poi.categoryLabel} • {favorite.propertyName}
                      </Text>
                      <View className="mt-1 flex-row items-center">
                        <Ionicons
                          name={
                            favorite.route
                              ? "navigate-circle"
                              : "location-outline"
                          }
                          size={14}
                          color={
                            favorite.route
                              ? theme.primary[300]
                              : theme.muted
                          }
                        />
                        <Text
                          className="ml-1 text-[11px]"
                          style={{
                            color: favorite.route
                              ? theme.primary[300]
                              : theme.muted,
                          }}
                        >
                          {favorite.route
                            ? `${favorite.route.distanceKm.toFixed(1)} km route saved`
                            : `${favorite.poi.distanceKm.toFixed(1)} km from property`}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void removeFavorite(favorite.id)}
                    disabled={removing}
                    className="w-12 items-center justify-center"
                    accessibilityLabel={`Remove ${favorite.poi.name} from offline favorites`}
                  >
                    {removing ? (
                      <ActivityIndicator size="small" color={theme.danger} />
                    ) : (
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={theme.danger}
                      />
                    )}
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

export default OfflinePOIFavoritesModal;
