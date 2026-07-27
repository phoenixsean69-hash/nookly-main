import { Colors } from "@/constants/Colors";
import {
    searchZimbabweInstitutions,
    ZimbabweTertiaryInstitution,
} from "@/constants/zimbabweTertiaryInstitutions";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
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

interface SearchableInstitutionPickerProps {
  value: string;
  onChange: (institutionName: string) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const categoryIcon = (
  category: ZimbabweTertiaryInstitution["category"],
): keyof typeof Ionicons.glyphMap => {
  switch (category) {
    case "University":
      return "school-outline";
    case "Polytechnic":
      return "construct-outline";
    case "Teachers College":
      return "book-outline";
    default:
      return "build-outline";
  }
};

export default function SearchableInstitutionPicker({
  value,
  onChange,
  label = "University, polytechnic or tertiary college",
  placeholder = "Search Zimbabwean institutions",
  error,
  disabled = false,
}: SearchableInstitutionPickerProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchZimbabweInstitutions(query),
    [query],
  );

  const close = () => {
    Keyboard.dismiss();
    setVisible(false);
    setQuery("");
  };

  const selectInstitution = (item: ZimbabweTertiaryInstitution) => {
    onChange(item.name);
    close();
  };

  return (
    <View>
      <Text
        className="text-sm font-rubik-medium mb-2"
        style={{ color: error ? "#EF4444" : theme.muted }}
      >
        {label}
      </Text>

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => setVisible(true)}
        className="min-h-[56px] rounded-2xl px-4 flex-row items-center"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1.5,
          borderColor: error ? "#EF4444" : `${theme.muted}35`,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          className="w-9 h-9 rounded-xl items-center justify-center mr-3"
          style={{ backgroundColor: `${theme.primary[300]}14` }}
        >
          <Ionicons
            name="school-outline"
            size={20}
            color={theme.primary[300]}
          />
        </View>

        <Text
          numberOfLines={2}
          className="flex-1 text-base font-rubik"
          style={{ color: value ? theme.text : theme.muted }}
        >
          {value || placeholder}
        </Text>

        {value ? (
          <Pressable
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onChange("");
            }}
          >
            <Ionicons name="close-circle" size={22} color={theme.muted} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={21} color={theme.muted} />
        )}
      </TouchableOpacity>

      {!!error && (
        <Text className="text-red-500 text-xs mt-2">{error}</Text>
      )}

      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={close}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.background }}
        >
          <View
            className="px-5 py-4 flex-row items-center"
            style={{
              borderBottomWidth: 1,
              borderBottomColor: `${theme.muted}25`,
            }}
          >
            <TouchableOpacity
              onPress={close}
              className="w-10 h-10 rounded-full items-center justify-center mr-3"
              style={{ backgroundColor: theme.surface }}
            >
              <Ionicons name="arrow-back" size={22} color={theme.text} />
            </TouchableOpacity>

            <View className="flex-1">
              <Text
                className="text-xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                Select your institution
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: theme.muted }}
              >
                Universities, polytechnics and tertiary colleges in Zimbabwe
              </Text>
            </View>
          </View>

          <View className="px-5 pt-4 pb-3">
            <View
              className="rounded-2xl px-4 flex-row items-center"
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
                placeholder="Search by name, abbreviation or town"
                placeholderTextColor={theme.muted}
                className="flex-1 ml-3 text-base"
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

            <Text className="text-xs mt-2" style={{ color: theme.muted }}>
              {results.length} institution{results.length === 1 ? "" : "s"} found
            </Text>
          </View>

          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: 30,
            }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            ListEmptyComponent={
              <View className="items-center justify-center py-16 px-8">
                <Ionicons
                  name="search-outline"
                  size={42}
                  color={theme.muted}
                />
                <Text
                  className="font-rubik-bold text-base mt-4 text-center"
                  style={{ color: theme.text }}
                >
                  No institution found
                </Text>
                <Text
                  className="text-sm mt-2 text-center"
                  style={{ color: theme.muted }}
                >
                  Try the full institution name, an abbreviation or its town.
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = value === item.name;

              return (
                <TouchableOpacity
                  activeOpacity={0.82}
                  onPress={() => selectInstitution(item)}
                  className="rounded-2xl p-4 flex-row items-center"
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
                    className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                    style={{
                      backgroundColor: selected
                        ? theme.primary[300]
                        : `${theme.primary[300]}12`,
                    }}
                  >
                    <Ionicons
                      name={categoryIcon(item.category)}
                      size={22}
                      color={selected ? "#FFFFFF" : theme.primary[300]}
                    />
                  </View>

                  <View className="flex-1 pr-2">
                    <Text
                      className="font-rubik-bold text-sm"
                      style={{ color: theme.title }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      className="text-xs mt-1"
                      style={{ color: theme.muted }}
                    >
                      {item.category} · {item.city}
                    </Text>
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
        </SafeAreaView>
      </Modal>
    </View>
  );
}