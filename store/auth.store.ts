// store/auth.store.ts
import {
  account,
  config,
  databases,
  getDefaultAvatarUrl,
} from "@/lib/appwrite";
import { getData, removeData, storeData } from "@/lib/cache";
import notificationService from "@/services/notification.service";
import * as SecureStore from "expo-secure-store";
import { ID, Query } from "react-native-appwrite";
import { create } from "zustand";

const createValidAppwriteId = (): string => {
  let id = ID.unique();
  id = id.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!id) id = "u" + Date.now().toString(36);
  if (!/^[a-zA-Z0-9]/.test(id)) id = "u" + id;
  return id.slice(0, 36);
};

// Define types
interface User {
  $id: string;
  accountId: string;
  name: string;
  userMode: "tenant" | "landlord";
  email: string;
  phone: string;
  avatar?: string;
  customAvatar?: string;
  expoPushToken?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isHydrated: boolean;
  setUser: (user: User | null) => void; // ✅ Added setUser method
  fetchAuthenticatedUser: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    userData: SignUpData,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;
  hydrate: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateUser: (
    updates: Partial<User>,
  ) => Promise<{ success: boolean; error?: string }>; // ✅ Added updateUser method
}

interface SignUpData {
  name: string;
  userMode: "tenant" | "landlord";
  email: string;
  phone: string;
  password: string;
  avatar?: string;
}

