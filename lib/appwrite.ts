import notificationService from "@/services/notification.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import * as Linking from "expo-linking";
import { openAuthSessionAsync } from "expo-web-browser";

import {
  Account,
  Avatars,
  Client,
  Databases,
  ID,
  OAuthProvider,
  Query,
  Storage,
} from "react-native-appwrite";

const createValidAppwriteId = (): string => {
  let id = ID.unique();
  id = id.replace(/[^a-zA-Z0-9\-_]/g, "");
  if (!id) id = "u" + Date.now().toString(36);
  if (!/^[a-zA-Z0-9]/.test(id)) id = "u" + id;
  return id.slice(0, 36);
};

interface PropertyData {
  $id: string;
  propertyName?: string;
  type: string;
  description: string;
  address: string;
  price: number;
  area: number;
  rating: number;
  bedrooms: number;
  bathrooms: number;
  facilities: string | string[] | object;
  image1?: string;
  image2?: string;
  image3?: string;
  likes?: number;
  views?: number;
  requests?: number;
  reviews?: string;
  isAvailable?: boolean;
  creatorId?: string;
}

// Add after your existing interfaces
interface RankedProperty extends PropertyData {
  score: number;
  rank: number;
  rankingDetails: {
    likesScore: number;
    viewsScore: number;
    reviewsScore: number;
    facilitiesScore: number;
    requestsScore: number;
  };
}

interface RankingWeights {
  likes: number;
  views: number;
  reviews: number;
  facilities: number;
  requests: number;
}

// Helper to parse reviews and get count and rating
const parseReviews = (reviewsJson: string | undefined) => {
  if (!reviewsJson) return { count: 0, averageRating: 0 };
  try {
    const reviews = JSON.parse(reviewsJson);
    if (!Array.isArray(reviews) || reviews.length === 0)
      return { count: 0, averageRating: 0 };
    const count = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
    const averageRating = sum / count;
    return { count, averageRating };
  } catch {
    return { count: 0, averageRating: 0 };
  }
};

// Helper to count facilities
const getFacilitiesCount = (
  facilities: string | string[] | undefined,
): number => {
  if (!facilities) return 0;
  if (Array.isArray(facilities)) return facilities.length;
  if (typeof facilities === "string") {
    return facilities.split(",").filter((f) => f.trim()).length;
  }
  return 0;
};

// Normalize values to 0-1 scale
const normalize = (value: number, min: number, max: number): number => {
  if (max === min) return 0;
  return (value - min) / (max - min);
};

export const config = {
  platform: "com.tekto99.rentify",
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  usersCollectionId: process.env.EXPO_PUBLIC_APPWRITE_USERS_COLLECTION_ID,
  propertiesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_PROPERTIES_COLLECTION_ID,
  agentsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_AGENTS_COLLECTION_ID,
  galleriesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_GALLERIES_COLLECTION_ID,
  reviewsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_REVIEWS_COLLECTION_ID,
  bucketId: process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID,
  favoritesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_FAVORITES_COLLECTION_ID,
  likesCollectionId: process.env.EXPO_PUBLIC_APPWRITE_LIKES_COLLECTION,
  activitiesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_ACTIVITIES_COLLECTION,
  notificationsCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_NOTIFICATIONS_COLLECTION,
  requestsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_REQUESTS_COLLECTION,
  matchProfilesCollectionId:
    process.env.EXPO_PUBLIC_MATCH_PROFILES_COLLECTION_ID,
  pushTokensCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_PUSH_TOKENS_COLLECTION_ID,
};

interface CreateUserParams {
  email: string;
  password: string;
  phone: string;
  name: string;
  userMode: string;
  avatar?: string;
}

interface SignInParams {
  email: string;
  password: string;
}

export const client = new Client()
  .setEndpoint(config.endpoint!)
  .setProject(config.projectId!)
  .setPlatform(config.platform!);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);
const avatars = new Avatars(client);

export const getDefaultAvatarUrl = (name: string): string => {
  const encodedName = encodeURIComponent(name.trim() || "User");
  return `https://ui-avatars.com/api/?name=${encodedName}&background=random&color=fff&size=100&bold=true&format=png`;
};

const expoPushEndpoint =
  process.env.EXPO_PUBLIC_PUSH_ENDPOINT ||
  "https://exp.host/--/api/v2/push/send";

interface AppwriteUserDocument {
  $id: string;
  accountId: string;
  expoPushToken?: string;
}

async function getUserDocumentByIdOrAccountId(
  userId: string,
): Promise<AppwriteUserDocument | null> {
  try {
    let response = await databases.listDocuments(
      config.databaseId!,
      config.usersCollectionId!,
      [Query.equal("$id", userId), Query.limit(1)],
    );

    if (response.documents.length > 0) {
      return response.documents[0] as unknown as AppwriteUserDocument;
    }

    response = await databases.listDocuments(
      config.databaseId!,
      config.usersCollectionId!,
      [Query.equal("accountId", userId), Query.limit(1)],
    );

    return response.documents.length > 0
      ? (response.documents[0] as unknown as AppwriteUserDocument)
      : null;
  } catch (error) {
    console.error("Error resolving user document by ID or accountId:", error);
    return null;
  }
}

export async function sendExpoPushToUser(
  userId: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  try {
    const userDoc = await getUserDocumentByIdOrAccountId(userId);
    const token = userDoc?.expoPushToken;

    if (!token) {
      console.log("No Expo push token for user:", userId);
      return false;
    }

    const response = await fetch(expoPushEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        sound: "default",
        title,
        body,
        data: {
          notificationTitle: title,
          notificationBody: body,
          ...data,
        },
        priority: "high",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Expo push failed: ${response.status} ${text}`);
    }

    console.log("✅ Expo push sent to user:", userId);
    return true;
  } catch (error) {
    console.error("❌ Error sending Expo push:", error);
    return false;
  }
}

// ---------------- USER ----------------
// createUser function

export const createUser = async ({
  email,
  password,
  name,
  phone,
  userMode,
  avatar,
}: CreateUserParams) => {
  let createdAccountId = null;

  try {
    // First, validate all inputs before any database operation
    if (!email || !password || !name || !phone || !userMode) {
      throw new Error("All fields are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error("Please enter a valid email address");
    }

    const accountId = createValidAppwriteId();
    const userDocumentId = createValidAppwriteId();
    createdAccountId = accountId;

    console.log("createUser: generated accountId", accountId);

    // Create account in Appwrite Auth
    const newAccount = await account.create(accountId, email, password, name);
    if (!newAccount) throw new Error("Failed to create account");

    const avatarUrl = avatar?.trim() || getDefaultAvatarUrl(name);

    // Create user document in users collection
    const userDoc = await databases.createDocument(
      config.databaseId!,
      config.usersCollectionId!,
      userDocumentId,
      {
        email,
        name,
        accountId: newAccount.$id,
        phone,
        avatar: avatarUrl,
        userMode,
      },
    );

    // If user is a landlord, add them to the agents collection
    if (userMode?.toLowerCase() === "landlord") {
      try {
        const agentId = createValidAppwriteId();
        await databases.createDocument(
          config.databaseId!,
          config.agentsCollectionId!,
          agentId,
          {
            name: name,
            email: email,
            avatar: avatarUrl,
          },
        );
        console.log("✅ Landlord added to agents collection");
      } catch (agentError) {
        console.error(
          "Error adding landlord to agents collection:",
          agentError,
        );
        // Don't throw - user was created successfully
      }
    }

    await signIn({ email, password });
    return userDoc;
  } catch (error: any) {
    console.log("createUser error:", error);

    // Rollback: If Auth account was created but something else failed, delete it
    if (createdAccountId) {
      try {
        await account.deleteSession("current");
        await account.deleteIdentity(createdAccountId);
        console.log("✅ Rollback: Deleted orphaned Auth account");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }
    }

    throw new Error(error?.message || "Failed to create user");
  }
};

export const updateUserPushToken = async (
  userDocId: string,
  token: string | null,
) => {
  try {
    await databases.updateDocument(
      config.databaseId!,
      config.usersCollectionId!,
      userDocId,
      {
        expoPushToken: token || "",
      },
    );
  } catch (error: any) {
    console.error("Error updating user push token:", error);
  }
};

export const signIn = async ({ email, password }: SignInParams) => {
  try {
    return await account.createEmailPasswordSession(email, password);
  } catch (error: any) {
    console.log("signIn error:", error);
    throw new Error(error?.message || "Failed to sign in");
  }
};

export async function uploadImage(image: any) {
  try {
    // Compress image first
    const compressedImage = await ImageManipulator.manipulateAsync(
      image.uri,
      [{ resize: { width: 1200 } }], // Resize to max width 1200px
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );

    const fileName = image.fileName || `image-${Date.now()}.jpg`;
    const fileType = image.mimeType || "image/jpeg";

    // Get compressed file size
    const fileInfo = await fetch(compressedImage.uri);
    const blob = await fileInfo.blob();
    const fileSize = blob.size;

    console.log("Original size:", image.fileSize);
    console.log("Compressed size:", fileSize);

    // Upload compressed image
    const fileToUpload = {
      uri: compressedImage.uri,
      name: fileName,
      type: fileType,
      size: fileSize,
    };

    const file = await storage.createFile(
      config.bucketId!,
      ID.unique(),
      fileToUpload,
    );

    const imageUrl = `https://cloud.appwrite.io/v1/storage/buckets/${config.bucketId}/files/${file.$id}/view?project=${config.projectId}`;
    console.log("Upload successful, URL:", imageUrl);

    return imageUrl;
  } catch (error) {
    console.error("Error in uploadImage:", error);
    throw error;
  }
}

export async function AddListing(
  listing: {
    propertyName?: string;
    type: string;
    description: string;
    address: string;
    price: number;
    area: number;
    curfew: string;
    isAvailable: boolean;
    roomFor: number;
    bedrooms: number;
    bathrooms: number;
    facilities: string;
    image1?: string;
    image2?: string;
    image3?: string;
    agent?: string;
    creatorId?: string;
  },
  onSuccess?: (newListing: any) => void,
) {
  try {
    console.log("Creating listing with agent (user $id):", listing.agent);

    const response = await databases.createDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      ID.unique(),
      {
        propertyName: listing.propertyName,
        type: listing.type,
        description: listing.description,
        address: listing.address,
        price: listing.price,
        area: listing.area,
        roomFor: listing.roomFor,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        facilities: listing.facilities,
        curfew: listing.curfew,
        isAvailable: listing.isAvailable ?? true,
        image1: listing.image1 || null,
        image2: listing.image2 || null,
        image3: listing.image3 || null,
        agent: listing.agent || null,
        creatorId: listing.creatorId || null,
      },
    );

    console.log("✅ Listing created:", {
      id: response.$id,
      agent: response.agent,
    });

    // 🚀 SEND PUSH NOTIFICATIONS TO TENANTS IN THE SAME AREA
    try {
      // Extract city/area from address
      const addressParts = listing.address.split(",");
      const city =
        addressParts.length >= 2
          ? `${addressParts[addressParts.length - 2]?.trim()}, ${addressParts[addressParts.length - 1]?.trim()}`
          : addressParts[addressParts.length - 1]?.trim() || "Unknown";

      // Get all tenants
      const tenants = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("userMode", "tenant")],
      );

      // Filter tenants who might be interested (based on saved searches or preferences)
      // For now, send to all tenants in the same city
      const interestedTenants = tenants.documents.filter((tenant) => {
        // You could add more sophisticated matching here based on:
        // - Tenant's preferred location from their match profile
        // - Tenant's budget range
        // - Tenant's saved searches
        return true; // Send to all tenants for now
      });

      // Send notifications in batches to avoid overwhelming the API
      const batchSize = 10;
      for (let i = 0; i < interestedTenants.length; i += batchSize) {
        const batch = interestedTenants.slice(i, i + batchSize);
        const userIds = batch.map((tenant) => tenant.accountId);

        await notificationService.sendBulkNotification(
          userIds,
          "New Property Listed!",
          `${listing.propertyName} - $${listing.price}/month in ${city}`,
          {
            type: "property",
            propertyId: response.$id,
            screen: "explore",
          },
        );

        console.log(
          `📱 Sent notifications to ${userIds.length} tenants in batch ${i / batchSize + 1}`,
        );
      }

      console.log(
        `✅ Push notifications sent to ${interestedTenants.length} tenants`,
      );
    } catch (pushError) {
      console.error(
        "Failed to send push notifications for new listing:",
        pushError,
      );
      // Don't throw - push notification failure shouldn't break the listing creation
    }

    // Call the success callback if provided
    if (onSuccess) {
      onSuccess(response);
    }

    return response;
  } catch (error) {
    console.error("❌ Error adding listing:", error);
    throw error;
  }
}

