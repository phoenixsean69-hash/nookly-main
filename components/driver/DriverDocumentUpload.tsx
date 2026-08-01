import { Colors } from "@/constants/Colors";
import {
  pickAndUploadDriverDocument,
  type DriverDocumentKind,
  type UploadedDriverDocument,
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

interface DriverDocumentUploadProps {
  label: string;
  description: string;
  kind: DriverDocumentKind;
  fileId: string;
  fileName?: string;
  disabled?: boolean;
  onUploaded: (document: UploadedDriverDocument) => void;
}

export default function DriverDocumentUpload({
  label,
  description,
  kind,
  fileId,
  fileName,
  disabled = false,
  onUploaded,
}: DriverDocumentUploadProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    setUploading(true);

    try {
      const uploaded = await pickAndUploadDriverDocument(kind);

      if (uploaded) {
        onUploaded(uploaded);
      }
    } catch (caughtError) {
      Alert.alert(
        "Upload failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload the selected document.",
      );
    } finally {
      setUploading(false);
    }
  };

  const hasDocument = Boolean(fileId.trim());

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
          borderColor: hasDocument
            ? `${theme.primary[300]}75`
            : `${theme.muted}35`,
          borderStyle: "dashed",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <View
          className="mr-3 h-11 w-11 items-center justify-center rounded-xl"
          style={{
            backgroundColor: hasDocument
              ? `${theme.primary[300]}18`
              : `${theme.muted}12`,
          }}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={theme.primary[300]} />
          ) : (
            <Ionicons
              name={hasDocument ? "document-text" : "cloud-upload-outline"}
              size={24}
              color={hasDocument ? theme.primary[300] : theme.muted}
            />
          )}
        </View>

        <View className="flex-1 pr-2">
          <Text
            numberOfLines={1}
            className="text-sm font-rubik-bold"
            style={{ color: hasDocument ? theme.text : theme.title }}
          >
            {uploading
              ? "Uploading document..."
              : hasDocument
                ? fileName || "Document uploaded"
                : "Tap to select a document"}
          </Text>
          <Text
            numberOfLines={2}
            className="mt-1 text-xs"
            style={{ color: theme.muted }}
          >
            {hasDocument ? "Tap to replace this document." : description}
          </Text>
        </View>

        {!uploading && (
          <Ionicons
            name={hasDocument ? "checkmark-circle" : "chevron-forward"}
            size={23}
            color={hasDocument ? "#848482" : theme.muted}
          />
        )}
      </TouchableOpacity>
    </View>
  );
}
