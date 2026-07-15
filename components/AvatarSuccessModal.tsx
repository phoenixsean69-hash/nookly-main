// components/AvatarSuccessModal.tsx
import React, { useEffect } from "react";
import { Animated, Easing, Modal, Text, View } from "react-native";

interface Props {
  visible: boolean;
  onClose: () => void;
  message?: string; // optional custom message
}

export default function AvatarSuccessModal({
  visible,
  onClose,
  message = "Avatar updated!",
}: Props) {
  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    if (visible) {
      // fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }).start();

      // auto-close after 1.5s
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.in(Easing.ease),
        }).start(() => onClose());
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View className="flex-1 justify-center items-center bg-black/40">
        <Animated.View
          style={{
            opacity: fadeAnim,
          }}
          className="bg-blue-500 p-6 rounded-xl items-center shadow-lg"
        >
          <Text className="text-white text-lg font-bold">{message}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}
