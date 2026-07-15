// app/(root)/explore.tsx
import FullMap from "@/components/FullMap"; // ✅ Changed import
import HotDealsFilter from "@/components/HotDealsFilter";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useSmartAlerts } from "@/hooks/useSmartAlerts";
import { isAccredited } from "@/lib/accreditation";
import { getPropertiesWithFilters, PriceRange } from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import { Ionicons } from "@expo/vector-icons";

const BEDROOM_OPTIONS = [1, 2, 3, 4, 5];

const Explore = () => {
  const params = useLocalSearchParams<{
    filter?: string;
    query?: string;
    location?: string;
  }>();

  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ✅ Hot Deals filter state
  const [showHotDeals, setShowHotDeals] = useState(false);

  // Filter states
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRange | undefined>();
  const [selectedCustomPrice, setSelectedCustomPrice] = useState<{ min: number; max: number } | undefined>();
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [selectedBedrooms, setSelectedBedrooms] = useState<number | undefined>();

  // Debounce location input
  const [locationInput, setLocationInput] = useState<string>(params.location || "");
  const [selectedLocation, setSelectedLocation] = useState<string>(params.location || "");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Accredited filter state
  const [showAccreditedOnly, setShowAccreditedOnly] = useState(false);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { alerts, saveAlert, deleteAlert } = useSmartAlerts();

  // Debounce location: wait 500ms after user stops typing
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSelectedLocation(locationInput);
    }, 500);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [locationInput]);

  const { data: allProperties, loading: mapLoading } = useAppwrite({
    fn: (p: any) => getPropertiesWithFilters(p),
    params: { filter: "", query: "", limit: 10000 },
    ttl: 60000,
    skip: false,
  });

  const {
    data: properties,
    refetch,
    loading,
  } = useAppwrite({
    fn: (params: any) => getPropertiesWithFilters(params),
    params: {
      filter: params.filter || "",
      query: params.query || "",
      limit: 20,
      priceRange: selectedPriceRange,
      customPrice: selectedCustomPrice,
      facilities: selectedFacilities,
      bedrooms: selectedBedrooms,
      location: selectedLocation,
    },
    ttl: 30000,
    skip: false,
  });

  // ✅ Calculate price drop count for Hot Deals filter
  const priceDropCount = properties?.filter(p => 
    p.new_price !== undefined && 
    p.new_price !== null && 
    p.new_price < p.price
  ).length || 0;

  // Refetch when any filter changes
  useEffect(() => {
    refetch({
      filter: params.filter || "",
      query: params.query || "",
      limit: 20,
      priceRange: selectedPriceRange,
      customPrice: selectedCustomPrice,
      facilities: selectedFacilities,
      bedrooms: selectedBedrooms,
      location: selectedLocation,
    });

    // Save as smart alert if any filter is active
    const hasActiveFilters =
      params.query ||
      params.filter ||
      selectedFacilities.length ||
      selectedPriceRange ||
      selectedCustomPrice ||
      selectedBedrooms ||
      selectedLocation;

    if (hasActiveFilters) {
      saveAlert({
        query: params.query,
        filter: params.filter,
        bedrooms: selectedBedrooms,
        priceRange: selectedPriceRange,
        customPrice: selectedCustomPrice,
        location: selectedLocation,
        facilities: selectedFacilities,
      });
    }
  }, [
    params.filter,
    params.query,
    selectedPriceRange,
    selectedCustomPrice,
    selectedFacilities,
    selectedBedrooms,
    selectedLocation,
  ]);

  // Property location browser modal
  const [fullMapVisible, setFullMapVisible] = useState(false);

  const handleCardPress = (id: string) => router.push(`/properties/${id}`);

  const handlePriceChange = (
    priceRange?: PriceRange,
    customPrice?: { min: number; max: number },
  ) => {
    setSelectedPriceRange(priceRange);
    setSelectedCustomPrice(customPrice);
  };

  const toggleFacility = (id: string) => {
    setSelectedFacilities(prev =>
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const applyAlert = (alert: any) => {
    router.setParams({
      query: alert.query || "",
      filter: alert.filter || ""
    });
    setSelectedBedrooms(alert.bedrooms);
    setSelectedPriceRange(alert.priceRange);
    setSelectedCustomPrice(alert.customPrice);
    setLocationInput(alert.location || "");
    setSelectedLocation(alert.location || "");
    setSelectedFacilities(alert.facilities || []);
  };

  const getActiveFilterCount = () => {
    let count = 0;
    if (params.filter && params.filter !== "All") count++;
    if (selectedPriceRange || selectedCustomPrice) count++;
    if (params.query) count++;
    if (selectedFacilities.length) count++;
    if (selectedBedrooms) count++;
    if (selectedLocation) count++;
    if (showAccreditedOnly) count++;
    if (showHotDeals) count++;
    return count;
  };

  const clearAllFilters = () => {
    router.setParams({ filter: "", query: "" });
    setSelectedPriceRange(undefined);
    setSelectedCustomPrice(undefined);
    setSelectedFacilities([]);
    setSelectedBedrooms(undefined);
    setLocationInput("");
    setSelectedLocation("");
    setShowAccreditedOnly(false);
    setShowHotDeals(false);
  };

  // ✅ Filter properties by accreditation and Hot Deals
  const filteredProperties = properties?.filter((property) => {
    // Apply accredited filter
    if (showAccreditedOnly && !isAccredited(property.reviews, property.$createdAt)) {
      return false;
    }
    // Apply Hot Deals filter
    if (showHotDeals) {
      const hasPriceDrop = property.new_price !== undefined && 
                           property.new_price !== null && 
                           property.new_price < property.price;
      if (!hasPriceDrop) return false;
    }
    return true;
  });

  // ✅ Handle opening full map
  const handleOpenFullMap = () => {
    setFullMapVisible(true);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        data={filteredProperties}
        numColumns={2}
        renderItem={({ item }) => (
          <Card item={item} onPress={() => handleCardPress(item.$id)} />
        )}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ paddingBottom: 100 }}
        columnWrapperStyle={{ gap: 20, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View className="items-center justify-center py-20">
              <ActivityIndicator size="large" color={theme.primary[300]} />
              <Text className="mt-4 text-center" style={{ color: theme.muted }}>
                Loading properties...
              </Text>
            </View>
          ) : !properties || properties.length === 0 ? (
            <NoResults />
          ) : showAccreditedOnly && filteredProperties?.length === 0 ? (
            <View className="items-center justify-center py-20 px-8">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: theme.primary[100] }}>
                <Ionicons name="checkmark-circle" size={40} color={theme.primary[300]} />
              </View>
              <Text className="text-lg font-rubik-bold text-center" style={{ color: theme.title }}>
                No Accredited Properties Found
              </Text>
              <Text className="text-sm text-center mt-2" style={{ color: theme.muted }}>
                Try adjusting your filters or view all properties
              </Text>
              <TouchableOpacity
                onPress={() => setShowAccreditedOnly(false)}
                className="mt-4 px-6 py-3 rounded-full"
                style={{ backgroundColor: theme.primary[300] }}
              >
                <Text className="text-white font-rubik-bold">View All Properties</Text>
              </TouchableOpacity>
            </View>
          ) : showHotDeals && filteredProperties?.length === 0 ? (
            <View className="items-center justify-center py-20 px-8">
              <View className="w-20 h-20 rounded-full items-center justify-center mb-4" style={{ backgroundColor: theme.primary[100] }}>
                <Ionicons name="flame" size={40} color={theme.primary[300]} />
              </View>
              <Text className="text-lg font-rubik-bold text-center" style={{ color: theme.title }}>
                No Hot Deals Available
              </Text>
              <Text className="text-sm text-center mt-2" style={{ color: theme.muted }}>
                There are no properties with price drops right now. Check back later!
              </Text>
              <TouchableOpacity
                onPress={() => setShowHotDeals(false)}
                className="mt-4 px-6 py-3 rounded-full"
                style={{ backgroundColor: theme.primary[300] }}
              >
                <Text className="text-white font-rubik-bold">View All Properties</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View className="px-5 pt-5 pb-2">
            
            <View className="mb-4">
              <Text
                className="text-xl text-center font-rubik-bold mt-1"
                style={{ color: theme.muted }}
              >
                Discover your next Property
              </Text>
            </View>

            {/* Location browser banner */}
            <TouchableOpacity
              onPress={handleOpenFullMap}
              activeOpacity={0.9}
              className="mb-3 rounded-2xl overflow-hidden"
              style={{
                height: 150,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              {mapLoading ? (
                <View className="flex-1 items-center justify-center">
                  <ActivityIndicator size="large" color={theme.primary[300]} />
                  <Text className="mt-2 text-sm" style={{ color: theme.muted }}>
                    Loading map...
                  </Text>
                </View>
              ) : (
                <View className="flex-1 relative">
                  {/* Mini map preview - just a visual representation */}
                  <View className="flex-1 p-4 items-center justify-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Ionicons name="map" size={48} color={theme.primary[300]} />
                    <Text className="text-lg font-rubik-bold mt-2" style={{ color: theme.primary[300] }}>
                      {allProperties?.filter((property) => Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude))).length || 0} Located Properties
                    </Text>
                    <Text className="text-sm" style={{ color: theme.muted }}>
                      Browse locations and open external maps
                    </Text>
                  </View>
                  
                  {/* Mini property dots on map */}
                  <View className="absolute top-4 right-4 flex-row flex-wrap gap-1">
                    {allProperties?.slice(0, 8).map((_, index) => (
                      <View
                        key={index}
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: theme.primary[300] }}
                      />
                    ))}
                    {allProperties && allProperties.length > 8 && (
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: theme.primary[300] }}
                      />
                    )}
                  </View>
                  
                  {/* View Map button */}
                  <View
                    className="absolute bottom-3 right-3 px-4 py-2 rounded-full"
                    style={{ backgroundColor: theme.primary[300] }}
                  >
                    <Text className="text-white text-xs font-rubik-bold">View Map</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>

            {/* Search Button */}
            <TouchableOpacity
              onPress={() => setSearchModalVisible(true)}
              className="flex-row items-center px-4 py-3 rounded-full mb-3"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "40",
              }}
            >
              <Image
                source={icons.search}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="flex-1 ml-2 text-base"
                style={{ color: theme.muted }}
              >
                {params.query
                  ? `Search: "${params.query}"`
                  : "Search properties..."}
              </Text>
              {params.query && (
                <TouchableOpacity onPress={() => router.setParams({ query: "" })}>
                  <Image
                    source={icons.close}
                    className="w-5 h-5"
                    style={{ tintColor: theme.muted }}
                  />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {/* Filter Row */}
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-1">
                <Filters />
              </View>
              <View className="ml-2 flex-row gap-2">
                {/* ✅ Hot Deals Filter Button */}
                <HotDealsFilter
                  isActive={showHotDeals}
                  onToggle={() => setShowHotDeals(!showHotDeals)}
                  count={priceDropCount}
                />

                {/* ✅ Accredited Filter Button */}
                <TouchableOpacity
                  onPress={() => setShowAccreditedOnly(!showAccreditedOnly)}
                  className="px-3 py-2 rounded-full flex-row items-center gap-1"
                  style={{
                    backgroundColor: showAccreditedOnly ? "#10B981" : theme.surface,
                    borderWidth: 1,
                    borderColor: showAccreditedOnly ? "#10B981" : theme.muted + "40",
                  }}
                >
                  <Ionicons 
                    name="checkmark-circle" 
                    size={16} 
                    color={showAccreditedOnly ? "#FFFFFF" : theme.muted} 
                  />
                  <Text
                    className="text-xs font-rubik-medium"
                    style={{ color: showAccreditedOnly ? "#FFFFFF" : theme.muted }}
                  >
                    accredited
                  </Text>
                </TouchableOpacity>

                <PriceFilterButton
                  onPriceChange={handlePriceChange}
                  currentPriceRange={selectedPriceRange}
                  currentCustomPrice={selectedCustomPrice}
                />
                <TouchableOpacity
                  onPress={() => setShowAdvanced(!showAdvanced)}
                  className="px-3 py-2 rounded-full flex-row items-center"
                  style={{
                    backgroundColor: showAdvanced ? theme.primary[300] : theme.surface,
                    borderWidth: 1,
                    borderColor: theme.muted + "40",
                  }}
                >
                  <Image
                    source={icons.filter}
                    className="w-4 h-4"
                    style={{ tintColor: showAdvanced ? "#fff" : theme.muted }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Advanced Filters */}
            {showAdvanced && (
              <View className="mb-3 p-3 rounded-xl" style={{ backgroundColor: theme.surface }}>
                <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.text }}>
                  Location
                </Text>
                <View
                  className="flex-row items-center px-3 py-2 rounded-full mb-3"
                  style={{ backgroundColor: theme.background, borderWidth: 1, borderColor: theme.muted + "40" }}
                >
                  <Image source={icons.location} className="w-4 h-4" style={{ tintColor: theme.muted }} />
                  <TextInput
                    placeholder="Enter city or area..."
                    placeholderTextColor={theme.muted}
                    value={locationInput}
                    onChangeText={setLocationInput}
                    className="flex-1 ml-2 text-sm"
                    style={{ color: theme.text }}
                  />
                  {locationInput !== "" && (
                    <TouchableOpacity onPress={() => setLocationInput("")}>
                      <Image source={icons.close} className="w-5 h-5" />
                    </TouchableOpacity>
                  )}
                </View>

                <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.text }}>
                  Bedrooms
                </Text>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
                  {BEDROOM_OPTIONS.map((num) => (
                    <TouchableOpacity
                      key={num}
                      onPress={() => setSelectedBedrooms(selectedBedrooms === num ? undefined : num)}
                      className="mr-2 px-4 py-2 rounded-full"
                      style={{
                        backgroundColor: selectedBedrooms === num ? theme.primary[300] : theme.background,
                        borderWidth: 1,
                        borderColor: theme.muted + "40",
                      }}
                    >
                      <Text
                        className="text-sm font-rubik-medium"
                        style={{ color: selectedBedrooms === num ? "#fff" : theme.text }}
                      >
                        {num}+
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.text }}>
                  Facilities
                </Text>
                <FacilitiesFilter selected={selectedFacilities} onToggle={toggleFacility} />
              </View>
            )}

            {/* Active Filters Display */}
            {getActiveFilterCount() > 0 && (
              <View className="flex-row flex-wrap gap-2 mt-2 mb-3">
                {showHotDeals && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: "#FEE2E2" }}>
                    <Ionicons name="flame" size={12} color="#DC2626" />
                    <Text className="text-xs ml-1" style={{ color: "#DC2626" }}>
                      🔥 Hot Deals
                    </Text>
                    <TouchableOpacity onPress={() => setShowHotDeals(false)} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: "#DC2626" }} />
                    </TouchableOpacity>
                  </View>
                )}
                {showAccreditedOnly && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: "#10B98120" }}>
                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                    <Text className="text-xs ml-1" style={{ color: "#10B981" }}>
                      Accredited Only
                    </Text>
                    <TouchableOpacity onPress={() => setShowAccreditedOnly(false)} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: "#10B981" }} />
                    </TouchableOpacity>
                  </View>
                )}
                {selectedLocation !== "" && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Text className="text-xs" style={{ color: theme.primary[300] }}>
                      📍 {selectedLocation}
                    </Text>
                    <TouchableOpacity onPress={() => { setLocationInput(""); setSelectedLocation(""); }} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: theme.primary[300] }} />
                    </TouchableOpacity>
                  </View>
                )}
                {selectedBedrooms && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Text className="text-xs" style={{ color: theme.primary[300] }}>
                      {selectedBedrooms}+ beds
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedBedrooms(undefined)} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: theme.primary[300] }} />
                    </TouchableOpacity>
                  </View>
                )}
                {selectedFacilities.map((f) => (
                  <View key={f} className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Text className="text-xs" style={{ color: theme.primary[300] }}>
                      {f}
                    </Text>
                    <TouchableOpacity onPress={() => toggleFacility(f)} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: theme.primary[300] }} />
                    </TouchableOpacity>
                  </View>
                ))}
                {(selectedPriceRange || selectedCustomPrice) && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Text className="text-xs" style={{ color: theme.primary[300] }}>
                      {selectedCustomPrice
                        ? `$${selectedCustomPrice.min} - $${selectedCustomPrice.max}`
                        : selectedPriceRange?.label}
                    </Text>
                    <TouchableOpacity onPress={() => handlePriceChange(undefined, undefined)} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: theme.primary[300] }} />
                    </TouchableOpacity>
                  </View>
                )}
                {params.query && (
                  <View className="px-2 py-1 rounded-full flex-row items-center" style={{ backgroundColor: theme.primary[100] }}>
                    <Text className="text-xs" style={{ color: theme.primary[300] }}>
                      {params.query}
                    </Text>
                    <TouchableOpacity onPress={() => router.setParams({ query: "" })} className="ml-1">
                      <Image source={icons.close} className="w-3 h-3" style={{ tintColor: theme.primary[300] }} />
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity onPress={clearAllFilters}>
                  <Text className="text-xs" style={{ color: theme.primary[300] }}>
                    Clear all
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View className="flex-row justify-between items-center mt-2 mb-2">
              <Text className="text-xl font-rubik-bold" style={{ color: theme.title }}>
                {filteredProperties?.length || 0} Properties
                {showHotDeals && (
                  <Text className="text-sm font-rubik-medium ml-2" style={{ color: "#DC2626" }}>
                    🔥 Hot Deals
                  </Text>
                )}
                {showAccreditedOnly && (
                  <Text className="text-sm font-rubik-medium ml-2" style={{ color: "#10B981" }}>
                    ✓ accredited
                  </Text>
                )}
              </Text>
              {loading && (
                <Text className="text-sm" style={{ color: theme.muted }}>
                  Refreshing...
                </Text>
              )}
            </View>
          </View>
        }
      />

      <SearchModal
        visible={searchModalVisible}
        onClose={() => setSearchModalVisible(false)}
      />

      {/* Property location browser */}
      <FullMap
        visible={fullMapVisible}
        onClose={() => setFullMapVisible(false)}
        properties={allProperties || []}
        onPropertyPress={(propertyId: string) => {
          setFullMapVisible(false);
          handleCardPress(propertyId);
        }}
      />
    </SafeAreaView>
  );
};

export default Explore;
