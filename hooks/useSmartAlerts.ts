import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

export interface SearchAlert {
  id: string;
  query?: string;
  filter?: string;
  bedrooms?: number;
  priceRange?: any;
  customPrice?: any;
  location?: string;
  facilities: string[];
  timestamp: number;
}

const STORAGE_KEY = "smart_alerts";
const MAX_ALERTS = 3;

export const useSmartAlerts = () => {
  const [alerts, setAlerts] = useState<SearchAlert[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setAlerts(JSON.parse(stored));
    } catch (e) {
      console.error("Error loading alerts:", e);
    }
  };

  const saveAlert = async (alert: Omit<SearchAlert, "id" | "timestamp">) => {
    try {
      // Don't save empty searches
      const hasFilters =
        alert.query ||
        alert.filter ||
        alert.bedrooms ||
        alert.priceRange ||
        alert.customPrice ||
        alert.location ||
        alert.facilities.length > 0;

      if (!hasFilters) return;

      const newAlert: SearchAlert = {
      ...alert,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };

      // Remove duplicates and keep only last 3
      const updated = [
        newAlert,
      ...alerts.filter(
          (a) =>
            JSON.stringify({...a, id: "", timestamp: 0 })!==
            JSON.stringify({...newAlert, id: "", timestamp: 0 })
        ),
      ].slice(0, MAX_ALERTS);

      setAlerts(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving alert:", e);
    }
  };

  const deleteAlert = async (id: string) => {
    const updated = alerts.filter((a) => a.id!== id);
    setAlerts(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const clearAllAlerts = async () => {
    setAlerts([]);
    await AsyncStorage.removeItem(STORAGE_KEY);
  };

  return { alerts, saveAlert, deleteAlert, clearAllAlerts };
};
