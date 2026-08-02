import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const paths = {
  client: path.join(root, "lib", "leaseDocumentClient.ts"),
  studentRequests: path.join(
    root,
    "app",
    "(root)",
    "(student)",
    "s-myRequests.tsx",
  ),
  tabRequests: path.join(
    root,
    "app",
    "(root)",
    "(tabs)",
    "myRequests.tsx",
  ),
  viewer: path.join(
    root,
    "app",
    "(root)",
    "lease-viewer.tsx",
  ),
};

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const backup = (filePath) => {
  const backupPath = `${filePath}.disable-repeat-lease-download.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const requireFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
};

const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) {
    fail(
      `Could not find ${label}. The file differs from the expected current version.`,
    );
  }

  return source.replace(search, replacement);
};

Object.entries(paths).forEach(([label, filePath]) => {
  requireFile(filePath, label);
  backup(filePath);
});

// ---------------------------------------------------------------------------
// 1. Persist one successful download per lease document.
// ---------------------------------------------------------------------------

let client = fs.readFileSync(paths.client, "utf8");

if (!client.includes("@react-native-async-storage/async-storage")) {
  client = `import AsyncStorage from "@react-native-async-storage/async-storage";\n${client}`;
}

if (!client.includes("LEASE_DOWNLOAD_STATE_PREFIX")) {
  client = replaceRequired(
    client,
    `const PDF_MIME_TYPE = "application/pdf";
const PREVIEW_ROUTE = "/lease-viewer";`,
    `const PDF_MIME_TYPE = "application/pdf";
const PREVIEW_ROUTE = "/lease-viewer";
const LEASE_DOWNLOAD_STATE_PREFIX = "@nookly/lease-downloaded/";

type LeaseDownloadListener = (documentId: string) => void;

const downloadedLeaseDocumentIds = new Set<string>();
const leaseDownloadListeners = new Set<LeaseDownloadListener>();

const getLeaseDownloadStateKey = (documentId: string): string =>
  \`\${LEASE_DOWNLOAD_STATE_PREFIX}\${documentId.trim()}\`;

export const isLeaseDocumentDownloaded = async (
  documentId: string,
): Promise<boolean> => {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId) return false;

  if (downloadedLeaseDocumentIds.has(normalizedDocumentId)) {
    return true;
  }

  const stored = await AsyncStorage.getItem(
    getLeaseDownloadStateKey(normalizedDocumentId),
  );

  if (stored === "true") {
    downloadedLeaseDocumentIds.add(normalizedDocumentId);
    return true;
  }

  return false;
};

export const subscribeToLeaseDownloads = (
  listener: LeaseDownloadListener,
): (() => void) => {
  leaseDownloadListeners.add(listener);

  return () => {
    leaseDownloadListeners.delete(listener);
  };
};

const markLeaseDocumentDownloaded = async (
  documentId: string,
): Promise<void> => {
  const normalizedDocumentId = documentId.trim();

  if (!normalizedDocumentId) return;

  downloadedLeaseDocumentIds.add(normalizedDocumentId);

  await AsyncStorage.setItem(
    getLeaseDownloadStateKey(normalizedDocumentId),
    "true",
  );

  leaseDownloadListeners.forEach((listener) => {
    listener(normalizedDocumentId);
  });
};`,
    "the lease client constants",
  );
}

client = replaceRequired(
  client,
  `export const downloadLeaseDocument = async (
  requestId: string,
  documentId: string,
  requestedFileName: string,
): Promise<void> => {
  const access = getDirectLeaseAccess(
    requestId,
    documentId,
    requestedFileName,
  );

  if (Platform.OS === "android") {
    await saveAndroidLeaseToDownloads(
      access.downloadUrl,
      access.documentName,
    );
    return;
  }

  if (Platform.OS === "ios") {
    await saveIosLeaseToDocuments(
      access.downloadUrl,
      access.documentName,
    );
    return;
  }

  throw new Error("Lease downloads are only supported on Android and iOS.");
};`,
  `export const downloadLeaseDocument = async (
  requestId: string,
  documentId: string,
  requestedFileName: string,
): Promise<boolean> => {
  const access = getDirectLeaseAccess(
    requestId,
    documentId,
    requestedFileName,
  );

  if (await isLeaseDocumentDownloaded(access.documentId)) {
    return false;
  }

  if (Platform.OS === "android") {
    await saveAndroidLeaseToDownloads(
      access.downloadUrl,
      access.documentName,
    );

    await markLeaseDocumentDownloaded(access.documentId);
    return true;
  }

  if (Platform.OS === "ios") {
    await saveIosLeaseToDocuments(
      access.downloadUrl,
      access.documentName,
    );

    await markLeaseDocumentDownloaded(access.documentId);
    return true;
  }

  throw new Error("Lease downloads are only supported on Android and iOS.");
};`,
  "the lease download function",
);

