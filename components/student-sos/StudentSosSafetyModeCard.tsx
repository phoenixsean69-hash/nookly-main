import { Colors } from "@/constants/Colors";

import {
  disableStudentSosSafetyModeAsync,
  enableStudentSosSafetyModeAsync,
  getStudentSosSafetyModeStatusAsync,
  refreshStudentSosSafetyLocationAsync,
  type StudentSosSafetyModeStatus,
} from "@/services/student-sos-lock-screen.service";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const INITIAL_STATUS:
  StudentSosSafetyModeStatus = {
    enabled: false,
    notificationId: null,
    cachedLocation: null,
  };

export default function StudentSosSafetyModeCard() {
  const colorScheme =
    useColorScheme();

  const theme =
    Colors[colorScheme ?? "light"];

  const [
    status,
    setStatus,
  ] =
    useState<StudentSosSafetyModeStatus>(
      INITIAL_STATUS,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    changing,
    setChanging,
  ] = useState(false);

  const loadStatus =
    useCallback(async () => {
      try {
        setStatus(
          await getStudentSosSafetyModeStatusAsync(),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const enableSafetyMode =
    async () => {
      setChanging(true);

      try {
        const nextStatus =
          await enableStudentSosSafetyModeAsync();

        setStatus(nextStatus);

        await Haptics
          .notificationAsync(
            Haptics
              .NotificationFeedbackType
              .Success,
          );

        Alert.alert(
          "Safety Mode enabled",
          "A persistent SEND SOS button is now available from your Android notification panel and lock screen. It sends Other danger to your Institution.",
        );
      } catch (error) {
        await Haptics
          .notificationAsync(
            Haptics
              .NotificationFeedbackType
              .Error,
          );

        Alert.alert(
          "Could not enable Safety Mode",
          error instanceof Error
            ? error.message
            : "Safety Mode could not be enabled.",
        );
      } finally {
        setChanging(false);
      }
    };

  const disableSafetyMode =
    async () => {
      setChanging(true);

      try {
        const nextStatus =
          await disableStudentSosSafetyModeAsync();

        setStatus(nextStatus);

        await Haptics
          .selectionAsync();
      } catch (error) {
        Alert.alert(
          "Could not disable Safety Mode",
          error instanceof Error
            ? error.message
            : "Safety Mode could not be disabled.",
        );
      } finally {
        setChanging(false);
      }
    };

  const refreshLocation =
    async () => {
      setChanging(true);

      try {
        const location =
          await refreshStudentSosSafetyLocationAsync();

        setStatus(
          (current) => ({
            ...current,
            cachedLocation:
              location,
          }),
        );

        await Haptics
          .selectionAsync();
      } catch (error) {
        Alert.alert(
          "Location refresh failed",
          error instanceof Error
            ? error.message
            : "Could not refresh the Safety Mode location.",
        );
      } finally {
        setChanging(false);
      }
    };

  if (Platform.OS !== "android") {
    return null;
  }

  return (
    <View
      className="rounded-3xl p-5 mb-6"
      style={{
        backgroundColor:
          status.enabled
            ? "#10B98112"
            : theme.surface,
        borderWidth: 1.5,
        borderColor:
          status.enabled
            ? "#10B98150"
            : `${theme.muted}25`,
      }}
    >
      <View className="flex-row items-start">
        <View
          className="w-12 h-12 rounded-2xl items-center justify-center"
          style={{
            backgroundColor:
              status.enabled
                ? "#10B981"
                : "#DC2626",
          }}
        >
          <Ionicons
            name={
              status.enabled
                ? "shield-checkmark"
                : "shield-outline"
            }
            size={26}
            color="#FFFFFF"
          />
        </View>

        <View className="flex-1 ml-3">
          <Text
            className="text-base font-rubik-bold"
            style={{
              color: theme.title,
            }}
          >
            Lock-screen Safety Mode
          </Text>

          <Text
            className="text-xs mt-1 leading-5"
            style={{
              color: theme.muted,
            }}
          >
            {status.enabled
              ? "Active. SEND SOS is ready in your persistent notification."
              : "Enable a persistent SEND SOS button for urgent use while the phone is locked."}
          </Text>
        </View>

        {loading && (
          <ActivityIndicator
            size="small"
            color={
              theme.primary[300]
            }
          />
        )}
      </View>

      {status.cachedLocation && (
        <View
          className="rounded-2xl p-3 mt-4"
          style={{
            backgroundColor:
              theme.background,
          }}
        >
          <Text
            className="text-xs font-rubik-medium"
            style={{
              color: theme.muted,
            }}
          >
            Cached emergency location
          </Text>

          <Text
            numberOfLines={2}
            className="text-sm font-rubik-bold mt-1 leading-5"
            style={{
              color: theme.text,
            }}
          >
            {status.cachedLocation.address}
          </Text>
        </View>
      )}

      <Text
        className="text-xs mt-4 leading-5"
        style={{
          color: theme.text,
        }}
      >
        The lock-screen button sends an
        Other danger alert to your linked
        Institution. It does not contact
        police or ambulance services.
      </Text>

      <View className="flex-row mt-4">
        <TouchableOpacity
          disabled={
            loading || changing
          }
          onPress={() => {
            void (
              status.enabled
                ? disableSafetyMode()
                : enableSafetyMode()
            );
          }}
          activeOpacity={0.85}
          className="flex-1 rounded-2xl py-3.5 items-center justify-center"
          style={{
            backgroundColor:
              status.enabled
                ? "#DC2626"
                : theme.primary[300],
            opacity:
              loading || changing
                ? 0.55
                : 1,
          }}
        >
          {changing ? (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
            />
          ) : (
            <Text className="text-white font-rubik-bold">
              {status.enabled
                ? "Disable Safety Mode"
                : "Enable Safety Mode"}
            </Text>
          )}
        </TouchableOpacity>

        {status.enabled && (
          <TouchableOpacity
            disabled={changing}
            onPress={() => {
              void refreshLocation();
            }}
            activeOpacity={0.85}
            className="ml-3 rounded-2xl px-4 items-center justify-center"
            style={{
              backgroundColor:
                theme.background,
              borderWidth: 1,
              borderColor:
                `${theme.muted}30`,
            }}
          >
            <Ionicons
              name="locate-outline"
              size={22}
              color={
                theme.primary[300]
              }
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}