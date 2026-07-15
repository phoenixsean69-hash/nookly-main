// components/FeaturedModal.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import React from "react";
import {
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface FeaturedModalProps {
  visible: boolean;
  onClose: () => void;
  properties: any[];
  onPropertyPress: (id: string) => void;
}

const FeaturedModal = ({
  visible,
  onClose,
  properties,
  onPropertyPress,
}: FeaturedModalProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View
          className="flex-1 mt-20 rounded-t-3xl"
          style={{ backgroundColor: theme.background }}
        >
          {/* Header */}
          <View
            className="flex-row items-center justify-between p-5 border-b"
            style={{ borderBottomColor: theme.muted + "30" }}
          >
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Featured Properties
            </Text>

            <TouchableOpacity onPress={onClose} className="p-2">
              <Image source={icons.close} className="w-7 h-7" />
            </TouchableOpacity>
          </View>

          {/* Properties List */}
          <FlatList
            data={properties}
            keyExtractor={(item) => item.$id}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onPropertyPress(item.$id);
                }}
                className="flex-row rounded-xl mb-4 overflow-hidden"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                {/* Property Image */}
                <Image
                  source={{ uri: item.image1 || item.image2 || item.image3 }}
                  className="w-24 h-24"
                  resizeMode="cover"
                />

                {/* Property Details */}
                <View className="flex-1 p-3">
                  <Text
                    className="text-base font-rubik-bold mb-1"
                    style={{ color: theme.title }}
                    numberOfLines={1}
                  >
                    {item.propertyName}
                  </Text>

                  <View className="flex-row items-center mb-1">
                    <Text
                      className="text-xs font-rubik-medium"
                      style={{ color: theme.muted }}
                    >
                      {item.type}
                    </Text>
                  </View>

                  <View className="flex-row items-center mb-1">
                    <Text
                      className="text-xs font-rubik-medium"
                      style={{ color: theme.muted }}
                    >
                      Overall Rating:
                    </Text>
                    <Image
                      source={icons.star}
                      className="w-3.5 h-3.5"
                      style={{ tintColor: "#FDB241" }}
                    />
                    <Text
                      className="text-xs font-rubik ml-1"
                      style={{ color: theme.muted }}
                    >
                      {item.rating || 0}
                    </Text>
                  </View>

                  <Text
                    className="text-xs font-rubik mb-1"
                    style={{ color: theme.muted }}
                    numberOfLines={1}
                  >
                    {item.address}
                  </Text>

                  <View className="flex-row items-center mt-1">
                    <Text
                      className="text-base font-rubik-bold"
                      style={{ color: theme.primary[300] }}
                    >
                      ${item.price}
                    </Text>
                    <Text
                      className="text-xs font-rubik ml-1"
                      style={{ color: theme.muted }}
                    >
                      /month
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View className="items-center justify-center py-10">
                <Image
                  source={icons.house}
                  className="w-16 h-16 opacity-30 mb-3"
                  style={{ tintColor: theme.muted }}
                />
                <Text
                  className="text-base font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  No featured properties
                </Text>
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

export default FeaturedModal;
