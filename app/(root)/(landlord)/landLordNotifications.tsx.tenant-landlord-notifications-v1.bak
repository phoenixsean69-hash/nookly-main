// app/(root)/notifications.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { useNotificationStore } from "@/store/notification.store";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Combined notification type from both sources
interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "like" | "message" | "review" | "system" | "event";
  read: boolean;
  createdAt: Date;
  data?: any;
  source: "appwrite" | "local";
  eventId?: string;
}

export default function NotificationsScreen() {
  const {
    fetchAppwriteUnreadCount,
    markAsRead: markLocalAsRead,
    loadNotifications,
    notifications: localNotifications,
  } = useNotificationStore();
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const userId = user?.accountId;

  // Mark all as read when screen is focused
  useFocusEffect(
    useCallback(() => {
      const markAllAsRead = async () => {
        if (userId && notifications.length > 0) {
          const hasUnread = notifications.some((n) => !n.read);
          if (hasUnread) {
            console.log("🔔 Marking all notifications as read...");
            await markAllNotificationsAsRead(userId);
            await markLocalAsRead(userId, "");
            await fetchAppwriteUnreadCount(userId);

            // Update local state to mark all as read
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
          }
        }
      };

      markAllAsRead();
    }, [userId, notifications]),
  );

  useEffect(() => {
    console.log("🔔 Notifications screen mounted");
    fetchAllNotifications();
  }, []);

  // Fetch notifications from both sources
  const fetchAllNotifications = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // 1. Load local calendar notifications from store
      await loadNotifications(userId);
      const localNotifs = useNotificationStore.getState().notifications;
      console.log("📦 Local calendar notifications:", localNotifs.length);

      // Format local notifications
      const formattedLocal: NotificationItem[] = localNotifs.map((notif) => ({
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: "event",
        read: notif.read,
        createdAt: new Date(notif.createdAt),
        source: "local",
        eventId: notif.eventId,
        data: { eventDate: notif.eventDate },
      }));

      // 2. Fetch Appwrite notifications (likes, messages, reviews)
      let appwriteNotifs: NotificationItem[] = [];
      try {
        const realNotifications = await getUserNotifications(userId);
        console.log(
          "📦 Appwrite notifications count:",
          realNotifications.length,
        );

        appwriteNotifs = realNotifications.map((notif) => ({
          id: notif.$id,
          title: notif.title,
          message: notif.message,
          type: notif.type,
          read: notif.read,
          createdAt: new Date(notif.createdAt),
          source: "appwrite",
          data: notif.data,
        }));
      } catch (error) {
        console.error("Error fetching Appwrite notifications:", error);
      }

      // 3. Combine and sort by date (newest first)
      const allNotifications = [...formattedLocal, ...appwriteNotifs].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
      );

      console.log("✅ Total notifications:", allNotifications.length);
      setNotifications(allNotifications);
    } catch (error) {
      console.error("❌ Error fetching notifications:", error);
      Alert.alert("Error", "Failed to load notifications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    console.log("🔄 Pull to refresh triggered");
    setRefreshing(true);
    fetchAllNotifications();
  };

  const handleBackPress = () => {
    if (user?.userMode === "landlord") {
      router.replace("/landProfile");
    } else {
      router.replace("/profile");
    }
  };

  const handleNotificationPress = async (notification: NotificationItem) => {
    console.log(
      "📱 Notification pressed:",
      notification.id,
      notification.title,
    );

    try {
      // Mark as read based on source
      if (!notification.read) {
        if (notification.source === "local") {
          await markLocalAsRead(userId!, notification.id);
        } else {
          await markNotificationAsRead(notification.id);
        }
        await fetchAppwriteUnreadCount(userId!);

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n,
          ),
        );
      }

      // Navigate based on type
      if (notification.type === "event") {
        router.push("/calendar");
      } else if (
        notification.type === "like" ||
        notification.type === "review"
      ) {
        const propertyId = notification.data?.propertyId;
        if (propertyId) {
          router.push(`/properties/${propertyId}`);
        }
      } else if (notification.type === "message") {
        router.push("/message");
      }
    } catch (error) {
      console.error("❌ Error handling notification:", error);
      Alert.alert("Error", "Could not open notification");
    }
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case "like":
        return icons.like;
      case "message":
        return icons.chat;
      case "review":
        return icons.star;
      case "event":
        return icons.calendar;
      default:
        return icons.bell;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case "like":
        return "#FF69B4";
      case "message":
        return "#3B82F6";
      case "review":
        return "#F59E0B";
      case "event":
        return "#10B981";
      default:
        return theme.primary[300];
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderNotification = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      onPress={() => handleNotificationPress(item)}
      activeOpacity={0.7}
      className={`flex-row items-center p-4 rounded-xl mb-3 ${
        !item.read ? "bg-primary-50" : ""
      }`}
      style={{
        backgroundColor: !item.read ? theme.primary[100] : theme.surface,
        borderWidth: 1,
        borderColor: theme.muted + "30",
      }}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: getColorForType(item.type) + "20" }}
      >
        <Image
          source={getIconForType(item.type)}
          className="w-6 h-6"
          style={{ tintColor: getColorForType(item.type) }}
        />
      </View>

      <View className="flex-1">
        <Text
          className="font-rubik-bold text-base"
          style={{ color: theme.text }}
        >
          {item.title}
        </Text>
        <Text className="text-sm mt-1" style={{ color: theme.muted }}>
          {item.message}
        </Text>
        <Text className="text-xs mt-1" style={{ color: theme.muted }}>
          {formatTime(item.createdAt)}
        </Text>
        {item.source === "local" && (
          <View className="mt-1">
            <Text className="text-xs" style={{ color: theme.primary[300] }}>
              📅 Calendar Event
            </Text>
          </View>
        )}
      </View>

      {!item.read && <View className="w-2 h-2 bg-primary-300 rounded-full" />}
    </TouchableOpacity>
  );

  const getEmptyMessage = () => {
    if (loading) return null;
    return {
      title: "No notifications yet",
      message:
        "When you get likes, messages, or add calendar events, they'll appear here",
    };
  };

  const emptyMessage = getEmptyMessage();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity onPress={handleBackPress} className="mr-4 p-2">
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          Notifications
        </Text>
        <TouchableOpacity onPress={fetchAllNotifications} className="p-2">
          <Image
            source={icons.refresh}
            className="w-5 h-5"
            style={{ tintColor: theme.primary[300] }}
          />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-2" style={{ color: theme.muted }}>
            Loading notifications...
          </Text>
        </View>
      ) : notifications.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Image
            source={icons.bell}
            className="w-20 h-20 opacity-30 mb-4"
            style={{ tintColor: theme.muted }}
          />
          <Text
            className="text-lg font-rubik-medium text-center"
            style={{ color: theme.text }}
          >
            {emptyMessage?.title}
          </Text>
          <Text
            className="text-sm text-center mt-2"
            style={{ color: theme.muted }}
          >
            {emptyMessage?.message}
          </Text>
          <TouchableOpacity
            onPress={fetchAllNotifications}
            className="mt-4 px-4 py-2 rounded-full bg-primary-300"
          >
            <Text className="text-white">Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => `${item.source}_${item.id}`}
          contentContainerStyle={{ padding: 20, paddingBottom: 200 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary[300]]}
              tintColor={theme.primary[300]}
            />
          }
          renderItem={renderNotification}
        />
      )}
    </SafeAreaView>
  );
}
