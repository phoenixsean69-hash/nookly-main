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

const ratingStarsPattern =
  /<View className="flex flex-row gap-3 mt-3">\s*\{\[1,\s*2,\s*3,\s*4,\s*5\]\.map\(\(star\)\s*=>\s*\(\s*<TouchableOpacity\s+key=\{star\}\s+onPress=\{\(\)\s*=>\s*setRating\(star\)\}\s*>[\s\S]*?<\/TouchableOpacity>\s*\)\)\}\s*<\/View>/m;

const replacement = `<View className="flex-row items-center gap-2 mt-3">
              {[1, 2, 3, 4, 5].map((star) => {
                const selected = rating >= star;

                return (
                  <TouchableOpacity
                    key={\`review-star-\${star}\`}
                    onPress={() => setRating(star)}
                    activeOpacity={0.7}
                    className="w-11 h-11 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: selected
                        ? "rgba(250, 204, 21, 0.14)"
                        : theme.surface,
                      borderWidth: 1,
                      borderColor: selected
                        ? "#FACC15"
                        : \`\${theme.muted}35\`,
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={\`Rate \${star} star\${star === 1 ? "" : "s"}\`}
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? "star" : "star-outline"}
                      size={28}
                      color={selected ? "#FACC15" : theme.muted}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>`;

if (!ratingStarsPattern.test(original)) {
  throw new Error(
    "Could not locate the existing review-star selector. No changes were written.",
  );
}

const updated = original.replace(ratingStarsPattern, replacement);

if (updated === original) {
  throw new Error("No changes were made.");
}

if (updated.includes(">\n                    ★\n")) {
  throw new Error("Validation failed: the raw Unicode review star still exists.");
}

if (!updated.includes('name={selected ? "star" : "star-outline"}')) {
  throw new Error("Validation failed: Ionicons review stars are missing.");
}

if (!updated.includes("onPress={() => setRating(star)}")) {
  throw new Error("Validation failed: tappable rating behavior is missing.");
}

const backupPath = `${targetPath}.review-stars-fix.bak`;
fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Review stars restored successfully.");
console.log("Updated: app/(root)/properties/[id].tsx");
console.log("Backup: [id].tsx.review-stars-fix.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
