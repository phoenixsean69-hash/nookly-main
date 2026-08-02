import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const EXISTING_STORAGE_BUCKET_ID =
  "69a20709002844cb4f69";

const files = {
  appwrite: path.join(
    root,
    "lib",
    "appwrite.ts",
  ),
  pushFunction: path.join(
    root,
    "functions",
    "nookly-push-api",
    "src",
    "main.js",
  ),
  appwriteConfig: path.join(
    root,
    "appwrite.config.json",
  ),
  eas: path.join(root, "eas.json"),
  terminalTest: path.join(
    root,
    "scripts",
    "lucan-send-lease-test.mjs",
  ),
};

for (const [label, filePath] of Object.entries(files)) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} was not found: ${filePath}\n` +
        "Apply secure lease flow V3 first, then run this installer from the Nookly project root.",
    );
  }
}

const backupSuffix =
  ".existing-storage-lease-flow.bak";

function read(filePath) {
  return fs.readFileSync(
    filePath,
    "utf8",
  );
}

function writeWithBackup(
  filePath,
  content,
) {
  const backupPath =
    `${filePath}${backupSuffix}`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
      filePath,
      backupPath,
    );
  }

  fs.writeFileSync(
    filePath,
    content,
    "utf8",
  );
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

  return content.replace(
    search,
    replacement,
  );
}

function replaceRangeRequired(
  content,
  startMarker,
  endMarker,
  replacement,
  label,
) {
  const start =
    content.indexOf(startMarker);

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

function patchAppwrite(original) {
  let content = original;

  content = content.replace(
    `  leaseBucketId:
    process.env.EXPO_PUBLIC_APPWRITE_LEASE_BUCKET_ID ||
    "lease_documents",
`,
    `  // The free Appwrite plan uses the existing public storage bucket.
  leaseBucketId:
    process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID ||
    "${EXISTING_STORAGE_BUCKET_ID}",
`,
  );

  const startMarker =
    "export const uploadLeaseDocument = async";

  const endMarker =
    "export const deleteLeaseDocument = async";

  const replacement = `export const uploadLeaseDocument = async (
  fileAsset: LeaseUploadAsset,
  _tenantAccountId: string,
): Promise<UploadedLeaseDocument> => {
  const fileName = sanitizeLeaseFileName(
    fileAsset.name,
  );

  const mimeType =
    fileAsset.mimeType || "application/pdf";

  const fileSize = Number(
    fileAsset.size || 0,
  );

  const isPdf =
    mimeType === "application/pdf" ||
    fileName
      .toLowerCase()
      .endsWith(".pdf");

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
    fileSize >
    MAX_LEASE_DOCUMENT_SIZE
  ) {
    throw new Error(
      "Lease documents must be 10 MB or smaller.",
    );
  }

  const bucketId =
    config.bucketId ||
    config.leaseBucketId;

  if (!bucketId) {
    throw new Error(
      "The Appwrite storage bucket is not configured.",
    );
  }

  console.log(
    "📄 Uploading lease to the existing public storage bucket...",
  );

  // The existing free-plan bucket has file security disabled.
  // Do not pass file-level permissions because Appwrite ignores
  // them when file security is off.
  const response =
    await storage.createFile(
      bucketId,
      ID.unique(),
      {
        name: fileName,
        type: "application/pdf",
        size: fileSize,
        uri: fileAsset.uri,
      },
    );

  console.log(
    "✅ Lease document uploaded:",
    response.$id,
  );

  return {
    fileId: response.$id,
    bucketId,
    name: fileName,
    size: fileSize,
    mimeType: "application/pdf",
  };
};