// Store auth token key
const AUTH_TOKEN_KEY = "auth_token";
const USER_CACHE_KEY = "user";
const LAST_SYNC_KEY = "last_sync";

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  isHydrated: false,

  // ✅ Simple setUser method for updating user state
  setUser: (user: User | null) => {
    set({ user });
    // Also update cache if user is not null
    if (user) {
      storeData(USER_CACHE_KEY, user);
    } else {
      removeData(USER_CACHE_KEY);
    }
  },

  // ✅ Update user in both database and local state
  updateUser: async (updates: Partial<User>) => {
    const { user } = get();

    if (!user) {
      return { success: false, error: "No user logged in" };
    }

    try {
      // Update user document in database
      const updatedDoc = await databases.updateDocument(
        config.databaseId!,
        config.usersCollectionId!,
        user.$id,
        updates,
      );

      // Update local state
      const updatedUser = { ...user, ...updates } as User;
      set({ user: updatedUser });

      // Update cache
      await storeData(USER_CACHE_KEY, updatedUser);

      return { success: true };
    } catch (error: any) {
      console.error("Error updating user:", error);
      return {
        success: false,
        error: error?.message || "Failed to update user",
      };
    }
  },

  hydrate: async () => {
    console.log("💾 Hydrating auth state from cache...");

    try {
      // Step 1: Load cached user immediately (instant UI)
      const cachedUser = await getData(USER_CACHE_KEY);

      if (cachedUser) {
        console.log("✅ Loaded cached user instantly");
        set({
          user: cachedUser,
          isAuthenticated: true,
          isLoading: false,
          isHydrated: true,
        });
      } else {
        set({ isLoading: false, isHydrated: true });
      }

      // Step 2: Check for stored auth token
      const hasToken = await SecureStore.getItemAsync(AUTH_TOKEN_KEY);

      if (!hasToken) {
        set({ isInitialized: true });
        return;
      }

      // Step 3: Validate session in background (non-blocking)
      setTimeout(async () => {
        try {
          const session = await account.getSession("current");

          if (session) {
            // ✅ Valid session → fetch fresh user
            await get().fetchAuthenticatedUser();
          } else {
            // ⚠️ Session missing → ONLY clear if no cached user
            const { user: cached } = get();

            if (!cached) {
              await get().clearCache();
              set({ user: null, isAuthenticated: false });
            } else {
              console.log(
                "⚠️ No session, but keeping cached user (offline mode)",
              );
            }
          }
        } catch (error) {
          console.log("⚠️ Session check failed (likely offline)");

          const { user: cached } = get();

          if (!cached) {
            // No cache → unauthenticated
            set({ user: null, isAuthenticated: false });
          } else {
            // ✅ KEEP cached user (THIS IS THE FIX)
            console.log("✅ Using cached user (offline mode)");
            set({
              user: cached,
              isAuthenticated: true,
            });
          }
        } finally {
          set({ isInitialized: true });
        }
      }, 0);
    } catch (error) {
      console.error("Hydration error:", error);
      set({ isLoading: false, isHydrated: true, isInitialized: true });
    }
  },

  clearCache: async () => {
    await removeData(USER_CACHE_KEY);
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await removeData(LAST_SYNC_KEY);
  },

  fetchAuthenticatedUser: async () => {
    const { user: cachedUser, isHydrated } = get();

    // Don't show loading if we already have cached user and UI is showing
    const shouldShowLoading = !cachedUser || !isHydrated;

    if (shouldShowLoading) {
      set({ isLoading: true });
    }

    try {
      // Try to get current session
      let session;
      try {
        session = await account.getSession("current");
      } catch {
        // No session, clear everything
        await get().clearCache();
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      if (!session) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }

      // Get current user
      const currentUser = await account.get();

      // Fetch user document from database
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", currentUser.$id)],
      );

      if (userDocs.documents.length > 0) {
        const userDoc = userDocs.documents[0] as unknown as User;

        // Store token for next session
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, currentUser.$id);

        // Cache user data
        await storeData(USER_CACHE_KEY, userDoc);
        await storeData(LAST_SYNC_KEY, Date.now().toString());

        set({
          user: userDoc,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // No user document found
        await get().clearCache();
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.log("⚠️ Offline or session fetch failed");

      const { user: cached } = get();

      if (cached) {
        // ✅ KEEP cached user (offline mode)
        set({
          user: cached,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // No cache → unauthenticated
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      await account.createEmailPasswordSession(email, password);
      const currentAccount = await account.get();

      const userDetails = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", currentAccount.$id)],
      );

      if (userDetails.documents.length > 0) {
        const user = userDetails.documents[0] as unknown as User;

        // Store token and cache
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, currentAccount.$id);
        await storeData(USER_CACHE_KEY, user);
        await storeData(LAST_SYNC_KEY, Date.now().toString());

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: "User not found" };
    } catch (error: any) {
      set({ isLoading: false });
      return {
        success: false,
        error: error?.message || "An error occurred during sign in",
      };
    }
  },

  signUp: async (userData: SignUpData) => {
    try {
      set({ isLoading: true });

      const accountId = createValidAppwriteId();
      const userDocumentId = createValidAppwriteId();
      const avatarUrl =
        userData.avatar?.trim() || getDefaultAvatarUrl(userData.name);
      const newAccount = await account.create(
        accountId,
        userData.email,
        userData.password,
        userData.name,
      );

      if (newAccount) {
        const userDocument = await databases.createDocument(
          config.databaseId!,
          config.usersCollectionId!,
          userDocumentId,
          {
            accountId: newAccount.$id,
            name: userData.name,
            userMode: userData.userMode,
            email: userData.email,
            avatar: avatarUrl,
            phone: userData.phone,
          },
        );

        await account.createEmailPasswordSession(
          userData.email,
          userData.password,
        );

        const user = userDocument as unknown as User;

        // Store token and cache
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, newAccount.$id);
        await storeData(USER_CACHE_KEY, user);
        await storeData(LAST_SYNC_KEY, Date.now().toString());

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        // If landlord, add to agents collection in background
        if (userData.userMode === "landlord") {
          setTimeout(async () => {
            try {
              const agentId = createValidAppwriteId();
              await databases.createDocument(
                config.databaseId!,
                config.agentsCollectionId!,
                agentId,
                {
                  T_name: userData.name,
                  email: userData.email,
                  avatar: avatarUrl,
                  userDocId: userDocument.$id,
                },
              );
              console.log("✅ Landlord added to agents collection");
            } catch (agentError) {
              console.error("Error adding to agents:", agentError);
            }
          }, 0);
        }

        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: "Failed to create account" };
    } catch (error: any) {
      set({ isLoading: false });
      return {
        success: false,
        error: error?.message || "An error occurred during sign up",
      };
    }
  },

  // store/auth.store.ts - Update signOut method

  signOut: async () => {
    try {
      const { user } = get();

      // Remove push token before logging out
      if (user?.accountId) {
        const token = notificationService.getExpoPushToken();
        if (token) {
          await notificationService.removePushToken(user.accountId, token);
        }
      }

      await account.deleteSession("current");
      await get().clearCache();
      set({ user: null, isAuthenticated: false, isLoading: false });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "An error occurred during sign out",
      };
    }
  },
}));

export default useAuthStore;
