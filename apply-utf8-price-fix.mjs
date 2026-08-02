import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const landlordRequestsPath = path.join(
  root,
  "app",
  "(root)",
  "(landlord)",
  "Landrequests.tsx",
);

if (!fs.existsSync(landlordRequestsPath)) {
  throw new Error(
    `File not found: ${landlordRequestsPath}\nRun this script from the Nookly project root.`,
  );
}

const sourceRoots = [
  "app",
  "components",
  "constants",
  "hooks",
  "lib",
  "services",
  "store",
  "utils",
];

const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const cp1252ExtraBytes = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

const charToWindows1252Byte = (character) => {
  if (cp1252ExtraBytes.has(character)) {
    return cp1252ExtraBytes.get(character);
  }

  const codePoint = character.codePointAt(0);

  if (codePoint >= 0 && codePoint <= 0xff) {
    return codePoint;
  }

  return null;
};

const decodeMojibakeGroup = (group) => {
  const bytes = [];

  for (const character of group) {
    const byte = charToWindows1252Byte(character);

    if (byte === null) {
      return group;
    }

    bytes.push(byte);
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return group;
  }
};

const repairMojibake = (input) => {
  let output = input;

  // Four-byte UTF-8 emoji usually becomes four Windows-1252 characters
  // starting with ð. Three-byte symbols usually start with â or ï.
  for (let pass = 0; pass < 3; pass += 1) {
    const repaired = output.replace(
      /ð[^\r\n]{3}|â[^\r\n]{2}|ï[^\r\n]{2}/g,
      decodeMojibakeGroup,
    );

    if (repaired === output) break;
    output = repaired;
  }

  return output;
};

const walkSourceFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];

  const results = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".expo" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      results.push(...walkSourceFiles(fullPath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (entry.name.endsWith(".bak")) continue;
    if (entry.name.includes(".step") && entry.name.endsWith(".bak")) continue;

    if (sourceExtensions.has(path.extname(entry.name))) {
      results.push(fullPath);
    }
  }

  return results;
};

const originalLandlordRequests = fs.readFileSync(
  landlordRequestsPath,
  "utf8",
);

let landlordRequests = originalLandlordRequests;

// ===========================================================================
// PROPOSED PRICE FIX
// ===========================================================================

if (!landlordRequests.includes("const parseRequestPrice =")) {
  const insertionMarker =
    '  const isLandlord = user?.userMode === "landlord";';

  if (!landlordRequests.includes(insertionMarker)) {
    throw new Error(
      "Could not locate the Landlord Requests user-mode marker. No files were written.",
    );
  }

  const priceHelpers = `${insertionMarker}

  const parseRequestPrice = (value: unknown): number | undefined => {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.replace(/[^0-9.-]/g, "").trim();

    if (!normalized) {
      return undefined;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const formatMonthlyPrice = (value: unknown): string => {
    const price = parseRequestPrice(value);

    return price === undefined
      ? "Price unavailable"
      : \`$\${price.toLocaleString()}/month\`;
  };`;

  landlordRequests = landlordRequests.replace(
    insertionMarker,
    priceHelpers,
  );
}

if (!landlordRequests.includes("const propertiesById = new Map(")) {
  const propertyIdsPattern =
    /(\s+const propertyIds = properties\.documents\.map\(\(p\) => p\.\$id\);\s*)/;

  if (!propertyIdsPattern.test(landlordRequests)) {
    throw new Error(
      "Could not locate propertyIds in Landlord Requests. No files were written.",
    );
  }

  landlordRequests = landlordRequests.replace(
    propertyIdsPattern,
    `$1
      const propertiesById = new Map(
        properties.documents.map((propertyDocument) => [
          String(propertyDocument.$id),
          propertyDocument,
        ]),
      );
`,
  );
}

if (!landlordRequests.includes("const propertyDocument = propertiesById.get(")) {
  const returnMarker = `          return {
            $id: doc.$id,`;

  if (!landlordRequests.includes(returnMarker)) {
    throw new Error(
      "Could not locate the formatted request return block. No files were written.",
    );
  }

  const normalizedPriceBlock = `          const propertyDocument = propertiesById.get(
            String(doc.propertyId || ""),
          );

          const propertyPrice = parseRequestPrice(
            propertyDocument?.price,
          );

          const originalPrice =
            parseRequestPrice(doc.originalPrice) ??
            propertyPrice;

          const proposedPrice =
            parseRequestPrice(doc.proposedPrice) ??
            originalPrice;

          return {
            $id: doc.$id,`;

  landlordRequests = landlordRequests.replace(
    returnMarker,
    normalizedPriceBlock,
  );
}

landlordRequests = landlordRequests.replace(
  /proposedPrice:\s*doc\.proposedPrice,\s*originalPrice:\s*doc\.originalPrice,/,
  `proposedPrice,
            originalPrice,`,
);

landlordRequests = landlordRequests.replace(
  /const hasNegotiatedPrice =\s*selectedRequest\.proposedPrice &&\s*selectedRequest\.proposedPrice !== selectedRequest\.originalPrice;/,
  `const hasNegotiatedPrice =
      selectedRequest.proposedPrice !== undefined &&
      selectedRequest.originalPrice !== undefined &&
      selectedRequest.proposedPrice !== selectedRequest.originalPrice;`,
);

