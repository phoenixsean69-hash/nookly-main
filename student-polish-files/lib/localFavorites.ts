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
  views?: number;
  bedrooms?: number;
  bathrooms?: number;
  facilities?: string | string[] | object;
  creatorId?: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  creatorAvatar?: string;
  cachedAt?: string;
}

export const getFavorites = async (): Promise<FavoriteProperty[]> => {
  try {
    const favoritesJson = await AsyncStorage.getItem(FAVORITES_KEY);
    if (!favoritesJson) return [];
    const parsed = JSON.parse(favoritesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Error getting favorites:", error);
    return [];
  }
};

export const addToFavorites = async (
  property: FavoriteProperty,
): Promise<void> => {
  try {
    const favorites = await getFavorites();
    const cachedProperty: FavoriteProperty = {
      ...property,
      cachedAt: new Date().toISOString(),
    };
    const existingIndex = favorites.findIndex(
      (favorite) => favorite.$id === property.$id,
    );
    const updatedFavorites =
      existingIndex >= 0
        ? favorites.map((favorite, index) =>
            index === existingIndex
              ? { ...favorite, ...cachedProperty }
              : favorite,
          )
        : [...favorites, cachedProperty];

    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updatedFavorites));
  } catch (error) {
    console.error("Error caching favorite:", error);
    throw error;
  }
};

export const removeFromFavorites = async (
  propertyId: string,
): Promise<void> => {
  try {
    const favorites = await getFavorites();
    await AsyncStorage.setItem(
      FAVORITES_KEY,
      JSON.stringify(
        favorites.filter((favorite) => favorite.$id !== propertyId),
      ),
    );
  } catch (error) {
    console.error("Error removing favorite:", error);
    throw error;
  }
};

export const isFavorite = async (propertyId: string): Promise<boolean> => {
  try {
    const favorites = await getFavorites();
    return favorites.some((favorite) => favorite.$id === propertyId);
  } catch (error) {
    console.error("Error checking favorite:", error);
    return false;
  }
};

export const clearFavorites = async (): Promise<void> => {
  await AsyncStorage.removeItem(FAVORITES_KEY);
};
