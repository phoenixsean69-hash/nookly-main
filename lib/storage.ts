// lib/storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  USER: "@rental_app_user",
  AUTH_TOKEN: "@rental_app_token",
  ONBOARDING_COMPLETE: "@rental_app_onboarding",
} as const;

export const storage = {
  // Save user data
  async saveUser(userData: any) {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData));
      console.log("✅ User data saved to storage");
    } catch (error) {
      console.error("Error saving user data:", error);
    }
  },

  // Get user data
  async getUser() {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error("Error getting user data:", error);
      return null;
    }
  },

  // Remove user data (for logout)
  async removeUser() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER);
      console.log("✅ User data removed from storage");
    } catch (error) {
      console.error("Error removing user data:", error);
    }
  },

  // Clear all app data
  async clearAll() {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await AsyncStorage.multiRemove(keys);
      console.log("✅ All app data cleared");
    } catch (error) {
      console.error("Error clearing app data:", error);
    }
  },

  // Save specific key-value
  async setItem(key: string, value: any) {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
    }
  },

  // Get specific key-value
  async getItem(key: string) {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error(`Error getting ${key}:`, error);
      return null;
    }
  },
};