landlordRequests = landlordRequests.replace(
  /const hasNegotiatedPrice =\s*item\.proposedPrice && item\.proposedPrice !== item\.originalPrice;/,
  `const hasNegotiatedPrice =
              item.proposedPrice !== undefined &&
              item.originalPrice !== undefined &&
              item.proposedPrice !== item.originalPrice;`,
);

landlordRequests = landlordRequests.replace(
  /\$\{selectedRequest\.originalPrice\}\/month/g,
  `{formatMonthlyPrice(selectedRequest.originalPrice)}`,
);

landlordRequests = landlordRequests.replace(
  /\$\s*\{selectedRequest\.proposedPrice \|\|\s*selectedRequest\.originalPrice\}\s*\/month/g,
  `{formatMonthlyPrice(
                      selectedRequest.proposedPrice ??
                        selectedRequest.originalPrice,
                    )}`,
);

landlordRequests = landlordRequests.replace(
  /\$\{item\.proposedPrice \|\| item\.originalPrice\}\/month/g,
  `{formatMonthlyPrice(
                          item.proposedPrice ?? item.originalPrice,
                        )}`,
);

// A second tolerant pass for formatting variants.
landlordRequests = landlordRequests.replace(
  /\$\s*\{item\.proposedPrice\s*\|\|\s*item\.originalPrice\}\s*\/month/g,
  `{formatMonthlyPrice(
                          item.proposedPrice ?? item.originalPrice,
                        )}`,
);

// ===========================================================================
// UTF-8 MOJIBAKE CLEANUP
// ===========================================================================

landlordRequests = repairMojibake(landlordRequests);

const sourceFiles = Array.from(
  new Set(
    sourceRoots.flatMap((relativeRoot) =>
      walkSourceFiles(path.join(root, relativeRoot)),
    ),
  ),
);

const pendingWrites = new Map();
const changedUtf8Files = [];

for (const filePath of sourceFiles) {
  const original =
    filePath === landlordRequestsPath
      ? originalLandlordRequests
      : fs.readFileSync(filePath, "utf8");

  const baseText =
    filePath === landlordRequestsPath
      ? landlordRequests
      : original;

  const repaired = repairMojibake(baseText);

  if (repaired !== original) {
    pendingWrites.set(filePath, repaired);

    if (repairMojibake(original) !== original) {
      changedUtf8Files.push(
        path.relative(root, filePath),
      );
    }
  }
}

if (!pendingWrites.has(landlordRequestsPath)) {
  pendingWrites.set(landlordRequestsPath, landlordRequests);
}

// ===========================================================================
// VALIDATION
// ===========================================================================

const finalLandlordRequests =
  pendingWrites.get(landlordRequestsPath) ?? landlordRequests;

if (!finalLandlordRequests.includes("const parseRequestPrice =")) {
  throw new Error(
    "Validation failed: request price parser is missing.",
  );
}

if (!finalLandlordRequests.includes("const propertiesById = new Map(")) {
  throw new Error(
    "Validation failed: property-price fallback map is missing.",
  );
}

if (
  !finalLandlordRequests.includes(
    "parseRequestPrice(doc.proposedPrice) ??",
  )
) {
  throw new Error(
    "Validation failed: proposed-price normalization is missing.",
  );
}

if (
  finalLandlordRequests.includes(
    "${item.proposedPrice || item.originalPrice}/month",
  ) ||
  finalLandlordRequests.includes(
    "${selectedRequest.originalPrice}/month",
  )
) {
  throw new Error(
    "Validation failed: unsafe price rendering still exists.",
  );
}

if (!finalLandlordRequests.includes("formatMonthlyPrice(")) {
  throw new Error(
    "Validation failed: safe price formatter is missing.",
  );
}

for (const [filePath, content] of pendingWrites) {
  const remainingBrokenGroups = content.match(
    /ð[^\r\n]{3}|â[^\r\n]{2}|ï[^\r\n]{2}/g,
  );

  if (remainingBrokenGroups?.some(
    (group) => decodeMojibakeGroup(group) !== group,
  )) {
    throw new Error(
      `Validation failed: repairable mojibake remains in ${path.relative(
        root,
        filePath,
      )}.`,
    );
  }
}

// ===========================================================================
// BACKUP AND WRITE ONLY AFTER VALIDATION
// ===========================================================================

for (const [filePath, content] of pendingWrites) {
  fs.copyFileSync(
    filePath,
    `${filePath}.utf8-price-fix.bak`,
  );

  fs.writeFileSync(filePath, content, "utf8");
}

console.log("");
console.log("UTF-8 and landlord request price fix applied successfully.");
console.log("");
console.log(
  `Updated ${pendingWrites.size} active source file(s).`,
);
console.log(
  `Cleaned visible/log mojibake in ${changedUtf8Files.length} file(s).`,
);
console.log("");
console.log("Landlord Requests now:");
console.log("- normalizes number and string price values");
console.log("- falls back to the property's current price");
console.log("- shows 'Price unavailable' instead of '$/month'");
console.log("- formats valid prices as $1,000/month");
console.log("");
console.log("Now run: npx tsc --noEmit");