export const uploadFile = async (file: any) => {
  try {
    const uploadedFile = await storage.createFile(
      config.bucketId!,
      ID.unique(),
      file,
    );
    const fileUrl = storage.getFileView(config.bucketId!, uploadedFile.$id);
    return { id: uploadedFile.$id, url: fileUrl };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const currentAccount = await account.get();
    if (!currentAccount) return null;

    const userDocs = await databases.listDocuments(
      config.databaseId!,
      config.usersCollectionId!,
      [Query.equal("accountId", currentAccount.$id)],
    );

    if (!userDocs.documents.length) return null;
    return userDocs.documents[0];
  } catch (error) {
    console.log("getCurrentUser error:", error);
    return null;
  }
};

// ---------------- OAUTH ----------------

// lib/appwrite.ts - Updated loginWithGoogle function

export async function loginWithGoogle(userMode?: "tenant" | "landlord") {
  try {
    const redirectUri = Linking.createURL("/");
    const response = await account.createOAuth2Token(
      OAuthProvider.Google,
      redirectUri,
    );
    if (!response || !response.toString()) throw new Error("OAuth failed");

    const browserResult = await openAuthSessionAsync(
      response.href,
      redirectUri,
    );
    if (browserResult.type !== "success") throw new Error("OAuth failed");

    const url = new URL(browserResult.url);
    const secret = url.searchParams.get("secret");
    const userId = url.searchParams.get("userId");
    if (!secret || !userId) throw new Error("OAuth failed");

    const validUserId = userId.replace(/[^a-zA-Z0-9._-]/g, "");
    if (validUserId.length === 0 || validUserId.length > 36) {
      throw new Error("OAuth user ID invalid");
    }

    const session = await account.createSession(validUserId, secret);
    if (!session) throw new Error("Session failed");

    const user = await account.get();
    const existingUsers = await databases.listDocuments(
      config.databaseId!,
      config.usersCollectionId!,
      [Query.equal("accountId", user.$id)],
    );

    let userDoc;
    if (existingUsers.total === 0) {
      const avatarUrl = avatars.getInitialsURL(user.name);
      const userDocumentId = createValidAppwriteId();

      userDoc = await databases.createDocument(
        config.databaseId!,
        config.usersCollectionId!,
        userDocumentId,
        {
          email: user.email,
          name: user.name,
          accountId: user.$id,
          avatar: avatarUrl,
          userMode: userMode || "tenant",
        },
      );

      // 🚀 If user is a landlord, also add them to the agents collection
      if (userMode === "landlord") {
        try {
          const agentId = createValidAppwriteId();
          await databases.createDocument(
            config.databaseId!,
            config.agentsCollectionId!,
            agentId,
            {
              userId: user.$id,
              userDocId: userDoc.$id,
              name: user.name,
              email: user.email,
              avatar: avatarUrl,
              createdAt: new Date().toISOString(),
            },
          );
          console.log(
            "✅ Landlord added to agents collection via Google OAuth",
          );
        } catch (agentError) {
          console.error(
            "Error adding landlord to agents collection:",
            agentError,
          );
        }
      }
    } else {
      userDoc = existingUsers.documents[0];
    }

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// lib/appwrite.ts - Helper to get agent by user ID

export async function getAgentByUserId(userId: string) {
  try {
    const agents = await databases.listDocuments(
      config.databaseId!,
      config.agentsCollectionId!,
      [Query.equal("userId", userId)],
    );

    if (agents.documents.length > 0) {
      return agents.documents[0];
    }
    return null;
  } catch (error) {
    console.error("Error fetching agent by user ID:", error);
    return null;
  }
}
// ---------------- FAVORITES ----------------

export const addFavorite = async (userId: string, propertyId: string) => {
  return await databases.createDocument(
    config.databaseId!,
    config.favoritesCollectionId!,
    ID.unique(),
    {
      userId,
      propertyId: [propertyId],
    },
  );
};

export const getFavoritesByUser = async (favoriteDocumentId: string) => {
  try {
    const favorite = await databases.getDocument(
      config.databaseId!,
      config.favoritesCollectionId!,
      favoriteDocumentId,
      [
        Query.select([
          "$id",
          "userId",
          "propertyId",
          "propertyId.propertyName",
          "propertyId.propertyLocation",
        ]),
      ],
    );
    return favorite;
  } catch (error) {
    console.error("Error fetching favorite with property:", error);
    throw error;
  }
};

// lib/appwrite.ts - Fix the logout function

// lib/appwrite.ts

export async function logout() {
  try {
    // First, check if there's an active session
    try {
      const session = await account.getSession("current");
      if (session) {
        await account.deleteSession("current");
      }
    } catch (sessionError) {
      // No active session, that's fine
      console.log("No active session found");
    }
    return { success: true };
  } catch (error) {
    console.error("Error logging out:", error);
    // Even if there's an error, return success since the user is effectively logged out
    return { success: true };
  }
}

// ---------------- AVATAR ----------------

// lib/appwrite.ts

export async function updateUserAvatar(userId: string, avatarUrl: string) {
  try {
    // First, find the user document by userId (which might be accountId or document ID)
    let userDocId = userId;

    // If userId looks like an accountId (not a document ID), look it up
    if (userId.length < 36) {
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", userId)],
      );

      if (userDocs.documents.length === 0) {
        console.error("User not found with accountId:", userId);
        throw new Error("User not found");
      }
      userDocId = userDocs.documents[0].$id;
    }

    // Update the user document
    const result = await databases.updateDocument(
      config.databaseId!,
      config.usersCollectionId!,
      userDocId,
      { avatar: avatarUrl },
    );

    return result;
  } catch (error) {
    console.error("Error updating avatar:", error);
    throw error;
  }
}

// ---------------- PROPERTIES ----------------

// Helper: fetch reviews for a property
export const getReviewsByProperty = async (propertyId: string) => {
  const res = await databases.listDocuments(
    config.databaseId!,
    config.reviewsCollectionId!,
    [Query.equal("property", propertyId)],
  );
  return res.documents;
};

const USER_REVIEWS_KEY = "user_reviews";

export const addReview = async (
  propertyId: string,
  reviewText: string,
  rating: number,
) => {
  try {
    console.log("📝 Starting addReview...");
    console.log("Property ID:", propertyId);
    console.log("Review text:", reviewText);
    console.log("Rating:", rating);

    const currentUser = await account.get();

    // Helper functions for local storage
    const getUserReviews = async (userId: string): Promise<any[]> => {
      const key = `${USER_REVIEWS_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    };

    const saveUserReviews = async (userId: string, reviews: any[]) => {
      const key = `${USER_REVIEWS_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(reviews));
    };

    // Get user avatar
    let userAvatar = "person";
    console.log("👤 Current user:", currentUser.$id, currentUser.name);
    const userDocs = await databases.listDocuments(
      config.databaseId!,
      config.usersCollectionId!,
      [Query.equal("accountId", currentUser.$id)],
    );

    if (userDocs.documents.length > 0) {
      const userDoc = userDocs.documents[0];
      userAvatar = userDoc.customAvatar || userDoc.avatar || "person";
      console.log("✅ Found user in collection:", { userAvatar });
    } else {
      console.log("⚠️ User not found in users collection, using defaults");
    }

    const newReview = {
      id: Date.now().toString(),
      propertyId: propertyId,
      userName: currentUser.name,
      userAvatar: userAvatar,
      review: reviewText,
      rating: rating,
      date: new Date().toISOString(),
    };

    // Get current property
    const property = await databases.getDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      propertyId,
    );

    console.log("🏠 Property found:", property.propertyName);
    console.log("Property creatorId:", property.creatorId);
    console.log("Current user ID:", currentUser.$id);
    console.log("Is self-review?", property.creatorId === currentUser.$id);

    // Update property reviews
    let currentReviews = [];
    if (property.reviews) {
      try {
        currentReviews = JSON.parse(property.reviews);
      } catch (e) {
        currentReviews = [];
      }
    }

    const updatedReviews = [...currentReviews, newReview];
    await databases.updateDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      propertyId,
      { reviews: JSON.stringify(updatedReviews) },
    );

    console.log("✅ Review saved to property");

    // Save to local storage for tenant stats
    const userReviews = await getUserReviews(currentUser.$id);
    const reviewExists = userReviews.some((r) => r.propertyId === propertyId);
    if (!reviewExists) {
      const updatedUserReviews = [...userReviews, newReview];
      await saveUserReviews(currentUser.$id, updatedUserReviews);
      console.log("✅ Review saved to local storage for user stats");
      console.log(`📊 Total reviews given: ${updatedUserReviews.length}`);
    }

    await trackReviewActivity(propertyId, newReview.id);

    // 📢 Send notification to property owner (including self‑reviews)
    if (property.creatorId && currentUser) {
      console.log("📧 Sending notification to:", property.creatorId);

      try {
        // Create in‑app notification
        const notificationResult = await createNotification(
          property.creatorId,
          "New Review! ⭐",
          `${currentUser.name || "Someone"} gave ${rating} star${rating !== 1 ? "s" : ""} to "${property.propertyName || "Property"}"`,
          "review",
          {
            propertyId: property.$id,
            propertyName: property.propertyName,
            reviewerId: currentUser.$id,
            reviewerName: currentUser.name,
            rating: rating,
          },
        );

        console.log(
          "✅ Review notification saved to database:",
          notificationResult ? "Success" : "Failed",
        );
      } catch (notificationError) {
        console.error(
          "❌ Failed to create review notification:",
          notificationError,
        );
      }

      // After creating the review, send push notification
      try {
        await notificationService.sendNotificationToUser(
          property.creatorId,
          "New Review Received!",
          `${currentUser.name || "Someone"} gave ${rating} star${rating !== 1 ? "s" : ""} to "${property.propertyName}"`,
          {
            type: "review",
            propertyId: property.$id,
            rating: rating,
            screen: `/properties/${property.$id}`,
          },
        );
        console.log("✅ Push notification sent to landlord about review");
      } catch (pushError) {
        console.error(
          "Failed to send push notification for review:",
          pushError,
        );
      }
    } else {
      console.log("⚠️ Skipping notification - no creatorId");
    }

    return newReview;
  } catch (error) {
    console.error("❌ Error adding review:", error);
    throw error;
  }
};

