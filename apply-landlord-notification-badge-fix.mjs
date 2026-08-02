import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const notificationStorePath = path.join(
  root,
  "store",
  "notification.store.ts",
);

const landlordHomePath = path.join(
  root,
  "app",
  "(root)",
  "(landlord)",
  "landHome.tsx",
);

for (const filePath of [
  notificationStorePath,
  landlordHomePath,
]) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Required file not found: ${filePath}\n` +
        "Run this installer from the Nookly project root.",
    );
  }
}

const backupSuffix =
  ".landlord-notification-badge-fix.bak";

function writeWithBackup(filePath, content) {
  const backupPath = `${filePath}${backupSuffix}`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  fs.writeFileSync(filePath, content, "utf8");
}

function patchNotificationStore(original) {
  const startMarker =
    "  fetchAppwriteUnreadCount: async (userId: string) => {";

  const start = original.indexOf(startMarker);

  if (start < 0) {
    throw new Error(
      "Could not find fetchAppwriteUnreadCount in notification.store.ts.",
    );
  }

  const storeEndMarker = "\n}));";
  const storeEnd = original.lastIndexOf(storeEndMarker);

  if (storeEnd < start) {
    throw new Error(
      "Could not find the notification store ending.",
    );
  }

  const replacement = `  fetchAppwriteUnreadCount: async (userId: string) => {
    try {
      const normalizedUserId = userId.trim();

      if (!normalizedUserId) {
        set({
          appwriteUnreadCount: 0,
          totalUnreadCount: get().unreadCount,
        });
        return;
      }

      console.log(
        "🔍 Refreshing Appwrite unread count for:",
        normalizedUserId,
      );

      // Secure server-created notifications use the authenticated account ID,
      // while some older client-created notifications use the users-table
      // document ID. Count both so the badge matches the notification screen.
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
          "Could not resolve the users-table document ID for the badge:",
          lookupError,
        );
      }

      const ids = Array.from(recipientIds);

      const result =
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
            Query.limit(1),
          ],
        );

      const appwriteCount = result.total;
      const localUnread = get().unreadCount;

      console.log(
        "📊 Appwrite unread badge count:",
        appwriteCount,
      );

      set({
        appwriteUnreadCount: appwriteCount,
        totalUnreadCount:
          localUnread + appwriteCount,
      });
    } catch (error) {
      console.error(
        "Error fetching Appwrite unread count:",
        error,
      );
    }
  },`;

  const patched =
    original.slice(0, start) +
    replacement +
    original.slice(storeEnd);

  if (
    !patched.includes(
      "const recipientIds = new Set<string>",
    ) ||
    !patched.includes(
      'Query.equal("read", false)',
    )
  ) {
    throw new Error(
      "Notification-store validation failed.",
    );
  }

  return patched;
}

function patchLandlordHome(original) {
  let content = original;

  content = content.replace(
    `  ActivityIndicator,
  BackHandler,`,
    `  ActivityIndicator,
  AppState,
  BackHandler,`,
  );

  content = content.replace(
    `  config,
  getAvailableProperties,`,
    `  client,
  config,
  getAvailableProperties,`,
  );

  content = content.replace(
    `const STALE_TIME = 5 * 60 * 1000; // Notification badge only
`,
    "",
  );

  content = content.replace(
    `  // Notification badge timestamp only
  const lastNotificationsFetch = useRef<number>(0);
  const backPressCountRef = useRef(0);
`,
    `  const backPressCountRef = useRef(0);
`,
  );

  const oldFocusBlock = `  // Single useFocusEffect for all focus-related operations with stale check
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();

      // Only refresh notifications if stale > 5 min or first load
      if (userId && now - lastNotificationsFetch.current > STALE_TIME) {
        console.log("🔄 Refreshing notification badge...");
        loadNotifications(userId);
        fetchAppwriteUnreadCount(userId);
        lastNotificationsFetch.current = now;
      }
      // The property collection Realtime event updates cached property queries.
      // Only clear the navigation flag so it cannot retrigger on focus.
      if (params.refresh === "true") {
        setTimeout(() => {
          router.setParams({});
        }, 100);
      }
    }, [userId, params.refresh]),
  );
