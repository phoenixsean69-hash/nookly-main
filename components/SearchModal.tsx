// components/SearchModal.tsx
import { Card } from "@/components/Cards";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { searchedProperties } from "@/lib/appwrite";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
}

const SearchModal: React.FC<SearchModalProps> = ({ visible, onClose }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Fetch when query changes (debounced)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim() === "") {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceTimer.current = setTimeout(async () => {
      try {
        const data = await searchedProperties({
          query: query.trim(),
          limit: 20,
        });
        setResults(data);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setLoading(false);
      }
    }, 500);
  }, [query]);

  const handleCardPress = (id: string) => {
    onClose();
    router.push(`/properties/${id}`);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header */}
        <View
          className="flex-row items-center px-4 py-3 border-b"
          style={{ borderBottomColor: theme.muted + "30" }}
        >
          <TouchableOpacity onPress={onClose} className="mr-3 p-2">
            <Image
              source={icons.backArrow}
              className="w-6 h-6"
              style={{ tintColor: theme.text }}
            />
          </TouchableOpacity>
          <View
            className="flex-1 flex-row items-center px-4 py-2 rounded-full"
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
              value={query}
              onChangeText={setQuery}
              autoFocus={true}
              style={{ color: theme.text }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch}>
                <Image source={icons.close} className="w-6 h-6" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color={theme.primary[300]} />
          </View>
        ) : results.length === 0 && query.trim() !== "" ? (
          <View className="flex-1 justify-center items-center px-8">
            <Image
              source={icons.search}
              className="w-20 h-20 opacity-40 mb-4"
              style={{ tintColor: theme.muted }}
            />
            <Text
              className="text-lg font-rubik-bold text-center"
              style={{ color: theme.text }}
            >
              No results found
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: theme.muted }}
            >
              Try different keywords
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8">
            <Image
              source={icons.search}
              className="w-20 h-20 opacity-40 mb-4"
              style={{ tintColor: theme.muted }}
            />
            <Text
              className="text-lg font-rubik-bold text-center"
              style={{ color: theme.text }}
            >
              Start typing to search
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: theme.muted }}
            >
              Find properties by name, location, or amenities
            </Text>
          </View>
        ) : (
          <FlatList
            data={results}
            numColumns={2}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={{ padding: 16 }}
            columnWrapperStyle={{ gap: 16, justifyContent: "space-between" }}
            renderItem={({ item }) => (
              <View style={{ flex: 1 }}>
                <Card item={item} onPress={() => handleCardPress(item.$id)} />
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

export default SearchModal;
