import useAuthStore from "@/store/auth.store";

import { initializeOfflineDatabase } from "./offline/database";
import {
  clearOfflineFavorites,
  getOfflineFavorites,
  hasOfflineFavorite,
  migrateLegacyFavorites,
  removeOfflineFavorite,
  upsertOfflineFavorite,
} from "./offline/favorite.repository";

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
  organizationApproved?: boolean | string;
  cachedAt?: string;
}

const getFavoriteOwnerId = (): string =>
  useAuthStore.getState().user?.accountId ?? "anonymous";

const prepareFavorites = async (): Promise<string> => {
  const userId = getFavoriteOwnerId();
  await initializeOfflineDatabase();
  await migrateLegacyFavorites(userId);
  return userId;
};

export const getFavorites = async (): Promise<FavoriteProperty[]> => {
  try {
    const userId = await prepareFavorites();
    return await getOfflineFavorites<FavoriteProperty>(userId);
  } catch (error) {
    console.error("Error getting favorites:", error);
    return [];
  }
};

export const addToFavorites = async (
  property: FavoriteProperty,
): Promise<void> => {
  const userId = await prepareFavorites();
  await upsertOfflineFavorite(userId, property);
};

export const removeFromFavorites = async (
  propertyId: string,
): Promise<void> => {
  const userId = await prepareFavorites();
  await removeOfflineFavorite(userId, propertyId);
};

export const isFavorite = async (propertyId: string): Promise<boolean> => {
  try {
    const userId = await prepareFavorites();
    return await hasOfflineFavorite(userId, propertyId);
  } catch (error) {
    console.error("Error checking favorite:", error);
    return false;
  }
};

export const clearFavorites = async (): Promise<void> => {
  const userId = await prepareFavorites();
  await clearOfflineFavorites(userId);
};