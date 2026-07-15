// lib/localFavorites.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Avatars, Client, Query } from "react-native-appwrite";
import { account, databases } from "./appwrite";
export const config = {
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID,
  reviewsCollectionId: process.env.EXPO_PUBLIC_APPWRITE_REVIEWS_COLLECTION_ID,
  favoritesCollectionId:
    process.env.EXPO_PUBLIC_APPWRITE_FAVORITES_COLLECTION_ID,
};
const FAVORITES_KEY = "favorites";
export const client = new Client();
const avatars = new Avatars(client);
export const addFavoriteLocal = async (property: any) => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];

    // Avoid duplicates
    const exists = favorites.find((fav: any) => fav.$id === property.$id);
    if (!exists) {
      favorites.push(property);
      await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      console.log("Added to favorites:", property);
    }
  } catch (err) {
    console.error("Error adding favorite:", err);
  }
};

export const removeFavoriteLocal = async (propertyId: string) => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    const favorites = data ? JSON.parse(data) : [];
    const updated = favorites.filter((fav: any) => fav.$id !== propertyId);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    console.log("Removed from favorites:", propertyId);
  } catch (err) {
    console.error("Error removing favorite:", err);
  }
};

export const addFavoriteId = async (propertyId: string) => {
  const user = await account.get();

  return databases.createDocument(
    config.databaseId!,
    config.favoritesCollectionId!,
    "unique()", // auto-generate ID
    {
      userId: user.$id,
      propertyId,
    },
  );
};

export const removeFavoriteId = async (propertyId: string) => {
  const user = await account.get();

  // Find the favorite document
  const res = await databases.listDocuments(
    config.databaseId!,
    config.favoritesCollectionId!,
    [Query.equal("userId", user.$id), Query.equal("propertyId", propertyId)],
  );

  if (res.documents.length > 0) {
    await databases.deleteDocument(
      config.databaseId!,
      config.favoritesCollectionId!,
      res.documents[0].$id,
    );
  }
};

export const getFavoritesByUser = async () => {
  const user = await account.get();

  const res = await databases.listDocuments(
    config.databaseId!,
    config.favoritesCollectionId!,
    [Query.equal("userId", user.$id)],
  );

  return res.documents.map((doc) => doc.propertyId);
};

export const getFavoritesLocal = async () => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Error loading favorites:", err);
    return [];
  }
};
