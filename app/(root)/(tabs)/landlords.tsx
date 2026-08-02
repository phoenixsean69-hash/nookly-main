// app/(root)/landlords.tsx
import { Card as PropertyCard } from "@/components/Cards";
import ContactModal from "@/components/ContactModal";
import NoResults from "@/components/NoResults";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";
import { useAppwrite } from "@/lib/useAppwrite";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { Query } from "react-native-appwrite";
import { SafeAreaView } from "react-native-safe-area-context";

interface Landlord {
  $id: string;
  accountId: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  userMode: "landlord";
  properties?: any[];
  propertyCount: number;
  rating: number;
  reviewCount: number;
  totalViews: number;
  totalLikes: number;
  joinedDate?: string;
}

type FilterKey =
  | "all"
  | "hasProperties"
  | "topRated"
  | "mostViewed"
  | "accredited";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "hasProperties", label: "With Properties" },
  { key: "topRated", label: "Top Rated" },
  { key: "mostViewed", label: "Most Viewed" },
  { key: "accredited", label: "accredited" },
];

// Tick is EARNED: at least 1 property, rating >= 4.0, and 2+ reviews
const isaccredited = (l: Landlord) =>
  (l.propertyCount || 0) >= 1 &&
  (l.rating || 0) >= 4 &&
  (l.reviewCount || 0) >= 2;

// ✅ Generate a unique color based on string (name or ID)
const getColorFromString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  const saturation = 70 + Math.abs(hash % 30);
  const lightness = 45 + Math.abs(hash % 20);

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// ✅ Generate a complementary text color (black or white) based on background
const getTextColorForBackground = (bgColor: string): string => {
  const match = bgColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    const lightness = parseInt(match[3]);
    return lightness > 60 ? "#1F2937" : "#FFFFFF";
  }
  return "#FFFFFF";
};

// ✅ Predefined vibrant color palettes
const COLOR_PALETTES = [
  ["#FF6B6B", "#EE5A24"],
  ["#4ECDC4", "#45B7AA"],
  ["#45B7D1", "#3498DB"],
  ["#96CEB4", "#66BB6A"],
  ["#FFEAA7", "#FDCB6E"],
  ["#DDA0DD", "#9B59B6"],
  ["#FF9A9E", "#FAD0C4"],
  ["#A8E6CF", "#55EFC4"],
  ["#FFD93D", "#F9A825"],
  ["#6C5CE7", "#4834D4"],
  ["#FD79A8", "#E84393"],
  ["#00B894", "#00A381"],
  ["#E17055", "#D63031"],
  ["#74B9FF", "#0984E3"],
  ["#A29BFE", "#6C5CE7"],
  ["#FDCB6E", "#F39C12"],
  ["#00CEC9", "#0984E3"],
  ["#E84393", "#D63384"],
  ["#636E72", "#2D3436"],
];

// ✅ Get a consistent color from the landlord's ID
const getAvatarColors = (
  id: string,
): { bg: string; text: string; gradient: [string, string] } => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const paletteIndex = Math.abs(hash) % COLOR_PALETTES.length;
  const colors = COLOR_PALETTES[paletteIndex];

  const bgColor = colors[0];
  const textColor = getTextColorForBackground(bgColor);

  return {
    bg: bgColor,
    text: textColor,
    gradient: colors as [string, string],
  };
};

// Avatar with dynamic fallback colors
const LandlordAvatar = ({
  uri,
  size,
  name,
  id,
}: {
  uri?: string;
  size: number;
  name?: string;
  id: string;
}) => {
  const [failed, setFailed] = useState(false);
  const showFallback = !uri || failed;
  const colors = getAvatarColors(id);
  const initial = name?.charAt(0).toUpperCase() || "?";

  if (!showFallback) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.bg,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.bg,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: colors.text,
          fontSize: size * 0.45,
          fontWeight: "700",
        }}
      >
        {initial}
      </Text>
    </View>
  );
};

