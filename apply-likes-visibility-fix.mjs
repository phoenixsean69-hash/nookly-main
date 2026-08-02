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
// 1. Replace the compact type/rating group with a visible engagement group
//    that includes a tappable Like control and current like count.
// ---------------------------------------------------------------------------
const summaryPattern =
  /<View className="flex flex-row items-center gap-3">\s*<View className="flex flex-row items-center px-4 py-2 bg-primary-100 rounded-full">\s*<Text className="text-xs font-rubik-bold text-primary-300">\s*\{property\.type\}\s*<\/Text>\s*<\/View>\s*<Image source=\{icons\.star\} className="size-3\.5" \/>\s*<Text className="text-black-200 text-sm mt-1 font-rubik-medium">\s*\{avgRating\}\s*<\/Text>\s*<\/View>/m;

const summaryReplacement = `<View className="flex-row items-center flex-wrap gap-2 flex-1">
              <View className="flex-row items-center px-3 py-2 bg-primary-100 rounded-full">
                <Text className="text-xs font-rubik-bold text-primary-300">
                  {property.type}
                </Text>
              </View>

              <View
                className="flex-row items-center px-3 py-2 rounded-full"
                style={{ backgroundColor: theme.surface }}
              >
                <Ionicons name="star" size={17} color="#FACC15" />
                <Text
                  className="text-sm font-rubik-bold ml-1"
                  style={{ color: theme.text }}
                >
                  {avgRating}
                </Text>
              </View>

              <TouchableOpacity
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
                    ? \`Unlike property. \${likeCount} likes\`
                    : \`Like property. \${likeCount} likes\`
                }
                accessibilityState={{ selected: liked }}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={20}
                  color={liked ? "#EC4899" : theme.muted}
                />
                <Text
                  className="text-sm font-rubik-bold ml-1.5"
                  style={{
                    color: liked ? "#EC4899" : theme.text,
                  }}
                >
                  {likeCount}
                </Text>
              </TouchableOpacity>
            </View>`;

if (!summaryPattern.test(updated)) {
  throw new Error(
    "Could not locate the tenant property type/rating summary. No changes were written.",
  );
}

updated = updated.replace(summaryPattern, summaryReplacement);

// ---------------------------------------------------------------------------
// 2. Remove the old Like button from the absolute bottom bar.
//    Save remains there; Likes now stay visible in the main content.
// ---------------------------------------------------------------------------
const oldBottomLikePattern =
  /<TouchableOpacity\s+onPress=\{handleLike\}\s+className="flex-row items-center bg-gray-100 px-3 py-2 rounded-full"\s*>\s*<Image\s+source=\{liked \? icons\.like : icons\.like\}\s+className="size-5 mr-1"\s+style=\{\{ tintColor: liked \? "#ff69b4" : "#666" \}\}\s*\/>\s*<Text\s+className=\{`text-base font-rubik-bold \$\{liked \? "text-pink-500" : "text-gray-600"\}`\}\s*>\s*\{likeCount\}\s*<\/Text>\s*<\/TouchableOpacity>\s*/m;

if (!oldBottomLikePattern.test(updated)) {
  throw new Error(
    "Could not locate the old bottom Like control. No changes were written.",
  );
}

updated = updated.replace(oldBottomLikePattern, "");

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
if (updated === original) {
  throw new Error("No changes were made.");
}

const handleLikeUsageCount =
  (updated.match(/onPress=\{handleLike\}/g) || []).length;

if (handleLikeUsageCount !== 1) {
  throw new Error(
    `Validation failed: expected exactly one visible Like control, found ${handleLikeUsageCount}.`,
  );
}

if (!updated.includes('name={liked ? "heart" : "heart-outline"}')) {
  throw new Error(
    "Validation failed: visible Like icon is missing.",
  );
}

if (!updated.includes("{likeCount}")) {
  throw new Error(
    "Validation failed: visible Like count is missing.",
  );
}

if (
  updated.includes(
    'className="flex-row items-center bg-gray-100 px-3 py-2 rounded-full"',
  )
) {
  throw new Error(
    "Validation failed: old bottom Like control still exists.",
  );
}

const backupPath = `${targetPath}.likes-visibility-fix.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Property Likes visibility fix applied successfully.");
console.log("Updated: app/(root)/properties/[id].tsx");
console.log("Backup: [id].tsx.likes-visibility-fix.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
