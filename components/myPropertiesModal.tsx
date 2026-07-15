// components/myPropertiesModal.tsx
import icons from "@/constants/icons";
import React from "react";
import {
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface FeaturedModalProps {
  visible: boolean;
  onClose: () => void;
  properties: any[];
  onPropertyPress: (id: string) => void;
}

const MyPropertiesModal = ({
  visible,
  onClose,
  properties,
  onPropertyPress,
}: FeaturedModalProps) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-20 rounded-t-3xl">
          {/* Header */}
          <View className="flex-row items-center justify-between p-5 border-b border-primary-200">
            <Text className="text-2xl font-rubik-bold text-black-300">
              All Properties ({properties.length})
            </Text>

            <View className="flex-row items-center">
              <TouchableOpacity onPress={onClose}>
                <Image
                  source={icons.logout}
                  className="size-6"
                  tintColor="#FF3800"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Properties List */}
          <FlatList
            data={properties}
            keyExtractor={(item) => item.$id}
            contentContainerClassName="p-5 pb-10"
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onClose();
                  onPropertyPress(item.$id);
                }}
                className="flex-row bg-white rounded-xl mb-4 shadow-sm border border-primary-100 overflow-hidden"
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
                    className="text-lg font-rubik-bold text-black-300 mb-1"
                    numberOfLines={1}
                  >
                    {item.propertyName}
                  </Text>

                  <View className="flex-row items-center mb-1">
                    <Image
                      source={icons.star}
                      className="size-4"
                      tintColor="#FDB241"
                    />
                    <Text className="text-black-200 text-xs font-rubik ml-1">
                      {item.rating || 0}
                    </Text>
                  </View>

                  <Text
                    className="text-black-200 text-xs font-rubik"
                    numberOfLines={1}
                  >
                    {item.address}
                  </Text>

                  <View className="flex-row items-center mt-2">
                    <Text className="text-sm font-rubik-bold">
                      {item.type === "Boarding"
                        ? `$${item.price} /head/room`
                        : `$${item.price} /month`}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
};

export default MyPropertiesModal;
