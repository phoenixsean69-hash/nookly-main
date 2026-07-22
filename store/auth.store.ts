// store/auth.store.ts
import {
  account,
  config,
  databases,
  getDefaultAvatarUrl,
} from "@/lib/appwrite";
import { getData, removeData, storeData } from "@/lib/cache";
import notificationService from "@/services/notification.service";
import AsyncStorage from "@react-native-async-storage/async-storage";
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

// Storage keys
const STORAGE_KEYS = {
  AUTH_TOKEN: "auth_token",
  USER_DATA: "user_data",
  ORGANIZATION_DATA: "organization_data", // ✅ Added
  LAST_SYNC: "last_sync",
  APP_SETTINGS: "app_settings",
} as const;

// Define types
interface User {
  $id: string;
  accountId: string;
  name: string;
  userMode: "tenant" | "landlord" | "student";
  email: string;
  phone: string;
  avatar?: string;
  customAvatar?: string;
  expoPushToken?: string;
}

interface Organization {
  $id: string;
  userId: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  // Add other organization fields as needed
}

interface AuthState {
  user: User | null;
  organization: Organization | null; // ✅ Added
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  isHydrated: boolean;

  // Core methods
  setUser: (user: User | null) => Promise<void>;
  setOrganization: (organization: Organization | null) => Promise<void>; // ✅ Added
  fetchAuthenticatedUser: () => Promise<void>;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  signUp: (
    userData: SignUpData,
  ) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<{ success: boolean; error?: string }>;

  // Storage methods
  hydrate: () => Promise<void>;
  clearCache: () => Promise<void>;
  saveUserToStorage: (user: User) => Promise<void>;
  loadUserFromStorage: () => Promise<User | null>;
  removeUserFromStorage: () => Promise<void>;
  saveOrganizationToStorage: (organization: Organization) => Promise<void>; // ✅ Added
  loadOrganizationFromStorage: () => Promise<Organization | null>; // ✅ Added
  removeOrganizationFromStorage: () => Promise<void>; // ✅ Added

  // Update methods
  updateUser: (
    updates: Partial<User>,
  ) => Promise<{ success: boolean; error?: string }>;
  updateOrganization: (
    updates: Partial<Organization>,
  ) => Promise<{ success: boolean; error?: string }>; // ✅ Added
}

interface SignUpData {
  name: string;
  userMode: "tenant" | "landlord" | "student";
  email: string;
  phone: string;
  password: string;
  avatar?: string;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  organization: null, // ✅ Added
  isAuthenticated: false,
  isLoading: true,
  isInitialized: false,
  isHydrated: false,

  // =============================================
  // STORAGE METHODS
  // =============================================

