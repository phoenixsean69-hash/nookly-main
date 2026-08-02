import AsyncStorage from "@react-native-async-storage/async-storage";

import { account } from "../lib/appwrite";

const AVATAR_STORAGE_KEY = "nookly_selected_avatar_id";

let cachedAvatarId: string | null | undefined;
let localLoadPromise: Promise<string | null> | null = null;
let remoteRefreshPromise: Promise<string | null> | null = null;
let lastFetchTime = 0;

const normalizeAvatarId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const persistAvatarLocally = async (
  avatarId: string | null,
): Promise<void> => {
  if (avatarId) {
    await AsyncStorage.setItem(AVATAR_STORAGE_KEY, avatarId);
    return;
  }

  await AsyncStorage.removeItem(AVATAR_STORAGE_KEY);
};

export const refreshAvatarCache = async (): Promise<string | null> => {
  if (remoteRefreshPromise) return remoteRefreshPromise;

  remoteRefreshPromise = (async () => {
    try {
      const prefs = await account.getPrefs();
      const avatarId = normalizeAvatarId(prefs.avatarId);

      cachedAvatarId = avatarId;
      lastFetchTime = Date.now();

      await persistAvatarLocally(avatarId);
      return avatarId;
    } catch (error) {
      console.error("Failed to refresh avatar preferences:", error);
      return cachedAvatarId ?? null;
    } finally {
      remoteRefreshPromise = null;
    }
  })();

  return remoteRefreshPromise;
};

export const getSavedAvatar = async (): Promise<string | null> => {
  if (cachedAvatarId !== undefined) {
    return cachedAvatarId;
  }

  if (localLoadPromise) return localLoadPromise;

  localLoadPromise = (async () => {
    try {
      const localAvatar = normalizeAvatarId(
        await AsyncStorage.getItem(AVATAR_STORAGE_KEY),
      );

      cachedAvatarId = localAvatar;

      if (localAvatar) {
        void refreshAvatarCache();
        return localAvatar;
      }

      return await refreshAvatarCache();
    } catch (error) {
      console.error("Failed to load local avatar:", error);
      return await refreshAvatarCache();
    } finally {
      localLoadPromise = null;
    }
  })();

  return localLoadPromise;
};

export const saveSelectedAvatar = async (
  avatarId: string,
): Promise<boolean> => {
  const normalizedAvatarId = normalizeAvatarId(avatarId);

  if (!normalizedAvatarId) return false;

  cachedAvatarId = normalizedAvatarId;
  lastFetchTime = Date.now();

  try {
    await persistAvatarLocally(normalizedAvatarId);
  } catch (error) {
    console.error("Failed to persist avatar locally:", error);
  }

  try {
    await account.updatePrefs({ avatarId: normalizedAvatarId });
    return true;
  } catch (error) {
    console.error("Failed to save avatar preferences:", error);
    return false;
  }
};

export const clearSavedAvatar = async (): Promise<boolean> => {
  cachedAvatarId = null;
  lastFetchTime = Date.now();

  try {
    await persistAvatarLocally(null);
  } catch (error) {
    console.error("Failed to clear local avatar:", error);
  }

  try {
    await account.updatePrefs({ avatarId: null });
    return true;
  } catch (error) {
    console.error("Failed to clear avatar preferences:", error);
    return false;
  }
};

export const getAvatarCacheStatus = () => ({
  cached: cachedAvatarId ?? null,
  isHydrated: cachedAvatarId !== undefined,
  age: lastFetchTime
    ? Math.floor((Date.now() - lastFetchTime) / 1000) + "s"
    : "never",
});