fs.writeFileSync(paths.client, client, "utf8");

// Shared helpers for request screens.
const addDownloadImports = (source) =>
  replaceRequired(
    source,
    `import {
  downloadLeaseDocument,
  previewLeaseDocument,
} from "@/lib/leaseDocumentClient";`,
    `import {
  downloadLeaseDocument,
  isLeaseDocumentDownloaded,
  previewLeaseDocument,
  subscribeToLeaseDownloads,
} from "@/lib/leaseDocumentClient";`,
    "the lease client import",
  );

const downloadStateBlock = `

  const [downloadedLeaseDocumentIds, setDownloadedLeaseDocumentIds] =
    useState<Set<string>>(() => new Set());

  const isLeaseDownloaded = (documentId?: string): boolean =>
    Boolean(
      documentId &&
        downloadedLeaseDocumentIds.has(documentId),
    );

  const rememberDownloadedLease = (documentId: string) => {
    if (!documentId.trim()) return;

    setDownloadedLeaseDocumentIds((current) => {
      if (current.has(documentId)) return current;

      const next = new Set(current);
      next.add(documentId);
      return next;
    });
  };

  useEffect(() => {
    return subscribeToLeaseDownloads((documentId) => {
      rememberDownloadedLease(documentId);
    });
  }, []);

  useEffect(() => {
    let active = true;

    const documentIds = Array.from(
      new Set(
        requests
          .map((request) => request.leaseDocumentId?.trim() || "")
          .filter(Boolean),
      ),
    );

    void Promise.all(
      documentIds.map(async (documentId) => ({
        documentId,
        downloaded:
          await isLeaseDocumentDownloaded(documentId),
      })),
    ).then((results) => {
      if (!active) return;

      setDownloadedLeaseDocumentIds(
        new Set(
          results
            .filter((result) => result.downloaded)
            .map((result) => result.documentId),
        ),
      );
    });

    return () => {
      active = false;
    };
  }, [requests]);`;

// ---------------------------------------------------------------------------
// 2. Student My Requests screen.
// ---------------------------------------------------------------------------

let student = addDownloadImports(
  fs.readFileSync(paths.studentRequests, "utf8"),
);

student = replaceRequired(
  student,
  `  const isLeaseDownloading = (requestId: string): boolean =>
    leaseAction?.requestId === requestId && leaseAction.type === "download";`,
  `  const isLeaseDownloading = (requestId: string): boolean =>
    leaseAction?.requestId === requestId && leaseAction.type === "download";${downloadStateBlock}`,
  "the student lease-action helpers",
);

student = replaceRequired(
  student,
  `      await downloadLeaseDocument(requestId, documentId, fileName);

      Alert.alert(
        "Lease saved",
        \`\${fileName || "Lease document"} was saved successfully.\`,
      );`,
  `      const downloaded = await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      rememberDownloadedLease(documentId);

      Alert.alert(
        downloaded ? "Lease saved" : "Already downloaded",
        downloaded
          ? \`\${fileName || "Lease document"} was saved successfully.\`
          : "This lease was already downloaded on this device.",
      );`,
  "the student Download success handling",
);

// Inline request-card Download button.
student = replaceRequired(
  student,
  `disabled={isLeaseActionRunning(item.$id)}
                          onPress={(event) => {`,
  `disabled={
                            isLeaseActionRunning(item.$id) ||
                            isLeaseDownloaded(item.leaseDocumentId)
                          }
                          onPress={(event) => {`,
  "the student request-card Download disabled state",
);

