// components/BlueAvatarBottomSheet.tsx
import { avatarImages } from "@/constants/data";
import React, { useRef } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
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

export default function BlueAvatarBottomSheet({
  visible,
  onClose,
  onSelect,
  currentAvatarId,
}: Props) {
  const screenHeight = Dimensions.get("window").height;
  const screenWidth = Dimensions.get("window").width;
  const size = (screenWidth - 80) / 3;

  const maxHeight = screenHeight * 0.75;

  const translateY = useRef(new Animated.Value(maxHeight)).current;

  // PanResponder for drag-to-close
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > maxHeight * 0.3) {
          // dragged enough to close
          Animated.timing(translateY, {
            toValue: maxHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onClose());
        } else {
          // snap back
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  // Animate open when modal visible
  React.useEffect(() => {
    if (visible) {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      translateY.setValue(maxHeight);
    }
  }, [visible]);

  return (
    <Modal visible={visible} animationType="none" transparent>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }}
        onPress={onClose}
      />

      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          width: "100%",
          maxHeight,
          backgroundColor: "#E0F0FF",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: 20,
          transform: [{ translateY }],
        }}
        {...panResponder.panHandlers}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "#0046CC" }}>
            Pick Avatar
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={{ fontSize: 24, color: "#0046CC" }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar Grid */}
        <FlatList
          data={avatarImages}
          numColumns={3}
          columnWrapperStyle={{
            justifyContent: "space-between",
            marginBottom: 16,
          }}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const selected = currentAvatarId === item.id;
            return (
              <TouchableOpacity
                onPress={() => onSelect(item.id)}
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: selected ? 3 : 0,
                  borderColor: "#0046CC",
                  overflow: "hidden",
                }}
              >
                <Image
                  source={item.source}
                  style={{ width: "100%", height: "100%" }}
                />
              </TouchableOpacity>
            );
          }}
        />
      </Animated.View>
    </Modal>
  );
}
