// store/notification.store.ts
import { config, databases } from "@/lib/appwrite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Query } from "react-native-appwrite";
import { create } from "zustand";

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "event" | "reminder" | "alert";
  eventId?: string;
  eventDate?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationState {
  cleanupOldNotifications: (userId: string) => Promise<void>;
  notifications: Notification[];
  unreadCount: number; // local unread count
  appwriteUnreadCount: number;
  totalUnreadCount: number;
  loadNotifications: (userId: string) => Promise<void>;
  addNotification: (
    userId: string,
    notification: Omit<Notification, "id" | "read" | "createdAt">,
  ) => Promise<void>;
  markAsRead: (userId: string, notificationId: string) => Promise<void>;
  markAllAsRead: (userId: string) => Promise<void>;
  deleteNotification: (userId: string, notificationId: string) => Promise<void>;
  clearAll: (userId: string) => Promise<void>;
  fetchAppwriteUnreadCount: (userId: string) => Promise<void>;
}

// app/(root)/notifications.tsx - Add cleanup on mount

// Also add to home screen to run cleanup periodically
// In your home screen (landHome.tsx or tenantHome.tsx)
const STORAGE_KEY = "user_notifications";

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  appwriteUnreadCount: 0,
  totalUnreadCount: 0,

  loadNotifications: async (userId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      let notifications: Notification[] = [];
      let localUnread = 0;
      if (stored) {
        notifications = JSON.parse(stored);
        localUnread = notifications.filter((n: Notification) => !n.read).length;
      }
      set({ notifications, unreadCount: localUnread });
      // Also refresh total
      const appwriteUnread = get().appwriteUnreadCount;
      set({ totalUnreadCount: localUnread + appwriteUnread });
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  },

  addNotification: async (
    userId: string,
    notification: Omit<Notification, "id" | "read" | "createdAt">,
  ) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      const existingNotifications: Notification[] = stored
        ? JSON.parse(stored)
        : [];

      const newNotification: Notification = {
        ...notification,
        id: Date.now().toString(),
        read: false,
        createdAt: new Date().toISOString(),
      };

      const updatedNotifications = [
        newNotification,
        ...existingNotifications,
      ].slice(0, 50); // Keep last 50
      await AsyncStorage.setItem(
        storageKey,
        JSON.stringify(updatedNotifications),
      );

      const localUnread = updatedNotifications.filter(
        (n: Notification) => !n.read,
      ).length;
      set({ notifications: updatedNotifications, unreadCount: localUnread });
      // Update total
      const appwriteUnread = get().appwriteUnreadCount;
      set({ totalUnreadCount: localUnread + appwriteUnread });
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  },

  markAsRead: async (userId: string, notificationId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const notifications: Notification[] = JSON.parse(stored);
        const updated = notifications.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n,
        );
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        const localUnread = updated.filter((n) => !n.read).length;
        set({ notifications: updated, unreadCount: localUnread });
        // Update total
        const appwriteUnread = get().appwriteUnreadCount;
        set({ totalUnreadCount: localUnread + appwriteUnread });
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  },
  // store/notification.store.ts
  markAllAsRead: async (userId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const notifications: Notification[] = JSON.parse(stored);
        const updated = notifications.map((n) => ({ ...n, read: true }));
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

        // Get the current appwrite unread count
        const { appwriteUnreadCount } = get();

        // Update store: local unread becomes 0, total becomes appwriteUnreadCount
        set({
          notifications: updated,
          unreadCount: 0,
          totalUnreadCount: appwriteUnreadCount,
        });
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  },

  // store/notification.store.ts - Add cleanup function

  // Add this function to your store
  cleanupOldNotifications: async (userId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);

      if (stored) {
        const notifications: Notification[] = JSON.parse(stored);
        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;

        const filtered = notifications.filter((notification) => {
          if (!notification.read) return true;
          const notificationTime = new Date(notification.createdAt).getTime();
          return now - notificationTime < oneDay;
        });

        if (filtered.length !== notifications.length) {
          await AsyncStorage.setItem(storageKey, JSON.stringify(filtered));
          const localUnread = filtered.filter(
            (n: Notification) => !n.read,
          ).length;
          set({
            notifications: filtered,
            unreadCount: localUnread,
            totalUnreadCount: localUnread + get().appwriteUnreadCount,
          });
        }
      }
    } catch (error) {
      console.error("Error cleaning up old notifications:", error);
    }
  },

  deleteNotification: async (userId: string, notificationId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      const stored = await AsyncStorage.getItem(storageKey);
      if (stored) {
        const notifications: Notification[] = JSON.parse(stored);
        const updated = notifications.filter((n) => n.id !== notificationId);
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
        const localUnread = updated.filter((n) => !n.read).length;
        set({ notifications: updated, unreadCount: localUnread });
        // Update total
        const appwriteUnread = get().appwriteUnreadCount;
        set({ totalUnreadCount: localUnread + appwriteUnread });
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  },

  clearAll: async (userId: string) => {
    try {
      const storageKey = `${STORAGE_KEY}_${userId}`;
      await AsyncStorage.setItem(storageKey, JSON.stringify([]));
      set({ notifications: [], unreadCount: 0 });
      const appwriteUnread = get().appwriteUnreadCount;
      set({ totalUnreadCount: appwriteUnread });
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  },

  // store/notification.store.ts
  // store/notification.store.ts
  fetchAppwriteUnreadCount: async (userId: string) => {
    try {
      console.log("🔍 fetchAppwriteUnreadCount called with userId:", userId);

      // First, find the user's document ID
      let userDocId = userId;

      // If userId looks like an accountId (not a document ID), look it up
      if (userId.length < 36) {
        const userDocs = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("accountId", userId)],
        );

        if (userDocs.documents.length > 0) {
          userDocId = userDocs.documents[0].$id;
          console.log("📝 Found user document ID for unread count:", userDocId);
        } else {
          console.log("⚠️ No user found for unread count with ID:", userId);
          set({ appwriteUnreadCount: 0, totalUnreadCount: get().unreadCount });
          return;
        }
      }

      const result = await databases.listDocuments(
        config.databaseId!,
        config.notificationsCollectionId!,
        [Query.equal("userId", userDocId), Query.equal("read", false)],
      );

      const appwriteCount = result.total;
      console.log("📊 Appwrite unread count:", appwriteCount);

      const localUnread = get().unreadCount;
      set({
        appwriteUnreadCount: appwriteCount,
        totalUnreadCount: localUnread + appwriteCount,
      });
    } catch (error) {
      console.error("Error fetching Appwrite unread count:", error);
    }
  },
}));
