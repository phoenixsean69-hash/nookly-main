import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

type Props = {
  uri: string;
  index: number;
  downloading: boolean;
  onDownload: () => void;
  theme: {
    text: string;
    muted: string;
    surface: string;
    primary: Record<number, string>;
  };
};

export default function PropertyVerificationVideo({
  uri,
  index,
  downloading,
  onDownload,
  theme,
}: Props) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
  });

  return (
    <View
      className="rounded-2xl overflow-hidden mb-4"
      style={{
        backgroundColor: theme.surface,
        borderWidth: 1,
        borderColor: theme.muted + "30",
      }}
    >
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        fullscreenOptions={{ enable: true, orientation: "landscape" }}
        playsInline
        style={{
          width: "100%",
          aspectRatio: 16 / 9,
          backgroundColor: "#000000",
        }}
      />
      <View className="flex-row items-center justify-between p-3">
        <View className="flex-row items-center flex-1">
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={theme.primary[300]}
          />
          <View className="ml-2 flex-1">
            <Text className="font-rubik-bold" style={{ color: theme.text }}>
              Verification video {index + 1}
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: theme.muted }}>
              Uploaded by the landlord to verify the property photos
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={onDownload}
          disabled={downloading}
          accessibilityRole="button"
          accessibilityLabel={`Download verification video ${index + 1}`}
          className="w-10 h-10 rounded-full items-center justify-center ml-3"
          style={{ backgroundColor: theme.primary[100] }}
        >
          {downloading ? (
            <ActivityIndicator size="small" color={theme.primary[300]} />
          ) : (
            <Ionicons
              name="download-outline"
              size={21}
              color={theme.primary[300]}
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
