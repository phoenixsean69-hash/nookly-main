// services/localDatabase.service.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// Types
export interface LocalUser {
  authState: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  userAvatar: string;
  userMode: "tenant" | "landlord";
  lastSync: string;
}

export interface LocalFavorite {
  propertyId: string;
  propertyName: string;
  type: string;
  address: string;
  price: number;
  image1?: string;
  image2?: string;
  image3?: string;
  rating: number;
  addedAt: string;
}

export interface LocalProperty {
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
  facilities: string;
  image1?: string;
  image2?: string;
  image3?: string;
  creatorName?: string;
  creatorEmail?: string;
  creatorPhone?: string;
  creatorAvatar?: string;
  isAvailable?: boolean;
  cachedAt: string;
}

// services/localDatabase.service.ts - Update STORAGE_KEYS
const STORAGE_KEYS = {
  USER: "@rentify:user",
  FAVORITES: "user_favorites", // Changed to match your existing key
  CACHED_PROPERTIES: "@rentify:cached_properties",
  USER_REVIEWS: "@rentify:user_reviews",
  USER_LIKES: "@rentify:user_likes",
  USER_APPLICATIONS: "@rentify:user_applications",
};
class LocalDatabase {
  // ============ USER MANAGEMENT ============

  /**
   * Save user data locally
   */
  async saveUser(user: LocalUser): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      console.log("✅ User saved locally:", user.userName);
    } catch (error) {
      console.error("❌ Error saving user:", error);
    }
  }

  /**
   * Get user from local storage
   */
  async getUser(): Promise<LocalUser | null> {
    try {
      const userStr = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      if (userStr) {
        return JSON.parse(userStr);
      }
      return null;
    } catch (error) {
      console.error("❌ Error getting user:", error);
      return null;
    }
  }

  /**
   * Update user auth state
   */
  async updateAuthState(authState: boolean): Promise<void> {
    try {
      const user = await this.getUser();
      if (user) {
        user.authState = authState;
        user.lastSync = new Date().toISOString();
        await this.saveUser(user);
      }
    } catch (error) {
      console.error("❌ Error updating auth state:", error);
    }
  }

  /**
   * Update user avatar
   */
  async updateUserAvatar(avatarUrl: string): Promise<void> {
    try {
      const user = await this.getUser();
      if (user) {
        user.userAvatar = avatarUrl;
        user.lastSync = new Date().toISOString();
        await this.saveUser(user);
      }
    } catch (error) {
      console.error("❌ Error updating avatar:", error);
    }
  }

  /**
   * Clear user data (logout)
   */
  async clearUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      console.log("✅ User cleared from local storage");
    } catch (error) {
      console.error("❌ Error clearing user:", error);
    }
  }

  // ============ FAVORITES MANAGEMENT ============

  /**
   * Add property to favorites
   */
  async addFavorite(property: LocalFavorite): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const exists = favorites.some(
        (fav) => fav.propertyId === property.propertyId,
      );

      if (!exists) {
        favorites.push(property);
        await AsyncStorage.setItem(
          STORAGE_KEYS.FAVORITES,
          JSON.stringify(favorites),
        );
        console.log("✅ Property added to favorites:", property.propertyName);
      }
    } catch (error) {
      console.error("❌ Error adding favorite:", error);
    }
  }

  /**
   * Remove property from favorites
   */
  async removeFavorite(propertyId: string): Promise<void> {
    try {
      const favorites = await this.getFavorites();
      const filtered = favorites.filter((fav) => fav.propertyId !== propertyId);
      await AsyncStorage.setItem(
        STORAGE_KEYS.FAVORITES,
        JSON.stringify(filtered),
      );
      console.log("✅ Property removed from favorites:", propertyId);
    } catch (error) {
      console.error("❌ Error removing favorite:", error);
    }
  }

  /**
   * Get all favorites
   */
  // services/localDatabase.service.ts - Update getFavorites function

  // services/localDatabase.service.ts - Update getFavorites

  // services/localDatabase.service.ts

  async getFavorites(): Promise<any[]> {
    try {
      const favoritesStr = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
      console.log("📂 getFavorites called, has data:", !!favoritesStr);

      if (favoritesStr) {
        const parsed = JSON.parse(favoritesStr);
        console.log("📂 Returning raw favorites count:", parsed.length);
        return parsed;
      }

      return [];
    } catch (error) {
      console.error("❌ Error getting favorites:", error);
      return [];
    }
  }

  /**
   * Check if property is favorite
   */
  async isFavorite(propertyId: string): Promise<boolean> {
    try {
      const favorites = await this.getFavorites();
      return favorites.some((fav) => fav.propertyId === propertyId);
    } catch (error) {
      console.error("❌ Error checking favorite:", error);
      return false;
    }
  }

  /**
   * Clear all favorites
   */
  async clearFavorites(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.FAVORITES);
      console.log("✅ All favorites cleared");
    } catch (error) {
      console.error("❌ Error clearing favorites:", error);
    }
  }

  // ============ CACHED PROPERTIES MANAGEMENT ============

  /**
   * Cache a property locally
   */
  async cacheProperty(property: any): Promise<void> {
    try {
      const cachedProperties = await this.getCachedProperties();

      // Check if already cached
      const index = cachedProperties.findIndex((p) => p.$id === property.$id);

      const cachedProperty: LocalProperty = {
        ...property,
        cachedAt: new Date().toISOString(),
      };

      if (index !== -1) {
        // Update existing
        cachedProperties[index] = cachedProperty;
      } else {
        // Add new
        cachedProperties.push(cachedProperty);
      }

      // Keep only last 100 properties
      const trimmed = cachedProperties.slice(-100);

      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_PROPERTIES,
        JSON.stringify(trimmed),
      );
      console.log("✅ Property cached:", property.propertyName);
    } catch (error) {
      console.error("❌ Error caching property:", error);
    }
  }

  /**
   * Get all cached properties
   */
  async getCachedProperties(): Promise<LocalProperty[]> {
    try {
      const cachedStr = await AsyncStorage.getItem(
        STORAGE_KEYS.CACHED_PROPERTIES,
      );
      if (cachedStr) {
        return JSON.parse(cachedStr);
      }
      return [];
    } catch (error) {
      console.error("❌ Error getting cached properties:", error);
      return [];
    }
  }

  /**
   * Get a specific cached property by ID
   */
  async getCachedProperty(propertyId: string): Promise<LocalProperty | null> {
    try {
      const properties = await this.getCachedProperties();
      return properties.find((p) => p.$id === propertyId) || null;
    } catch (error) {
      console.error("❌ Error getting cached property:", error);
      return null;
    }
  }

  /**
   * Clear old cache (older than 7 days)
   */
  async clearOldCache(): Promise<void> {
    try {
      const properties = await this.getCachedProperties();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const fresh = properties.filter(
        (p) => new Date(p.cachedAt) > sevenDaysAgo,
      );

      await AsyncStorage.setItem(
        STORAGE_KEYS.CACHED_PROPERTIES,
        JSON.stringify(fresh),
      );
      console.log(
        `✅ Cleared ${properties.length - fresh.length} old cached properties`,
      );
    } catch (error) {
      console.error("❌ Error clearing cache:", error);
    }
  }

  // ============ USER REVIEWS ============

  /**
   * Save user's reviews
   */
  async saveUserReviews(userId: string, reviews: any[]): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.USER_REVIEWS}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(reviews));
    } catch (error) {
      console.error("❌ Error saving reviews:", error);
    }
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(userId: string): Promise<any[]> {
    try {
      const key = `${STORAGE_KEYS.USER_REVIEWS}_${userId}`;
      const reviewsStr = await AsyncStorage.getItem(key);
      return reviewsStr ? JSON.parse(reviewsStr) : [];
    } catch (error) {
      console.error("❌ Error getting reviews:", error);
      return [];
    }
  }

  // ============ USER LIKES ============

  /**
   * Save user's likes
   */
  async saveUserLikes(userId: string, likes: string[]): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.USER_LIKES}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(likes));
    } catch (error) {
      console.error("❌ Error saving likes:", error);
    }
  }

  /**
   * Get user's likes
   */
  async getUserLikes(userId: string): Promise<string[]> {
    try {
      const key = `${STORAGE_KEYS.USER_LIKES}_${userId}`;
      const likesStr = await AsyncStorage.getItem(key);
      return likesStr ? JSON.parse(likesStr) : [];
    } catch (error) {
      console.error("❌ Error getting likes:", error);
      return [];
    }
  }

  // ============ USER APPLICATIONS ============

  /**
   * Save user's property applications
   */
  async saveUserApplications(
    userId: string,
    applications: any[],
  ): Promise<void> {
    try {
      const key = `${STORAGE_KEYS.USER_APPLICATIONS}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(applications));
    } catch (error) {
      console.error("❌ Error saving applications:", error);
    }
  }

  /**
   * Get user's applications
   */
  async getUserApplications(userId: string): Promise<any[]> {
    try {
      const key = `${STORAGE_KEYS.USER_APPLICATIONS}_${userId}`;
      const appsStr = await AsyncStorage.getItem(key);
      return appsStr ? JSON.parse(appsStr) : [];
    } catch (error) {
      console.error("❌ Error getting applications:", error);
      return [];
    }
  }

  // ============ UTILITY FUNCTIONS ============

  /**
   * Get all local data (for debugging)
   */
  async getAllLocalData(): Promise<Record<string, any>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const allData = await AsyncStorage.multiGet(allKeys);

      const result: Record<string, any> = {};
      allData.forEach(([key, value]) => {
        try {
          result[key] = JSON.parse(value || "{}");
        } catch {
          result[key] = value;
        }
      });

      return result;
    } catch (error) {
      console.error("❌ Error getting all data:", error);
      return {};
    }
  }

  /**
   * Clear all local data (logout/reset)
   */
  async clearAllData(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      console.log("✅ All local data cleared");
    } catch (error) {
      console.error("❌ Error clearing all data:", error);
    }
  }

  /**
   * Get storage usage (for debugging)
   */
  async getStorageUsage(): Promise<number> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      let totalSize = 0;

      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          totalSize += value.length;
        }
      }

      return totalSize;
    } catch (error) {
      console.error("❌ Error getting storage usage:", error);
      return 0;
    }
  }
}

export const localDB = new LocalDatabase();
