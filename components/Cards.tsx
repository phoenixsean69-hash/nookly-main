import icons from "@/constants/icons";
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
}

interface Props {
  item: PropertyDocument;
  onPress?: () => void;
}

export const FeaturedCard = ({ item, onPress }: Props) => {
  const imageUri = item.image1 || item.image2 || item.image3 || item.image;
  const rating = item.rating ?? 0;
  const title = item.propertyName || item.name || "Property";
  const likes = item.likes ?? 0;
  const views = item.views ?? 0;
  const propertyType = item.type || "Property";
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

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

      {/* Rating badge */}
      <View className="flex flex-row items-center bg-white/90 px-3 py-1.5 rounded-full absolute top-5 right-5 z-10">
        <Image source={icons.star} className="size-3.5" />
        <Text className="text-xs font-rubik-bold text-primary-300 ml-1">
          {rating.toFixed()}
        </Text>
      </View>

      {/* Views badge - top left */}
      {views > 0 && (
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
          <Text className="text-base font-rubik-bold text-white">
            ${item.price ?? 0}
            <Text className="text-lg font-rubik text-white">
              {propertyType === "Boarding"
                ? "/head"
                : propertyType === "Luxury"
                  ? "/night"
                  : "/month"}
            </Text>
          </Text>
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

export const Card = ({ item, onPress }: Props) => {
  const imageUri = item.image1 || item.image2 || item.image3 || item.image;
  const title = item.propertyName || item.name || "Property";
  const rating = item.rating ?? 0;
  const likes = item.likes ?? 0;
  const views = item.views ?? 0;
  const propertyType = item.type || "Property";
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <TouchableOpacity
      className="flex-1 w-full mt-4 px-3 py-4 rounded-lg shadow-lg shadow-black-100/70 relative"
      style={{ backgroundColor: theme.background }}
      onPress={onPress}
    >
      {/* Image Container with Badges Overlay */}
      <View className="relative">
        <Image source={{ uri: imageUri }} className="w-full h-40 rounded-lg" />

        {/* Views Badge - Top Left */}
        {views > 0 && (
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

        {/* Rating Badge - Top Right */}
        <View className="flex flex-row items-center bg-white/90 px-3 py-1.5 rounded-full absolute top-2 right-2 z-10">
          <Image source={icons.star} className="size-3.5" />
          <Text className="text-xs font-rubik-bold text-primary-300 ml-1">
            {rating.toFixed()}
          </Text>
        </View>

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
        {/* Title */}
        <Text
          className="text-base font-rubik-bold mb-1"
          style={{ color: theme.title }}
          numberOfLines={1}
        >
          {title}
        </Text>

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
          {/* Price */}
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
      </View>
    </TouchableOpacity>
  );
};