// Helper function to get user's reviews (for profile stats)
export async function getUserReviewsGiven(userId: string): Promise<any[]> {
  try {
    const key = `${USER_REVIEWS_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error getting user reviews:", error);
    return [];
  }
}

// Helper function to check if user has already reviewed a property
export async function hasUserReviewedProperty(
  userId: string,
  propertyId: string,
): Promise<boolean> {
  try {
    const reviews = await getUserReviewsGiven(userId);
    return reviews.some((review) => review.propertyId === propertyId);
  } catch (error) {
    console.error("Error checking review status:", error);
    return false;
  }
}

// Get review count for a property
export async function getReviewCount(propertyId: string) {
  try {
    const reviews = await databases.listDocuments(
      config.databaseId!,
      config.reviewsCollectionId!,
      [Query.equal("propertyId", propertyId)],
    );

    return reviews.total;
  } catch (error) {
    console.error("Error getting review count:", error);
    return 0;
  }
}

// Check if user has reviewed a property
export async function checkUserReviewed(propertyId: string, userId: string) {
  try {
    const reviews = await databases.listDocuments(
      config.databaseId!,
      config.reviewsCollectionId!,
      [Query.equal("propertyId", propertyId), Query.equal("userId", userId)],
    );

    return reviews.documents.length > 0;
  } catch (error) {
    console.error("Error checking review:", error);
    return false;
  }
}

// Get user's review for a property
export async function getUserReview(propertyId: string, userId: string) {
  try {
    const reviews = await databases.listDocuments(
      config.databaseId!,
      config.reviewsCollectionId!,
      [Query.equal("propertyId", propertyId), Query.equal("userId", userId)],
    );

    return reviews.documents[0] || null;
  } catch (error) {
    console.error("Error getting user review:", error);
    return null;
  }
}

export async function deleteProperty(propertyId: string) {
  try {
    await databases.deleteDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      propertyId,
    );
    return { success: true };
  } catch (error) {
    console.error("Error deleting property:", error);
    throw error;
  }
}

export async function getPropertiesByCreator(
  creatorId: string,
  limit: number = 10,
  latest: boolean = false,
  filter?: string,
  query?: string,
) {
  try {
    const queries = [Query.equal("creatorId", creatorId)];

    if (filter && filter !== "All") {
      queries.push(Query.equal("type", filter));
    }

    if (query && query.trim() !== "") {
      queries.push(Query.search("propertyName", query));
    }

    if (latest) {
      queries.push(Query.orderDesc("$createdAt"));
    }

    queries.push(Query.limit(limit));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      queries,
    );

    // Process the results
    let propertiesWithDetails = await Promise.all(
      result.documents.map(async (property) => {
        // Calculate rating from reviews JSON
        if (property.reviews) {
          try {
            const parsedReviews = JSON.parse(property.reviews);
            if (parsedReviews.length > 0) {
              const sum = parsedReviews.reduce(
                (acc: number, r: any) => acc + (r.rating || 0),
                0,
              );
              property.rating = Number((sum / parsedReviews.length).toFixed(1));
            } else {
              property.rating = 0;
            }
          } catch (e) {
            property.rating = 0;
          }
        } else {
          property.rating = 0;
        }

        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error("Error getting properties by creator:", error);
    return [];
  }
}

// Get all liked properties for a user
export async function getUserLikedProperties(userId: string) {
  try {
    // Get all like records for this user
    const likes = await databases.listDocuments(
      config.databaseId!,
      config.likesCollectionId!,
      [Query.equal("userId", userId)],
    );

    // Get the actual property details
    const propertyPromises = likes.documents.map(async (like) => {
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        like.propertyId,
      );
      return property;
    });

    return await Promise.all(propertyPromises);
  } catch (error) {
    console.error("Error getting user liked properties:", error);
    return [];
  }
}

export async function getPropertyById({ id }: { id: string }) {
  try {
    const property = await databases.getDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      id,
    );

    // Fetch agent details with error handling
    if (property.agent && typeof property.agent === "string") {
      try {
        const agent = await databases.getDocument(
          config.databaseId!,
          config.usersCollectionId!,
          property.agent,
        );

        property.agent = {
          $id: agent.$id,
          name: agent.name || "Unknown",
          email: agent.email || "No email",
          phone: agent.phone,
          avatar: agent.avatar || null,
        };
      } catch (agentError) {
        console.warn(`⚠️ Agent not found for property ${id}, setting to null`);
        property.agent = null;
      }
    }

    // ... rest of the code ... //
    return property;
  } catch (error) {
    console.error("❌ Error in getPropertyById:", error);
    return null;
  }
}

// Count how many times a property appears in Favorites
export async function getLikesCount(propertyId: string) {
  const res = await databases.listDocuments(
    config.databaseId!,
    config.favoritesCollectionId!,
    [Query.equal("propertyId", propertyId)],
  );
  return res.total;
}
// lib/appwrit - Properties
export async function getProperties({
  filter,
  query,
  limit,
}: {
  filter: string;
  query: string;
  limit?: number;
}) {
  try {
    const buildQuery = [Query.orderDesc("$createdAt")];
    // Inside getProperties, replace the search block with:
    if (query && query.trim() !== "") {
      const searchFields = [
        Query.search("propertyName", query),
        Query.search("facilities", query),
        Query.search("description", query),
        Query.search("address", query),
        Query.search("type", query),
        ...(!isNaN(Number(query)) ? [Query.equal("price", Number(query))] : []),
      ].filter((q): q is string => q !== null);
      buildQuery.push(Query.or(searchFields));
    }
    if (filter && filter !== "All")
      buildQuery.push(Query.equal("type", filter));
    const fetchLimit = query && query.trim() !== "" ? 50 : limit || 10;
    buildQuery.push(Query.limit(fetchLimit));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      buildQuery,
    );

    let propertiesWithDetails = await Promise.all(
      result.documents.map(async (property) => {
        // Agent - Fetch from USERS collection
        if (property.agent) {
          try {
            const agent = await databases.getDocument(
              config.databaseId!,
              config.usersCollectionId!,
              property.agent,
            );
            property.agent = agent;
          } catch (error) {
            property.agent = null;
          }
        }

        let rating = 0;
        if (property.reviews) {
          try {
            if (typeof property.reviews === "string") {
              const trimmed = property.reviews.trim();
              if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
                const parsedReviews = JSON.parse(property.reviews);
                if (Array.isArray(parsedReviews) && parsedReviews.length > 0) {
                  const sum = parsedReviews.reduce(
                    (acc: number, r: any) => acc + (r.rating || 0),
                    0,
                  );
                  rating = Number((sum / parsedReviews.length).toFixed(1));
                }
              }
            }
          } catch (e) {
            console.warn(
              `⚠️ Error parsing reviews for property ${property.$id}:`,
              e,
            );
            rating = 0;
          }
        }
        property.rating = rating;

        // Resolve image file IDs into preview URLs
        if (property.images && Array.isArray(property.images)) {
          property.images = property.images.map((fileId: string) =>
            storage.getFilePreview(config.bucketId!, fileId),
          );
        }

        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error(error);
    return [];
  }
}
export async function getLatestProperties() {
  try {
    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.orderDesc("$createdAt"), Query.limit(5)],
    );

    const propertiesWithDetails = await Promise.all(
      result.documents.map(async (property) => {
        // Agent (Many to one relationship)
        if (property.agent) {
          try {
            const agent = await databases.getDocument(
              config.databaseId!,
              config.usersCollectionId!,
              property.agent,
            );
            property.agent = agent;
          } catch (error) {
            console.warn(`⚠️ Agent not found for property ${property.$id}`);
            property.agent = null;
          }
        }

        // Calculating rating from reviews
        let rating = 0;
        if (property.reviews) {
          try {
            if (typeof property.reviews === "string") {
              const trimmed = property.reviews.trim();
              if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
                const parsedReviews = JSON.parse(property.reviews);
                if (Array.isArray(parsedReviews) && parsedReviews.length > 0) {
                  const sum = parsedReviews.reduce(
                    (acc: number, r: any) => acc + (r.rating || 0),
                    0,
                  );
                  rating = Number((sum / parsedReviews.length).toFixed(1));
                }
              }
            }
          } catch (e) {
            console.warn(
              `⚠️ Error parsing reviews for property ${property.$id}:`,
              e,
            );
            rating = 0;
          }
        }
        property.rating = rating;
        console.log(`📊 ${property.propertyName}: Rating = ${rating}`);

        // Resolve image file IDs to preview URLs for individual image fields
        if (property.images && Array.isArray(property.images)) {
          const imageUrls = property.images.map((fileId: string) =>
            storage.getFilePreview(config.bucketId!, fileId),
          );

          property.image1 = imageUrls[0] || null;
          property.image2 = imageUrls[1] || null;
          property.image3 = imageUrls[2] || null;

          delete property.images;
        }

        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Toggle like (like/unlike)
// Key for storing user's liked properties
const LIKES_GIVEN_KEY = "user_likes_given";

export async function toggleLike(propertyId: string, userId: string) {
  try {
    console.log("🔄 Toggling like:", { propertyId, userId });

    // Get current user
    let currentUser = null;
    try {
      currentUser = await account.get();
    } catch (error) {
      console.log("Could not get current user for notification");
    }

    // Get current likes from local storage
    const getLocalLikes = async (userId: string): Promise<string[]> => {
      const key = `${LIKES_GIVEN_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    };

    // Save likes to local storage
    const saveLocalLikes = async (userId: string, likes: string[]) => {
      const key = `${LIKES_GIVEN_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(likes));
    };

    // Check if like already exists in Appwrite
    const existingLikes = await databases.listDocuments(
      config.databaseId!,
      config.likesCollectionId!,
      [Query.equal("propertyId", propertyId), Query.equal("userId", userId)],
    );

    // Get local likes
    let localLikes = await getLocalLikes(userId);

    if (existingLikes.documents.length > 0) {
      // UNLIKE - Remove from Appwrite
      const likeId = existingLikes.documents[0].$id;
      await databases.deleteDocument(
        config.databaseId!,
        config.likesCollectionId!,
        likeId,
      );

      // Update property like count
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
      );
      const newLikeCount = Math.max(0, (property.likes || 0) - 1);
      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
        { likes: newLikeCount },
      );

      // Remove from local storage
      localLikes = localLikes.filter((id) => id !== propertyId);
      await saveLocalLikes(userId, localLikes);

      return { liked: false, likeCount: newLikeCount };
    } else {
      // LIKE - Create new like record in Appwrite
      await databases.createDocument(
        config.databaseId!,
        config.likesCollectionId!,
        ID.unique(),
        { propertyId, userId },
      );

      // Get property
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
      );

      const newLikeCount = (property.likes || 0) + 1;

      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
        { likes: newLikeCount },
      );

      // Add to local storage
      if (!localLikes.includes(propertyId)) {
        localLikes.push(propertyId);
        await saveLocalLikes(userId, localLikes);
      }

      await trackLikeActivity(propertyId, userId, "liked");

      // Send notification to property owner
      if (property.creatorId && currentUser) {
        console.log("📧 Sending notification to:", property.creatorId);
        console.log("Property name:", property.propertyName);
        console.log("Liker name:", currentUser.name);

        try {
          // Create notification in database
          // In toggleLike function, when sending notification:
          const notificationResult = await createNotification(
            property.creatorId, // This should be the landlord's $id from users collection
            "New Like! ❤️",
            `${currentUser.name || "Someone"} liked your property "${property.propertyName || "Property"}"`,
            "like",
            {
              propertyId: property.$id,
              propertyName: property.propertyName,
              likerId: userId,
              likerName: currentUser.name,
              likeCount: newLikeCount,
            },
          );

          console.log("✅ Notification created:", notificationResult);
        } catch (notificationError) {
          console.error("❌ Failed to create notification:", notificationError);
        }

        try {
          await notificationService.sendNotificationToUser(
            property.creatorId,
            "Someone liked your property!",
            `${currentUser.name || "Someone"} liked "${property.propertyName}"`,
            {
              type: "like",
              propertyId: property.$id,
              screen: `/properties/${property.$id}`,
            },
          );
          console.log("✅ Push notification sent to landlord about like");
        } catch (pushError) {
          console.error(
            "Failed to send push notification for like:",
            pushError,
          );
        }
      } else {
        console.log("⚠️ Skipping notification - conditions not met:", {
          hasCreatorId: !!property.creatorId,
          isSelfLike: property.creatorId === userId,
          hasCurrentUser: !!currentUser,
        });
      }

      return { liked: true, likeCount: newLikeCount };
    }
  } catch (error) {
    console.error("❌ Error toggling like:", error);
    throw error;
  }
}

// Helper function to get user's liked properties (for profile stats)
export async function getUserLikesGiven(userId: string): Promise<string[]> {
  try {
    const key = `${LIKES_GIVEN_KEY}_${userId}`;
    const stored = await AsyncStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Error getting user likes:", error);
    return [];
  }
}

// Get like count for a property
export async function getLikeCount(propertyId: string) {
  try {
    const property = await databases.getDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      propertyId,
    );

    return property.likes || 0;
  } catch (error) {
    console.error("Error getting like count:", error);
    return 0;
  }
}

// Check if user liked a property
export async function checkUserLiked(propertyId: string, userId: string) {
  try {
    const likes = await databases.listDocuments(
      config.databaseId!,
      config.likesCollectionId!,
      [Query.equal("propertyId", propertyId), Query.equal("userId", userId)],
    );

    return likes.documents.length > 0;
  } catch (error) {
    console.error("Error checking like:", error);
    return false;
  }
}

// Get properties sorted by likes (for My Top Listings)
export async function getTopListingsByLikes(
  creatorId: string,
  limit: number = 5,
) {
  try {
    // First get all properties by this creator
    const properties = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.equal("creatorId", creatorId)],
    );

    // For each property, get like count
    const propertiesWithLikes = await Promise.all(
      properties.documents.map(async (property) => {
        const likeCount = await getLikeCount(property.$id);
        return {
          ...property,
          likeCount,
        };
      }),
    );

    // Sort by likeCount descending and take top 'limit'
    const sorted = propertiesWithLikes
      .sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0))
      .slice(0, limit);

    // Add ratings
    const propertiesWithDetails = await Promise.all(
      sorted.map(async (property: any) => {
        // Add ': any' temporarily
        try {
          const reviews = await getReviewsByProperty(property.$id);
          property.rating =
            reviews.length > 0
              ? Number(
                  (
                    reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
                    reviews.length
                  ).toFixed(1),
                )
              : 0;
        } catch {
          property.rating = 0;
        }
        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error("Error getting top listings by likes:", error);
    return [];
  }
}

// Get like count for multiple properties at once (efficient)
export async function getLikeCountsForProperties(propertyIds: string[]) {
  try {
    const likeCounts: Record<string, number> = {};

    // Get all likes for these properties
    const likes = await databases.listDocuments(
      config.databaseId!,
      config.likesCollectionId!,
      [Query.equal("propertyId", propertyIds)],
    );

    // Count likes per property
    likes.documents.forEach((like) => {
      const propId = like.propertyId;
      likeCounts[propId] = (likeCounts[propId] || 0) + 1;
    });

    return likeCounts;
  } catch (error) {
    console.error("Error getting like counts:", error);
    return {};
  }
}

export async function getAgent(agentId: string) {
  try {
    if (!agentId) {
      console.log("No agent ID provided");
      return null;
    }

    console.log("🔍 Fetching agent with ID:", agentId);

    // Fetch the user document from Users table
    const agent = await databases.getDocument(
      config.databaseId!,
      config.usersCollectionId!, // Your Users table ID
      agentId,
    );

    console.log("✅ Agent fetched successfully:", {
      id: agent.$id,
      name: agent.name,
      email: agent.email,
    });

    // Return the user data (this will contain name, email, avatar, etc.)
    return {
      $id: agent.$id,
      name: agent.name || "Unknown",
      email: agent.email || "No email",
      avatar: agent.avatar || null,
      // Include any other user fields you need
    };
  } catch (error) {
    console.error("❌ Error fetching agent:", error);
    return null;
  }
}

// In your appwrite.ts, add these functions

// Track a property view
export async function trackPropertyView(propertyId: string) {
  try {
    const activity = await databases.createDocument(
      config.databaseId!,
      config.activitiesCollectionId!,
      ID.unique(),
      {
        propertyId,
        type: "view",
        message: "Property was viewed",
        count: 1,
        createdAt: new Date().toISOString(),
      },
    );
    return activity;
  } catch (error) {
    console.error("Error tracking view:", error);
  }
}

// Track a like (call this in your toggleLike function)
export async function trackLikeActivity(
  propertyId: string,
  userId: string,
  action: "liked" | "unliked",
) {
  try {
    const activity = await databases.createDocument(
      config.databaseId!,
      config.activitiesCollectionId!,
      ID.unique(),
      {
        propertyId,
        type: "like",
        message:
          action === "liked"
            ? "Someone liked your property"
            : "Someone unliked your property",
        count: 1,
        createdAt: new Date().toISOString(),
      },
    );
    return activity;
  } catch (error) {
    console.error("Error tracking like activity:", error);
  }
}

// Track a review
export async function trackReviewActivity(
  propertyId: string,
  reviewId: string,
) {
  try {
    const activity = await databases.createDocument(
      config.databaseId!,
      config.activitiesCollectionId!,
      ID.unique(),
      {
        propertyId,
        type: "review",
        message: "New review received",
        count: 1,
        createdAt: new Date().toISOString(),
      },
    );
    return activity;
  } catch (error) {
    console.error("Error tracking review:", error);
  }
}

// Get recent activities for a landlord
export async function getRecentActivities(
  landlordId: string,
  limit: number = 10,
) {
  try {
    // First get all properties for this landlord
    const properties = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.equal("creatorId", landlordId)],
    );

    const propertyIds = properties.documents.map((p) => p.$id);

    if (propertyIds.length === 0) return [];

    // Get activities for these properties
    const activities = await databases.listDocuments(
      config.databaseId!,
      config.activitiesCollectionId!,
      [
        Query.equal("propertyId", propertyIds),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
      ],
    );

    // Enrich with property names
    const activitiesWithDetails = await Promise.all(
      activities.documents.map(async (activity) => {
        const property = await databases.getDocument(
          config.databaseId!,
          config.propertiesCollectionId!,
          activity.propertyId,
        );

        return {
          id: activity.$id,
          type: activity.type,
          message: `${activity.message} - ${property.propertyName}`,
          time: formatTimeAgo(new Date(activity.createdAt)),
          propertyName: property.propertyName,
        };
      }),
    );

    return activitiesWithDetails;
  } catch (error) {
    console.error("Error getting activities:", error);
    return [];
  }
}

// Helper function to format time
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  return `${Math.floor(diffInSeconds / 86400)} days ago`;
}

// Get price drop properties (you'll need to track price history)
export async function getPriceDropProperties() {
  try {
    const properties = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.equal("hasPriceDrop", true)],
    );
    return properties.documents;
  } catch (error) {
    console.error("Error getting price drops:", error);
    return [];
  }
}

// Get new listings (last 7 days)
export async function getNewListings() {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const properties = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.greaterThan("$createdAt", sevenDaysAgo.toISOString())],
    );
    return properties.documents;
  } catch (error) {
    console.error("Error getting new listings:", error);
    return [];
  }
}

// Get open houses (you'll need to add an openHouse field)
export async function getOpenHouses() {
  try {
    const properties = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.equal("openHouse", true)],
    );
    return properties.documents;
  } catch (error) {
    console.error("Error getting open houses:", error);
    return [];
  }
}

// lib/appwrite.ts
export async function getTopLikedProperties(limit: number = 10) {
  try {
    // Get all properties
    const response = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [],
    );

    const allProperties = response.documents;

    // Sort by likes (highest first) and take top 'limit'
    const topLiked = allProperties
      .filter((property) => (property.likes || 0) > 0)
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, limit);

    // Calculate ratings from reviews
    const propertiesWithRatings = topLiked.map((property) => {
      if (property.reviews) {
        try {
          const parsedReviews = JSON.parse(property.reviews);
          if (parsedReviews.length > 0) {
            const sum = parsedReviews.reduce(
              (acc: number, r: any) => acc + (r.rating || 0),
              0,
            );
            property.rating = Number((sum / parsedReviews.length).toFixed(1));
          } else {
            property.rating = 0;
          }
        } catch (e) {
          property.rating = 0;
        }
      } else {
        property.rating = 0;
      }
      return property;
    });

    return propertiesWithRatings;
  } catch (error) {
    console.error("Error getting top liked properties:", error);
    return [];
  }
}

// Enhanced trending algorithm - combines multiple factors
const calculateTrendingScore = (property: any) => {
  const likes = property.likes || 0;
  const views = property.views || 0;
  const recentViews = property.recentViews || 0; // Views in last 7 days
  const daysOld = Math.floor(
    (Date.now() - new Date(property.$createdAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  // Weighted formula
  const score =
    likes * 10 + // Each like = 10 points
    views * 1 + // Each view = 1 point
    recentViews * 3 + // Recent views = 3 points (more weight)
    (daysOld < 7 ? 50 : 0); // Bonus for new listings (less than 7 days old)

  return score;
};

export async function getTrendingProperties(limit: number = 10) {
  try {
    const response = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [],
    );
    return response.documents
      .sort((a, b) => calculateTrendingScore(b) - calculateTrendingScore(a))
      .slice(0, limit);
  } catch (error) {
    console.error("Error getting trending properties:", error);
    return [];
  }
}

// lib/appwrite.ts - Add notification functions

// Mark all notifications as read for a user

// Delete notification
export async function deleteNotification(notificationId: string) {
  try {
    await databases.deleteDocument(
      config.databaseId!,
      config.notificationsCollectionId!,
      notificationId,
    );
    return true;
  } catch (error) {
    console.error("Error deleting notification:", error);
    return false;
  }
}

// lib/appwrite.ts - Updated getUserNotifications
// lib/appwrite.ts - Update getUserNotifications
export async function getUserNotifications(userId: string, limit: number = 50) {
  try {
    console.log("🔍 Fetching notifications for userId:", userId);

    const userDoc = await getUserDocumentByIdOrAccountId(userId);
    const userDocId = userDoc?.$id || userId;

    const notificationsByDocId = await databases.listDocuments(
      config.databaseId!,
      config.notificationsCollectionId!,
      [
        Query.equal("userId", userDocId),
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
      ],
    );

    let notificationDocs = [...notificationsByDocId.documents];

    if (userDocId !== userId) {
      const notificationsByAccountId = await databases.listDocuments(
        config.databaseId!,
        config.notificationsCollectionId!,
        [
          Query.equal("userId", userId),
          Query.orderDesc("$createdAt"),
          Query.limit(limit),
        ],
      );
      notificationDocs = [
        ...notificationDocs,
        ...notificationsByAccountId.documents,
      ];
    }

    const uniqueNotifications = Array.from(
      new Map(notificationDocs.map((doc) => [doc.$id, doc])).values(),
    );

    console.log("📊 Raw notifications count:", uniqueNotifications.length);
    console.log("📊 Raw notifications:", uniqueNotifications);

    const formatted = uniqueNotifications.map((doc) => {
      let read = false;
      if (doc.read !== null && doc.read !== undefined) {
        read = doc.read === true || doc.read === "true";
      }

      return {
        $id: doc.$id,
        title: doc.title || "Notification",
        message: doc.message || "",
        type: doc.type || "system",
        read: read,
        createdAt: new Date(doc.$createdAt),
        data: doc.data
          ? typeof doc.data === "string"
            ? JSON.parse(doc.data)
            : doc.data
          : null,
      };
    });

    console.log("✅ Formatted notifications:", formatted.length);
    return formatted;
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    return [];
  }
}

// lib/appwrite.ts
export const markNotificationAsRead = async (notificationId: string) => {
  try {
    await databases.updateDocument(
      config.databaseId!,
      config.notificationsCollectionId!,
      notificationId,
      { read: true },
    );
    return true;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return false;
  }
};

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "like" | "review" | "message" | "system" | "request",
  data: any = {},
) {
  try {
    console.log("📝 createNotification called with:", {
      userId,
      title,
      message,
      type,
      data,
    });

    // The userId passed should already be the document ID from users collection
    // If it's an accountId, we need to look it up
    let userDocId = userId;

    // Check if this looks like an accountId (starts with a pattern or is a different format)
    // Appwrite document IDs are typically longer and don't contain certain characters
    if (userId.length < 36 || userId.includes("@")) {
      console.log("📝 Looking up user document ID for accountId:", userId);
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", userId)],
      );

      if (userDocs.documents.length > 0) {
        userDocId = userDocs.documents[0].$id;
        console.log("✅ Found user document ID:", userDocId);
      } else {
        console.error("❌ User not found for ID:", userId);
        return null;
      }
    }

    const notification = await databases.createDocument(
      config.databaseId!,
      config.notificationsCollectionId!,
      ID.unique(),
      {
        userId: userDocId, // Use the document ID from users collection
        title,
        message,
        type,
        data: JSON.stringify(data),
        read: false,
      },
    );

    console.log("✅ Notification created successfully:", {
      id: notification.$id,
      userId: notification.userId,
      title: notification.title,
    });

    // Send real push notification after the in-app notification is stored
    await sendExpoPushToUser(userDocId, title, message, data);

    return notification;
  } catch (error) {
    console.error("❌ Error creating notification:", error);
    return null;
  }
}

export async function testCreateNotification() {
  try {
    const result = await databases.createDocument(
      config.databaseId!,
      config.notificationsCollectionId!,
      ID.unique(),
      {
        userId: "test-user-id",
        title: "Test Notification",
        message: "This is a test notification",
        type: "system",
        read: false, // ✅ Boolean
      },
    );
    console.log("✅ Test notification created:", result);
    return result;
  } catch (error) {
    console.error("❌ Error creating test notification:", error);
    return null;
  }
}

export const requestProperty = async (
  propertyId: string,
  tenantId: string,
  requestData?: {
    proposedPrice?: number;
    message?: string;
    moveInDate?: string;
    leaseDuration?: string;
    questions?: string[];
    originalPrice?: number;
    propertyName?: string;
    tenantName?: string;
    tenantEmail?: string;
  },
) => {
  try {
    console.log("📝 Starting requestProperty...");
    console.log("Property ID:", propertyId);
    console.log("Tenant ID:", tenantId);
    console.log("Request Data:", requestData);

    // Get property details to include in the request
    const property = await databases.getDocument(
      config.databaseId!,
      config.propertiesCollectionId!,
      propertyId,
    );

    console.log("✅ Property found:", property.propertyName);
    console.log("Property creatorId:", property.creatorId);

    // Get tenant details
    let tenantName = requestData?.tenantName;
    let tenantEmail = requestData?.tenantEmail;

    if (!tenantName || !tenantEmail) {
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", tenantId)],
      );
      if (userDocs.documents.length > 0) {
        tenantName = tenantName || userDocs.documents[0].name;
        tenantEmail = tenantEmail || userDocs.documents[0].email;
        console.log("✅ Tenant details fetched:", { tenantName, tenantEmail });
      }
    }

    // Create the request document with all data
    const request = await databases.createDocument(
      config.databaseId!,
      config.requestsCollectionId!,
      "unique()",
      {
        propertyId: propertyId,
        propertyName: property.propertyName || "Property",
        tenantId: tenantId,
        tenantName: tenantName || "Tenant",
        tenantEmail: tenantEmail || "",
        status: "pending",
        proposedPrice: requestData?.proposedPrice || property.price,
        originalPrice: property.price,
        message: requestData?.message || "",
        moveInDate: requestData?.moveInDate || "",
        leaseDuration: requestData?.leaseDuration || "",
        questions: requestData?.questions
          ? JSON.stringify(requestData.questions)
          : "[]",
      },
    );

    console.log("✅ Request document created:", request.$id);

    // Get landlord's user document ID for notifications
    let landlordUserDocId = property.creatorId;

    console.log("Looking up landlord with creatorId:", property.creatorId);

    // Check if property.creatorId is an accountId (not a document ID)
    if (property.creatorId && property.creatorId.length < 36) {
      console.log(
        "Looking up landlord document ID for accountId:",
        property.creatorId,
      );
      const landlordDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", property.creatorId)],
      );

      if (landlordDocs.documents.length > 0) {
        landlordUserDocId = landlordDocs.documents[0].$id;
        console.log("✅ Found landlord document ID:", landlordUserDocId);
      } else {
        console.error(
          "❌ Landlord not found for accountId:",
          property.creatorId,
        );
      }
    }

    // Create in-app notification for landlord
    if (landlordUserDocId) {
      const notificationMessage = `${tenantName || "A tenant"} has requested to rent "${property.propertyName}"${
        requestData?.proposedPrice &&
        requestData.proposedPrice !== property.price
          ? ` with a proposed price of $${requestData.proposedPrice}/month`
          : ""
      }.`;

      console.log("📧 Creating in-app notification for landlord:", {
        userId: landlordUserDocId,
        title: "New Rental Request",
        message: notificationMessage,
      });

      const notification = await databases.createDocument(
        config.databaseId!,
        config.notificationsCollectionId!,
        "unique()",
        {
          userId: landlordUserDocId,
          title: "New Rental Request",
          message: notificationMessage,
          type: "request",
          data: JSON.stringify({
            requestId: request.$id,
            propertyId: propertyId,
            propertyName: property.propertyName,
            tenantId: tenantId,
            tenantName: tenantName,
            proposedPrice: requestData?.proposedPrice,
            originalPrice: property.price,
          }),
          read: false,
        },
      );

      console.log(
        "✅ In-app notification created for landlord:",
        notification.$id,
      );

      // 🚀 SEND PUSH NOTIFICATION TO LANDLORD
      try {
        await notificationService.sendRentalRequestNotification(
          property.creatorId, // Landlord's account ID
          tenantName || "A tenant",
          property.propertyName,
        );
        console.log("✅ Push notification sent to landlord");
      } catch (pushError) {
        console.error("❌ Failed to send push notification:", pushError);
        // Don't throw - push notification failure shouldn't break the request
      }
    } else {
      console.error(
        "❌ Could not create notification - no landlord user ID found",
      );
    }

    return request;
  } catch (error) {
    console.error("❌ Error creating rental request:", error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    console.log("🔔 markAllNotificationsAsRead called for userId:", userId);

    const userDoc = await getUserDocumentByIdOrAccountId(userId);
    const userDocId = userDoc?.$id || userId;

    // Get all unread notifications for this user
    const unreadNotifs = await databases.listDocuments(
      config.databaseId!,
      config.notificationsCollectionId!,
      [Query.equal("userId", userDocId), Query.equal("read", false)],
    );

    console.log(
      "📊 Found unread notifications:",
      unreadNotifs.documents.length,
    );

    // Update each to read = true
    const updates = unreadNotifs.documents.map((doc) =>
      databases.updateDocument(
        config.databaseId!,
        config.notificationsCollectionId!,
        doc.$id,
        { read: true },
      ),
    );
    await Promise.all(updates);
    console.log("✅ All notifications marked as read");
    return true;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return false;
  }
};

export async function searchedProperties({
  filter,
  query,
  limit = 10,
}: {
  filter?: string;
  query?: string;
  limit?: number;
}) {
  try {
    const buildQuery = [Query.orderDesc("$createdAt")];

    // Full‑text search on multiple fields (OR)
    if (query && query.trim() !== "") {
      buildQuery.push(
        Query.or([
          Query.search("propertyName", query),
          Query.search("address", query),
          Query.search("description", query),
          Query.search("type", query),
          Query.search("facilities", query),
        ]),
      );
    }

    // Filter by property type (if not "All")
    if (filter && filter !== "All") {
      buildQuery.push(Query.equal("type", filter));
    }

    // Only available properties
    buildQuery.push(Query.equal("isAvailable", true));

    // Set limit (increase for search results)
    const fetchLimit = query && query.trim() !== "" ? 50 : limit;
    buildQuery.push(Query.limit(fetchLimit));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      buildQuery,
    );

    // (Optional) enrich documents with agent details, reviews, images
    // ... your existing enrichment code here

    return result.documents;
  } catch (error) {
    console.error("Error searching properties:", error);
    return [];
  }
}

// ============================================================================
// BEST PROPERTIES RANKING SYSTEM
// ============================================================================

const DEFAULT_WEIGHTS: RankingWeights = {
  likes: 0.35, // 35% weight
  views: 0.2, // 20% weight
  reviews: 0.2, // 20% weight
  facilities: 0.15, // 15% weight
  requests: 0.1, // 10% weight
};

export const getBestProperties = async (
  limit: number = 10,
  weights: RankingWeights = DEFAULT_WEIGHTS,
  filters?: {
    type?: string;
    minPrice?: number;
    maxPrice?: number;
    city?: string;
  },
): Promise<RankedProperty[]> => {
  try {
    const queries: any[] = [Query.equal("isAvailable", true)];

    if (filters?.type && filters.type !== "All") {
      queries.push(Query.equal("type", filters.type));
    }
    if (filters?.city) {
      queries.push(Query.search("address", filters.city));
    }

    queries.push(Query.limit(100));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      queries,
    );

    const properties = result.documents;

    let filteredProperties = properties;
    if (filters?.minPrice !== undefined) {
      filteredProperties = filteredProperties.filter(
        (p) => p.price >= filters.minPrice!,
      );
    }
    if (filters?.maxPrice !== undefined) {
      filteredProperties = filteredProperties.filter(
        (p) => p.price <= filters.maxPrice!,
      );
    }

    if (filteredProperties.length === 0) return [];

    let maxLikes = 0,
      maxViews = 0,
      maxReviews = 0,
      maxFacilities = 0,
      maxRequests = 0;
    let minLikes = Infinity,
      minViews = Infinity,
      minReviews = Infinity,
      minFacilities = Infinity,
      minRequests = Infinity;

    const propertyMetrics = filteredProperties.map((property) => {
      const reviewsData = parseReviews(property.reviews);
      const facilitiesCount = getFacilitiesCount(property.facilities);
      const likes = property.likes || 0;
      const views = property.views || 0;
      const reviews = reviewsData.count;
      const facilities = facilitiesCount;
      const requests = property.requests || 0;

      maxLikes = Math.max(maxLikes, likes);
      maxViews = Math.max(maxViews, views);
      maxReviews = Math.max(maxReviews, reviews);
      maxFacilities = Math.max(maxFacilities, facilities);
      maxRequests = Math.max(maxRequests, requests);

      minLikes = Math.min(minLikes, likes);
      minViews = Math.min(minViews, views);
      minReviews = Math.min(minReviews, reviews);
      minFacilities = Math.min(minFacilities, facilities);
      minRequests = Math.min(minRequests, requests);

      return {
        property,
        likes,
        views,
        reviews,
        facilities,
        requests,
        averageRating: reviewsData.averageRating,
      };
    });

    const ranked = propertyMetrics.map(
      ({
        property,
        likes,
        views,
        reviews,
        facilities,
        requests,
        averageRating,
      }) => {
        const likesScore = normalize(likes, minLikes, maxLikes);
        const viewsScore = normalize(views, minViews, maxViews);
        const reviewsScore = normalize(reviews, minReviews, maxReviews);
        const facilitiesScore = normalize(
          facilities,
          minFacilities,
          maxFacilities,
        );
        const requestsScore = normalize(requests, minRequests, maxRequests);

        const totalScore =
          likesScore * weights.likes +
          viewsScore * weights.views +
          reviewsScore * weights.reviews +
          facilitiesScore * weights.facilities +
          requestsScore * weights.requests;

        return {
          ...(property as unknown as PropertyData),
          rating: Number(averageRating.toFixed(1)),
          score: totalScore,
          rankingDetails: {
            likesScore: Number((likesScore * 100).toFixed(1)),
            viewsScore: Number((viewsScore * 100).toFixed(1)),
            reviewsScore: Number((reviewsScore * 100).toFixed(1)),
            facilitiesScore: Number((facilitiesScore * 100).toFixed(1)),
            requestsScore: Number((requestsScore * 100).toFixed(1)),
          },
        };
      },
    );

    const sorted = ranked.sort((a, b) => b.score - a.score);
    return sorted.slice(0, limit).map((property: any, index) => ({
      ...property,
      rank: index + 1,
    }));
  } catch (error) {
    console.error("Error fetching best properties:", error);
    return [];
  }
};

// Helper functions for different ranking types
export const getTopRatedProperties = async (
  limit: number = 10,
): Promise<RankedProperty[]> => {
  return getBestProperties(limit, {
    likes: 0,
    views: 0,
    reviews: 1,
    facilities: 0,
    requests: 0,
  });
};

export const getMostPopularProperties = async (
  limit: number = 10,
): Promise<RankedProperty[]> => {
  return getBestProperties(limit, {
    likes: 0.6,
    views: 0.4,
    reviews: 0,
    facilities: 0,
    requests: 0,
  });
};

export const getMostRequestedProperties = async (
  limit: number = 10,
): Promise<RankedProperty[]> => {
  return getBestProperties(limit, {
    likes: 0,
    views: 0,
    reviews: 0,
    facilities: 0,
    requests: 1,
  });
};

export const getBestFacilitiesProperties = async (
  limit: number = 10,
): Promise<RankedProperty[]> => {
  return getBestProperties(limit, {
    likes: 0,
    views: 0,
    reviews: 0,
    facilities: 1,
    requests: 0,
  });
};

// lib/appwrite.ts - Add cleanup function for Appwrite notifications
export const cleanupOldAppwriteNotifications = async (userId: string) => {
  try {
    console.log("🧹 Cleaning up old Appwrite notifications...");

    const userDoc = await getUserDocumentByIdOrAccountId(userId);
    const userDocId = userDoc?.$id || userId;

    // Get read notifications older than 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const notificationsByDocId = await databases.listDocuments(
      config.databaseId!,
      config.notificationsCollectionId!,
      [
        Query.equal("userId", userDocId),
        Query.equal("read", true),
        Query.lessThan("$createdAt", oneDayAgo.toISOString()),
        Query.limit(100),
      ],
    );

    let oldNotifications = [...notificationsByDocId.documents];

    if (userDocId !== userId) {
      const notificationsByAccountId = await databases.listDocuments(
        config.databaseId!,
        config.notificationsCollectionId!,
        [
          Query.equal("userId", userId),
          Query.equal("read", true),
          Query.lessThan("$createdAt", oneDayAgo.toISOString()),
          Query.limit(100),
        ],
      );
      oldNotifications = Array.from(
        new Map(
          [...oldNotifications, ...notificationsByAccountId.documents].map(
            (doc) => [doc.$id, doc],
          ),
        ).values(),
      );
    }

    console.log(
      `📊 Found ${oldNotifications.length} old notifications to delete`,
    );

    // Delete them
    const deletions = oldNotifications.map((doc) =>
      databases.deleteDocument(
        config.databaseId!,
        config.notificationsCollectionId!,
        doc.$id,
      ),
    );

    await Promise.all(deletions);
    console.log(`✅ Deleted ${deletions.length} old notifications`);

    return deletions.length;
  } catch (error) {
    console.error("Error cleaning up old notifications:", error);
    return 0;
  }
};

// Complete solution with cleanup and limits
const VIEW_STORAGE_KEY_PREFIX = "property_view_";

const getLastViewKey = (userId: string, propertyId: string) =>
  `${VIEW_STORAGE_KEY_PREFIX}${userId}_${propertyId}`;

// Optional: Clean up old view timestamps (run occasionally)
export const cleanupOldViewTimestamps = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const viewKeys = allKeys.filter((key) =>
      key.startsWith(VIEW_STORAGE_KEY_PREFIX),
    );
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000; // Keep data for 7 days max
    let deletedCount = 0;

    for (const key of viewKeys) {
      const timestamp = await AsyncStorage.getItem(key);
      if (timestamp && now - parseInt(timestamp) > sevenDays) {
        await AsyncStorage.removeItem(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 Cleaned up ${deletedCount} old view timestamps`);
    }
  } catch (error) {
    console.error("Error cleaning up view timestamps:", error);
  }
};

