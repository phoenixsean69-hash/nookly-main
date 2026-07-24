import NetInfo, {
  type NetInfoState,
} from "@react-native-community/netinfo";

import { initializeOfflineDatabase } from "@/lib/offline/database";
import {
  completeOfflineAction,
  countPendingOfflineActions,
  failOfflineAction,
  getReadyOfflineActions,
  markOfflineActionSyncing,
} from "@/lib/offline/outbox";
import type {
  OfflineAction,
  OfflineActionType,
  OfflineSyncSnapshot,
} from "@/lib/offline/types";

type OfflineActionHandler = (action: OfflineAction) => Promise<void>;
type SyncListener = (snapshot: OfflineSyncSnapshot) => void;

class OfflineSyncService {
  private handlers = new Map<OfflineActionType, OfflineActionHandler>();
  private listeners = new Set<SyncListener>();
  private networkSubscription: (() => void) | null = null;
  private started = false;
  private processingPromise: Promise<void> | null = null;

  private snapshot: OfflineSyncSnapshot = {
    isOnline: false,
    isInternetReachable: null,
    isSyncing: false,
    pendingActions: 0,
    lastSyncAt: null,
    lastError: null,
  };

  registerHandler(
    actionType: OfflineActionType,
    handler: OfflineActionHandler,
  ): () => void {
    this.handlers.set(actionType, handler);
    return () => {
      if (this.handlers.get(actionType) === handler) {
        this.handlers.delete(actionType);
      }
    };
  }

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): OfflineSyncSnapshot {
    return this.snapshot;
  }

  private updateSnapshot(updates: Partial<OfflineSyncSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...updates };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }

  private applyNetworkState(state: NetInfoState): void {
    const isOnline = Boolean(state.isConnected) && state.isInternetReachable !== false;
    this.updateSnapshot({
      isOnline,
      isInternetReachable: state.isInternetReachable,
    });

    if (isOnline) {
      void this.processQueue();
    }
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      await initializeOfflineDatabase();
      const pendingActions = await countPendingOfflineActions();
      this.updateSnapshot({ pendingActions });

      const initialNetworkState = await NetInfo.fetch();
      this.applyNetworkState(initialNetworkState);

      this.networkSubscription = NetInfo.addEventListener((state) => {
        this.applyNetworkState(state);
      });
    } catch (error) {
      this.started = false;
      this.updateSnapshot({
        lastError:
          error instanceof Error
            ? error.message
            : "Failed to initialize offline synchronization.",
      });
      throw error;
    }
  }

  stop(): void {
    this.networkSubscription?.();
    this.networkSubscription = null;
    this.started = false;
  }

  async refreshPendingCount(): Promise<number> {
    const pendingActions = await countPendingOfflineActions();
    this.updateSnapshot({ pendingActions });
    return pendingActions;
  }

  async processQueue(): Promise<void> {
    if (!this.snapshot.isOnline) return;
    if (this.processingPromise) return this.processingPromise;

    this.processingPromise = this.runQueue().finally(() => {
      this.processingPromise = null;
    });

    return this.processingPromise;
  }

  private async runQueue(): Promise<void> {
    this.updateSnapshot({ isSyncing: true, lastError: null });

    try {
      const actions = await getReadyOfflineActions(100);

      for (const action of actions) {
        const handler = this.handlers.get(action.type);

        // The queue is shared by all features. Unregistered feature actions remain
        // pending until their integration registers a handler.
        if (!handler) continue;

        try {
          await markOfflineActionSyncing(action.id);
          await handler(action);
          await completeOfflineAction(action.id);
        } catch (error) {
          await failOfflineAction(action, error);
        }
      }

      const pendingActions = await countPendingOfflineActions();
      this.updateSnapshot({
        pendingActions,
        lastSyncAt: Date.now(),
      });
    } catch (error) {
      this.updateSnapshot({
        lastError:
          error instanceof Error
            ? error.message
            : "Offline synchronization failed.",
      });
    } finally {
      this.updateSnapshot({ isSyncing: false });
    }
  }
}

const offlineSyncService = new OfflineSyncService();
export default offlineSyncService;
