import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
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

const requireFile = (filePath, label) => {
  if (!fs.existsSync(filePath)) {
    fail(`${label} was not found at ${filePath}`);
  }
};

const backup = (filePath) => {
  const backupPath = `${filePath}.disable-repeat-lease-download-v2.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const addNamedImports = (source, moduleName, names) => {
  const escapedModule = moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPattern = new RegExp(
    `import\\s*\\{([\\s\\S]*?)\\}\\s*from\\s*["']${escapedModule}["'];`,
  );
  const match = source.match(importPattern);

  if (!match) {
    fail(`Could not find the import from ${moduleName}.`);
  }

  const currentNames = match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = [...new Set([...currentNames, ...names])].sort();
  const replacement =
    `import {\n  ${merged.join(",\n  ")},\n} from "${moduleName}";`;

  return source.replace(match[0], replacement);
};

const replaceDownloadCallWithRemember = (source) => {
  if (source.includes("rememberDownloadedLease(documentId);")) {
    return source;
  }

  const callPattern =
    /await downloadLeaseDocument\(\s*requestId,\s*documentId,\s*fileName,\s*\);/;

  if (!callPattern.test(source)) {
    fail("Could not find the three-argument lease Download call.");
  }

  return source.replace(
    callPattern,
    `await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      rememberDownloadedLease(documentId);`,
  );
};

