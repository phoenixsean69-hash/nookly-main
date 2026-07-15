// components/Cards.tsx
import { AccreditedBadge } from "@/components/AccreditedBadge";
import icons from "@/constants/icons";
import { isAccredited } from "@/lib/accreditation";
import { LinearGradient } from "expo-linear-gradient";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Models } from "react-native-appwrite";
import { Colors } from "../constants/Colors";

export interface PropertyDocument extends Models.Document {
  propertyName?: string;
  name?: string;
  type?: string;
  description?: string;
  address?: string;
  price?: number;
  new_price?: number; // ✅ Added: latest price
  price_change_date?: string; // ✅ Added: date of price change
  price_change_type?: "drop" | "hike"; // ✅ Added: type of change
  likes?: number;
  views?: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  rating?: number;
  image?: string;
  image1?: string;
  image2?: string;
  image3?: string;
  reviews?: string;
  createdAt?: string;
}

interface Props {
  item: PropertyDocument;
  onPress?: () => void;
  showPriceChange?: boolean; // ✅ New prop to control price change display
}

export const FeaturedCard = ({ item, onPress, showPriceChange = true }: Props) => {
  const imageUri = item.image1 || item.image2 || item.image3 || item.image;
  const rating = item.rating ?? 0;
  const title = item.propertyName || item.name || "Property";
  const likes = item.likes ?? 0;
  const views = item.views ?? 0;
  const propertyType = item.type || "Property";
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // ✅ Check if property is accredited
  const accredited = isAccredited(
    item.reviews,
    item.$createdAt || item.createdAt
  );

  // ✅ Check if there's a price drop
  const hasPriceDrop = item.new_price !== undefined && 
                       item.new_price !== null && 
                       item.new_price < (item.price || 0);

  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex flex-col items-start w-60 h-80 relative"
    >
      <Image source={{ uri: imageUri }} className="size-full rounded-2xl" />

      {/* Dark gradient overlay for better text visibility */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.3)", "rgba(0,0,0,0.6)"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 1 }}
        className="absolute bottom-0 left-0 right-0 h-40 rounded-b-2xl"
      />

      {/* ✅ Price Drop Badge - Top Left */}
      {showPriceChange && hasPriceDrop && (
        <View className="absolute top-5 left-5 z-20">
          <View className="bg-red-500 px-3 py-1.5 rounded-full flex-row items-center shadow-lg">
            <Text className="text-white font-rubik-bold text-xs mr-1">
              🔥
            </Text>
            <Text className="text-white font-rubik-bold text-xs">
              -${Math.abs((item.new_price || 0) - (item.price || 0))}
            </Text>
          </View>
        </View>
      )}

      {/* ✅ Accredited Badge - Top Right corner */}
      {accredited && (
        <View className="absolute top-5 right-5 z-20">
          <AccreditedBadge size="small" />
        </View>
      )}

      {/* Rating badge - Top Right (only if not accredited, or below badge) */}
      {!accredited && (
        <View className="flex flex-row items-center bg-white/90 px-3 py-1.5 rounded-full absolute top-5 right-5 z-10">
          <Image source={icons.star} className="size-3.5" />
          <Text className="text-xs font-rubik-bold text-primary-300 ml-1">
            {rating.toFixed()}
          </Text>
        </View>
      )}

      {/* Views badge - top center-left (moved to avoid conflict with price drop) */}
      {views > 0 && !hasPriceDrop && (
        <View className="flex flex-row items-center bg-black/50 px-2 py-1 rounded-full absolute top-5 left-5 z-10">
          <Image source={icons.eye} className="size-3.5" tintColor="#fff" />
          <Text className="text-xs font-rubik-bold text-white ml-1">
            {views}
          </Text>
        </View>
      )}

      {/* Property details at bottom */}
      <View className="absolute bottom-5 inset-x-5 z-10">
        {/* Type badge at bottom */}
        <View className="flex-row items-center mb-2">
          <View className="bg-primary-300/90 px-2 py-0.5 rounded-full">
            <Text className="text-xs font-rubik-medium text-white">
              {propertyType}
            </Text>
          </View>
        </View>

        <Text
          className="text-xl font-rubik-extrabold text-white"
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text className="text-sm font-rubik text-white/90" numberOfLines={1}>
          {item.address || "Unknown address"}
        </Text>

        <View className="flex flex-row items-center justify-between mt-2">
          <View>
            {/* ✅ Show current price with strike-through if there's a drop */}
            {hasPriceDrop ? (
              <View className="flex-row items-center">
                <Text className="text-base font-rubik-bold text-red-400">
                  ${item.new_price}
                  <Text className="text-sm font-rubik text-white/70">
                    {propertyType === "Boarding"
                      ? "/head"
                      : propertyType === "Luxury"
                        ? "/night"
                        : "/month"}
                  </Text>
                </Text>
                <Text className="text-sm font-rubik text-white/50 line-through ml-2">
                  ${item.price}
                </Text>
              </View>
            ) : (
              <Text className="text-base font-rubik-bold text-white">
                ${item.price ?? 0}
                <Text className="text-sm font-rubik text-white/70">
                  {propertyType === "Boarding"
                    ? "/head"
                    : propertyType === "Luxury"
                      ? "/night"
                      : "/month"}
                </Text>
              </Text>
            )}
          </View>
          <View className="flex flex-row items-center gap-1">
            <Image
              source={icons.heart}
              className="size-4"
              tintColor="#ffffff"
            />
            {likes > 0 && (
              <Text className="text-xs font-rubik-bold text-white">
                {likes}
              </Text>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export const Card = ({ item, onPress, showPriceChange = true }: Props) => {
  const imageUri = item.image1 || item.image2 || item.image3 || item.image;
  const title = item.propertyName || item.name || "Property";
  const rating = item.rating ?? 0;
  const likes = item.likes ?? 0;
  const views = item.views ?? 0;
  const propertyType = item.type || "Property";
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // ✅ Check if property is accredited
  const accredited = isAccredited(
    item.reviews,
    item.$createdAt || item.createdAt
  );

  // ✅ Check if there's a price drop
  const hasPriceDrop = item.new_price !== undefined && 
                       item.new_price !== null && 
                       item.new_price < (item.price || 0);

  // ✅ Calculate price change percentage
  const getPriceChangePercent = () => {
    if (!hasPriceDrop || !item.price) return 0;
    return Math.round(((item.price - (item.new_price || 0)) / item.price) * 100);
  };

  return (
    <TouchableOpacity
      className="flex-1 w-full mt-4 px-3 py-4 rounded-lg shadow-lg shadow-black-100/70 relative"
      style={{ backgroundColor: theme.background }}
      onPress={onPress}
    >
      {/* Image Container with Badges Overlay */}
      <View className="relative">
        <Image source={{ uri: imageUri }} className="w-full h-40 rounded-lg" />

        {/* ✅ Price Drop Badge - Top Left */}
        {showPriceChange && hasPriceDrop && (
          <View className="absolute top-2 left-2 z-10">
            <View className="bg-red-500 px-3 py-1.5 rounded-full flex-row items-center shadow-lg">
              <Text className="text-white font-rubik-bold text-xs mr-1">
                🔥
              </Text>
              <Text className="text-white font-rubik-bold text-xs">
                -${Math.abs((item.new_price || 0) - (item.price || 0))}
              </Text>
              <Text className="text-white font-rubik-bold text-[10px] ml-1 opacity-80">
                ({getPriceChangePercent()}%)
              </Text>
            </View>
          </View>
        )}

        {/* Views Badge - Top Left (only if no price drop) */}
        {views > 0 && !hasPriceDrop && (
          <View className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded-full flex-row items-center">
            <Image
              source={icons.eye}
              className="w-3 h-3 mr-1"
              style={{ tintColor: "#fff" }}
            />
            <Text className="text-xs font-rubik-medium text-white">
              {views}
            </Text>
          </View>
        )}

        {/* ✅ Accredited Badge - Top Right (replaces rating badge) */}
        {accredited ? (
          <View className="absolute top-2 right-2 z-10">
            <AccreditedBadge size="small" />
          </View>
        ) : (
          /* Rating Badge - Top Right (only if not accredited) */
          <View className="flex flex-row items-center bg-white/90 px-3 py-1.5 rounded-full absolute top-2 right-2 z-10">
            <Image source={icons.star} className="size-3.5" />
            <Text className="text-xs font-rubik-bold text-primary-300 ml-1">
              {rating.toFixed()}
            </Text>
          </View>
        )}

        {/* Property Type Badge - Bottom Center */}
        <View className="absolute bottom-0 left-0 right-0 items-center pb-2">
          <View className="bg-black/60 px-3 py-1.5 rounded-full">
            <Text className="text-xs font-rubik-medium text-white">
              {propertyType}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex flex-col mt-2">
        {/* Title with accreditation indicator */}
        <View className="flex-row items-center justify-between">
          <Text
            className="text-base font-rubik-bold mb-1 flex-1"
            style={{ color: theme.title }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {accredited && (
            <View className="ml-2 flex-shrink-0">
              <View className="bg-green-500 px-1.5 py-0.5 rounded-full">
                <Text className="text-white text-[8px] font-rubik-bold">
                  ✓ accredited
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Address */}
        <Text
          className="text-xs font-rubik mb-2"
          style={{ color: theme.muted }}
          numberOfLines={1}
        >
          {item.address || "Unknown address"}
        </Text>

        {/* Price and Likes Row */}
        <View className="flex flex-row items-center justify-between">
          {/* ✅ Price with price drop display */}
          <View>
            {hasPriceDrop ? (
              <View className="flex-row items-center">
                <Text className="text-base font-rubik-bold text-red-500">
                  ${item.new_price}
                  <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
                    {propertyType === "Boarding"
                      ? "/head"
                      : propertyType === "Luxury"
                        ? "/night"
                        : "/month"}
                  </Text>
                </Text>
                <Text className="text-xs font-rubik line-through ml-2" style={{ color: theme.muted }}>
                  ${item.price}
                </Text>
                <View className="ml-2 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded-full">
                  <Text className="text-[10px] font-rubik-bold text-red-600 dark:text-red-400">
                    -{getPriceChangePercent()}%
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-base font-rubik-bold text-primary-300">
                ${item.price ?? 0}
                <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
                  {propertyType === "Boarding"
                    ? "/head"
                    : propertyType === "Luxury"
                      ? "/night"
                      : "/month"}
                </Text>
              </Text>
            )}
          </View>

          {/* Likes */}
          {likes > 0 && (
            <View className="flex flex-row items-center gap-1">
              <Image
                source={icons.heart}
                className="w-3.5 h-3.5"
                style={{ tintColor: "#FF69B4" }}
              />
              <Text
                className="text-xs font-rubik-medium"
                style={{ color: theme.muted }}
              >
                {likes}
              </Text>
            </View>
          )}
        </View>

        {/* ✅ Price Change Date (if available) */}
        {showPriceChange && hasPriceDrop && item.price_change_date && (
          <Text className="text-[10px] mt-1" style={{ color: theme.muted + "60" }}>
            Price dropped {new Date(item.price_change_date).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};