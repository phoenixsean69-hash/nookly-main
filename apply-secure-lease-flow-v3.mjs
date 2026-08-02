import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  appwrite: path.join(root, "lib", "appwrite.ts"),
  leaseClient: path.join(root, "lib", "leaseDocumentClient.ts"),
  leaseModal: path.join(root, "components", "LeaseDocumentModal.tsx"),
  landlordRequests: path.join(
    root,
    "app",
    "(root)",
    "(landlord)",
    "Landrequests.tsx",
  ),
  tenantRequests: path.join(
    root,
    "app",
    "(root)",
    "(tabs)",
    "myRequests.tsx",
  ),
  studentRequests: path.join(
    root,
    "app",
    "(root)",
    "(student)",
    "s-myRequests.tsx",
  ),
  tenantNotifications: path.join(
    root,
    "app",
    "(root)",
    "(tabs)",
    "notifications.tsx",
  ),
  studentNotifications: path.join(
    root,
    "app",
    "(root)",
    "(student)",
    "s-notifications.tsx",
  ),
  rootLayout: path.join(root, "app", "_layout.tsx"),
  pushService: path.join(
    root,
    "services",
    "push-function.service.ts",
  ),
  pushFunction: path.join(
    root,
    "functions",
    "nookly-push-api",
    "src",
    "main.js",
  ),
  appwriteConfig: path.join(root, "appwrite.config.json"),
  eas: path.join(root, "eas.json"),
};

for (const [label, filePath] of Object.entries(files)) {
  if (
    label !== "leaseClient" &&
    !fs.existsSync(filePath)
  ) {
    throw new Error(
      `${label} was not found: ${filePath}\n` +
        "Run this installer from the Nookly project root.",
    );
  }
}

const backupSuffix = ".secure-lease-flow-v3.bak";
const MAX_LEASE_SIZE_BYTES = 10 * 1024 * 1024;

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeWithBackup(filePath, content) {
  const backupPath = `${filePath}${backupSuffix}`;

  if (
    fs.existsSync(filePath) &&
    !fs.existsSync(backupPath)
  ) {
    fs.copyFileSync(filePath, backupPath);
  }

  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  fs.writeFileSync(filePath, content, "utf8");
}

function replaceRequired(
  content,
  search,
  replacement,
  label,
) {
  if (!content.includes(search)) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  return content.replace(search, replacement);
}

function replaceRangeRequired(
  content,
  startMarker,
  endMarker,
  replacement,
  label,
) {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(
    endMarker,
    start + startMarker.length,
  );

  if (start < 0 || end < 0) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  return (
    content.slice(0, start) +
    replacement +
    content.slice(end)
  );
}

