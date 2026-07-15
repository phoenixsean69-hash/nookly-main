// components/MapLayers.tsx
import { Colors } from '@/constants/Colors';
import { POI_CATEGORIES, fetchPOIs } from '@/lib/poiService';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View, useColorScheme } from 'react-native';

interface MapLayersProps {
  visible: boolean;
  onClose: () => void;
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  activeLayers: string[];
  centerLatitude?: number;
  centerLongitude?: number;
}

export const MapLayers = ({
  visible,
  onClose,
  onLayerToggle,
  activeLayers,
  centerLatitude,
  centerLongitude
}: MapLayersProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? 'light'];
  const [loading, setLoading] = useState(false);
  const [poiCounts, setPoiCounts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (!visible || !centerLatitude || !centerLongitude) return;

    const fetchCounts = async () => {
      setLoading(true);
      try {
        const counts: { [key: string]: number } = {};
        for (const category of POI_CATEGORIES) {
          const pois = await fetchPOIs(
            centerLatitude, 
            centerLongitude, 
            3,
            [category.id]
          );
          counts[category.id] = pois.length;
        }
        setPoiCounts(counts);
      } catch (error) {
        console.error('Error fetching POI counts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCounts();
  }, [visible, centerLatitude, centerLongitude]);

  const getCategoryColor = (categoryId: string) => {
    const category = POI_CATEGORIES.find(c => c.id === categoryId);
    return category?.color || '#6B7280';
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View 
          className="rounded-t-3xl p-4 pb-8"
          style={{ 
            backgroundColor: theme.background,
            maxHeight: '65%'
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-rubik-bold" style={{ color: theme.title }}>
              Map Layers
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          <Text className="text-sm mb-4" style={{ color: theme.muted }}>
            Toggle different amenities on the map
          </Text>

          {loading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="small" color={theme.primary[300]} />
              <Text className="text-sm mt-2" style={{ color: theme.muted }}>
                Loading POI data...
              </Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-2">
                {POI_CATEGORIES.map((category) => {
                  const isActive = activeLayers.includes(category.id);
                  const count = poiCounts[category.id] || 0;

                  return (
                    <TouchableOpacity
                      key={category.id}
                      onPress={() => onLayerToggle(category.id, !isActive)}
                      className={`px-4 py-3 rounded-xl flex-row items-center ${
                        isActive ? 'border-2' : 'border'
                      }`}
                      style={{
                        backgroundColor: isActive ? category.color + '20' : theme.surface,
                        borderColor: isActive ? category.color : theme.muted + '30',
                        minWidth: '45%',
                      }}
                    >
                      <View 
                        className="w-8 h-8 rounded-full items-center justify-center mr-2"
                        style={{ backgroundColor: category.color + '30' }}
                      >
                        <Ionicons 
                          name={category.icon as any} 
                          size={16} 
                          color={category.color} 
                        />
                      </View>
                      <View className="flex-1">
                        <Text 
                          className="text-sm font-rubik-medium" 
                          style={{ color: isActive ? category.color : theme.text }}
                        >
                          {category.label}
                        </Text>
                        <Text className="text-xs" style={{ color: theme.muted }}>
                          {count} locations
                        </Text>
                      </View>
                      {isActive && (
                        <Ionicons name="checkmark-circle" size={16} color={category.color} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}

          <TouchableOpacity
            onPress={() => {
              activeLayers.forEach(layerId => onLayerToggle(layerId, false));
            }}
            className="mt-4 py-2 rounded-xl border border-red-500"
          >
            <Text className="text-red-500 text-center font-rubik-medium">
              Clear All Layers
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default MapLayers;