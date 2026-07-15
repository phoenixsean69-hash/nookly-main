import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";

export default function Index() {
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    if (user.userMode === "tenant") {
      router.replace("/tenantHome");
    } else if (user.userMode === "landlord") {
      router.replace("/landHome");
    }
  }, [user]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2196F3" />
      <Text className="mt-4 text-lg font-rubik-medium text-black-300">
        Loading...
      </Text>
    </View>
  );
}