const leaseClientSource = "import pushFunctionService from \"@/services/push-function.service\";\nimport * as FileSystem from \"expo-file-system/legacy\";\nimport * as Linking from \"expo-linking\";\nimport * as Sharing from \"expo-sharing\";\nimport { Platform } from \"react-native\";\n\nconst PDF_MIME_TYPE = \"application/pdf\";\n\nconst sanitizeFileName = (value: string): string => {\n  const cleaned = value\n    .trim()\n    .replace(/[<>:\"/\\\\|?*\\u0000-\\u001F]/g, \"_\")\n    .replace(/\\s+/g, \" \");\n\n  return cleaned.toLowerCase().endsWith(\".pdf\")\n    ? cleaned\n    : `${cleaned || \"lease_document\"}.pdf`;\n};\n\nexport const formatLeaseFileSize = (bytes?: number): string => {\n  if (!bytes || bytes <= 0) return \"PDF document\";\n\n  if (bytes < 1024) return `${bytes} B`;\n\n  const kilobytes = bytes / 1024;\n  if (kilobytes < 1024) {\n    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;\n  }\n\n  const megabytes = kilobytes / 1024;\n  return `${megabytes.toFixed(megabytes >= 10 ? 1 : 2)} MB`;\n};\n\nconst getTemporaryLeaseAccess = async (requestId: string) => {\n  const normalizedRequestId = requestId.trim();\n\n  if (!normalizedRequestId) {\n    throw new Error(\"The lease request ID is missing.\");\n  }\n\n  return pushFunctionService.getLeaseAccess(normalizedRequestId);\n};\n\nexport const previewLeaseDocument = async (\n  requestId: string,\n): Promise<void> => {\n  const access = await getTemporaryLeaseAccess(requestId);\n\n  const canOpen = await Linking.canOpenURL(access.viewUrl);\n\n  if (!canOpen) {\n    throw new Error(\n      \"This device cannot open the lease preview. Use Download instead.\",\n    );\n  }\n\n  await Linking.openURL(access.viewUrl);\n};\n\nexport const downloadLeaseDocument = async (\n  requestId: string,\n  requestedFileName: string,\n): Promise<void> => {\n  const access = await getTemporaryLeaseAccess(requestId);\n  const fileName = sanitizeFileName(\n    requestedFileName || access.documentName || \"lease_document.pdf\",\n  );\n\n  const cacheDirectory = FileSystem.cacheDirectory;\n\n  if (!cacheDirectory) {\n    throw new Error(\"The device cache directory is unavailable.\");\n  }\n\n  const tempUri = `${cacheDirectory}${Date.now()}_${fileName}`;\n  const downloadResult = await FileSystem.downloadAsync(\n    access.downloadUrl,\n    tempUri,\n  );\n\n  if (downloadResult.status !== 200) {\n    throw new Error(\n      `The lease download failed with HTTP ${downloadResult.status}.`,\n    );\n  }\n\n  if (Platform.OS === \"android\") {\n    const permissions =\n      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();\n\n    if (!permissions.granted) {\n      throw new Error(\n        \"Folder access was not granted, so the lease was not saved.\",\n      );\n    }\n\n    const fileData = await FileSystem.readAsStringAsync(\n      downloadResult.uri,\n      {\n        encoding: FileSystem.EncodingType.Base64,\n      },\n    );\n\n    const destinationUri =\n      await FileSystem.StorageAccessFramework.createFileAsync(\n        permissions.directoryUri,\n        fileName,\n        PDF_MIME_TYPE,\n      );\n\n    await FileSystem.writeAsStringAsync(destinationUri, fileData, {\n      encoding: FileSystem.EncodingType.Base64,\n    });\n\n    return;\n  }\n\n  const sharingAvailable = await Sharing.isAvailableAsync();\n\n  if (!sharingAvailable) {\n    throw new Error(\n      \"File sharing is unavailable on this device.\",\n    );\n  }\n\n  await Sharing.shareAsync(downloadResult.uri, {\n    mimeType: PDF_MIME_TYPE,\n    dialogTitle: \"Save Lease Document\",\n    UTI: \"com.adobe.pdf\",\n  });\n};\n";
const leaseModalSource = "import { Colors } from \"@/constants/Colors\";\nimport { Ionicons } from \"@expo/vector-icons\";\nimport * as DocumentPicker from \"expo-document-picker\";\nimport React, { useEffect, useMemo, useState } from \"react\";\nimport {\n  ActivityIndicator,\n  Alert,\n  Modal,\n  Text,\n  TextInput,\n  TouchableOpacity,\n  useColorScheme,\n  View,\n} from \"react-native\";\n\nconst MAX_LEASE_SIZE_BYTES = 10 * 1024 * 1024;\n\nexport interface SelectedLeaseFile {\n  name: string;\n  uri: string;\n  mimeType: string;\n  size: number;\n}\n\ninterface LeaseDocumentModalProps {\n  visible: boolean;\n  onClose: () => void;\n  onSubmit: (\n    file: SelectedLeaseFile,\n    message: string,\n  ) => void | Promise<void>;\n  propertyName: string;\n  tenantName: string;\n  isLoading?: boolean;\n}\n\nconst formatFileSize = (bytes: number): string => {\n  if (!bytes) return \"Size unavailable\";\n\n  const megabytes = bytes / (1024 * 1024);\n\n  return megabytes >= 1\n    ? `${megabytes.toFixed(2)} MB`\n    : `${(bytes / 1024).toFixed(1)} KB`;\n};\n\nexport const LeaseDocumentModal = ({\n  visible,\n  onClose,\n  onSubmit,\n  propertyName,\n  tenantName,\n  isLoading = false,\n}: LeaseDocumentModalProps) => {\n  const colorScheme = useColorScheme();\n  const theme = Colors[colorScheme ?? \"light\"];\n  const [selectedFile, setSelectedFile] =\n    useState<SelectedLeaseFile | null>(null);\n  const [message, setMessage] = useState(\n    \"Please review this lease carefully before signing.\",\n  );\n  const [pickingFile, setPickingFile] = useState(false);\n\n  useEffect(() => {\n    if (!visible) {\n      setSelectedFile(null);\n      setMessage(\n        \"Please review this lease carefully before signing.\",\n      );\n      setPickingFile(false);\n    }\n  }, [visible]);\n\n  const fileSummary = useMemo(() => {\n    if (!selectedFile) return \"\";\n\n    return `${formatFileSize(selectedFile.size)} \u00b7 PDF`;\n  }, [selectedFile]);\n\n  const pickDocument = async () => {\n    try {\n      setPickingFile(true);\n\n      const result = await DocumentPicker.getDocumentAsync({\n        type: \"application/pdf\",\n        copyToCacheDirectory: true,\n        multiple: false,\n      });\n\n      if (\n        result.canceled ||\n        !result.assets ||\n        result.assets.length === 0\n      ) {\n        return;\n      }\n\n      const asset = result.assets[0];\n      const name = asset.name || \"lease_document.pdf\";\n      const mimeType =\n        asset.mimeType || \"application/pdf\";\n      const size = asset.size || 0;\n\n      const isPdf =\n        mimeType === \"application/pdf\" ||\n        name.toLowerCase().endsWith(\".pdf\");\n\n      if (!isPdf) {\n        Alert.alert(\n          \"PDF required\",\n          \"Choose a PDF lease document.\",\n        );\n        return;\n      }\n\n      if (size <= 0) {\n        Alert.alert(\n          \"Invalid document\",\n          \"The selected PDF is empty or its size could not be read.\",\n        );\n        return;\n      }\n\n      if (size > MAX_LEASE_SIZE_BYTES) {\n        Alert.alert(\n          \"Document too large\",\n          \"Lease documents must be 10 MB or smaller.\",\n        );\n        return;\n      }\n\n      setSelectedFile({\n        name,\n        uri: asset.uri,\n        mimeType: \"application/pdf\",\n        size,\n      });\n    } catch (error) {\n      console.error(\"Error picking lease document:\", error);\n      Alert.alert(\n        \"Document error\",\n        \"The PDF could not be selected.\",\n      );\n    } finally {\n      setPickingFile(false);\n    }\n  };\n\n  const handleSubmit = async () => {\n    if (!selectedFile) {\n      Alert.alert(\n        \"Document required\",\n        \"Select the lease PDF first.\",\n      );\n      return;\n    }\n\n    await onSubmit(selectedFile, message.trim());\n  };\n\n  return (\n    <Modal\n      animationType=\"slide\"\n      transparent\n      visible={visible}\n      onRequestClose={onClose}\n    >\n      <View className=\"flex-1 justify-end bg-black/50\">\n        <View\n          className=\"rounded-t-3xl p-6\"\n          style={{\n            backgroundColor: theme.background,\n            maxHeight: \"86%\",\n          }}\n        >\n          <View className=\"flex-row items-center justify-between mb-4\">\n            <View className=\"flex-1 pr-4\">\n              <Text\n                className=\"text-xl font-rubik-bold\"\n                style={{ color: theme.title }}\n              >\n                Send Lease Document\n              </Text>\n              <Text\n                className=\"text-sm mt-1\"\n                style={{ color: theme.muted }}\n              >\n                {tenantName} \u00b7 {propertyName}\n              </Text>\n            </View>\n\n            <TouchableOpacity\n              onPress={onClose}\n              disabled={isLoading}\n              className=\"p-2\"\n            >\n              <Ionicons\n                name=\"close\"\n                size={24}\n                color={theme.text}\n              />\n            </TouchableOpacity>\n          </View>\n\n          <View\n            className=\"rounded-2xl p-4 mb-4\"\n            style={{\n              backgroundColor: theme.surface,\n              borderWidth: 1,\n              borderColor: theme.muted + \"30\",\n            }}\n          >\n            <TouchableOpacity\n              onPress={pickDocument}\n              disabled={pickingFile || isLoading}\n              className=\"py-7 px-3 items-center justify-center border-2 border-dashed rounded-xl\"\n              style={{\n                borderColor: selectedFile\n                  ? theme.primary[300]\n                  : theme.muted + \"50\",\n              }}\n            >\n              {pickingFile ? (\n                <ActivityIndicator\n                  size=\"small\"\n                  color={theme.primary[300]}\n                />\n              ) : (\n                <>\n                  <Ionicons\n                    name={\n                      selectedFile\n                        ? \"document-text\"\n                        : \"cloud-upload-outline\"\n                    }\n                    size={42}\n                    color={\n                      selectedFile\n                        ? theme.primary[300]\n                        : theme.muted\n                    }\n                  />\n\n                  <Text\n                    className=\"text-center font-rubik-medium mt-2\"\n                    style={{\n                      color: selectedFile\n                        ? theme.primary[300]\n                        : theme.text,\n                    }}\n                    numberOfLines={2}\n                  >\n                    {selectedFile?.name ||\n                      \"Select lease PDF\"}\n                  </Text>\n\n                  <Text\n                    className=\"text-xs mt-1\"\n                    style={{ color: theme.muted }}\n                  >\n                    {selectedFile\n                      ? `${fileSummary} \u00b7 Tap to replace`\n                      : \"PDF only \u00b7 Maximum 10 MB\"}\n                  </Text>\n                </>\n              )}\n            </TouchableOpacity>\n          </View>\n\n          <Text\n            className=\"font-rubik-medium mb-2\"\n            style={{ color: theme.text }}\n          >\n            Message to tenant\n          </Text>\n\n          <TextInput\n            value={message}\n            onChangeText={setMessage}\n            editable={!isLoading}\n            multiline\n            maxLength={500}\n            placeholder=\"Add instructions for the tenant...\"\n            placeholderTextColor={theme.muted}\n            className=\"rounded-xl p-4 min-h-[100px] mb-2\"\n            style={{\n              color: theme.text,\n              backgroundColor: theme.surface,\n              borderWidth: 1,\n              borderColor: theme.muted + \"35\",\n              textAlignVertical: \"top\",\n            }}\n          />\n\n          <Text\n            className=\"text-xs text-right mb-5\"\n            style={{ color: theme.muted }}\n          >\n            {message.length}/500\n          </Text>\n\n          <View className=\"flex-row gap-3\">\n            <TouchableOpacity\n              onPress={onClose}\n              disabled={isLoading}\n              className=\"flex-1 py-3.5 rounded-xl border\"\n              style={{\n                borderColor: theme.muted + \"35\",\n                backgroundColor: theme.surface,\n              }}\n            >\n              <Text\n                className=\"text-center font-rubik-bold\"\n                style={{ color: theme.text }}\n              >\n                Cancel\n              </Text>\n            </TouchableOpacity>\n\n            <TouchableOpacity\n              onPress={handleSubmit}\n              disabled={isLoading || !selectedFile}\n              className=\"flex-1 py-3.5 rounded-xl flex-row items-center justify-center\"\n              style={{\n                backgroundColor:\n                  isLoading || !selectedFile\n                    ? theme.muted\n                    : theme.primary[300],\n              }}\n            >\n              {isLoading ? (\n                <ActivityIndicator\n                  size=\"small\"\n                  color=\"#FFFFFF\"\n                />\n              ) : (\n                <Ionicons\n                  name=\"send\"\n                  size={17}\n                  color=\"#FFFFFF\"\n                />\n              )}\n\n              <Text className=\"text-white text-center font-rubik-bold ml-2\">\n                {isLoading ? \"Sending...\" : \"Send Lease\"}\n              </Text>\n            </TouchableOpacity>\n          </View>\n        </View>\n      </View>\n    </Modal>\n  );\n};\n";

