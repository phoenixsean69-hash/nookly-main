// components/LocationPickerMap.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Location type with address data
export interface PickedLocation {
  latitude: number;
  longitude: number;
  houseNumber: string;
  streetName: string;
  neighbourhood: string;
  cityTown: string;
  formattedAddress: string;
}

interface LocationPickerMapProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  initialCoords?: { latitude: number; longitude: number } | null;
}

const LocationPickerMap = ({
  visible,
  onClose,
  onConfirm,
  initialCoords,
}: LocationPickerMapProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const mapRef = useRef<MapView>(null);

  const [pin, setPin] = useState<{ latitude: number; longitude: number } | null>(
    initialCoords ?? null
  );
  const [addressPreview, setAddressPreview] = useState<string>('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const defaultRegion = {
    latitude: -17.8252,
    longitude: 31.0335,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // ✅ Reverse geocode using Nominatim (OpenStreetMap) - FREE
  const reverseGeocode = async (latitude: number, longitude: number) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'YourAppName/1.0', // Required by Nominatim
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Reverse geocoding failed');
      }
      
      const data = await response.json();
      
      if (data && data.address) {
        const address = data.address;
        const addressData = {
          houseNumber: address.house_number || '',
          streetName: address.road || address.street || '',
          neighbourhood: address.suburb || address.neighbourhood || address.district || '',
          cityTown: address.city || address.town || address.village || address.state || '',
        };
        
        const formatted = [
          addressData.houseNumber,
          addressData.streetName,
          addressData.neighbourhood,
          addressData.cityTown
        ]
          .filter(p => p && p.trim() !== '')
          .join(', ');
        
        setAddressPreview(formatted || 'Address found, tap Confirm to use it');
        return addressData;
      }
      
      setAddressPreview('Address not found');
      return null;
    } catch (error) {
      console.error('Reverse geocode error:', error);
      setAddressPreview('Could not fetch address. You can edit it manually later.');
      return null;
    } finally {
      setLoadingAddress(false);
    }
  };

  // ✅ Handle map press with reverse geocoding
  const handleMapPress = async (event: any) => {
    const { coordinate } = event.nativeEvent;
    const { latitude, longitude } = coordinate;
    
    setPin({ latitude, longitude });
    
    await reverseGeocode(latitude, longitude);
  };

  // ✅ Search for a location using Nominatim - FREE
  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    setSearchError('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'YourAppName/1.0', // Required by Nominatim
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Search failed');
      }
      
      const data = await response.json();

      if (data && data.length > 0) {
        const location = data[0];
        const latitude = parseFloat(location.lat);
        const longitude = parseFloat(location.lon);

        setPin({ latitude, longitude });
        
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
        
        await reverseGeocode(latitude, longitude);
        setSearchQuery('');
      } else {
        setSearchError('Location not found. Please try a different search term.');
      }
    } catch (error) {
      console.error('Error searching location:', error);
      setSearchError('Failed to search. Please check your connection.');
    } finally {
      setSearching(false);
    }
  };

  // ✅ Go to user's current location
  const goToMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      
      const { latitude, longitude } = loc.coords;
      setPin({ latitude, longitude });
      
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
      
      await reverseGeocode(latitude, longitude);
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert('Error', 'Could not get your current location');
    } finally {
      setLocating(false);
    }
  };

  // ✅ Confirm location with full address data
  const handleConfirm = async () => {
    if (!pin) {
      Alert.alert('Error', 'Please pin a location on the map');
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${pin.latitude}&lon=${pin.longitude}&format=json&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'YourAppName/1.0',
          },
        }
      );
      
      let addressData = {
        houseNumber: '',
        streetName: '',
        neighbourhood: '',
        cityTown: '',
        formattedAddress: '',
      };

      if (response.ok) {
        const data = await response.json();
        if (data && data.address) {
          const address = data.address;
          addressData = {
            houseNumber: address.house_number || '',
            streetName: address.road || address.street || '',
            neighbourhood: address.suburb || address.neighbourhood || address.district || '',
            cityTown: address.city || address.town || address.village || address.state || '',
            formattedAddress: [
              address.house_number,
              address.road || address.street,
              address.suburb || address.neighbourhood || address.district,
              address.city || address.town || address.village || address.state
            ]
              .filter(p => p && p.trim() !== '')
              .join(', '),
          };
        }
      }

      onConfirm({
        latitude: pin.latitude,
        longitude: pin.longitude,
        ...addressData,
      });
      
      onClose();
    } catch (error) {
      console.error('Error confirming location:', error);
      Alert.alert('Error', 'Failed to get address. Please try again.');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView className="flex-1" style={{ backgroundColor: theme.background }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: theme.muted + '30' }}>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>
            Pick Location
          </Text>
          <View className="w-10" />
        </View>

        {/* Search Bar */}
        <View className="px-4 py-2 flex-row items-center" style={{ backgroundColor: theme.surface }}>
          <View
            className="flex-1 flex-row items-center px-3 py-2 rounded-full"
            style={{
              backgroundColor: theme.background,
              borderWidth: 1,
              borderColor: theme.muted + '30',
            }}
          >
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              placeholder="Search for a location..."
              placeholderTextColor={theme.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              className="flex-1 ml-2 text-sm"
              style={{ color: theme.text }}
            />
            {searching && <ActivityIndicator size="small" color={theme.primary?.[300] || '#007AFF'} />}
          </View>
          <TouchableOpacity
            onPress={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="ml-2 px-4 py-2 rounded-full"
            style={{ backgroundColor: searchQuery.trim() ? (theme.primary?.[300] || '#007AFF') : theme.muted + '40' }}
          >
            <Text className="text-white font-rubik-medium text-sm">Search</Text>
          </TouchableOpacity>
        </View>

        {searchError && (
          <View className="px-4 py-2">
            <Text className="text-sm text-red-500">{searchError}</Text>
          </View>
        )}

        {/* Map - Using PROVIDER_DEFAULT (NO API KEY NEEDED) */}
        <SafeAreaView className="flex-1">
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={{ flex: 1 }}
            initialRegion={defaultRegion}
            onPress={handleMapPress}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {pin && (
              <Marker
                coordinate={pin}
                draggable
                onDragEnd={(e) => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setPin({ latitude, longitude });
                  reverseGeocode(latitude, longitude);
                }}
              >
                <View className="items-center">
                  <Ionicons name="location" size={40} color="#EF4444" />
                  <View className="w-2 h-2 bg-red-500 rounded-full" />
                </View>
              </Marker>
            )}
          </MapView>
        </SafeAreaView>

        {/* Bottom Sheet */}
        <View
          className="absolute bottom-0 left-0 right-0 p-4 rounded-t-3xl"
          style={{
            backgroundColor: theme.background,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <View className="mb-4">
            <Text className="text-xs font-rubik-medium" style={{ color: theme.muted }}>
              {pin ? 'SELECTED LOCATION' : 'TAP THE MAP TO PLACE A PIN'}
            </Text>
            {pin ? (
              <View>
                <Text className="text-sm font-rubik-medium mt-1" style={{ color: theme.text }}>
                  📍 {addressPreview || 'Fetching address...'}
                </Text>
                <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                  {pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}
                </Text>
                {loadingAddress && (
                  <View className="flex-row items-center mt-1">
                    <ActivityIndicator size="small" color={theme.primary?.[300] || '#007AFF'} />
                    <Text className="text-xs ml-2" style={{ color: theme.muted }}>
                      Fetching address...
                    </Text>
                  </View>
                )}
                <Text className="text-xs mt-2" style={{ color: theme.primary?.[300] || '#007AFF' }}>
                  ✏️ You can edit the address manually after confirming
                </Text>
              </View>
            ) : (
              <Text className="text-base font-rubik-medium mt-1" style={{ color: theme.muted }}>
                Tap anywhere on the map to place a pin
              </Text>
            )}
          </View>

          {/* Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={goToMyLocation}
              disabled={locating}
              className="flex-1 py-3 rounded-full border"
              style={{ borderColor: theme.muted + '30' }}
            >
              {locating ? (
                <ActivityIndicator size="small" color={theme.primary?.[300] || '#007AFF'} />
              ) : (
                <Text className="text-center font-rubik-medium" style={{ color: theme.text }}>
                  My Location
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              disabled={!pin || confirming || loadingAddress}
              className="flex-2 py-3 rounded-full"
              style={{ backgroundColor: pin && !loadingAddress ? (theme.primary?.[300] || '#007AFF') : theme.muted + '40' }}
            >
              <Text className="text-white text-center font-rubik-bold">
                {confirming ? 'Confirming...' : loadingAddress ? 'Loading Address...' : 'Confirm Location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default LocationPickerMap;