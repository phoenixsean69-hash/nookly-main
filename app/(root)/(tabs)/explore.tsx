// app/(root)/explore.tsx
import FullMap from "@/components/FullMap";
import HotDealsFilter from "@/components/HotDealsFilter";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/Cards";
import { FacilitiesFilter } from "@/components/FacilitiesFilter";
import Filters from "@/components/Filters";
import NoResults from "@/components/NoResults";
import { PriceFilterButton } from "@/components/PriceFilterButton";
import SearchModal from "@/components/SearchModal";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { isAccredited } from "@/lib/accreditation";
import { getPropertiesWithFilters, PriceRange } from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import { Ionicons } from "@expo/vector-icons";

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

const Explore = () => {
  const params = useLocalSearchParams<{ filter?: string; query?: string; location?: string }>();
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHotDeals, setShowHotDeals] = useState(false);
  const [showAccreditedOnly, setShowAccreditedOnly] = useState(false);

  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRange | undefined>();
  const [selectedCustomPrice, setSelectedCustomPrice] = useState<{ min: number; max: number } | undefined>();
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | undefined>();

  const [locationInput, setLocationInput] = useState<string>(params.location || "");
  const [selectedLocation, setSelectedLocation] = useState<string>(params.location || "");
  const [fullMapVisible, setFullMapVisible] = useState(false);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme?? "light"];
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSelectedLocation(locationInput), 500);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [locationInput]);

  // Light pins for banner count - super fast
  const { data: mapPins } = useAppwrite({
    fn: async () => {
      const res = await getPropertiesWithFilters({
        filter: "",
        query: "",
        limit: 100,
        select: ["$id", "latitude", "longitude"],
      } as any);
      return res;
    },
    cacheKey: "map_pins_light",
    ttl: 10 * 60 * 1000,
  });

  // Full data for FullMap screen
  const { data: allProperties, refetch: refetchMapFull } = useAppwrite({
    fn: async () => {
      const res = await getPropertiesWithFilters({
        filter: "",
        query: "",
        limit: 100,
        select: ["$id", "latitude", "longitude", "propertyName", "address", "price", "image1", "type", "bedrooms", "reviews", "$createdAt"],
      } as any);
      return res;
    },
    cacheKey: "map_pins_full",
    ttl: 10 * 60 * 1000,
  });

  const filterParams = useMemo(() => ({
    filter: params.filter || "",
    query: params.query || "",
    limit: 20,
    priceRange: selectedPriceRange,
    customPrice: selectedCustomPrice,
    facilities: selectedFacilities,
    bedrooms: selectedBedrooms,
    location: selectedLocation,
  }), [params.filter, params.query, selectedPriceRange, selectedCustomPrice, selectedFacilities, selectedBedrooms, selectedLocation]);

  const cacheKey = useMemo(() => {
    return `explore_${filterParams.filter}_${filterParams.query}_${filterParams.location}_${filterParams.bedrooms}_${filterParams.facilities.join("-")}_${filterParams.priceRange?.label || "all"}_${filterParams.customPrice? `${filterParams.customPrice.min}-${filterParams.customPrice.max}` : "all"}`;
  }, [filterParams]);

  const { data: properties, refetch, loading } = useAppwrite({
    fn: (p: any) => getPropertiesWithFilters(p),
    params: filterParams,
    cacheKey,
    ttl: 60 * 1000,
  });

  const prevParamsRef = useRef<string>("");
  useEffect(() => {
    const key = JSON.stringify(filterParams);
    if (prevParamsRef.current!== key) {
      prevParamsRef.current = key;
      refetch(filterParams);
    }
  }, [filterParams]);

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    return properties.filter((property: any) => {
      if (showAccreditedOnly &&!isAccredited(property.reviews, property.$createdAt)) return false;
      if (showHotDeals) {
        const hasDrop = property.new_price!= null && property.new_price < property.price;
        if (!hasDrop) return false;
      }
      return true;
    });
  }, [properties, showAccreditedOnly, showHotDeals]);

  const priceDropCount = useMemo(() => {
    return properties?.filter((p: any) => p.new_price!= null && p.new_price < p.price).length || 0;
  }, [properties]);

  const handleCardPress = useCallback((id: string) => router.push(`/properties/${id}` as any), []);

  const handleOpenFullMap = useCallback(async () => {
    // Ensure full data loaded before opening
    if (!allProperties || allProperties.length === 0) {
      await refetchMapFull({
        filter: "",
        query: "",
        limit: 100,
        select: ["$id", "latitude", "longitude", "propertyName", "address", "price", "image1", "type", "bedrooms"],
      } as any);
    }
    setFullMapVisible(true);
  }, [allProperties]);

  const ListHeader = useCallback(() => (
    <View className="px-5 pt-5 pb-2">
      <Text className="text-xl text-center font-rubik-bold mt-1 mb-4" style={{ color: theme.muted }}>
        Discover your next Property
      </Text>

      <TouchableOpacity
        onPress={handleOpenFullMap}
        activeOpacity={0.9}
        className="mb-3 rounded-2xl overflow-hidden"
        style={{ height: 120, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.muted + "30" }}
      >
        <View className="flex-1 p-4 items-center justify-center" style={{ backgroundColor: theme.primary[100] }}>
          <Ionicons name="map" size={32} color={theme.primary[300]} />
          <Text className="font-rubik-bold mt-1" style={{ color: theme.primary[300] }}>
            {mapPins?.length || allProperties?.length || 0} on Map
          </Text>
          <Text className="text-xs mt-1" style={{ color: theme.muted }}>Tap to browse locations</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setSearchModalVisible(true)}
        className="flex-row items-center px-4 py-3 rounded-full mb-3"
        style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.muted + "40" }}
      >
        <Image source={icons.search} className="w-5 h-5" style={{ tintColor: theme.muted }} />
        <Text className="flex-1 ml-2 text-base" style={{ color: theme.muted }}>
          {params.query? `Search: "${params.query}"` : "Search properties..."}
        </Text>
      </TouchableOpacity>

      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-1"><Filters /></View>
        <View className="ml-2 flex-row gap-2">
          <HotDealsFilter isActive={showHotDeals} onToggle={() => setShowHotDeals(!showHotDeals)} count={priceDropCount} />
          <PriceFilterButton onPriceChange={(r, c) => { setSelectedPriceRange(r); setSelectedCustomPrice(c); }} currentPriceRange={selectedPriceRange} currentCustomPrice={selectedCustomPrice} />
          <TouchableOpacity
            onPress={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-2 rounded-full"
            style={{ backgroundColor: showAdvanced? theme.primary[300] : theme.surface, borderWidth: 1, borderColor: theme.muted + "40" }}
          >
            <Image source={icons.filter} className="w-4 h-4" style={{ tintColor: showAdvanced? "#fff" : theme.muted }} />
          </TouchableOpacity>
        </View>
      </View>

      {showAdvanced && (
        <View className="mb-3 p-3 rounded-xl" style={{ backgroundColor: theme.surface }}>
          <View className="flex-row items-center px-3 py-2 rounded-full mb-3" style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.muted + "40" }}>
            <Image source={icons.location} className="w-4 h-4" style={{ tintColor: theme.muted }} />
            <TextInput placeholder="City or area..." placeholderTextColor={theme.muted} value={locationInput} onChangeText={setLocationInput} className="flex-1 ml-2 text-sm" style={{ color: theme.text }} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
            {BEDROOM_OPTIONS.map((num) => (
              <TouchableOpacity key={num} onPress={() => setSelectedBedrooms(selectedBedrooms === num? undefined : num)} className="mr-2 px-4 py-2 rounded-full" style={{ backgroundColor: selectedBedrooms === num? theme.primary[300] : theme.background, borderWidth: 1, borderColor: theme.muted + "40" }}>
                <Text style={{ color: selectedBedrooms === num? "#fff" : theme.text }}>{num}+</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FacilitiesFilter selected={selectedFacilities} onToggle={(id) => setSelectedFacilities(prev => prev.includes(id)? prev.filter(f => f!== id) : [...prev, id])} />
        </View>
      )}

      <View className="flex-row justify-between items-center mt-2 mb-2">
        <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>{filteredProperties.length} Properties</Text>
        {loading && <ActivityIndicator size="small" color={theme.primary[300]} />}
      </View>
    </View>
  ), [theme, mapPins, allProperties, params.query, showHotDeals, priceDropCount, selectedPriceRange, selectedCustomPrice, showAdvanced, locationInput, selectedBedrooms, selectedFacilities]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={filteredProperties}
        numColumns={2}
        renderItem={({ item }) => <Card item={item} onPress={() => handleCardPress(item.$id)} />}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ paddingBottom: 100 }}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color={theme.primary[300]} />
            </View>
          ) : <NoResults />
        }
        ListHeaderComponent={ListHeader}
      />
      <SearchModal visible={searchModalVisible} onClose={() => setSearchModalVisible(false)} />
      <FullMap visible={fullMapVisible} onClose={() => setFullMapVisible(false)} properties={allProperties || []} onPropertyPress={(id: string) => { setFullMapVisible(false); handleCardPress(id); }} />
    </SafeAreaView>
  );
};

export default Explore;