function replaceArrowFunctionRequired(
  content,
  startMarker,
  replacement,
  label,
) {
  const start = content.indexOf(startMarker);

  if (start < 0) {
    throw new Error(
      `Could not locate ${label}. No files were written.`,
    );
  }

  const arrowIndex = content.indexOf("=>", start);

  if (arrowIndex < 0) {
    throw new Error(
      `Could not locate the arrow for ${label}. No files were written.`,
    );
  }

  const openBraceIndex = content.indexOf(
    "{",
    arrowIndex,
  );

  if (openBraceIndex < 0) {
    throw new Error(
      `Could not locate the body for ${label}. No files were written.`,
    );
  }

  let depth = 0;
  let state = "code";
  let escaped = false;
  let endIndex = -1;

  for (
    let index = openBraceIndex;
    index < content.length;
    index += 1
  ) {
    const character = content[index];
    const next = content[index + 1];

    if (state === "single") {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "'") {
        state = "code";
      }

      continue;
    }

    if (state === "double") {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        state = "code";
      }

      continue;
    }

    if (state === "template") {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === "`") {
        state = "code";
      }

      continue;
    }

    if (state === "line-comment") {
      if (
        character === "\n" ||
        character === "\r"
      ) {
        state = "code";
      }

      continue;
    }

    if (state === "block-comment") {
      if (
        character === "*" &&
        next === "/"
      ) {
        state = "code";
        index += 1;
      }

      continue;
    }

    if (
      character === "/" &&
      next === "/"
    ) {
      state = "line-comment";
      index += 1;
      continue;
    }

    if (
      character === "/" &&
      next === "*"
    ) {
      state = "block-comment";
      index += 1;
      continue;
    }

    if (character === "'") {
      state = "single";
      continue;
    }

    if (character === '"') {
      state = "double";
      continue;
    }

    if (character === "`") {
      state = "template";
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        endIndex = index + 1;
        break;
      }
    }
  }

  if (endIndex < 0) {
    throw new Error(
      `Could not find the end of ${label}. No files were written.`,
    );
  }

  let replacementEnd = endIndex;

  while (
    replacementEnd < content.length &&
    /[ \t]/.test(content[replacementEnd])
  ) {
    replacementEnd += 1;
  }

  if (content[replacementEnd] === ";") {
    replacementEnd += 1;
  }

  return (
    content.slice(0, start) +
    replacement +
    content.slice(replacementEnd)
  );
}

function patchAppwrite(original) {
  let content = original;

  if (!content.includes("leaseBucketId:")) {
    content = replaceRequired(
      content,
      `  bucketId: process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID,
`,
      `  bucketId: process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID,
  leaseBucketId:
    process.env.EXPO_PUBLIC_APPWRITE_LEASE_BUCKET_ID ||
    "lease_documents",
`,
      "the Appwrite bucket configuration",
    );
  }

  const startMarker =
    "export const uploadLeaseDocument = async";
  const endMarker =
    "export async function sendExpoPushToUser";

  const replacement = `export interface LeaseUploadAsset {
  name?: string;
  uri: string;
  mimeType?: string;
  size?: number;
}

export interface UploadedLeaseDocument {
  fileId: string;
  bucketId: string;
  name: string;
  size: number;
  mimeType: "application/pdf";
}

const MAX_LEASE_DOCUMENT_SIZE =
  ${MAX_LEASE_SIZE_BYTES};

const sanitizeLeaseFileName = (
  value?: string,
): string => {
  const cleaned = (value || "lease_document.pdf")
    .trim()
    .replace(/[<>:"/\\\\|?*\\u0000-\\u001F]/g, "_")
    .replace(/\\s+/g, " ");

  return cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : \`\${cleaned || "lease_document"}.pdf\`;
};

export const uploadLeaseDocument = async (
  fileAsset: LeaseUploadAsset,
  tenantAccountId: string,
): Promise<UploadedLeaseDocument> => {
  const normalizedTenantId =
    tenantAccountId.trim();

  if (!normalizedTenantId) {
    throw new Error(
      "The tenant account ID is required for lease access.",
    );
  }

  const fileName = sanitizeLeaseFileName(
    fileAsset.name,
  );
  const mimeType =
    fileAsset.mimeType || "application/pdf";
  const fileSize = Number(fileAsset.size || 0);

  const isPdf =
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error(
      "Only PDF lease documents are supported.",
    );
  }

  if (
    !fileAsset.uri ||
    !Number.isFinite(fileSize) ||
    fileSize <= 0
  ) {
    throw new Error(
      "The selected lease PDF is empty or invalid.",
    );
  }

  if (
    fileSize > MAX_LEASE_DOCUMENT_SIZE
  ) {
    throw new Error(
      "Lease documents must be 10 MB or smaller.",
    );
  }

  const landlord = await account.get();
  const leaseBucketId =
    config.leaseBucketId!;

  const permissions = [
    Permission.read(
      Role.user(landlord.$id),
    ),
    Permission.read(
      Role.user(normalizedTenantId),
    ),
    Permission.update(
      Role.user(landlord.$id),
    ),
    Permission.delete(
      Role.user(landlord.$id),
    ),
  ];

  const file = {
    name: fileName,
    type: "application/pdf",
    size: fileSize,
    uri: fileAsset.uri,
  };

  console.log(
    "📄 Uploading private lease document...",
  );

  const response = await storage.createFile(
    leaseBucketId,
    ID.unique(),
    file,
    permissions,
  );

  console.log(
    "✅ Private lease document uploaded:",
    response.$id,
  );

  return {
    fileId: response.$id,
    bucketId: leaseBucketId,
    name: fileName,
    size: fileSize,
    mimeType: "application/pdf",
  };
};

export const deleteLeaseDocument = async (
  fileId: string,
): Promise<void> => {
  const normalizedFileId = fileId.trim();

  if (!normalizedFileId) return;

  await storage.deleteFile(
    config.leaseBucketId!,
    normalizedFileId,
  );
};

`;

  content = replaceRangeRequired(
    content,
    startMarker,
    endMarker,
    replacement,
    "uploadLeaseDocument",
  );

  return content;
}

