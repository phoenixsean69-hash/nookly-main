import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = {
  client: path.join(root, "lib", "leaseDocumentClient.ts"),
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
  const backupPath = `${filePath}.lease-preview-timeout-fix-v3.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const replaceRequired = (source, search, replacement, label) => {
  if (!source.includes(search)) {
    fail(
      `Could not find ${label}. The file differs from the expected patched version.`,
    );
  }

  return source.replace(search, replacement);
};

Object.entries(files).forEach(([key, filePath]) => {
  requireFile(filePath, key);
  backup(filePath);
});

// 1. Carry the document ID into the built-in viewer route.
let client = fs.readFileSync(files.client, "utf8");

if (!client.includes("documentId: access.documentId,")) {
  client = replaceRequired(
    client,
    `      requestId: access.requestId,
    },`,
    `      requestId: access.requestId,
      documentId: access.documentId,
    },`,
    "the lease viewer route parameters",
  );
}

fs.writeFileSync(files.client, client, "utf8");

// 2. Update the tenant tab request screen to the new direct-storage signatures.
let tabRequests = fs.readFileSync(files.tabRequests, "utf8");

tabRequests = replaceRequired(
  tabRequests,
  `  const handlePreviewLease = async (
    requestId: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await previewLeaseDocument(requestId);`,
  `  const handlePreviewLease = async (
    requestId: string,
    documentId: string,
    fileName: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await previewLeaseDocument(
        requestId,
        documentId,
        fileName,
      );`,
  "the tab request Preview handler",
);

tabRequests = replaceRequired(
  tabRequests,
  `  const handleDownloadLease = async (
    requestId: string,
    fileName: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await downloadLeaseDocument(
        requestId,
        fileName,
      );`,
  `  const handleDownloadLease = async (
    requestId: string,
    documentId: string,
    fileName: string,
  ) => {
    setLeaseActionRequestId(requestId);

    try {
      await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );`,
  "the tab request Download handler",
);

tabRequests = replaceRequired(
  tabRequests,
  `onPress={() => handlePreviewLease(request.$id)}`,
  `onPress={() =>
              handlePreviewLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )
            }`,
  "the tab request Preview button",
);

tabRequests = replaceRequired(
  tabRequests,
  `handleDownloadLease(
                request.$id,
                request.leaseDocumentName || "lease_document.pdf",
              )`,
  `handleDownloadLease(
                request.$id,
                request.leaseDocumentId || "",
                request.leaseDocumentName || "lease_document.pdf",
              )`,
  "the tab request Download button",
);

fs.writeFileSync(files.tabRequests, tabRequests, "utf8");

// 3. Let the viewer's own Download button use the same document ID.
let viewer = fs.readFileSync(files.viewer, "utf8");

viewer = replaceRequired(
  viewer,
  `    requestId?: string | string[];
  }>();`,
  `    requestId?: string | string[];
    documentId?: string | string[];
  }>();`,
  "the viewer route parameter type",
);

viewer = replaceRequired(
  viewer,
  `  const requestId = getSingleParam(params.requestId);

  const colorScheme`,
  `  const requestId = getSingleParam(params.requestId);
  const documentId = getSingleParam(params.documentId);

  const colorScheme`,
  "the viewer document ID variable",
);

viewer = replaceRequired(
  viewer,
  `    if (!requestId || downloading) return;`,
  `    if (!requestId || !documentId || downloading) return;`,
  "the viewer Download guard",
);

viewer = replaceRequired(
  viewer,
  `      await downloadLeaseDocument(requestId, fileName);`,
  `      await downloadLeaseDocument(
        requestId,
        documentId,
        fileName,
      );`,
  "the viewer Download call",
);

viewer = viewer.replaceAll(
  `disabled={!requestId || downloading}`,
  `disabled={!requestId || !documentId || downloading}`,
);

viewer = viewer.replaceAll(
  `!requestId || downloading`,
  `!requestId || !documentId || downloading`,
);

// The guard was intentionally changed before the global replacements.
// Collapse any accidental repeated documentId condition.
viewer = viewer.replaceAll(
  `!requestId || !documentId || !documentId || downloading`,
  `!requestId || !documentId || downloading`,
);

fs.writeFileSync(files.viewer, viewer, "utf8");

// 4. Remove extracted patch payloads from the source tree.
// TypeScript was compiling patch-files/app/(root)/lease-viewer.tsx as a duplicate source file.
const patchFilesDirectory = path.join(root, "patch-files");

if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, {
    recursive: true,
    force: true,
  });
}

const finalClient = fs.readFileSync(files.client, "utf8");
const finalTabRequests = fs.readFileSync(files.tabRequests, "utf8");
const finalViewer = fs.readFileSync(files.viewer, "utf8");

if (!finalClient.includes("documentId: access.documentId,")) {
  fail("The lease client is not passing documentId to the viewer.");
}

if (
  !finalTabRequests.includes(
    "previewLeaseDocument(\n        requestId,\n        documentId,\n        fileName,",
  )
) {
  fail("The tab request Preview call was not updated.");
}

if (
  !finalTabRequests.includes(
    "downloadLeaseDocument(\n        requestId,\n        documentId,\n        fileName,",
  )
) {
  fail("The tab request Download call was not updated.");
}

if (
  !finalViewer.includes(
    "downloadLeaseDocument(\n        requestId,\n        documentId,\n        fileName,",
  )
) {
  fail("The viewer Download call was not updated.");
}

console.log(`
Nookly lease caller fix v3 applied.

Updated:
- lib/leaseDocumentClient.ts
- app/(root)/(tabs)/myRequests.tsx
- app/(root)/lease-viewer.tsx

Cleaned:
- Removed the extracted patch-files folder from the project root.

Next run:
npx tsc --noEmit
`);
