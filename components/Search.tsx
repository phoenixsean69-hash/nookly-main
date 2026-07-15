import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

const Search = () => {
  const params = useLocalSearchParams<{ query?: string }>();
  const [searchText, setSearchText] = useState(params.query || "");
  const debounceTimer = useRef<number | null>(null); // Fix: initialize with null, type as number | null
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Sync with URL param changes
  useEffect(() => {
    setSearchText(params.query || "");
  }, [params.query]);

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      if (text.trim()) {
        router.setParams({ query: text.trim() });
      } else {
        router.setParams({ query: "" });
      }
    }, 500);
  };

  const clearSearch = () => {
    setSearchText("");
    if (debounceTimer.current !== null) {
      clearTimeout(debounceTimer.current);
    }
    router.setParams({ query: "" });
  };

  return (
    <View
      className="flex-row items-center px-4 py-2 rounded-full"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.muted + "40",
      }}
    >
      <Image
        source={icons.search}
        className="w-5 h-5"
        style={{ tintColor: theme.muted }}
      />
      <TextInput
        className="flex-1 ml-2 text-base"
        placeholder="Search properties..."
        placeholderTextColor={theme.muted}
        value={searchText}
        onChangeText={handleSearch}
        style={{ color: theme.text }}
      />
      {searchText.length > 0 && (
        <TouchableOpacity onPress={clearSearch}>
          <Image
            source={icons.close} // Assuming correct icon name, adjust if needed
            className="w-6 h-6"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export default Search;