student = replaceRequired(
  student,
  `opacity:
                              isLeaseActionRunning(item.$id) ? 0.65 : 1,
                          }}
                        >
                          {isLeaseDownloading(item.$id) ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Ionicons
                                name="download"
                                size={19}
                                color="#FFFFFF"
                              />
                              <Text className="ml-2 font-rubik-bold text-white">
                                Download
                              </Text>
                            </>
                          )}`,
  `opacity:
                              isLeaseActionRunning(item.$id) ||
                              isLeaseDownloaded(item.leaseDocumentId)
                                ? 0.55
                                : 1,
                          }}
                        >
                          {isLeaseDownloading(item.$id) ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : isLeaseDownloaded(item.leaseDocumentId) ? (
                            <>
                              <Ionicons
                                name="checkmark-circle"
                                size={19}
                                color="#FFFFFF"
                              />
                              <Text className="ml-2 font-rubik-bold text-white">
                                Downloaded
                              </Text>
                            </>
                          ) : (
                            <>
                              <Ionicons
                                name="download"
                                size={19}
                                color="#FFFFFF"
                              />
                              <Text className="ml-2 font-rubik-bold text-white">
                                Download
                              </Text>
                            </>
                          )}`,
  "the student request-card Download presentation",
);

// Modal Download button.
student = replaceRequired(
  student,
  `          <TouchableOpacity
            onPress={() =>
              handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Ionicons name="download" size={20} color="white" />
            <Text className="text-white font-rubik-bold ml-2">Download</Text>
          </TouchableOpacity>`,
  `          <TouchableOpacity
            disabled={
              isLeaseActionRunning(request.$id) ||
              isLeaseDownloaded(request.leaseDocumentId)
            }
            onPress={() =>
              handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{
              backgroundColor: theme.primary[300],
              opacity:
                isLeaseActionRunning(request.$id) ||
                isLeaseDownloaded(request.leaseDocumentId)
                  ? 0.55
                  : 1,
            }}
          >
            {isLeaseDownloading(request.$id) ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isLeaseDownloaded(request.leaseDocumentId) ? (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#FFFFFF"
                />
                <Text className="text-white font-rubik-bold ml-2">
                  Downloaded
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="download" size={20} color="#FFFFFF" />
                <Text className="text-white font-rubik-bold ml-2">
                  Download
                </Text>
              </>
            )}
          </TouchableOpacity>`,
  "the student modal Download button",
);

fs.writeFileSync(paths.studentRequests, student, "utf8");

// ---------------------------------------------------------------------------
// 3. Older tenant-tab My Requests screen.
// ---------------------------------------------------------------------------

let tab = addDownloadImports(
  fs.readFileSync(paths.tabRequests, "utf8"),
);

tab = replaceRequired(
  tab,
  `  const [leaseActionRequestId, setLeaseActionRequestId] =
    useState<string | null>(null);`,
  `  const [leaseActionRequestId, setLeaseActionRequestId] =
    useState<string | null>(null);${downloadStateBlock}`,
  "the tab request lease loading state",
);

tab = replaceRequired(
  tab,
  `      await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      Alert.alert(
        "Lease saved",
        \`\${fileName || "Lease document"} was saved successfully.\`,
      );`,
  `      const downloaded = await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      rememberDownloadedLease(documentId);

      Alert.alert(
        downloaded ? "Lease saved" : "Already downloaded",
        downloaded
          ? \`\${fileName || "Lease document"} was saved successfully.\`
          : "This lease was already downloaded on this device.",
      );`,
  "the tab request Download success handling",
);

tab = replaceRequired(
  tab,
  `          <TouchableOpacity
            onPress={() =>
              handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Ionicons name="download" size={20} color="white" />
            <Text className="text-white font-rubik-bold ml-2">Download</Text>
          </TouchableOpacity>`,
  `          <TouchableOpacity
            disabled={
              leaseActionRequestId === request.$id ||
              isLeaseDownloaded(request.leaseDocumentId)
            }
            onPress={() =>
              handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{
              backgroundColor: theme.primary[300],
              opacity:
                leaseActionRequestId === request.$id ||
                isLeaseDownloaded(request.leaseDocumentId)
                  ? 0.55
                  : 1,
            }}
          >
            {leaseActionRequestId === request.$id ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : isLeaseDownloaded(request.leaseDocumentId) ? (
              <>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#FFFFFF"
                />
                <Text className="text-white font-rubik-bold ml-2">
                  Downloaded
                </Text>
              </>
            ) : (
              <>
                <Ionicons name="download" size={20} color="#FFFFFF" />
                <Text className="text-white font-rubik-bold ml-2">
                  Download
                </Text>
              </>
            )}
          </TouchableOpacity>`,
  "the tab request modal Download button",
);

fs.writeFileSync(paths.tabRequests, tab, "utf8");