export const incrementPropertyViews = async (
  propertyId: string,
  userId?: string,
) => {
  try {
    // Don't count views for own properties (optional)
    // if (isOwnProperty) return;

    // Handle anonymous users (still count but can't track 24h window)
    if (!userId) {
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
      );
      const currentViews = property.views || 0;
      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
        { views: currentViews + 1 },
      );
      console.log(`✅ Anonymous view counted for property ${propertyId}`);
      return;
    }

    const lastViewKey = getLastViewKey(userId, propertyId);
    const lastViewTimestamp = await AsyncStorage.getItem(lastViewKey);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    // Check if this is a new view (not within 24 hours)
    const shouldCountView =
      !lastViewTimestamp ||
      now - parseInt(lastViewTimestamp) >= twentyFourHours;

    if (shouldCountView) {
      // Get current property data
      const property = await databases.getDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
      );

      const currentViews = property.views || 0;
      const newViewCount = currentViews + 1;

      // Update view count in database
      await databases.updateDocument(
        config.databaseId!,
        config.propertiesCollectionId!,
        propertyId,
        { views: newViewCount },
      );

      // Store the timestamp of this view
      await AsyncStorage.setItem(lastViewKey, now.toString());

      // Optional: Update local state if needed
      // store.updatePropertyViews(propertyId, newViewCount);

      console.log(
        `✅ View counted for property ${propertyId} by user ${userId}. New total: ${newViewCount}`,
      );
    } else {
      // Don't count this view
      const timeElapsed = now - parseInt(lastViewTimestamp!);
      const hoursElapsed = (timeElapsed / (60 * 60 * 1000)).toFixed(1);
      const hoursRemaining = (
        (twentyFourHours - timeElapsed) /
        (60 * 60 * 1000)
      ).toFixed(1);

      console.log(
        `⏸️ View not counted for property ${propertyId} - Last view: ${hoursElapsed}h ago. ${hoursRemaining}h remaining`,
      );
    }
  } catch (error) {
    console.error("Error incrementing views:", error);
  }
};

