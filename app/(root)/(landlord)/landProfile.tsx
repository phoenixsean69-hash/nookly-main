// screens/Profile.tsx
import {
  clearSavedAvatar,
  getSavedAvatar,
  saveSelectedAvatar,
} from "@/utils/avatarStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
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

import AvatarModal from "@/components/AvatarModal";
import AvatarSuccessModal from "@/components/AvatarSuccessModal";
import { Colors } from "@/constants/Colors";
import { getAvatarSource } from "@/constants/data";
import icons from "@/constants/icons";
import { config, databases, logout, uploadImage } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";

interface ProfileStats {
  totalProperties: number;
  totalLikes: number;
  totalViews: number;
  totalReviews: number;
  averageRating: number;
  occupancyRate?: number;
}

const LandLordProfile = () => {
  const { user, fetchAuthenticatedUser } = useAuthStore();
  const [modalVisible, setModalVisible] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stats, setStats] = useState<ProfileStats>({
    totalProperties: 0,
    totalLikes: 0,
    totalViews: 0,
    totalReviews: 0,
    averageRating: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Load avatar on mount
  useEffect(() => {
    const loadAvatar = async () => {
      const saved = await getSavedAvatar();
      setAvatarId(saved || "human-1");
      setLoadingAvatar(false);
    };
    loadAvatar();
  }, []);

  const fetchLandlordStats = React.useCallback(async () => {
    try {
      setLoadingStats(true);

      const propertiesResult = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [Query.equal("creatorId", user?.accountId || ""), Query.limit(100)],
      );

      const properties = propertiesResult.documents;

      let totalLikes = 0;
      let totalViews = 0;
      let totalReviews = 0;
      let totalRating = 0;
      let propertiesWithReviews = 0;
      let availableProperties = 0;

      properties.forEach((property) => {
        totalLikes += property.likes || 0;
        totalViews += property.views || 0;

        if (property.reviews) {
          try {
            const parsedReviews = JSON.parse(property.reviews);
            if (Array.isArray(parsedReviews) && parsedReviews.length > 0) {
              totalReviews += parsedReviews.length;
              const sum = parsedReviews.reduce(
                (acc: number, r: any) => acc + (r.rating || 0),
                0,
              );
              totalRating += sum;
              propertiesWithReviews++;
            }
          } catch (e) {}
        }
      });

      availableProperties = properties.filter(
        (p) => p.isAvailable !== false,
      ).length;

      const averageRating =
        propertiesWithReviews > 0 ? totalRating / propertiesWithReviews : 0;

      const occupancyRate =
        properties.length > 0
          ? ((properties.length - availableProperties) / properties.length) *
            100
          : 0;

      setStats({
        totalProperties: properties.length,
        totalLikes,
        totalViews,
        totalReviews,
        occupancyRate,
        averageRating: Number(averageRating.toFixed(1)),
      });
    } catch (error) {
      console.error("Error fetching landlord stats:", error);
    } finally {
      setLoadingStats(false);
    }
  }, [user?.accountId]);

  // Fetch stats for landlord
  useEffect(() => {
    if (user?.userMode === "landlord" && user?.accountId) {
      fetchLandlordStats();
    } else {
      setLoadingStats(false);
    }
  }, [user, fetchLandlordStats]);

  // Handle avatar selection from modal
  const handleSelectAvatar = async (newAvatarId: string) => {
    setAvatarId(newAvatarId);
    await saveSelectedAvatar(newAvatarId);
    setModalVisible(false);
    setShowSuccess(true);

    // Refresh user data to get updated avatar
    await fetchAuthenticatedUser();
  };

  // Handle image picker for custom avatar
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

            // Use the logout function from appwrite
            const result = await logout();

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

  const profileOptions = [
    {
      icon: icons.house,
      label: "My Properties",
      route: "/myDashboard",
      color: "#3B82F6",
    },
    {
      icon: icons.chat,
      label: "Nookly Assistant",
      route: "/landChat",
      color: "#10B981",
    },
    {
      icon: icons.calendar,
      label: "Calendar",
      route: "/landCalendar",
      color: "#F59E0B",
    },
    {
      icon: icons.settings,
      label: "Settings",
      route: "/landSettings",
      color: "#8B5CF6",
    },
    {
      icon: icons.info,
      label: "Help Center",
      route: "/landHelp",
      color: "#6B7280",
    },
  ];

  // Get avatar source
  const getAvatarSourceImage = () => {
    // First priority: user's custom avatar from database
    if (user?.avatar) {
      return { uri: user.avatar };
    }
    // Second priority: selected default avatar from local storage
    return getAvatarSource(avatarId);
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
            Profile
          </Text>
          <TouchableOpacity
            onPress={() => router.push("//landLordNotifications")}
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
            {loadingAvatar || uploadingAvatar ? (
              <View
                className="w-32 h-32 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.surface }}
              >
                <ActivityIndicator size="large" color={theme.primary[300]} />
              </View>
            ) : (
              <Image
                source={getAvatarSourceImage()}
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
          <View
            className="mt-2 px-3 py-1 rounded-full"
            style={{ backgroundColor: theme.primary[100] }}
          >
            <View
              className="mt-2 px-3 py-1 rounded-full flex-row items-center gap-1.5"
              style={{ backgroundColor: theme.primary[100] }}
            >
              <Image
                source={
                  user?.userMode === "landlord" ? icons.landlord : icons.tenant
                }
                className="w-4 h-4"
                style={{ tintColor: theme.primary[300] }}
              />
              <Text
                className="text-xs text-center font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                {user?.userMode === "landlord" ? "Landlord" : "Tenant"}
              </Text>
            </View>
          </View>
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

        {/* Stats Section - Only for landlords */}
        {user?.userMode === "landlord" && (
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
              Quick Stats
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
                      {stats.totalProperties}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: theme.muted }}
                    >
                      Properties
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {stats.totalViews.toLocaleString()}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: theme.muted }}
                    >
                      Total Views
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text
                      className="text-2xl font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {stats.totalLikes}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: theme.muted }}
                    >
                      Total Likes
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
                      {stats.totalReviews}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Reviews
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text
                      className="text-lg font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {stats.averageRating}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Avg Rating
                    </Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text
                      className="text-lg font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      {Math.round(stats.occupancyRate || 0)}%
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      Occupancy
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          disabled={logoutLoading}
          className="flex-row items-center justify-center py-4 rounded-2xl mb-10"
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

      {/* Avatar Modal */}
      <AvatarModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSelect={handleSelectAvatar}
        currentAvatarId={avatarId || "human-1"}
      />

      {/* Avatar Success Modal */}
      <AvatarSuccessModal
        visible={showSuccess}
        onClose={() => setShowSuccess(false)}
        message="Avatar updated!"
      />
    </SafeAreaView>
  );
};

export default LandLordProfile;
