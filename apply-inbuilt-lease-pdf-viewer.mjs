import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const patchRoot = path.join(
  root,
  "patch-files",
);

const targets = {
  leaseClient: path.join(
    root,
    "lib",
    "leaseDocumentClient.ts",
  ),
  viewer: path.join(
    root,
    "app",
    "(root)",
    "lease-viewer.tsx",
  ),
  packageJson: path.join(
    root,
    "package.json",
  ),
  appJson: path.join(
    root,
    "app.json",
  ),
};

const sources = {
  leaseClient: path.join(
    patchRoot,
    "lib",
    "leaseDocumentClient.ts",
  ),
  viewer: path.join(
    patchRoot,
    "app",
    "(root)",
    "lease-viewer.tsx",
  ),
};

for (const [label, filePath] of Object.entries({
  ...sources,
  packageJson: targets.packageJson,
  appJson: targets.appJson,
})) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `${label} was not found: ${filePath}\n` +
        "Extract the full ZIP into the Nookly project root before running this installer.",
    );
  }
}

const backupSuffix =
  ".inbuilt-lease-pdf-viewer.bak";

function backup(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const backupPath =
    `${filePath}${backupSuffix}`;

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(
      filePath,
      backupPath,
    );
  }
}

function writeUtf8(
  filePath,
  content,
) {
  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    filePath,
    content,
    "utf8",
  );
}

const packageJson = JSON.parse(
  fs.readFileSync(
    targets.packageJson,
    "utf8",
  ),
);

packageJson.dependencies = {
  ...(packageJson.dependencies || {}),
  "@config-plugins/react-native-blob-util":
    "12.0.0",
  "@config-plugins/react-native-pdf":
    "12.0.0",
  "react-native-blob-util":
    "0.21.2",
  "react-native-pdf":
    "6.7.7",
};

const appJson = JSON.parse(
  fs.readFileSync(
    targets.appJson,
    "utf8",
  ),
);

if (!appJson.expo) {
  throw new Error(
    "app.json does not contain an expo object. No files were changed.",
  );
}

if (!Array.isArray(appJson.expo.plugins)) {
  appJson.expo.plugins = [];
}

const pluginNames = new Set(
  appJson.expo.plugins.map(
    (plugin) =>
      Array.isArray(plugin)
        ? plugin[0]
        : plugin,
  ),
);

const nativePlugins = [
  "@config-plugins/react-native-blob-util",
  "@config-plugins/react-native-pdf",
];

for (const pluginName of nativePlugins) {
  if (!pluginNames.has(pluginName)) {
    const routerIndex =
      appJson.expo.plugins.findIndex(
        (plugin) =>
          plugin === "expo-router" ||
          (
            Array.isArray(plugin) &&
            plugin[0] === "expo-router"
          ),
      );

    if (routerIndex >= 0) {
      appJson.expo.plugins.splice(
        routerIndex,
        0,
        pluginName,
      );
    } else {
      appJson.expo.plugins.push(
        pluginName,
      );
    }

    pluginNames.add(pluginName);
  }
}

const newLeaseClient =
  fs.readFileSync(
    sources.leaseClient,
    "utf8",
  );

const newViewer =
  fs.readFileSync(
    sources.viewer,
    "utf8",
  );

const validations = [
  [
    newLeaseClient.includes(
      "MediaCollection.copyToMediaStore",
    ),
    "Android Downloads MediaStore implementation is missing",
  ],
  [
    newLeaseClient.includes(
      'pathname: PREVIEW_ROUTE',
    ),
    "internal viewer navigation is missing",
  ],
  [
    newViewer.includes(
      'from "react-native-pdf"',
    ),
    "react-native-pdf viewer import is missing",
  ],
  [
    newViewer.includes(
      "Pinch to zoom",
    ),
    "viewer controls are missing",
  ],
  [
    packageJson.dependencies[
      "react-native-pdf"
    ] === "6.7.7",
    "Expo 54 PDF dependency version is incorrect",
  ],
  [
    packageJson.dependencies[
      "react-native-blob-util"
    ] === "0.21.2",
    "Expo 54 blob dependency version is incorrect",
  ],
];

const failed =
  validations.find(
    ([valid]) => !valid,
  );

if (failed) {
  throw new Error(
    `Validation failed: ${failed[1]}. No files were changed.`,
  );
}

backup(targets.leaseClient);
backup(targets.viewer);
backup(targets.packageJson);
backup(targets.appJson);

writeUtf8(
  targets.leaseClient,
  newLeaseClient,
);

writeUtf8(
  targets.viewer,
  newViewer,
);

writeUtf8(
  targets.packageJson,
  `${JSON.stringify(
    packageJson,
    null,
    2,
  )}\n`,
);

writeUtf8(
  targets.appJson,
  `${JSON.stringify(
    appJson,
    null,
    2,
  )}\n`,
);

console.log("");
console.log(
  "Nookly in-built lease PDF viewer applied.",
);
console.log("");
console.log("Updated:");
console.log(
  "- lib/leaseDocumentClient.ts",
);
console.log(
  "- app/(root)/lease-viewer.tsx",
);
console.log("- package.json");
console.log("- app.json");
console.log("");
console.log(
  "Preview now downloads locally and opens inside Nookly.",
);
console.log(
  "Android Download now saves directly to the system Downloads collection.",
);
console.log("");
console.log("Next run:");
console.log("npm install");
console.log("npx tsc --noEmit");
console.log("");
console.log(
  "A new native APK/dev build is required after TypeScript is clean.",
);
