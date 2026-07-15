// app/(root)/tenant-requests.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { config, databases, uploadImage } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { ImagePickerAsset } from "expo-image-picker";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { ID, Query } from "react-native-appwrite";
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
  rejectionReason?: string;
  // Property details (fetched separately)
  propertyImage?: string;
  propertyAddress?: string;
  propertyType?: string;
  // Queries for this property
  queries?: QueryData[];
  // Lease document fields
  leaseDocumentId?: string;
  leaseDocumentName?: string;
  leaseSentAt?: string;
}

interface QueryData {
  $id: string;
  writer: string;
  body: string;
  referenceProperty: string;
  writerAvatar?: string;
  writerPhone?: string;
  status: string;
  image1?: string;
  image2?: string;
  image3?: string;
  createdAt: string;
  reply?: string;
  replyCreatedAt?: string;
}

export default function TenantRequests() {

  const { user } = useAuthStore();
  const [requests, setRequests] = useState<TenantRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TenantRequest | null>(
    null,
  );
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isTenant = user?.userMode === "tenant";

  // Query Modal State
  const [queryModalVisible, setQueryModalVisible] = useState(false);
  const [queryText, setQueryText] = useState("");
  const [queryRequestId, setQueryRequestId] = useState<string | null>(null);
  const [queryPropertyId, setQueryPropertyId] = useState<string | null>(null);
  const [isSubmittingQuery, setIsSubmittingQuery] = useState(false);

  // Image state for query
  const [queryImages, setQueryImages] = useState<ImagePickerAsset[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Queries view modal
  const [queriesModalVisible, setQueriesModalVisible] = useState(false);
  const [selectedPropertyQueries, setSelectedPropertyQueries] = useState<
    QueryData[]
  >([]);
  const [selectedPropertyName, setSelectedPropertyName] = useState("");


// ✅ Get Appwrite file URL for preview
const getLeaseDocumentUrl = (fileId: string): string => {
  return `${config.endpoint}/storage/buckets/${config.bucketId}/files/${fileId}/view?project=${config.projectId}`;
};

// ✅ Preview - open in browser
const handlePreviewLease = async (fileId: string) => {
  if (!fileId) {
    Alert.alert("Error", "Document not found");
    return;
  }

  try {
    const url = getLeaseDocumentUrl(fileId);
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      Alert.alert("Error", "Cannot preview document. Try downloading instead.");
    }
  } catch (error) {
    console.error("Error previewing document:", error);
    Alert.alert("Error", "Failed to preview document");
  }
};



const handleDownloadLease = async (
  fileId: string,
  fileName: string
) => {
  try {
    const downloadUrl =
      `${config.endpoint}/storage/buckets/${config.bucketId}/files/${fileId}/download?project=${config.projectId}`;

    Alert.alert("Downloading", "Please wait...");

    // Download to cache first
    const tempUri = FileSystem.cacheDirectory + fileName;

  const permissions =
  await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

if (!permissions.granted) {
    return;
}

    const result = await FileSystem.downloadAsync(
      downloadUrl,
      tempUri
    );

    if (result.status !== 200) {
      throw new Error("Download failed");
    }

    // -----------------------------
    // ANDROID
    // -----------------------------
    if (Platform.OS === "android") {

      // Expo Go doesn't support SAF properly
      if (!FileSystem.StorageAccessFramework) {
        await Sharing.shareAsync(result.uri, {
          mimeType: "application/pdf",
          dialogTitle: "Save Lease Document",
        });
        return;
      }

     // Ask the user to choose a folder (first time only)
const permissions =
  await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

if (!permissions.granted) {
  Alert.alert("Permission denied", "Please allow access to save the file.");
  return;
}

// Create a temporary file first
const tempFile = FileSystem.cacheDirectory + fileName;

const downloadResult = await FileSystem.downloadAsync(
  downloadUrl,
  tempFile
);

if (downloadResult.status !== 200) {
  Alert.alert("Error", "Download failed.");
  return;
}

// Read the downloaded file
const fileData = await FileSystem.readAsStringAsync(downloadResult.uri, {
  encoding: FileSystem.EncodingType.Base64,
});

// Create the file in the selected folder
const uri = await FileSystem.StorageAccessFramework.createFileAsync(
  permissions.directoryUri,
  fileName,
  "application/pdf"
);

// Write it
await FileSystem.writeAsStringAsync(uri, fileData, {
  encoding: FileSystem.EncodingType.Base64,
});

Alert.alert("Success", `${fileName} saved successfully.`);
      return;
    }

    // -----------------------------
    // IOS
    // -----------------------------
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Save Lease Document",
      UTI: "com.adobe.pdf",
    });

  } catch (error) {
    console.error(error);
    Alert.alert("Error", "Failed to download document.");
  }
};

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

      // Enrich with property details and queries
      const enriched = await Promise.all(
        requestsResult.documents.map(async (doc) => {
          let propertyImage = null;
          let propertyAddress = null;
          let propertyType = null;
          let queries: QueryData[] = [];

          try {
            const property = await databases.getDocument(
              config.databaseId!,
              config.propertiesCollectionId!,
              doc.propertyId,
            );
            propertyImage = property.image1 || null;
            propertyAddress = property.address || null;
            propertyType = property.type || null;

            // Fetch queries for this property
            const queriesResult = await databases.listDocuments(
              config.databaseId!,
              config.queriesCollectionId! || "queries",
              [
                Query.equal("referenceProperty", doc.propertyId),
                Query.equal("writer", user.name || user.email || ""),
                Query.orderDesc("$createdAt"),
              ],
            );

            queries = queriesResult.documents.map((q: any) => ({
              $id: q.$id,
              writer: q.writer,
              body: q.body,
              referenceProperty: q.referenceProperty,
              writerAvatar: q.writerAvatar,
              writerPhone: q.writerPhone,
              status: q.status || "pending",
              image1: q.image1,
              image2: q.image2,
              image3: q.image3,
              createdAt: q.$createdAt,
              reply: q.reply,
              replyCreatedAt: q.replyCreatedAt,
            }));
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
            rejectionReason: doc.rejectionReason || null,
            propertyImage,
            propertyAddress,
            propertyType,
            queries,
            // Fetch lease document fields (no URL)
            leaseDocumentId: doc.leaseDocumentId || null,
            leaseDocumentName: doc.leaseDocumentName || null,
            leaseSentAt: doc.leaseSentAt || null,
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
          label: "✅ Approved",
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

  const getQueryStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return { bg: "#F59E0B20", text: "#92400E", label: "⏳ Pending" };
      case "answered":
        return { bg: "#10B98120", text: "#065F46", label: "✅ Answered" };
      default:
        return { bg: "#6B728020", text: "#374151", label: "Unknown" };
    }
  };

  // Image picker for query
  const pickQueryImage = async () => {
    if (queryImages.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 images");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 3 - queryImages.length,
      });

      if (!result.canceled) {
        setQueryImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick images");
      console.error(error);
    }
  };

  const removeQueryImage = (index: number) => {
    setQueryImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Handle adding a query
  const handleAddQuery = (request: TenantRequest) => {
    if (!user?.accountId) return;

    setQueryRequestId(request.$id);
    setQueryPropertyId(request.propertyId);
    setQueryText("");
    setQueryImages([]);
    setQueryModalVisible(true);
  };

  // Handle viewing queries
  const handleViewQueries = (request: TenantRequest) => {
    setSelectedPropertyName(request.propertyName);
    setSelectedPropertyQueries(request.queries || []);
    setQueriesModalVisible(true);
  };

  const submitQuery = async () => {
    if (!queryText.trim()) {
      Alert.alert("Error", "Please enter your question");
      return;
    }

    if (!queryRequestId || !queryPropertyId || !user?.accountId) {
      Alert.alert("Error", "Missing required information");
      return;
    }

    setIsSubmittingQuery(true);
    setUploadingImages(true);

    try {
      // Upload images first if any
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < queryImages.length; i++) {
        const img = queryImages[i];
        try {
          console.log(
            `Uploading query image ${i + 1}/${queryImages.length}...`,
          );
          const imageUrl = await uploadImage(img);
          uploadedImageUrls.push(imageUrl);
        } catch (error) {
          console.error(`Failed to upload image ${i + 1}:`, error);
          Alert.alert("Error", `Failed to upload image ${i + 1}`);
          setUploadingImages(false);
          setIsSubmittingQuery(false);
          return;
        }
      }

      // Get the original request to get landlord/agent details
      const request = await databases.getDocument(
        config.databaseId!,
        config.requestsCollectionId!,
        queryRequestId,
      );

      // Get property details to get landlord/agent info
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        queryPropertyId,
      );

      // Determine who to send the query to (landlord or agent)
      const recipientId = property.creatorId || property.agent;

      if (!recipientId) {
        Alert.alert("Error", "Could not find landlord to send query to");
        return;
      }

      // Get user details for writer fields
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", user.accountId)],
      );

      const userDoc = userDocs.documents[0] || {};
      const writerName = userDoc.name || user.name || "Tenant";
      const writerAvatar = userDoc.avatar || user.avatar || "";
      const writerPhone = userDoc.phone || user.phone || "";

      // Create the query message with images
      await databases.createDocument(
        config.databaseId!,
        config.queriesCollectionId! || "queries",
        ID.unique(),
        {
          writer: writerName,
          body: queryText.trim(),
          referenceProperty: queryPropertyId,
          writerAvatar: writerAvatar,
          writerPhone: writerPhone,
          status: "pending",
          image1: uploadedImageUrls[0] || null,
          image2: uploadedImageUrls[1] || null,
          image3: uploadedImageUrls[2] || null,
        },
      );

      // Also create a notification for the landlord/agent
      await databases.createDocument(
        config.databaseId!,
        config.notificationsCollectionId!,
        ID.unique(),
        {
          userId: recipientId,
          title: "New Query from Tenant",
          message: `${writerName} has a question about "${property.propertyName}":\n\n"${queryText.trim()}"${uploadedImageUrls.length > 0 ? `\n\n📷 ${uploadedImageUrls.length} image(s) attached` : ""}`,
          type: "query",
          data: JSON.stringify({
            requestId: queryRequestId,
            propertyId: queryPropertyId,
            propertyName: property.propertyName,
            tenantId: user.accountId,
            tenantName: writerName,
            images: uploadedImageUrls,
          }),
          read: false,
        },
      );

      Alert.alert("Success", "Your question has been sent to the landlord");
      setQueryModalVisible(false);
      setQueryText("");
      setQueryImages([]);

      // Refresh requests to get the new query
      fetchRequests();
    } catch (error) {
      console.error("Error submitting query:", error);
      Alert.alert("Error", "Failed to send your question. Please try again.");
    } finally {
      setIsSubmittingQuery(false);
      setUploadingImages(false);
    }
  };

  // ✅ Render Lease Document Component with Preview & Download
