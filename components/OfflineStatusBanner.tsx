import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, View } from "react-native";

import useOfflineStore from "@/store/offline.store";

const OfflineStatusBanner = () => {
  const isInitialized = useOfflineStore((state) => state.isInitialized);
  const isOnline = useOfflineStore((state) => state.isOnline);
  const pendingActions = useOfflineStore((state) => state.pendingActions);

  if (!isInitialized || isOnline) return null;

  return (
    <View
      className="flex-row items-center justify-center px-4 py-2"
      style={{ backgroundColor: "#FFF7ED" }}
      accessibilityRole="alert"
      accessibilityLabel="Offline mode. Saved information is being shown."
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#C2410C" />
      <Text
        className="ml-2 text-xs font-rubik-medium"
        style={{ color: "#9A3412" }}
      >
        Offline mode · showing saved data
        {pendingActions > 0 ? ` · ${pendingActions} pending` : ""}
      </Text>
    </View>
  );
};

export default OfflineStatusBanner;
