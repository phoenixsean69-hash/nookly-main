import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Query } from "react-native-appwrite";
import { SafeAreaView } from "react-native-safe-area-context";

import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";

type LandlordProperty = {
  $id: string;
  creatorId?: string;
  propertyName?: string;
  address?: string;
  reviews?: string | any[];
  rating?: number;
  views?: number;
  likes?: number;
};

type AccreditedLandlord = {
  $id: string;
  accountId: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  propertyCount: number;
  rating: number;
  reviewCount: number;
  totalViews: number;
  totalLikes: number;
  properties: LandlordProperty[];
};

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

const getAvatarColor = (value: string) => {
  const palette = [
    "#2563EB",
    "#0F766E",
    "#7C3AED",
    "#C2410C",
    "#BE123C",
    "#0369A1",
    "#4D7C0F",
    "#A21CAF",
  ];

  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = value.charCodeAt(index) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
};

const parseReviews = (
  value: unknown,
): { count: number; ratingTotal: number } => {
  if (!value) return { count: 0, ratingTotal: 0 };

  try {
    const parsed =
      typeof value === "string" ? JSON.parse(value) : value;

    if (!Array.isArray(parsed)) {
      return { count: 0, ratingTotal: 0 };
    }

    return {
      count: parsed.length,
      ratingTotal: parsed.reduce(
        (total, review) =>
          total + Number(review?.rating ?? 0),
        0,
      ),
    };
  } catch {
    return { count: 0, ratingTotal: 0 };
  }
};

// Keep this aligned with the current student landlords screen.
const isAccreditedLandlord = (
  landlord: AccreditedLandlord,
): boolean =>
  landlord.propertyCount >= 1 &&
  landlord.rating >= 4 &&
  landlord.reviewCount >= 2;

const listAllDocuments = async (
  collectionId: string,
  baseQueries: string[] = [],
) => {
  const documents: any[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await databases.listDocuments(
      config.databaseId!,
      collectionId,
      [
        ...baseQueries,
        Query.limit(PAGE_SIZE),
        Query.offset(page * PAGE_SIZE),
      ],
    );

    documents.push(...response.documents);

    if (
      response.documents.length < PAGE_SIZE ||
      documents.length >= response.total
    ) {
      break;
    }
  }

  return documents;
};

