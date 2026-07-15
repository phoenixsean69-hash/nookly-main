// services/notification.service.ts
import { config, databases, updateUserPushToken } from "@/lib/appwrite";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { ID, Query } from "react-native-appwrite";

export interface PushToken {
  userId: string;
  token: string;
  deviceType: string;
  isActive: boolean;
}

class NotificationService {
  private expoPushToken: string | null = null;

  // Register for push notifications
  async registerForPushNotificationsAsync(
    userId: string,
  ): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log("Must use physical device for Push Notifications");
        return null;
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.error(
          `❌ Push permission not granted (status: "${finalStatus}"). ` +
            "On Android 13+, enable it in Settings > Apps > Notifications.",
        );
        return null;
      }

      // Guard against missing projectId (easConfig fallback for production builds)
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ??
        Constants.easConfig?.projectId;
      if (!projectId) {
        console.error("❌ Missing EAS projectId (expoConfig/easConfig)");
        return null;
      }

      // Get Expo push token
      const token = await Notifications.getExpoPushTokenAsync({ projectId });

      this.expoPushToken = token.data;
      console.log("Expo Push Token:", token.data);

      // Save token to database
      await this.savePushToken(userId, token.data);

      // Set up notification channels for Android
      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
          name: "default",
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: "#FF231F7C",
        });
      }

      return token.data;
    } catch (error) {
      console.error("Error registering for push notifications:", error);
      return null;
    }
  }