const renderLeaseDocument = (request: TenantRequest) => {
  if (!request.leaseDocumentId) return null;

  return (
    <View
      className="rounded-2xl p-4 mt-4"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.primary[300] + "50",
      }}
    >
      <View className="flex-row items-center mb-3">
        <Ionicons name="document-text" size={24} color={theme.primary[300]} />
        <Text
          className="text-base font-rubik-bold ml-2"
          style={{ color: theme.title }}
        >
          Lease Document
        </Text>
      </View>

      <Text className="text-sm mb-2" style={{ color: theme.muted }}>
        {request.leaseDocumentName || "Lease Agreement"}
      </Text>

      <Text className="text-xs mb-3" style={{ color: theme.muted }}>
        Sent:{" "}
        {request.leaseSentAt
          ? new Date(request.leaseSentAt).toLocaleDateString()
          : "N/A"}
      </Text>

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        {/* ✅ Fixed Preview Button */}
        <TouchableOpacity
          onPress={() => handlePreviewLease(request.leaseDocumentId!)}
          className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.primary[300],
          }}
        >
          <Ionicons name="eye" size={20} color={theme.primary[300]} />
          <Text
            className="font-rubik-bold ml-2"
            style={{ color: theme.primary[300] }}
          >
            Preview
          </Text>
        </TouchableOpacity>

        {/* ✅ Download Button */}
        <TouchableOpacity
          onPress={() =>
            handleDownloadLease(
              request.leaseDocumentId!,
              request.leaseDocumentName || "lease_document.pdf",
            )
          }
          className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <Ionicons name="download" size={20} color="white" />
          <Text className="text-white font-rubik-bold ml-2">Download</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

  // Render Queries Modal
  const renderQueriesModal = () => (
    <Modal
      animationType="slide"
      transparent={false}
      visible={queriesModalVisible}
      onRequestClose={() => setQueriesModalVisible(false)}
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
            onPress={() => setQueriesModalVisible(false)}
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
            Queries for {selectedPropertyName}
          </Text>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
        >
          {selectedPropertyQueries.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Image
                source={icons.chat}
                className="w-16 h-16 opacity-30 mb-4"
                style={{ tintColor: theme.muted }}
              />
              <Text
                className="text-lg font-rubik-medium text-center"
                style={{ color: theme.text }}
              >
                No Queries Yet
              </Text>
              <Text
                className="text-sm text-center mt-2"
                style={{ color: theme.muted }}
              >
                Your questions will appear here once you ask the landlord.
              </Text>
            </View>
          ) : (
            selectedPropertyQueries.map((query, index) => {
              const queryStatus = getQueryStatusColor(query.status);

              return (
                <View
                  key={query.$id}
                  className="rounded-2xl mb-4 overflow-hidden"
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 1,
                    borderColor: theme.muted + "30",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                    elevation: 1,
                  }}
                >
                  {/* Query Header */}
                  <View
                    className="flex-row items-center justify-between p-4 border-b"
                    style={{ borderBottomColor: theme.muted + "20" }}
                  >
                    <View className="flex-row items-center">
                      {query.writerAvatar ? (
                        <Image
                          source={{ uri: query.writerAvatar }}
                          className="w-8 h-8 rounded-full mr-2"
                        />
                      ) : (
                        <View
                          className="w-8 h-8 rounded-full items-center justify-center mr-2"
                          style={{ backgroundColor: theme.primary[100] }}
                        >
                          <Text
                            className="font-rubik-bold text-sm"
                            style={{ color: theme.primary[300] }}
                          >
                            {query.writer.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View>
                        <Text
                          className="font-rubik-bold text-sm"
                          style={{ color: theme.title }}
                        >
                          {query.writer}
                        </Text>
                        <Text
                          className="text-xs"
                          style={{ color: theme.muted }}
                        >
                          {formatDate(query.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View
                      className="px-2 py-1 rounded-full"
                      style={{ backgroundColor: queryStatus.bg }}
                    >
                      <Text
                        className="text-xs font-rubik-medium"
                        style={{ color: queryStatus.text }}
                      >
                        {queryStatus.label}
                      </Text>
                    </View>
                  </View>

                  {/* Query Body */}
                  <View className="p-4">
                    <Text
                      className="text-base leading-5"
                      style={{ color: theme.text }}
                    >
                      {query.body}
                    </Text>

                    {/* Query Images */}
                    {(query.image1 || query.image2 || query.image3) && (
                      <View className="flex-row flex-wrap gap-2 mt-3">
                        {query.image1 && (
                          <Image
                            source={{ uri: query.image1 }}
                            className="w-20 h-20 rounded-lg"
                            resizeMode="cover"
                          />
                        )}
                        {query.image2 && (
                          <Image
                            source={{ uri: query.image2 }}
                            className="w-20 h-20 rounded-lg"
                            resizeMode="cover"
                          />
                        )}
                        {query.image3 && (
                          <Image
                            source={{ uri: query.image3 }}
                            className="w-20 h-20 rounded-lg"
                            resizeMode="cover"
                          />
                        )}
                      </View>
                    )}

                    {/* Reply from landlord */}
                    {query.reply && (
                      <View
                        className="mt-3 p-3 rounded-xl"
                        style={{
                          backgroundColor: theme.primary[100],
                          borderWidth: 1,
                          borderColor: theme.primary[200],
                        }}
                      >
                        <Text
                          className="text-xs font-rubik-bold mb-1"
                          style={{ color: theme.primary[300] }}
                        >
                          Landlord's Reply:
                        </Text>
                        <Text className="text-sm" style={{ color: theme.text }}>
                          {query.reply}
                        </Text>
                        {query.replyCreatedAt && (
                          <Text
                            className="text-xs mt-1"
                            style={{ color: theme.muted }}
                          >
                            {formatDate(query.replyCreatedAt)}
                          </Text>
                        )}
                      </View>
                    )}

                    {/* Lease Document Section */}
                    {selectedRequest && renderLeaseDocument(selectedRequest)}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

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
              <Text
                className="font-rubik-bold"
                style={{ color: statusColor.text }}
              >
                {statusColor.label}
              </Text>
            </View>

            {/* Status message for accepted */}
            {selectedRequest.status === "accepted" && (
              <View
                className="rounded-2xl p-4 mb-4 flex-row items-center"
                style={{
                  backgroundColor: "#10B98115",
                  borderWidth: 1,
                  borderColor: "#10B98130",
                }}
              >
                <Text className="text-2xl mr-3">🎉</Text>
                <View className="flex-1">
                  <Text className="font-rubik-bold text-green-700 text-base">
                    Approved!
                  </Text>
                  <Text className="text-green-600 text-sm mt-1">
                    Your request has been approved. The landlord will contact
                    you soon.
                  </Text>
                </View>
              </View>
            )}

            {/* Show rejection reason if rejected */}
            {selectedRequest.status === "rejected" &&
              selectedRequest.rejectionReason && (
                <View
                  className="rounded-2xl p-4 mb-4"
                  style={{
                    backgroundColor: "#EF444415",
                    borderWidth: 1,
                    borderColor: "#EF444430",
                  }}
                >
                  <Text
                    className="text-sm font-rubik-bold mb-2"
                    style={{ color: "#EF4444" }}
                  >
                    Rejection Reason
                  </Text>
                  <Text
                    className="text-sm italic"
                    style={{ color: theme.text }}
                  >
                    {selectedRequest.rejectionReason}
                  </Text>
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
                  {selectedRequest.propertyName}
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
                Price Details
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
                    $
                    {selectedRequest.proposedPrice ||
                      selectedRequest.originalPrice}
                    /month
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
                  Move-in & Lease
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

            {/* Lease Document Section */}
            {renderLeaseDocument(selectedRequest)}

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

  // Render Query Modal with Image Upload
  const renderQueryModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={queryModalVisible}
      onRequestClose={() => {
        setQueryModalVisible(false);
        setQueryImages([]);
        setQueryText("");
      }}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.background,
            maxHeight: "85%",
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Write a complaint or ask a question
            </Text>
            <TouchableOpacity
              onPress={() => {
                setQueryModalVisible(false);
                setQueryImages([]);
                setQueryText("");
              }}
            >
              <Text style={{ color: theme.text, fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text className="text-sm mb-4" style={{ color: theme.muted }}>
              Tell the landlord any issue you have about the property.
            </Text>

            <View
              className="rounded-xl p-4 mb-4"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <Text
                className="text-sm font-rubik-medium mb-2"
                style={{ color: theme.title }}
              >
                Your Query or complaint
              </Text>
              <TextInput
                value={queryText}
                onChangeText={setQueryText}
                placeholder="e.g., Is parking available? When can I view the property?"
                placeholderTextColor={theme.muted}
                multiline
                numberOfLines={4}
                className="text-base"
                style={{
                  color: theme.text,
                  minHeight: 100,
                  textAlignVertical: "top",
                }}
                autoFocus
              />
            </View>

            {/* Image Upload Section */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-2"
                style={{ color: theme.text }}
              >
                Attach Images (max 3, optional)
              </Text>

              {queryImages.length < 3 && (
                <TouchableOpacity
                  onPress={pickQueryImage}
                  className="py-4 rounded-lg border-2 border-dashed mb-3 items-center justify-center"
                  style={{
                    borderColor: theme.muted + "50",
                    backgroundColor: theme.surface,
                  }}
                >
                  <Image
                    source={icons.camera}
                    className="w-6 h-6 mb-1"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="text-center text-sm font-rubik-medium"
                    style={{ color: theme.muted }}
                  >
                    {queryImages.length === 0
                      ? "Tap to upload images"
                      : `Add more images (${queryImages.length}/3)`}
                  </Text>
                  <Text
                    className="text-center text-xs mt-0.5"
                    style={{ color: theme.muted + "60" }}
                  >
                    JPG, PNG supported
                  </Text>
                </TouchableOpacity>
              )}

              {/* Image Previews */}
              {queryImages.length > 0 && (
                <View>
                  <Text
                    className="text-xs font-rubik-medium mb-2"
                    style={{ color: theme.muted }}
                  >
                    Selected Images:
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {queryImages.map((img, idx) => (
                      <View key={idx} className="relative">
                        <Image
                          source={{ uri: img.uri }}
                          className="w-20 h-20 rounded-lg border"
                          style={{ borderColor: theme.muted + "50" }}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          onPress={() => removeQueryImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full w-5 h-5 items-center justify-center shadow-md"
                        >
                          <Text className="text-white font-bold text-xs">
                            ×
                          </Text>
                        </TouchableOpacity>
                        <View className="absolute bottom-1 left-1 bg-black/60 px-1.5 py-0.5 rounded">
                          <Text className="text-white text-[8px] font-rubik">
                            #{idx + 1}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {queryImages.length === 3 && (
                <View
                  className="mt-1 py-1.5 px-3 rounded-lg"
                  style={{ backgroundColor: theme.primary[100] }}
                >
                  <Text
                    className="text-[10px] text-center"
                    style={{ color: theme.primary[300] }}
                  >
                    Maximum 3 images reached
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row gap-3 mb-4">
              <TouchableOpacity
                onPress={() => {
                  setQueryModalVisible(false);
                  setQueryImages([]);
                  setQueryText("");
                }}
                className="flex-1 py-3 rounded-xl border"
                style={{
                  borderColor: theme.muted + "30",
                  backgroundColor: theme.surface,
                }}
              >
                <Text
                  className="text-center font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitQuery}
                disabled={
                  isSubmittingQuery || !queryText.trim() || uploadingImages
                }
                className="flex-1 py-3 rounded-xl"
                style={{
                  backgroundColor:
                    isSubmittingQuery || !queryText.trim() || uploadingImages
                      ? theme.muted
                      : theme.primary[300],
                }}
              >
                <Text className="text-white text-center font-rubik-bold">
                  {isSubmittingQuery || uploadingImages
                    ? "Sending..."
                    : "Send Question"}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (!isTenant) {
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
          Tenant Access Only
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
            <Text className="text-xs text-green-600">Approved</Text>
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
            <Text className="text-white font-rubik-bold">
              Explore Properties
            </Text>
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
            const hasQueries = item.queries && item.queries.length > 0;

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
                        <Text className="text-sm" style={{ color: theme.text }}>
                          {item.moveInDate}
                        </Text>
                      </View>
                    )}

                    <Text className="text-xs" style={{ color: theme.muted }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View className="flex-row gap-2 mt-3">
                    {/* Add Query Button - Only for accepted/approved requests */}
                    {item.status === "accepted" && (
                      <TouchableOpacity
                        onPress={() => handleAddQuery(item)}
                        className="flex-1 py-2 px-3 rounded-full flex-row items-center justify-center"
                        style={{
                          backgroundColor: theme.primary[100],
                          borderWidth: 1,
                          borderColor: theme.primary[300],
                        }}
                      >
                        <Text
                          className="font-rubik-bold text-sm"
                          style={{ color: theme.primary[300] }}
                        >
                          Add Query
                        </Text>
                      </TouchableOpacity>
                    )}

                    {/* View Queries Button - Show if there are queries */}
                    {hasQueries && (
                      <TouchableOpacity
                        onPress={() => handleViewQueries(item)}
                        className="flex-1 py-2 px-3 rounded-full flex-row items-center justify-center"
                        style={{
                          backgroundColor: theme.primary[100],
                          borderWidth: 1,
                          borderColor: theme.primary[300],
                        }}
                      >
                        <Text
                          className="font-rubik-bold text-sm"
                          style={{ color: theme.primary[300] }}
                        >
                          View Queries ({item.queries?.length || 0})
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {renderDetailsModal()}
      {renderQueryModal()}
      {renderQueriesModal()}
    </SafeAreaView>
  );
}