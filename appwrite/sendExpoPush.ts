import { Client, Databases, ID, Query } from "node-appwrite";

const client = new Client();
client
  .setEndpoint(process.env.APPWRITE_FUNCTION_ENDPOINT!)
  .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID!)
  .setKey(process.env.APPWRITE_FUNCTION_API_KEY!);

const databases = new Databases(client);

const databaseId = process.env.APPWRITE_DATABASE_ID!;
const usersCollectionId = process.env.APPWRITE_USERS_COLLECTION_ID!;
const pushTokensCollectionId = process.env.APPWRITE_PUSH_TOKENS_COLLECTION_ID!;
const notificationsCollectionId =
  process.env.APPWRITE_NOTIFICATIONS_COLLECTION_ID!;
const expoPushEndpoint =
  process.env.EXPO_PUSH_ENDPOINT ||
  process.env.EXPO_PUBLIC_PUSH_ENDPOINT ||
  "https://exp.host/--/api/v2/push/send";

interface ExpoMessage {
  to: string;
  sound?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: string;
}

interface AppwriteUserDoc {
  $id: string;
  accountId: string;
  email: string;
}

interface PushTokenDoc {
  $id: string;
  userId: string;
  token: string;
  deviceType: string;
  isActive: boolean;
}

// ✅ Fixed - tries $id first, falls back to accountId separately
async function findUserDocument(
  userId: string,
): Promise<AppwriteUserDoc | null> {
  // Try by document $id first
  let response = await databases.listDocuments(databaseId, usersCollectionId, [
    Query.equal("$id", userId),
  ]);

  // Fall back to accountId if not found
  if (response.documents.length === 0) {
    response = await databases.listDocuments(databaseId, usersCollectionId, [
      Query.equal("accountId", userId),
    ]);
  }

  return response.documents.length > 0
    ? (response.documents[0] as unknown as AppwriteUserDoc)
    : null;
}

// ✅ Fetch active push tokens from pushTokens collection
async function getUserPushTokens(userId: string): Promise<string[]> {
  try {
    const response = await databases.listDocuments(
      databaseId,
      pushTokensCollectionId,
      [Query.equal("userId", userId), Query.equal("isActive", true)],
    );

    return response.documents.map(
      (doc) => (doc as unknown as PushTokenDoc).token,
    );
  } catch (error) {
    console.error("Error fetching push tokens:", error);
    return [];
  }
}

// ✅ Send to multiple tokens (user may have multiple devices)
async function sendExpoPushToTokens(
  tokens: string[],
  message: Omit<ExpoMessage, "to">,
) {
  if (tokens.length === 0) return;

  const messages = tokens.map((token) => ({
    to: token,
    ...message,
  }));

  const response = await fetch(expoPushEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Expo bulk push failed: ${response.status} ${body}`);
  }

  return response.json();
}

export async function createAppwriteNotificationAndSendPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  // Find user
  const userDoc = await findUserDocument(userId);
  if (!userDoc) {
    throw new Error(`User with id ${userId} not found`);
  }

  // ✅ Use ID.unique() instead of custom ID generation
  const notificationDocument = await databases.createDocument(
    databaseId,
    notificationsCollectionId,
    ID.unique(),
    {
      userId: userDoc.$id,
      title,
      message: body,
      read: false,
      type: "alert",
      // ✅ Stringify data object for Appwrite storage
      data: data ? JSON.stringify(data) : "{}",
    },
  );

  // ✅ Fetch tokens from pushTokens collection (consistent with notification.service.ts)
  const pushTokens = await getUserPushTokens(userDoc.accountId);

  if (pushTokens.length > 0) {
    await sendExpoPushToTokens(pushTokens, {
      sound: "default",
      title,
      body,
      data: {
        notificationId: notificationDocument.$id,
        ...data,
      },
      priority: "high",
    });
    console.log(
      `✅ Push sent to ${pushTokens.length} device(s) for user ${userId}`,
    );
  } else {
    console.log(`ℹ️ No active push tokens found for user ${userId}`);
  }

  return notificationDocument;
}

// Appwrite Function entry point
if (require.main === module) {
  (async () => {
    try {
      const userId = process.env.APPWRITE_USER_ID ?? process.env.USER_ID;
      const title = process.env.PUSH_TITLE ?? "New Notification";
      const body = process.env.PUSH_BODY ?? "You have a new alert.";
      const eventData = process.env.PUSH_DATA
        ? JSON.parse(process.env.PUSH_DATA)
        : {};

      if (!userId) {
        throw new Error("Missing APPWRITE_USER_ID or USER_ID");
      }

      const result = await createAppwriteNotificationAndSendPush(
        userId,
        title,
        body,
        eventData,
      );
      console.log("✅ Push sent and notification created:", result);
      process.exit(0);
    } catch (error: any) {
      console.error("❌ Error:", error.message);
      process.exit(1);
    }
  })();
}
