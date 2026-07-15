// app/(root)/trending-properties.tsx
import { Card, PropertyDocument } from "@/components/Cards";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");
const CARD_WIDTH = width - 32; // Full width minus padding (16 on each side)

interface Property extends PropertyDocument {
  $id: string;
  propertyName?: string;
  type?: string;
  address: string;
  price: number;
  likes?: number;
  views?: number;
  reviews?: string;
  $createdAt: string;
  image1?: string;
  image2?: string;
  image3?: string;
  rating?: number;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  reviewCount?: number;
  totalScore?: number;
  averageRating?: number;
}

const getReviewCount = (reviews: string | undefined): number => {
  if (!reviews) return 0;
  try {
    const parsedReviews = JSON.parse(reviews);
    return Array.isArray(parsedReviews) ? parsedReviews.length : 0;
  } catch (error) {
    return 0;
  }
};

const getAverageRating = (reviews: string | undefined): number => {
  if (!reviews) return 0;
  try {
    const parsedReviews = JSON.parse(reviews);
    if (!Array.isArray(parsedReviews) || parsedReviews.length === 0) return 0;
    const sum = parsedReviews.reduce(
      (acc: number, r: any) => acc + (r.rating || 0),
      0,
    );
    return Number((sum / parsedReviews.length).toFixed(1));
  } catch (error) {
    return 0;
  }
};

// Calculate rating for the Card component
const calculateRating = (reviews: string | undefined): number => {
  if (!reviews) return 0;
  try {
    const parsedReviews = JSON.parse(reviews);
    if (!Array.isArray(parsedReviews) || parsedReviews.length === 0) return 0;
    const sum = parsedReviews.reduce(
      (acc: number, r: any) => acc + (r.rating || 0),
      0,
    );
    return Number((sum / parsedReviews.length).toFixed(1));
  } catch (error) {
    return 0;
  }
};

const calculateTotalScore = (property: Property): number => {
  const likes = property.likes || 0;
  const reviewCount = getReviewCount(property.reviews);
  const averageRating = getAverageRating(property.reviews);
  const likesScore = likes * 10;
  const reviewsScore = reviewCount * 5 + averageRating * 20;
  return likesScore + reviewsScore;
};

const TrendingProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    fetchTrendingProperties();
  }, []);

  const fetchTrendingProperties = async () => {
    try {
      setLoading(true);
      const response = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [],
      );

      const allProperties = response.documents as unknown as Property[];

      const propertiesWithScores = allProperties.map((property) => ({
        ...property,
        reviewCount: getReviewCount(property.reviews),
        averageRating: getAverageRating(property.reviews),
        rating: calculateRating(property.reviews), // Add this line to calculate rating for the Card
        totalScore: calculateTotalScore(property),
      }));

      const trending = propertiesWithScores
        .filter(
          (property) =>
            (property.likes || 0) > 0 || (property.reviewCount || 0) > 0,
        )
        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
        .slice(0, 3);

      setProperties(trending);
    } catch (error) {
      console.error("Error fetching trending properties:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchTrendingProperties();
  };

  const handleCardPress = (id: string) => {
    router.push(`/properties/${id}`);
  };

  const handleBackPress = () => {
    router.push("/tenantHome");
  };

  const getRankEmoji = (index: number) => {
    switch (index) {
      case 0:
        return "🥇";
      case 1:
        return "🥈";
      case 2:
        return "🥉";
      default:
        return `#${index + 1}`;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "#FFD700";
      case 1:
        return "#C0C0C0";
      case 2:
        return "#CD7F32";
      default:
        return "#FF6B6B";
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        className="flex-row items-center px-5 py-4"
        style={{ borderBottomWidth: 1, borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity onPress={handleBackPress} className="mr-4 p-2">
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <View className="flex-1">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Top Properties 🔥
          </Text>
          <Text className="text-sm mt-1" style={{ color: theme.muted }}>
            Based on likes and reviews
          </Text>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-4" style={{ color: theme.muted }}>
            Calculating top properties...
          </Text>
        </View>
      ) : properties.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Image
            source={icons.like}
            className="w-20 h-20 opacity-30 mb-4"
            style={{ tintColor: theme.muted }}
          />
          <Text
            className="text-lg font-rubik-medium text-center"
            style={{ color: theme.text }}
          >
            No interactions yet
          </Text>
          <Text
            className="text-sm text-center mt-2"
            style={{ color: theme.muted }}
          >
            Properties with likes and reviews will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(item) => item.$id}
          numColumns={1}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary[300]]}
              tintColor={theme.primary[300]}
            />
          }
          ListHeaderComponent={() => (
            <View className="mb-4 px-2">
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className="text-sm font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  Top {properties.length} properties
                </Text>
                <View className="flex-row items-center gap-3">
                  <View className="flex-row items-center">
                    <Image
                      source={icons.like}
                      className="w-3 h-3 mr-1"
                      style={{ tintColor: theme.primary[300] }}
                    />
                    <Text
                      className="text-xs font-rubik-medium"
                      style={{ color: theme.primary[300] }}
                    >
                      Likes
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Image
                      source={icons.star}
                      className="w-3 h-3 mr-1"
                      style={{ tintColor: theme.primary[300] }}
                    />
                    <Text
                      className="text-xs font-rubik-medium"
                      style={{ color: theme.primary[300] }}
                    >
                      Reviews
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          renderItem={({ item, index }) => (
            <View style={{ width: CARD_WIDTH, marginBottom: 16 }}>
              {/* Card first */}
              <Card item={item} onPress={() => handleCardPress(item.$id)} />

              {/* All badges on top of card with absolute positioning */}
              <View className="absolute inset-0">
                {/* Rank Badge - Top Left */}
                <View
                  className="absolute -top-2 -left-2 rounded-full w-10 h-10 items-center justify-center shadow-lg"
                  style={{ backgroundColor: getRankColor(index) }}
                >
                  <Text className="text-white font-rubik-bold text-base">
                    {getRankEmoji(index)}
                  </Text>
                </View>

                {/* Review Count Badge - Bottom Left */}
                {(item.reviewCount || 0) > 0 && (
                  <View className="absolute bottom-2 left-20 bg-black/60 rounded-full px-2 py-1 flex-row items-center">
                    <Image
                      source={icons.chat}
                      className="w-3 h-3 mr-1"
                      style={{ tintColor: "#ffffff" }}
                    />
                    <Text className="text-white text-xs font-rubik-medium">
                      {item.reviewCount}{" "}
                      {item.reviewCount === 1 ? "review" : "reviews"}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default TrendingProperties;
