// app/properties/[id].tsx
import ErrorModal from "@/components/ErrorModal";
import OperationSuccesfull from "@/components/OperationSuccesfull";
import ConfirmationModal from "@/components/ConfirmationModal";
import { RequestData, RequestModal } from "@/components/RequestModal";
import ReviewSuccessModal from "@/components/ReviewSuccessModal";
import { facilities, getAvatarSource } from "@/constants/data";
import icons from "@/constants/icons";
import {
  addReview,
  checkUserLiked,
  config,
  databases,
  deleteProperty,
  getLikeCount,
  getPropertyById,
  incrementPropertyViews,
  requestProperty,
  toggleLike,
} from "@/lib/appwrite";
import { LinearGradient } from "expo-linear-gradient";
import { Query } from "react-native-appwrite";

import { Colors } from "@/constants/Colors";
import {
  addToFavorites,
  isFavorite,
  removeFromFavorites,
} from "@/lib/localFavorites";
import { useAppwrite } from "@/lib/useAppwrite";
import useAuthStore from "@/store/auth.store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// ============================================================================
// TYPES
// ============================================================================
export interface PropertyData {
  $id: string;
  propertyName?: string;
  type: string;
  description: string;
  address: string;
  price: number;
  area: number;
  rating: number;
  views: number;
  bedrooms: number;
  bathrooms: number;
  facilities: string | string[] | object;
  image1?: string;
  image2?: string;
  image3?: string;
  agent?: {
    $id: string;
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  };
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  creatorAvatar?: string;
  reviews?: string; // This is a JSON string in the database
  isAvailable?: boolean;
  creatorId?: string;
}

interface Review {
  id: string;
  userName: string;
  userAvatar: string | null;
  review: string;
  rating: number;
  date: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const Property = () => {
  // ============================================================================
  // HOOKS & STATE
  // ============================================================================
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user } = useAuthStore();
  const windowHeight = Dimensions.get("window").height;
  const [isFav, setIsFav] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const scale = useSharedValue(1);
  const viewRecorded = useRef(false);

  // Fetch property data
  const {
    data: property,
    loading,
    refetch,
  } = useAppwrite({
    fn: getPropertyById,
    params: { id: id! },
  }) as {
    data: PropertyData | null;
    loading: boolean;
    refetch: (params?: any) => Promise<void>;
  };

