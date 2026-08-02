import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = process.cwd();
const clientPath = path.join(root, "lib", "leaseDocumentClient.ts");
const screenPath = path.join(
  root,
  "app",
  "(root)",
  "(student)",
  "s-myRequests.tsx",
);
const installerDirectory = path.dirname(fileURLToPath(import.meta.url));

const replacementClientPath = path.join(
  installerDirectory,
  "patch-files",
  "lib",
  "leaseDocumentClient.ts",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const backup = (filePath) => {
  const backupPath = `${filePath}.lease-preview-timeout-fix.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) {
    fail(`Could not find ${label}. Your file differs from the expected version.`);
  }

  return source.replace(search, replacement);
};

if (!fs.existsSync(clientPath)) {
  fail("lib/leaseDocumentClient.ts was not found. Run this from the Nookly project root.");
}

if (!fs.existsSync(screenPath)) {
  fail("app/(root)/(student)/s-myRequests.tsx was not found.");
}

if (!fs.existsSync(replacementClientPath)) {
  fail("The replacement lease client is missing from the patch folder.");
}

backup(clientPath);
backup(screenPath);

fs.copyFileSync(replacementClientPath, clientPath);

let screen = fs.readFileSync(screenPath, "utf8");

screen = replaceRequired(
  screen,
  `  const [leaseActionRequestId, setLeaseActionRequestId] = useState<
    string | null
  >(null);`,
  `  const [leaseAction, setLeaseAction] = useState<{
    requestId: string;
    type: "preview" | "download";
  } | null>(null);

  const isLeaseActionRunning = (requestId: string): boolean =>
    leaseAction?.requestId === requestId;

  const isLeasePreviewing = (requestId: string): boolean =>
    leaseAction?.requestId === requestId && leaseAction.type === "preview";

  const isLeaseDownloading = (requestId: string): boolean =>
    leaseAction?.requestId === requestId && leaseAction.type === "download";`,
  "the existing lease loading state",
);

screen = replaceRequired(
  screen,
  `  const handlePreviewLease = async (requestId: string) => {
    setLeaseActionRequestId(requestId);

    try {
      await previewLeaseDocument(requestId);
    } catch (error) {
      console.error("Error previewing lease:", error);

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

  const handleDownloadLease = async (requestId: string, fileName: string) => {
    setLeaseActionRequestId(requestId);

    try {
      await downloadLeaseDocument(requestId, fileName);

      Alert.alert(
        "Lease saved",
        \`\${fileName || "Lease document"} was saved successfully.\`,
      );
    } catch (error) {
      console.error("Error downloading lease:", error);

      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "The lease could not be downloaded.",
      );
    } finally {
      setLeaseActionRequestId(null);
    }
  };`,
  `  const handlePreviewLease = async (
    requestId: string,
    documentId: string,
    fileName: string,
  ) => {
    if (isLeaseActionRunning(requestId)) return;

    setLeaseAction({
      requestId,
      type: "preview",
    });

    try {
      await previewLeaseDocument(requestId, documentId, fileName);
    } catch (error) {
      console.error("Error previewing lease:", error);

      Alert.alert(
        "Preview unavailable",
        error instanceof Error
          ? error.message
          : "The lease could not be opened.",
      );
    } finally {
      setLeaseAction(null);
    }
  };

  const handleDownloadLease = async (
    requestId: string,
    documentId: string,
    fileName: string,
  ) => {
    if (isLeaseActionRunning(requestId)) return;

    setLeaseAction({
      requestId,
      type: "download",
    });

    try {
      await downloadLeaseDocument(requestId, documentId, fileName);

      Alert.alert(
        "Lease saved",
        \`\${fileName || "Lease document"} was saved successfully.\`,
      );
    } catch (error) {
      console.error("Error downloading lease:", error);

      Alert.alert(
        "Download failed",
        error instanceof Error
          ? error.message
          : "The lease could not be downloaded.",
      );
    } finally {
      setLeaseAction(null);
    }
  };`,
  "the lease preview/download handlers",
);

screen = replaceRequired(
  screen,
  `onPress={() => handlePreviewLease(request.$id)}`,
  `onPress={() =>
              handlePreviewLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }`,
  "the modal Preview action",
);

screen = replaceRequired(
  screen,
  `handleDownloadLease(
                request.$id,
                request.leaseDocumentName || "lease_document.pdf",
              )`,
  `handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )`,
  "the modal Download action",
);

screen = replaceRequired(
  screen,
  `void handlePreviewLease(item.$id);`,
  `void handlePreviewLease(
                              item.$id,
                              item.leaseDocumentId || "",
                              item.leaseDocumentName || "lease_document.pdf",
                            );`,
  "the request-card Preview action",
);

screen = replaceRequired(
  screen,
  `void handleDownloadLease(
                              item.$id,
                              item.leaseDocumentName || "lease_document.pdf",
                            );`,
  `void handleDownloadLease(
                              item.$id,
                              item.leaseDocumentId || "",
                              item.leaseDocumentName || "lease_document.pdf",
                            );`,
  "the request-card Download action",
);

screen = screen.replaceAll(
  "leaseActionRequestId === item.$id",
  "isLeaseActionRunning(item.$id)",
);

const spinnerToken = "{isLeaseActionRunning(item.$id) ? (";
const firstSpinner = screen.indexOf(spinnerToken);

if (firstSpinner < 0) {
  fail("Could not locate the request-card Preview loading indicator.");
}

screen =
  screen.slice(0, firstSpinner) +
  "{isLeasePreviewing(item.$id) ? (" +
  screen.slice(firstSpinner + spinnerToken.length);

const secondSpinner = screen.indexOf(spinnerToken, firstSpinner + 1);

if (secondSpinner < 0) {
  fail("Could not locate the request-card Download loading indicator.");
}

screen =
  screen.slice(0, secondSpinner) +
  "{isLeaseDownloading(item.$id) ? (" +
  screen.slice(secondSpinner + spinnerToken.length);

if (screen.includes("leaseActionRequestId")) {
  fail("An old shared lease loading-state reference is still present.");
}

if (!screen.includes("previewLeaseDocument(requestId, documentId, fileName)")) {
  fail("The Preview handler was not updated correctly.");
}

if (!screen.includes("downloadLeaseDocument(requestId, documentId, fileName)")) {
  fail("The Download handler was not updated correctly.");
}

fs.writeFileSync(screenPath, screen, "utf8");

console.log(`
Nookly lease preview timeout fix applied.

Updated:
- lib/leaseDocumentClient.ts
- app/(root)/(student)/s-myRequests.tsx

Changes:
- Lease Preview/Download no longer waits for /lease-access Function execution.
- Public Appwrite Storage URLs are built directly from the saved document ID.
- Preview and Download now have separate loading indicators.
- Both actions are protected from duplicate taps.

Next run:
npx tsc --noEmit
`);