const Landlords = () => {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(
    null,
  );
  const [showLandlordDetails, setShowLandlordDetails] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const { landlordId } = useLocalSearchParams<{ landlordId?: string }>();

  // ✅ Contact Modal State
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [landlordContact, setLandlordContact] = useState<{
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  } | null>(null);

  // Fetch all landlords (users collection only)
  const {
    data: landlords,
    loading,
    refetch,
  } = useAppwrite({
    fn: async () => {
      try {
        const response = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("userMode", "landlord")],
        );

        const enrichedLandlords = await Promise.all(
          response.documents.map(async (doc: any) => {
            const properties = await databases.listDocuments(
              config.databaseId!,
              config.propertiesCollectionId!,
              [Query.equal("creatorId", doc.accountId)],
            );

            const propertyDocs = properties.documents;

            let totalViews = 0;
            let totalLikes = 0;
            let totalReviews = 0;
            let totalRating = 0;

            for (const prop of propertyDocs) {
              totalViews += prop.views || 0;
              totalLikes += prop.likes || 0;
              if (prop.reviews) {
                try {
                  const reviews = JSON.parse(prop.reviews);
                  if (Array.isArray(reviews)) {
                    totalReviews += reviews.length;
                    for (const review of reviews) {
                      totalRating += review.rating || 0;
                    }
                  }
                } catch {}
              }
            }

            const avgRating =
              totalReviews > 0
                ? Number((totalRating / totalReviews).toFixed(1))
                : 0;

            return {
              ...doc,
              properties: propertyDocs,
              propertyCount: propertyDocs.length,
              totalViews,
              totalLikes,
              reviewCount: totalReviews,
              rating: avgRating,
              joinedDate: doc.$createdAt,
            };
          }),
        );

        return enrichedLandlords.sort(
          (a, b) => b.propertyCount - a.propertyCount,
        );
      } catch (error) {
        console.error("Error fetching landlords:", error);
        return [];
      }
    },
    params: {},
    skip: false,
  });

  // =========================================================================
  // SEARCH + FILTERS
  // =========================================================================
  const visibleLandlords = useMemo(() => {
    let list: Landlord[] = landlords ?? [];

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name?.toLowerCase().includes(q) ||
          l.email?.toLowerCase().includes(q) ||
          l.phone?.toLowerCase().includes(q),
      );
    }

    switch (activeFilter) {
      case "hasProperties":
        list = list.filter((l) => (l.propertyCount || 0) > 0);
        break;
      case "topRated":
        list = [...list]
          .filter((l) => (l.rating || 0) > 0)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "mostViewed":
        list = [...list].sort(
          (a, b) => (b.totalViews || 0) - (a.totalViews || 0),
        );
        break;
      case "accredited":
        list = list.filter(isaccredited);
        break;
      case "all":
      default:
        break;
    }

    return list;
  }, [landlords, searchQuery, activeFilter]);

  // ✅ Handle Contact Landlord
  const handleContactLandlord = (landlord: Landlord) => {
    setLandlordContact({
      name: landlord.name,
      email: landlord.email,
      phone: landlord.phone || undefined,
      avatar: landlord.avatar || undefined,
    });
    setContactModalVisible(true);
  };

  const handleLandlordPress = (landlord: Landlord) => {
    setSelectedLandlord(landlord);
    setShowLandlordDetails(true);
  };

  const handlePropertyPress = (propertyId: string) => {
    setShowLandlordDetails(false);
    router.push(`/properties/${propertyId}`);
  };

  const [autoOpened, setAutoOpened] = useState(false);

  useEffect(() => {
    // ✅ Wait for data, don't re-trigger after already opened
    if (!landlordId || !landlords || landlords.length === 0 || autoOpened)
      return;

    console.log("🔍 Looking for landlordId:", landlordId);
    console.log(
      "🔍 Available landlords:",
      (landlords as Landlord[]).map((l) => ({
        $id: l.$id,
        accountId: l.accountId,
        name: l.name,
      })),
    );

    const found = (landlords as Landlord[]).find(
      (l) => l.accountId === landlordId || l.$id === landlordId,
    );

    console.log("🔍 Found landlord:", found?.name ?? "NOT FOUND");

    if (found) {
      setSelectedLandlord(found);
      setShowLandlordDetails(true);
      setAutoOpened(true);
    }
  }, [landlordId, landlords, autoOpened]);

  const renderLandlordCard = ({ item }: { item: Landlord }) => {
    const accredited = isaccredited(item);

    return (
      <TouchableOpacity
        onPress={() => handleLandlordPress(item)}
        activeOpacity={0.7}
        className="rounded-2xl overflow-hidden mb-4"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.muted + "30",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 3,
          elevation: 2,
        }}
      >
        <View className="p-4 flex-row items-center">
          {/* Avatar */}
          <View className="mr-4">
            <LandlordAvatar
              uri={item.avatar}
              size={64}
              name={item.name}
              id={item.$id}
            />
            {accredited && (
              <View className="absolute -bottom-1 -right-1 bg-blue-700500 rounded-full w-5 h-5 items-center justify-center border-2 border-white">
                <Ionicons name="checkmark" size={12} color="white" />
              </View>
            )}
          </View>

          {/* Info */}
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                {item.name}
              </Text>
              {(item.rating || 0) > 0 && (
                <View className="flex-row items-center bg-yellow-100 px-2 py-0.5 rounded-full">
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text
                    className="text-xs font-rubik-bold ml-1"
                    style={{ color: "#92400E" }}
                  >
                    {item.rating}
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center mt-1">
              <Ionicons
                name="mail-outline"
                size={14}
                style={{ color: theme.muted }}
              />
              <Text className="text-xs ml-1" style={{ color: theme.muted }}>
                {item.email}
              </Text>
            </View>

            {item.phone && (
              <View className="flex-row items-center mt-0.5">
                <Ionicons
                  name="call-outline"
                  size={14}
                  style={{ color: theme.muted }}
                />
                <Text className="text-xs ml-1" style={{ color: theme.muted }}>
                  {item.phone}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View className="flex-row items-center mt-2 gap-4">
              <View className="flex-row items-center">
                <Ionicons
                  name="home-outline"
                  size={14}
                  style={{ color: theme.muted }}
                />
                <Text
                  className="text-xs ml-1 font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  {item.propertyCount || 0}{" "}
                  {(item.propertyCount || 0) === 1 ? "property" : "properties"}
                </Text>
              </View>
              {(item.totalViews || 0) > 0 && (
                <View className="flex-row items-center">
                  <Ionicons
                    name="eye-outline"
                    size={14}
                    style={{ color: theme.muted }}
                  />
                  <Text
                    className="text-xs ml-1 font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {item.totalViews} views
                  </Text>
                </View>
              )}
              {(item.totalLikes || 0) > 0 && (
                <View className="flex-row items-center">
                  <Ionicons
                    name="heart-outline"
                    size={14}
                    style={{ color: theme.muted }}
                  />
                  <Text
                    className="text-xs ml-1 font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {item.totalLikes} likes
                  </Text>
                </View>
              )}
            </View>

            {/* ✅ Contact Button */}
            <TouchableOpacity
              onPress={() => handleContactLandlord(item)}
              className="mt-3 py-1.5 px-4 rounded-full flex-row items-center self-start"
              style={{
                backgroundColor: theme.primary[100],
                borderWidth: 1,
                borderColor: theme.primary[300],
              }}
            >
              <Ionicons
                name="chatbubble-outline"
                size={14}
                color={theme.primary[300]}
              />
              <Text
                className="ml-1.5 text-xs font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                Contact
              </Text>
            </TouchableOpacity>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            style={{ color: theme.muted }}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderLandlordDetails = () => {
    if (!selectedLandlord) return null;

    return (
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        {/* Header */}
        <View
          className="flex-row items-center px-5 py-4 border-b"
          style={{
            borderBottomColor: theme.muted + "30",
            backgroundColor: theme.navBackground,
          }}
        >
          <TouchableOpacity
            onPress={() => {
              setShowLandlordDetails(false);
              setSelectedLandlord(null);
            }}
            className="mr-4 p-2"
          >
            <Ionicons
              name="arrow-back"
              size={24}
              style={{ color: theme.text }}
            />
          </TouchableOpacity>
          <Text
            className="text-xl font-rubik-bold flex-1"
            style={{ color: theme.title }}
          >
            Landlord Details
          </Text>
        </View>

        <FlatList
          data={selectedLandlord.properties || []}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View className="mb-6">
              {/* Landlord Info Card */}
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <View className="flex-row items-center">
                  <View>
                    <LandlordAvatar
                      uri={selectedLandlord.avatar}
                      size={80}
                      name={selectedLandlord.name}
                      id={selectedLandlord.$id}
                    />
                    {isaccredited(selectedLandlord) && (
                      <View className="absolute -bottom-1 -right-1 bg-blue-700500 rounded-full w-6 h-6 items-center justify-center border-2 border-white">
                        <Ionicons name="checkmark" size={14} color="white" />
                      </View>
                    )}
                  </View>
                  <View className="ml-4 flex-1">
                    <Text
                      className="text-xl font-rubik-bold"
                      style={{ color: theme.title }}
                    >
                      {selectedLandlord.name}
                    </Text>
                    <View className="flex-row items-center mt-1">
                      <Ionicons
                        name="mail-outline"
                        size={16}
                        style={{ color: theme.muted }}
                      />
                      <Text
                        className="text-sm ml-2"
                        style={{ color: theme.muted }}
                      >
                        {selectedLandlord.email}
                      </Text>
                    </View>
                    {selectedLandlord.phone && (
                      <View className="flex-row items-center mt-1">
                        <Ionicons
                          name="call-outline"
                          size={16}
                          style={{ color: theme.muted }}
                        />
                        <Text
                          className="text-sm ml-2"
                          style={{ color: theme.muted }}
                        >
                          {selectedLandlord.phone}
                        </Text>
                      </View>
                    )}

                    {/* ✅ Contact Button in Details */}
                    <TouchableOpacity
                      onPress={() => handleContactLandlord(selectedLandlord)}
                      className="mt-3 py-2 px-5 rounded-full flex-row items-center self-start"
                      style={{
                        backgroundColor: theme.primary[100],
                        borderWidth: 1,
                        borderColor: theme.primary[300],
                      }}
                    >
                      <Ionicons
                        name="chatbubble-outline"
                        size={16}
                        color={theme.primary[300]}
                      />
                      <Text
                        className="ml-2 text-sm font-rubik-bold"
                        style={{ color: theme.primary[300] }}
                      >
                        Contact Landlord
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Stats Row */}
                <View
                  className="flex-row justify-around mt-4 pt-4 border-t"
                  style={{ borderTopColor: theme.muted + "20" }}
                >
                  <View className="items-center">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {selectedLandlord.propertyCount || 0}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Properties
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {selectedLandlord.totalViews || 0}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Total Views
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {selectedLandlord.totalLikes || 0}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Total Likes
                    </Text>
                  </View>
                  <View className="items-center">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {selectedLandlord.reviewCount || 0}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Reviews
                    </Text>
                  </View>
                </View>

                {selectedLandlord.joinedDate && (
                  <Text
                    className="text-xs mt-3 text-center"
                    style={{ color: theme.muted }}
                  >
                    Joined{" "}
                    {new Date(selectedLandlord.joinedDate).toLocaleDateString()}
                  </Text>
                )}
              </View>

              {/* Properties Section */}
              <Text
                className="text-lg font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                {selectedLandlord.propertyCount || 0} Properties
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <PropertyCard
              item={item}
              onPress={() => handlePropertyPress(item.$id)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Text className="text-sm" style={{ color: theme.muted }}>
                No properties listed yet
              </Text>
            </View>
          }
        />
      </View>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {!showLandlordDetails ? (
        <>
          {/* Header */}
          <View className="px-5 pt-4 pb-2">
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Landlords
            </Text>
            <Text className="text-sm" style={{ color: theme.muted }}>
              {visibleLandlords.length} of {landlords?.length || 0} landlords
            </Text>
          </View>

          {/* Search Bar */}
          <View className="px-5 mb-3">
            <View
              className="flex-row items-center px-4 rounded-full"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "40",
              }}
            >
              <Image
                source={icons.search}
                className="w-5 h-5"
                style={{ tintColor: theme.muted }}
              />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search by name, email or phone..."
                placeholderTextColor={theme.muted}
                className="flex-1 ml-2 text-base font-rubik py-3"
                style={{ color: theme.title }}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  className="p-1"
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    style={{ color: theme.muted }}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Filter chips */}
          <View className="mb-3">
            <FlatList
              data={FILTERS}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(f) => f.key}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}
              renderItem={({ item: f }) => {
                const active = activeFilter === f.key;
                return (
                  <TouchableOpacity
                    onPress={() => setActiveFilter(f.key)}
                    className="px-4 py-2 rounded-full"
                    style={{
                      backgroundColor: active
                        ? theme.primary[300]
                        : theme.surface,
                      borderWidth: 1,
                      borderColor: active
                        ? theme.primary[300]
                        : theme.muted + "40",
                    }}
                  >
                    <Text
                      className="text-sm font-rubik-medium"
                      style={{ color: active ? "#fff" : theme.text }}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          {/* Landlords List */}
          <FlatList
            data={visibleLandlords}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingBottom: 100,
            }}
            showsVerticalScrollIndicator={false}
            renderItem={renderLandlordCard}
            ListEmptyComponent={
              loading ? (
                <View className="items-center justify-center py-20">
                  <ActivityIndicator size="large" color={theme.primary[300]} />
                  <Text
                    className="mt-4 text-center"
                    style={{ color: theme.muted }}
                  >
                    Loading landlords...
                  </Text>
                </View>
              ) : (
                <NoResults />
              )
            }
          />
        </>
      ) : (
        renderLandlordDetails()
      )}

      {/* ✅ Contact Modal */}
      <ContactModal
        visible={contactModalVisible}
        onClose={() => {
          setContactModalVisible(false);
          setLandlordContact(null);
        }}
        name={landlordContact?.name || ""}
        email={landlordContact?.email || ""}
        phone={landlordContact?.phone}
        avatar={landlordContact?.avatar}
      />
    </SafeAreaView>
  );
};

export default Landlords;