`;

  const newFocusBlock = `  // Refresh the badge whenever the landlord homepage gains focus.
  // This is a lightweight unread-count query and must not be throttled for
  // several minutes because push notifications can arrive at any time.
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        console.log(
          "🔄 Refreshing landlord notification badge...",
        );

        void Promise.all([
          loadNotifications(userId),
          fetchAppwriteUnreadCount(userId),
        ]);
      }

      // The property collection Realtime event updates cached property queries.
      // Only clear the navigation flag so it cannot retrigger on focus.
      if (params.refresh === "true") {
        setTimeout(() => {
          router.setParams({});
        }, 100);
      }
    }, [
      fetchAppwriteUnreadCount,
      loadNotifications,
      params.refresh,
      userId,
    ]),
  );

  // Update the badge immediately when the notifications collection changes.
  useEffect(() => {
    if (
      !userId ||
      !config.databaseId ||
      !config.notificationsCollectionId
    ) {
      return;
    }

    const channel =
      \`databases.\${config.databaseId}.collections.\${config.notificationsCollectionId}.documents\`;

    const unsubscribe = client.subscribe(
      channel,
      () => {
        void fetchAppwriteUnreadCount(userId);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [fetchAppwriteUnreadCount, userId]);

  // Android can receive a push while the app is in the background and its
  // Realtime socket is paused. Refresh as soon as Nookly becomes active again.
  useEffect(() => {
    if (!userId) return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          void fetchAppwriteUnreadCount(userId);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [fetchAppwriteUnreadCount, userId]);
`;

  if (content.includes(oldFocusBlock)) {
    content = content.replace(
      oldFocusBlock,
      newFocusBlock,
    );
  } else if (
    !content.includes(
      "Update the badge immediately when the notifications collection changes.",
    )
  ) {
    throw new Error(
      "Could not find the landlord homepage notification focus block.",
    );
  }

  content = content.replace(
    `    const now = Date.now();
    if (user?.accountId) {`,
    `    if (user?.accountId) {`,
  );

  content = content.replace(
    `        lastNotificationsFetch.current = now;
        console.log("✅ Manual refresh completed");`,
    `        console.log("✅ Manual refresh completed");`,
  );

  const forbidden = [
    "STALE_TIME",
    "lastNotificationsFetch",
  ];

  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(
        `Landlord-home validation failed: ${marker} remains.`,
      );
    }
  }

  const required = [
    "AppState.addEventListener",
    "client.subscribe",
    "fetchAppwriteUnreadCount(userId)",
  ];

  for (const marker of required) {
    if (!content.includes(marker)) {
      throw new Error(
        `Landlord-home validation failed: ${marker} is missing.`,
      );
    }
  }

  return content;
}

const originalStore = fs.readFileSync(
  notificationStorePath,
  "utf8",
);

const originalHome = fs.readFileSync(
  landlordHomePath,
  "utf8",
);

const patchedStore =
  patchNotificationStore(originalStore);

const patchedHome =
  patchLandlordHome(originalHome);

writeWithBackup(
  notificationStorePath,
  patchedStore,
);

writeWithBackup(
  landlordHomePath,
  patchedHome,
);

console.log("");
console.log(
  "Landlord notification badge fix applied.",
);
console.log("");
console.log("Updated:");
console.log("- store/notification.store.ts");
console.log(
  "- app/(root)/(landlord)/landHome.tsx",
);
console.log("");
console.log("The badge now:");
console.log(
  "- counts notifications stored under account ID or user document ID",
);
console.log(
  "- refreshes whenever the homepage gains focus",
);
console.log(
  "- refreshes when the app returns from the background",
);
console.log(
  "- refreshes instantly through Appwrite Realtime",
);
console.log("");
console.log("No Function redeployment is required.");
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
