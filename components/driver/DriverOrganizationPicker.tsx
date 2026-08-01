import { Colors } from "@/constants/Colors";
import { getDriverOrganizations } from "@/services/driver.service";
import type { DriverOrganizationOption } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface DriverOrganizationPickerProps {
  value: string;
  selectedName?: string;
  onChange: (organization: DriverOrganizationOption | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const normalize = (value: unknown): string =>
  String(value ?? "").trim().toLowerCase();

export default function DriverOrganizationPicker({
  value,
  selectedName,
  onChange,
  label = "Institution registered on Nookly Web",
  placeholder = "Select a registered institution",
  error,
  disabled = false,
}: DriverOrganizationPickerProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [organizations, setOrganizations] = useState<
    DriverOrganizationOption[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const result = await getDriverOrganizations();
      setOrganizations(result);
    } catch (caughtError) {
      setOrganizations([]);
      setLoadError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load registered institutions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrganizations();
  }, [loadOrganizations]);

  const results = useMemo(() => {
    const target = normalize(query);

    if (!target) return organizations;

    return organizations.filter((organization) =>
      [
        organization.name,
        organization.email,
        organization.phone,
        organization.city,
      ]
        .map(normalize)
        .some((candidate) => candidate.includes(target)),
    );
  }, [organizations, query]);

  const close = () => {
    Keyboard.dismiss();
    setVisible(false);
    setQuery("");
  };

  const open = () => {
    setVisible(true);

    if (!loading && organizations.length === 0) {
      void loadOrganizations();
    }
  };

  const selectOrganization = (organization: DriverOrganizationOption) => {
    onChange(organization);
    close();
  };

  return (
    <View>
      <Text
        className="mb-2 text-sm font-rubik-medium"
        style={{ color: error ? "#EF4444" : theme.muted }}
      >
        {label}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={open}
        className="min-h-[56px] flex-row items-center rounded-2xl px-4"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1.5,
          borderColor: error ? "#EF4444" : `${theme.muted}35`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          className="mr-3 h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${theme.primary[300]}14` }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={theme.primary[300]} />
          ) : (
            <Ionicons
              name="business-outline"
              size={20}
              color={theme.primary[300]}
            />
          )}
        </View>

        <Text
          numberOfLines={2}
          className="flex-1 text-base font-rubik"
          style={{ color: value ? theme.text : theme.muted }}
        >
          {selectedName || placeholder}
        </Text>

        {value ? (
          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onChange(null);
            }}
          >
            <Ionicons name="close-circle" size={22} color={theme.muted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={21} color={theme.muted} />
        )}
      </TouchableOpacity>

      {!!error && <Text className="mt-2 text-xs text-red-500">{error}</Text>}

      <Text className="mt-2 text-xs" style={{ color: theme.muted }}>
        Only institutions that have completed Nookly Web setup appear here.
      </Text>

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <View
            className="flex-row items-center px-5 py-4"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: `${theme.muted}25`,
            }}
          >
            <TouchableOpacity
              onPress={close}
              className="mr-3 h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.surface }}
            >
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>

            <View className="flex-1">
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                Select verifying institution
              </Text>
              <Text className="mt-1 text-xs" style={{ color: theme.muted }}>
                Registered organizations from the shared Nookly backend
              </Text>
            </View>
          </View>

          <View className="px-5 pb-3 pt-4">
            <View
              className="flex-row items-center rounded-2xl px-4"
              style={{
                minHeight: 52,
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: `${theme.muted}30`,
              }}
            >
              <Ionicons name="search" size={21} color={theme.muted} />
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="Search registered institutions"
                placeholderTextColor={theme.muted}
                className="ml-3 flex-1 text-base"
                style={{ color: theme.text }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons
                    name="close-circle"
                    size={21}
                    color={theme.muted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {!loading && !loadError && (
              <Text className="mt-2 text-xs" style={{ color: theme.muted }}>
                {results.length} registered institution
                {results.length === 1 ? "" : "s"} found
              </Text>
            )}
          </View>

          {loading ? (
            <View className="flex-1 items-center justify-center px-8">
              <ActivityIndicator size="large" color={theme.primary[300]} />
              <Text className="mt-4 text-sm" style={{ color: theme.muted }}>
                Loading Nookly institutions...
              </Text>
            </View>
          ) : loadError ? (
            <View className="flex-1 items-center justify-center px-8">
              <Ionicons
                name="cloud-offline-outline"
                size={46}
                color={theme.muted}
              />
              <Text
                className="mt-4 text-center text-base font-rubik-bold"
                style={{ color: theme.text }}
              >
                Could not load institutions
              </Text>
              <Text
                className="mt-2 text-center text-sm"
                style={{ color: theme.muted }}
              >
                {loadError}
              </Text>
              <TouchableOpacity
                onPress={() => void loadOrganizations()}
                className="mt-5 rounded-full px-5 py-3"
                style={{ backgroundColor: theme.primary[300] }}
              >
                <Text className="font-rubik-bold text-white">Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.$id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: 30,
                flexGrow: results.length === 0 ? 1 : undefined,
              }}
              ItemSeparatorComponent={() => <View className="h-2" />}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center px-8 py-16">
                  <Ionicons
                    name="business-outline"
                    size={46}
                    color={theme.muted}
                  />
                  <Text
                    className="mt-4 text-center text-base font-rubik-bold"
                    style={{ color: theme.text }}
                  >
                    No registered institution found
                  </Text>
                  <Text
                    className="mt-2 text-center text-sm"
                    style={{ color: theme.muted }}
                  >
                    The institution must first complete its organization setup
                    on Nookly Web.
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const selected = value === item.$id;

                return (
                  <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => selectOrganization(item)}
                    className="flex-row items-center rounded-2xl p-4"
                    style={{
                      backgroundColor: selected
                        ? `${theme.primary[300]}12`
                        : theme.surface,
                      borderWidth: 1.5,
                      borderColor: selected
                        ? theme.primary[300]
                        : `${theme.muted}22`,
                    }}
                  >
                    <View
                      className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: selected
                          ? theme.primary[300]
                          : `${theme.primary[300]}12`,
                      }}
                    >
                      <Ionicons
                        name="business-outline"
                        size={22}
                        color={selected ? "#FFFFFF" : theme.primary[300]}
                      />
                    </View>

                    <View className="flex-1 pr-2">
                      <Text
                        className="text-sm font-rubik-bold"
                        style={{ color: theme.title }}
                      >
                        {item.name}
                      </Text>
                      {!!(item.city || item.email) && (
                        <Text
                          className="mt-1 text-xs"
                          style={{ color: theme.muted }}
                        >
                          {[item.city, item.email].filter(Boolean).join(" · ")}
                        </Text>
                      )}
                    </View>

                    <Ionicons
                      name={selected ? "checkmark-circle" : "chevron-forward"}
                      size={22}
                      color={selected ? theme.primary[300] : theme.muted}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
