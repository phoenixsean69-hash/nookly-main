import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
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

if (!fs.existsSync(viewerPath)) {
  fail(`Lease viewer was not found at ${viewerPath}`);
}

const backupPath =
  `${viewerPath}.safe-header-close-button.bak`;

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(viewerPath, backupPath);
}

let source = fs.readFileSync(viewerPath, "utf8");

// Remove SafeAreaView from the react-native named import.
source = source.replace(
  /import\s*\{([\s\S]*?)\}\s*from\s*"react-native";/,
  (fullImport, importBody) => {
    const names = importBody
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => value !== "SafeAreaView");

    return `import {\n  ${names.join(",\n  ")},\n} from "react-native";`;
  },
);

// Add the safe-area-context implementation if it is not already imported.
if (
  !source.includes(
    'from "react-native-safe-area-context";',
  )
) {
  const reactNativeImportEnd =
    source.indexOf('} from "react-native";');

  if (reactNativeImportEnd < 0) {
    fail("Could not locate the react-native import.");
  }

  const insertionPoint =
    source.indexOf("\n", reactNativeImportEnd) + 1;

  source =
    source.slice(0, insertionPoint) +
    'import { SafeAreaView } from "react-native-safe-area-context";\n' +
    source.slice(insertionPoint);
}

// Ensure the root SafeAreaView protects both the header and footer.
source = source.replaceAll(
  `<SafeAreaView
        style={[`,
  `<SafeAreaView
        edges={["top", "bottom"]}
        style={[`,
);

source = source.replaceAll(
  `<SafeAreaView
      style={[`,
  `<SafeAreaView
      edges={["top", "bottom"]}
      style={[`,
);

// Avoid duplicate edges if the installer is run more than once.
source = source.replaceAll(
  `edges={["top", "bottom"]}
        edges={["top", "bottom"]}`,
  `edges={["top", "bottom"]}`,
);

source = source.replaceAll(
  `edges={["top", "bottom"]}
      edges={["top", "bottom"]}`,
  `edges={["top", "bottom"]}`,
);

// Replace only the viewer header's back icon.
const closeLabelIndex = source.indexOf(
  'accessibilityLabel="Close lease viewer"',
);

if (closeLabelIndex < 0) {
  fail("Could not locate the lease viewer Close button.");
}

const iconSearchStart = source.indexOf(
  "<Ionicons",
  closeLabelIndex,
);

const iconSearchEnd = source.indexOf(
  "/>",
  iconSearchStart,
);

if (iconSearchStart < 0 || iconSearchEnd < 0) {
  fail("Could not locate the Close button icon.");
}

let iconBlock = source.slice(
  iconSearchStart,
  iconSearchEnd + 2,
);

iconBlock = iconBlock.replace(
  /name="[^"]+"/,
  'name="close"',
);

source =
  source.slice(0, iconSearchStart) +
  iconBlock +
  source.slice(iconSearchEnd + 2);

// Ensure the Close action exits the viewer.
const buttonStart = source.lastIndexOf(
  "<Pressable",
  closeLabelIndex,
);
const buttonEnd = source.indexOf(
  "</Pressable>",
  closeLabelIndex,
);

if (buttonStart < 0 || buttonEnd < 0) {
  fail("Could not locate the full Close button.");
}

let buttonBlock = source.slice(
  buttonStart,
  buttonEnd + "</Pressable>".length,
);

buttonBlock = buttonBlock.replace(
  /onPress=\{\(\)\s*=>\s*router\.(?:back|dismiss)\(\)\}/,
  "onPress={() => router.back()}",
);

source =
  source.slice(0, buttonStart) +
  buttonBlock +
  source.slice(buttonEnd + "</Pressable>".length);

if (
  source.includes(
    'SafeAreaView,\n} from "react-native";',
  )
) {
  fail("SafeAreaView is still imported from react-native.");
}

if (
  !source.includes(
    'import { SafeAreaView } from "react-native-safe-area-context";',
  )
) {
  fail("The safe-area-context SafeAreaView import was not added.");
}

if (!source.includes('name="close"')) {
  fail("The Close icon was not installed.");
}

fs.writeFileSync(viewerPath, source, "utf8");

console.log(`
Nookly lease viewer safe-header patch applied.

Updated:
- app/(root)/lease-viewer.tsx

Changes:
- The viewer now uses react-native-safe-area-context.
- The header is protected from the status bar and camera cutout.
- The back arrow is now a Close icon.
- Pressing Close exits the lease viewer.

Next run:
npx tsc --noEmit
`);
