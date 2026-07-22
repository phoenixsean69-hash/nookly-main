import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface PropertyMapCardProps {
  latitude?: number | string | null;
  longitude?: number | string | null;
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

export const parseCoordinates = (latitude: unknown, longitude: unknown) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  )
    return null;
  return { latitude: lat, longitude: lng };
};

export const openExternalMap = async (
  latitude: number,
  longitude: number,
  label = "Property",
) => {
  const encodedLabel = encodeURIComponent(label);
  const nativeUrl = Platform.select({
    ios: `http://maps.apple.com/?ll=${latitude},${longitude}&q=${encodedLabel}`,
    android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodedLabel})`,
    default: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`,
  })!;
  const fallbackUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  try {
    const supported = await Linking.canOpenURL(nativeUrl);
    await Linking.openURL(supported ? nativeUrl : fallbackUrl);
  } catch {
    try {
      await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert(
        "Maps unavailable",
        "No maps application or browser could be opened.",
      );
    }
  }
};

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
  isFullScreen = false,
  onClose,
}: PropertyMapCardProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const coordinates = parseCoordinates(latitude, longitude);
  const [opening, setOpening] = useState(false);

  const openMaps = async () => {
    if (!coordinates || opening) return;
    setOpening(true);
    await openExternalMap(
      coordinates.latitude,
      coordinates.longitude,
      propertyName || address || "Property",
    );
    setOpening(false);
  };

  const content = (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}30`,
      }}
    >
      {propertyImage ? (
        <Image
          source={{ uri: propertyImage }}
          className="h-28 w-full"
          resizeMode="cover"
          accessibilityLabel={`${propertyName || "Property"} location`}
        />
      ) : (
        <View
          className="h-24 items-center justify-center"
          style={{ backgroundColor: theme.primary[100] }}
        >
          <Ionicons
            name="location-outline"
            size={38}
            color={theme.primary[300]}
          />
        </View>
      )}
      <View className="p-4">
        <View className="flex-row items-start gap-3">
          <View
            className="mt-0.5 h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.primary[100] }}
          >
            <Ionicons
              name="navigate-outline"
              size={20}
              color={theme.primary[300]}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-rubik-bold text-base"
              style={{ color: theme.title }}
              numberOfLines={1}
            >
              {propertyName || "Property location"}
            </Text>
            <Text
              className="mt-1 text-sm"
              style={{ color: theme.muted }}
              numberOfLines={2}
            >
              {address || "Address not available"}
            </Text>
          </View>
        </View>

        {propertyPrice || propertyType || bedrooms || bathrooms ? (
          <View className="mt-3 flex-row flex-wrap items-center gap-3">
            {!!propertyPrice && (
              <Text
                className="font-rubik-bold text-sm"
                style={{ color: theme.primary[300] }}
              >
                ${propertyPrice}/month
              </Text>
            )}
            {!!propertyType && (
              <Text className="text-xs" style={{ color: theme.muted }}>
                {propertyType}
              </Text>
            )}
            {!!bedrooms && (
              <Text className="text-xs" style={{ color: theme.muted }}>
                {bedrooms} bed
              </Text>
            )}
            {!!bathrooms && (
              <Text className="text-xs" style={{ color: theme.muted }}>
                {bathrooms} bath
              </Text>
            )}
          </View>
        ) : null}

        {coordinates ? (
          <>
            <Text className="mt-3 text-xs" style={{ color: theme.muted }}>
              {coordinates.latitude.toFixed(6)},{" "}
              {coordinates.longitude.toFixed(6)}
            </Text>
            <TouchableOpacity
              onPress={openMaps}
              disabled={opening}
              className="mt-4 flex-row items-center justify-center rounded-full py-3"
              style={{ backgroundColor: theme.primary[300] }}
              accessibilityRole="button"
              accessibilityLabel="Open property in maps"
            >
              {opening ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="open-outline" size={18} color="#FFFFFF" />
                  <Text className="ml-2 font-rubik-bold text-white">
                    Open in Maps
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View
            className="mt-4 flex-row items-center rounded-xl p-3"
            style={{ backgroundColor: theme.background }}
          >
            <Ionicons
              name="information-circle-outline"
              size={20}
              color={theme.muted}
            />
            <Text
              className="ml-2 flex-1 text-sm"
              style={{ color: theme.muted }}
            >
              Location coordinates are not available for this property.
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (isFullScreen) {
    return (
      <View
        className="flex-1 px-4"
        style={{ backgroundColor: theme.background }}
      >
        <View className="flex-row items-center justify-between py-3">
          <TouchableOpacity
            onPress={onClose}
            className="p-2"
            accessibilityLabel="Close location"
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text
            className="font-rubik-bold text-lg"
            style={{ color: theme.title }}
          >
            Property location
          </Text>
          <View className="w-10" />
        </View>
        <View className="mt-4">{content}</View>
      </View>
    );
  }

  return content;
};

export default PropertyMapCard;