// Optional: Function to get remaining time until next view will count
export const getTimeUntilNextViewCount = async (
  propertyId: string,
  userId: string,
): Promise<number | null> => {
  try {
    if (!userId) return null;

    const lastViewKey = getLastViewKey(userId, propertyId);
    const lastViewTimestamp = await AsyncStorage.getItem(lastViewKey);

    if (!lastViewTimestamp) return 0; // Can view now

    const now = Date.now();
    const lastView = parseInt(lastViewTimestamp);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    const timeElapsed = now - lastView;

    if (timeElapsed >= twentyFourHours) return 0; // Can view now

    return twentyFourHours - timeElapsed; // Milliseconds until next view counts
  } catch (error) {
    console.error("Error getting time until next view:", error);
    return null;
  }
};

// Price filter options
export type PriceRange = {
  min: number;
  max: number;
  label: string;
};

export const PRICE_RANGES: PriceRange[] = [
  { min: 0, max: 100, label: "Under $100" },
  { min: 100, max: 200, label: "$100 - $200" },
  { min: 200, max: 300, label: "$200 - $300" },
  { min: 300, max: 400, label: "$300 - $400" },
  { min: 400, max: 500, label: "$400 - $500" },
  { min: 500, max: 600, label: "$500 - $600" },
  { min: 600, max: 700, label: "$600 - $700" },
  { min: 700, max: 800, label: "$700 - $800" },
  { min: 800, max: 900, label: "$800 - $900" },
  { min: 900, max: 1000, label: "$900 - $1000" },
  { min: 1000, max: 1500, label: "$1000 - $1500" },
  { min: 1500, max: 2000, label: "$1500 - $2000" },
  { min: 2000, max: 3000, label: "$2000 - $3000" },
  { min: 3000, max: 5000, label: "$3000 - $5000" },
  { min: 5000, max: 10000, label: "$5000+" },
];

