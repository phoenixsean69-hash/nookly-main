// app/(root)/profile.tsx (Tenant Profile - Using Local Storage)
import AvatarSuccessModal from "@/components/AvatarSuccessModal";
import icons from "@/constants/icons";
import {
  config,
  databases,
  getUserLikesGiven,
  getUserReviewsGiven,
  uploadImage,
} from "@/lib/appwrite";
import { getFavorites } from "@/lib/localFavorites";
import { getTenantScore } from "@/lib/tenantProfile";
import useAuthStore from "@/store/auth.store";
import { clearSavedAvatar } from "@/utils/avatarStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Query } from "react-native-appwrite";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors } from "../../../constants/Colors";

// Keys for AsyncStorage
const SAVED_SEARCHES_KEY = "user_saved_searches";
const VIEWED_PROPERTIES_KEY = "user_viewed_properties";
const APPLICATIONS_KEY = "user_applications";

interface TenantStats {
  totalFavorites: number;
  totalLikes: number;
  totalReviews: number;
  totalApplications: number;
  viewedProperties: number;
}

interface TenantScoreData {
  overall: number;
  idVerified: boolean;
  landlordReviewCount: number;
  landlordReviewAverage: number;
  onTimePaymentRate: number;
  previousLandlordCount: number;
  screeningStatus: "pending" | "approved" | "rejected" | "none";
  scoreBreakdown: {
    idVerification: number;
    landlordReviews: number;
    paymentReliability: number;

  };
}