  /**
   * Save user data to AsyncStorage
   */
  saveUserToStorage: async (user: User) => {
    try {
      const userData = JSON.stringify(user);
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, userData);
      console.log("✅ User data saved to AsyncStorage");
    } catch (error) {
      console.error("❌ Failed to save user to AsyncStorage:", error);
    }
  },

  /**
   * Load user data from AsyncStorage
   */
  loadUserFromStorage: async (): Promise<User | null> => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userData) {
        const user = JSON.parse(userData) as User;
        console.log("✅ User data loaded from AsyncStorage");
        return user;
      }
      console.log("❌ No user data found in AsyncStorage");
      return null;
    } catch (error) {
      console.error("❌ Failed to load user from AsyncStorage:", error);
      return null;
    }
  },

  /**
   * Remove user data from AsyncStorage
   */
  removeUserFromStorage: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.USER_DATA);
      console.log("✅ User data removed from AsyncStorage");
    } catch (error) {
      console.error("❌ Failed to remove user from AsyncStorage:", error);
    }
  },

  /**
   * Save organization data to AsyncStorage
   */
  saveOrganizationToStorage: async (organization: Organization) => {
    try {
      const orgData = JSON.stringify(organization);
      await AsyncStorage.setItem(STORAGE_KEYS.ORGANIZATION_DATA, orgData);
      console.log("✅ Organization data saved to AsyncStorage");
    } catch (error) {
      console.error("❌ Failed to save organization to AsyncStorage:", error);
    }
  },

  /**
   * Load organization data from AsyncStorage
   */
  loadOrganizationFromStorage: async (): Promise<Organization | null> => {
    try {
      const orgData = await AsyncStorage.getItem(
        STORAGE_KEYS.ORGANIZATION_DATA,
      );
      if (orgData) {
        const organization = JSON.parse(orgData) as Organization;
        console.log("✅ Organization data loaded from AsyncStorage");
        return organization;
      }
      console.log("❌ No organization data found in AsyncStorage");
      return null;
    } catch (error) {
      console.error("❌ Failed to load organization from AsyncStorage:", error);
      return null;
    }
  },

  /**
   * Remove organization data from AsyncStorage
   */
  removeOrganizationFromStorage: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.ORGANIZATION_DATA);
      console.log("✅ Organization data removed from AsyncStorage");
    } catch (error) {
      console.error(
        "❌ Failed to remove organization from AsyncStorage:",
        error,
      );
    }
  },

  // =============================================
  // CORE METHODS
  // =============================================

  /**
   * Set user in state and persist to storage
   */
  setUser: async (user: User | null) => {
    if (user) {
      // Save to AsyncStorage
      await get().saveUserToStorage(user);

      // Also save to cache for quick access
      await storeData("user", user);

      // Update state
      set({ user, isAuthenticated: true });
      console.log("✅ User state updated and persisted");
    } else {
      // Clear everything
      await get().removeUserFromStorage();
      await removeData("user");

      set({ user: null, isAuthenticated: false });
      console.log("✅ User state cleared");
    }
  },

  /**
   * Set organization in state and persist to storage
   */
  setOrganization: async (organization: Organization | null) => {
    if (organization) {
      // Save to AsyncStorage
      await get().saveOrganizationToStorage(organization);

      // Also save to cache for quick access
      await storeData("organization", organization);

      // Update state
      set({ organization });
      console.log("✅ Organization state updated and persisted");
    } else {
      // Clear everything
      await get().removeOrganizationFromStorage();
      await removeData("organization");

      set({ organization: null });
      console.log("✅ Organization state cleared");
    }
  },

  /**
   * Update user in both database and local state
   */
  updateUser: async (updates: Partial<User>) => {
    const { user } = get();

    if (!user) {
      return { success: false, error: "No user logged in" };
    }

    try {
      console.log("📝 Updating user...");

      // Update user document in database
      const updatedDoc = await databases.updateDocument(
        config.databaseId!,
        config.usersCollectionId!,
        user.$id,
        updates,
      );

      // Create updated user object
      const updatedUser = { ...user, ...updates } as User;

      // Update state and persist
      await get().setUser(updatedUser);

      console.log("✅ User updated successfully");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Error updating user:", error);
      return {
        success: false,
        error: error?.message || "Failed to update user",
      };
    }
  },

  /**
   * Update organization in both database and local state
   */
  updateOrganization: async (updates: Partial<Organization>) => {
    const { organization } = get();

    if (!organization) {
      return { success: false, error: "No organization found" };
    }

    try {
      console.log("📝 Updating organization...");

      // Update organization document in database
      const updatedDoc = await databases.updateDocument(
        config.databaseId!,
        config.organizationsCollectionId!,
        organization.$id,
        updates,
      );

      // Create updated organization object
      const updatedOrganization = {
        ...organization,
        ...updates,
      } as Organization;

      // Update state and persist
      await get().setOrganization(updatedOrganization);

      console.log("✅ Organization updated successfully");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Error updating organization:", error);
      return {
        success: false,
        error: error?.message || "Failed to update organization",
      };
    }
  },

  /**
   * Hydrate auth state from storage on app start
   */
  hydrate: async () => {
    console.log("💾 Starting auth hydration...");

    try {
      // Step 1: Load user from AsyncStorage (persistent)
      const storedUser = await get().loadUserFromStorage();

      // Step 2: Load organization from AsyncStorage
      const storedOrg = await get().loadOrganizationFromStorage();

      // Step 3: If no stored user, try cache as fallback
      if (!storedUser) {
        const cachedUser = await getData("user");
        const cachedOrg = await getData("organization");

        if (cachedUser) {
          console.log("📦 Using cached user as fallback");
          // Migrate cache to AsyncStorage
          await get().saveUserToStorage(cachedUser);
          if (cachedOrg) {
            await get().saveOrganizationToStorage(cachedOrg);
          }
          set({
            user: cachedUser,
            organization: cachedOrg || null,
            isAuthenticated: true,
            isLoading: false,
            isHydrated: true,
          });
        } else {
          console.log("❌ No stored user found");
          set({ isLoading: false, isHydrated: true });
        }
      } else {
        console.log("✅ Loaded user from AsyncStorage");
        set({
          user: storedUser,
          organization: storedOrg || null,
          isAuthenticated: true,
          isLoading: false,
          isHydrated: true,
        });
      }

      // Step 4: Check for stored auth token
      const hasToken = await SecureStore.getItemAsync(STORAGE_KEYS.AUTH_TOKEN);

      if (!hasToken) {
        console.log("❌ No auth token found");
        set({ isInitialized: true });
        return;
      }

      // Step 5: Validate session in background (non-blocking)
      setTimeout(async () => {
        try {
          const session = await account.getSession("current");

          if (session) {
            // Valid session → fetch fresh user
            console.log("✅ Valid session found, fetching fresh data");
            await get().fetchAuthenticatedUser();
          } else {
            // Session missing → keep cached user (offline mode)
            const { user: currentUser } = get();
            if (!currentUser) {
              await get().clearCache();
              set({ user: null, organization: null, isAuthenticated: false });
            } else {
              console.log("⚠️ No session, keeping cached user (offline mode)");
            }
          }
        } catch (error) {
          console.log("⚠️ Session check failed (likely offline)");

          const { user: currentUser } = get();
          if (!currentUser) {
            set({ user: null, organization: null, isAuthenticated: false });
          } else {
            console.log("✅ Using cached user (offline mode)");
            set({ user: currentUser, isAuthenticated: true });
          }
        } finally {
          set({ isInitialized: true });
        }
      }, 0);
    } catch (error) {
      console.error("❌ Hydration error:", error);
      set({ isLoading: false, isHydrated: true, isInitialized: true });
    }
  },

  /**
   * Clear all cached data
   */
  clearCache: async () => {
    try {
      console.log("🗑️ Clearing cache...");

      // Clear AsyncStorage
      await get().removeUserFromStorage();
      await get().removeOrganizationFromStorage();

      // Clear old cache
      await removeData("user");
      await removeData("organization");
      await removeData("last_sync");

      // Clear secure storage
      await SecureStore.deleteItemAsync(STORAGE_KEYS.AUTH_TOKEN);

      // Clear any other app data
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((key) => key.startsWith("@rental_"));
      if (appKeys.length > 0) {
        await AsyncStorage.multiRemove(appKeys);
      }

      console.log("✅ Cache cleared successfully");
    } catch (error) {
      console.error("❌ Error clearing cache:", error);
    }
  },

  // =============================================
  // AUTH METHODS
  // =============================================

  /**
   * Fetch authenticated user from server
   */
  fetchAuthenticatedUser: async () => {
    const { user: cachedUser, isHydrated } = get();

    // Don't show loading if we already have cached user
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
        set({
          user: null,
          organization: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      if (!session) {
        set({
          user: null,
          organization: null,
          isAuthenticated: false,
          isLoading: false,
        });
        return;
      }

      // Get current user from Appwrite
      const currentUser = await account.get();

      // Fetch user document from database
      const userDocs = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", currentUser.$id)],
      );

      if (userDocs.documents.length > 0) {
        const userDoc = userDocs.documents[0] as unknown as User;

        // ✅ Fetch organization if the user is a landlord
        let organization = null;
        if (userDoc.userMode === "landlord") {
          try {
            const orgDocs = await databases.listDocuments(
              config.databaseId!,
              config.organizationsCollectionId!,
              [Query.equal("userId", userDoc.accountId)],
            );
            if (orgDocs.documents.length > 0) {
              organization = orgDocs.documents[0] as unknown as Organization;
              // Save organization to cache
              await get().saveOrganizationToStorage(organization);
              await storeData("organization", organization);
            }
          } catch (orgError) {
            console.error("Error fetching organization:", orgError);
          }
        }

        // Store auth token securely
        await SecureStore.setItemAsync(
          STORAGE_KEYS.AUTH_TOKEN,
          currentUser.$id,
        );

        // Save user to AsyncStorage and cache
        await get().saveUserToStorage(userDoc);
        await storeData("user", userDoc);
        await storeData("last_sync", Date.now().toString());

        set({
          user: userDoc,
          organization: organization,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log("✅ Fresh user data fetched and stored");
        if (organization) {
          console.log(
            "✅ Organization data fetched and stored:",
            organization.name,
          );
        }
      } else {
        // No user document found
        await get().clearCache();
        set({
          user: null,
          organization: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (error) {
      console.log("⚠️ Failed to fetch user (offline?)");

      const { user: cached } = get();

      if (cached) {
        // Keep cached user (offline mode)
        set({
          user: cached,
          isAuthenticated: true,
          isLoading: false,
        });
        console.log("✅ Using cached user data");
      } else {
        // No cache → unauthenticated
        set({
          user: null,
          organization: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Sign in user
   */
  signIn: async (email: string, password: string) => {
    try {
      set({ isLoading: true });

      // Create session
      await account.createEmailPasswordSession(email, password);
      const currentAccount = await account.get();

      // Fetch user details from database
      const userDetails = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("accountId", currentAccount.$id)],
      );

      if (userDetails.documents.length > 0) {
        const user = userDetails.documents[0] as unknown as User;

        // ✅ Fetch organization if landlord
        let organization = null;
        if (user.userMode === "landlord") {
          try {
            const orgDocs = await databases.listDocuments(
              config.databaseId!,
              config.organizationsCollectionId!,
              [Query.equal("userId", user.accountId)],
            );
            if (orgDocs.documents.length > 0) {
              organization = orgDocs.documents[0] as unknown as Organization;
              await get().saveOrganizationToStorage(organization);
              await storeData("organization", organization);
            }
          } catch (orgError) {
            console.error(
              "Error fetching organization during sign in:",
              orgError,
            );
          }
        }

        // Store auth token
        await SecureStore.setItemAsync(
          STORAGE_KEYS.AUTH_TOKEN,
          currentAccount.$id,
        );

        // Save user to AsyncStorage and cache
        await get().saveUserToStorage(user);
        await storeData("user", user);
        await storeData("last_sync", Date.now().toString());

        set({
          user,
          organization: organization,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log("✅ Sign in successful");
        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: "User not found" };
    } catch (error: any) {
      set({ isLoading: false });
      console.error("❌ Sign in failed:", error);
      return {
        success: false,
        error: error?.message || "An error occurred during sign in",
      };
    }
  },

  /**
   * Sign up new user with rollback support
   */
  signUp: async (userData: SignUpData) => {
    let createdAccountId: string | null = null;
    let createdUserDocId: string | null = null;

    try {
      set({ isLoading: true });

      const accountId = createValidAppwriteId();
      const userDocumentId = createValidAppwriteId();
      createdAccountId = accountId;
      createdUserDocId = userDocumentId;

      const avatarUrl =
        userData.avatar?.trim() || getDefaultAvatarUrl(userData.name);

      console.log("📝 Creating new account...");

      // Step 1: Create Appwrite Auth account
      const newAccount = await account.create(
        accountId,
        userData.email,
        userData.password,
        userData.name,
      );

      if (!newAccount) {
        throw new Error("Failed to create account");
      }

      console.log("✅ Account created:", newAccount.$id);

      // Step 2: Create user document in database
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

      console.log("✅ User document created:", userDocument.$id);

      // Step 3: Create session (auto sign in)
      await account.createEmailPasswordSession(
        userData.email,
        userData.password,
      );

      console.log("✅ Session created");

      // Step 4: Prepare user object
      const user = userDocument as unknown as User;

      // Step 5: Store auth token securely
      await SecureStore.setItemAsync(STORAGE_KEYS.AUTH_TOKEN, newAccount.$id);

      // Step 6: Save user to AsyncStorage and cache
      await get().saveUserToStorage(user);
      await storeData("user", user);
      await storeData("last_sync", Date.now().toString());

      // Step 7: Update state
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });

      console.log("✅ User state updated and data persisted");

      // Step 8: If landlord, add to landlords collection in background
      if (userData.userMode === "landlord") {
        setTimeout(async () => {
          try {
            const agentId = createValidAppwriteId();
            await databases.createDocument(
              config.databaseId!,
              config.landlordsCollectionId!,
              agentId,
              {
                T_name: userData.name,
                email: userData.email,
                avatar: avatarUrl,
                userDocId: userDocument.$id,
              },
            );
            console.log("✅ Landlord added to landlords collection");
          } catch (agentError) {
            console.error(
              "⚠️ Error adding to landlords (non-critical):",
              agentError,
            );
            // Don't throw - user was created successfully
          }
        }, 0);
      }

      return { success: true };
    } catch (error: any) {
      console.error("❌ Sign up failed:", error);

      // Rollback: Clean up any created resources
      if (createdUserDocId) {
        try {
          await databases.deleteDocument(
            config.databaseId!,
            config.usersCollectionId!,
            createdUserDocId,
          );
          console.log("✅ Rollback: User document deleted");
        } catch (rollbackError) {
          console.error("❌ Failed to rollback user document:", rollbackError);
        }
      }

      if (createdAccountId) {
        try {
          // Delete auth account if it was created
          await account.deleteSession("current");
          console.log("✅ Rollback: Auth account deleted");
        } catch (rollbackError) {
          console.error("❌ Failed to rollback auth account:", rollbackError);
        }
      }

      set({ isLoading: false });
      return {
        success: false,
        error: error?.message || "An error occurred during sign up",
      };
    }
  },

  /**
   * Sign out user
   */
  signOut: async () => {
    try {
      console.log("👋 Signing out...");

      const { user } = get();

      // Remove push token before logging out
      if (user?.accountId) {
        const token = notificationService.getExpoPushToken();
        if (token) {
          try {
            await notificationService.removePushToken(user.accountId, token);
          } catch (error) {
            console.error("⚠️ Failed to remove push token:", error);
          }
        }
      }

      // Delete current session
      try {
        await account.deleteSession("current");
      } catch (error) {
        console.error("⚠️ Failed to delete session:", error);
      }

      // Clear all cached data
      await get().clearCache();

      // Reset state
      set({
        user: null,
        organization: null,
        isAuthenticated: false,
        isLoading: false,
      });

      console.log("✅ Sign out successful");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Sign out failed:", error);
      return {
        success: false,
        error: error?.message || "An error occurred during sign out",
      };
    }
  },
}));

export default useAuthStore;
