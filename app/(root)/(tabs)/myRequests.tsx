// app/(root)/tenant-requests.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";
import { Query } from "react-native-appwrite";
import { SafeAreaView } from "react-native-safe-area-context";

interface TenantRequest {
  $id: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  proposedPrice?: number;
  originalPrice?: number;
  message?: string;
  moveInDate?: string;
  leaseDuration?: string;
  questions?: string[];
  // Property details (fetched separately)
  propertyImage?: string;
  propertyAddress?: string;
  propertyType?: string;
}

export default function TenantRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TenantRequest | null>(null);
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isTenant = user?.userMode === "tenant";

  const fetchRequests = async () => {
    if (!user?.accountId) return;

    try {
      setLoading(true);

      const requestsResult = await databases.listDocuments(
        config.databaseId!,
        config.requestsCollectionId!,
        [
          Query.equal("tenantId", user.accountId),
          Query.orderDesc("$createdAt"),
        ],
      );

      // Enrich with property details
      const enriched = await Promise.all(
        requestsResult.documents.map(async (doc) => {
          let propertyImage = null;
          let propertyAddress = null;
          let propertyType = null;

          try {
            const property = await databases.getDocument(
              config.databaseId!,
              config.propertiesCollectionId!,
              doc.propertyId,
            );
            propertyImage = property.image1 || null;
            propertyAddress = property.address || null;
            propertyType = property.type || null;
          } catch {
            // property may have been deleted
          }

          return {
            $id: doc.$id,
            propertyId: doc.propertyId,
            propertyName: doc.propertyName,
            tenantId: doc.tenantId,
            status: doc.status,
            createdAt: doc.$createdAt,
            proposedPrice: doc.proposedPrice,
            originalPrice: doc.originalPrice,
            message: doc.message,
            moveInDate: doc.moveInDate,
            leaseDuration: doc.leaseDuration,
            questions: doc.questions ? JSON.parse(doc.questions) : [],
            propertyImage,
            propertyAddress,
            propertyType,
          };
        }),
      );

      setRequests(enriched);
    } catch (error) {
      console.error("Error fetching tenant requests:", error);
      Alert.alert("Error", "Failed to load your requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isTenant) {
      fetchRequests();
    }
  }, [isTenant]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return {
          bg: "#F59E0B20",
          text: "#92400E",
          label: "⏳ Pending",
          border: "#F59E0B50",
        };
      case "accepted":
        return {
          bg: "#10B98120",
          text: "#065F46",
          label: "✓ Accepted",
          border: "#10B98150",
        };
      case "rejected":
        return {
          bg: "#EF444420",
          text: "#991B1B",
          label: "✗ Declined",
          border: "#EF444450",
        };
      default:
        return {
          bg: "#6B728020",
          text: "#374151",
          label: "Unknown",
          border: "#6B728050",
        };
    }
  };

  const renderDetailsModal = () => {
    if (!selectedRequest) return null;

    const statusColor = getStatusColor(selectedRequest.status);
    const hasNegotiatedPrice =
      selectedRequest.proposedPrice &&
      selectedRequest.proposedPrice !== selectedRequest.originalPrice;

    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={detailsModalVisible}
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          {/* Header */}
          <View
            className="flex-row items-center px-5 py-4 border-b"
            style={{
              borderBottomColor: theme.muted + "30",
              backgroundColor: theme.navBackground,
            }}
          >
            <TouchableOpacity
              onPress={() => setDetailsModalVisible(false)}
              className="mr-4 p-2"
            >
              <Image
                source={icons.backArrow}
                className="w-6 h-6"
                style={{ tintColor: theme.text }}
              />
            </TouchableOpacity>
            <Text
              className="text-xl font-rubik-bold flex-1"
              style={{ color: theme.title }}
            >
              Request Details
            </Text>
          </View>

          <ScrollView
            className="flex-1 px-5 pt-4"
            showsVerticalScrollIndicator={false}
          >
            {/* Status Badge */}
            <View
              className="self-start px-4 py-2 rounded-full mb-4 border"
              style={{
                backgroundColor: statusColor.bg,
                borderColor: statusColor.border,
              }}
            >
              <Text className="font-rubik-bold" style={{ color: statusColor.text }}>
                {statusColor.label}
              </Text>
            </View>

            {/* Status message for accepted/rejected */}
            {selectedRequest.status === "accepted" && (
              <View
                className="rounded-2xl p-4 mb-4 flex-row items-center"
                style={{ backgroundColor: "#10B98115", borderWidth: 1, borderColor: "#10B98130" }}
              >
                <Text className="text-2xl mr-3">🎉</Text>
                <View className="flex-1">
                  <Text className="font-rubik-bold text-green-700 text-base">
                    Congratulations!
                  </Text>
                  <Text className="text-green-600 text-sm mt-1">
                    Your request was accepted. The landlord will contact you soon.
                  </Text>
                </View>
              </View>
            )}

            {selectedRequest.status === "rejected" && (
              <View
                className="rounded-2xl p-4 mb-4 flex-row items-center"
                style={{ backgroundColor: "#EF444415", borderWidth: 1, borderColor: "#EF444430" }}
              >
                <Text className="text-2xl mr-3">😔</Text>
                <View className="flex-1">
                  <Text className="font-rubik-bold text-red-700 text-base">
                    Request Declined
                  </Text>
                  <Text className="text-red-600 text-sm mt-1">
                    Don&apos;t give up — keep exploring other great properties!
                  </Text>
                </View>
              </View>
            )}

            {/* Property Info */}
            <View
              className="rounded-2xl overflow-hidden mb-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              {selectedRequest.propertyImage && (
                <Image
                  source={{ uri: selectedRequest.propertyImage }}
                  className="w-full h-40"
                  resizeMode="cover"
                />
              )}
              <View className="p-4">
                <Text
                  className="text-base font-rubik-bold mb-1"
                  style={{ color: theme.title }}
                >
                  🏠 {selectedRequest.propertyName}
                </Text>
                {selectedRequest.propertyType && (
                  <View className="flex-row items-center mb-1">
                    <View className="px-2 py-0.5 rounded-full bg-primary-100 self-start">
                      <Text className="text-xs font-rubik-bold text-primary-300">
                        {selectedRequest.propertyType}
                      </Text>
                    </View>
                  </View>
                )}
                {selectedRequest.propertyAddress && (
                  <View className="flex-row items-center mt-2">
                    <Image
                      source={icons.location}
                      className="w-4 h-4 mr-1"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text className="text-sm" style={{ color: theme.muted }}>
                      {selectedRequest.propertyAddress}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Price Info */}
            <View
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <Text
                className="text-base font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                💰 Price Details
              </Text>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Listed Price
                  </Text>
                  <Text className="text-base" style={{ color: theme.muted }}>
                    ${selectedRequest.originalPrice}/month
                  </Text>
                </View>
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Your Offer
                  </Text>
                  <Text
                    className="text-base font-rubik-bold"
                    style={{
                      color: hasNegotiatedPrice
                        ? theme.primary[300]
                        : theme.text,
                    }}
                  >
                    ${selectedRequest.proposedPrice || selectedRequest.originalPrice}/month
                  </Text>
                  {hasNegotiatedPrice && (
                    <Text className="text-xs text-primary-300 mt-1">
                      Negotiated price
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Move-in & Lease Details */}
            {(selectedRequest.moveInDate || selectedRequest.leaseDuration) && (
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <Text
                  className="text-base font-rubik-bold mb-3"
                  style={{ color: theme.title }}
                >
                  📅 Move-in & Lease
                </Text>
                {selectedRequest.moveInDate && (
                  <View className="mb-3">
                    <Text
                      className="text-sm font-rubik-medium mb-1"
                      style={{ color: theme.muted }}
                    >
                      Preferred Move-in Date
                    </Text>
                    <Text className="text-base" style={{ color: theme.text }}>
                      {selectedRequest.moveInDate}
                    </Text>
                  </View>
                )}
                {selectedRequest.leaseDuration && (
                  <View>
                    <Text
                      className="text-sm font-rubik-medium mb-1"
                      style={{ color: theme.muted }}
                    >
                      Lease Duration
                    </Text>
                    <Text className="text-base" style={{ color: theme.text }}>
                      {selectedRequest.leaseDuration}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Your Questions */}
            {selectedRequest.questions && selectedRequest.questions.length > 0 && (
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <Text
                  className="text-base font-rubik-bold mb-3"
                  style={{ color: theme.title }}
                >
                  ❓ Your Questions
                </Text>
                {selectedRequest.questions.map((question, index) => (
                  <View
                    key={index}
                    className="mb-3 pb-3 border-b"
                    style={{ borderBottomColor: theme.muted + "20" }}
                  >
                    <Text
                      className="text-sm font-rubik-medium mb-1"
                      style={{ color: theme.primary[300] }}
                    >
                      Question {index + 1}
                    </Text>
                    <Text className="text-sm" style={{ color: theme.text }}>
                      {question}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Your Message */}
            {selectedRequest.message && (
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <Text
                  className="text-base font-rubik-bold mb-3"
                  style={{ color: theme.title }}
                >
                  💬 Your Message
                </Text>
                <Text
                  className="text-sm italic leading-5"
                  style={{ color: theme.text }}
                >
                  {selectedRequest.message}
                </Text>
              </View>
            )}

            {/* Submitted Date */}
            <View
              className="rounded-2xl p-4 mb-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.muted }}
              >
                Request Submitted
              </Text>
              <Text className="text-sm" style={{ color: theme.muted }}>
                {formatDate(selectedRequest.createdAt)}
              </Text>
            </View>

            {/* View Property Button */}
            <TouchableOpacity
              onPress={() => {
                setDetailsModalVisible(false);
                router.push(`/properties/${selectedRequest.propertyId}`);
              }}
              className="py-4 rounded-full mb-10"
              style={{ backgroundColor: theme.primary[300] }}
            >
              <Text className="text-white text-center font-rubik-bold">
                View Property
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (!isTenant) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}
      >
        <Image
          source={icons.lock}
          className="w-20 h-20 opacity-30 mb-4"
          style={{ tintColor: theme.muted }}
        />
        <Text className="text-lg font-rubik-medium text-center" style={{ color: theme.text }}>
          Tenant Access Only
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
      </SafeAreaView>
    );
  }

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const acceptedCount = requests.filter((r) => r.status === "accepted").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          My Requests
        </Text>
        <TouchableOpacity onPress={fetchRequests} className="p-2">
          <Image
            source={icons.refresh}
            className="w-5 h-5"
            style={{ tintColor: theme.primary[300] }}
          />
        </TouchableOpacity>
      </View>

      {/* Stats Summary */}
      {requests.length > 0 && (
        <View className="flex-row px-4 py-3 gap-3">
          <View
            className="flex-1 rounded-xl p-3 items-center"
            style={{ backgroundColor: "#F59E0B15" }}
          >
            <Text className="text-2xl font-rubik-bold text-amber-600">
              {pendingCount}
            </Text>
            <Text className="text-xs text-amber-600">Pending</Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3 items-center"
            style={{ backgroundColor: "#10B98115" }}
          >
            <Text className="text-2xl font-rubik-bold text-green-600">
              {acceptedCount}
            </Text>
            <Text className="text-xs text-green-600">Accepted</Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3 items-center"
            style={{ backgroundColor: "#EF444415" }}
          >
            <Text className="text-2xl font-rubik-bold text-red-600">
              {rejectedCount}
            </Text>
            <Text className="text-xs text-red-600">Declined</Text>
          </View>
        </View>
      )}

      {requests.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <Image
            source={icons.check}
            className="w-20 h-20 opacity-30 mb-4"
            style={{ tintColor: theme.muted }}
          />
          <Text
            className="text-lg font-rubik-medium text-center"
            style={{ color: theme.text }}
          >
            No Requests Yet
          </Text>
          <Text
            className="text-sm text-center mt-2"
            style={{ color: theme.muted }}
          >
            When you request to rent a property, it&apos;ll appear here
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/explore")}
            className="mt-6 px-8 py-3 rounded-full"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-bold">Explore Properties</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.$id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary[300]]}
              tintColor={theme.primary[300]}
            />
          }
          renderItem={({ item }) => {
            const statusColor = getStatusColor(item.status);
            const hasNegotiatedPrice =
              item.proposedPrice && item.proposedPrice !== item.originalPrice;

            return (
              <TouchableOpacity
                onPress={() => {
                  setSelectedRequest(item);
                  setDetailsModalVisible(true);
                }}
                activeOpacity={0.7}
                className="mb-4 rounded-xl overflow-hidden"
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
                {/* Property Image */}
                {item.propertyImage && (
                  <Image
                    source={{ uri: item.propertyImage }}
                    className="w-full h-32"
                    resizeMode="cover"
                  />
                )}

                <View className="p-4">
                  {/* Property Name + Status */}
                  <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-1 mr-2">
                      <Text
                        className="text-lg font-rubik-bold"
                        style={{ color: theme.title }}
                        numberOfLines={1}
                      >
                        {item.propertyName}
                      </Text>
                      {item.propertyAddress && (
                        <View className="flex-row items-center mt-1">
                          <Image
                            source={icons.location}
                            className="w-3 h-3 mr-1"
                            style={{ tintColor: theme.muted }}
                          />
                          <Text
                            className="text-xs"
                            style={{ color: theme.muted }}
                            numberOfLines={1}
                          >
                            {item.propertyAddress}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      className="px-3 py-1 rounded-full border"
                      style={{
                        backgroundColor: statusColor.bg,
                        borderColor: statusColor.border,
                      }}
                    >
                      <Text
                        className="text-xs font-rubik-bold"
                        style={{ color: statusColor.text }}
                      >
                        {statusColor.label}
                      </Text>
                    </View>
                  </View>

                  {/* Price Info */}
                  <View
                    className="flex-row items-center justify-between pt-2 mt-2 border-t"
                    style={{ borderTopColor: theme.muted + "20" }}
                  >
                    <View>
                      <Text
                        className="text-xs font-rubik-medium mb-1"
                        style={{ color: theme.muted }}
                      >
                        Your Offer
                      </Text>
                      <Text
                        className="text-base font-rubik-bold"
                        style={{
                          color: hasNegotiatedPrice
                            ? theme.primary[300]
                            : theme.text,
                        }}
                      >
                        ${item.proposedPrice || item.originalPrice}/month
                      </Text>
                    </View>

                    {item.moveInDate && (
                      <View>
                        <Text
                          className="text-xs font-rubik-medium mb-1"
                          style={{ color: theme.muted }}
                        >
                          Move-in Date
                        </Text>
                        <Text
                          className="text-sm"
                          style={{ color: theme.text }}
                        >
                          {item.moveInDate}
                        </Text>
                      </View>
                    )}

                    <Text
                      className="text-xs"
                      style={{ color: theme.muted }}
                    >
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {renderDetailsModal()}
    </SafeAreaView>
  );
}