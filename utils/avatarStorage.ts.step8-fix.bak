// utils/avatarStorage.ts
import { account } from "../lib/appwrite"; // your Appwrite client

// Simple cache for avatar
let cachedAvatarId: string | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 300000; // 5 minutes for avatar (doesn't change often)

export const saveSelectedAvatar = async (
  avatarId: string,
): Promise<boolean> => {
  try {
    await account.updatePrefs({ avatarId });
    // Update cache immediately after saving
    cachedAvatarId = avatarId;
    lastFetchTime = Date.now();
    return true;
  } catch (error) {
    console.error("Failed to save avatar:", error);
    return false;
  }
};

export const getSavedAvatar = async (): Promise<string | null> => {
  try {
    // Check cache first
    const now = Date.now();
    if (cachedAvatarId !== null && now - lastFetchTime < CACHE_TTL) {
      console.log("📦 Using cached avatar");
      return cachedAvatarId;
    }

    console.log("🌐 Fetching fresh avatar");
    const prefs = await account.getPrefs();
    const avatarId = prefs.avatarId || null;

    // Update cache
    cachedAvatarId = avatarId;
    lastFetchTime = Date.now();

    return avatarId;
  } catch (error) {
    console.error("Failed to get avatar:", error);
    // Return cached version if available, even if expired
    if (cachedAvatarId !== null) {
      console.log("⚠️ Using expired cached avatar due to error");
      return cachedAvatarId;
    }
    return null;
  }
};

export const clearSavedAvatar = async (): Promise<boolean> => {
  try {
    await account.updatePrefs({ avatarId: null });
    // Clear cache immediately
    cachedAvatarId = null;
    lastFetchTime = Date.now();
    return true;
  } catch (error) {
    console.error("Failed to clear avatar:", error);
    return false;
  }
};

// Optional: Force refresh cache
export const refreshAvatarCache = async (): Promise<string | null> => {
  try {
    const prefs = await account.getPrefs();
    const avatarId = prefs.avatarId || null;
    cachedAvatarId = avatarId;
    lastFetchTime = Date.now();
    return avatarId;
  } catch (error) {
    console.error("Failed to refresh avatar:", error);
    return cachedAvatarId;
  }
};

// Optional: Get cache status
export const getAvatarCacheStatus = () => {
  const now = Date.now();
  const isExpired = now - lastFetchTime >= CACHE_TTL;
  return {
    cached: cachedAvatarId,
    isExpired,
    age: lastFetchTime
      ? Math.floor((now - lastFetchTime) / 1000) + "s"
      : "never",
  };
};
