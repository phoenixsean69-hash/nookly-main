import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "app",
  "(root)",
  "properties",
  "[id].tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\nRun this script from the Nookly project root.`,
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

// ---------------------------------------------------------------------------
// 1. Undo the incorrect heart button inside the property summary, if present.
// ---------------------------------------------------------------------------
const incorrectSummaryLikePattern =
  /\s*<TouchableOpacity\s+onPress=\{handleLike\}\s+activeOpacity=\{0\.75\}\s+className="flex-row items-center px-3 py-2 rounded-full"[\s\S]*?<\/TouchableOpacity>/m;

updated = updated.replace(incorrectSummaryLikePattern, "");

// ---------------------------------------------------------------------------
// 2. Remove any existing bottom Like control so we can restore one exact,
//    consistent version beside Save.
// ---------------------------------------------------------------------------
const oldBottomLikePatterns = [
  /<TouchableOpacity\s+onPress=\{handleLike\}\s+className="flex-row items-center bg-gray-100 px-3 py-2 rounded-full"\s*>[\s\S]*?<\/TouchableOpacity>\s*/m,
  /<TouchableOpacity\s+onPress=\{handleLike\}[\s\S]*?accessibilityLabel=\{[\s\S]*?\}[\s\S]*?<\/TouchableOpacity>\s*/m,
];

for (const pattern of oldBottomLikePatterns) {
  updated = updated.replace(pattern, "");
}

// ---------------------------------------------------------------------------
// 3. Insert the original-style thumb Like button immediately before Save.
// ---------------------------------------------------------------------------
const saveButtonMarker = `              <TouchableOpacity
                onPress={handleFavoriteToggle}`;

if (!updated.includes(saveButtonMarker)) {
  throw new Error(
    "Could not locate the Save button in the bottom action bar. No changes were written.",
  );
}

const restoredLikeButton = `              <TouchableOpacity
                onPress={handleLike}
                activeOpacity={0.75}
                className="flex-row items-center px-3 py-2 rounded-full"
                style={{
                  backgroundColor: liked
                    ? "rgba(236, 72, 153, 0.14)"
                    : theme.surface,
                  borderWidth: 1,
                  borderColor: liked
                    ? "#EC4899"
                    : \`\${theme.muted}35\`,
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  liked
                    ? \`Unlike property. \${likeCount} total likes\`
                    : \`Like property. \${likeCount} total likes\`
                }
                accessibilityState={{ selected: liked }}
              >
                <Image
                  source={icons.like}
                  className="size-5 mr-1.5"
                  style={{
                    tintColor: liked ? "#EC4899" : "#6B7280",
                  }}
                />
                <Text
                  className="text-base font-rubik-bold"
                  style={{
                    color: liked ? "#EC4899" : "#6B7280",
                  }}
                >
                  {likeCount}
                </Text>
              </TouchableOpacity>

`;

updated = updated.replace(
  saveButtonMarker,
  restoredLikeButton + saveButtonMarker,
);

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (updated === original) {
  throw new Error("No changes were made.");
}

const likeButtonCount =
  (updated.match(/onPress=\{handleLike\}/g) || []).length;

if (likeButtonCount !== 1) {
  throw new Error(
    `Validation failed: expected exactly one Like button, found ${likeButtonCount}.`,
  );
}

const saveIndex = updated.indexOf("onPress={handleFavoriteToggle}");
const likeIndex = updated.indexOf("onPress={handleLike}");

if (likeIndex < 0 || saveIndex < 0 || likeIndex > saveIndex) {
  throw new Error(
    "Validation failed: Like button is not positioned before Save.",
  );
}

if (!updated.includes("source={icons.like}")) {
  throw new Error(
    "Validation failed: thumb Like icon is missing.",
  );
}

if (!updated.includes('tintColor: liked ? "#EC4899" : "#6B7280"')) {
  throw new Error(
    "Validation failed: gray/pink thumb styling is missing.",
  );
}

if (!updated.includes("{likeCount}")) {
  throw new Error(
    "Validation failed: total Like count is missing.",
  );
}

const backupPath = `${targetPath}.restore-original-like.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Original Like button restored successfully.");
console.log("Updated: app/(root)/properties/[id].tsx");
console.log("Backup: [id].tsx.restore-original-like.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
