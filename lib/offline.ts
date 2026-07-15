// lib/offline.ts
import { getData, storeData } from "./cache";

export interface OfflineData {
  latestProperties?: any[];
  properties?: any[];
  favorites?: any[];
  timestamp: number;
  lastSync: number;
}

export class OfflineManager {
  private static instance: OfflineManager;
  private offlineData: OfflineData | null = null;
  private syncInProgress = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  static getInstance(): OfflineManager {
    if (!OfflineManager.instance) {
      OfflineManager.instance = new OfflineManager();
    }
    return OfflineManager.instance;
  }

  async loadOfflineData(): Promise<OfflineData | null> {
    try {
      if (this.offlineData) {
        return this.offlineData;
      }
      const data = await getData("offline_data");
      if (data) {
        this.offlineData = data as OfflineData;
        return this.offlineData;
      }
      return null;
    } catch (error) {
      console.error("Failed to load offline data:", error);
      return null;
    }
  }

  async saveOfflineData(
    data: Partial<Omit<OfflineData, "timestamp" | "lastSync">>,
  ) {
    try {
      // Clear any pending save
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }

      // Debounce save to prevent multiple writes
      return new Promise((resolve) => {
        this.saveTimeout = setTimeout(async () => {
          try {
            const existing =
              this.offlineData || (await getData("offline_data"));
            const updated: OfflineData = {
              ...(existing || {}),
              ...data,
              timestamp: Date.now(),
              lastSync: existing?.lastSync || Date.now(),
            };
            await storeData("offline_data", updated);
            this.offlineData = updated;
            resolve(updated);
          } catch (error) {
            console.error("Failed to save offline data:", error);
            resolve(null);
          }
        }, 100) as unknown as NodeJS.Timeout;
      });
    } catch (error) {
      console.error("Failed to save offline data:", error);
    }
  }

  async syncOfflineData() {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    try {
      console.log("🔄 Syncing offline data...");
      // Add your sync logic here
    } finally {
      this.syncInProgress = false;
    }
  }

  getCachedData(): OfflineData | null {
    return this.offlineData;
  }

  async clearOfflineData() {
    try {
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      await storeData("offline_data", null);
      this.offlineData = null;
    } catch (error) {
      console.error("Failed to clear offline data:", error);
    }
  }
}