async sendIdVerificationNotification(
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await this.sendNotificationToUser(
    userId,
    title || "🎉 ID Verified!",
    body || "Congratulations! Your ID has been verified!",
    { type: "system", screen: "profile" },
  );
}

  // Save push token to database
  async savePushToken(userId: string, token: string): Promise<void> {
    try {
      // Check if token already exists in push_tokens collection
      const existingTokens = await databases.listDocuments(
        config.databaseId!,
        config.pushTokensCollectionId!,
        [Query.equal("userId", userId), Query.equal("token", token)],
      );

      if (existingTokens.documents.length === 0) {
        await databases.createDocument(
          config.databaseId!,
          config.pushTokensCollectionId!,
          ID.unique(),
          {
            userId,
            token,
            deviceType: Platform.OS,
            isActive: true,
          },
        );
        console.log("✅ Push token saved to push_tokens collection");
      } else {
        // Reactivate token if it exists but was inactive
        const tokenDoc = existingTokens.documents[0];
        if (!tokenDoc.isActive) {
          await databases.updateDocument(
            config.databaseId!,
            config.pushTokensCollectionId!,
            tokenDoc.$id,
            { isActive: true },
          );
          console.log("✅ Push token reactivated in push_tokens collection");
        } else {
          console.log("ℹ️ Push token already active in push_tokens collection");
        }
      }

      // Also sync token to user document so sendExpoPushToUser() can find it
      try {
        // Find user document by accountId
        const userDocs = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("accountId", userId)],
        );

        if (userDocs.documents.length > 0) {
          const userDocId = userDocs.documents[0].$id;
          await updateUserPushToken(userDocId, token);
          console.log("✅ Push token synced to user document");
        } else {
          console.warn("⚠️ Could not find user document to sync token");
        }
      } catch (syncError) {
        // Don't throw — push_tokens collection save already succeeded
        console.error("⚠️ Failed to sync token to user document:", syncError);
      }
    } catch (error) {
      console.error("Error saving push token:", error);
    }
  }

  // Deactivate push token (better than deleting)
  async deactivatePushToken(userId: string, token: string): Promise<void> {
    try {
      const tokens = await databases.listDocuments(
        config.databaseId!,
        config.pushTokensCollectionId!,
        [Query.equal("userId", userId), Query.equal("token", token)],
      );

      for (const tokenDoc of tokens.documents) {
        await databases.updateDocument(
          config.databaseId!,
          config.pushTokensCollectionId!,
          tokenDoc.$id,
          { isActive: false },
        );
      }

      // Also clear token from user document
      try {
        const userDocs = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("accountId", userId)],
        );

        if (userDocs.documents.length > 0) {
          await updateUserPushToken(userDocs.documents[0].$id, null);
          console.log("✅ Push token cleared from user document");
        }
      } catch (syncError) {
        console.error(
          "⚠️ Failed to clear token from user document:",
          syncError,
        );
      }

      console.log("✅ Push token deactivated");
    } catch (error) {
      console.error("Error deactivating push token:", error);
    }
  }

  // Remove push token completely (on logout)
  async removePushToken(userId: string, token: string): Promise<void> {
    try {
      const tokens = await databases.listDocuments(
        config.databaseId!,
        config.pushTokensCollectionId!,
        [Query.equal("userId", userId), Query.equal("token", token)],
      );

      for (const tokenDoc of tokens.documents) {
        await databases.deleteDocument(
          config.databaseId!,
          config.pushTokensCollectionId!,
          tokenDoc.$id,
        );
      }

      // Also clear token from user document
      try {
        const userDocs = await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [Query.equal("accountId", userId)],
        );

        if (userDocs.documents.length > 0) {
          await updateUserPushToken(userDocs.documents[0].$id, null);
        }
      } catch (syncError) {
        console.error(
          "⚠️ Failed to clear token from user document:",
          syncError,
        );
      }

      console.log("✅ Push token removed");
    } catch (error) {
      console.error("Error removing push token:", error);
    }
  }

  // Send notification to specific user (only active tokens)
  async sendNotificationToUser(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<boolean> {
    try {
      const tokens = await databases.listDocuments(
        config.databaseId!,
        config.pushTokensCollectionId!,
        [Query.equal("userId", userId), Query.equal("isActive", true)],
      );

      if (tokens.documents.length === 0) {
        console.log("No active push token found for user:", userId);
        return false;
      }

      // Send to ALL of the user's active devices, not just the first one
      const messages = tokens.documents.map((tokenDoc) => ({
        to: tokenDoc.token,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();

      // Expo returns HTTP 200 even on delivery failure — check tickets
      const tickets = Array.isArray(result.data) ? result.data : [result.data];
      const errors = tickets.filter((t: any) => t?.status === "error");
      if (errors.length > 0) {
        console.error(
          "❌ Expo push ticket errors:",
          JSON.stringify(errors, null, 2),
        );
        // Auto-deactivate stale tokens so future sends skip them
        for (let i = 0; i < tickets.length; i++) {
          if (
            tickets[i]?.status === "error" &&
            tickets[i]?.details?.error === "DeviceNotRegistered"
          ) {
            const staleDoc = tokens.documents[i];
            if (staleDoc) {
              await databases
                .updateDocument(
                  config.databaseId!,
                  config.pushTokensCollectionId!,
                  staleDoc.$id,
                  { isActive: false },
                )
                .catch(() => {});
              console.log("🧹 Deactivated stale token for user:", userId);
            }
          }
        }
        // If at least one ticket succeeded, count it as sent
        return errors.length < tickets.length;
      }

      console.log("✅ Push notification sent:", result);
      return true;
    } catch (error) {
      console.error("Error sending push notification:", error);
      return false;
    }
  }

  // Send notification to multiple users - single query instead of loop
  async sendBulkNotification(
    userIds: string[],
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      if (userIds.length === 0) return;

      // One query for all users instead of one per user
      const tokens = await databases.listDocuments(
        config.databaseId!,
        config.pushTokensCollectionId!,
        [Query.equal("userId", userIds), Query.equal("isActive", true)],
      );

      if (tokens.documents.length === 0) {
        console.log("No active tokens found for users");
        return;
      }

      const messages = tokens.documents.map((tokenDoc) => ({
        to: tokenDoc.token,
        sound: "default",
        title,
        body,
        data,
        priority: "high",
      }));

      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });

      const bulkResult = await response.json();
      const bulkTickets = Array.isArray(bulkResult.data)
        ? bulkResult.data
        : [bulkResult.data];
      const bulkErrors = bulkTickets.filter((t: any) => t?.status === "error");
      if (bulkErrors.length > 0) {
        console.error(
          "❌ Bulk push ticket errors:",
          JSON.stringify(bulkErrors, null, 2),
        );
      }
      console.log("✅ Bulk push notifications sent:", bulkResult);
    } catch (error) {
      console.error("Error sending bulk notifications:", error);
    }
  }

  // Send notification to all tenants
  async sendNotificationToAllTenants(
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      const users = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("userMode", "tenant")],
      );

      const userIds = users.documents.map((user) => user.accountId);

      const batchSize = 5;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await this.sendBulkNotification(batch, title, body, data);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`✅ Sent notifications to ${userIds.length} tenants`);
    } catch (error) {
      console.error("Error sending notification to tenants:", error);
    }
  }

  // Send notification to all landlords
  async sendNotificationToAllLandlords(
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      const users = await databases.listDocuments(
        config.databaseId!,
        config.usersCollectionId!,
        [Query.equal("userMode", "landlord")],
      );

      const userIds = users.documents.map((user) => user.accountId);

      const batchSize = 5;
      for (let i = 0; i < userIds.length; i += batchSize) {
        const batch = userIds.slice(i, i + batchSize);
        await this.sendBulkNotification(batch, title, body, data);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log(`✅ Sent notifications to ${userIds.length} landlords`);
    } catch (error) {
      console.error("Error sending notification to landlords:", error);
    }
  }

  // Send notification about new match
  async sendMatchNotification(
    userId: string,
    matchName: string,
    matchLocation: string,
  ): Promise<void> {
    await this.sendNotificationToUser(
      userId,
      "New Match Found! 🎉",
      `${matchName} is looking for a place in ${matchLocation}. Check your matches now!`,
      { type: "match", screen: "match" },
    );
  }

  // Send notification about new property listing
  async sendNewPropertyNotification(
    userId: string,
    propertyName: string,
    propertyPrice: number,
  ): Promise<void> {
    await this.sendNotificationToUser(
      userId,
      "New Property Listed 🏠",
      `${propertyName} - $${propertyPrice}/month. Check it out!`,
      { type: "property", screen: "explore" },
    );
  }

  // Send notification about rental request
  async sendRentalRequestNotification(
    landlordId: string,
    tenantName: string,
    propertyName: string,
  ): Promise<void> {
    await this.sendNotificationToUser(
      landlordId,
      "New Rental Request 📋",
      `${tenantName} has requested to rent ${propertyName}`,
      { type: "request", screen: "landlord-requests" },
    );
  }

  // Send notification about request response (updated to include rejection reason)
  async sendRequestResponseNotification(
    tenantId: string,
    propertyName: string,
    status: "accepted" | "rejected",
    rejectionReason?: string, // ✅ Added optional rejection reason
  ): Promise<void> {
    const isAccepted = status === "accepted";
    const title = isAccepted ? "Request Accepted! 🎉" : "Request Declined ❌";

    let body: string;
    if (isAccepted) {
      body = `Your request for ${propertyName} has been accepted! The landlord will contact you soon.`;
    } else {
      // Include rejection reason if provided
      if (rejectionReason) {
        body = `Your request for ${propertyName} was declined.\nReason: ${rejectionReason}\nKeep looking for other great properties!`;
      } else {
        body = `Your request for ${propertyName} was declined. Keep looking for other great properties!`;
      }
    }

    await this.sendNotificationToUser(tenantId, title, body, {
      type: "request_response",
      status,
      propertyName,
      ...(rejectionReason && { rejectionReason }), // Include reason in data if provided
    });
  }

  // Get current Expo push token
  getExpoPushToken(): string | null {
    return this.expoPushToken;
  }
}

export default new NotificationService();