function patchPushService(original) {
  let content = original;

  if (
    !content.includes(
      "export interface LeaseSentNotificationResult",
    )
  ) {
    const marker =
      "function requireFunctionId(): string {";

    const interfaces = `export interface LeaseSentNotificationResult {
  skipped: boolean;
  duplicate?: boolean;
  reason?: string;
  notificationCreated?: boolean;
  notificationRowId?: string;
  recipientUserId: string;
  requestId: string;
  propertyId: string;
  documentId: string;
  data?: {
    type: "lease";
    screen: string;
    requestId: string;
    propertyId: string;
    propertyName: string;
    tenantId: string;
    tenantName: string;
    landlordId: string;
    landlordName: string;
    documentId: string;
    documentName: string;
    documentSize: number;
    mimeType: string;
    leaseMessage: string;
    sentAt: string;
  };
  push?: PushTicketSummary;
}

export interface LeaseAccessResult {
  requestId: string;
  propertyId: string;
  propertyName: string;
  documentId: string;
  documentName: string;
  documentSize: number;
  mimeType: string;
  expiresAt: string;
  viewUrl: string;
  downloadUrl: string;
}

`;

    content = replaceRequired(
      content,
      marker,
      `${interfaces}${marker}`,
      "the push service interface insertion point",
    );
  }

  if (
    !content.includes("async notifyLeaseSent(")
  ) {
    const marker =
      "\n}\n\nconst pushFunctionService = new PushFunctionService();";

    const methods = `
  async notifyLeaseSent(
    requestId: string,
    leaseMessage = "",
  ): Promise<LeaseSentNotificationResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        "A request ID is required to send a lease notification.",
      );
    }

    return executePushRoute<LeaseSentNotificationResult>(
      "/lease-sent",
      {
        requestId: normalizedRequestId,
        leaseMessage: leaseMessage
          .trim()
          .slice(0, 500),
      },
    );
  }

  async getLeaseAccess(
    requestId: string,
  ): Promise<LeaseAccessResult> {
    const normalizedRequestId =
      requestId.trim();

    if (!normalizedRequestId) {
      throw new Error(
        "A request ID is required to open a lease document.",
      );
    }

    return executePushRoute<LeaseAccessResult>(
      "/lease-access",
      {
        requestId: normalizedRequestId,
      },
    );
  }
`;

    content = replaceRequired(
      content,
      marker,
      `${methods}${marker}`,
      "the PushFunctionService class ending",
    );
  }

  return content;
}

function patchLandlordRequests(original) {
  let content = original;

  if (
    !content.includes(
      '@/services/push-function.service',
    )
  ) {
    content = replaceRequired(
      content,
      `import notificationService from "@/services/notification.service";
`,
      `import notificationService from "@/services/notification.service";
import pushFunctionService from "@/services/push-function.service";
`,
      "the landlord request service imports",
    );
  }

  if (
    !content.includes("deleteLeaseDocument,")
  ) {
    content = replaceRequired(
      content,
      `  createNotification,
  databases,
  uploadLeaseDocument,
`,
      `  createNotification,
  databases,
  deleteLeaseDocument,
  uploadLeaseDocument,
`,
      "the landlord request Appwrite imports",
    );
  }

  const startMarker =
    "  const handleSendLeaseDocument = async";

  const replacement = `  const handleSendLeaseDocument = async (
    file: {
      name: string;
      uri: string;
      mimeType: string;
      size: number;
    },
    leaseMessage: string,
  ) => {
    if (!selectedRequestForLease) return;

    const request =
      selectedRequestForLease;
    let uploadedFileId: string | null = null;

    setSendingLease(true);

    try {
      const uploaded =
        await uploadLeaseDocument(
          file,
          request.tenantId,
        );

      uploadedFileId = uploaded.fileId;
      const leaseSentAt =
        new Date().toISOString();

      await databases.updateDocument(
        config.databaseId!,
        config.requestsCollectionId!,
        request.$id,
        {
          leaseDocumentId:
            uploaded.fileId,
          leaseDocumentName:
            uploaded.name,
          leaseSentAt,
        },
      );

      let notificationWarning = "";

      try {
        const result =
          await pushFunctionService.notifyLeaseSent(
            request.$id,
            leaseMessage,
          );

        if (result.skipped) {
          notificationWarning =
            result.reason ||
            "The lease was saved, but the notification was skipped.";
        } else {
          console.log(
            "✅ Secure lease notification processed:",
            {
              notificationRowId:
                result.notificationRowId,
              recipientUserId:
                result.recipientUserId,
              acceptedPushes:
                result.push?.accepted ?? 0,
              failedPushes:
                result.push?.failed ?? 0,
            },
          );
        }
      } catch (notificationError) {
        console.error(
          "Lease notification failed:",
          notificationError,
        );

        notificationWarning =
          "The lease was saved, but the tenant notification could not be delivered.";
      }

      setRequests((current) =>
        current.map((item) =>
          item.$id === request.$id
            ? {
                ...item,
                leaseDocumentId:
                  uploaded.fileId,
                leaseDocumentName:
                  uploaded.name,
                leaseSentAt,
              }
            : item,
        ),
      );

      setLeaseModalVisible(false);
      setSelectedRequestForLease(null);

      if (notificationWarning) {
        Alert.alert(
          "Lease saved",
          notificationWarning,
        );
      } else {
        Alert.alert(
          "Lease sent",
          \`\${uploaded.name} was securely sent to \${request.tenantName}.\`,
        );
      }
    } catch (error) {
      if (uploadedFileId) {
        await deleteLeaseDocument(
          uploadedFileId,
        ).catch(() => undefined);
      }

      console.error(
        "Error sending lease document:",
        error,
      );

      Alert.alert(
        "Lease not sent",
        error instanceof Error
          ? error.message
          : "The lease document could not be sent.",
      );
    } finally {
      setSendingLease(false);
    }
  };

`;

  content = replaceArrowFunctionRequired(
    content,
    startMarker,
    replacement,
    "the landlord lease send handler",
  );

  return content;
}

