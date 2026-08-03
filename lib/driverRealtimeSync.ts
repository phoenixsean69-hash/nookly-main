import NetInfo from "@react-native-community/netinfo";
import { AppState } from "react-native";

import { client, config } from "@/lib/appwrite";

export type DriverRealtimeRefreshReason =
  | "realtime"
  | "push-received"
  | "push-opened"
  | "foreground"
  | "network-reconnected"
  | "manual";

export interface DriverRealtimeRefreshEvent {
  reason: DriverRealtimeRefreshReason;
  occurredAt: number;
  tableId?: string;
  rowId?: string;
  events?: string[];
}

type DriverRealtimeRefreshListener = (
  event: DriverRealtimeRefreshEvent,
) => void;

const listeners = new Set<DriverRealtimeRefreshListener>();
const rowFingerprints = new Map<string, string>();

let activeAccountId = "";
let realtimeUnsubscribe: (() => void) | null = null;
let networkUnsubscribe: (() => void) | null = null;
let appStateSubscription:
  | ReturnType<typeof AppState.addEventListener>
  | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let pendingEvent: DriverRealtimeRefreshEvent | null = null;
let previousOnlineState: boolean | null = null;

const DRIVER_TABLE_IDS = [
  process.env.EXPO_PUBLIC_APPWRITE_RIDE_DRIVERS_COLLECTION_ID?.trim() ||
    "ride_drivers",
  process.env
    .EXPO_PUBLIC_APPWRITE_RIDE_DRIVER_INSTITUTIONS_COLLECTION_ID?.trim() ||
    "ride_driver_institutions",
  process.env.EXPO_PUBLIC_APPWRITE_RIDE_VEHICLES_COLLECTION_ID?.trim() ||
    "ride_vehicles",
  process.env.EXPO_PUBLIC_APPWRITE_RIDES_COLLECTION_ID?.trim() || "rides",
  process.env.EXPO_PUBLIC_APPWRITE_RIDE_BOOKINGS_COLLECTION_ID?.trim() ||
    "ride_bookings",
].filter(Boolean);

const VOLATILE_FIELDS = new Set([
  "$createdAt",
  "$updatedAt",
  "$sequence",
  "updatedAt",
  "lastSeenAt",
  "lastLocationAt",
  "currentLatitude",
  "currentLongitude",
  "currentHeading",
  "currentSpeedKph",
  "currentAccuracyMeters",
  "latitude",
  "longitude",
  "heading",
  "speedKph",
  "accuracyMeters",
  "recordedAt",
]);

const getTableIdFromEvents = (events: string[]): string | undefined => {
  for (const event of events) {
    const match = event.match(/\.tables\.([^.]+)\.rows(?:\.|$)/);

    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
};

const createStableFingerprint = (
  payload: Record<string, unknown>,
): string => {
  const stableEntries = Object.entries(payload)
    .filter(([key]) => !VOLATILE_FIELDS.has(key))
    .sort(([left], [right]) => left.localeCompare(right));

  try {
    return JSON.stringify(stableEntries);
  } catch {
    return String(Date.now());
  }
};

const shouldRefreshFromRealtimeResponse = (
  response: any,
): {
  shouldRefresh: boolean;
  tableId?: string;
  rowId?: string;
  events: string[];
} => {
  const events = Array.isArray(response?.events)
    ? response.events.filter(
        (event: unknown): event is string =>
          typeof event === "string",
      )
    : [];

  const tableId = getTableIdFromEvents(events);
  const payload =
    response?.payload && typeof response.payload === "object"
      ? (response.payload as Record<string, unknown>)
      : null;
  const rowId =
    typeof payload?.$id === "string" ? payload.$id : undefined;

  if (!payload || !tableId || !rowId) {
    return {
      shouldRefresh: true,
      tableId,
      rowId,
      events,
    };
  }

  const fingerprintKey = `${tableId}:${rowId}`;
  const nextFingerprint = createStableFingerprint(payload);
  const previousFingerprint = rowFingerprints.get(fingerprintKey);

  rowFingerprints.set(fingerprintKey, nextFingerprint);

  return {
    // Ignore repeated location-only updates after the first one.
    shouldRefresh: previousFingerprint !== nextFingerprint,
    tableId,
    rowId,
    events,
  };
};

const emitPendingRefresh = (): void => {
  refreshTimer = null;

  const event = pendingEvent;
  pendingEvent = null;

  if (!event) return;

  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch (error) {
      console.warn("Driver realtime refresh listener failed:", error);
    }
  });
};

export const requestDriverRealtimeRefresh = (
  reason: DriverRealtimeRefreshReason,
  details: Partial<
    Omit<DriverRealtimeRefreshEvent, "reason" | "occurredAt">
  > = {},
): void => {
  pendingEvent = {
    reason,
    occurredAt: Date.now(),
    ...details,
  };

  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  // Coalesce one web action that updates driver, relationship and vehicle rows.
  refreshTimer = setTimeout(emitPendingRefresh, 350);
};

export const subscribeToDriverRealtimeRefresh = (
  listener: DriverRealtimeRefreshListener,
): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const startConnectivityFallbacks = (): void => {
  if (!networkUnsubscribe) {
    networkUnsubscribe = NetInfo.addEventListener((state) => {
      const online =
        state.isConnected === true &&
        state.isInternetReachable !== false;

      if (previousOnlineState === false && online) {
        requestDriverRealtimeRefresh("network-reconnected");
      }

      previousOnlineState = online;
    });
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          requestDriverRealtimeRefresh("foreground");
        }
      },
    );
  }
};

export const startDriverRealtimeSync = (
  accountId: string,
): void => {
  const normalizedAccountId = accountId.trim();

  if (!normalizedAccountId) {
    stopDriverRealtimeSync();
    return;
  }

  startConnectivityFallbacks();

  if (
    realtimeUnsubscribe &&
    activeAccountId === normalizedAccountId
  ) {
    return;
  }

  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;
  activeAccountId = normalizedAccountId;
  rowFingerprints.clear();

  if (!config.databaseId) {
    console.warn(
      "Driver realtime sync could not start: database ID is missing.",
    );
    return;
  }

  const channels = DRIVER_TABLE_IDS.map(
    (tableId) =>
      `tablesdb.${config.databaseId}.tables.${tableId}.rows`,
  );

  try {
    realtimeUnsubscribe = client.subscribe(
      channels,
      (response: any) => {
        const result =
          shouldRefreshFromRealtimeResponse(response);

        if (!result.shouldRefresh) return;

        requestDriverRealtimeRefresh("realtime", {
          tableId: result.tableId,
          rowId: result.rowId,
          events: result.events,
        });
      },
    );
  } catch (error) {
    // Push and foreground refresh remain active when row permissions do not
    // allow a direct realtime subscription.
    console.warn(
      "Driver realtime row subscription could not start:",
      error,
    );
  }
};

export const stopDriverRealtimeSync = (): void => {
  realtimeUnsubscribe?.();
  realtimeUnsubscribe = null;

  networkUnsubscribe?.();
  networkUnsubscribe = null;

  appStateSubscription?.remove();
  appStateSubscription = null;

  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  pendingEvent = null;
  activeAccountId = "";
  previousOnlineState = null;
  rowFingerprints.clear();
};