const LandlordAvatar = ({
  landlord,
}: {
  landlord: AccreditedLandlord;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const fallbackColor = getAvatarColor(
    landlord.accountId || landlord.$id,
  );
  const initial =
    landlord.name?.trim().charAt(0).toUpperCase() || "L";

  if (landlord.avatar && !imageFailed) {
    return (
      <Image
        source={{ uri: landlord.avatar }}
        onError={() => setImageFailed(true)}
        className="h-16 w-16 rounded-full"
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className="h-16 w-16 items-center justify-center rounded-full"
      style={{ backgroundColor: fallbackColor }}
    >
      <Text className="text-2xl font-rubik-bold text-white">
        {initial}
      </Text>
    </View>
  );
};

const AccreditedLandlords = () => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [landlords, setLandlords] = useState<
    AccreditedLandlord[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const loadLandlords = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        setErrorMessage("");

        if (
          !config.databaseId ||
          !config.usersCollectionId ||
          !config.propertiesCollectionId
        ) {
          throw new Error(
            "Required Appwrite collection configuration is missing.",
          );
        }

        const [landlordDocuments, propertyDocuments] =
          await Promise.all([
            listAllDocuments(config.usersCollectionId, [
              Query.equal("userMode", "landlord"),
            ]),
            listAllDocuments(config.propertiesCollectionId),
          ]);

        const propertiesByCreator = new Map<
          string,
          LandlordProperty[]
        >();

        propertyDocuments.forEach((document: any) => {
          const creatorId = String(
            document.creatorId ?? "",
          ).trim();

          if (!creatorId) return;

          const current =
            propertiesByCreator.get(creatorId) ?? [];
          current.push(document as LandlordProperty);
          propertiesByCreator.set(creatorId, current);
        });

        const enriched: AccreditedLandlord[] =
          landlordDocuments.map((document: any) => {
            const accountId = String(
              document.accountId ?? document.$id,
            );
            const properties =
              propertiesByCreator.get(accountId) ?? [];

            let totalReviews = 0;
            let totalRating = 0;
            let totalViews = 0;
            let totalLikes = 0;

            properties.forEach((property) => {
              const reviewStats = parseReviews(
                property.reviews,
              );
              totalReviews += reviewStats.count;
              totalRating += reviewStats.ratingTotal;
              totalViews += Number(property.views ?? 0);
              totalLikes += Number(property.likes ?? 0);
            });

            const averageRating =
              totalReviews > 0
                ? Number(
                    (
                      totalRating / totalReviews
                    ).toFixed(1),
                  )
                : 0;

            return {
              $id: String(document.$id),
              accountId,
              name:
                String(document.name ?? "").trim() ||
                "Landlord",
              email: String(document.email ?? ""),
              phone: document.phone
                ? String(document.phone)
                : undefined,
              avatar: document.avatar
                ? String(document.avatar)
                : undefined,
              propertyCount: properties.length,
              rating: averageRating,
              reviewCount: totalReviews,
              totalViews,
              totalLikes,
              properties,
            };
          });

        const accredited = enriched
          .filter(isAccreditedLandlord)
          .sort((left, right) => {
            if (right.rating !== left.rating) {
              return right.rating - left.rating;
            }
            if (right.reviewCount !== left.reviewCount) {
              return right.reviewCount - left.reviewCount;
            }
            return right.propertyCount - left.propertyCount;
          });

        setLandlords(accredited);
      } catch (error) {
        console.error(
          "Error loading accredited landlords:",
          error,
        );
        setErrorMessage(
          "We could not load accredited landlords right now.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadLandlords();
  }, [loadLandlords]);

  const visibleLandlords = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return landlords;

    return landlords.filter((landlord) => {
      const propertyText = landlord.properties
        .map((property) =>
          [
            property.propertyName,
            property.address,
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" ")
        .toLowerCase();

      return (
        landlord.name.toLowerCase().includes(query) ||
        landlord.email.toLowerCase().includes(query) ||
        landlord.phone?.toLowerCase().includes(query) ||
        propertyText.includes(query)
      );
    });
  }, [landlords, searchQuery]);

  const openLandlord = (
    landlord: AccreditedLandlord,
  ) => {
    router.push({
      pathname: "/s-landlords",
      params: {
        landlordId:
          landlord.accountId || landlord.$id,
      },
    } as any);
  };

  const renderLandlord = ({
    item,
  }: {
    item: AccreditedLandlord;
  }) => (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => openLandlord(item)}
      className="mb-4 rounded-3xl p-4"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: `${theme.muted}25`,
      }}
    >
      <View className="flex-row items-start">
        <View className="relative">
          <LandlordAvatar landlord={item} />
          <View
            className="absolute -bottom-1 -right-1 h-6 w-6 items-center justify-center rounded-full border-2"
            style={{
              backgroundColor: "#2563EB",
              borderColor: theme.surface,
            }}
          >
            <Ionicons
              name="checkmark"
              size={14}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View className="ml-4 flex-1">
          <View className="flex-row items-start justify-between">
            <View className="mr-2 flex-1">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
                numberOfLines={1}
              >
                {item.name}
              </Text>

              <View className="mt-1 flex-row items-center">
                <Ionicons
                  name="shield-checkmark"
                  size={14}
                  color="#2563EB"
                />
                <Text className="ml-1 text-xs font-rubik-medium text-blue-600">
                  Accredited landlord
                </Text>
              </View>
            </View>

            <View className="flex-row items-center rounded-full bg-amber-50 px-2.5 py-1">
              <Ionicons
                name="star"
                size={14}
                color="#F59E0B"
              />
              <Text className="ml-1 text-xs font-rubik-bold text-amber-700">
                {item.rating.toFixed(1)}
              </Text>
            </View>
          </View>

          {item.email ? (
            <View className="mt-2 flex-row items-center">
              <Ionicons
                name="mail-outline"
                size={14}
                color={theme.muted}
              />
              <Text
                className="ml-1.5 flex-1 text-xs"
                style={{ color: theme.muted }}
                numberOfLines={1}
              >
                {item.email}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View
        className="my-4 h-px"
        style={{ backgroundColor: `${theme.muted}20` }}
      />

      <View className="flex-row justify-between">
        <View className="flex-1 items-center">
          <Text
            className="text-base font-rubik-bold"
            style={{ color: theme.title }}
          >
            {item.propertyCount}
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{ color: theme.muted }}
          >
            Properties
          </Text>
        </View>

        <View
          className="w-px"
          style={{ backgroundColor: `${theme.muted}25` }}
        />

        <View className="flex-1 items-center">
          <Text
            className="text-base font-rubik-bold"
            style={{ color: theme.title }}
          >
            {item.reviewCount}
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{ color: theme.muted }}
          >
            Reviews
          </Text>
        </View>

        <View
          className="w-px"
          style={{ backgroundColor: `${theme.muted}25` }}
        />

        <View className="flex-1 items-center">
          <Text
            className="text-base font-rubik-bold"
            style={{ color: theme.title }}
          >
            {item.totalViews}
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{ color: theme.muted }}
          >
            Views
          </Text>
        </View>
      </View>

      <View className="mt-4 flex-row items-center justify-between rounded-2xl bg-blue-50 px-4 py-3">
        <Text className="text-sm font-rubik-medium text-blue-700">
          View landlord profile
        </Text>
        <Ionicons
          name="chevron-forward"
          size={18}
          color="#1D4ED8"
        />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <View
        className="flex-row items-center px-5 pb-3 pt-2"
        style={{ backgroundColor: theme.navBackground }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: `${theme.muted}15` }}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color={theme.title}
          />
        </TouchableOpacity>

        <View className="ml-3 flex-1">
          <Text
            className="text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Accredited Landlords
          </Text>
          <Text
            className="mt-0.5 text-xs"
            style={{ color: theme.muted }}
          >
            Trusted landlords with a strong Nookly record
          </Text>
        </View>

        <View
          className="min-w-[42px] items-center justify-center rounded-full px-3 py-2"
          style={{ backgroundColor: `${theme.primary[300]}15` }}
        >
          <Text
            className="text-sm font-rubik-bold"
            style={{ color: theme.primary[300] }}
          >
            {landlords.length}
          </Text>
        </View>
      </View>

      <View className="px-5 pt-4">
        <View
          className="flex-row items-center rounded-2xl px-4"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: `${theme.muted}25`,
          }}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={theme.muted}
          />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search landlords or properties"
            placeholderTextColor={theme.muted}
            className="ml-2 flex-1 py-3.5 font-rubik"
            style={{ color: theme.text }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.muted}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <View
          className="mt-3 flex-row rounded-2xl p-3"
          style={{
            backgroundColor: `${theme.primary[300]}10`,
          }}
        >
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={theme.primary[300]}
          />
          <Text
            className="ml-2 flex-1 text-xs leading-5"
            style={{ color: theme.text }}
          >
            Accredited landlords currently have at least
            one listed property, a 4.0+ average rating,
            and at least 2 reviews.
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator
            size="large"
            color={theme.primary[300]}
          />
          <Text
            className="mt-3 text-sm font-rubik"
            style={{ color: theme.muted }}
          >
            Loading accredited landlords...
          </Text>
        </View>
      ) : (
        <FlatList
          data={visibleLandlords}
          keyExtractor={(item) => item.$id}
          renderItem={renderLandlord}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 120,
            flexGrow: 1,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadLandlords(true)}
              tintColor={theme.primary[300]}
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-8 py-16">
              <View
                className="h-20 w-20 items-center justify-center rounded-full"
                style={{
                  backgroundColor: `${theme.primary[300]}12`,
                }}
              >
                <Image
                  source={icons.owner}
                  className="h-10 w-10"
                  resizeMode="contain"
                  style={{
                    tintColor: theme.primary[300],
                  }}
                />
              </View>

              <Text
                className="mt-5 text-center text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                {searchQuery
                  ? "No matching landlords"
                  : "No accredited landlords yet"}
              </Text>

              <Text
                className="mt-2 text-center text-sm leading-5"
                style={{ color: theme.muted }}
              >
                {searchQuery
                  ? "Try another name, email, phone number, or property."
                  : errorMessage ||
                    "Landlords will appear here once they meet the accreditation criteria."}
              </Text>

              {errorMessage ? (
                <TouchableOpacity
                  onPress={() => loadLandlords()}
                  className="mt-5 rounded-full px-5 py-3"
                  style={{
                    backgroundColor: theme.primary[300],
                  }}
                >
                  <Text className="font-rubik-bold text-white">
                    Try again
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

export default AccreditedLandlords;