// Custom price ranges
export interface CustomPriceRange {
  min: number;
  max: number;
}

// Get properties with price filter
export async function getPropertiesWithPriceFilter({
  filter,
  query,
  limit,
  priceRange,
  customPrice,
}: {
  filter: string;
  query: string;
  limit?: number;
  priceRange?: PriceRange;
  customPrice?: CustomPriceRange;
}) {
  try {
    const buildQuery = [Query.orderDesc("$createdAt")];

    // Add price filter
    if (priceRange) {
      if (priceRange.max === 10000) {
        // For "$5000+" - only min price
        buildQuery.push(Query.greaterThanEqual("price", priceRange.min));
      } else {
        // Normal range
        buildQuery.push(Query.between("price", priceRange.min, priceRange.max));
      }
    } else if (customPrice) {
      buildQuery.push(Query.between("price", customPrice.min, customPrice.max));
    }

    // Add text search
    if (query && query.trim() !== "") {
      const searchTerm = query.trim();
      const isNumericSearch = /^\d+$/.test(searchTerm);

      if (isNumericSearch) {
        const priceNum = parseInt(searchTerm);
        buildQuery.push(
          Query.or([
            Query.equal("price", priceNum),
            Query.between("price", priceNum - 50, priceNum + 50),
          ]),
        );
        buildQuery.push(
          Query.or([
            Query.search("propertyName", searchTerm),
            Query.search("facilities", searchTerm),
            Query.search("description", searchTerm),
            Query.search("address", searchTerm),
            Query.search("type", searchTerm),
          ]),
        );
      } else {
        buildQuery.push(
          Query.or([
            Query.search("propertyName", searchTerm),
            Query.search("facilities", searchTerm),
            Query.search("description", searchTerm),
            Query.search("address", searchTerm),
            Query.search("type", searchTerm),
          ]),
        );
      }
    }

    // Add type filter
    if (filter && filter !== "All") {
      buildQuery.push(Query.equal("type", filter));
    }

    // Add limit
    const fetchLimit = query && query.trim() !== "" ? 50 : limit || 10;
    buildQuery.push(Query.limit(fetchLimit));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      buildQuery,
    );

    // Process properties with details
    let propertiesWithDetails = await Promise.all(
      result.documents.map(async (property) => {
        // Agent - Fetch from USERS collection
        if (property.agent) {
          try {
            const agent = await databases.getDocument(
              config.databaseId!,
              config.usersCollectionId!,
              property.agent,
            );
            property.agent = agent;
          } catch (error) {
            property.agent = null;
          }
        }

        // Calculate rating from reviews
        if (property.reviews) {
          try {
            const parsedReviews = JSON.parse(property.reviews);
            if (parsedReviews.length > 0) {
              const sum = parsedReviews.reduce(
                (acc: number, r: any) => acc + (r.rating || 0),
                0,
              );
              property.rating = Number((sum / parsedReviews.length).toFixed(1));
            } else {
              property.rating = 0;
            }
          } catch (e) {
            property.rating = 0;
          }
        } else {
          property.rating = 0;
        }

        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error("Error in getPropertiesWithPriceFilter:", error);
    return [];
  }
}

// Get price statistics for properties
export async function getPriceStats() {
  try {
    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      [Query.limit(1000)],
    );

    const prices = result.documents.map((p) => p.price).filter((p) => p > 0);

    if (prices.length === 0) return null;

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      average: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      median: prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)],
    };
  } catch (error) {
    console.error("Error getting price stats:", error);
    return null;
  }
}

