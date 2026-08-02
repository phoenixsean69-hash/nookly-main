import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { Query } from "react-native-appwrite";

import { client, config, databases } from "@/lib/appwrite";

const COLLECTION_CHANGED_AT_PREFIX =
  "@nookly:appwrite-collection-changed-at:v1";
const COLLECTION_SIGNATURE_PREFIX =
  "@nookly:appwrite-collection-signature:v1";

export type CollectionVersionStatus =
  | "unchanged"
  | "changed"
  | "unknown"
  | "unavailable";

export interface AppwriteCollectionChange {
  collectionId: string;
  documentId: string | null;
  action: "create" | "update" | "delete" | "unknown";
  payload: Record<string, unknown> | null;
  occurredAt: number;
  events: string[];
}

type CollectionChangeListener = (
  change: AppwriteCollectionChange,
) => void;
type ReconnectListener = () => void;

const collectionListeners = new Map<
  string,
  Set<CollectionChangeListener>
>();
const reconnectListeners = new Set<ReconnectListener>();
const collectionChangedAtMemory = new Map<string, number>();
const versionCheckPromises = new Map<
  string,
  Promise<CollectionVersionStatus>
>();
const baselineRefreshPromises = new Map<string, Promise<void>>();

let activeNamespace = "anonymous";
let realtimeUnsubscribe: (() => void) | null = null;
let netInfoUnsubscribe: (() => void) | null = null;
let previousOnlineState: boolean | null = null;

const normalizeNamespace = (
  namespace?: string | null,
): string => String(namespace || "anonymous").trim() || "anonymous";

const hashText = (value: string): string => {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
};

const getNamespaceScope = (
  namespace?: string | null,
): string => hashText(normalizeNamespace(namespace));

const getChangedAtStorageKey = (
  collectionId: string,
  namespace?: string | null,
): string =>
  `${COLLECTION_CHANGED_AT_PREFIX}:${getNamespaceScope(
    namespace,
  )}:${collectionId}`;

const getSignatureStorageKey = (
  collectionId: string,
  namespace?: string | null,
): string =>
  `${COLLECTION_SIGNATURE_PREFIX}:${getNamespaceScope(
    namespace,
  )}:${collectionId}`;

const getScopedCollectionKey = (
  collectionId: string,
  namespace?: string | null,
): string =>
  `${getNamespaceScope(namespace)}:${collectionId}`;

const isOnlineState = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}): boolean =>
  state.isConnected === true &&
  state.isInternetReachable !== false;

const uniqueCollectionIds = (
  collectionIds: Array<string | null | undefined>,
): string[] =>
  Array.from(
    new Set(
      collectionIds
        .filter(
          (collectionId): collectionId is string =>
            typeof collectionId === "string",
        )
        .map((collectionId) => collectionId.trim())
        .filter(Boolean),
    ),
  );

export const getConfiguredAppwriteCollectionIds = (): string[] =>
  uniqueCollectionIds([
    config.usersCollectionId,
    config.propertiesCollectionId,
    config.landlordsCollectionId,
    config.galleriesCollectionId,
    config.reviewsCollectionId,
    config.favoritesCollectionId,
    config.likesCollectionId,
    config.activitiesCollectionId,
    config.notificationsCollectionId,
    config.requestsCollectionId,
    config.matchProfilesCollectionId,
    config.organizationsCollectionId,
    config.organizationTenantsCollectionId,
    config.queriesCollectionId,
    config.tenantProfilesCollectionId,
  ]);

const getActionFromEvents = (
  events: string[],
): AppwriteCollectionChange["action"] => {
  if (events.some((event) => event.endsWith(".create"))) {
    return "create";
  }

  if (events.some((event) => event.endsWith(".update"))) {
    return "update";
  }

  if (events.some((event) => event.endsWith(".delete"))) {
    return "delete";
  }

  return "unknown";
};

const resolveChangedCollectionIds = (
  events: string[],
): string[] => {
  const configuredIds = getConfiguredAppwriteCollectionIds();

  return configuredIds.filter((collectionId) =>
    events.some((event) =>
      event.includes(
        `.collections.${collectionId}.documents`,
      ),
    ),
  );
};

const emitCollectionChange = (
  change: AppwriteCollectionChange,
): void => {
  const listeners = collectionListeners.get(
    change.collectionId,
  );

  listeners?.forEach((listener) => {
    try {
      listener(change);
    } catch (error) {
      console.warn(
        "Appwrite collection-change listener failed:",
        error,
      );
    }
  });
};

