// app/(root)/landlord-requests.tsx
import { Colors } from "@/constants/Colors";
import { getAvatarSource } from "@/constants/data";

import icons from "@/constants/icons";
import { config, createNotification, databases } from "@/lib/appwrite";
import notificationService from "@/services/notification.service";
import useAuthStore from "@/store/auth.store";
import { LinearGradient } from "expo-linear-gradient";
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

interface RentalRequest {
  $id: string;
  propertyId: string;
  propertyName: string;
  tenantId: string;
  tenantName: string;
  tenantAvatar?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  // Enhanced request fields
  proposedPrice?: number;
  originalPrice?: number;
  message?: string;
  moveInDate?: string;
  leaseDuration?: string;
  questions?: string[];
  property?: any;
}

export default function LandlordRequests() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RentalRequest | null>(
    null,
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isLandlord = user?.userMode === "landlord";

  // Fetch ALL requests for landlord's properties
  const fetchRequests = async () => {
    if (!user?.accountId) return;

    try {
      setLoading(true);

      // First, get all properties owned by this landlord
      const properties = await databases.listDocuments(
        config.databaseId!,
        config.propertiesCollectionId!,
        [Query.equal("creatorId", user.accountId)],
      );

      const propertyIds = properties.documents.map((p) => p.$id);

      if (propertyIds.length === 0) {
        setRequests([]);
        return;
      }

      // Get ALL requests for these properties
      const requestsResult = await databases.listDocuments(
        config.databaseId!,
        config.requestsCollectionId!,
        [Query.equal("propertyId", propertyIds), Query.orderDesc("$createdAt")],
      );

      // Fetch tenant details and format requests with all data
      const formattedRequests = await Promise.all(
        requestsResult.documents.map(async (doc) => {
          let tenantAvatar = null;
          let tenantEmail = null;
          let tenantPhone = null;

          // Try to get tenant details from users collection
          try {
            const userDocs = await databases.listDocuments(
              config.databaseId!,
              config.usersCollectionId!,
              [Query.equal("accountId", doc.tenantId)],
            );

            if (userDocs.documents.length > 0) {
              tenantAvatar =
                userDocs.documents[0].avatar ||
                userDocs.documents[0].customAvatar;
              tenantEmail = userDocs.documents[0].email;
              tenantPhone = userDocs.documents[0].phone;
            }
          } catch (error) {
            console.error("Error fetching tenant details:", error);
          }

          return {
            $id: doc.$id,
            propertyId: doc.propertyId,
            propertyName: doc.propertyName,
            tenantId: doc.tenantId,
            tenantName: doc.tenantName,
            tenantAvatar: tenantAvatar,
            tenantEmail: tenantEmail,
            tenantPhone: tenantPhone,
            status: doc.status,
            createdAt: doc.$createdAt,
            // Enhanced fields
            proposedPrice: doc.proposedPrice,
            originalPrice: doc.originalPrice,
            message: doc.message,
            moveInDate: doc.moveInDate,
            leaseDuration: doc.leaseDuration,
            questions: doc.questions ? JSON.parse(doc.questions) : [],
          };
        }),
      );

      setRequests(formattedRequests);
    } catch (error) {
      console.error("Error fetching requests:", error);
      Alert.alert("Error", "Failed to load requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLandlord) {
      fetchRequests();
    }
  }, [isLandlord]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRequests();
  };

  // Delete request function
  const handleDeleteRequest = async (
    requestId: string,
    request: RentalRequest,
  ) => {
    Alert.alert(
      "Delete Request",
      `Are you sure you want to delete the request from ${request.tenantName} for "${request.propertyName}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setProcessingId(requestId);
            try {
              // Delete the request document
              await databases.deleteDocument(
                config.databaseId!,
                config.requestsCollectionId!,
                requestId,
              );

              await createNotification(
                request.tenantId,
                "📋 Request Removed",
                `Your rental request for "${request.propertyName}" has been removed by the landlord.`,
                "system",
                {
                  propertyId: request.propertyId,
                  propertyName: request.propertyName,
                  status: "deleted",
                },
              );

              // Remove from local state
              setRequests((prev) => prev.filter((r) => r.$id !== requestId));

              Alert.alert("Success", "Request deleted successfully");
            } catch (error) {
              console.error("Error deleting request:", error);
              Alert.alert("Error", "Failed to delete request");
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  };

  const handleRequestAction = async (
    requestId: string,
    action: "accepted" | "rejected",
  ) => {
    setProcessingId(requestId);

    try {
      // Update request status
      await databases.updateDocument(
        config.databaseId!,
        config.requestsCollectionId!,
        requestId,
        { status: action },
      );

      // Get the request details
      const request = requests.find((r) => r.$id === requestId);

      if (request) {
        // Create in-app notification for tenant
        const notificationTitle =
          action === "accepted"
            ? "Rental Request Accepted!"
            : "Rental Request Declined";

        const notificationMessage =
          action === "accepted"
            ? `Your request for "${request.propertyName}" has been accepted! ${request.proposedPrice && request.proposedPrice !== request.originalPrice ? `Your negotiated price of $${request.proposedPrice}/month has been approved. ` : ""}The landlord will contact you soon.`
            : `Your request for "${request.propertyName}" was declined. Keep looking for other great properties!`;

        await createNotification(
          request.tenantId,
          notificationTitle,
          notificationMessage,
          "request",
          {
            propertyId: request.propertyId,
            propertyName: request.propertyName,
            status: action,
            proposedPrice: request.proposedPrice,
          },
        );

        // 🚀 SEND PUSH NOTIFICATION TO TENANT
        try {
          await notificationService.sendRequestResponseNotification(
            request.tenantId,
            request.propertyName,
            action,
          );
          console.log(
            `✅ Push notification sent to tenant for ${action} request`,
          );
        } catch (pushError) {
          console.error("Failed to send push notification:", pushError);
          // Don't throw - push notification failure shouldn't break the flow
        }

        // Update local state - remove the request from list since it's processed
        setRequests((prev) => prev.filter((r) => r.$id !== requestId));

        // Show success message
        Alert.alert(
          "Success",
          `Request ${action === "accepted" ? "accepted" : "rejected"} successfully!`,
        );
      }
    } catch (error) {
      console.error("Error updating request:", error);
      Alert.alert("Error", "Failed to update request status");
    } finally {
      setProcessingId(null);
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " at " + date.toLocaleTimeString();
  };

  const getAvatarSourceImage = (avatar: string | undefined, name: string) => {
    if (avatar && avatar.startsWith("http")) {
      return { uri: avatar };
    }
    if (avatar && avatar !== "person") {
      return getAvatarSource(avatar);
    }
    return {
      uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=100`,
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: "#F59E0B20", text: "#92400E", label: "⏳ Pending" };
      case "accepted":
        return { bg: "#10B98120", text: "#065F46", label: "✓ Accepted" };
      case "rejected":
        return { bg: "#EF444420", text: "#991B1B", label: "✗ Rejected" };
      default:
        return { bg: "#6B728020", text: "#374151", label: "Unknown" };
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
          <LinearGradient
            colors={[theme.primary[100], theme.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="px-5 py-4"
          >
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => setDetailsModalVisible(false)}
                className="mr-4 p-2"
              >
                <Image
                  source={icons.backArrow}
                  className="w-6 h-6"
                  style={{ tintColor: "#FFF" }}
                />
              </TouchableOpacity>
              <Text className="text-white text-xl font-rubik-bold flex-1">
                Request Details
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setDetailsModalVisible(false);
                  handleDeleteRequest(selectedRequest.$id, selectedRequest);
                }}
                disabled={processingId === selectedRequest.$id}
                className="bg-red-500/20 p-2 rounded-full"
              >
                <Image
                  source={icons.trash}
                  className="w-5 h-5"
                  style={{ tintColor: "#EF4444" }}
                />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <ScrollView
            className="flex-1 px-5 pt-4"
            showsVerticalScrollIndicator={false}
          >
            {/* Status Badge */}
            <View
              className="self-start px-4 py-2 rounded-full mb-4"
              style={{ backgroundColor: statusColor.bg }}
            >
              <Text
                className="font-rubik-bold"
                style={{ color: statusColor.text }}
              >
                {statusColor.label}
              </Text>
            </View>

            {/* Tenant Info */}
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
                👤 Tenant Information
              </Text>
              <View className="flex-row items-center mb-3">
                <Image
                  source={getAvatarSourceImage(
                    selectedRequest.tenantAvatar,
                    selectedRequest.tenantName,
                  )}
                  className="w-16 h-16 rounded-full mr-3"
                />
                <View className="flex-1">
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {selectedRequest.tenantName}
                  </Text>
                  {selectedRequest.tenantEmail && (
                    <View className="flex-row items-center mt-1">
                      <Image
                        source={icons.mail}
                        className="w-4 h-4 mr-2"
                        style={{ tintColor: theme.muted }}
                      />
                      <Text className="text-sm" style={{ color: theme.muted }}>
                        {selectedRequest.tenantEmail}
                      </Text>
                    </View>
                  )}
                  {selectedRequest.tenantPhone && (
                    <View className="flex-row items-center mt-1">
                      <Image
                        source={icons.phone}
                        className="w-4 h-4 mr-2"
                        style={{ tintColor: theme.muted }}
                      />
                      <Text className="text-sm" style={{ color: theme.muted }}>
                        {selectedRequest.tenantPhone}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Property & Price Info */}
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
                🏠 Property & Price
              </Text>

              <View className="mb-3">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.muted }}
                >
                  Property Name
                </Text>
                <Text className="text-base" style={{ color: theme.text }}>
                  {selectedRequest.propertyName}
                </Text>
              </View>

              <View className="flex-row gap-4 mb-3">
                <View className="flex-1">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.muted }}
                  >
                    Original Price
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
                    Proposed Price
                  </Text>
                  <Text
                    className={`text-base font-rubik-bold ${
                      hasNegotiatedPrice ? "text-primary-300" : ""
                    }`}
                    style={{
                      color: hasNegotiatedPrice
                        ? theme.primary[300]
                        : theme.text,
                    }}
                  >
                    $
                    {selectedRequest.proposedPrice ||
                      selectedRequest.originalPrice}
                    /month
                  </Text>
                  {hasNegotiatedPrice && (
                    <Text className="text-xs text-green-600 mt-1">
                      ↓ Tenant is negotiating
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
                  📅 Move-in & Lease Details
                </Text>

                {selectedRequest.moveInDate && (
                  <View className="mb-3">
                    <Text
                      className="text-sm font-rubik-medium mb-1"
                      style={{ color: theme.muted }}
                    >
                      Preferred Move-in Date
                    </Text>
                    <View className="flex-row items-center">
                      <Image
                        source={icons.calendar}
                        className="w-4 h-4 mr-2"
                        style={{ tintColor: theme.primary[300] }}
                      />
                      <Text className="text-base" style={{ color: theme.text }}>
                        {selectedRequest.moveInDate}
                      </Text>
                    </View>
                  </View>
                )}

                {selectedRequest.leaseDuration && (
                  <View>
                    <Text
                      className="text-sm font-rubik-medium mb-1"
                      style={{ color: theme.muted }}
                    >
                      Desired Lease Duration
                    </Text>
                    <Text className="text-base" style={{ color: theme.text }}>
                      {selectedRequest.leaseDuration}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Questions from Tenant */}
            {selectedRequest.questions &&
              selectedRequest.questions.length > 0 && (
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
                    ❓ Questions from Tenant
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

            {/* Personal Message */}
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
                  💬 Personal Message
                </Text>
                <Text
                  className="text-sm italic leading-5"
                  style={{ color: theme.text }}
                >
                  {selectedRequest.message}
                </Text>
              </View>
            )}

            {/* Request Date */}
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

            {/* Action Buttons (only for pending requests) */}
            {selectedRequest.status === "pending" && (
              <View className="flex-row gap-3 mb-10 mt-4">
                <TouchableOpacity
                  onPress={() => {
                    handleRequestAction(selectedRequest.$id, "accepted");
                    setDetailsModalVisible(false);
                  }}
                  disabled={processingId === selectedRequest.$id}
                  className="flex-1 py-3 rounded-full bg-green-500"
                >
                  <Text className="text-white text-center font-rubik-bold">
                    {processingId === selectedRequest.$id
                      ? "Processing..."
                      : "✓ Accept Request"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    handleRequestAction(selectedRequest.$id, "rejected");
                    setDetailsModalVisible(false);
                  }}
                  disabled={processingId === selectedRequest.$id}
                  className="flex-1 py-3 rounded-full bg-red-500"
                >
                  <Text className="text-white text-center font-rubik-bold">
                    {processingId === selectedRequest.$id
                      ? "Processing..."
                      : "✗ Decline Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    );
  };

  if (!isLandlord) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        }}
      >
        <Image
          source={icons.lock}
          className="w-20 h-20 opacity-30 mb-4"
          style={{ tintColor: theme.muted }}
        />
        <Text
          className="text-lg font-rubik-medium text-center"
          style={{ color: theme.text }}
        >
          Landlord Access Only
        </Text>
        <Text
          className="text-sm text-center mt-2 px-8"
          style={{ color: theme.muted }}
        >
          Only landlords can manage rental requests.
        </Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.background,
        }}
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
          Rental Requests
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
            <Text className="text-xs text-red-600">Rejected</Text>
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
            When tenants request to rent your properties, they&apos;ll appear
            here
          </Text>
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
                onLongPress={() => handleDeleteRequest(item.$id, item)}
                delayLongPress={500}
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
                <View className="p-4">
                  {/* Header with Tenant Avatar and Name */}
                  <View className="flex-row items-start mb-3">
                    <Image
                      source={getAvatarSourceImage(
                        item.tenantAvatar,
                        item.tenantName,
                      )}
                      className="w-12 h-12 rounded-full mr-3"
                      style={{
                        borderWidth: 1,
                        borderColor: theme.muted + "30",
                      }}
                    />

                    <View className="flex-1">
                      <View className="flex-row justify-between items-start">
                        <View className="flex-1">
                          <Text
                            className="text-lg font-rubik-bold"
                            style={{ color: theme.title }}
                            numberOfLines={1}
                          >
                            {item.propertyName}
                          </Text>
                          <Text
                            className="text-sm mt-1"
                            style={{ color: theme.muted }}
                          >
                            From: {item.tenantName}
                          </Text>
                        </View>
                        <View
                          className="px-3 py-1 rounded-full ml-2"
                          style={{ backgroundColor: statusColor.bg }}
                        >
                          <Text
                            className="text-xs font-rubik-bold"
                            style={{ color: statusColor.text }}
                          >
                            {statusColor.label}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Price Info */}
                  <View
                    className="flex-row items-center justify-between pt-2 mt-2 border-t"
                    style={{ borderTopColor: theme.muted + "20" }}
                  >
                    <View className="flex-1">
                      <Text
                        className="text-xs font-rubik-medium mb-1"
                        style={{ color: theme.muted }}
                      >
                        Proposed Price
                      </Text>
                      <Text
                        className={`text-base font-rubik-bold ${
                          hasNegotiatedPrice ? "text-primary-300" : ""
                        }`}
                        style={{
                          color: hasNegotiatedPrice
                            ? theme.primary[300]
                            : theme.text,
                        }}
                      >
                        ${item.proposedPrice || item.originalPrice}/month
                        {hasNegotiatedPrice && (
                          <Text className="text-xs text-green-600 ml-1">
                            (Negotiating from ${item.originalPrice})
                          </Text>
                        )}
                      </Text>
                    </View>

                    {item.moveInDate && (
                      <View className="flex-1">
                        <Text
                          className="text-xs font-rubik-medium mb-1"
                          style={{ color: theme.muted }}
                        >
                          Move-in Date
                        </Text>
                        <Text
                          className="text-sm"
                          style={{ color: theme.text }}
                          numberOfLines={1}
                        >
                          {item.moveInDate}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Message Preview */}
                  {item.message && (
                    <View className="mt-2 pt-2">
                      <Text
                        className="text-xs italic"
                        style={{ color: theme.muted }}
                        numberOfLines={2}
                      >
                        {item.message}
                      </Text>
                    </View>
                  )}

                  {/* Long press hint */}
                  <View className="items-center mt-2">
                    <Text
                      className="text-xs"
                      style={{ color: theme.muted + "60" }}
                    >
                      Press and hold to delete
                    </Text>
                  </View>

                  {/* Action Buttons (only for pending) */}
                  {item.status === "pending" && (
                    <View className="flex-row gap-3 mt-4">
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRequestAction(item.$id, "accepted");
                        }}
                        disabled={processingId === item.$id}
                        className="flex-1 py-2 rounded-full bg-green-500"
                      >
                        <Text className="text-white text-center font-rubik-bold text-sm">
                          {processingId === item.$id
                            ? "Processing..."
                            : "✓ Accept"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          handleRequestAction(item.$id, "rejected");
                        }}
                        disabled={processingId === item.$id}
                        className="flex-1 py-2 rounded-full bg-red-500"
                      >
                        <Text className="text-white text-center font-rubik-bold text-sm">
                          {processingId === item.$id
                            ? "Processing..."
                            : "✗ Decline"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Details Modal */}
      {renderDetailsModal()}
    </SafeAreaView>
  );
}