// roommate matching system

export interface MatchProfile {
  $id: string;
  userId: string;
  userType: "student" | "tenant" | "professional";
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: string;
  gender: "male" | "female";
  preferredGender: "male" | "female" | "any";
  budget: number;
  preferredLocation: string;
  preferredRoommateType: string;
  lifestyle: string;
  about: string;
  moveInDate: string;
  lookingFor: string;
  isActive: boolean;
}

export const createMatchProfile = async (
  profile: Omit<MatchProfile, "$id" | "createdAt">,
) => {
  try {
    const result = await databases.createDocument(
      config.databaseId!,
      config.matchProfilesCollectionId!,
      ID.unique(),
      {
        ...profile,
        lifestyle: Array.isArray(profile.lifestyle)
          ? JSON.stringify(profile.lifestyle)
          : profile.lifestyle,
      },
    );

    // 🚀 SEND NOTIFICATIONS TO ALL TENANTS WHEN NEW MATCH PROFILE IS CREATED
    try {
      // Get all active match profiles (potential matches)
      const allProfiles = await databases.listDocuments(
        config.databaseId!,
        config.matchProfilesCollectionId!,
        [Query.equal("isActive", true)],
      );

      // Find compatible matches based on location, gender, and budget
      const compatibleMatches = allProfiles.documents.filter((p) => {
        if (p.userId === profile.userId) return false; // Skip self

        // Location match (must be same or similar)
        const locationMatch =
          p.preferredLocation &&
          profile.preferredLocation &&
          (p.preferredLocation
            .toLowerCase()
            .includes(profile.preferredLocation.toLowerCase()) ||
            profile.preferredLocation
              .toLowerCase()
              .includes(p.preferredLocation.toLowerCase()));

        // Gender compatibility
        const genderMatch =
          (p.preferredGender === "any" ||
            p.preferredGender === profile.gender) &&
          (profile.preferredGender === "any" ||
            profile.preferredGender === p.gender);

        // Budget compatibility (within 20% range)
        const budgetMatch =
          p.budget &&
          profile.budget &&
          Math.abs(p.budget - profile.budget) <=
            Math.max(p.budget, profile.budget) * 0.2;

        return locationMatch && genderMatch && budgetMatch;
      });

      // Send notifications to each compatible match
      for (const match of compatibleMatches) {
        await notificationService.sendMatchNotification(
          match.userId,
          profile.name,
          profile.preferredLocation,
        );
        console.log(`📱 Sent match notification to ${match.name}`);
      }

      console.log(`✅ Sent ${compatibleMatches.length} match notifications`);
    } catch (notifyError) {
      console.error("Error sending match notifications:", notifyError);
    }

    return result;
  } catch (error) {
    console.error("Error creating match profile:", error);
    throw error;
  }
};

