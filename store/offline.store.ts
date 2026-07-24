import offlineSyncService from "@/services/sync.service";
import { create } from "zustand";

import type { OfflineSyncSnapshot } from "@/lib/offline/types";

interface OfflineState extends OfflineSyncSnapshot {
  isInitialized: boolean;
  isInitializing: boolean;
  initialize: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshPendingCount: () => Promise<void>;
}

let unsubscribeFromSync: (() => void) | null = null;
let initializationPromise: Promise<void> | null = null;

const initialSyncSnapshot: OfflineSyncSnapshot = {
  isOnline: false,
  isInternetReachable: null,
  isSyncing: false,
  pendingActions: 0,
  lastSyncAt: null,
  lastError: null,
};

const useOfflineStore = create<OfflineState>((set, get) => ({
  ...initialSyncSnapshot,
  isInitialized: false,
  isInitializing: false,

  initialize: async () => {
    if (get().isInitialized) return;
    if (initializationPromise) return initializationPromise;

    initializationPromise = (async () => {
      set({ isInitializing: true, lastError: null });

      try {
        if (!unsubscribeFromSync) {
          unsubscribeFromSync = offlineSyncService.subscribe((snapshot) => {
            set(snapshot);
          });
        }

        await offlineSyncService.start();
        set({ isInitialized: true });
      } catch (error) {
        set({
          lastError:
            error instanceof Error
              ? error.message
              : "Failed to initialize offline storage.",
        });
        throw error;
      } finally {
        set({ isInitializing: false });
        initializationPromise = null;
      }
    })();

    return initializationPromise;
  },

  syncNow: async () => {
    await offlineSyncService.processQueue();
  },

  refreshPendingCount: async () => {
    await offlineSyncService.refreshPendingCount();
  },
}));

export default useOfflineStore;
