// FullMap.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface FullMapProps {
  visible: boolean;
  onClose: () => void;
  properties: any[];
  onPropertyPress?: (propertyId: string) => void;
}

interface Origin {
  latitude: number;
  longitude: number;
  label: string;
}

interface RouteInfo {
  coords: { latitude: number; longitude: number }[];
  distanceKm: number;
  durationMin: number;
}

type TravelMode = 'driving' | 'walking';
type PropertyType = 'All' | 'Apartment' | 'House' | 'Boarding' | 'Luxury' | 'Studio';

const WALKING_SPEED_KMH = 5;

// Distance filter options
const DISTANCE_OPTIONS = [
  { label: 'All', value: null },
  { label: '1km', value: 1 },
  { label: '3km', value: 3 },
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
];

// Price range options
const PRICE_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Under $500', min: 0, max: 500 },
  { label: '$500 - $1000', min: 500, max: 1000 },
  { label: '$1000 - $2000', min: 1000, max: 2000 },
  { label: '$2000+', min: 2000, max: Infinity },
];

const FullMap = ({ visible, onClose, properties, onPropertyPress }: FullMapProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const mapRef = useRef<MapView>(null);

  // Map state
  const [selectedProperty, setSelectedProperty] = useState<any | null>(null);
  const [showPropertyDetail, setShowPropertyDetail] = useState(false);
  const [loadingProperty, setLoadingProperty] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'hybrid'>('standard');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [filteredProperties, setFilteredProperties] = useState<any[]>(properties || []);
  const [mapRegion, setMapRegion] = useState({
    latitude: -17.8252,
    longitude: 31.0335,
    latitudeDelta: 0.1,
    longitudeDelta: 0.1,
  });

  // Directions state
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [originPickerVisible, setOriginPickerVisible] = useState(false);
  const [pickingOnMap, setPickingOnMap] = useState(false);
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPriceRange, setSelectedPriceRange] = useState<{ label: string; min: number; max: number }>(PRICE_RANGES[0]);
  const [selectedPropertyType, setSelectedPropertyType] = useState<PropertyType>('All');
  const [selectedDistance, setSelectedDistance] = useState<{ label: string; value: number | null }>(DISTANCE_OPTIONS[0]);
  const [showAccreditedOnly, setShowAccreditedOnly] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  // Map Legend
  const [showLegend, setShowLegend] = useState(false);

  // ✅ Calculate center of properties
  const getPropertiesCenter = () => {
    const validProperties = filteredProperties.filter(p => p.latitude && p.longitude);
    if (validProperties.length === 0) {
      return {
        latitude: userLocation?.latitude || -17.8252,
        longitude: userLocation?.longitude || 31.0335,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    let latSum = 0;
    let lonSum = 0;
    validProperties.forEach(p => {
      latSum += p.latitude;
      lonSum += p.longitude;
    });

    const centerLat = latSum / validProperties.length;
    const centerLon = lonSum / validProperties.length;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLon = Infinity;
    let maxLon = -Infinity;

    validProperties.forEach(p => {
      if (p.latitude < minLat) minLat = p.latitude;
      if (p.latitude > maxLat) maxLat = p.latitude;
      if (p.longitude < minLon) minLon = p.longitude;
      if (p.longitude > maxLon) maxLon = p.longitude;
    });

    const latDelta = Math.max((maxLat - minLat) * 1.5, 0.02);
    const lonDelta = Math.max((maxLon - minLon) * 1.5, 0.02);

    return {
      latitude: centerLat,
      longitude: centerLon,
      latitudeDelta: latDelta,
      longitudeDelta: lonDelta,
    };
  };

  // ✅ Update map region when properties change
  useEffect(() => {
    if (filteredProperties.length > 0) {
      const center = getPropertiesCenter();
      setMapRegion({
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: center.latitudeDelta,
        longitudeDelta: center.longitudeDelta,
      });
    }
  }, [filteredProperties]);

  // Get marker color based on property price
  const getMarkerColor = (property: any) => {
    const hasPriceDrop = property.new_price && property.new_price < property.price;
    if (hasPriceDrop) return '#EF4444';

    const price = property.price || 0;
    if (price < 500) return '#10B981';
    if (price < 1000) return '#3B82F6';
    if (price < 2000) return '#F59E0B';
    return '#8B5CF6';
  };

  // Get property image
  const getPropertyImage = (property: any): string | null => {
    return property.image1 || property.image2 || property.image3 || property.image || null;
  };

  // ✅ Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // ✅ Apply filters
  useEffect(() => {
    if (!properties) return;

    let filtered = [...properties];

    // Price filter
    filtered = filtered.filter(p => 
      p.price >= selectedPriceRange.min && p.price <= selectedPriceRange.max
    );

    // Property type filter
    if (selectedPropertyType !== 'All') {
      filtered = filtered.filter(p => p.type === selectedPropertyType);
    }

    // Distance filter
    if (selectedDistance.value !== null && userLocation) {
      filtered = filtered.filter(p => {
        if (!p.latitude || !p.longitude) return false;
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          p.latitude,
          p.longitude
        );
        return distance <= selectedDistance.value!;
      });
    }

    // Accredited filter
    if (showAccreditedOnly) {
      // You need to implement isAccredited logic
    }

    // Available only filter
    if (showAvailableOnly) {
      filtered = filtered.filter(p => p.isAvailable === true);
    }

    setFilteredProperties(filtered);
  }, [properties, selectedPriceRange, selectedPropertyType, selectedDistance, showAccreditedOnly, showAvailableOnly, userLocation]);

  // ✅ Get user's current location
  useEffect(() => {
    const getLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (error) {
        console.error('Error getting location:', error);
      }
    };
    getLocation();
  }, []);

  // ==========================================================================
  // ROUTING (OSRM - OpenStreetMap Routing Machine) - FREE
  // ==========================================================================
  const fetchRoute = async (mode: TravelMode, from: Origin) => {
    if (!selectedProperty) return;
    setLoadingRoute(true);
    setRouteError(null);
    try {
      // ✅ OSRM - Free OpenStreetMap routing
      const url = `https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${selectedProperty.longitude},${selectedProperty.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes?.length) {
        setRouteError('No route found');
        setLoadingRoute(false);
        return;
      }

      const r = data.routes[0];
      const coords = r.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));

      const distanceKm = r.distance / 1000;
      const durationMin =
        mode === 'driving'
          ? r.duration / 60
          : (distanceKm / WALKING_SPEED_KMH) * 60;

      setRoute({ coords, distanceKm, durationMin });

      // ✅ Fit bounds to route
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 280, left: 60 },
          animated: true,
        });
      }, 300);
    } catch (e) {
      console.error('Error fetching route:', e);
      setRouteError('Could not get directions. Check your connection.');
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
      if (status !== 'granted') {
        setRouteError('Location permission denied');
        setLoadingRoute(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const from: Origin = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        label: 'Your location',
      };
      setOrigin(from);
      setOriginPickerVisible(false);
      await fetchRoute(travelMode, from);
    } catch {
      setRouteError('Could not get your location');
      setLoadingRoute(false);
    }
  };

  const startMapPick = () => {
    setOriginPickerVisible(false);
    setPickingOnMap(true);
  };

  const handleMapPress = async (e: any) => {
    if (pickingOnMap) {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      const from: Origin = {
        latitude: latitude,
        longitude: longitude,
        label: 'Pinned location',
      };
      setPickingOnMap(false);
      setOrigin(from);
      await fetchRoute(travelMode, from);
    }
  };

  // ==========================================================================
  // SEARCH USING NOMINATIM (OpenStreetMap) - FREE
  // ==========================================================================
  const searchPlaces = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 3) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    setSearchError('');
    setShowSearchResults(true);
    try {
      // ✅ Nominatim - Free OpenStreetMap geocoding
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        { headers: { 'User-Agent': 'RentifyApp/1.0' } }
      );
      const data = await res.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
      setSearchError('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = async (item: any) => {
    const from: Origin = {
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      label: item.display_name.split(',')[0],
    };
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
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
    if (selectedProperty) {
      mapRef.current?.animateToRegion({
        latitude: selectedProperty.latitude,
        longitude: selectedProperty.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const formatDuration = (min: number) => {
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}min`;
  };

  // Handle property marker press
  const handlePropertyPress = async (property: any) => {
    setLoadingProperty(true);
    setSelectedProperty(property);
    setShowPropertyDetail(true);
    setRoute(null);
    setOrigin(null);
    setRouteError(null);
    setLoadingProperty(false);
  };

  // Close property detail
  const closePropertyDetail = () => {
    setShowPropertyDetail(false);
    setSelectedProperty(null);
    setRoute(null);
    setOrigin(null);
    setRouteError(null);
  };

  // ✅ Go to user's current location
  const goToUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      setUserLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location');
    }
  };

  // ✅ Render Map Legend
  const renderLegend = () => (
    <Modal
      visible={showLegend}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLegend(false)}
    >
      <TouchableOpacity 
        className="flex-1 justify-center items-center bg-black/50"
        activeOpacity={1}
        onPress={() => setShowLegend(false)}
      >
        <View 
          className="rounded-2xl p-5 w-4/5"
          style={{ backgroundColor: theme.background }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>
              Map Legend
            </Text>
            <TouchableOpacity onPress={() => setShowLegend(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-red-500 border border-white" />
              <Text className="text-sm" style={{ color: theme.text }}>Price Drop (🔥 Hot Deal)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-green-500 border border-white" />
              <Text className="text-sm" style={{ color: theme.text }}>Affordable ($0 - $500)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-blue-500 border border-white" />
              <Text className="text-sm" style={{ color: theme.text }}>Mid Range ($500 - $1000)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-yellow-500 border border-white" />
              <Text className="text-sm" style={{ color: theme.text }}>Premium ($1000 - $2000)</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <View className="w-6 h-6 rounded-full bg-purple-500 border border-white" />
              <Text className="text-sm" style={{ color: theme.text }}>Luxury ($2000+)</Text>
            </View>
            <View className="flex-row items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: theme.muted + '20' }}>
              <View className="w-6 h-6 rounded-full border-2 border-blue-500" style={{ backgroundColor: 'transparent' }} />
              <Text className="text-sm" style={{ color: theme.text }}>Your Location</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ✅ Render Filter Modal
  const renderFilterModal = () => (
    <Modal
      visible={showFilters}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFilters(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View 
          className="rounded-t-3xl p-5"
          style={{ 
            backgroundColor: theme.background,
            maxHeight: '80%'
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-rubik-bold" style={{ color: theme.title }}>
              Filters
            </Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Price Range */}
            <View className="mb-4">
              <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.muted }}>
                Price Range
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {PRICE_RANGES.map((range) => (
                    <TouchableOpacity
                      key={range.label}
                      onPress={() => setSelectedPriceRange(range)}
                      className={`px-4 py-2 rounded-full ${
                        selectedPriceRange.label === range.label
                          ? 'bg-primary-300'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Text
                        className={`text-sm font-rubik-medium ${
                          selectedPriceRange.label === range.label
                            ? 'text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {range.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Property Type */}
            <View className="mb-4">
              <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.muted }}>
                Property Type
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {['All', 'Apartment', 'House', 'Boarding', 'Luxury', 'Studio'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setSelectedPropertyType(type as PropertyType)}
                      className={`px-4 py-2 rounded-full ${
                        selectedPropertyType === type
                          ? 'bg-primary-300'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Text
                        className={`text-sm font-rubik-medium ${
                          selectedPropertyType === type
                            ? 'text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Distance Filter */}
            <View className="mb-4">
              <Text className="text-sm font-rubik-medium mb-2" style={{ color: theme.muted }}>
                Distance from Me
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {DISTANCE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => setSelectedDistance(option)}
                      className={`px-4 py-2 rounded-full ${
                        selectedDistance.label === option.label
                          ? 'bg-primary-300'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    >
                      <Text
                        className={`text-sm font-rubik-medium ${
                          selectedDistance.label === option.label
                            ? 'text-white'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Toggle Filters */}
            <View className="mb-4 gap-3">
              <TouchableOpacity
                onPress={() => setShowAccreditedOnly(!showAccreditedOnly)}
                className={`flex-row items-center justify-between p-3 rounded-xl border ${
                  showAccreditedOnly
                    ? 'border-primary-300 bg-primary-100'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <Text className="text-sm font-rubik-medium" style={{ color: theme.text }}>
                  Accredited Only
                </Text>
                <View className={`w-6 h-6 rounded-full items-center justify-center ${
                  showAccreditedOnly ? 'bg-primary-300' : 'bg-gray-300'
                }`}>
                  {showAccreditedOnly && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setShowAvailableOnly(!showAvailableOnly)}
                className={`flex-row items-center justify-between p-3 rounded-xl border ${
                  showAvailableOnly
                    ? 'border-primary-300 bg-primary-100'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <Text className="text-sm font-rubik-medium" style={{ color: theme.text }}>
                  Available Only
                </Text>
                <View className={`w-6 h-6 rounded-full items-center justify-center ${
                  showAvailableOnly ? 'bg-primary-300' : 'bg-gray-300'
                }`}>
                  {showAvailableOnly && <Ionicons name="checkmark" size={16} color="white" />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Clear Filters */}
            <TouchableOpacity
              onPress={() => {
                setSelectedPriceRange(PRICE_RANGES[0]);
                setSelectedPropertyType('All');
                setSelectedDistance(DISTANCE_OPTIONS[0]);
                setShowAccreditedOnly(false);
                setShowAvailableOnly(false);
              }}
              className="py-3 rounded-xl border border-red-500"
            >
              <Text className="text-red-500 text-center font-rubik-medium">Clear All Filters</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFilters(false)}
              className="mt-3 py-3 rounded-xl"
              style={{ backgroundColor: theme.primary[300] }}
            >
              <Text className="text-white text-center font-rubik-bold">Apply Filters</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Render property detail popup
  const renderPropertyDetail = () => {
    if (!selectedProperty) return null;

    const hasPriceDrop = selectedProperty.new_price && selectedProperty.new_price < selectedProperty.price;
    const distanceFromUser = userLocation && selectedProperty.latitude && selectedProperty.longitude
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          selectedProperty.latitude,
          selectedProperty.longitude
        )
      : null;

    return (
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
        <View className="flex-row">
          {/* Property Image */}
          <TouchableOpacity
            onPress={() => {
              if (onPropertyPress) {
                onPropertyPress(selectedProperty.$id);
                onClose();
              } else {
                router.push(`/properties/${selectedProperty.$id}`);
                onClose();
              }
            }}
            className="w-20 h-20 rounded-lg overflow-hidden mr-3"
          >
            {getPropertyImage(selectedProperty) ? (
              <Image
                source={{ uri: getPropertyImage(selectedProperty)! }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center" style={{ backgroundColor: theme.muted + '20' }}>
                <Ionicons name="image-outline" size={24} color={theme.muted} />
              </View>
            )}
          </TouchableOpacity>

          {/* Property Details */}
          <View className="flex-1">
            <Text className="font-rubik-bold text-base" style={{ color: theme.title }} numberOfLines={1}>
              {selectedProperty.propertyName}
            </Text>
            <Text className="text-sm" style={{ color: theme.muted }} numberOfLines={1}>
              {selectedProperty.address || 'Address not available'}
            </Text>
            <View className="flex-row items-center mt-1">
              <Text className="font-rubik-bold text-primary-300 text-sm">
                ${selectedProperty.price}/month
              </Text>
              {hasPriceDrop && (
                <View className="ml-2 bg-red-500 px-2 py-0.5 rounded-full">
                  <Text className="text-white text-[10px] font-rubik-bold">🔥 Drop</Text>
                </View>
              )}
              {distanceFromUser !== null && (
                <Text className="text-xs ml-2" style={{ color: theme.muted }}>
                  {distanceFromUser.toFixed(1)} km away
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Route Info */}
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
                onPress={() => switchTravelMode('driving')}
                className={`px-3 py-2 rounded-full ${travelMode === 'driving' ? 'bg-primary-300' : 'bg-gray-200'}`}
              >
                <Text
                  className="font-rubik-medium text-xs"
                  style={{ color: travelMode === 'driving' ? '#fff' : '#191D31' }}
                >
                  Drive
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => switchTravelMode('walking')}
                className={`px-3 py-2 rounded-full ${travelMode === 'walking' ? 'bg-primary-300' : 'bg-gray-200'}`}
              >
                <Text
                  className="font-rubik-medium text-xs"
                  style={{ color: travelMode === 'walking' ? '#fff' : '#191D31' }}
                >
                  Walk
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {routeError && <Text className="text-red-500 text-sm font-rubik mt-2">{routeError}</Text>}

        {/* Action Buttons */}
        <View className="flex-row justify-end gap-2 mt-3 pt-3 border-t" style={{ borderTopColor: theme.muted + '20' }}>
          <TouchableOpacity
            onPress={closePropertyDetail}
            className="px-4 py-2 rounded-full border"
            style={{ borderColor: theme.muted + '30' }}
          >
            <Text style={{ color: theme.muted }}>Close</Text>
          </TouchableOpacity>

          {!route ? (
            <TouchableOpacity
              onPress={() => setOriginPickerVisible(true)}
              disabled={loadingRoute}
              className="px-4 py-2 rounded-full flex-row items-center"
              style={{ backgroundColor: theme.primary[300] }}
            >
              {loadingRoute ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="compass" size={16} color="white" />
                  <Text className="text-white font-rubik-bold ml-1">Directions</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={clearRoute}
              className="px-4 py-2 rounded-full"
              style={{ backgroundColor: theme.surface }}
            >
              <Text className="font-rubik-bold" style={{ color: theme.text }}>
                Clear Route
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              if (onPropertyPress) {
                onPropertyPress(selectedProperty.$id);
                onClose();
              } else {
                router.push(`/properties/${selectedProperty.$id}`);
                onClose();
              }
            }}
            className="px-4 py-2 rounded-full"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-bold">View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ✅ Get active filter count for badge
  const getActiveFilterCount = () => {
    let count = 0;
    if (selectedPriceRange.label !== 'All') count++;
    if (selectedPropertyType !== 'All') count++;
    if (selectedDistance.label !== 'All') count++;
    if (showAccreditedOnly) count++;
    if (showAvailableOnly) count++;
    return count;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: theme.background }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: theme.muted + '30' }}>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          
          {/* Search Bar */}
          <View className="flex-1 mx-2 flex-row items-center px-3 py-1.5 rounded-full" style={{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.muted + '30' }}>
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              placeholder="Search properties or location..."
              placeholderTextColor={theme.muted}
              value={searchQuery}
              onChangeText={searchPlaces}
              className="flex-1 ml-2 text-sm py-1"
              style={{ color: theme.text }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); setShowSearchResults(false); }}>
                <Ionicons name="close-circle" size={18} color={theme.muted} />
              </TouchableOpacity>
            )}
          </View>
          
          <View className="flex-row">
            {/* Filter Button with Badge */}
            <TouchableOpacity onPress={() => setShowFilters(true)} className="p-2 mr-1 relative">
              <Ionicons name="options-outline" size={24} color={theme.text} />
              {getActiveFilterCount() > 0 && (
                <View className="absolute top-0 right-0 bg-red-500 rounded-full w-5 h-5 items-center justify-center">
                  <Text className="text-white text-xs font-rubik-bold">{getActiveFilterCount()}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Legend Button */}
            <TouchableOpacity onPress={() => setShowLegend(true)} className="p-2 mr-1">
              <Ionicons name="information-circle-outline" size={24} color={theme.text} />
            </TouchableOpacity>
            
            {/* Map Type Toggle */}
            <TouchableOpacity onPress={() => setMapType(prev => prev === 'standard' ? 'hybrid' : 'standard')} className="p-2">
              <Ionicons name="layers-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <View 
            className="absolute top-20 left-4 right-4 rounded-xl max-h-48 z-50 shadow-lg"
            style={{ 
              backgroundColor: theme.background,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.place_id?.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectSearchResult(item)}
                  className="px-4 py-3 border-b"
                  style={{ borderBottomColor: theme.muted + '20' }}
                >
                  <Text className="font-rubik text-sm" style={{ color: theme.text }} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map - Using React Native Maps with PROVIDER_DEFAULT (FREE) */}
        <View className="flex-1">
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            region={mapRegion}
            mapType={mapType}
            showsUserLocation={true}
            showsMyLocationButton={false}
            onPress={handleMapPress}
          >
            {/* Property Markers */}
            {filteredProperties?.map((property) => {
              if (!property.latitude || !property.longitude) return null;
              const markerColor = getMarkerColor(property);
              const hasPriceDrop = property.new_price && property.new_price < property.price;

              return (
                <Marker
                  key={property.$id}
                  coordinate={{
                    latitude: property.latitude,
                    longitude: property.longitude,
                  }}
                  onPress={() => handlePropertyPress(property)}
                  pinColor={markerColor}
                >
                  <View className="items-center">
                    <View
                      className="px-2 py-1 rounded-full border-2 border-white shadow-lg"
                      style={{
                        backgroundColor: markerColor,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.3,
                        shadowRadius: 3,
                        elevation: 4,
                      }}
                    >
                      <Text className="text-white text-xs font-rubik-bold">
                        ${property.price}
                        {hasPriceDrop && ' 🔥'}
                      </Text>
                    </View>
                  </View>
                </Marker>
              );
            })}

            {/* Origin Marker */}
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

            {/* Route Polyline */}
            {route && (
              <Polyline
                coordinates={route.coords}
                strokeWidth={5}
                strokeColor="#0061FF"
              />
            )}
          </MapView>

          {/* Current Location Button - Floating */}
          <TouchableOpacity
            onPress={goToUserLocation}
            className="absolute top-4 right-4 p-3 rounded-full shadow-lg"
            style={{ 
              backgroundColor: theme.background,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <Ionicons name="locate" size={24} color={theme.primary[300]} />
          </TouchableOpacity>

          {/* "Tap on map" instruction banner while picking origin */}
          {pickingOnMap && (
            <View className="absolute top-28 left-5 right-5 bg-black/75 rounded-2xl px-4 py-3 mt-2">
              <Text className="text-white text-center font-rubik-medium">
                Tap anywhere on the map to set your starting point
              </Text>
              <TouchableOpacity onPress={() => setPickingOnMap(false)} className="mt-2">
                <Text className="text-center text-red-400 font-rubik-medium text-sm">Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Origin Picker Modal */}
          {originPickerVisible && (
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
          )}

          {/* Property Detail Popup */}
          {showPropertyDetail && renderPropertyDetail()}
        </View>

        {/* Filter Modal */}
        {renderFilterModal()}

        {/* Map Legend Modal */}
        {renderLegend()}
      </SafeAreaView>
    </Modal>
  );
};

export default FullMap;