const markCollectionChanged = async (
  collectionId: string,
  namespace = activeNamespace,
  occurredAt = Date.now(),
): Promise<void> => {
  const scopedKey = getScopedCollectionKey(
    collectionId,
    namespace,
  );

  collectionChangedAtMemory.set(scopedKey, occurredAt);
  versionCheckPromises.delete(scopedKey);

  try {
    await AsyncStorage.setItem(
      getChangedAtStorageKey(collectionId, namespace),
      String(occurredAt),
    );
  } catch (error) {
    console.warn(
      "Could not persist Appwrite collection change time:",
      error,
    );
  }
};

const handleRealtimeResponse = (response: any): void => {
  const events = Array.isArray(response?.events)
    ? response.events.filter(
        (event: unknown): event is string =>
          typeof event === "string",
      )
    : [];

  if (events.length === 0) return;

  const changedCollectionIds =
    resolveChangedCollectionIds(events);

  if (changedCollectionIds.length === 0) return;

  const payload =
    response?.payload &&
    typeof response.payload === "object"
      ? (response.payload as Record<string, unknown>)
      : null;
  const documentId =
    typeof payload?.$id === "string"
      ? payload.$id
      : null;
  const occurredAt = Date.now();
  const action = getActionFromEvents(events);

  changedCollectionIds.forEach((collectionId) => {
    void markCollectionChanged(
      collectionId,
      activeNamespace,
      occurredAt,
    );

    emitCollectionChange({
      collectionId,
      documentId,
      action,
      payload,
      occurredAt,
      events,
    });
  });
};

const ensureNetworkListener = (): void => {
  if (netInfoUnsubscribe) return;

  netInfoUnsubscribe = NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);

    if (
      previousOnlineState === false &&
      online === true
    ) {
      versionCheckPromises.clear();

      reconnectListeners.forEach((listener) => {
        try {
          listener();
        } catch (error) {
          console.warn(
            "Appwrite reconnect listener failed:",
            error,
          );
        }
      });
    }

    previousOnlineState = online;
  });
};

export const startAppwriteRealtimeCache = (
  namespace?: string | null,
): void => {
  const nextNamespace = normalizeNamespace(namespace);
  ensureNetworkListener();

  if (
    realtimeUnsubscribe &&
    activeNamespace === nextNamespace
  ) {
    return;
  }

  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;
  activeNamespace = nextNamespace;
  versionCheckPromises.clear();
  baselineRefreshPromises.clear();

  const channels = getConfiguredAppwriteCollectionIds().map(
    (collectionId) =>
      `databases.${config.databaseId}.collections.${collectionId}.documents`,
  );

  if (channels.length === 0) return;

  try {
    realtimeUnsubscribe = client.subscribe(
      channels,
      handleRealtimeResponse,
    );
  } catch (error) {
    console.warn(
      "Could not start Appwrite realtime cache listener:",
      error,
    );
  }
};

export const stopAppwriteRealtimeCache = (): void => {
  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;
  activeNamespace = "anonymous";
  versionCheckPromises.clear();
  baselineRefreshPromises.clear();
};

export const subscribeToAppwriteCollectionChanges = (
  collectionIds: Array<string | null | undefined>,
  listener: CollectionChangeListener,
): (() => void) => {
  const ids = uniqueCollectionIds(collectionIds);

  ids.forEach((collectionId) => {
    const listeners =
      collectionListeners.get(collectionId) ??
      new Set<CollectionChangeListener>();

    listeners.add(listener);
    collectionListeners.set(collectionId, listeners);
  });

  return () => {
    ids.forEach((collectionId) => {
      const listeners =
        collectionListeners.get(collectionId);

      listeners?.delete(listener);

      if (listeners?.size === 0) {
        collectionListeners.delete(collectionId);
      }
    });
  };
};

export const subscribeToAppwriteReconnect = (
  listener: ReconnectListener,
): (() => void) => {
  reconnectListeners.add(listener);

  return () => {
    reconnectListeners.delete(listener);
  };
};

