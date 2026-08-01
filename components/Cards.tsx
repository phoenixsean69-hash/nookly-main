import { AccreditedBadge } from "@/components/AccreditedBadge";
import OrganizationApprovedBadge from "@/components/OrganizationApprovedBadge";
import icons from "@/constants/icons";
import { isAccredited } from "@/lib/accreditation";
import { isOrganizationApprovedBoardingHouse } from "@/lib/propertyApproval";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Colors } from "../constants/Colors";

export interface PropertyDocument {
  $id: string;
  $createdAt?: string;
  $updatedAt?: string;
  $permissions?: string[];
  $databaseId?: string;
  $collectionId?: string;
  $sequence?: number;
  propertyName?: string;
  name?: string;
  type?: string;
  description?: string;
  address?: string;
  price?: number;
  new_price?: number;
  price_change_date?: string;
  price_change_type?: "drop" | "hike";
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
  organizationApproved?: boolean | string;
}

interface Props {
  item: PropertyDocument;
  onPress?: () => void;
  showPriceChange?: boolean;
}

const getImageUri = (item: PropertyDocument): string =>
  item.image1 || item.image2 || item.image3 || item.image || "";

const getTitle = (item: PropertyDocument): string =>
  item.propertyName || item.name || "Property";

const getPropertyType = (item: PropertyDocument): string =>
  item.type || "Property";

const getPriceSuffix = (propertyType: string): string => {
  const normalizedType = propertyType.trim().toLowerCase();

  if (
    normalizedType === "boarding" ||
    normalizedType === "boarding house" ||
    normalizedType === "boardinghouse"
  ) {
    return "/head";
  }

  if (normalizedType === "luxury") {
    return "/night";
  }

  return "/month";
};

const hasPriceDrop = (item: PropertyDocument): boolean =>
  item.new_price !== undefined &&
  item.new_price !== null &&
  Number(item.new_price) < Number(item.price ?? 0);

const getPriceDropAmount = (item: PropertyDocument): number =>
  Math.abs(Number(item.new_price ?? 0) - Number(item.price ?? 0));

const getPriceChangePercent = (item: PropertyDocument): number => {
  if (!hasPriceDrop(item) || !item.price) return 0;

  return Math.round(
    ((Number(item.price) - Number(item.new_price ?? 0)) /
      Number(item.price)) *
      100,
  );
};

const PropertyImage = ({
  uri,
  className,
}: {
  uri: string;
  className: string;
}) =>
  uri ? (
    <Image source={{ uri }} className={className} resizeMode="cover" />
  ) : (
    <View
      className={`${className} items-center justify-center bg-gray-200`}
    >
      <Image
        source={icons.home}
        className="h-10 w-10 opacity-40"
        resizeMode="contain"
      />
    </View>
  );

export const FeaturedCard = ({
  item,
  onPress,
  showPriceChange = true,
}: Props) => {
  const imageUri = getImageUri(item);
  const rating = Number(item.rating ?? 0);
  const title = getTitle(item);
  const likes = Number(item.likes ?? 0);
  const views = Number(item.views ?? 0);
  const propertyType = getPropertyType(item);
  const suffix = getPriceSuffix(propertyType);
  const approvedByOrganization =
    isOrganizationApprovedBoardingHouse(item);

  const accredited = isAccredited(
    item.reviews,
    item.$createdAt || item.createdAt,
  );

  const priceDropped = hasPriceDrop(item);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      className="relative h-80 w-60 items-start"
    >
      <PropertyImage uri={imageUri} className="h-full w-full rounded-2xl" />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.78)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        className="absolute inset-x-0 bottom-0 h-48 rounded-b-2xl"
      />

      {showPriceChange && priceDropped ? (
        <View className="absolute left-4 top-4 z-20">
          <View className="flex-row items-center rounded-full bg-red-500 px-3 py-1.5">
            <Text className="mr-1 text-xs font-rubik-bold text-white">🔥</Text>
            <Text className="text-xs font-rubik-bold text-white">
              -${getPriceDropAmount(item)}
            </Text>
          </View>
        </View>
      ) : views > 0 ? (
        <View className="absolute left-4 top-4 z-20 flex-row items-center rounded-full bg-black/60 px-2 py-1">
          <Image
            source={icons.eye}
            className="h-3.5 w-3.5"
            style={{ tintColor: "#FFFFFF" }}
          />
          <Text className="ml-1 text-xs font-rubik-bold text-white">
            {views}
          </Text>
        </View>
      ) : null}

      {accredited ? (
        <View className="absolute right-4 top-4 z-20">
          <AccreditedBadge />
        </View>
      ) : (
        <View className="absolute right-4 top-4 z-20 flex-row items-center rounded-full bg-white/90 px-3 py-1.5">
          <Image source={icons.star} className="h-3.5 w-3.5" />
          <Text className="ml-1 text-xs font-rubik-bold text-primary-300">
            {rating.toFixed()}
          </Text>
        </View>
      )}

      <View className="absolute inset-x-5 bottom-5 z-20">
        <View className="mb-2 flex-row flex-wrap items-center gap-2">
          <View className="rounded-full bg-primary-300/90 px-2 py-0.5">
            <Text className="text-xs font-rubik-medium text-white">
              {propertyType}
            </Text>
          </View>

          {approvedByOrganization && (
            <OrganizationApprovedBadge size="small" />
          )}
        </View>

        <Text
          className="text-xl font-rubik-extrabold text-white"
          numberOfLines={1}
        >
          {title}
        </Text>

        <Text
          className="text-sm font-rubik text-white/90"
          numberOfLines={1}
        >
          {item.address || "Unknown address"}
        </Text>

        <View className="mt-2 flex-row items-center justify-between">
          <View>
            {priceDropped ? (
              <View className="flex-row items-center">
                <Text className="text-base font-rubik-bold text-red-300">
                  ${item.new_price}
                  <Text className="text-sm font-rubik text-white/70">
                    {suffix}
                  </Text>
                </Text>

                <Text className="ml-2 text-sm font-rubik text-white/50 line-through">
                  ${item.price}
                </Text>
              </View>
            ) : (
              <Text className="text-base font-rubik-bold text-white">
                ${item.price ?? 0}
                <Text className="text-sm font-rubik text-white/70">
                  {suffix}
                </Text>
              </Text>
            )}
          </View>

          <View className="flex-row items-center gap-1">
            <Image
              source={icons.heart}
              className="h-4 w-4"
              style={{ tintColor: "#FFFFFF" }}
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

