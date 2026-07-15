// components/AvatarModal.tsx
import { avatarImages } from "@/constants/data";
import React from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  currentAvatarId: string;
}

export default function AvatarModal({ visible, onClose, onSelect, currentAvatarId }: Props) {
  const screenWidth = Dimensions.get("window").width;
  const size = (screenWidth - 80) / 3;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 bg-black/50">
        <View className="flex-1 bg-white mt-20 rounded-t-3xl">
          <View className="p-4 border-b flex-row justify-between">
            <Text className="text-xl font-bold">Choose Avatar</Text>
            <TouchableOpacity onPress={onClose}>
              <Text className="text-xl">✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={avatarImages}
            numColumns={3}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item.id);
                  onClose();
                }}
                style={{ width: size, height: size, padding: 8 }}
              >
                <Image
                  source={item.source}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: size/2,
                    borderWidth: currentAvatarId === item.id ? 3 : 0,
                    borderColor: '#0066FF'
                  }}
                />
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}