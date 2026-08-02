import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "components",
  "Cards.tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\nRun this script from the Nookly project root.`,
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

// ---------------------------------------------------------------------------
// 1. Add Expo Image, which supports memory + disk caching.
// ---------------------------------------------------------------------------
if (!updated.includes('from "expo-image"')) {
  const importMarker =
    'import { LinearGradient } from "expo-linear-gradient";';

  if (!updated.includes(importMarker)) {
    throw new Error(
      "Could not locate the LinearGradient import. No changes were written.",
    );
  }

  updated = updated.replace(
    importMarker,
    `${importMarker}
import { Image as ExpoImage } from "expo-image";`,
  );
}

// ---------------------------------------------------------------------------
// 2. Replace the complete shared PropertyImage renderer.
//    This affects both Card and FeaturedCard.
// ---------------------------------------------------------------------------
const propertyImageStart = updated.indexOf("const PropertyImage");
const featuredCardStart = updated.indexOf("export const FeaturedCard");

if (
  propertyImageStart < 0 ||
  featuredCardStart < 0 ||
  featuredCardStart <= propertyImageStart
) {
  throw new Error(
    "Could not locate the shared PropertyImage block. No changes were written.",
  );
}

const cachedPropertyImage = `const PropertyImage = React.memo(
  ({
    uri,
    className,
  }: {
    uri: string;
    className: string;
  }) => (
    <View
      className={\`\${className} overflow-hidden bg-gray-200\`}
    >
      {/* Always-visible static placeholder: never show an image spinner. */}
      <View className="absolute inset-0 items-center justify-center">
        <Image
          source={icons.home}
          className="h-10 w-10 opacity-30"
          resizeMode="contain"
        />
      </View>

      {uri ? (
        <ExpoImage
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          contentPosition="center"
          cachePolicy="memory-disk"
          recyclingKey={uri}
          transition={0}
          accessibilityLabel="Property image"
        />
      ) : null}
    </View>
  ),
);

PropertyImage.displayName = "PropertyImage";

`;

updated =
  updated.slice(0, propertyImageStart) +
  cachedPropertyImage +
  updated.slice(featuredCardStart);

// ---------------------------------------------------------------------------
// 3. Remove obsolete spinner imports left by any local card variant.
// ---------------------------------------------------------------------------
updated = updated.replace(
  /^(\s*)ActivityIndicator,\s*$/gm,
  "",
);

// Remove React hooks only when the updated file no longer uses them.
if (!updated.includes("useState(")) {
  updated = updated.replace(
    /import React,\s*\{\s*useState\s*\}\s*from "react";/,
    'import React from "react";',
  );
}

if (!updated.includes("useEffect(")) {
  updated = updated.replace(
    /import React,\s*\{\s*useEffect\s*\}\s*from "react";/,
    'import React from "react";',
  );
}

if (
  !updated.includes("useState(") &&
  !updated.includes("useEffect(")
) {
  updated = updated.replace(
    /import React,\s*\{\s*useEffect,\s*useState\s*\}\s*from "react";/,
    'import React from "react";',
  );

  updated = updated.replace(
    /import React,\s*\{\s*useState,\s*useEffect\s*\}\s*from "react";/,
    'import React from "react";',
  );
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (updated === original) {
  throw new Error("No changes were made.");
}

if (!updated.includes('cachePolicy="memory-disk"')) {
  throw new Error(
    "Validation failed: memory/disk image caching is missing.",
  );
}

if (!updated.includes("transition={0}")) {
  throw new Error(
    "Validation failed: zero-transition rendering is missing.",
  );
}

if (!updated.includes('source={icons.home}')) {
  throw new Error(
    "Validation failed: static card placeholder is missing.",
  );
}

if (updated.includes("<ActivityIndicator")) {
  throw new Error(
    "Validation failed: a property-card ActivityIndicator still exists.",
  );
}

const propertyImageCount =
  (updated.match(/const PropertyImage/g) || []).length;

if (propertyImageCount !== 1) {
  throw new Error(
    `Validation failed: expected one PropertyImage renderer, found ${propertyImageCount}.`,
  );
}

if (
  !updated.includes(
    '<PropertyImage uri={imageUri} className="h-full w-full rounded-2xl" />',
  ) ||
  !updated.includes(
    '<PropertyImage uri={imageUri} className="h-40 w-full rounded-lg" />',
  )
) {
  throw new Error(
    "Validation failed: FeaturedCard and Card are not both using PropertyImage.",
  );
}

const backupPath = `${targetPath}.step10.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Step 10 applied successfully.");
console.log("Updated: components/Cards.tsx");
console.log("Backup: components/Cards.tsx.step10.bak");
console.log("");
console.log("Property cards now use memory + disk image caching.");
console.log("No card image loading spinner is rendered.");
console.log("Now run: npx tsc --noEmit");