function patchTenantRequestScreen(original) {
  let content = original;

  if (
    !content.includes(
      '@/lib/leaseDocumentClient',
    )
  ) {
    content = replaceRequired(
      content,
      `import { config, databases, uploadImage } from "@/lib/appwrite";
`,
      `import { config, databases, uploadImage } from "@/lib/appwrite";
import {
  downloadLeaseDocument,
  previewLeaseDocument,
} from "@/lib/leaseDocumentClient";
`,
      "the tenant lease client import",
    );
  }

  content = content.replace(
    `import * as FileSystem from "expo-file-system/legacy";
`,
    "",
  );
  content = content.replace(
    `import * as Sharing from "expo-sharing";
`,
    "",
  );
  content = content.replace(
    `  Linking,
`,
    "",
  );
  content = content.replace(
    `  Platform,
`,
    "",
  );

  const startMarker =
    "  // ✅ Get Appwrite file URL for preview";
  const endMarker =
    "  const fetchRequests = async";

  const replacement = `  const [leaseActionRequestId, setLeaseActionRequestId] =
    useState<string | null>(null);

  const handlePreviewLease = async (
    requestId: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await previewLeaseDocument(requestId);
    } catch (error) {
      console.error(
        "Error previewing lease:",
        error,
      );

      Alert.alert(
        "Preview unavailable",
        error instanceof Error
          ? error.message
          : "The lease could not be opened.",
      );
    } finally {
      setLeaseActionRequestId(null);
    }
  };

  const handleDownloadLease = async (
    requestId: string,
    fileName: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await downloadLeaseDocument(
        requestId,
        fileName,
      );

      Alert.alert(
        "Lease saved",
        \`\${fileName || "Lease document"} was saved successfully.\`,
      );
    } catch (error) {
      console.error(
        "Error downloading lease:",
        error,
      );

      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "The lease could not be downloaded.",
      );
    } finally {
      setLeaseActionRequestId(null);
    }
  };

`;

  content = replaceRangeRequired(
    content,
    startMarker,
    endMarker,
    replacement,
    "the tenant lease preview/download helpers",
  );

  content = content.replaceAll(
    "handlePreviewLease(request.leaseDocumentId!)",
    "handlePreviewLease(request.$id)",
  );

  content = content.replaceAll(
    `handleDownloadLease(
                request.leaseDocumentId!,
                request.leaseDocumentName || "lease_document.pdf",
              )`,
    `handleDownloadLease(
                request.$id,
                request.leaseDocumentName || "lease_document.pdf",
              )`,
  );

  return content;
}

