import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

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

type Coordinates = { latitude: number; longitude: number };
type AddressFields = Omit<PickedLocation, 'latitude' | 'longitude'>;

const DEFAULT_COORDS: Coordinates = { latitude: -17.8252, longitude: 31.0335 };
const NOMINATIM_HEADERS = {
  'User-Agent': 'Nookly/1.0 (property location picker)',
  Accept: 'application/json',
};

const isValidCoordinate = (latitude: unknown, longitude: unknown): boolean => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

const emptyAddress = (): AddressFields => ({
  houseNumber: '',
  streetName: '',
  neighbourhood: '',
  cityTown: '',
  formattedAddress: '',
});

const LocationPickerMap = ({ visible, onClose, onConfirm, initialCoords }: LocationPickerMapProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const webViewRef = useRef<WebView>(null);
  const initial = initialCoords && isValidCoordinate(initialCoords.latitude, initialCoords.longitude)
    ? initialCoords
    : null;

  const [pin, setPin] = useState<Coordinates | null>(initial);
  const [address, setAddress] = useState<AddressFields>(emptyAddress());
  const [addressPreview, setAddressPreview] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [mapType, setMapType] = useState<'street' | 'hybrid'>('street');

  useEffect(() => {
    if (!visible) return;
    const nextPin = initialCoords && isValidCoordinate(initialCoords.latitude, initialCoords.longitude)
      ? initialCoords
      : null;
    setPin(nextPin);
    setAddress(emptyAddress());
    setAddressPreview('');
    setSearchError('');
    setMapReady(false);
    setMapFailed(false);
  }, [visible, initialCoords?.latitude, initialCoords?.longitude]);

  const mapHtml = useMemo(() => {
    const center = initial ?? DEFAULT_COORDS;
    const initialPin = initial ? `[${initial.latitude}, ${initial.longitude}]` : 'null';
    return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
<style>html,body,#map{height:100%;width:100%;margin:0;background:#e5e7eb}.leaflet-control-attribution{font-size:10px}.pin{font-size:34px;line-height:34px;text-shadow:0 2px 4px rgba(0,0,0,.28)}</style></head>
<body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
(function(){
  function send(type,payload){window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:type},payload||{})))}
  try {
    if(!window.L){throw new Error('Map resources did not load')}
    var map=L.map('map',{zoomControl:true}).setView([${center.latitude},${center.longitude}],${initial ? 16 : 12});
    var streetLayer=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'});
    var satelliteLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'© Esri'});
    var labelsLayer=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19});
    var currentType='street';
    streetLayer.addTo(map);
    window.setMapType=function(type){
      if(type===currentType){return}
      if(type==='hybrid'){
        map.removeLayer(streetLayer);satelliteLayer.addTo(map);labelsLayer.addTo(map);
      }else{
        map.removeLayer(satelliteLayer);map.removeLayer(labelsLayer);streetLayer.addTo(map);
      }
      currentType=type;
    };
    var marker=null;
    var icon=L.divIcon({className:'',html:'<div class="pin">●</div>',iconSize:[34,34],iconAnchor:[17,17]});
    function setPin(lat,lng,zoom,notify){
      if(marker){marker.setLatLng([lat,lng])}else{marker=L.marker([lat,lng],{draggable:true,icon:icon}).addTo(map);marker.on('dragend',function(){var p=marker.getLatLng();send('pin',{latitude:p.lat,longitude:p.lng})})}
      map.setView([lat,lng],zoom||map.getZoom());
      if(notify){send('pin',{latitude:lat,longitude:lng})}
    }
    var first=${initialPin}; if(first){setPin(first[0],first[1],16,false)}
    map.on('click',function(e){setPin(e.latlng.lat,e.latlng.lng,map.getZoom(),true)});
    window.movePin=function(lat,lng){setPin(Number(lat),Number(lng),16,false)};
    setTimeout(function(){map.invalidateSize();send('ready')},100);
  } catch(error){send('error',{message:String(error && error.message || error)})}
})();
</script></body></html>`;
  }, [initial?.latitude, initial?.longitude, mapKey]);

  const toggleMapType = () => {
    const nextType = mapType === 'street' ? 'hybrid' : 'street';
    setMapType(nextType);
    webViewRef.current?.injectJavaScript(`window.setMapType && window.setMapType('${nextType}');true;`);
  };

  const moveMapTo = (coords: Coordinates) => {
    if (!isValidCoordinate(coords.latitude, coords.longitude)) return;
    const script = `window.movePin && window.movePin(${JSON.stringify(coords.latitude)},${JSON.stringify(coords.longitude)});true;`;
    webViewRef.current?.injectJavaScript(script);
  };

  const reverseGeocode = async (latitude: number, longitude: number) => {
    setLoadingAddress(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&format=json&zoom=18&addressdetails=1`,
        { headers: NOMINATIM_HEADERS },
      );
      if (!response.ok) throw new Error('Reverse geocoding failed');
      const data = await response.json();
      const value = data?.address;
      if (!value) {
        const blank = emptyAddress();
        setAddress(blank);
        setAddressPreview('Address not found. The coordinates can still be used.');
        return blank;
      }
      const result: AddressFields = {
        houseNumber: value.house_number || '',
        streetName: value.road || value.street || '',
        neighbourhood: value.suburb || value.neighbourhood || value.district || '',
        cityTown: value.city || value.town || value.village || value.state || '',
        formattedAddress: '',
      };
      result.formattedAddress = [result.houseNumber, result.streetName, result.neighbourhood, result.cityTown]
        .filter(Boolean)
        .join(', ');
      setAddress(result);
      setAddressPreview(result.formattedAddress || data.display_name || 'Location selected');
      return result;
    } catch {
      const blank = emptyAddress();
      setAddress(blank);
      setAddressPreview('Address unavailable. The coordinates can still be used.');
      return blank;
    } finally {
      setLoadingAddress(false);
    }
  };

  const selectPin = async (coords: Coordinates, moveMap = false) => {
    if (!isValidCoordinate(coords.latitude, coords.longitude)) return;
    setPin(coords);
    if (moveMap) moveMapTo(coords);
    await reverseGeocode(coords.latitude, coords.longitude);
  };

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        setMapReady(true);
        setMapFailed(false);
        if (mapType === 'hybrid') {
          webViewRef.current?.injectJavaScript(`window.setMapType && window.setMapType('hybrid');true;`);
        }
      } else if (message.type === 'error') {
        setMapFailed(true);
      } else if (message.type === 'pin' && isValidCoordinate(message.latitude, message.longitude)) {
        void selectPin({ latitude: Number(message.latitude), longitude: Number(message.longitude) });
      }
    } catch {
      // Ignore malformed messages from embedded web content.
    }
  };

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query || searching) return;
    setSearching(true);
    setSearchError('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`,
        { headers: NOMINATIM_HEADERS },
      );
      if (!response.ok) throw new Error('Search failed');
      const results = await response.json();
      const latitude = Number(results?.[0]?.lat);
      const longitude = Number(results?.[0]?.lon);
      if (!isValidCoordinate(latitude, longitude)) {
        setSearchError('Location not found. Try a more specific address.');
        return;
      }
      await selectPin({ latitude, longitude }, true);
      setSearchQuery('');
    } catch {
      setSearchError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const goToMyLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Allow location access to place the pin at your current position.');
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await selectPin({ latitude: result.coords.latitude, longitude: result.coords.longitude }, true);
    } catch {
      Alert.alert('Location unavailable', 'Nookly could not get your current location. You can still tap the map.');
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = () => {
    if (!pin) {
      Alert.alert('Choose a location', 'Tap the map to place a pin first.');
      return;
    }
    setConfirming(true);
    onConfirm({ latitude: pin.latitude, longitude: pin.longitude, ...address });
    setConfirming(false);
    onClose();
  };

  const retryMap = () => {
    setMapFailed(false);
    setMapReady(false);
    setMapKey((value) => value + 1);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-row items-center justify-between border-b px-4 py-3" style={{ borderBottomColor: `${theme.muted}30` }}>
          <TouchableOpacity onPress={onClose} className="p-2" accessibilityLabel="Close location picker">
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <Text className="text-lg font-rubik-bold" style={{ color: theme.title }}>Pick Location</Text>
          <View className="w-10" />
        </View>

        <View className="flex-row items-center px-4 py-2" style={{ backgroundColor: theme.surface }}>
          <View className="flex-1 flex-row items-center rounded-full border px-3 py-2" style={{ backgroundColor: theme.background, borderColor: `${theme.muted}30` }}>
            <Ionicons name="search" size={18} color={theme.muted} />
            <TextInput
              placeholder="Search an address or area"
              placeholderTextColor={theme.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              className="ml-2 flex-1 text-sm"
              style={{ color: theme.text }}
            />
            {searching && <ActivityIndicator size="small" color={theme.primary[300]} />}
          </View>
          <TouchableOpacity onPress={handleSearch} disabled={searching || !searchQuery.trim()} className="ml-2 rounded-full px-4 py-2" style={{ backgroundColor: searchQuery.trim() ? theme.primary[300] : `${theme.muted}40` }}>
            <Text className="font-rubik-medium text-sm text-white">Search</Text>
          </TouchableOpacity>
        </View>
        {!!searchError && <Text className="px-4 py-2 text-sm text-red-500">{searchError}</Text>}

        <View className="flex-1">
          <WebView
            key={mapKey}
            ref={webViewRef}
            source={{ html: mapHtml, baseUrl: 'https://nookly.app' }}
            onMessage={handleMapMessage}
            onError={() => setMapFailed(true)}
            onHttpError={(event) => { if (event.nativeEvent.statusCode >= 400) setMapFailed(true); }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['https://*', 'about:blank']}
            mixedContentMode="never"
            style={{ flex: 1, backgroundColor: theme.surface }}
          />
          {mapReady && !mapFailed && (
            <TouchableOpacity
              onPress={toggleMapType}
              accessibilityLabel={mapType === 'street' ? 'Switch to hybrid satellite view' : 'Switch to street map view'}
              className="absolute right-3 top-3 flex-row items-center rounded-full px-4 py-2"
              style={{
                backgroundColor: theme.background,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                elevation: 4,
              }}
            >
              <Ionicons name={mapType === 'street' ? 'globe-outline' : 'map-outline'} size={16} color={theme.primary[300]} />
              <Text className="ml-2 font-rubik-medium text-xs" style={{ color: theme.text }}>
                {mapType === 'street' ? 'Hybrid' : 'Street'}
              </Text>
            </TouchableOpacity>
          )}
          {!mapReady && !mapFailed && (
            <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: theme.surface }}>
              <ActivityIndicator size="large" color={theme.primary[300]} />
              <Text className="mt-3 font-rubik-medium" style={{ color: theme.muted }}>Loading OpenStreetMap...</Text>
            </View>
          )}
          {mapFailed && (
            <View className="absolute inset-0 items-center justify-center px-8" style={{ backgroundColor: theme.surface }}>
              <Ionicons name="cloud-offline-outline" size={44} color={theme.muted} />
              <Text className="mt-3 text-center font-rubik-bold" style={{ color: theme.title }}>Map could not load</Text>
              <Text className="mt-2 text-center text-sm" style={{ color: theme.muted }}>Check your internet connection, then retry. This screen will not close or crash.</Text>
              <TouchableOpacity onPress={retryMap} className="mt-4 rounded-full px-6 py-3" style={{ backgroundColor: theme.primary[300] }}>
                <Text className="font-rubik-bold text-white">Retry map</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="border-t p-4" style={{ backgroundColor: theme.background, borderTopColor: `${theme.muted}25` }}>
          <Text className="text-xs font-rubik-medium" style={{ color: theme.muted }}>{pin ? 'SELECTED LOCATION' : 'TAP THE MAP TO PLACE A PIN'}</Text>
          <View className="mt-1 min-h-12">
            {pin ? (
              <>
                <Text className="font-rubik-medium text-sm" style={{ color: theme.text }}>{addressPreview || 'Fetching address...'}</Text>
                <Text className="mt-1 text-xs" style={{ color: theme.muted }}>{pin.latitude.toFixed(6)}, {pin.longitude.toFixed(6)}</Text>
                {loadingAddress && <ActivityIndicator className="mt-1 self-start" size="small" color={theme.primary[300]} />}
              </>
            ) : <Text className="font-rubik-medium" style={{ color: theme.muted }}>Tap anywhere to choose the exact property location.</Text>}
          </View>
          <View className="mt-3 flex-row gap-3">
            <TouchableOpacity onPress={goToMyLocation} disabled={locating} className="flex-1 rounded-full border py-3" style={{ borderColor: `${theme.muted}40` }}>
              {locating ? <ActivityIndicator size="small" color={theme.primary[300]} /> : <Text className="text-center font-rubik-medium" style={{ color: theme.text }}>My location</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleConfirm} disabled={!pin || confirming} className="flex-[1.4] rounded-full py-3" style={{ backgroundColor: pin ? theme.primary[300] : `${theme.muted}40` }}>
              <Text className="text-center font-rubik-bold text-white">{confirming ? 'Confirming...' : 'Confirm location'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

export default LocationPickerMap;
