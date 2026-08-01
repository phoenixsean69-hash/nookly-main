import { Colors } from "@/constants/Colors";
import {
  pickAndUploadDriverVehicleImage,
  type DriverVehicleImageKind,
  type UploadedDriverVehicleImage,
} from "@/services/driver.service";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface DriverVehicleImageUploadProps {
  label: string;
  description: string;
  kind: DriverVehicleImageKind;
  fileId: string;
  fileName?: string;
  disabled?: boolean;
  onUploaded: (image: UploadedDriverVehicleImage) => void;
}

export default function DriverVehicleImageUpload({
  label,
  description,
  kind,
  fileId,
  fileName,
  disabled = false,
  onUploaded,
}: DriverVehicleImageUploadProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    setUploading(true);

    try {
      const uploaded = await pickAndUploadDriverVehicleImage(kind);

      if (uploaded) {
        onUploaded(uploaded);
      }
    } catch (caughtError) {
      Alert.alert(
        "Upload failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload the selected vehicle image.",
      );
    } finally {
      setUploading(false);
    }
  };

  const hasImage = Boolean(fileId.trim());

  return (
    <View>
      <Text
        className="mb-2 text-sm font-rubik-medium"
        style={{ color: theme.muted }}
      >
        {label}
      </Text>

      <TouchableOpacity
        activeOpacity={0.84}
        disabled={disabled || uploading}
        onPress={() => void handleUpload()}
        className="min-h-[88px] flex-row items-center rounded-2xl border px-4 py-3"
        style={{
          backgroundColor: theme.surface,
          borderColor: hasImage
            ? `${theme.primary[300]}75`
            : `${theme.muted}35`,
          borderStyle: "dashed",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
          style={{
            backgroundColor: hasImage
              ? `${theme.primary[300]}18`
              : `${theme.muted}12`,
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={theme.primary[300]} />
          ) : (
            <Ionicons
              name={hasImage ? "image" : "camera-outline"}
              size={24}
              color={hasImage ? theme.primary[300] : theme.muted}
            />
          )}
        </View>

        <View className="flex-1 pr-2">
          <Text
            numberOfLines={1}
            className="text-sm font-rubik-bold"
            style={{ color: hasImage ? theme.text : theme.title }}
          >
            {uploading
              ? "Uploading image..."
              : hasImage
                ? fileName || "Vehicle image uploaded"
                : "Tap to select an image"}
          </Text>
          <Text
            numberOfLines={2}
            className="mt-1 text-xs"
            style={{ color: theme.muted }}
          >
            {hasImage ? "Tap to replace this image." : description}
          </Text>
        </View>

        {!uploading && (
          <Ionicons
            name={hasImage ? "checkmark-circle" : "chevron-forward"}
            size={23}
            color={hasImage ? "#16A34A" : theme.muted}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}
