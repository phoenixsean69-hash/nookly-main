import {
  openExternalMap,
  parseCoordinates,
} from "@/components/PropertyMapCard";
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FullMapProps {
  visible: boolean;
  onClose: () => void;
  properties: any[];
  onPropertyPress?: (propertyId: string) => void;
}

const PROPERTY_TYPES = [
  "All",
  "Apartment",
  "House",
  "Boarding",
  "Luxury",
  "Studio",
];

const FullMap = ({
  visible,
  onClose,
  properties,
  onPropertyPress,
}: FullMapProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [query, setQuery] = useState("");
  const [propertyType, setPropertyType] = useState("All");

  const locatedProperties = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (properties || []).filter((property) => {
      if (!parseCoordinates(property.latitude, property.longitude))
        return false;
      if (propertyType !== "All" && property.type !== propertyType)
        return false;
      if (!normalizedQuery) return true;
      return [
        property.propertyName,
        property.address,
        property.city,
        property.type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery));
    });
  }, [properties, propertyType, query]);

  const openProperty = (property: any) => {
    onClose();
    if (onPropertyPress) onPropertyPress(property.$id);
    else router.push(`/properties/${property.$id}`);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          className="flex-row items-center justify-between border-b px-4 py-3"
          style={{ borderBottomColor: `${theme.muted}25` }}
        >
          <TouchableOpacity
            onPress={onClose}
            className="p-2"
            accessibilityLabel="Close property locations"
          >
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View className="items-center">
            <Text
              className="font-rubik-bold text-lg"
              style={{ color: theme.title }}
            >
              Property locations
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              {locatedProperties.length} with coordinates
            </Text>
          </View>
          <View className="w-10" />
        </View>

        <View className="px-4 pt-4">
          <View
            className="flex-row items-center rounded-2xl border px-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: `${theme.muted}30`,
            }}
          >
            <Ionicons name="search" size={19} color={theme.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search name, area, or address"
              placeholderTextColor={theme.muted}
              className="ml-2 flex-1 py-3 font-rubik"
              style={{ color: theme.text }}
            />
            {!!query && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={20} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
          <FlatList
            horizontal
            data={PROPERTY_TYPES}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
            renderItem={({ item }) => {
              const selected = propertyType === item;
              return (
                <TouchableOpacity
                  onPress={() => setPropertyType(item)}
                  className="rounded-full border px-4 py-2"
                  style={{
                    backgroundColor: selected
                      ? theme.primary[300]
                      : theme.surface,
                    borderColor: selected
                      ? theme.primary[300]
                      : `${theme.muted}30`,
                  }}
                >
                  <Text
                    className="font-rubik-medium text-sm"
                    style={{ color: selected ? "#FFFFFF" : theme.text }}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <FlatList
          data={locatedProperties}
          keyExtractor={(item, index) =>
            item.$id || `${item.latitude}-${item.longitude}-${index}`
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center px-8 py-20">
              <Ionicons name="location-outline" size={48} color={theme.muted} />
              <Text
                className="mt-4 text-center font-rubik-bold text-lg"
                style={{ color: theme.title }}
              >
                No matching locations
              </Text>
              <Text
                className="mt-2 text-center text-sm"
                style={{ color: theme.muted }}
              >
                Try another search or filter. Properties without valid
                coordinates are safely excluded.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const coordinates = parseCoordinates(
              item.latitude,
              item.longitude,
            )!;
            const image =
              item.image1 || item.image2 || item.image3 || item.image;
            return (
              <View
                className="overflow-hidden rounded-2xl border"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: `${theme.muted}25`,
                }}
              >
                <TouchableOpacity
                  onPress={() => openProperty(item)}
                  className="flex-row p-3"
                  accessibilityRole="button"
                >
                  {image ? (
                    <Image
                      source={{ uri: image }}
                      className="h-24 w-24 rounded-xl"
                      resizeMode="cover"
                      accessibilityLabel={item.propertyName || "Property"}
                    />
                  ) : (
                    <View
                      className="h-24 w-24 items-center justify-center rounded-xl"
                      style={{ backgroundColor: theme.primary[100] }}
                    >
                      <Ionicons
                        name="home-outline"
                        size={30}
                        color={theme.primary[300]}
                      />
                    </View>
                  )}
                  <View className="ml-3 flex-1">
                    <Text
                      className="font-rubik-bold text-base"
                      style={{ color: theme.title }}
                      numberOfLines={1}
                    >
                      {item.propertyName || "Property"}
                    </Text>
                    <Text
                      className="mt-1 text-sm"
                      style={{ color: theme.muted }}
                      numberOfLines={2}
                    >
                      {item.address || item.city || "Address not available"}
                    </Text>
                    {!!item.price && (
                      <Text
                        className="mt-2 font-rubik-bold"
                        style={{ color: theme.primary[300] }}
                      >
                        ${item.price}/month
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <View
                  className="flex-row border-t"
                  style={{ borderTopColor: `${theme.muted}20` }}
                >
                  <TouchableOpacity
                    onPress={() => openProperty(item)}
                    className="flex-1 flex-row items-center justify-center py-3"
                  >
                    <Ionicons
                      name="home-outline"
                      size={17}
                      color={theme.text}
                    />
                    <Text
                      className="ml-2 font-rubik-medium text-sm"
                      style={{ color: theme.text }}
                    >
                      View property
                    </Text>
                  </TouchableOpacity>
                  <View
                    className="w-px"
                    style={{ backgroundColor: `${theme.muted}20` }}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      openExternalMap(
                        coordinates.latitude,
                        coordinates.longitude,
                        item.propertyName || "Property",
                      )
                    }
                    className="flex-1 flex-row items-center justify-center py-3"
                  >
                    <Ionicons
                      name="navigate-outline"
                      size={17}
                      color={theme.primary[300]}
                    />
                    <Text
                      className="ml-2 font-rubik-bold text-sm"
                      style={{ color: theme.primary[300] }}
                    >
                      Open maps
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
};

export default FullMap;