`;

  content = replaceRangeRequired(
    content,
    startMarker,
    endMarker,
    replacement,
    "the V3 lease upload function",
  );

  content = content.replace(
    `  await storage.deleteFile(
    config.leaseBucketId!,
    normalizedFileId,
  );`,
    `  await storage.deleteFile(
    config.bucketId ||
      config.leaseBucketId!,
    normalizedFileId,
  );`,
  );

  const required = [
    "existing public storage bucket",
    "config.bucketId ||",
    "await storage.createFile(",
  ];

  for (const marker of required) {
    if (!content.includes(marker)) {
      throw new Error(
        `Appwrite validation failed: ${marker} is missing. No files were written.`,
      );
    }
  }

  if (
    content.includes(
      'Role.user(normalizedTenantId)',
    )
  ) {
    throw new Error(
      "The old private file permissions remain. No files were written.",
    );
  }

  return content;
}

const publicLeaseHandlers = `const getUserRowByReference = async (
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

  const requestRow =
    await getRowOrNull(
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
    ownerAccountId !==
      landlordAccountId
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
      "The request does not contain a valid tenant account ID.",
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

  if (
    !documentName
      .toLowerCase()
      .endsWith(".pdf")
  ) {
    throw statusError(
      409,
      "The saved lease document must be a PDF.",
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
    landlordUser?.name ??
      "Landlord",
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
    landlordId:
      landlordAccountId,
    landlordName,
    documentId,
    documentName,
    documentSize: 0,
    mimeType:
      "application/pdf",
    leaseMessage,
    sentAt,
  };

  const title =
    "Lease Document Ready 📄";

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

  const inApp =
    await createInAppNotification(
      tables,
      {
        rowId:
          notificationRowId,
        recipientUserId:
          tenantAccountId,
        title,
        message,
        type: "lease",
        data:
          notificationData,
      },
    );

  if (!inApp.created) {
    return {
      skipped: true,
      duplicate: true,
      reason:
        "This lease notification was already processed.",
      notificationRowId,
      recipientUserId:
        tenantAccountId,
      requestId,
      propertyId,
      documentId,
      data:
        notificationData,
    };
  }

  const push = await sendToUser(
    tables,
    tenantAccountId,
    validateNotification({
      title,
      body: message,
      data:
        notificationData,
    }),
    diagnosticLog,
  );

  return {
    skipped: false,
    duplicate: false,
    notificationCreated:
      true,
    notificationRowId,
    recipientUserId:
      tenantAccountId,
    requestId,
    propertyId,
    documentId,
    data:
      notificationData,
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

  const requestRow =
    await getRowOrNull(
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

  if (
    requestTenantId !==
    tenantAccountId
  ) {
    throw statusError(
      403,
      "Only the tenant named on this request can open its lease from Nookly.",
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

  const documentName = String(
    requestRow.leaseDocumentName ??
      "lease_document.pdf",
  ).trim() || "lease_document.pdf";

  const endpoint =
    env("APPWRITE_FUNCTION_API_ENDPOINT") ||
    env("APPWRITE_ENDPOINT") ||
    "https://fra.cloud.appwrite.io/v1";

  const projectId =
    env(
      "APPWRITE_FUNCTION_PROJECT_ID",
    );

  const baseUrl =
    endpoint.replace(/\\/$/, "") +
    "/storage/buckets/" +
    encodeURIComponent(
      LEASE_BUCKET_ID,
    ) +
    "/files/" +
    encodeURIComponent(
      documentId,
    );

  const query =
    "?project=" +
    encodeURIComponent(
      projectId,
    );

  // The existing storage bucket has public read access and
  // file security disabled, so these URLs do not need tokens.
  return {
    requestId,
    propertyId: String(
      requestRow.propertyId ?? "",
    ).trim(),
    propertyName: String(
      requestRow.propertyName ??
        "Property",
    ).trim() || "Property",
    documentId,
    documentName,
    documentSize: 0,
    mimeType:
      "application/pdf",
    expiresAt: "",
    viewUrl:
      baseUrl +
      "/view" +
      query,
    downloadUrl:
      baseUrl +
      "/download" +
      query,
  };
};

`;

function patchPushFunction(
  original,
) {
  let content = original;

  content = content.replace(
    `  Role,
  Storage,
  TablesDB,
  Tokens,
`,
    `  Role,
  TablesDB,
`,
  );

  content = content.replace(
    `const LEASE_BUCKET_ID = env(
  "NOOKLY_LEASE_BUCKET_ID",
  "lease_documents",
);`,
    `const LEASE_BUCKET_ID = env(
  "NOOKLY_LEASE_BUCKET_ID",
  "${EXISTING_STORAGE_BUCKET_ID}",
);`,
  );

  content = replaceRangeRequired(
    content,
    "const createStorage = (req) =>",
    "const checkReceipts = async (body) => {",
    publicLeaseHandlers,
    "the V3 private lease Function handlers",
  );

  content = content.replaceAll(
    'version: "1.4.0"',
    'version: "1.4.1"',
  );

  const required = [
    `const LEASE_BUCKET_ID = env(`,
    `"${EXISTING_STORAGE_BUCKET_ID}"`,
    "const notifyLeaseSent",
    "const issueLeaseAccess",
    "public read access",
    'path === "/lease-sent"',
    'path === "/lease-access"',
  ];

  for (const marker of required) {
    if (!content.includes(marker)) {
      throw new Error(
        `Function validation failed: ${marker} is missing. No files were written.`,
      );
    }
  }

  const forbidden = [
    "createFileToken",
    "const createStorage",
    "const createTokens",
    "new Storage(",
    "new Tokens(",
  ];

  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(
        `Function validation failed: ${marker} remains. No files were written.`,
      );
    }
  }

  return content;
}

function patchAppwriteConfig(
  original,
) {
  const parsed =
    JSON.parse(original);

  if (
    Array.isArray(parsed.functions)
  ) {
    const pushFunction =
      parsed.functions.find(
        (item) =>
          item.$id ===
          "6a31d988001bf962fb57",
      );

    if (pushFunction) {
      pushFunction.scopes = (
        Array.isArray(
          pushFunction.scopes,
        )
          ? pushFunction.scopes
          : []
      ).filter(
        (scope) =>
          scope !== "files.read" &&
          scope !== "tokens.write",
      );
    }
  }

  if (!Array.isArray(parsed.buckets)) {
    parsed.buckets = [];
  }

  parsed.buckets =
    parsed.buckets.filter(
      (bucket) =>
        bucket.$id !==
        "lease_documents",
    );

  const existingBucket =
    parsed.buckets.find(
      (bucket) =>
        bucket.$id ===
        EXISTING_STORAGE_BUCKET_ID,
    );

  if (!existingBucket) {
    throw new Error(
      "The existing storage bucket is missing from appwrite.config.json. No files were written.",
    );
  }

  const extensions =
    new Set(
      Array.isArray(
        existingBucket
          .allowedFileExtensions,
      )
        ? existingBucket
            .allowedFileExtensions
        : [],
    );

  extensions.add("pdf");

  existingBucket
    .allowedFileExtensions =
      Array.from(extensions);

  return (
    JSON.stringify(
      parsed,
      null,
      4,
    ) + "\n"
  );
}

function patchEas(original) {
  const parsed =
    JSON.parse(original);

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
          EXISTING_STORAGE_BUCKET_ID,
      };
    }
  }

  return (
    JSON.stringify(
      parsed,
      null,
      2,
    ) + "\n"
  );
}

function patchTerminalTest(
  original,
) {
  let content = original;

  content = content.replace(
    `  Permission,
  Query,
  Role,
  Storage,
`,
    `  Query,
  Storage,
`,
  );

  content = content.replace(
    `const leaseBucketId = required(
  "EXPO_PUBLIC_APPWRITE_LEASE_BUCKET_ID",
  "lease_documents",
);`,
    `const leaseBucketId = String(
  process.env.EXPO_PUBLIC_APPWRITE_BUCKET_ID ||
    process.env.EXPO_PUBLIC_APPWRITE_LEASE_BUCKET_ID ||
    "${EXISTING_STORAGE_BUCKET_ID}",
).trim();`,
  );

  const permissionsStart =
    content.indexOf(
      "    permissions: [",
    );

  if (permissionsStart >= 0) {
    let index =
      permissionsStart +
      "    permissions: [".length;

    let depth = 1;

    while (
      index < content.length &&
      depth > 0
    ) {
      const character =
        content[index];

      if (character === "[") {
        depth += 1;
      } else if (
        character === "]"
      ) {
        depth -= 1;
      }

      index += 1;
    }

    if (depth !== 0) {
      throw new Error(
        "Could not parse the terminal upload permissions. No files were written.",
      );
    }

    while (
      index < content.length &&
      /[ \t]/.test(
        content[index],
      )
    ) {
      index += 1;
    }

    if (
      content[index] === ","
    ) {
      index += 1;
    }

    content =
      content.slice(
        0,
        permissionsStart,
      ) +
      content.slice(index);
  }

  const forbidden = [
    "Permission.read(",
    "Permission.update(",
    "Permission.delete(",
    "Role.user(",
    '"lease_documents"',
  ];

  for (const marker of forbidden) {
    if (content.includes(marker)) {
      throw new Error(
        `Terminal test validation failed: ${marker} remains. No files were written.`,
      );
    }
  }

  return content;
}

const originals = {
  appwrite:
    read(files.appwrite),
  pushFunction:
    read(files.pushFunction),
  appwriteConfig:
    read(files.appwriteConfig),
  eas:
    read(files.eas),
  terminalTest:
    read(files.terminalTest),
};

const patched = {
  appwrite:
    patchAppwrite(
      originals.appwrite,
    ),
  pushFunction:
    patchPushFunction(
      originals.pushFunction,
    ),
  appwriteConfig:
    patchAppwriteConfig(
      originals.appwriteConfig,
    ),
  eas:
    patchEas(originals.eas),
  terminalTest:
    patchTerminalTest(
      originals.terminalTest,
    ),
};

const validations = [
  [
    patched.appwrite.includes(
      EXISTING_STORAGE_BUCKET_ID,
    ),
    "app code does not reference the existing storage bucket",
  ],
  [
    patched.pushFunction.includes(
      'version: "1.4.1"',
    ),
    "Function version 1.4.1 is missing",
  ],
  [
    patched.pushFunction.includes(
      "public read access",
    ),
    "public lease access handler is missing",
  ],
  [
    !patched.appwriteConfig.includes(
      '"$id": "lease_documents"',
    ),
    "the extra lease bucket remains in appwrite.config.json",
  ],
  [
    patched.appwriteConfig.includes(
      '"pdf"',
    ),
    "pdf was not added to the existing bucket extensions",
  ],
  [
    patched.terminalTest.includes(
      EXISTING_STORAGE_BUCKET_ID,
    ),
    "terminal test does not use the existing bucket",
  ],
];

const failed =
  validations.find(
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

writeWithBackup(
  files.terminalTest,
  patched.terminalTest,
);

console.log("");
console.log(
  "Existing-storage lease adaptation applied.",
);
console.log("");
console.log(
  `Lease bucket: ${EXISTING_STORAGE_BUCKET_ID}`,
);
console.log(
  "Security mode: public bucket / file security disabled",
);
console.log("");
console.log("Updated:");
console.log("- lib/appwrite.ts");
console.log(
  "- functions/nookly-push-api/src/main.js",
);
console.log("- appwrite.config.json");
console.log("- eas.json");
console.log(
  "- scripts/lucan-send-lease-test.mjs",
);
console.log("");
console.log(
  "No second bucket or file-token scope is required.",
);
console.log("");
console.log(
  "IMPORTANT: add pdf to the existing bucket's allowed file extensions in Appwrite Console.",
);
console.log("");
console.log("Now run:");
console.log("npx tsc --noEmit");
