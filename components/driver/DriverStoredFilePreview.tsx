import { Colors } from "@/constants/Colors";
import { getDriverStoredFileUrl } from "@/services/driver.service";
import { Ionicons } from "@expo/vector-icons";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface DriverStoredFilePreviewProps {
  label: string;
  fileId: string;
  description?: string;
  imageHeight?: number;
}

interface CachedDriverFile {
  uri: string;
  type?: string | null;
}

const CACHE_DIRECTORY_NAME = "nookly-driver-files";
const activeDownloads = new Map<string, Promise<CachedDriverFile>>();

const safeCacheKey = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 120);

const findCachedFile = (directory: Directory): CachedDriverFile | null => {
  if (!directory.exists) return null;

  try {
    const cachedFile = directory
      .list()
      .find(
        (entry): entry is File =>
          entry instanceof File && entry.exists && entry.size > 0,
      );

    return cachedFile || null;
  } catch {
    return null;
  }
};

const resolveCachedFile = async (
  fileId: string,
  remoteUrl: string,
): Promise<CachedDriverFile> => {
  const normalizedFileId = fileId.trim();
  const existingDownload = activeDownloads.get(normalizedFileId);

  if (existingDownload) {
    return existingDownload;
  }

  const download: Promise<CachedDriverFile> = (async () => {
    const fileDirectory = new Directory(
      Paths.cache,
      CACHE_DIRECTORY_NAME,
      safeCacheKey(normalizedFileId),
    );

    fileDirectory.create({
      intermediates: true,
      idempotent: true,
    });

    const existingFile = findCachedFile(fileDirectory);
    if (existingFile) {
      return existingFile;
    }

    const downloadedFile = await File.downloadFileAsync(
      remoteUrl,
      fileDirectory,
    );

    return {
      uri: downloadedFile.uri,
      type: downloadedFile.type,
    };
  })();

  activeDownloads.set(normalizedFileId, download);

  try {
    return await download;
  } finally {
    activeDownloads.delete(normalizedFileId);
  }
};

export default function DriverStoredFilePreview({
  label,
  fileId,
  description = "Tap an image to view it full screen.",
  imageHeight = 150,
}: DriverStoredFilePreviewProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [cachedUri, setCachedUri] = useState("");
  const [cachedMimeType, setCachedMimeType] = useState("");
  const [loadingCache, setLoadingCache] = useState(true);
  const [cacheError, setCacheError] = useState("");
  const [imageRenderable, setImageRenderable] = useState<boolean | null>(null);
  const [fullImageVisible, setFullImageVisible] = useState(false);

  const fileUrl = useMemo(() => getDriverStoredFileUrl(fileId), [fileId]);

  useEffect(() => {
    let mounted = true;

    setCachedUri("");
    setCachedMimeType("");
    setLoadingCache(true);
    setCacheError("");
    setImageRenderable(null);
    setFullImageVisible(false);

    if (!fileId.trim() || !fileUrl) {
      setLoadingCache(false);
      return () => {
        mounted = false;
      };
    }

    void resolveCachedFile(fileId, fileUrl)
      .then((file) => {
        if (!mounted) return;

        setCachedUri(file.uri);
        setCachedMimeType(file.type || "");
      })
      .catch((error) => {
        if (!mounted) return;

        setCacheError(
          error instanceof Error
            ? error.message
            : "Could not cache the uploaded file.",
        );
      })
      .finally(() => {
        if (mounted) {
          setLoadingCache(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fileId, fileUrl]);

  const openCachedFile = async () => {
    if (!cachedUri) return;

    if (imageRenderable === true) {
      setFullImageVisible(true);
      return;
    }

    try {
      const sharingAvailable = await Sharing.isAvailableAsync();

      if (!sharingAvailable) {
        Alert.alert(
          "File saved on device",
          "This device cannot open the cached document from Nookly.",
        );
        return;
      }

      await Sharing.shareAsync(cachedUri, {
        dialogTitle: label,
        mimeType: cachedMimeType || undefined,
      });
    } catch (error) {
      Alert.alert(
        "Could not open file",
        error instanceof Error
          ? error.message
          : "The cached file could not be opened.",
      );
    }
  };

  if (!fileId.trim()) {
    return null;
  }

  const actionIcon =
    imageRenderable === true ? "expand-outline" : "folder-open-outline";

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.86}
        disabled={loadingCache || !cachedUri}
        onPress={() => void openCachedFile()}
        className="overflow-hidden rounded-2xl border"
        style={{
          backgroundColor: theme.surface,
          borderColor: `${theme.muted}2F`,
          opacity: loadingCache ? 0.82 : 1,
        }}
      >
        <View
          className="items-center justify-center overflow-hidden"
          style={{
            height: imageHeight,
            backgroundColor: `${theme.muted}10`,
          }}
        >
          {loadingCache ? (
            <View className="items-center px-5">
              <ActivityIndicator color={theme.primary[300]} />
              <Text
                className="mt-3 text-center text-xs"
                style={{ color: theme.muted }}
              >
                Loading saved file...
              </Text>
            </View>
          ) : cachedUri && imageRenderable !== false ? (
            <Image
              source={{ uri: cachedUri }}
              className="h-full w-full"
              resizeMode="cover"
              onLoad={() => setImageRenderable(true)}
              onError={() => setImageRenderable(false)}
            />
          ) : (
            <View className="items-center px-5">
              <View
                className="h-14 w-14 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${theme.primary[300]}18` }}
              >
                <Ionicons
                  name={
                    cacheError ? "warning-outline" : "document-text-outline"
                  }
                  size={30}
                  color={cacheError ? theme.danger : theme.primary[300]}
                />
              </View>
              <Text
                className="mt-3 text-center text-xs"
                style={{ color: cacheError ? theme.danger : theme.muted }}
              >
                {cacheError
                  ? "The file could not be saved on this device."
                  : "Tap to open the cached document."}
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row items-center px-4 py-3">
          <View className="flex-1 pr-3">
            <Text
              numberOfLines={1}
              className="text-sm font-rubik-bold"
              style={{ color: theme.title }}
            >
              {label}
            </Text>
            <Text
              numberOfLines={2}
              className="mt-1 text-xs"
              style={{ color: theme.muted }}
            >
              {cacheError
                ? "Caching failed. Reopen this profile to retry."
                : loadingCache
                  ? "Saving to this device..."
                  : imageRenderable === true
                    ? "Tap to view the full image."
                    : description}
            </Text>
          </View>

          {!loadingCache && cachedUri ? (
            <Ionicons name={actionIcon} size={21} color={theme.primary[300]} />
          ) : null}
        </View>
      </TouchableOpacity>

      <Modal
        visible={fullImageVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setFullImageVisible(false)}
      >
        <View className="flex-1 bg-black">
          <View className="absolute left-0 right-0 top-0 z-10 flex-row items-center justify-between px-5 pb-4 pt-12">
            <Text
              numberOfLines={1}
              className="mr-4 flex-1 text-base font-rubik-bold text-white"
            >
              {label}
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close full image"
              onPress={() => setFullImageVisible(false)}
              className="h-11 w-11 items-center justify-center rounded-full bg-black/60"
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </Pressable>
          </View>

          {cachedUri ? (
            <Image
              source={{ uri: cachedUri }}
              className="h-full w-full"
              resizeMode="contain"
            />
          ) : null}
        </View>
      </Modal>
    </>
  );
}
