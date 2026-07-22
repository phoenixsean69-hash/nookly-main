import { Colors } from "@/constants/Colors";
import {
  Camera,
  Car,
  Droplets,
  Shield,
  Sofa,
  Waves,
  Wifi,
  Zap,
} from "lucide-react-native";
import React from "react";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
} from "react-native";

const FACILITIES = [
  { id: "water", label: "Water", Icon: Droplets },
  { id: "zesa", label: "ZESA", Icon: Zap },
  { id: "wifi", label: "WiFi", Icon: Wifi },
  { id: "borehole", label: "Borehole", Icon: Waves },
  { id: "Gated", label: "Gated", Icon: Shield },
  { id: "cctv", label: "CCTV", Icon: Camera },
  { id: "parking", label: "Parking", Icon: Car },
  { id: "furnished", label: "Furnished", Icon: Sofa },
];

interface FacilitiesFilterProps {
  selected: string[];
  onToggle: (id: string) => void;
}

export const FacilitiesFilter = ({
  selected,
  onToggle,
}: FacilitiesFilterProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}
    >
      {FACILITIES.map((facility) => {
        const isSelected = selected.includes(facility.id);
        const Icon = facility.Icon;
        return (
          <TouchableOpacity
            key={facility.id}
            onPress={() => onToggle(facility.id)}
            className="px-4 py-2 rounded-full flex-row items-center"
            style={{
              backgroundColor: isSelected ? theme.primary[300] : theme.surface,
              borderWidth: 1,
              borderColor: isSelected ? theme.primary[300] : theme.muted + "40",
            }}
          >
            <Icon
              size={16}
              color={isSelected ? "#FFFFFF" : theme.text}
              className="mr-1"
            />
            <Text
              className="text-sm font-rubik-medium ml-1"
              style={{
                color: isSelected ? "#FFFFFF" : theme.text,
              }}
            >
              {facility.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
};