export const Card = ({
  item,
  onPress,
  showPriceChange = true,
}: Props) => {
  const imageUri = getImageUri(item);
  const title = getTitle(item);
  const rating = Number(item.rating ?? 0);
  const likes = Number(item.likes ?? 0);
  const views = Number(item.views ?? 0);
  const propertyType = getPropertyType(item);
  const suffix = getPriceSuffix(propertyType);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const approvedByOrganization =
    isOrganizationApprovedBoardingHouse(item);

  const accredited = isAccredited(
    item.reviews,
    item.$createdAt || item.createdAt,
  );

  const priceDropped = hasPriceDrop(item);
  const priceChangePercent = getPriceChangePercent(item);

  return (
    <TouchableOpacity
      className="relative mt-4 w-full flex-1 rounded-lg px-3 py-4 shadow-lg shadow-black-100/70"
      style={{ backgroundColor: theme.background }}
      onPress={onPress}
      activeOpacity={0.88}
    >
      <View className="relative">
        <PropertyImage uri={imageUri} className="h-40 w-full rounded-lg" />

        {showPriceChange && priceDropped ? (
          <View className="absolute left-2 top-2 z-10">
            <View className="flex-row items-center rounded-full bg-red-500 px-3 py-1.5">
              <Text className="mr-1 text-xs font-rubik-bold text-white">
                🔥
              </Text>
              <Text className="text-xs font-rubik-bold text-white">
                -${getPriceDropAmount(item)}
              </Text>
              <Text className="ml-1 text-[10px] font-rubik-bold text-white opacity-80">
                ({priceChangePercent}%)
              </Text>
            </View>
          </View>
        ) : views > 0 ? (
          <View className="absolute left-2 top-2 flex-row items-center rounded-full bg-black/60 px-2 py-1">
            <Image
              source={icons.eye}
              className="mr-1 h-3 w-3"
              style={{ tintColor: "#FFFFFF" }}
            />
            <Text className="text-xs font-rubik-medium text-white">
              {views}
            </Text>
          </View>
        ) : null}

        {accredited ? (
          <View className="absolute right-2 top-2 z-10">
            <AccreditedBadge />
          </View>
        ) : (
          <View className="absolute right-2 top-2 z-10 flex-row items-center rounded-full bg-white/90 px-3 py-1.5">
            <Image source={icons.star} className="h-3.5 w-3.5" />
            <Text className="ml-1 text-xs font-rubik-bold text-primary-300">
              {rating.toFixed()}
            </Text>
          </View>
        )}

        <View className="absolute inset-x-0 bottom-0 items-center pb-2">
          <View className="rounded-full bg-black/60 px-3 py-1.5">
            <Text className="text-xs font-rubik-medium text-white">
              {propertyType}
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-2 flex-col">
        <View className="flex-row items-center justify-between">
          <Text
            className="mb-1 flex-1 text-base font-rubik-bold"
            style={{ color: theme.title }}
            numberOfLines={1}
          >
            {title}
          </Text>

          {accredited && (
            <View className="ml-2 flex-shrink-0 rounded-full bg-green-500 px-1.5 py-0.5">
              <Text className="text-[8px] font-rubik-bold text-white">
                ✓ accredited
              </Text>
            </View>
          )}
        </View>

        {approvedByOrganization && (
          <View className="mb-2">
            <OrganizationApprovedBadge size="small" />
          </View>
        )}

        <Text
          className="mb-2 text-xs font-rubik"
          style={{ color: theme.muted }}
          numberOfLines={1}
        >
          {item.address || "Unknown address"}
        </Text>

        <View className="flex-row items-center justify-between">
          <View>
            {priceDropped ? (
              <View className="flex-row flex-wrap items-center">
                <Text className="text-base font-rubik-bold text-red-500">
                  ${item.new_price}
                  <Text
                    className="text-xs font-rubik"
                    style={{ color: theme.muted }}
                  >
                    {suffix}
                  </Text>
                </Text>

                <Text
                  className="ml-2 text-xs font-rubik line-through"
                  style={{ color: theme.muted }}
                >
                  ${item.price}
                </Text>

                <View className="ml-2 rounded-full bg-red-100 px-1.5 py-0.5 dark:bg-red-900/30">
                  <Text className="text-[10px] font-rubik-bold text-red-600 dark:text-red-400">
                    -{priceChangePercent}%
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-base font-rubik-bold text-primary-300">
                ${item.price ?? 0}
                <Text
                  className="text-xs font-rubik"
                  style={{ color: theme.muted }}
                >
                  {suffix}
                </Text>
              </Text>
            )}
          </View>

          {likes > 0 && (
            <View className="flex-row items-center gap-1">
              <Image
                source={icons.heart}
                className="h-3.5 w-3.5"
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

        {showPriceChange && priceDropped && item.price_change_date && (
          <Text
            className="mt-1 text-[10px]"
            style={{ color: `${theme.muted}99` }}
          >
            Price dropped{" "}
            {new Date(item.price_change_date).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};