const Profile = () => {
  const { signOut, setUser } = useAuthStore();
  const { user, fetchAuthenticatedUser } = useAuthStore();
  const [showSuccess, setShowSuccess] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState<TenantStats>({
    totalFavorites: 0,
    totalLikes: 0,
    totalReviews: 0,
    totalApplications: 0,
    viewedProperties: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  
  // ✅ Tenant Score State
  const [tenantScore, setTenantScore] = useState<TenantScoreData | null>(null);
  const [loadingScore, setLoadingScore] = useState(true);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Fetch tenant stats from local AsyncStorage
  const fetchTenantStats = useCallback(async () => {
    try {
      setLoadingStats(true);

      // 1. Get favorites from localFavorites
      const favorites = await getFavorites();
      const totalFavorites = favorites.length;

      // 2. Get likes given from AsyncStorage (using the new function)
      const likesGiven = await getUserLikesGiven(user?.accountId || "");
      const totalLikes = likesGiven.length;

      // 4. Get viewed properties from local storage
      const viewedKey = `user_viewed_properties_${user?.accountId}`;
      const viewedJson = await AsyncStorage.getItem(viewedKey);
      const viewedProperties = viewedJson ? JSON.parse(viewedJson) : [];
      const viewedPropertiesCount = viewedProperties.length;

      const applicationsKey = `user_applications_${user?.accountId}`;
      const applicationsJson = await AsyncStorage.getItem(applicationsKey);
      const applications = applicationsJson ? JSON.parse(applicationsJson) : [];
      const totalApplications = applications.length;

      // 6. Get reviews written from local storage
      const reviewsGiven = await getUserReviewsGiven(user?.accountId || "");
      const totalReviews = reviewsGiven.length;

      setStats({
        totalFavorites,
        totalLikes,
        totalReviews,
        totalApplications,
        viewedProperties: viewedPropertiesCount,
      });
    } catch (error) {
      console.error("Error fetching tenant stats:", error);
      setStats({
        totalFavorites: 0,
        totalLikes: 0,
        totalReviews: 0,
        totalApplications: 0,
        viewedProperties: 0,
      });
    } finally {
      setLoadingStats(false);
    }
  }, [user?.accountId]);

  // ✅ Fetch Tenant Score
  const fetchTenantScore = useCallback(async () => {
    if (!user?.accountId || user?.userMode !== "tenant") {
      setLoadingScore(false);
      return;
    }

    try {
      setLoadingScore(true);
      const score = await getTenantScore(user.accountId);
      setTenantScore(score as TenantScoreData | null);
    } catch (error) {
      console.error("Error fetching tenant score:", error);
      setTenantScore(null);
    } finally {
      setLoadingScore(false);
    }
  }, [user?.accountId, user?.userMode]);

  useEffect(() => {
    if (user?.userMode === "tenant" && user?.accountId) {
      fetchTenantStats();
      fetchTenantScore();
    } else {
      setLoadingStats(false);
      setLoadingScore(false);
    }
  }, [user, fetchTenantStats, fetchTenantScore]);

  // Handle image picker for real avatar from gallery
  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission required",
          "Please allow photo access to upload avatar.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        const uri = result.assets[0]?.uri;
        if (uri) {
          setUploadingAvatar(true);

          const uploadedImageUrl = await uploadImage({
            uri,
            fileName: `avatar_${user?.accountId}_${Date.now()}.jpg`,
            mimeType: "image/jpeg",
          });

          if (uploadedImageUrl) {
            // Find the user document ID
            const userDocs = await databases.listDocuments(
              config.databaseId!,
              config.usersCollectionId!,
              [Query.equal("accountId", user?.accountId!)],
            );

            if (userDocs.documents.length > 0) {
              const userDocId = userDocs.documents[0].$id;
              await databases.updateDocument(
                config.databaseId!,
                config.usersCollectionId!,
                userDocId,
                { avatar: uploadedImageUrl },
              );
              await fetchAuthenticatedUser();
              setShowSuccess(true);
            } else {
              Alert.alert("Error", "User document not found");
            }
          }
        }
      }
    } catch (error) {
      console.error("ImagePicker error:", error);
      Alert.alert("Error", "Could not upload image.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setLogoutLoading(true);
          try {
            // Clear local avatar storage
            await clearSavedAvatar();

            // Clear local storage data
            await AsyncStorage.multiRemove([
              "user_applications",
              "user_viewed_properties",
              "user_likes_given",
              "user_reviews",
            ]);

            // Use the auth store's signOut method
            const result = await signOut();

            if (result.success) {
              router.replace("/sign-in");
            } else {
              Alert.alert("Error", result.error || "Failed to logout");
            }
          } catch (error) {
            console.error("Logout error:", error);
            Alert.alert("Error", "Failed to logout. Please try again.");
          } finally {
            setLogoutLoading(false);
          }
        },
      },
    ]);
  };

  // Profile options for tenant
  const profileOptions = [
    {
      icon: icons.heart,
      label: "My Favorites",
      route: "/my-favorites",
      color: "#EF4444",
    },
    {
      icon: icons.chat,
      label: "Nookly Assistant",
      route: "/message",
      color: "#10B981",
    },
    {
      icon: icons.calendar,
      label: "Calendar",
      route: "/calendar",
      color: "#F59E0B",
    },
    {
      icon: icons.settings,
      label: "Settings",
      route: "/settings",
      color: "#6B7280",
    },
    {
      icon: icons.info,
      label: "Help Center",
      route: "/help",
      color: "#6B7280",
    },
  ];

  // Helper function to get score status
  const getScoreStatus = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "#10B981" };
    if (score >= 75) return { label: "Good", color: "#3B82F6" };
    if (score >= 60) return { label: "Average", color: "#F59E0B" };
    return { label: "Needs Work", color: "#EF4444" };
  };

  // Helper function to get score color
  const getScoreColor = (score: number) => {
    if (score >= 90) return "#10B981";
    if (score >= 75) return "#3B82F6";
    if (score >= 60) return "#F59E0B";
    return "#EF4444";
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex flex-row items-center justify-between mt-5 mb-6">
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            My Profile
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/notifications")}
            className="p-2 rounded-full"
            style={{ backgroundColor: theme.surface }}
          >
            <Image
              source={icons.bell}
              className="w-5 h-5"
              style={{ tintColor: theme.text }}
            />
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View className="flex items-center mb-8">
          <View className="relative">
            {uploadingAvatar ? (
              <View
                className="w-32 h-32 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.surface }}
              >
                <ActivityIndicator size="large" color={theme.primary[300]} />
              </View>
            ) : (
              <Image
                source={user?.avatar ? { uri: user.avatar } : icons.person}
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
                style={{ borderColor: theme.surface }}
              />
            )}

            {/* Edit Avatar Button */}
            <TouchableOpacity
              className="absolute bottom-0 right-0 p-2 rounded-full border-2"
              style={{
                backgroundColor: theme.primary[300],
                borderColor: theme.background,
              }}
              onPress={pickImage}
              disabled={uploadingAvatar}
            >
              <Image
                source={icons.edit}
                className="w-4 h-4"
                style={{ tintColor: "#FFFFFF" }}
              />
            </TouchableOpacity>
          </View>

          <Text
            className="text-xl font-rubik-bold mt-4"
            style={{ color: theme.title }}
          >
            {user?.name || "User"}
          </Text>
          <Text
            className="text-sm font-rubik mt-1"
            style={{ color: theme.muted }}
          >
            {user?.email || "user@example.com"}
          </Text>
          <View className="mt-2 px-3 py-1 rounded-full self-center">
            <View
              className="px-3 py-1 rounded-full flex-row items-center gap-1.5"
              style={{ backgroundColor: theme.primary[100] }}
            >
              <Image
                source={icons.tenant}
                className="w-4 h-4"
                style={{ tintColor: theme.primary[300] }}
              />
              <Text
                className="text-xs font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                Tenant
              </Text>
            </View>
          </View>
        </View>

        {/* ✅ Tenant Score Section - INTEGERS ONLY */}
        {user?.userMode === "tenant" && (
          <View
            className="rounded-2xl p-4 mb-6"
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.primary[300] + "40",
            }}
          >
            <View className="flex-row items-center justify-between mb-2">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                🛡️ Tenant Score
              </Text>
              {!loadingScore && tenantScore && (
                <View
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: getScoreColor(Math.round(tenantScore.overall))
                  }}
                >
                  <Text className="text-white text-[10px] font-rubik-bold">
                    {getScoreStatus(Math.round(tenantScore.overall)).label}
                  </Text>
                </View>
              )}
            </View>

            {loadingScore ? (
              <View className="py-4 items-center">
                <ActivityIndicator size="small" color={theme.primary[300]} />
                <Text className="text-xs mt-2" style={{ color: theme.muted }}>
                  Loading your score...
                </Text>
              </View>
            ) : tenantScore ? (
              <>
                {/* ✅ Rounded Score Display */}
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-4xl font-rubik-bold" style={{ color: getScoreColor(Math.round(tenantScore.overall)) }}>
                      {Math.round(tenantScore.overall)}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.muted }}>
                      out of 100
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      {tenantScore.idVerified ? "✅ ID Verified" : "Not Yet accredited"}
                    </Text>
          
                  </View>
                </View>

                {/* Score Breakdown - Rounded to Integers */}
                <View className="mt-3 pt-3 border-t" style={{ borderTopColor: theme.muted + "20" }}>
                  <Text className="text-xs font-rubik-medium mb-2" style={{ color: theme.muted }}>
                    Score Breakdown
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    <View className="flex-1 min-w-[45%]">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px]" style={{ color: theme.muted }}>
                          ID Verification
                        </Text>
                        <Text className="text-[10px] font-rubik-bold" style={{ color: theme.primary[300] }}>
                          {Math.round(tenantScore.scoreBreakdown.idVerification)}%
                        </Text>
                      </View>
                      <View className="h-1 rounded-full mt-0.5 bg-gray-200 dark:bg-gray-700">
                        <View 
                          className="h-1 rounded-full" 
                          style={{ 
                            width: `${Math.round(tenantScore.scoreBreakdown.idVerification)}%`,
                            backgroundColor: theme.primary[300]
                          }} 
                        />
                      </View>
                    </View>
                    <View className="flex-1 min-w-[45%]">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px]" style={{ color: theme.muted }}>
                          Landlord Reviews
                        </Text>
                        <Text className="text-[10px] font-rubik-bold" style={{ color: theme.primary[300] }}>
                          {Math.round(tenantScore.scoreBreakdown.landlordReviews)}%
                        </Text>
                      </View>
                      <View className="h-1 rounded-full mt-0.5 bg-gray-200 dark:bg-gray-700">
                        <View 
                          className="h-1 rounded-full" 
                          style={{ 
                            width: `${Math.round(tenantScore.scoreBreakdown.landlordReviews)}%`,
                            backgroundColor: theme.primary[300]
                          }} 
                        />
                      </View>
                    </View>
                    <View className="flex-1 min-w-[45%]">
                      <View className="flex-row items-center justify-between">
                        <Text className="text-[10px]" style={{ color: theme.muted }}>
                          Payment Reliability
                        </Text>
                        <Text className="text-[10px] font-rubik-bold" style={{ color: theme.primary[300] }}>
                          {Math.round(tenantScore.scoreBreakdown.paymentReliability)}%
                        </Text>
                      </View>
                      <View className="h-1 rounded-full mt-0.5 bg-gray-200 dark:bg-gray-700">
                        <View 
                          className="h-1 rounded-full" 
                          style={{ 
                            width: `${Math.round(tenantScore.scoreBreakdown.paymentReliability)}%`,
                            backgroundColor: theme.primary[300]
                          }} 
                        />
                      </View>
                    </View>
                  </View>
                </View>

                {tenantScore.screeningStatus === "approved" && (
                  <View className="mt-3 bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded-lg">
                    <Text className="text-green-700 dark:text-green-400 text-xs font-rubik-medium">
                      ✅ Screening Approved
                    </Text>
                    <Text className="text-green-600 dark:text-green-300 text-[10px] mt-0.5">
                      Your profile has been verified and screened
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View className="py-4 items-center">
                <Text className="text-sm" style={{ color: theme.muted }}>
                  No tenant score available yet
                </Text>
                <Text className="text-xs mt-1" style={{ color: theme.muted + "80" }}>
                  Start renting to build your reputation
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Stats Section for Tenant */}
        <View
          className="rounded-2xl p-5 mb-6"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.muted + "30",
          }}
        >
          <Text
            className="text-lg font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            My Activity
          </Text>

          {loadingStats ? (
            <View className="flex-row justify-center py-4">
              <ActivityIndicator size="small" color={theme.primary[300]} />
            </View>
          ) : (
            <>
              <View className="flex-row justify-between mb-4">
                <View className="items-center flex-1">
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {stats.totalFavorites}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    Favorites
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {stats.totalLikes}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    Likes Given
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <Text
                    className="text-2xl font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {stats.totalReviews}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    Reviews
                  </Text>
                </View>
              </View>

              <View
                className="flex-row justify-between pt-3 border-t"
                style={{ borderTopColor: theme.muted + "20" }}
              >
                <View className="items-center flex-1">
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {stats.totalApplications}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    Applications
                  </Text>
                </View>
                <View className="items-center flex-1">
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    {stats.viewedProperties}
                  </Text>
                  <Text className="text-xs" style={{ color: theme.muted }}>
                    Properties Viewed
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Profile Options */}
        <View
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.muted + "30",
          }}
        >
          {profileOptions.map((option, index) => (
            <TouchableOpacity
              key={index}
              className="flex-row items-center py-4 px-5"
              style={{
                borderBottomWidth: index < profileOptions.length - 1 ? 1 : 0,
                borderBottomColor: theme.muted + "20",
              }}
              onPress={() => router.push(option.route as any)}
            >
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: option.color + "20" }}
              >
                <Image
                  source={option.icon}
                  className="w-5 h-5"
                  style={{ tintColor: option.color }}
                />
              </View>
              <Text
                className="flex-1 text-base font-rubik-medium"
                style={{ color: theme.text }}
              >
                {option.label}
              </Text>
              <Image
                source={icons.rightArrow}
                className="w-4 h-4"
                style={{ tintColor: theme.muted }}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          disabled={logoutLoading}
          className="flex-row items-center justify-center mb-10 py-4 rounded-2xl"
          style={{
            backgroundColor: theme.danger + "20",
            borderWidth: 1,
            borderColor: theme.danger + "50",
          }}
        >
          {logoutLoading ? (
            <ActivityIndicator size="small" color={theme.danger} />
          ) : (
            <>
              <Image
                source={icons.logout}
                className="w-5 h-5 mr-2"
                style={{ tintColor: theme.danger }}
              />
              <Text
                className="text-base font-rubik-medium"
                style={{ color: theme.danger }}
              >
                Logout
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* App Version */}
        <Text
          className="text-center text-xs"
          style={{ color: theme.muted + "80" }}
        >
          Version 1.0.0
        </Text>
      </ScrollView>

      {/* Avatar Success Modal */}
      <AvatarSuccessModal
        visible={showSuccess}
        onClose={() => setShowSuccess(false)}
        message="Avatar updated successfully!"
      />
    </SafeAreaView>
  );
};

export default Profile;