const patchDownloadButtons = (source, fileLabel) => {
  let cursor = 0;
  let patched = 0;

  while (true) {
    const callIndex = source.indexOf("handleDownloadLease(", cursor);

    if (callIndex < 0) break;

    const start = source.lastIndexOf("<TouchableOpacity", callIndex);
    const previousClose = source.lastIndexOf("</TouchableOpacity>", callIndex);

    if (start < 0 || start < previousClose) {
      cursor = callIndex + 1;
      continue;
    }

    const endMarker = "</TouchableOpacity>";
    const endIndex = source.indexOf(endMarker, callIndex);

    if (endIndex < 0) {
      fail(`Could not find the end of a Download button in ${fileLabel}.`);
    }

    const blockEnd = endIndex + endMarker.length;
    let block = source.slice(start, blockEnd);

    const variableMatch = block.match(
      /handleDownloadLease\(\s*([A-Za-z_$][\w$]*)\.\$id/,
    );

    if (!variableMatch) {
      cursor = blockEnd;
      continue;
    }

    const variable = variableMatch[1];
    const downloadedExpression =
      `isLeaseDownloaded(${variable}.leaseDocumentId)`;

    const openingTagEnd = block.indexOf(">");

    if (openingTagEnd < 0) {
      fail(`Could not read a Download button opening tag in ${fileLabel}.`);
    }

    let openingTag = block.slice(0, openingTagEnd + 1);

    if (!openingTag.includes("disabled=")) {
      const onPressIndex = openingTag.indexOf("onPress=");

      if (onPressIndex < 0) {
        fail(`A Download button has no onPress property in ${fileLabel}.`);
      }

      openingTag =
        openingTag.slice(0, onPressIndex) +
        `disabled={${downloadedExpression}}\n          ` +
        openingTag.slice(onPressIndex);
    } else if (!openingTag.includes(downloadedExpression)) {
      const disabledPattern = /disabled=\{([^{}]+)\}/;
      const disabledMatch = openingTag.match(disabledPattern);

      if (!disabledMatch) {
        fail(
          `A Download button has a complex disabled expression in ${fileLabel}.`,
        );
      }

      openingTag = openingTag.replace(
        disabledMatch[0],
        `disabled={(${disabledMatch[1].trim()}) || ${downloadedExpression}}`,
      );
    }

    block = openingTag + block.slice(openingTagEnd + 1);

    if (!block.includes(`? "Downloaded" : "Download"`)) {
      const textPattern =
        /(<Text\b[^>]*>)(\s*)Download(\s*)(<\/Text>)/;

      if (textPattern.test(block)) {
        block = block.replace(
          textPattern,
          `$1$2{${downloadedExpression} ? "Downloaded" : "Download"}$3$4`,
        );
      }
    }

    source = source.slice(0, start) + block + source.slice(blockEnd);
    patched += 1;
    cursor = start + block.length;
  }

  if (patched === 0) {
    fail(`No Download buttons were found in ${fileLabel}.`);
  }

  return { source, patched };
};

const requestDownloadStateBlock = `
  const [downloadedLeaseDocumentIds, setDownloadedLeaseDocumentIds] =
    useState<Set<string>>(() => new Set());

  const isLeaseDownloaded = (documentId?: string): boolean =>
    Boolean(
      documentId &&
        downloadedLeaseDocumentIds.has(documentId),
    );

  const rememberDownloadedLease = (documentId: string) => {
    const normalizedDocumentId = documentId.trim();

    if (!normalizedDocumentId) return;

    setDownloadedLeaseDocumentIds((current) => {
      if (current.has(normalizedDocumentId)) return current;

      const next = new Set(current);
      next.add(normalizedDocumentId);
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
  }, [requests]);

`;

// ---------------------------------------------------------------------------
// Validate and back up.
// ---------------------------------------------------------------------------

Object.entries(files).forEach(([label, filePath]) => {
  requireFile(filePath, label);
  backup(filePath);
});

// ---------------------------------------------------------------------------
// Lease client: persistent successful-download marker.
// ---------------------------------------------------------------------------

let client = fs.readFileSync(files.client, "utf8");

if (!client.includes("@react-native-async-storage/async-storage")) {
  client =
    `import AsyncStorage from "@react-native-async-storage/async-storage";\n` +
    client;
}

if (!client.includes("LEASE_DOWNLOAD_STATE_PREFIX")) {
  const marker =
    `const PDF_MIME_TYPE = "application/pdf";\n` +
    `const PREVIEW_ROUTE = "/lease-viewer";`;

  if (!client.includes(marker)) {
    fail("Could not find the lease client constants.");
  }

  const stateCode = `${marker}
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
};`;

  client = client.replace(marker, stateCode);
}

if (!client.includes("Promise<boolean>")) {
  const functionPattern =
    /export const downloadLeaseDocument = async \([\s\S]*?\n\};\s*$/;
  const match = client.match(functionPattern);

  if (!match) {
    fail("Could not find downloadLeaseDocument in the lease client.");
  }

  const replacement = `export const downloadLeaseDocument = async (
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
};
`;

  client = client.replace(match[0], replacement);
}

fs.writeFileSync(files.client, client, "utf8");

// ---------------------------------------------------------------------------
// Request screens.
// ---------------------------------------------------------------------------

const patchRequestScreen = (filePath, label) => {
  let source = fs.readFileSync(filePath, "utf8");

  source = addNamedImports(
    source,
    "@/lib/leaseDocumentClient",
    [
      "isLeaseDocumentDownloaded",
      "subscribeToLeaseDownloads",
    ],
  );

  if (!source.includes("downloadedLeaseDocumentIds")) {
    const handlerMarker = "  const handlePreviewLease";

    if (!source.includes(handlerMarker)) {
      fail(`Could not find the lease handlers in ${label}.`);
    }

    source = source.replace(
      handlerMarker,
      requestDownloadStateBlock + handlerMarker,
    );
  }

  source = replaceDownloadCallWithRemember(source);

  const result = patchDownloadButtons(source, label);
  source = result.source;

  fs.writeFileSync(filePath, source, "utf8");
  return result.patched;
};

const studentButtons = patchRequestScreen(
  files.studentRequests,
  "student My Requests",
);

const tabButtons = patchRequestScreen(
  files.tabRequests,
  "tenant-tab My Requests",
);

// ---------------------------------------------------------------------------
// Built-in viewer.
// ---------------------------------------------------------------------------

let viewer = fs.readFileSync(files.viewer, "utf8");

viewer = addNamedImports(
  viewer,
  "@/lib/leaseDocumentClient",
  [
    "isLeaseDocumentDownloaded",
    "subscribeToLeaseDownloads",
  ],
);

if (!viewer.includes("const [downloaded, setDownloaded]")) {
  const marker =
    `  const [downloading, setDownloading] = useState(false);`;

  if (!viewer.includes(marker)) {
    fail("Could not find the viewer download state.");
  }

  viewer = viewer.replace(
    marker,
    `${marker}\n  const [downloaded, setDownloaded] = useState(false);`,
  );
}

if (!viewer.includes("subscribeToLeaseDownloads(")) {
  const effectMarker = "  useEffect(() => {\n    setLoading(true);";

  if (!viewer.includes(effectMarker)) {
    fail("Could not find the viewer loading effect.");
  }

  const downloadedEffect = `  useEffect(() => {
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

`;

  viewer = viewer.replace(
    effectMarker,
    downloadedEffect + effectMarker,
  );
}

viewer = viewer.replace(
  /if \(!requestId \|\| !documentId \|\| downloading\) return;/,
  "if (!requestId || !documentId || downloaded || downloading) return;",
);

if (!viewer.includes("setDownloaded(true);")) {
  const callPattern =
    /await downloadLeaseDocument\(\s*requestId,\s*documentId,\s*fileName,\s*\);/;

  if (!callPattern.test(viewer)) {
    fail("Could not find the viewer Download call.");
  }

  viewer = viewer.replace(
    callPattern,
    `await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );

      setDownloaded(true);`,
  );
}

viewer = viewer.replaceAll(
  "disabled={!requestId || !documentId || downloading}",
  "disabled={!requestId || !documentId || downloaded || downloading}",
);

viewer = viewer.replaceAll(
  "!requestId || !documentId || downloading",
  "!requestId || !documentId || downloaded || downloading",
);

viewer = viewer.replaceAll(
  "!requestId || !documentId || downloaded || downloaded || downloading",
  "!requestId || !documentId || downloaded || downloading",
);

if (!viewer.includes('name="checkmark-circle"')) {
  const iconBlock = `          {downloading ? (
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
          )}`;

  if (viewer.includes(iconBlock)) {
    viewer = viewer.replace(
      iconBlock,
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
    );
  }
}

fs.writeFileSync(files.viewer, viewer, "utf8");

// Remove any extracted patch source payloads so TypeScript does not compile them.
const patchFilesDirectory = path.join(root, "patch-files");

if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, {
    recursive: true,
    force: true,
  });
}

console.log(`
Nookly repeat-download fix v2 applied.

Updated:
- lib/leaseDocumentClient.ts
- app/(root)/(student)/s-myRequests.tsx
- app/(root)/(tabs)/myRequests.tsx
- app/(root)/lease-viewer.tsx

Patched Download buttons:
- Student screen: ${studentButtons}
- Tenant-tab screen: ${tabButtons}

Behaviour:
- A lease is saved only once per device.
- Its Download buttons become disabled.
- Their label changes to Downloaded where a text label is present.
- The state survives app restarts.
- A different lease document ID remains downloadable.

Next run:
npx tsc --noEmit
`);