// Store previous matches to detect new ones
let previousMatchCache: Map<string, Set<string>> = new Map();

export const getMatchProfiles = async (filters?: {
  location?: string;
  myGender?: "male" | "female";
  preferredGender?: "male" | "female";
  myBudget?: number;
  currentUserId?: string; // Add current user ID to track matches
}) => {
  try {
    console.log("🔍 getMatchProfiles called with filters:", filters);

    if (!filters?.location) {
      console.log("⏳ Waiting for location...");
      return []; // but ONLY if truly missing
    }
    // Get all active profiles
    const result = await databases.listDocuments(
      config.databaseId!,
      config.matchProfilesCollectionId!,
      [Query.equal("isActive", true)],
    );

    let profiles = result.documents.map((doc) => ({
      ...doc,
      lifestyle: doc.lifestyle
        ? (() => {
            try {
              return JSON.parse((doc as any).lifestyle);
            } catch {
              return (doc as any).lifestyle?.split(", ").filter(Boolean) || [];
            }
          })()
        : [],
    })) as unknown as MatchProfile[];

    let originalCount = profiles.length;
    console.log(`📊 Total active profiles: ${originalCount}`);

    // 1. FILTER BY LOCATION (REQUIRED)
    if (filters?.location && filters.location.trim()) {
      const normalizedLocation = filters.location.trim().toLowerCase();
      profiles = profiles.filter((p) => {
        const locationValue = p.preferredLocation || "";
        return locationValue.toLowerCase().includes(normalizedLocation);
      });
      console.log(
        `📍 After location filter (${filters.location}): ${profiles.length} profiles (from ${originalCount})`,
      );
      originalCount = profiles.length;
    } else {
      console.log("⚠️ No location filter provided - returning empty");
      return [];
    }

    // 2. FILTER BY GENDER COMPATIBILITY (REQUIRED)
    if (filters?.myGender && filters?.preferredGender) {
      profiles = profiles.filter((p) => {
        if (!p.gender || !p.preferredGender) return false;

        // They want me: their preferred gender matches my actual gender
        const theyWantMe =
          (p.preferredGender as string) === "any" ||
          p.preferredGender === filters.myGender;

        // I want them: my preferred gender matches their actual gender
        const iWantThem =
          (filters.preferredGender as string) === "any" ||
          filters.preferredGender === p.gender; // ✅ fixed

        return theyWantMe && iWantThem;
      });
      console.log(`👥 After gender filter: ${profiles.length} profiles`);
      originalCount = profiles.length;
    } else {
      console.log("⚠️ No gender filters provided - returning empty");
      return [];
    }

    // 3. FILTER BY BUDGET (within 20% range)
    if (filters?.myBudget && filters.myBudget > 0) {
      profiles = profiles.filter((p) => {
        if (!p.budget || p.budget <= 0) return false;

        const difference = Math.abs(p.budget - filters.myBudget!);
        const maxDifference = Math.max(p.budget, filters.myBudget!) * 0.2; // 20% tolerance

        return difference <= maxDifference;
      });
      console.log(`💰 After budget filter: ${profiles.length} profiles`);
    }

    // 🚀 SEND PUSH NOTIFICATIONS FOR NEW MATCHES
    if (filters?.currentUserId && profiles.length > 0) {
      const cacheKey = `${filters.currentUserId}_${filters.location || ""}_${filters.myGender || ""}_${filters.preferredGender || ""}_${filters.myBudget || ""}`;
      const previousMatches = previousMatchCache.get(cacheKey) || new Set();
      const currentMatchIds = new Set(profiles.map((p) => p.userId));

      // Find new matches (not in previous cache)
      const newMatches = profiles.filter((p) => !previousMatches.has(p.userId));

      if (newMatches.length > 0) {
        console.log(
          `🎯 Found ${newMatches.length} new matches for user ${filters.currentUserId}`,
        );

        // Send notifications for new matches
        for (const match of newMatches) {
          try {
            await notificationService.sendMatchNotification(
              filters.currentUserId,
              match.name,
              match.preferredLocation,
            );
            console.log(`📱 Sent match notification for: ${match.name}`);
          } catch (notifyError) {
            console.error(
              `Failed to send notification for match ${match.name}:`,
              notifyError,
            );
          }
        }

        // Update cache
        previousMatchCache.set(cacheKey, currentMatchIds);
      }
    }

    console.log(`✅ Final matches: ${profiles.length} profiles`);
    return profiles;
  } catch (error) {
    console.error("Error fetching match profiles:", error);
    return [];
  }
};

export const getUserMatchProfile = async (userId: string) => {
  try {
    const result = await databases.listDocuments(
      config.databaseId!,
      config.matchProfilesCollectionId!,
      [Query.equal("userId", userId)],
    );
    return result.documents[0] || null;
  } catch (error) {
    console.error("Error fetching user match profile:", error);
    return null;
  }
};

export const updateMatchProfile = async (
  profileId: string,
  updates: Partial<MatchProfile>,
) => {
  try {
    const sanitized = {
      ...updates,
      ...(updates.lifestyle && Array.isArray(updates.lifestyle)
        ? { lifestyle: JSON.stringify(updates.lifestyle) }
        : {}),
    };
    const result = await databases.updateDocument(
      config.databaseId!,
      config.matchProfilesCollectionId!,
      profileId,
      sanitized,
    );
    return result;
  } catch (error) {
    console.error("Error updating match profile:", error);
    throw error;
  }
};

export const deleteMatchProfile = async (profileId: string) => {
  try {
    await databases.deleteDocument(
      config.databaseId!,
      config.matchProfilesCollectionId!,
      profileId,
    );
    return true;
  } catch (error) {
    console.error("Error deleting match profile:", error);
    return false;
  }
};

export async function getAvailableProperties({
  filter,
  query,
  limit,
  creatorId,
}: {
  filter?: string;
  query?: string;
  limit?: number;
  creatorId?: string;
}) {
  try {
    const buildQuery = [Query.orderDesc("$createdAt")];

    if (creatorId) {
      buildQuery.push(Query.equal("creatorId", creatorId));
    }

    if (filter && filter !== "All") {
      buildQuery.push(Query.equal("type", filter));
    }

    if (query && query.trim() !== "") {
      buildQuery.push(
        Query.or([
          Query.search("propertyName", query),
          Query.search("address", query),
          Query.search("description", query),
          Query.search("type", query),
        ]),
      );
    }

    const fetchLimit = query && query.trim() !== "" ? 50 : limit || 10;
    buildQuery.push(Query.limit(fetchLimit));

    const result = await databases.listDocuments(
      config.databaseId!,
      config.propertiesCollectionId!,
      buildQuery,
    );

    // ✅ ADD THIS: Process documents to calculate ratings
    const propertiesWithDetails = await Promise.all(
      result.documents.map(async (property) => {
        // Calculate rating from reviews
        if (property.reviews) {
          try {
            const parsedReviews = JSON.parse(property.reviews);
            if (parsedReviews.length > 0) {
              const sum = parsedReviews.reduce(
                (acc: number, r: any) => acc + (r.rating || 0),
                0,
              );
              property.rating = Number((sum / parsedReviews.length).toFixed(1));
            } else {
              property.rating = 0;
            }
          } catch (e) {
            property.rating = 0;
          }
        } else {
          property.rating = 0;
        }

        return property;
      }),
    );

    return propertiesWithDetails;
  } catch (error) {
    console.error("Error in getAvailableProperties:", error);
    return [];
  }
}
