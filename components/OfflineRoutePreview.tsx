import { Colors } from "@/constants/Colors";
import type { DrivingRoute } from "@/lib/routingService";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Text, View, useColorScheme } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";

interface OfflineRoutePreviewProps {
  route: DrivingRoute;
  startLabel?: string;
  destinationLabel?: string;
  compact?: boolean;
}

interface NormalizedRoute {
  points: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

const VIEWBOX_WIDTH = 100;
const VIEWBOX_HEIGHT = 68;
const PADDING = 7;
const MAX_DRAW_POINTS = 260;

const normalizeRoute = (
  coordinates: [number, number][],
): NormalizedRoute | null => {
  const valid = coordinates.filter(
    ([latitude, longitude]) =>
      Number.isFinite(latitude) && Number.isFinite(longitude),
  );

  if (valid.length < 2) return null;

  const sampleStep = Math.max(1, Math.ceil(valid.length / MAX_DRAW_POINTS));
  const sampled = valid.filter(
    (_, index) => index % sampleStep === 0 || index === valid.length - 1,
  );

  const latitudes = sampled.map(([latitude]) => latitude);
  const longitudes = sampled.map(([, longitude]) => longitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  const latitudeSpan = Math.max(maximumLatitude - minimumLatitude, 0.00001);
  const longitudeSpan = Math.max(
    maximumLongitude - minimumLongitude,
    0.00001,
  );

  const project = ([latitude, longitude]: [number, number]) => ({
    x:
      PADDING +
      ((longitude - minimumLongitude) / longitudeSpan) *
        (VIEWBOX_WIDTH - PADDING * 2),
    y:
      PADDING +
      ((maximumLatitude - latitude) / latitudeSpan) *
        (VIEWBOX_HEIGHT - PADDING * 2),
  });

  const projected = sampled.map(project);
  return {
    points: projected.map(({ x, y }) => `${x},${y}`).join(" "),
    start: projected[0],
    end: projected[projected.length - 1],
  };
};

const OfflineRoutePreview = ({
  route,
  startLabel = "Property",
  destinationLabel = "Destination",
  compact = false,
}: OfflineRoutePreviewProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const normalized = useMemo(
    () => normalizeRoute(route.coordinates),
    [route.coordinates],
  );

  if (!normalized) {
    return (
      <View
        className="items-center justify-center rounded-2xl border p-5"
        style={{
          minHeight: compact ? 150 : 210,
          backgroundColor: theme.surface,
          borderColor: `${theme.muted}25`,
        }}
      >
        <Ionicons name="map-outline" size={30} color={theme.muted} />
        <Text className="mt-2 text-xs" style={{ color: theme.muted }}>
          This offline route could not be drawn.
        </Text>
      </View>
    );
  }

  const routeColor = theme.primary[300];
  const gridColor = `${theme.muted}24`;

  return (
    <View
      className="overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}25`,
      }}
    >
      <View
        className="flex-row items-center justify-between px-3 py-2"
        style={{ backgroundColor: theme.navBackground }}
      >
        <View className="flex-row items-center">
          <Ionicons
            name="cloud-offline-outline"
            size={16}
            color={theme.primary[300]}
          />
          <Text
            className="ml-1.5 text-xs font-rubik-bold"
            style={{ color: theme.title }}
          >
            Offline route preview
          </Text>
        </View>
        <Text className="text-[11px]" style={{ color: theme.muted }}>
          {route.distanceKm.toFixed(1)} km • {Math.max(
            1,
            Math.round(route.durationMinutes),
          )} min
        </Text>
      </View>

      <View style={{ height: compact ? 150 : 220 }}>
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {[20, 40, 60, 80].map((x) => (
            <Line
              key={`vertical-${x}`}
              x1={x}
              y1={0}
              x2={x}
              y2={VIEWBOX_HEIGHT}
              stroke={gridColor}
              strokeWidth={0.35}
            />
          ))}
          {[17, 34, 51].map((y) => (
            <Line
              key={`horizontal-${y}`}
              x1={0}
              y1={y}
              x2={VIEWBOX_WIDTH}
              y2={y}
              stroke={gridColor}
              strokeWidth={0.35}
            />
          ))}

          <Polyline
            points={normalized.points}
            fill="none"
            stroke={routeColor}
            strokeWidth={2.7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <Circle
            cx={normalized.start.x}
            cy={normalized.start.y}
            r={3.4}
            fill="#16A34A"
            stroke="#FFFFFF"
            strokeWidth={1.1}
          />
          <Circle
            cx={normalized.end.x}
            cy={normalized.end.y}
            r={3.4}
            fill="#DC2626"
            stroke="#FFFFFF"
            strokeWidth={1.1}
          />
        </Svg>
      </View>

      <View
        className="flex-row border-t px-3 py-2.5"
        style={{ borderTopColor: `${theme.muted}20` }}
      >
        <View className="mr-2 flex-1 flex-row items-center">
          <View className="h-2.5 w-2.5 rounded-full bg-green-600" />
          <Text
            className="ml-1.5 flex-1 text-[11px]"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {startLabel}
          </Text>
        </View>
        <View className="flex-1 flex-row items-center justify-end">
          <View className="h-2.5 w-2.5 rounded-full bg-red-600" />
          <Text
            className="ml-1.5 max-w-[86%] text-[11px]"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {destinationLabel}
          </Text>
        </View>
      </View>
    </View>
  );
};

export default OfflineRoutePreview;