function patchNotificationScreen(
  original,
  requestsRoute,
) {
  let content = original;

  const notificationInterfaceStart =
    content.indexOf(
      "interface NotificationItem",
    );

  if (notificationInterfaceStart < 0) {
    throw new Error(
      "Could not locate NotificationItem. No files were written.",
    );
  }

  const notificationInterfaceEnd =
    content.indexOf(
      "\n}",
      notificationInterfaceStart,
    );

  const notificationTypeStart =
    content.indexOf(
      "type:",
      notificationInterfaceStart,
    );

  const notificationTypeEnd =
    content.indexOf(
      ";",
      notificationTypeStart,
    );

  if (
    notificationInterfaceEnd < 0 ||
    notificationTypeStart < 0 ||
    notificationTypeEnd < 0 ||
    notificationTypeEnd >
      notificationInterfaceEnd
  ) {
    throw new Error(
      "Could not locate the notification type union. No files were written.",
    );
  }

  const notificationTypeDeclaration =
    content.slice(
      notificationTypeStart,
      notificationTypeEnd + 1,
    );

  if (
    !notificationTypeDeclaration.includes(
      '"lease"',
    )
  ) {
    const updatedTypeDeclaration =
      notificationTypeDeclaration.replace(
        ";",
        ' | "lease";',
      );

    content =
      content.slice(0, notificationTypeStart) +
      updatedTypeDeclaration +
      content.slice(
        notificationTypeEnd + 1,
      );
  }

  if (
    !content.includes(
      'notification.type === "lease"',
    )
  ) {
    const messageNavigationPattern =
      /\}\s*else\s+if\s*\(\s*notification\.type\s*===\s*["']message["']\s*\)\s*\{/;

    if (
      !messageNavigationPattern.test(content)
    ) {
      throw new Error(
        "Could not locate the message navigation branch in the notification screen. No files were written.",
      );
    }

    content = content.replace(
      messageNavigationPattern,
      `} else if (notification.type === "lease") {
        router.push({
          pathname: "${requestsRoute}",
          params: {
            requestId:
              notification.data?.requestId || "",
          },
        } as any);
      } else if (notification.type === "message") {`,
    );
  }

  if (
    !content.includes(
      'case "lease":\n        return icons.document;',
    )
  ) {
    const iconFunctionStart =
      content.indexOf(
        "const getIconForType",
      );

    const iconEventCase =
      content.indexOf(
        'case "event":',
        iconFunctionStart,
      );

    if (
      iconFunctionStart < 0 ||
      iconEventCase < 0
    ) {
      throw new Error(
        "Could not locate the notification icon switch. No files were written.",
      );
    }

    content =
      content.slice(0, iconEventCase) +
      `case "lease":
        return icons.document;
      ` +
      content.slice(iconEventCase);
  }

  if (
    !content.includes(
      'case "lease":\n        return "#0EA5E9";',
    )
  ) {
    const colorFunctionStart =
      content.indexOf(
        "const getColorForType",
      );

    const colorEventCase =
      content.indexOf(
        'case "event":',
        colorFunctionStart,
      );

    if (
      colorFunctionStart < 0 ||
      colorEventCase < 0
    ) {
      throw new Error(
        "Could not locate the notification color switch. No files were written.",
      );
    }

    content =
      content.slice(0, colorEventCase) +
      `case "lease":
        return "#0EA5E9";
      ` +
      content.slice(colorEventCase);
  }

  if (
    !content.includes(
      "const renderLeaseDetails",
    )
  ) {
    const renderNotificationStart =
      content.indexOf(
        "const renderNotification",
      );

    if (renderNotificationStart < 0) {
      throw new Error(
        "Could not locate renderNotification. No files were written.",
      );
    }

    const lineStart =
      content.lastIndexOf(
        "\n",
        renderNotificationStart,
      ) + 1;

    const helper = `  const renderLeaseDetails = (
    item: NotificationItem,
  ) => {
    if (item.type !== "lease") {
      return null;
    }

    const fileSize = Number(
      item.data?.documentSize ?? 0,
    );

    const sizeText =
      fileSize > 0
        ? fileSize >= 1024 * 1024
          ? \`\${(fileSize / (1024 * 1024)).toFixed(2)} MB\`
          : \`\${(fileSize / 1024).toFixed(1)} KB\`
        : "PDF document";

    return (
      <View
        className="mt-3 rounded-xl p-3"
        style={{
          backgroundColor: "#0EA5E912",
          borderWidth: 1,
          borderColor: "#0EA5E935",
        }}
      >
        <Text
          className="font-rubik-medium"
          style={{ color: theme.text }}
        >
          {item.data?.documentName ||
            "Lease document"}
        </Text>

        <Text
          className="text-xs mt-1"
          style={{ color: theme.muted }}
        >
          {sizeText} · {item.data?.propertyName || "Property"}
        </Text>

        <Text
          className="text-xs mt-1"
          style={{ color: theme.muted }}
        >
          From: {item.data?.landlordName || "Landlord"}
        </Text>

        {item.data?.leaseMessage ? (
          <Text
            className="text-sm mt-2"
            style={{ color: theme.text }}
          >
            “{item.data.leaseMessage}”
          </Text>
        ) : null}

        <Text
          className="text-xs mt-2 font-rubik-medium"
          style={{ color: "#0EA5E9" }}
        >
          Tap to review the lease
        </Text>
      </View>
    );
  };

`;

    content =
      content.slice(0, lineStart) +
      helper +
      content.slice(lineStart);
  }

  if (
    !content.includes(
      "{renderLeaseDetails(item)}",
    )
  ) {
    const renderNotificationStart =
      content.indexOf(
        "const renderNotification",
      );

    const itemMessageStart =
      content.indexOf(
        "{item.message}",
        renderNotificationStart,
      );

    const itemMessageClosingText =
      content.indexOf(
        "</Text>",
        itemMessageStart,
      );

    if (
      renderNotificationStart < 0 ||
      itemMessageStart < 0 ||
      itemMessageClosingText < 0
    ) {
      throw new Error(
        "Could not locate the notification message card placement. No files were written.",
      );
    }

    const insertionPoint =
      itemMessageClosingText +
      "</Text>".length;

    content =
      content.slice(0, insertionPoint) +
      "\n          {renderLeaseDetails(item)}" +
      content.slice(insertionPoint);
  }

  content = content.replace(
    "When you get likes, messages, or add calendar events, they'll appear here",
    "Requests, leases, messages, and reminders will appear here",
  );

  const requiredMarkers = [
    '"lease"',
    'notification.type === "lease"',
    'return icons.document;',
    'return "#0EA5E9";',
    "const renderLeaseDetails",
    "{renderLeaseDetails(item)}",
    `pathname: "${requestsRoute}"`,
  ];

  for (const marker of requiredMarkers) {
    if (!content.includes(marker)) {
      throw new Error(
        `Notification screen validation failed: ${marker} is missing. No files were written.`,
      );
    }
  }

  return content;
}

function patchRootLayout(original) {
  let content = original;

  if (!content.includes('case "lease":')) {
    content = replaceRequired(
      content,
      `        case "property":
          router.push(getModeAwareRoute("/explore", currentUser) as any);
          return;

        case "request_response":`,
      `        case "property":
          router.push(getModeAwareRoute("/explore", currentUser) as any);
          return;

        case "lease":
          router.push({
            pathname: getModeAwareRoute(
              "/myRequests",
              currentUser,
            ),
            params: {
              requestId:
                typeof data.requestId === "string"
                  ? data.requestId
                  : "",
            },
          } as any);
          return;

        case "request_response":`,
      "the root lease push route",
    );
  }

  return content;
}

const functionAdditions = `const LEASE_BUCKET_ID = env(
  "NOOKLY_LEASE_BUCKET_ID",
  "lease_documents",
);
`;

const leaseFunctionHandlers = `const createStorage = (req) =>
  new Storage(createAdminClient(req));

const createTokens = (req) =>
  new Tokens(createAdminClient(req));

const getUserRowByReference = async (
  tables,
  reference,
) => {
  const normalized = String(
    reference ?? "",
  ).trim();

  if (!normalized) return null;

  const direct = await getRowOrNull(
    tables,
    USERS_TABLE_ID,
    normalized,
  );

  if (direct) return direct;

  return getUserRowByAccountId(
    tables,
    normalized,
  );
};

const notifyLeaseSent = async (
  req,
  tables,
  body,
  diagnosticLog,
) => {
  const landlordAccountId =
    requireAuthenticatedUser(req);

  const requestsTableId =
    requireConfiguredTable(
      REQUESTS_TABLE_ID,
      "Requests table",
    );

  const propertiesTableId =
    requireConfiguredTable(
      PROPERTIES_TABLE_ID,
      "Properties table",
    );

  requireConfiguredTable(
    USERS_TABLE_ID,
    "Users table",
  );

  requireConfiguredTable(
    NOTIFICATIONS_TABLE_ID,
    "Notifications table",
  );

  const requestId = String(
    body.requestId ?? "",
  ).trim();

  if (!requestId) {
    throw statusError(
      400,
      "requestId is required.",
    );
  }

  const requestRow = await getRowOrNull(
    tables,
    requestsTableId,
    requestId,
  );

  if (!requestRow) {
    throw statusError(
      404,
      "The rental request could not be found.",
    );
  }

  const propertyId = String(
    requestRow.propertyId ?? "",
  ).trim();

  const property = await getRowOrNull(
    tables,
    propertiesTableId,
    propertyId,
  );

  if (!property) {
    throw statusError(
      404,
      "The requested property could not be found.",
    );
  }

  const ownerAccountId = String(
    property.creatorId ?? "",
  ).trim();

  if (
    !ownerAccountId ||
    ownerAccountId !== landlordAccountId
  ) {
    throw statusError(
      403,
      "Only the property owner can send this lease document.",
    );
  }

  const status = String(
    requestRow.status ?? "",
  )
    .trim()
    .toLowerCase();

  if (status !== "accepted") {
    throw statusError(
      409,
      "The rental request must be accepted before a lease can be sent.",
    );
  }

  const tenantAccountId = String(
    requestRow.tenantId ?? "",
  ).trim();

  if (!tenantAccountId) {
    throw statusError(
      409,
      "The rental request does not contain a valid tenant account ID.",
    );
  }

  const documentId = String(
    requestRow.leaseDocumentId ?? "",
  ).trim();

  const documentName = String(
    requestRow.leaseDocumentName ??
      "lease_document.pdf",
  ).trim() || "lease_document.pdf";

  const sentAt = String(
    requestRow.leaseSentAt ??
      new Date().toISOString(),
  ).trim();

  if (!documentId) {
    throw statusError(
      409,
      "Upload and save the lease document before sending its notification.",
    );
  }

  const storage = createStorage(req);

  let file;

  try {
    file = await storage.getFile({
      bucketId: LEASE_BUCKET_ID,
      fileId: documentId,
    });
  } catch {
    throw statusError(
      404,
      "The saved lease PDF could not be found in the private lease bucket.",
    );
  }

  const mimeType = String(
    file.mimeType ?? "",
  ).trim();

  const documentSize = Number(
    file.sizeOriginal ?? 0,
  );

  if (
    mimeType !== "application/pdf" &&
    !documentName.toLowerCase().endsWith(".pdf")
  ) {
    throw statusError(
      409,
      "The saved lease file is not a PDF document.",
    );
  }

  if (
    !Number.isFinite(documentSize) ||
    documentSize <= 0 ||
    documentSize > 10 * 1024 * 1024
  ) {
    throw statusError(
      409,
      "The saved lease PDF is empty or larger than 10 MB.",
    );
  }

  const landlordUser =
    await getUserRowByReference(
      tables,
      landlordAccountId,
    );

  const tenantUser =
    await getUserRowByReference(
      tables,
      tenantAccountId,
    );

  const landlordName = String(
    landlordUser?.name ?? "Landlord",
  ).trim() || "Landlord";

  const tenantName = String(
    requestRow.tenantName ??
      tenantUser?.name ??
      "Tenant",
  ).trim() || "Tenant";

  const propertyName = String(
    requestRow.propertyName ??
      property.propertyName ??
      "Property",
  ).trim() || "Property";

  const leaseMessage = String(
    body.leaseMessage ??
      "Please review this lease carefully before signing.",
  )
    .trim()
    .slice(0, 500);

  const notificationData = {
    type: "lease",
    screen: "/myRequests",
    requestId,
    propertyId,
    propertyName,
    tenantId: tenantAccountId,
    tenantName,
    landlordId: landlordAccountId,
    landlordName,
    documentId,
    documentName,
    documentSize,
    mimeType: "application/pdf",
    leaseMessage,
    sentAt,
  };

  const title = "Lease Document Ready 📄";
  const message =
    landlordName +
    ' sent "' +
    documentName +
    '" for ' +
    propertyName +
    ". Review it before signing.";

  const notificationRowId = (
    "lease_" +
    requestId.slice(0, 14) +
    "_" +
    documentId.slice(0, 14)
  ).slice(0, 36);

  const inApp = await createInAppNotification(
    tables,
    {
      rowId: notificationRowId,
      recipientUserId: tenantAccountId,
      title,
      message,
      type: "lease",
      data: notificationData,
    },
  );

  if (!inApp.created) {
    return {
      skipped: true,
      duplicate: true,
      reason:
        "This lease notification was already processed.",
      notificationRowId,
      recipientUserId: tenantAccountId,
      requestId,
      propertyId,
      documentId,
      data: notificationData,
    };
  }

  const push = await sendToUser(
    tables,
    tenantAccountId,
    validateNotification({
      title,
      body: message,
      data: notificationData,
    }),
    diagnosticLog,
  );

  return {
    skipped: false,
    duplicate: false,
    notificationCreated: true,
    notificationRowId,
    recipientUserId: tenantAccountId,
    requestId,
    propertyId,
    documentId,
    data: notificationData,
    push,
  };
};

const issueLeaseAccess = async (
  req,
  tables,
  body,
) => {
  const tenantAccountId =
    requireAuthenticatedUser(req);

  const requestsTableId =
    requireConfiguredTable(
      REQUESTS_TABLE_ID,
      "Requests table",
    );

  const requestId = String(
    body.requestId ?? "",
  ).trim();

  if (!requestId) {
    throw statusError(
      400,
      "requestId is required.",
    );
  }

  const requestRow = await getRowOrNull(
    tables,
    requestsTableId,
    requestId,
  );

  if (!requestRow) {
    throw statusError(
      404,
      "The rental request could not be found.",
    );
  }

  const requestTenantId = String(
    requestRow.tenantId ?? "",
  ).trim();

  if (requestTenantId !== tenantAccountId) {
    throw statusError(
      403,
      "Only the tenant named on this request can access its lease.",
    );
  }

  const documentId = String(
    requestRow.leaseDocumentId ?? "",
  ).trim();

  if (!documentId) {
    throw statusError(
      404,
      "No lease document has been sent for this request.",
    );
  }

  const storage = createStorage(req);
  const file = await storage.getFile({
    bucketId: LEASE_BUCKET_ID,
    fileId: documentId,
  });

  const expiresAt = new Date(
    Date.now() + 15 * 60 * 1000,
  ).toISOString();

  const tokens = createTokens(req);
  const resourceToken =
    await tokens.createFileToken({
      bucketId: LEASE_BUCKET_ID,
      fileId: documentId,
      expire: expiresAt,
    });

  const secret = String(
    resourceToken.secret ?? "",
  ).trim();

  if (!secret) {
    throw statusError(
      500,
      "A temporary lease access token could not be created.",
    );
  }

  const endpoint =
    env("APPWRITE_FUNCTION_API_ENDPOINT") ||
    env("APPWRITE_ENDPOINT") ||
    "https://fra.cloud.appwrite.io/v1";

  const projectId =
    env("APPWRITE_FUNCTION_PROJECT_ID");

  const baseUrl =
    endpoint.replace(/\\/$/, "") +
    "/storage/buckets/" +
    encodeURIComponent(LEASE_BUCKET_ID) +
    "/files/" +
    encodeURIComponent(documentId);

  const query =
    "?project=" +
    encodeURIComponent(projectId) +
    "&token=" +
    encodeURIComponent(secret);

  return {
    requestId,
    propertyId: String(
      requestRow.propertyId ?? "",
    ).trim(),
    propertyName: String(
      requestRow.propertyName ?? "Property",
    ).trim() || "Property",
    documentId,
    documentName: String(
      requestRow.leaseDocumentName ??
        file.name ??
        "lease_document.pdf",
    ).trim() || "lease_document.pdf",
    documentSize: Number(
      file.sizeOriginal ?? 0,
    ),
    mimeType: String(
      file.mimeType ?? "application/pdf",
    ),
    expiresAt,
    viewUrl: baseUrl + "/view" + query,
    downloadUrl:
      baseUrl + "/download" + query,
  };
};

`;

function patchPushFunction(original) {
  let content = original;

  content = content.replace(
    `  Role,
  TablesDB,
`,
    `  Role,
  Storage,
  TablesDB,
  Tokens,
`,
  );

  if (!content.includes("const LEASE_BUCKET_ID")) {
    content = replaceRequired(
      content,
      `const REQUESTS_TABLE_ID = env(
  "NOOKLY_REQUESTS_COLLECTION_ID",
  "69c3a9f30004facf9a4d",
);
`,
      `const REQUESTS_TABLE_ID = env(
  "NOOKLY_REQUESTS_COLLECTION_ID",
  "69c3a9f30004facf9a4d",
);
${functionAdditions}`,
      "the lease bucket Function configuration",
    );
  }

  if (!content.includes("const notifyLeaseSent")) {
    content = replaceRequired(
      content,
      "const checkReceipts = async (body) => {",
      `${leaseFunctionHandlers}const checkReceipts = async (body) => {`,
      "the secure lease Function handlers",
    );
  }

  content = content.replace(
    'version: "1.3.0"',
    'version: "1.4.0"',
  );
  content = content.replace(
    'version: "1.1.0"',
    'version: "1.4.0"',
  );

  if (!content.includes('path === "/lease-sent"')) {
    const marker = `    if (
      method === "POST" &&
      path === "/property-like"
    ) {`;

    const routes = `    if (
      method === "POST" &&
      path === "/lease-sent"
    ) {
      return ok(
        res,
        await notifyLeaseSent(
          req,
          tables,
          body,
          log,
        ),
      );
    }

    if (
      method === "POST" &&
      path === "/lease-access"
    ) {
      return ok(
        res,
        await issueLeaseAccess(
          req,
          tables,
          body,
        ),
      );
    }

`;

    content = replaceRequired(
      content,
      marker,
      `${routes}${marker}`,
      "the secure lease Function routes",
    );
  }

  return content;
}

function patchAppwriteConfig(original) {
  const parsed = JSON.parse(original);

  const pushFunction = Array.isArray(parsed.functions)
    ? parsed.functions.find(
        (item) =>
          item.$id === "6a31d988001bf962fb57",
      )
    : null;

  if (pushFunction) {
    const scopes = new Set(
      Array.isArray(pushFunction.scopes)
        ? pushFunction.scopes
        : [],
    );

    for (const scope of [
      "users.read",
      "rows.read",
      "rows.write",
      "files.read",
      "tokens.write",
    ]) {
      scopes.add(scope);
    }

    pushFunction.scopes =
      Array.from(scopes);
  }

  if (!Array.isArray(parsed.buckets)) {
    parsed.buckets = [];
  }

  const existing = parsed.buckets.find(
    (bucket) =>
      bucket.$id === "lease_documents",
  );

  const leaseBucket = {
    $id: "lease_documents",
    $permissions: [
      'create("users")',
    ],
    fileSecurity: true,
    name: "Lease Documents",
    enabled: true,
    maximumFileSize:
      MAX_LEASE_SIZE_BYTES,
    allowedFileExtensions: ["pdf"],
    compression: "none",
    encryption: true,
    antivirus: true,
  };

  if (existing) {
    Object.assign(existing, leaseBucket);
  } else {
    parsed.buckets.push(leaseBucket);
  }

  return `${JSON.stringify(parsed, null, 4)}\n`;
}

function patchEas(original) {
  const parsed = JSON.parse(original);

  for (const profile of Object.values(
    parsed.build || {},
  )) {
    if (
      profile &&
      typeof profile === "object"
    ) {
      profile.env = {
        ...(profile.env || {}),
        EXPO_PUBLIC_APPWRITE_LEASE_BUCKET_ID:
          "lease_documents",
      };
    }
  }

  return `${JSON.stringify(parsed, null, 2)}\n`;
}

const originals = {
  appwrite: read(files.appwrite),
  landlordRequests:
    read(files.landlordRequests),
  tenantRequests:
    read(files.tenantRequests),
  studentRequests:
    read(files.studentRequests),
  tenantNotifications:
    read(files.tenantNotifications),
  studentNotifications:
    read(files.studentNotifications),
  rootLayout: read(files.rootLayout),
  pushService: read(files.pushService),
  pushFunction: read(files.pushFunction),
  appwriteConfig:
    read(files.appwriteConfig),
  eas: read(files.eas),
};

const patched = {
  appwrite:
    patchAppwrite(originals.appwrite),
  landlordRequests:
    patchLandlordRequests(
      originals.landlordRequests,
    ),
  tenantRequests:
    patchTenantRequestScreen(
      originals.tenantRequests,
    ),
  studentRequests:
    patchTenantRequestScreen(
      originals.studentRequests,
    ),
  tenantNotifications:
    patchNotificationScreen(
      originals.tenantNotifications,
      "/myRequests",
    ),
  studentNotifications:
    patchNotificationScreen(
      originals.studentNotifications,
      "/s-myRequests",
    ),
  rootLayout:
    patchRootLayout(originals.rootLayout),
  pushService:
    patchPushService(originals.pushService),
  pushFunction:
    patchPushFunction(
      originals.pushFunction,
    ),
  appwriteConfig:
    patchAppwriteConfig(
      originals.appwriteConfig,
    ),
  eas: patchEas(originals.eas),
};

const validations = [
  [
    patched.appwrite.includes(
      '"lease_documents"',
    ),
    "the private lease bucket configuration is missing",
  ],
  [
    patched.landlordRequests.includes(
      "notifyLeaseSent",
    ),
    "the landlord screen does not call the secure lease route",
  ],
  [
    patched.tenantRequests.includes(
      "previewLeaseDocument",
    ),
    "the tenant lease access helper is missing",
  ],
  [
    patched.studentRequests.includes(
      "downloadLeaseDocument",
    ),
    "the student lease access helper is missing",
  ],
  [
    patched.pushFunction.includes(
      'path === "/lease-sent"',
    ),
    "the Function is missing /lease-sent",
  ],
  [
    patched.pushFunction.includes(
      'path === "/lease-access"',
    ),
    "the Function is missing /lease-access",
  ],
  [
    patched.rootLayout.includes(
      'case "lease":',
    ),
    "the root notification router is missing the lease route",
  ],
];

const failed = validations.find(
  ([valid]) => !valid,
);

if (failed) {
  throw new Error(
    `Validation failed: ${failed[1]}. No files were written.`,
  );
}

writeWithBackup(
  files.appwrite,
  patched.appwrite,
);
writeWithBackup(
  files.leaseClient,
  leaseClientSource,
);
writeWithBackup(
  files.leaseModal,
  leaseModalSource,
);
writeWithBackup(
  files.landlordRequests,
  patched.landlordRequests,
);
writeWithBackup(
  files.tenantRequests,
  patched.tenantRequests,
);
writeWithBackup(
  files.studentRequests,
  patched.studentRequests,
);
writeWithBackup(
  files.tenantNotifications,
  patched.tenantNotifications,
);
writeWithBackup(
  files.studentNotifications,
  patched.studentNotifications,
);
writeWithBackup(
  files.rootLayout,
  patched.rootLayout,
);
writeWithBackup(
  files.pushService,
  patched.pushService,
);
writeWithBackup(
  files.pushFunction,
  patched.pushFunction,
);
writeWithBackup(
  files.appwriteConfig,
  patched.appwriteConfig,
);
writeWithBackup(
  files.eas,
  patched.eas,
);

console.log("");
console.log(
  "Secure Nookly lease flow v3 applied.",
);
console.log("");
console.log("Updated:");
console.log("- lib/appwrite.ts");
console.log("- lib/leaseDocumentClient.ts");
console.log("- components/LeaseDocumentModal.tsx");
console.log(
  "- app/(root)/(landlord)/Landrequests.tsx",
);
console.log(
  "- app/(root)/(tabs)/myRequests.tsx",
);
console.log(
  "- app/(root)/(student)/s-myRequests.tsx",
);
console.log(
  "- tenant and student notification screens",
);
console.log("- app/_layout.tsx");
console.log(
  "- services/push-function.service.ts",
);
console.log(
  "- functions/nookly-push-api/src/main.js",
);
console.log("- appwrite.config.json");
console.log("- eas.json");
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
