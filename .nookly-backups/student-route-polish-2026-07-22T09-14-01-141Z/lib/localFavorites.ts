// lib/localFavorites.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const FAVORITES_KEY = "@rentify:favorites";

export interface FavoriteProperty {
  $id: string;
  propertyName?: string;
  type: string;
  address: string;
  price: number;
  image1?: string;
  image2?: string;
  image3?: string;
  rating?: number;
  creatorId?: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  creatorAvatar?: string;
}

// Get all favorites from local storage
export const getFavorites = async (): Promise<FavoriteProperty[]> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_KEY);
    return favoritesJson ? JSON.parse(favoritesJson) : [];
  } catch (error) {
    console.error("Error getting favorites:", error);
    return [];
  }
};

// Add a property to favorites
export const addToFavorites = async (
  property: FavoriteProperty,
): Promise<void> => {
  try {
    const favorites = await getFavorites();

    // Check if already exists
    const exists = favorites.some((fav) => fav.$id === property.$id);
    if (!exists) {
      const updatedFavorites = [...favorites, property];
      await AsyncStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(updatedFavorites),
      );
      console.log("✅ Added to favorites:", property.propertyName);
    }
  } catch (error) {
    console.error("Error adding to favorites:", error);
    throw error;
  }
};

// Remove a property from favorites
export const removeFromFavorites = async (
  propertyId: string,
): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const updatedFavorites = favorites.filter((fav) => fav.$id !== propertyId);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
    console.log("✅ Removed from favorites:", propertyId);
  } catch (error) {
    console.error("Error removing from favorites:", error);
    throw error;
  }
};

// Check if a property is favorited
export const isFavorite = async (propertyId: string): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    return favorites.some((fav) => fav.$id === propertyId);
  } catch (error) {
    console.error("Error checking favorite:", error);
    return false;
  }
};

// Clear all favorites (optional)
export const clearFavorites = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(FAVORITES_KEY);
    console.log("✅ All favorites cleared");
  } catch (error) {
    console.error("Error clearing favorites:", error);
  }
};
