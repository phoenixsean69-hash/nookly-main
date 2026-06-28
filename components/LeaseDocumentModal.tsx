// components/LeaseDocumentModal.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface LeaseDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (file: any) => void;
  propertyName: string;
  tenantName: string;
  isLoading?: boolean;
}

export const LeaseDocumentModal = ({
  visible,
  onClose,
  onSubmit,
  propertyName,
  tenantName,
  isLoading = false,
}: LeaseDocumentModalProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [pickingFile, setPickingFile] = useState(false);

  const pickDocument = async () => {
    try {
      setPickingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          name: file.name || "lease.pdf",
          uri: file.uri,
          mimeType: file.mimeType || "application/pdf",
          size: file.size || 0,
        });
      }
    } catch (error) {
      console.error("Error picking document:", error);
      Alert.alert("Error", "Failed to select document");
    } finally {
      setPickingFile(false);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) {
      Alert.alert("Error", "Please select a lease document");
      return;
    }
    onSubmit(selectedFile);
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.background,
            maxHeight: "70%",
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.title }}
            >
              Send Lease Document
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} style={{ color: theme.text }} />
            </TouchableOpacity>
          </View>

          <Text className="text-sm mb-2" style={{ color: theme.muted }}>
            Send a lease document to {tenantName} for {propertyName}
          </Text>

          <View
            className="rounded-xl p-4 mb-4"
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.muted + "30",
            }}
          >
            <TouchableOpacity
              onPress={pickDocument}
              disabled={pickingFile}
              className="py-8 items-center justify-center border-2 border-dashed rounded-xl"
              style={{
                borderColor: selectedFile
                  ? theme.primary[300]
                  : theme.muted + "40",
              }}
            >
              {pickingFile ? (
                <ActivityIndicator size="small" color={theme.primary[300]} />
              ) : selectedFile ? (
                <>
                  <Ionicons
                    name="document-text"
                    size={40}
                    color={theme.primary[300]}
                  />
                  <Text
                    className="text-center font-rubik-medium mt-2"
                    style={{ color: theme.primary[300] }}
                  >
                    {selectedFile.name}
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    Tap to change document
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="document-outline"
                    size={40}
                    color={theme.muted}
                  />
                  <Text
                    className="text-center font-rubik-medium mt-2"
                    style={{ color: theme.text }}
                  >
                    Tap to select PDF
                  </Text>
                  <Text className="text-xs mt-1" style={{ color: theme.muted }}>
                    Only PDF files are supported
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onClose}
              className="flex-1 py-3 rounded-xl border"
              style={{
                borderColor: theme.muted + "30",
                backgroundColor: theme.surface,
              }}
            >
              <Text
                className="text-center font-rubik-bold"
                style={{ color: theme.text }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading || !selectedFile}
              className="flex-1 py-3 rounded-xl"
              style={{
                backgroundColor:
                  isLoading || !selectedFile ? theme.muted : theme.primary[300],
              }}
            >
              <Text className="text-white text-center font-rubik-bold">
                {isLoading ? "Sending..." : "Send Document"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
