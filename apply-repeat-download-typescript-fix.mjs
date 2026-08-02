import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requestFiles = [
  path.join(
    root,
    "app",
    "(root)",
    "(student)",
    "s-myRequests.tsx",
  ),
  path.join(
    root,
    "app",
    "(root)",
    "(tabs)",
    "myRequests.tsx",
  ),
];

const viewerPath = path.join(
  root,
  "app",
  "(root)",
  "lease-viewer.tsx",
);

const fail = (message) => {
  console.error(`\nPatch stopped: ${message}\n`);
  process.exit(1);
};

const backup = (filePath) => {
  const backupPath =
    `${filePath}.repeat-download-typescript-fix.bak`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }
};

const unique = (values) =>
  [...new Set(values.map((value) => value.trim()).filter(Boolean))];

const readNamedImports = (source, moduleName) => {
  const escaped = moduleName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `import\\s*\\{([^;]*?)\\}\\s*from\\s*["']${escaped}["'];`,
    "g",
  );

  const names = [];
  let match;

  while ((match = pattern.exec(source)) !== null) {
    names.push(
      ...match[1]
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    );
  }

  return unique(names);
};

const removeNamedImports = (source, moduleName) => {
  const escaped = moduleName.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

  const pattern = new RegExp(
    `import\\s*\\{[^;]*?\\}\\s*from\\s*["']${escaped}["'];\\s*`,
    "g",
  );

  return source.replace(pattern, "");
};

const formatNamedImport = (moduleName, names) =>
  `import {\n  ${unique(names).sort().join(",\n  ")},\n} from "${moduleName}";\n`;

const normalizeLeaseImports = (source) => {
  const leaseNames = new Set([
    "downloadLeaseDocument",
    "previewLeaseDocument",
    "isLeaseDocumentDownloaded",
    "subscribeToLeaseDownloads",
  ]);

  const appwriteNames = readNamedImports(
    source,
    "@/lib/appwrite",
  ).filter((name) => !leaseNames.has(name));

  const currentLeaseNames = readNamedImports(
    source,
    "@/lib/leaseDocumentClient",
  );

  const requiredLeaseNames = [
    ...currentLeaseNames,
    "downloadLeaseDocument",
    "previewLeaseDocument",
    "isLeaseDocumentDownloaded",
    "subscribeToLeaseDownloads",
  ];

  source = removeNamedImports(source, "@/lib/appwrite");
  source = removeNamedImports(
    source,
    "@/lib/leaseDocumentClient",
  );

  const insertion =
    formatNamedImport("@/lib/appwrite", appwriteNames) +
    formatNamedImport(
      "@/lib/leaseDocumentClient",
      requiredLeaseNames,
    );

  const firstImportEnd = source.indexOf("\n");

  if (firstImportEnd < 0) {
    fail("Could not locate the import section.");
  }

  return (
    source.slice(0, firstImportEnd + 1) +
    insertion +
    source.slice(firstImportEnd + 1)
  );
};

for (const filePath of requestFiles) {
  if (!fs.existsSync(filePath)) {
    fail(`Request screen was not found at ${filePath}`);
  }

  backup(filePath);

  let source = fs.readFileSync(filePath, "utf8");
  source = normalizeLeaseImports(source);

  source = source.replaceAll(
    "subscribeToLeaseDownloads((documentId) =>",
    "subscribeToLeaseDownloads((documentId: string) =>",
  );

  if (
    !source.includes(
      'from "@/lib/leaseDocumentClient";',
    )
  ) {
    fail(
      `The lease client import was not restored in ${filePath}`,
    );
  }

  const appwriteImportMatch = source.match(
    /import\s*\{([^;]*?)\}\s*from\s*["']@\/lib\/appwrite["'];/,
  );

  if (
    appwriteImportMatch &&
    /isLeaseDocumentDownloaded|previewLeaseDocument|subscribeToLeaseDownloads|downloadLeaseDocument/.test(
      appwriteImportMatch[1],
    )
  ) {
    fail(
      `Lease helpers are still incorrectly imported from appwrite in ${filePath}`,
    );
  }

  fs.writeFileSync(filePath, source, "utf8");
}

if (!fs.existsSync(viewerPath)) {
  fail(`Lease viewer was not found at ${viewerPath}`);
}

backup(viewerPath);

let viewer = fs.readFileSync(viewerPath, "utf8");

viewer = viewer.replace(
  /renderActivityIndicator=\{\(\)\s*=>\s*null\}/g,
  "renderActivityIndicator={() => <View />}",
);

if (
  viewer.includes(
    "renderActivityIndicator={() => null}",
  )
) {
  fail("The invalid PDF activity indicator is still present.");
}

fs.writeFileSync(viewerPath, viewer, "utf8");

const patchFilesDirectory = path.join(root, "patch-files");

if (fs.existsSync(patchFilesDirectory)) {
  fs.rmSync(patchFilesDirectory, {
    recursive: true,
    force: true,
  });
}

console.log(`
Nookly repeat-download TypeScript fix applied.

Fixed:
- Lease helpers now import from @/lib/leaseDocumentClient
- Appwrite imports contain only Appwrite helpers
- Lease download listener parameters are typed as string
- react-native-pdf receives a valid React element
- Extracted patch-files payloads were removed

Next run:
npx tsc --noEmit
`);