// ---------------------------------------------------------------------------
// 4. Built-in lease viewer.
// ---------------------------------------------------------------------------

let viewer = fs.readFileSync(paths.viewer, "utf8");

viewer = replaceRequired(
  viewer,
  `import { downloadLeaseDocument } from "@/lib/leaseDocumentClient";`,
  `import {
  downloadLeaseDocument,
  isLeaseDocumentDownloaded,
  subscribeToLeaseDownloads,
} from "@/lib/leaseDocumentClient";`,
  "the viewer lease client import",
);

viewer = replaceRequired(
  viewer,
  `  const [downloading, setDownloading] = useState(false);
  const [page, setPage] = useState(1);`,
  `  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [page, setPage] = useState(1);`,
  "the viewer download state",
);

viewer = replaceRequired(
  viewer,
  `  useEffect(() => {
    setLoading(true);`,
  `  useEffect(() => {
    let active = true;

    if (documentId) {
      void isLeaseDocumentDownloaded(documentId).then((value) => {
        if (active) setDownloaded(value);
      });
    } else {
      setDownloaded(false);
    }

    const unsubscribe = subscribeToLeaseDownloads(
      (downloadedDocumentId) => {
        if (downloadedDocumentId === documentId) {
          setDownloaded(true);
        }
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [documentId]);

  useEffect(() => {
    setLoading(true);`,
  "the viewer PDF loading effect",
);

viewer = replaceRequired(
  viewer,
  `    if (!requestId || !documentId || downloading) return;`,
  `    if (!requestId || !documentId || downloaded || downloading) return;`,
  "the viewer Download guard",
);

viewer = replaceRequired(
  viewer,
  `      await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      Alert.alert(
        "Lease downloaded",
        \`\${fileName} was saved to your Downloads folder.\`,
      );`,
  `      const didDownload = await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      setDownloaded(true);

      Alert.alert(
        didDownload ? "Lease downloaded" : "Already downloaded",
        didDownload
          ? \`\${fileName} was saved to your Downloads folder.\`
          : "This lease was already downloaded on this device.",
      );`,
  "the viewer Download success handling",
);

viewer = viewer.replaceAll(
  `disabled={!requestId || !documentId || downloading}`,
  `disabled={!requestId || !documentId || downloaded || downloading}`,
);

viewer = viewer.replaceAll(
  `!requestId || !documentId || downloading`,
  `!requestId || !documentId || downloaded || downloading`,
);

viewer = viewer.replaceAll(
  `!requestId || !documentId || downloaded || downloaded || downloading`,
  `!requestId || !documentId || downloaded || downloading`,
);

viewer = replaceRequired(
  viewer,
  `          {downloading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary[300]}
            />
          ) : (
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.primary[300]}
            />
          )}`,
  `          {downloading ? (
            <ActivityIndicator
              size="small"
              color={theme.primary[300]}
            />
          ) : downloaded ? (
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={theme.primary[300]}
            />
          ) : (
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.primary[300]}
            />
          )}`,
  "the viewer Download icon",
);

fs.writeFileSync(paths.viewer, viewer, "utf8");

// ---------------------------------------------------------------------------
// Final validation.
// ---------------------------------------------------------------------------

const finalClient = fs.readFileSync(paths.client, "utf8");
const finalStudent = fs.readFileSync(paths.studentRequests, "utf8");
const finalTab = fs.readFileSync(paths.tabRequests, "utf8");
const finalViewer = fs.readFileSync(paths.viewer, "utf8");

if (!finalClient.includes("markLeaseDocumentDownloaded")) {
  fail("Persistent lease download state was not installed.");
}

if (!finalStudent.includes("Downloaded")) {
  fail("The student Download button was not updated.");
}

if (!finalTab.includes("Downloaded")) {
  fail("The tab Download button was not updated.");
}

if (!finalViewer.includes("setDownloaded(true)")) {
  fail("The viewer Download state was not updated.");
}

console.log(`
Nookly one-download-per-lease patch applied.

Updated:
- lib/leaseDocumentClient.ts
- app/(root)/(student)/s-myRequests.tsx
- app/(root)/(tabs)/myRequests.tsx
- app/(root)/lease-viewer.tsx

Behaviour:
- A lease can be downloaded once per device.
- After a successful save, Download changes to Downloaded.
- The button remains disabled after restarting Nookly.
- A newly sent lease with a different document ID is enabled.

Next run:
npx tsc --noEmit
`);
