// app/landlord/myDashboard.tsx
import ErrorModal from "@/components/ErrorModal";
import MyPropertiesModal from "@/components/myPropertiesModal";
import OperationSuccesfull from "@/components/OperationSuccesfull";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases, getRecentActivities } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { Query } from "react-native-appwrite";
import { SafeAreaView } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface PropertySummary {
  $id: string;
  propertyName: string;
  type: string;
  address: string;
  price: number;
  isAvailable?: boolean;
  description?: string;
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  image1?: string;
  image2?: string;
  image3?: string;
  rating?: number;
  likes?: number;
  views?: number;
  createdAt: string;
}

interface DashboardStats {
  totalProperties: number;
  totalLikes: number;
  averageRating: number;
  totalViews: number;
}
const TAB_BAR_HEIGHT = 70;

export default function LandlordDashboard() {
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalProperties: 0,
    totalLikes: 0,
    averageRating: 0,
    totalViews: 0,
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  // Modal States
  const [propertiesModalVisible, setPropertiesModalVisible] = useState(false);

  // Edit Modal State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProperty, setEditingProperty] =
    useState<PropertySummary | null>(null);
  const [editForm, setEditForm] = useState({
    propertyName: "",
    description: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    area: "",
    type: "",
    isAvailable: true,
    address: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Calculate additional metrics
  const availableProperties = properties.filter(
    (p) => p.isAvailable === true,
  ).length;
  const occupancyRate =
    properties.length > 0
      ? ((properties.length - availableProperties) / properties.length) * 100
      : 0;

  // Get top performing property
  const topProperty =
    properties.length > 0
      ? [...properties].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0]
      : null;

  // Quick actions data
  const quickActions = [
    {
      icon: icons.plus,
      label: "Add Property",
      onPress: () => router.push("/addProperty"),
      color: "#10B981",
    },
    {
      icon: icons.calendar,
      label: "Calendar",
      onPress: () => router.push("/landCalendar"),
      color: "#F59E0B",
    },
  ];

  // ============================================================================
  // FETCH DASHBOARD DATA
  // ============================================================================
  const fetchDashboardData = async () => {
    if (!user?.accountId) return;

    try {
      // Get all properties for this landlord
      const propertiesResult = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [
          Query.equal("creatorId", user.accountId),
          Query.orderDesc("$createdAt"),
          Query.limit(10),
        ],
      );

      const propertyList = propertiesResult.documents.map((doc) => {
        // Calculate rating from reviews JSON
        let rating = 0;
        if (doc.reviews) {
          try {
            const parsedReviews = JSON.parse(doc.reviews);
            if (parsedReviews.length > 0) {
              const sum = parsedReviews.reduce(
                (acc: number, r: any) => acc + (r.rating || 0),
                0,
              );
              rating = Number((sum / parsedReviews.length).toFixed(1));
            }
          } catch (e) {
            rating = 0;
          }
        }

        return {
          $id: doc.$id,
          propertyName: doc.propertyName || "Unnamed Property",
          type: doc.type || "Property",
          address: doc.address || "",
          price: doc.price || 0,
          description: doc.description || "",
          bedrooms: doc.bedrooms || 0,
          bathrooms: doc.bathrooms || 0,
          area: doc.area || 0,
          image1: doc.image1,
          image2: doc.image2,
          image3: doc.image3,
          rating,
          likes: doc.likes || 0,
          views: doc.views || 0,
          isAvailable: doc.isAvailable !== false,
          createdAt: doc.$createdAt,
        };
      });

      setProperties(propertyList);

      // Calculate stats
      const totalLikes = propertyList.reduce(
        (sum, p) => sum + (p.likes || 0),
        0,
      );
      const totalViews = propertyList.reduce(
        (sum, p) => sum + (p.views || 0),
        0,
      );
      const avgRating =
        propertyList.length > 0
          ? propertyList.reduce((sum, p) => sum + (p.rating || 0), 0) /
            propertyList.length
          : 0;

      setStats({
        totalProperties: propertyList.length,
        totalLikes,
        averageRating: Number(avgRating.toFixed(1)),
        totalViews,
      });

      // Get real activities from database
      const activities = await getRecentActivities(user.accountId, 10);
      setRecentActivity(activities);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handlePropertyPress = (propertyId: string) => {
    router.push(`/properties/${propertyId}`);
  };

  const handleAddProperty = () => {
    router.push("/addProperty");
  };

  // ============================================================================
  // EDIT MODAL FUNCTIONS
  // ============================================================================
  const openEditModal = (property: PropertySummary) => {
    setEditingProperty(property);
    setEditForm({
      propertyName: property.propertyName || "",
      description: property.description || "",
      price: property.price?.toString() || "",
      bedrooms: property.bedrooms?.toString() || "",
      bathrooms: property.bathrooms?.toString() || "",
      area: property.area?.toString() || "",
      type: property.type || "",
      address: property.address || "",
      isAvailable: property.isAvailable !== false,
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditingProperty(null);
    setEditForm({
      propertyName: "",
      description: "",
      price: "",
      bedrooms: "",
      bathrooms: "",
      area: "",
      type: "",
      address: "",
      isAvailable: true,
    });
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm({ ...editForm, [field]: value });
  };

  const toggleAvailability = () => {
    setEditForm({ ...editForm, isAvailable: !editForm.isAvailable });
  };

  const handleSaveEdit = async () => {
    if (!editingProperty) return;

    if (!editForm.propertyName.trim() || !editForm.price.trim()) {
      Alert.alert("Error", "Property name and price are required");
      return;
    }

    setSavingEdit(true);
    try {
      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        editingProperty.$id,
        {
          propertyName: editForm.propertyName,
          description: editForm.description,
          price: Number(editForm.price),
          bedrooms: Number(editForm.bedrooms) || 0,
          bathrooms: Number(editForm.bathrooms) || 0,
          area: Number(editForm.area) || 0,
          type: editForm.type,
          address: editForm.address,
          isAvailable: editForm.isAvailable,
        },
      );

      const updatedProperties = properties.map((p) =>
        p.$id === editingProperty.$id
          ? {
              ...p,
              propertyName: editForm.propertyName,
              description: editForm.description,
              price: Number(editForm.price),
              bedrooms: Number(editForm.bedrooms) || 0,
              bathrooms: Number(editForm.bathrooms) || 0,
              area: Number(editForm.area) || 0,
              type: editForm.type,
              address: editForm.address,
              isAvailable: editForm.isAvailable,
            }
          : p,
      );
      setProperties(updatedProperties);

      setShowSuccess(true);
      closeEditModal();
    } catch (error) {
      console.error("Error updating property:", error);
      setErrorModalVisible(true);
    } finally {
      setSavingEdit(false);
    }
  };

  // ============================================================================
  // STAT CARD COMPONENT
  // ============================================================================
  const StatCard = ({ title, value, icon, color }: any) => (
    <View
      className="p-4 rounded-xl flex-1 shadow-sm"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.muted + "30",
      }}
    >
      <View className="flex-row items-center mb-2">
        <View
          style={{ backgroundColor: color + "20" }}
          className="p-2 rounded-lg"
        >
          <Image
            source={icon}
            className="size-5"
            style={{ tintColor: color }}
          />
        </View>
      </View>
      <Text className="text-2xl font-rubik-bold" style={{ color: theme.title }}>
        {value}
      </Text>
      <Text className="text-xs font-rubik" style={{ color: theme.muted }}>
        {title}
      </Text>
    </View>
  );

  // ============================================================================
  // EDIT MODAL RENDER
  // ============================================================================
  const renderEditModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={editModalVisible}
      onRequestClose={closeEditModal}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl h-5/6"
          style={{ backgroundColor: theme.background }}
        >
          <View
            className="flex-row justify-between items-center p-6 border-b"
            style={{ borderBottomColor: theme.muted + "30" }}
          >
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Edit Property
            </Text>
            <TouchableOpacity onPress={closeEditModal}>
              <Text className="text-2xl" style={{ color: theme.text }}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Property Name <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={editForm.propertyName}
                onChangeText={(text) => handleEditChange("propertyName", text)}
                className="border px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                  color: theme.text,
                }}
                placeholder="e.g. Sunset Apartments"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Property Type
              </Text>
              <TextInput
                value={editForm.type}
                onChangeText={(text) => handleEditChange("type", text)}
                className="border px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                  color: theme.text,
                }}
                placeholder="e.g. Apartment, House"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Address
              </Text>
              <TextInput
                value={editForm.address}
                onChangeText={(text) => handleEditChange("address", text)}
                className="border px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                  color: theme.text,
                }}
                placeholder="Full address"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Price (per month) <Text className="text-red-500">*</Text>
              </Text>
              <View
                className="flex-row items-center border rounded-lg"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                }}
              >
                <Text
                  className="px-3 font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  $
                </Text>
                <TextInput
                  value={editForm.price}
                  onChangeText={(text) => handleEditChange("price", text)}
                  keyboardType="numeric"
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                  placeholder="1500"
                  placeholderTextColor={theme.muted}
                />
              </View>
            </View>

            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Bedrooms
                </Text>
                <TextInput
                  value={editForm.bedrooms}
                  onChangeText={(text) => handleEditChange("bedrooms", text)}
                  keyboardType="numeric"
                  className="border px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  placeholder="2"
                  placeholderTextColor={theme.muted}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Bathrooms
                </Text>
                <TextInput
                  value={editForm.bathrooms}
                  onChangeText={(text) => handleEditChange("bathrooms", text)}
                  keyboardType="numeric"
                  className="border px-4 py-3 rounded-lg"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: theme.muted + "50",
                    color: theme.text,
                  }}
                  placeholder="1"
                  placeholderTextColor={theme.muted}
                />
              </View>
            </View>

            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Area (sq ft)
              </Text>
              <TextInput
                value={editForm.area}
                onChangeText={(text) => handleEditChange("area", text)}
                keyboardType="numeric"
                className="border px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                  color: theme.text,
                }}
                placeholder="850"
                placeholderTextColor={theme.muted}
              />
            </View>

            <View className="mb-6">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Description
              </Text>
              <TextInput
                value={editForm.description}
                onChangeText={(text) => handleEditChange("description", text)}
                className="border px-4 py-3 rounded-lg h-24"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "50",
                  color: theme.text,
                }}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholder="Describe your property..."
                placeholderTextColor={theme.muted}
              />
            </View>

            <View className="mb-6">
              <Text
                className="text-sm font-rubik-medium mb-3"
                style={{ color: theme.text }}
              >
                Availability Status
              </Text>

              <TouchableOpacity
                onPress={toggleAvailability}
                className={`flex-row items-center justify-between p-4 rounded-xl border ${
                  editForm.isAvailable ? "border-green-300" : "border-red-300"
                }`}
                style={{
                  backgroundColor: editForm.isAvailable
                    ? theme.primary[100]
                    : theme.danger + "20",
                }}
              >
                <View className="flex-row items-center">
                  <View
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                      editForm.isAvailable ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    <Text
                      className={`text-xl ${
                        editForm.isAvailable ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {editForm.isAvailable ? "✓" : "✕"}
                    </Text>
                  </View>
                  <View className="ml-3">
                    <Text
                      className="text-base font-rubik-bold"
                      style={{ color: theme.text }}
                    >
                      {editForm.isAvailable
                        ? "Available for Rent"
                        : "Not Available"}
                    </Text>
                    <Text className="text-xs" style={{ color: theme.muted }}>
                      {editForm.isAvailable
                        ? "Property is visible to tenants"
                        : "Property is hidden from search"}
                    </Text>
                  </View>
                </View>

                <View
                  className={`w-12 h-6 rounded-full ${
                    editForm.isAvailable ? "bg-green-500" : "bg-gray-300"
                  }`}
                >
                  <View
                    className={`w-5 h-5 rounded-full bg-white absolute top-0.5 ${
                      editForm.isAvailable ? "right-0.5" : "left-0.5"
                    }`}
                  />
                </View>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-3 mb-10">
              <TouchableOpacity
                onPress={closeEditModal}
                className="flex-1 py-4 rounded-full border"
                style={{ borderColor: theme.muted + "50" }}
              >
                <Text
                  className="text-center font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEdit}
                disabled={savingEdit}
                className={`flex-1 py-4 rounded-full ${
                  savingEdit ? "bg-gray-400" : "bg-primary-300"
                }`}
              >
                <Text className="text-white text-center font-rubik-bold">
                  {savingEdit ? "Saving..." : "Save Changes"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-4" style={{ color: theme.muted }}>
            Loading dashboard...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary[300]]}
            tintColor={theme.primary[300]}
          />
        }
      >
        {/* Header */}
        <View
          className="px-6 pt-4 pb-2"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row justify-between items-center">
            <View>
              <Text
                className="text-2xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                Welcome back,
              </Text>
              <Text className="text-xl font-rubik-medium text-gray-500">
                {user?.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/landLordNotifications")}
              className="p-2 rounded-full"
              style={{ backgroundColor: theme.surface }}
            >
              <Image
                source={icons.bell}
                className="size-6"
                style={{ tintColor: theme.text }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Welcome Banner */}
        <View className="mx-6 mt-4 mb-2">
          <View
            className="p-5 rounded-2xl"
            style={{ backgroundColor: theme.surface}}
          >
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              Dashboard Overview
            </Text>
            <Text className="text-sm mt-1" style={{ color: theme.muted }}>
              Track your property performance and manage your listings
            </Text>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="px-6 mt-4">
          <Text
            className="text-lg font-rubik-bold mb-4"
            style={{ color: theme.title }}
          >
            Overview
          </Text>
          <View className="flex-row gap-3">
            <StatCard
              title="Total Properties"
              value={stats.totalProperties}
              icon={icons.home}
              color="#0066CC"
            />
            <StatCard
              title="Total Likes"
              value={stats.totalLikes}
              icon={icons.heart}
              color="#FF69B4"
            />
          </View>
          <View className="flex-row gap-3 mt-3">
            <StatCard
              title="Avg Rating"
              value={stats.averageRating}
              icon={icons.star}
              color="#FDB241"
            />
            <StatCard
              title="Total Views"
              value={stats.totalViews}
              icon={icons.eye}
              color="#10B981"
            />
          </View>

          {/* Additional Metrics */}
          <View className="flex-row gap-3 mt-3">
            <View
              className="flex-1 rounded-xl p-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <View className="flex-row items-center mb-2">
                <Image
                  source={icons.check}
                  className="w-5 h-5"
                  style={{ tintColor: "#10B981" }}
                />
              </View>
              <Text
                className="text-2xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                {availableProperties}
              </Text>
              <Text className="text-xs" style={{ color: theme.muted }}>
                Available Properties
              </Text>
            </View>

            <View
              className="flex-1 rounded-xl p-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <View className="flex-row items-center mb-2">
                <Image
                  source={icons.bookmark}
                  className="w-5 h-5"
                  style={{ tintColor: "#F59E0B" }}
                />
              </View>
              <Text
                className="text-2xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                {Math.round(occupancyRate)}%
              </Text>
              <Text className="text-xs" style={{ color: theme.muted }}>
                Occupancy Rate
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="px-6 mt-6">
          <Text
            className="text-lg font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            Quick Actions
          </Text>
          <View className="flex-row justify-between gap-3">
            {quickActions.map((action, index) => (
              <TouchableOpacity
                key={index}
                onPress={action.onPress}
                className="flex-1 items-center py-3 rounded-xl"
                style={{ backgroundColor: theme.surface }}
              >
                <Image
                  source={action.icon}
                  className="w-6 h-6 mb-2"
                  style={{ tintColor: action.color }}
                />
                <Text
                  className="text-xs font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Top Performing Property */}
        {topProperty && (
          <View className="px-6 mt-6">
            <Text
              className="text-lg font-rubik-bold mb-3"
              style={{ color: theme.title }}
            >
              Top Performing
            </Text>
            <TouchableOpacity
              onPress={() => handlePropertyPress(topProperty.$id)}
              className="rounded-xl overflow-hidden"
              style={{ backgroundColor: theme.surface }}
            >
              <View className="flex-row p-4">
                <View className="w-20 h-20 rounded-lg overflow-hidden mr-3">
                  {topProperty.image1 ? (
                    <Image
                      source={{ uri: topProperty.image1 }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <View
                      className="w-full h-full items-center justify-center"
                      style={{ backgroundColor: theme.muted + "20" }}
                    >
                      <Image
                        source={icons.house}
                        className="w-8 h-8 opacity-30"
                      />
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <Text
                    className="font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {topProperty.propertyName}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    {topProperty.address}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-3">
                    <View className="flex-row items-center">
                      <Image
                        source={icons.like}
                        className="w-3 h-3 mr-1"
                        style={{ tintColor: "#FF69B4" }}
                      />
                      <Text className="text-xs" style={{ color: theme.muted }}>
                        {topProperty.likes || 0} likes
                      </Text>
                    </View>
                    <View className="flex-row items-center">
                      <Image
                        source={icons.eye}
                        className="w-3 h-3 mr-1"
                        style={{ tintColor: "#10B981" }}
                      />
                      <Text className="text-xs" style={{ color: theme.muted }}>
                        {topProperty.views || 0} views
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Properties List */}
        <View className="px-6 mt-6 pb-10">
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              Your Properties
            </Text>
            {properties.length > 0 && (
              <TouchableOpacity onPress={() => setPropertiesModalVisible(true)}>
                <Text className="text-primary-300 font-rubik-medium">
                  See All
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {properties.length === 0 ? (
            <View
              className="p-8 rounded-xl items-center border border-dashed"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.muted + "50",
              }}
            >
              <Image
                source={icons.home}
                className="size-16 mb-4 opacity-30"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="text-center font-rubik-medium mb-2"
                style={{ color: theme.text }}
              >
                No properties yet
              </Text>
              <Text
                className="text-center text-sm mb-4"
                style={{ color: theme.muted }}
              >
                Start by adding your first property
              </Text>
              <TouchableOpacity
                onPress={handleAddProperty}
                className="bg-primary-300 px-6 py-3 rounded-full"
              >
                <Text className="text-white font-rubik-bold">Add Property</Text>
              </TouchableOpacity>
            </View>
          ) : (
            properties.slice(0, 3).map((property) => (
              <View
                key={property.$id}
                className="p-4 rounded-xl mb-3"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <TouchableOpacity
                  onPress={() => handlePropertyPress(property.$id)}
                  activeOpacity={0.7}
                >
                  <View className="flex-row">
                    <View className="w-20 h-20 rounded-lg overflow-hidden mr-3">
                      {property.image1 ? (
                        <Image
                          source={{ uri: property.image1 }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          className="w-full h-full items-center justify-center"
                          style={{ backgroundColor: theme.muted + "20" }}
                        >
                          <Image
                            source={icons.home}
                            className="size-8 opacity-30"
                            style={{ tintColor: theme.muted }}
                          />
                        </View>
                      )}
                    </View>

                    <View className="flex-1">
                      <View className="flex-row justify-between">
                        <Text
                          className="text-base font-rubik-bold flex-1"
                          style={{ color: theme.title }}
                        >
                          {property.propertyName}
                        </Text>
                        <View className="flex-row items-center">
                          <Image source={icons.star} className="size-3 mr-1" />
                          <Text
                            className="text-sm"
                            style={{ color: theme.muted }}
                          >
                            {property.rating?.toFixed() || "0"}
                          </Text>
                        </View>
                      </View>

                      <Text
                        className="text-xs mt-1"
                        style={{ color: theme.muted }}
                        numberOfLines={1}
                      >
                        {property.address}
                      </Text>

                      <View className="flex-row justify-between items-center mt-2">
                        <Text className="font-rubik-bold text-primary-300">
                          ${property.price.toLocaleString()}
                          <Text className="text-primary-300 text-xs">
                            {property.type === "Boarding" ? "/head" : "/mo"}
                          </Text>
                        </Text>
                        <View className="flex-row items-center">
                          <Image
                            source={icons.heart}
                            className="size-4 mr-1"
                            style={{ tintColor: "#FF69B4" }}
                          />
                          <Text
                            className="text-xs mr-3"
                            style={{ color: theme.muted }}
                          >
                            {property.likes || 0}
                          </Text>
                          <Image
                            source={icons.eye}
                            className="size-4 mr-1"
                            style={{ tintColor: "#10B981" }}
                          />
                          <Text
                            className="text-xs"
                            style={{ color: theme.muted }}
                          >
                            {property.views || 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => openEditModal(property)}
                  className="mt-3 py-2 rounded-full border border-gray-500"
                >
                  <Text className="text-primary-300 text-center font-rubik-bold text-sm">
                    Edit Property
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Properties Modal */}
      <MyPropertiesModal
        visible={propertiesModalVisible}
        onClose={() => setPropertiesModalVisible(false)}
        properties={properties}
        onPropertyPress={handlePropertyPress}
      />

      {/* Edit Modal */}
      {renderEditModal()}
      <OperationSuccesfull
        visible={showSuccess}
        onClose={() => {
          setShowSuccess(false);
          router.replace("/landHome");
        }}
        title="Deleted Successfully"
        message="Property has been removed from your listings."
      />
      <ErrorModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title="Oops!"
        message={errorMessage}
      />
    </SafeAreaView>
  );
}