  // ============================================================================
  // REVIEWS STATE
  // ============================================================================
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewText, setReviewText] = useState("");
  const [rating, setRating] = useState(5);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestModalLoading, setRequestModalLoading] = useState(false);

  // ============================================================================
  // LIKE STATE
  // ============================================================================
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  // ============================================================================
  // EDIT MODAL STATE
  // ============================================================================
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({
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
  const [savingEdit, setSavingEdit] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [editFacilitiesModalVisible, setEditFacilitiesModalVisible] =
    useState(false);
  const [editSelectedFacilities, setEditSelectedFacilities] = useState<
    string[]
  >([]);
  const [errorMessage, setErrorMessage] = useState("");

  // ============================================================================
  // OTHER STATE
  // ============================================================================
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [agentData, setAgentData] = useState<any>(null);
  const [loadingAgent, setLoadingAgent] = useState(false);
  const [confirmationModalVisible, setConfirmationModalVisible] =
    useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState<string | null>(null);
  const [operationSuccessVisible, setOperationSuccessVisible] = useState(false);
  const [operationSuccessConfig, setOperationSuccessConfig] = useState({
    title: "",
    message: "",
  });
  const [errorModalConfig, setErrorModalConfig] = useState({
    title: "",
    message: "",
  });

  // Check if current user owns this property
  const isLandlordOwner =
    user?.userMode === "landlord" && property?.creatorId === user?.accountId;
  useEffect(() => {
    const backAction = () => {
      // Customize what happens when back button is pressed
      // You can prevent navigation or show an alert
      console.log("Back button pressed");

      router.replace(
        user?.userMode === "landlord" ? "/landHome" : "/tenantHome",
      );
      return true; // Prevent default
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      backAction,
    );

    return () => backHandler.remove();
  }, [user]);
  useEffect(() => {
    const checkFavorite = async () => {
      if (property) {
        const fav = await isFavorite(property.$id);
        setIsFav(fav);
      }
    };

    checkFavorite();
  }, [property]);

  // ============================================================================
  // EDIT FUNCTIONS
  // ============================================================================
  const openEditModal = () => {
    const currentFacilities = property?.facilities
      ? typeof property.facilities === "string"
        ? property.facilities.split(",").map((f) => f.trim())
        : Array.isArray(property.facilities)
          ? property.facilities
          : []
      : [];
    setEditSelectedFacilities(currentFacilities);

    if (!property) return;
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
  const [hasRequested, setHasRequested] = useState(false);
  const [requestStatus, setRequestStatus] = useState<
    "none" | "pending" | "accepted" | "rejected"
  >("none");

  useEffect(() => {
    const checkRequestStatus = async () => {
      if (!property || !user?.accountId) return;

      try {
        // Check if user has already requested this property
        const requestsResult = await databases.listDocuments(
          config.databaseId!,
          config.requestsCollectionId!,
          [
            Query.equal("propertyId", property.$id),
            Query.equal("tenantId", user.accountId),
            Query.limit(1),
          ],
        );

        if (requestsResult.documents.length > 0) {
          const status = requestsResult.documents[0].status;
          setRequestStatus(status);
          setHasRequested(status !== "rejected"); // Only disable if not rejected
        }
      } catch (error) {
        console.error("Error checking request status:", error);
      }
    };

    checkRequestStatus();
  }, [property, user]);

  // Check if user has already requested this property when it loads
  useEffect(() => {
    const checkIfRequested = async () => {
      if (!property || !user?.accountId) return;

      try {
        const applicationsKey = `user_applications_${user.accountId}`;
        const stored = await AsyncStorage.getItem(applicationsKey);
        if (stored) {
          const applications = JSON.parse(stored);
          const alreadyRequested = applications.some(
            (app: any) => app.propertyId === property.$id,
          );
          setHasRequested(alreadyRequested);
        }
      } catch (error) {
        console.error("Error checking request status:", error);
      }
    };

    checkIfRequested();
  }, [property, user]);
  const toggleAvailability = () => {
    setEditForm({ ...editForm, isAvailable: !editForm.isAvailable });
  };

  const handleSaveEdit = async () => {
    if (!property) return;

    if (!editForm.propertyName.trim() || !editForm.price.trim()) {
      setErrorModalConfig({
        title: "Validation Error",
        message: "Property name and price are required",
      });
      setErrorModalVisible(true);
      return;
    }

    setSavingEdit(true);
    try {
      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        property.$id,
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
          facilities: editSelectedFacilities.join(", "),
        },
      );

      await refetch({ id: property.$id });

      setOperationSuccessConfig({
        title: "Success",
        message: "Property updated successfully!",
      });
      setOperationSuccessVisible(true);
      closeEditModal();
    } catch (error) {
      console.error("Error updating property:", error);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to update property. Please try again.",
      });
      setErrorModalVisible(true);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSendDetailedRequest = async (data: RequestData) => {
    if (!property || !user?.accountId) return;

    setRequestModalLoading(true);
    try {
      await requestProperty(property.$id, user.accountId, {
        proposedPrice: data.proposedPrice,
        message: data.message,
        moveInDate: data.moveInDate,
        leaseDuration: data.leaseDuration,
        questions: data.questions,
        originalPrice: property.price,
        propertyName: property.propertyName,
        tenantName: user.name,
        tenantEmail: user.email,
        tenantAvatar: user.avatar ?? "",
      });

      setHasRequested(true);
      setRequestStatus("pending");
      setShowRequestModal(false);

      setOperationSuccessConfig({
        title: "Request Sent!",
        message:
          "Your rental request has been sent to the landlord. You'll be notified when they respond.",
      });
      setOperationSuccessVisible(true);
    } catch (error) {
      console.error("Error sending request:", error);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to send request. Please try again.",
      });
      setErrorModalVisible(true);
    } finally {
      setRequestModalLoading(false);
    }
  };

  const handleFavoriteToggle = async () => {
    if (!property) return;

    try {
      if (isFav) {
        await removeFromFavorites(property.$id);
        setIsFav(false);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        setOperationSuccessConfig({
          title: "Removed",
          message: `${property.propertyName || "Property"} removed from favorites`,
        });
        setOperationSuccessVisible(true);
      } else {
        const favoriteProperty = {
          $id: property.$id,
          propertyName: property.propertyName,
          type: property.type,
          address: property.address,
          price: property.price,
          image1: property.image1,
          image2: property.image2,
          image3: property.image3,
          rating: property.rating,
          views: property.views,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          facilities: property.facilities,
          creatorId: property.creatorId,
          creatorName: property.agent?.name,
          creatorEmail: property.agent?.email,
          creatorPhone: property.agent?.phone,
          creatorAvatar: property.agent?.avatar,
        };

        await addToFavorites(favoriteProperty);
        setIsFav(true);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setOperationSuccessConfig({
          title: "Added",
          message: `${property.propertyName || "Property"} saved to favorites`,
        });
        setOperationSuccessVisible(true);
      }
      console.log("FULL PROPERTY:", property);
      console.log("Creator Name:", property.creatorName);
      console.log("Creator Email:", property.creatorEmail);
    } catch (error) {
      console.error("Error toggling favorite:", error);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to update favorites. Please try again.",
      });
      setErrorModalVisible(true);
    }
  };

  // ============================================================================
  // LOAD REVIEWS WHEN PROPERTY LOADS
  // ============================================================================
  useEffect(() => {
    if (property?.reviews) {
      try {
        // Parse the JSON string from database into an array
        const parsedReviews = JSON.parse(property.reviews);
        setReviews(parsedReviews);
        console.log("✅ Reviews loaded:", parsedReviews.length);
      } catch (e) {
        console.log("No reviews or error parsing:", e);
        setReviews([]);
      }
    } else {
      setReviews([]);
    }
  }, [property]);

  // ============================================================================
  // CHECK LIKE STATUS WHEN PROPERTY LOADS
  // ============================================================================
  useEffect(() => {
    const checkLikeStatus = async () => {
      if (property && user?.accountId) {
        try {
          const userLiked = await checkUserLiked(property.$id, user.accountId);
          const count = await getLikeCount(property.$id);
          setLiked(userLiked);
          setLikeCount(count);
        } catch (error) {
          console.error("Error checking like status:", error);
        }
      }
    };

    checkLikeStatus();
  }, [property, user]);

  useEffect(() => {
    if (property && user?.userMode === "tenant" && !viewRecorded.current) {
      viewRecorded.current = true;

      // Increment DB views with 24-hour cooldown
      incrementPropertyViews(property.$id, user.accountId).catch(console.error);

      // Record local view for stats (unique properties - one time only)
      const recordLocalView = async () => {
        const key = `user_viewed_properties_${user.accountId}`;
        const stored = await AsyncStorage.getItem(key);
        let viewed = stored ? JSON.parse(stored) : [];
        if (!viewed.includes(property.$id)) {
          viewed.push(property.$id);
          await AsyncStorage.setItem(key, JSON.stringify(viewed));
          console.log(
            `✅ Property ${property.$id} added to user's unique viewed list`,
          );
        } else {
          console.log(
            `📌 Property ${property.$id} already in unique viewed list`,
          );
        }
      };
      recordLocalView().catch(console.error);
    }
  }, [property, user]);

  // ============================================================================
  // LOAD AGENT WHEN PROPERTY LOADS
  // ============================================================================
  useEffect(() => {
    const fetchAgent = async () => {
      if (property?.agent && typeof property.agent === "string") {
        setLoadingAgent(true);
        try {
          const agent = await databases.getDocument(
            config.databaseId!,
            config.usersCollectionId!,
            property.agent,
          );
          setAgentData(agent);
        } catch (error) {
          console.error("Error fetching agent:", error);
          setAgentData(null);
        } finally {
          setLoadingAgent(false);
        }
      }
    };

    fetchAgent();
  }, [property?.agent]);


  // Inside the Property component
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!property || user?.userMode !== "tenant") return;

    let isActive = true;

    const recordView = async () => {
      if (!isActive) return;

      const storageKey = `property_view_${user.accountId}_${property.$id}`;
      const lastViewStr = await AsyncStorage.getItem(storageKey);
      const lastView = lastViewStr ? parseInt(lastViewStr, 10) : 0;
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;

      if (now - lastView >= oneDay) {
        await incrementPropertyViews(property.$id);
        await AsyncStorage.setItem(storageKey, now.toString());

        // Update the tenant's unique viewed properties list
        const statsKey = `user_viewed_properties_${user.accountId}`;
        const stored = await AsyncStorage.getItem(statsKey);
        let viewed = stored ? JSON.parse(stored) : [];
        if (!viewed.includes(property.$id)) {
          viewed.push(property.$id);
          await AsyncStorage.setItem(statsKey, JSON.stringify(viewed));
        }

        console.log(`✅ View counted for ${property.propertyName}`);
      } else {
        console.log(
          `⏭️ View not counted (within 24h) for ${property.propertyName}`,
        );
      }
    };

    // Start a 10-second timer
    viewTimer.current = setTimeout(() => {
      recordView();
    }, 10000);

    return () => {
      isActive = false;
      if (viewTimer.current) clearTimeout(viewTimer.current);
    };
  }, [property, user]);

  const [reviewSuccessVisible, setReviewSuccessVisible] = useState(false);
  const handleAddReview = async () => {
    if (!property || !reviewText.trim() || user?.userMode !== "tenant") return;

    try {
      await addReview(property.$id, reviewText, rating);

      const updatedProperty = await getPropertyById({ id: property.$id });
      if (updatedProperty?.reviews) {
        try {
          const parsedReviews = JSON.parse(updatedProperty.reviews);
          setReviews(parsedReviews);
        } catch (e) {
          setReviews([]);
        }
      }

      setReviewText("");
      setRating(5);
      setReviewSuccessVisible(true);
    } catch (err) {
      console.error("Error adding review:", err);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to add review. Please try again.",
      });
      setErrorModalVisible(true);
    }
  };

  // ============================================================================
  // HANDLE LIKE/UNLIKE - ONLY LIKES, DOESN'T AFFECT FAVORITES
  // ============================================================================
  const handleLike = async () => {
    if (!property || !user?.accountId || user?.userMode !== "tenant") return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      scale.value = 1.3;
      scale.value = withSpring(1, {
        damping: 4,
        stiffness: 200,
      });

      const result = await toggleLike(property.$id, user.accountId);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch (err) {
      console.error("Error toggling like:", err);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to update like. Please try again.",
      });
      setErrorModalVisible(true);
    }
  };

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  const getPropertyImages = (): string[] => {
    if (!property) return [];
    return [property.image1, property.image2, property.image3].filter(
      (img): img is string => Boolean(img),
    );
  };

  const normalizeFacilities = (): string[] => {
    if (!property?.facilities) return [];

    const facilities_data = property.facilities;

    if (Array.isArray(facilities_data)) {
      return facilities_data;
    }

    if (typeof facilities_data === "string") {
      try {
        const parsed = JSON.parse(facilities_data);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return facilities_data.includes(",")
          ? facilities_data.split(",").map((i) => i.trim())
          : [facilities_data];
      }
    }

    if (typeof facilities_data === "object") {
      return Object.values(facilities_data);
    }

    return [];
  };

  const calculateAverageRating = (): string => {
    if (!reviews || reviews.length === 0) return "0.0";
    const sum = reviews.reduce((acc, rev) => acc + (rev.rating || 0), 0);
    return (sum / reviews.length).toFixed();
  };

  // ============================================================================
  // OTHER HANDLERS
  // ============================================================================

  const confirmDeleteProperty = async () => {
    if (!propertyToDelete) return;

    setDeleting(true);
    setConfirmationModalVisible(false);

    try {
      await deleteProperty(propertyToDelete);
      setOperationSuccessConfig({
        title: "Success",
        message: "Property deleted successfully",
      });
      setOperationSuccessVisible(true);
      setTimeout(() => router.replace("/landHome"), 1500);
    } catch (error) {
      console.error("Error deleting property:", error);
      setErrorModalConfig({
        title: "Error",
        message: "Failed to delete property",
      });
      setErrorModalVisible(true);
      setDeleting(false);
    }
  };

  const handleDeleteProperty = () => {
    if (!property) return;
    setPropertyToDelete(property.$id);
    setConfirmationModalVisible(true);
  };

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (!navigation.canGoBack()) {
        e.preventDefault();

        router.replace(
          user?.userMode === "landlord" ? "/landHome" : "/tenantHome",
        );
      }
    });

    return unsubscribe;
  }, [navigation, user]);

  const handleImageNavigation = (direction: "prev" | "next") => {
    const images = getPropertyImages();
    if (images.length === 0) return;

    if (direction === "prev") {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    } else {
      setCurrentImageIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    }
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================
  const renderImageGallery = () => {
    const propertyImages = getPropertyImages();
    const mainImage =
      propertyImages[currentImageIndex] || property?.image1 || "";

    return (
      <View
        className="relative w-full"
        style={{
          height: windowHeight / 2,
          backgroundColor: theme.navBackground,
        }}
      >
        {/* Main Image */}
        {mainImage ? (
          <Image
            source={{ uri: mainImage }}
            className="size-full"
            resizeMode="cover"
          />
        ) : (
          <View
            className="size-full items-center justify-center"
            style={{ backgroundColor: theme.navBackground }}
          >
            <Image source={icons.info} className="size-12 opacity-30" />
            <Text className="text-gray-400 mt-2">No image available</Text>
          </View>
        )}

        {/* Views Count Badge - Top Left */}
        {property?.views !== undefined && property.views > 0 && (
          <View
            className="absolute top-12 right-4 z-50 flex-row items-center bg-black/60 px-3 py-1.5 rounded-full"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 2,
            }}
          >
            <Image
              source={icons.eye}
              className="w-8 h-8 mr-1"
              style={{ tintColor: "#FFFFFF" }}
            />
            <Text className="text-white font-rubik-medium text-sm">
              {property.views}
            </Text>
          </View>
        )}

        {/* Dark Gradient Overlay at Top for Better Button Visibility */}
        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "rgba(0,0,0,0.7)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 180,
            zIndex: 40,
          }}
        />

        {/* Top bar with Back button */}
        <View
          className="z-50 absolute inset-x-7"
          style={{ top: Platform.OS === "ios" ? 70 : 20 }}
        >
          <View className="flex flex-row items-center w-full justify-between">
            <TouchableOpacity
              onPress={() => {
                router.replace(
                  user?.userMode === "landlord" ? "/landHome" : "/tenantHome",
                );
              }}
              className="flex flex-row rounded-full mt-5 px-5 py-2 items-center justify-center"
              style={{
                backgroundColor: "#FF4B33", // Orange-500
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3,
                elevation: 3,
              }}
            >
              <Text className="text-white font-rubik-bold text-base">Back</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Image Gallery Controls */}
        {propertyImages.length > 1 && (
          <>
            {/* Navigation Arrows - Middle Left & Right */}
            <TouchableOpacity
              onPress={() => handleImageNavigation("prev")}
              className="absolute left-3 bg-black/60 rounded-full p-2 z-50"
              style={{ top: "50%", marginTop: -18 }}
            >
              <Image
                source={icons.backArrow}
                className="size-5"
                style={{ tintColor: "white" }}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleImageNavigation("next")}
              className="absolute right-3 bg-black/60 rounded-full p-2 z-50"
              style={{ top: "50%", marginTop: -18 }}
            >
              <Image
                source={icons.rightArrow}
                className="size-5"
                style={{ tintColor: "white" }}
              />
            </TouchableOpacity>

            {/* Image Dots - Bottom Center */}
            <View className="absolute bottom-4 flex-row justify-center w-full z-50">
              {propertyImages.map((_, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => setCurrentImageIndex(index)}
                  className={`mx-1 rounded-full ${
                    currentImageIndex === index
                      ? "w-6 h-2 bg-white"
                      : "w-2 h-2 bg-white/50"
                  }`}
                />
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  const renderTenantView = () => {
    if (!property) return null;

    const propertyImages = getPropertyImages();
    const facilityList = normalizeFacilities();
    const avgRating = calculateAverageRating();

    // Get creator info (landlord/agent)
    const creator = property.agent || {
      name: property.creatorName || "Property Owner",
      email: property.creatorEmail || "Not available",
      phone: property.creatorPhone || "Not available",
      avatar: property.creatorAvatar || null,
    };

    return (
      <>
        {/* Property details */}
        <View
          className="px-5 mt-7 gap-2"
          style={{ backgroundColor: theme.navBackground }}
        >
          <Text
            className="text-2xl font-rubik-extrabold"
            style={{ color: theme.title }}
          >
            {property.propertyName || "Property"}
          </Text>

          {/* Type + Rating */}
          <View className="flex flex-row items-center justify-between gap-3">
            <View className="flex flex-row items-center gap-3">
              <View className="flex flex-row items-center px-4 py-2 bg-primary-100 rounded-full">
                <Text className="text-xs font-rubik-bold text-primary-300">
                  {property.type}
                </Text>
              </View>
              <Image source={icons.star} className="size-3.5" />
              <Text className="text-black-200 text-sm mt-1 font-rubik-medium">
                {avgRating}
              </Text>
            </View>

            {/* REQUEST BUTTON */}
            <TouchableOpacity
              onPress={() => setShowRequestModal(true)}
              disabled={
                requesting || (hasRequested && requestStatus !== "rejected")
              }
              className={`px-4 py-2 rounded-full ${
                requestStatus === "accepted"
                  ? "bg-green-500"
                  : requestStatus === "pending"
                    ? "bg-yellow-500"
                    : requestStatus === "rejected"
                      ? "bg-orange-500"
                      : requesting
                        ? "bg-gray-400"
                        : "bg-orange-500"
              }`}
            >
              <Text className="text-white font-rubik-medium text-sm">
                {requestStatus === "accepted"
                  ? "Accepted"
                  : requestStatus === "pending"
                    ? "Pending"
                    : requestStatus === "rejected"
                      ? "Try Again"
                      : requesting
                        ? "Requesting..."
                        : "Request to Rent"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Beds, Baths, Area */}
          <View className="flex flex-row items-center mt-5">
            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10">
              <Image source={icons.bed} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.title }}
            >
              {property.bedrooms || 0} Beds
            </Text>

            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10 ml-7">
              <Image source={icons.bath} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.title }}
            >
              {property.bathrooms || 0} Baths
            </Text>

            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10 ml-7">
              <Image source={icons.area} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.title }}
            >
              {property.area || 0} sqm
            </Text>
          </View>

          {/* ======================================== */}
          {/* CREATOR/LANDLORD INFO SECTION */}
          {/* ======================================== */}
          <View className="mt-6">
            <Text
              className="text-xl font-rubik-bold mb-3"
              style={{ color: theme.title }}
            >
              {(property.agent as any)?.isOrganization
                ? "About the Organization"
                : "About the Landlord"}
            </Text>

            <View
              className="rounded-xl p-4 flex-row items-start"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              {/* Avatar */}
              <Image
                source={
                  creator.avatar
                    ? creator.avatar.startsWith("http")
                      ? { uri: creator.avatar }
                      : getAvatarSource(creator.avatar)
                    : icons.person
                }
                className="w-14 h-14 rounded-full mr-4"
                style={{
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              />

              {/* Info */}
              <View className="flex-1">
                <Text
                  className="text-lg font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  {creator.name}
                </Text>

                <View className="flex-row items-center mt-2">
                  <Image
                    source={icons.mail}
                    className="w-4 h-4 mr-2"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="text-sm font-rubik"
                    style={{ color: theme.muted }}
                  >
                    {creator.email}
                  </Text>
                </View>

                {creator.phone && creator.phone !== "Not available" && (
                  <View className="flex-row items-center mt-1">
                    <Image
                      source={icons.phone}
                      className="w-4 h-4 mr-2"
                      style={{ tintColor: theme.muted }}
                    />
                    <Text
                      className="text-sm font-rubik"
                      style={{ color: theme.muted }}
                    >
                      {creator.phone}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Overview */}
          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Overview
            </Text>
            <Text
              className="text-black-200 text-base font-rubik mt-2"
              style={{ color: theme.title }}
            >
              {property.description || "No description available"}
            </Text>
          </View>

          {/* Facilities */}
          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Facilities
            </Text>

            {facilityList.length > 0 ? (
              <View className="mt-2">
                {/* Grid Container - 3 items per row */}
                <View className="flex-row flex-wrap -mx-1">
                  {facilityList.map((item, index) => {
                    const facility = facilities.find(
                      (f) => f.title === item,
                    ) as
                      | { title: string; icon: any; color?: string }
                      | undefined;
                    const colors = [
                      "#3B82F6",
                      "#10B981",
                      "#F59E0B",
                      "#EF4444",
                      "#8B5CF6",
                      "#EC4899",
                    ];
                    const iconColor =
                      facility?.color || colors[index % colors.length];

                    return (
                      <View key={index} className="w-1/3 px-1 mb-3">
                        <View
                          className="rounded-xl p-3 items-center"
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
                          <View
                            className="size-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: iconColor + "20",
                            }}
                          >
                            <Image
                              source={facility ? facility.icon : icons.info}
                              className="size-6"
                              style={{ tintColor: iconColor }}
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            className="text-sm text-center font-rubik mt-1.5"
                            style={{ color: theme.text }}
                          >
                            {item}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text
                className="text-base font-rubik mt-2"
                style={{ color: theme.muted }}
              >
                No facilities listed
              </Text>
            )}
          </View>

          {/* Thumbnail Gallery */}
          {propertyImages.length > 1 && (
            <View className="mt-7">
              <Text
                className="text-black-300 text-xl font-rubik-bold mb-3"
                style={{ color: theme.title }}
              >
                All Photos
              </Text>
              <FlatList
                data={propertyImages}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => setCurrentImageIndex(index)}
                    className="mr-3"
                  >
                    <Image
                      source={{ uri: item }}
                      className="w-24 h-24 rounded-xl"
                    />
                    {index === currentImageIndex && (
                      <View className="absolute inset-0 bg-primary-300/30 rounded-xl border-2 border-primary-300" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Location */}
          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Location
            </Text>
            <View className="flex flex-row items-center mt-4 gap-2">
              <Image source={icons.location} className="w-7 h-7" />
              <Text
                className="text-black-200 text-sm font-rubik-medium"
                style={{ color: theme.title }}
              >
                {property.address || "Address not available"}
              </Text>
            </View>
          </View>

          {/* ======================================== */}
          {/* REVIEWS SECTION */}
          {/* ======================================== */}
          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.muted }}
            >
              {reviews.length} Reviews
            </Text>

            <TouchableOpacity
              onPress={() => setReviewsExpanded(!reviewsExpanded)}
              className="mt-2"
            >
              <Text className="text-primary-300 font-rubik-medium">
                {reviewsExpanded ? "Hide Reviews" : "Show Reviews"}
              </Text>
            </TouchableOpacity>

            {reviewsExpanded && (
              <View className="mt-3">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <View
                      key={rev.id}
                      className="mt-3 pb-3 border-b border-primary-100"
                      style={{ borderBottomColor: theme.muted + "30" }}
                    >
                      <View className="flex-row items-start">
                        <Image
                          source={
                            rev.userAvatar
                              ? rev.userAvatar.startsWith("http")
                                ? { uri: rev.userAvatar }
                                : getAvatarSource(rev.userAvatar)
                              : icons.person
                          }
                          className="w-10 h-10 rounded-full mr-3"
                          style={{
                            borderWidth: 1,
                            borderColor: theme.muted + "30",
                          }}
                        />

                        <View className="flex-1">
                          <View className="flex-row items-center justify-between">
                            <Text
                              className="font-rubik-bold text-base"
                              style={{ color: theme.title }}
                            >
                              {rev.userName}
                            </Text>
                            <View className="flex-row items-center">
                              <Text className="text-yellow-500 font-rubik-bold mr-1 text-sm">
                                {rev.rating}
                              </Text>
                              <Image source={icons.star} className="size-3.5" />
                            </View>
                          </View>
                          <Text
                            className="text-sm mt-2 leading-5"
                            style={{ color: theme.text }}
                          >
                            {rev.review}
                          </Text>
                          <Text
                            className="text-xs mt-2"
                            style={{ color: theme.muted }}
                          >
                            {new Date(rev.date).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <Text
                    className="text-gray-500 mt-2"
                    style={{ color: theme.muted }}
                  >
                    No reviews yet
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* ======================================== */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
            className="mt-7 mb-5"
          >
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Add a Review
            </Text>
            <TextInput
              value={reviewText}
              onChangeText={setReviewText}
              placeholder="Write your review..."
              className="border border-gray-300 rounded-xl p-3 mt-3"
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
              style={{ color: theme.text, backgroundColor: theme.surface }}
            />
            <View className="flex flex-row gap-3 mt-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Text
                    className="text-3xl"
                    style={{ color: rating >= star ? "#facc15" : "#9ca3af" }}
                  >
                    ★
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={handleAddReview}
              className="bg-primary-300 py-3 rounded-full mt-3"
            >
              <Text className="text-white text-center font-rubik-bold">
                Submit Review
              </Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </>
    );
  };

  const renderLandlordView = () => {
    if (!property) return null;

    const propertyImages = getPropertyImages();
    const facilityList = normalizeFacilities();
    const avgRating = calculateAverageRating();

    return (
      <>
        <View
          className="px-5 mt-7 gap-2 pb-10"
          style={{ backgroundColor: theme.navBackground }}
        >
          <View className="mb-2">
            <Text className="text-3xl font-rubik-bold text-primary-300">
              {property.propertyName}
            </Text>
          </View>

          {/* Edit Button for Landlord Owners */}
          {isLandlordOwner && (
            <TouchableOpacity
              onPress={openEditModal}
              className="bg-primary-300 py-2 px-4 rounded-full self-start mb-2 flex-row items-center"
            >
              <Image
                source={icons.edit}
                className="w-4 h-4 mr-2"
                style={{ tintColor: "#FFFFFF" }}
              />
              <Text className="text-white font-rubik-medium text-sm">
                Edit Property
              </Text>
            </TouchableOpacity>
          )}

          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.text }}
          >
            {property.type === "Boarding"
              ? `$${property.price} /head/room`
              : `$${property.price} /month`}
          </Text>

          <View className="flex flex-row items-center gap-3">
            <View className="flex flex-row items-center px-4 py-2 bg-primary-100 rounded-full">
              <Text className="text-xs font-rubik-bold text-primary-300">
                {property.type}
              </Text>
            </View>
            <Image source={icons.star} className="size-3.5" />
            <Text className="text-black-200 text-sm mt-1 font-rubik-medium">
              {avgRating}
            </Text>
          </View>

          <View className="flex flex-row items-center mt-5">
            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10">
              <Image source={icons.bed} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.text }}
            >
              {property.bedrooms || 0} Beds
            </Text>

            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10 ml-7">
              <Image source={icons.bath} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.text }}
            >
              {property.bathrooms || 0} Baths
            </Text>

            <View className="flex flex-row items-center justify-center bg-primary-100 rounded-full size-10 ml-7">
              <Image source={icons.area} className="size-4" />
            </View>
            <Text
              className="text-black-300 text-sm font-rubik-medium ml-2"
              style={{ color: theme.text }}
            >
              {property.area || 0} sqm
            </Text>
          </View>

          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Overview
            </Text>
            <Text
              className="text-black-200 text-base font-rubik mt-2"
              style={{ color: theme.text }}
            >
              {property.description || "No description available"}
            </Text>
          </View>

          {/* ======================================== */}
          {/* REVIEWS SECTION - MATCHING TENANT VIEW WITHOUT COLLAPSE */}
          {/* ======================================== */}
          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold mb-3"
              style={{ color: theme.text }}
            >
              Reviews ({reviews.length})
            </Text>

            <View className="mt-1">
              {reviews.length > 0 ? (
                reviews.map((rev, index) => (
                  <View
                    key={rev.id}
                    className={`p-4 rounded-xl mb-3`}
                    style={{
                      backgroundColor:
                        index % 2 === 0 ? theme.surface : theme.surface,
                      borderWidth: 1,
                      borderColor: theme.muted + "30",
                    }}
                  >
                    {/* Review Header - User Info */}
                    <View className="flex-row items-center mb-2">
                      <Image
                        source={
                          rev.userAvatar
                            ? { uri: rev.userAvatar }
                            : icons.person
                        }
                        className="w-8 h-8 rounded-full mr-3"
                        style={{
                          borderWidth: 1,
                          borderColor: theme.muted + "30",
                        }}
                      />
                      <View className="flex-1">
                        <View className="flex-row justify-between items-center">
                          <Text
                            className="font-rubik-bold text-base"
                            style={{ color: theme.title }}
                          >
                            {rev.userName}
                          </Text>
                          <View
                            className="flex-row items-center px-2 py-1 rounded-full"
                            style={{
                              backgroundColor: theme.surface,
                              borderWidth: 1,
                              borderColor: theme.muted + "30",
                            }}
                          >
                            <Text
                              className="font-rubik-bold mr-1 text-sm"
                              style={{ color: theme.text }}
                            >
                              {rev.rating}
                            </Text>
                            <Image source={icons.star} className="size-3.5" />
                          </View>
                        </View>
                        <Text
                          className="text-xs"
                          style={{ color: theme.muted }}
                        >
                          {new Date(rev.date).toLocaleDateString()}
                        </Text>
                      </View>
                    </View>

                    {/* Review Content */}
                    <View className="ml-2">
                      <Text
                        className="text-base leading-5"
                        style={{ color: theme.text }}
                      >
                        {rev.review}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-500 text-center font-rubik-medium">
                  No reviews yet from Viewers
                </Text>
              )}
            </View>
          </View>

          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Facilities
            </Text>

            {facilityList.length > 0 ? (
              <View className="mt-2">
                <View className="flex-row flex-wrap -mx-1">
                  {facilityList.map((item, index) => {
                    const facility = facilities.find(
                      (f) => f.title === item,
                    ) as
                      | { title: string; icon: any; color?: string }
                      | undefined;
                    const colors = [
                      "#3B82F6",
                      "#10B981",
                      "#F59E0B",
                      "#EF4444",
                      "#8B5CF6",
                      "#EC4899",
                    ];
                    const iconColor =
                      facility?.color || colors[index % colors.length];

                    return (
                      <View key={index} className="w-1/3 px-1 mb-3">
                        <View
                          className="rounded-xl p-3 items-center"
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
                          <View
                            className="size-14 rounded-full flex items-center justify-center"
                            style={{
                              backgroundColor: iconColor + "20",
                            }}
                          >
                            <Image
                              source={facility ? facility.icon : icons.info}
                              className="size-6"
                              style={{ tintColor: iconColor }}
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            className="text-sm text-center font-rubik mt-1.5"
                            style={{ color: theme.text }}
                          >
                            {item}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <Text
                className="text-base font-rubik mt-2"
                style={{ color: theme.muted }}
              >
                No facilities listed
              </Text>
            )}
          </View>

          {propertyImages.length > 1 && (
            <View className="mt-7">
              <Text
                className="text-black-300 text-xl font-rubik-bold mb-3"
                style={{ color: theme.text }}
              >
                All Photos
              </Text>
              <FlatList
                data={propertyImages}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <TouchableOpacity
                    onPress={() => setCurrentImageIndex(index)}
                    className="mr-3"
                  >
                    <Image
                      source={{ uri: item }}
                      className="w-24 h-24 rounded-xl"
                    />
                    {index === currentImageIndex && (
                      <View className="absolute inset-0 bg-primary-300/30 rounded-xl border-2 border-primary-300" />
                    )}
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          <View className="mt-7">
            <Text
              className="text-black-300 text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Location
            </Text>
            <View className="flex flex-row items-center mt-4 gap-2">
              <Image source={icons.location} className="w-7 h-7" />
              <Text
                className="text-black-200 text-sm font-rubik-medium"
                style={{ color: theme.text }}
              >
                {property.address || "Address not available"}
              </Text>
            </View>
          </View>

          {/* ✅ DELETE PROPERTY BUTTON - Only show if current user is the creator */}
          {isLandlordOwner && (
            <View className="mt-7 mb-10">
              <TouchableOpacity
                onPress={handleDeleteProperty}
                disabled={deleting}
                className={`py-4 rounded-full border border-red-600 shadow-md ${
                  deleting ? "bg-red-300" : "bg-red-500"
                }`}
              >
                <Text className="text-white text-center text-lg font-rubik-bold">
                  {deleting ? "Deleting..." : "Delete Property"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </>
    );
  };

  // ============================================================================
  // EDIT MODAL RENDER
  // ============================================================================
  const renderEditModal = () => {
    const toggleEditFacility = (facilityTitle: string) => {
      setEditSelectedFacilities((prev) => {
        if (prev.includes(facilityTitle)) {
          return prev.filter((f) => f !== facilityTitle);
        } else {
          return [...prev, facilityTitle];
        }
      });
    };

    const renderEditFacilitiesModal = () => (
      <Modal
        animationType="slide"
        transparent={true}
        visible={editFacilitiesModalVisible}
        onRequestClose={() => setEditFacilitiesModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View
            className="rounded-t-3xl p-6"
            style={{
              backgroundColor: theme.navBackground,
              maxHeight: "80%",
            }}
          >
            <View className="flex-row justify-between items-center mb-4">
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.text }}
              >
                Select Facilities
              </Text>
              <TouchableOpacity
                onPress={() => setEditFacilitiesModalVisible(false)}
              >
                <Text
                  className="text-primary-300 font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  Done
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={facilities}
              keyExtractor={(item) => item.title}
              numColumns={2}
              renderItem={({ item }) => {
                const isSelected = editSelectedFacilities.includes(item.title);
                return (
                  <TouchableOpacity
                    onPress={() => toggleEditFacility(item.title)}
                    className={`flex-1 m-2 p-4 rounded-xl border items-center ${
                      isSelected
                        ? "bg-primary-100 border-primary-300"
                        : "bg-white border-gray-200"
                    }`}
                    style={{
                      backgroundColor: isSelected
                        ? theme.primary[100]
                        : theme.navBackground,
                      borderColor: isSelected
                        ? theme.primary[300]
                        : theme.title,
                    }}
                  >
                    <Image
                      source={item.icon}
                      className="w-8 h-8 mb-2"
                      style={{
                        tintColor: isSelected
                          ? theme.primary[300]
                          : theme.muted,
                      }}
                    />
                    <Text
                      className={`text-sm font-rubik-medium text-center ${
                        isSelected ? "text-primary-300" : "text-black-300"
                      }`}
                      style={{
                        color: isSelected ? theme.primary[300] : theme.text,
                      }}
                    >
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    );

    return (
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
              {/* Property Name */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Property Name <Text className="text-red-500">*</Text>
                </Text>
                <TextInput
                  value={editForm.propertyName}
                  onChangeText={(text) =>
                    handleEditChange("propertyName", text)
                  }
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

              {/* Property Type */}
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

              {/* Address */}
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

              {/* Price */}
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

              {/* Bedrooms & Bathrooms */}
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

              {/* Area */}
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

              {/* Facilities */}
              <View className="mb-4">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Facilities
                </Text>
                <TouchableOpacity
                  onPress={() => setEditFacilitiesModalVisible(true)}
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: theme.title,
                    backgroundColor: theme.navBackground,
                  }}
                >
                  {editSelectedFacilities.length > 0 ? (
                    <View className="flex-row flex-wrap">
                      {editSelectedFacilities
                        .slice(0, 3)
                        .map((facility, index) => (
                          <View
                            key={index}
                            className="bg-primary-100 px-2 py-1 rounded-full mr-2 mb-1"
                            style={{ backgroundColor: theme.primary[100] }}
                          >
                            <Text
                              className="text-xs font-rubik-medium"
                              style={{ color: theme.primary[300] }}
                            >
                              {facility}
                            </Text>
                          </View>
                        ))}
                      {editSelectedFacilities.length > 3 && (
                        <View className="bg-gray-200 px-2 py-1 rounded-full">
                          <Text className="text-gray-600 text-xs font-rubik-medium">
                            +{editSelectedFacilities.length - 3} more
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <Text style={{ color: theme.muted }}>
                      Select facilities
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Description */}
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

              {/* Availability Status */}
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
                          editForm.isAvailable
                            ? "text-green-600"
                            : "text-red-600"
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

              {/* Buttons */}
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
        {renderEditFacilitiesModal()}
      </Modal>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================
  if (loading) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" className="text-primary-300" />
        <Text className="mt-2 text-gray-600 font-rubik">
          Loading property...
        </Text>
      </View>
    );
  }

  if (!property) {
    return (
      <View
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: theme.background }}
      >
        <Image source={icons.info} className="size-16 mb-4 opacity-50" />
        <Text className="text-black-300 text-lg font-rubik-medium mb-2">
          Property not found
        </Text>
        <TouchableOpacity
          onPress={() => {
            router.replace(
              user?.userMode === "landlord" ? "/landHome" : "/tenantHome",
            );
          }}
          className="bg-primary-300 px-8 py-3 rounded-full"
        >
          <Text className="text-white font-rubik-medium">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isTenant = user?.userMode === "tenant";
  const isLandlord = user?.userMode === "landlord";

  return (
    <View className="flex-1" style={{ backgroundColor: theme.navBackground }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? (isTenant ? 90 : 0) : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: isTenant ? 100 : 20,
          }}
        >
          {renderImageGallery()}
          {isTenant && renderTenantView()}
          {isLandlord && renderLandlordView()}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* BOTTOM BAR - ONLY FOR TENANTS */}
      {isTenant && (
        <View
          className="absolute bottom-10 w-full rounded-t-2xl border-t border-r border-l border-primary-200 p-4"
          style={{
            backgroundColor: theme.navBackground,
            borderTopColor: theme.muted + "30",
          }}
        >
          <View className="flex flex-row items-center justify-between">
            <View className="flex flex-col items-start">
              <Text className="text-orange-500 text-xs font-rubik-medium">
                Price
              </Text>
              <Text className="text-lg font-rubik-bold text-primary-300">
                ${property.price || 0}
                <Text
                  className="text-lg font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  {property.type === "Boarding"
                    ? "/head"
                    : property.type === "Luxury"
                      ? "/night"
                      : "/month"}
                </Text>
              </Text>
            </View>

            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={handleLike}
                className="flex-row items-center bg-gray-100 px-3 py-2 rounded-full"
              >
                <Image
                  source={liked ? icons.like : icons.like}
                  className="size-5 mr-1"
                  style={{ tintColor: liked ? "#ff69b4" : "#666" }}
                />
                <Text
                  className={`text-base font-rubik-bold ${liked ? "text-pink-500" : "text-gray-600"}`}
                >
                  {likeCount}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleFavoriteToggle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                className={`flex-row items-center px-3 py-2 rounded-full ${
                  isFav ? "bg-pink-500" : "bg-primary-300"
                }`}
              >
                <Image
                  source={icons.bookmark}
                  className="size-4 mr-1"
                  style={{ tintColor: "white" }}
                />
                <Text className="text-white text-base font-rubik-bold">
                  {isFav ? "Saved" : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modals */}
      {renderEditModal()}
      <ReviewSuccessModal
        visible={reviewSuccessVisible}
        onClose={() => setReviewSuccessVisible(false)}
        message="Your review has been posted successfully."
      />
      <OperationSuccesfull
        visible={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Updated Successfully"
        message="Property has been updated."
      />
      <ConfirmationModal
        visible={confirmationModalVisible}
        onConfirm={confirmDeleteProperty}
        onCancel={() => setConfirmationModalVisible(false)}
      />

      <ErrorModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title="Oops!"
        message={errorMessage}
      />
      {/* Request Modal */}
      <RequestModal
        visible={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        onSubmit={handleSendDetailedRequest}
        propertyName={property?.propertyName || "this property"}
        currentPrice={property?.price || 0}
        isLoading={requestModalLoading}
      />
    </View>
  );
};

export default Property;
