import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const appwritePath = path.join(
  root,
  "lib",
  "appwrite.ts",
);

const landlordNotificationsPath = path.join(
  root,
  "app",
  "(root)",
  "(landlord)",
  "landLordNotifications.tsx",
);

for (const filePath of [
  appwritePath,
  landlordNotificationsPath,
]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Required file not found: ${filePath}\n` +
        "Run this installer from the Nookly project root.",
    );
  }
}

const backupSuffix =
  ".landlord-badge-clear-fix-v2.bak";

function writeWithBackup(filePath, content) {
  const backupPath = `${filePath}${backupSuffix}`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

function patchAppwrite(original) {
  const startMarker =
    "export const markAllNotificationsAsRead = async";

  const endMarker =
    "export async function searchedProperties";

  const start = original.indexOf(startMarker);
  const end = original.indexOf(
    endMarker,
    start + startMarker.length,
  );

  if (start < 0 || end < 0) {
    throw new Error(
      "Could not locate markAllNotificationsAsRead in lib/appwrite.ts.",
    );
  }

  const replacement = `export const markAllNotificationsAsRead = async (
  userId: string,
) => {
  try {
    const normalizedUserId = userId.trim();

    if (!normalizedUserId) {
      return false;
    }

    console.log(
      "🔔 Marking all Appwrite notifications as read for:",
      normalizedUserId,
    );

    // Secure Function notifications use the authenticated account ID.
    // Older client-created notifications may use the users-table document ID.
    // Resolve and update both so the badge and notification screen stay aligned.
    const recipientIds = new Set<string>([
      normalizedUserId,
    ]);

    try {
      const userDocs =
        await databases.listDocuments(
          config.databaseId!,
          config.usersCollectionId!,
          [
            Query.equal(
              "accountId",
              normalizedUserId,
            ),
            Query.limit(1),
          ],
        );

      const userDocument =
        userDocs.documents[0];

      if (userDocument?.$id) {
        recipientIds.add(userDocument.$id);
      }
    } catch (lookupError) {
      console.warn(
        "Could not resolve the users-table document ID while marking notifications read:",
        lookupError,
      );
    }

    const ids = Array.from(recipientIds);

    const unreadNotifs =
      await databases.listDocuments(
        config.databaseId!,
        config.notificationsCollectionId!,
        [
          Query.equal(
            "userId",
            ids.length === 1
              ? ids[0]
              : ids,
          ),
          Query.equal("read", false),
          Query.limit(500),
        ],
      );

    console.log(
      "📊 Unread notifications to mark:",
      unreadNotifs.documents.length,
    );

    await Promise.all(
      unreadNotifs.documents.map((doc) =>
        databases.updateDocument(
          config.databaseId!,
          config.notificationsCollectionId!,
          doc.$id,
          { read: true },
        ),
      ),
    );

    console.log(
      "✅ All Appwrite notifications marked as read",
    );

    return true;
  } catch (error) {
    console.error(
      "Error marking all notifications as read:",
      error,
    );
    return false;
  }
};

`;

  const patched =
    original.slice(0, start) +
    replacement +
    original.slice(end);

  const required = [
    "const recipientIds = new Set<string>",
    'Query.equal("read", false)',
    "Query.limit(500)",
    "{ read: true }",
  ];

  for (const marker of required) {
    if (!patched.includes(marker)) {
      throw new Error(
        `Appwrite validation failed: ${marker} is missing.`,
      );
    }
  }

  return patched;
}

function patchLandlordNotifications(original) {
  let content = original;

  // Keep markLocalAsRead for opening one notification,
  // and add markAllLocalAsRead for screen-open clearing.
  if (
    content.includes(
      "    markAsRead: markLocalAsRead,\n",
    ) &&
    !content.includes(
      "    markAllAsRead: markAllLocalAsRead,\n",
    )
  ) {
    content = content.replace(
      "    markAsRead: markLocalAsRead,\n",
      `    markAsRead: markLocalAsRead,
    markAllAsRead: markAllLocalAsRead,
`,
    );
  }

  // Compatibility with the previous failed installer shape.
  if (
    content.includes(
      "    markAllAsRead: markAllLocalAsRead,\n",
    ) &&
    !content.includes(
      "    markAsRead: markLocalAsRead,\n",
    )
  ) {
    content = content.replace(
      "    markAllAsRead: markAllLocalAsRead,\n",
      `    markAsRead: markLocalAsRead,
    markAllAsRead: markAllLocalAsRead,
`,
    );
  }

  content = content.replace(
    `            await markLocalAsRead(userId, "");
`,
    `            await markAllLocalAsRead(userId);
`,
  );

  const required = [
    "markAsRead: markLocalAsRead",
    "markAllAsRead: markAllLocalAsRead",
    "await markAllLocalAsRead(userId);",
    "await markAllNotificationsAsRead(userId);",
    "await fetchAppwriteUnreadCount(userId);",
  ];

  for (const marker of required) {
    if (!content.includes(marker)) {
      throw new Error(
        `Landlord notification screen validation failed: ${marker} is missing.`,
      );
    }
  }

  if (
    content.includes(
      'await markLocalAsRead(userId, "");',
    )
  ) {
    throw new Error(
      "The invalid empty-ID local read call still remains.",
    );
  }

  return content;
}

const originalAppwrite = fs.readFileSync(
  appwritePath,
  "utf8",
);

const originalLandlordNotifications =
  fs.readFileSync(
    landlordNotificationsPath,
    "utf8",
  );

const patchedAppwrite =
  patchAppwrite(originalAppwrite);

const patchedLandlordNotifications =
  patchLandlordNotifications(
    originalLandlordNotifications,
  );

writeWithBackup(
  appwritePath,
  patchedAppwrite,
);

writeWithBackup(
  landlordNotificationsPath,
  patchedLandlordNotifications,
);

console.log("");
console.log(
  "Landlord notification badge clear fix v2 applied.",
);
console.log("");
console.log("Updated:");
console.log("- lib/appwrite.ts");
console.log(
  "- app/(root)/(landlord)/landLordNotifications.tsx",
);
console.log("");
console.log("Behavior:");
console.log(
  "- opening one notification still marks that single local item read",
);
console.log(
  "- opening the Notifications screen marks all local items read",
);
console.log(
  "- Appwrite notifications under both landlord IDs are marked read",
);
console.log(
  "- homepage badge refreshes to zero",
);
console.log("");
console.log("No Function redeployment is required.");
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