export const getLatestCollectionChangedAt = async (
  collectionIds: Array<string | null | undefined>,
  namespace?: string | null,
): Promise<number> => {
  const ids = uniqueCollectionIds(collectionIds);

  if (ids.length === 0) return 0;

  const values = await Promise.all(
    ids.map(async (collectionId) => {
      const scopedKey = getScopedCollectionKey(
        collectionId,
        namespace,
      );
      const memoryValue =
        collectionChangedAtMemory.get(scopedKey);

      if (typeof memoryValue === "number") {
        return memoryValue;
      }

      try {
        const stored = await AsyncStorage.getItem(
          getChangedAtStorageKey(
            collectionId,
            namespace,
          ),
        );
        const parsed = Number(stored);

        if (Number.isFinite(parsed) && parsed > 0) {
          collectionChangedAtMemory.set(
            scopedKey,
            parsed,
          );
          return parsed;
        }
      } catch (error) {
        console.warn(
          "Could not read Appwrite collection change time:",
          error,
        );
      }

      return 0;
    }),
  );

  return Math.max(0, ...values);
};

const fetchCollectionSignature = async (
  collectionId: string,
): Promise<string> => {
  const response = await databases.listDocuments(
    config.databaseId!,
    collectionId,
    [
      Query.orderDesc("$updatedAt"),
      Query.limit(1),
      Query.select(["$id", "$updatedAt"]),
    ],
  );

  const latestDocument = response.documents[0];

  return [
    response.total,
    latestDocument?.$id ?? "",
    latestDocument?.$updatedAt ?? "",
  ].join(":");
};

const runCollectionVersionCheck = async (
  collectionId: string,
  namespace?: string | null,
): Promise<CollectionVersionStatus> => {
  try {
    const storageKey = getSignatureStorageKey(
      collectionId,
      namespace,
    );
    const previousSignature =
      await AsyncStorage.getItem(storageKey);
    const currentSignature =
      await fetchCollectionSignature(collectionId);

    await AsyncStorage.setItem(
      storageKey,
      currentSignature,
    );

    if (previousSignature === null) {
      return "unknown";
    }

    if (previousSignature === currentSignature) {
      return "unchanged";
    }

    await markCollectionChanged(
      collectionId,
      normalizeNamespace(namespace),
    );
    return "changed";
  } catch (error) {
    console.warn(
      `Could not check Appwrite collection version (${collectionId}):`,
      error,
    );
    return "unavailable";
  }
};

export const checkCollectionVersion = async (
  collectionId: string,
  namespace?: string | null,
  force = false,
): Promise<CollectionVersionStatus> => {
  const scopedKey = getScopedCollectionKey(
    collectionId,
    namespace,
  );

  if (force) {
    versionCheckPromises.delete(scopedKey);
  }

  const existing = versionCheckPromises.get(scopedKey);

  if (existing) return existing;

  const promise = runCollectionVersionCheck(
    collectionId,
    namespace,
  );
  versionCheckPromises.set(scopedKey, promise);

  return promise;
};

export const checkCollectionsForRemoteChanges = async (
  collectionIds: Array<string | null | undefined>,
  namespace?: string | null,
  force = false,
): Promise<CollectionVersionStatus[]> => {
  const ids = uniqueCollectionIds(collectionIds);

  return Promise.all(
    ids.map((collectionId) =>
      checkCollectionVersion(
        collectionId,
        namespace,
        force,
      ),
    ),
  );
};

const refreshCollectionBaseline = async (
  collectionId: string,
  namespace?: string | null,
): Promise<void> => {
  const scopedKey = getScopedCollectionKey(
    collectionId,
    namespace,
  );
  const existing =
    baselineRefreshPromises.get(scopedKey);

  if (existing) return existing;

  const promise = (async () => {
    try {
      const signature =
        await fetchCollectionSignature(collectionId);

      await AsyncStorage.setItem(
        getSignatureStorageKey(
          collectionId,
          namespace,
        ),
        signature,
      );

      versionCheckPromises.set(
        scopedKey,
        Promise.resolve("unchanged"),
      );
    } catch (error) {
      console.warn(
        `Could not refresh Appwrite collection baseline (${collectionId}):`,
        error,
      );
    } finally {
      setTimeout(() => {
        baselineRefreshPromises.delete(scopedKey);
      }, 1_000);
    }
  })();

  baselineRefreshPromises.set(scopedKey, promise);
  return promise;
};

export const refreshCollectionVersionBaselines = async (
  collectionIds: Array<string | null | undefined>,
  namespace?: string | null,
): Promise<void> => {
  const ids = uniqueCollectionIds(collectionIds);

  await Promise.all(
    ids.map((collectionId) =>
      refreshCollectionBaseline(
        collectionId,
        namespace,
      ),
    ),
  );
};
