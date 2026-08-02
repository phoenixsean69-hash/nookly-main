import pushFunctionService from "@/services/push-function.service";
import * as FileSystem from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

const PDF_MIME_TYPE = "application/pdf";

const sanitizeFileName = (value: string): string => {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ");

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned || "lease_document"}.pdf`;
};

export const formatLeaseFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "PDF document";

  if (bytes < 1024) return `${bytes} B`;

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;
};

const getTemporaryLeaseAccess = async (requestId: string) => {
  const normalizedRequestId = requestId.trim();

  if (!normalizedRequestId) {
    throw new Error("The lease request ID is missing.");
  }

  return pushFunctionService.getLeaseAccess(normalizedRequestId);
};

export const previewLeaseDocument = async (
  requestId: string,
): Promise<void> => {
  const access = await getTemporaryLeaseAccess(requestId);

  const canOpen = await Linking.canOpenURL(access.viewUrl);

  if (!canOpen) {
    throw new Error(
      "This device cannot open the lease preview. Use Download instead.",
    );
  }

  await Linking.openURL(access.viewUrl);
};

export const downloadLeaseDocument = async (
  requestId: string,
  requestedFileName: string,
): Promise<void> => {
  const access = await getTemporaryLeaseAccess(requestId);
  const fileName = sanitizeFileName(
    requestedFileName || access.documentName || "lease_document.pdf",
  );

  const cacheDirectory = FileSystem.cacheDirectory;

  if (!cacheDirectory) {
    throw new Error("The device cache directory is unavailable.");
  }

  const tempUri = `${cacheDirectory}${Date.now()}_${fileName}`;
  const downloadResult = await FileSystem.downloadAsync(
    access.downloadUrl,
    tempUri,
  );

  if (downloadResult.status !== 200) {
    throw new Error(
      `The lease download failed with HTTP ${downloadResult.status}.`,
    );
  }

  if (Platform.OS === "android") {
    const permissions =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!permissions.granted) {
      throw new Error(
        "Folder access was not granted, so the lease was not saved.",
      );
    }

    const fileData = await FileSystem.readAsStringAsync(
      downloadResult.uri,
      {
        encoding: FileSystem.EncodingType.Base64,
      },
    );

    const destinationUri =
      await FileSystem.StorageAccessFramework.createFileAsync(
        permissions.directoryUri,
        fileName,
        PDF_MIME_TYPE,
      );

    await FileSystem.writeAsStringAsync(destinationUri, fileData, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return;
  }

  const sharingAvailable = await Sharing.isAvailableAsync();

  if (!sharingAvailable) {
    throw new Error(
      "File sharing is unavailable on this device.",
    );
  }

  await Sharing.shareAsync(downloadResult.uri, {
    mimeType: PDF_MIME_TYPE,
    dialogTitle: "Save Lease Document",
    UTI: "com.adobe.pdf",
  });
};
