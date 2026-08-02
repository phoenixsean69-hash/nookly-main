import fs from "node:fs";
import path from "node:path";

const targetPath = path.join(
  process.cwd(),
  "app",
  "(root)",
  "(tabs)",
  "profile.tsx",
);

if (!fs.existsSync(targetPath)) {
  throw new Error(
    `File not found: ${targetPath}\n` +
      "Run this script from the Nookly project root.",
  );
}

const original = fs.readFileSync(targetPath, "utf8");
let updated = original;

const replaceRequired = (
  pattern,
  replacement,
  label,
) => {
  if (typeof pattern === "string") {
    if (!updated.includes(pattern)) {
      throw new Error(
        `Could not locate ${label}. No file was written.`,
      );
    }

    updated = updated.replace(pattern, replacement);
    return;
  }

  if (!pattern.test(updated)) {
    throw new Error(
      `Could not locate ${label}. No file was written.`,
    );
  }

  updated = updated.replace(pattern, replacement);
};

if (
  !updated.includes(
    'import pushFunctionService from "@/services/push-function.service";',
  )
) {
  replaceRequired(
    'import useAuthStore from "@/store/auth.store";',
    `import pushFunctionService from "@/services/push-function.service";
import useAuthStore from "@/store/auth.store";`,
    "the tenant auth-store import",
  );
}

if (!updated.includes("const [testingPush, setTestingPush]")) {
  replaceRequired(
    "  const [logoutLoading, setLogoutLoading] = useState(false);",
    `  const [logoutLoading, setLogoutLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);`,
    "the tenant logout loading state",
  );
}

if (!updated.includes("const handleTestPush = async () =>")) {
  replaceRequired(
    "  // Logout\n  const handleLogout = async () => {",
    `  const handleTestPush = async () => {
    if (!user?.accountId) {
      Alert.alert(
        "Push Test",
        "No authenticated user is available.",
      );
      return;
    }

    setTestingPush(true);

    try {
      const result =
        await pushFunctionService.testCurrentUser();

      const requested = Number(
        result.requested ?? 0,
      );
      const accepted = Number(
        result.accepted ?? 0,
      );
      const failed = Number(
        result.failed ?? 0,
      );

      if (accepted > 0) {
        Alert.alert(
          "Test Push Accepted",
          \`Expo accepted \${accepted} of \${requested || accepted} push ticket(s). Failed: \${failed}. Watch this device for the notification.\`,
        );
        return;
      }

      Alert.alert(
        "Test Push Failed",
        result.message ||
          \`No push ticket was accepted. Requested: \${requested}. Failed: \${failed}.\`,
      );
    } catch (error) {
      console.error(
        "Tenant test push error:",
        error,
      );

      Alert.alert(
        "Test Push Error",
        error instanceof Error
          ? error.message
          : "Could not send the test push.",
      );
    } finally {
      setTestingPush(false);
    }
  };

  // Logout
  const handleLogout = async () => {`,
    "the tenant logout handler marker",
  );
}

if (!updated.includes("{/* Push Delivery Test */}")) {
  replaceRequired(
    `        {/* Logout Button */}
        <TouchableOpacity`,
    `        {/* Push Delivery Test */}
        <TouchableOpacity
          onPress={handleTestPush}
          disabled={testingPush}
          className="flex-row items-center justify-center mb-4 py-4 rounded-2xl"
          style={{
            backgroundColor: theme.primary[300] + "18",
            borderWidth: 1,
            borderColor: theme.primary[300] + "55",
            opacity: testingPush ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Send test push notification"
        >
          {testingPush ? (
            <ActivityIndicator
              size="small"
              color={theme.primary[300]}
            />
          ) : (
            <>
              <Image
                source={icons.bell}
                className="w-5 h-5 mr-2"
                style={{
                  tintColor: theme.primary[300],
                }}
              />
              <Text
                className="font-rubik-medium"
                style={{
                  color: theme.primary[300],
                }}
              >
                Send Test Push
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity`,
    "the tenant Logout button marker",
  );
}

if (updated === original) {
  throw new Error("No changes were made.");
}

if (
  !updated.includes(
    "await pushFunctionService.testCurrentUser();",
  )
) {
  throw new Error(
    "Validation failed: /test is not called.",
  );
}

if (!updated.includes("Send Test Push")) {
  throw new Error(
    "Validation failed: test button is missing.",
  );
}

if (
  !updated.includes(
    "const [testingPush, setTestingPush] = useState(false);",
  )
) {
  throw new Error(
    "Validation failed: test loading state is missing.",
  );
}

if (
  updated.includes("ExponentPushToken[") ||
  updated.includes("ExpoPushToken[")
) {
  throw new Error(
    "Validation failed: a raw push token was embedded.",
  );
}

const backupPath = `${targetPath}.push-test-button.bak`;

fs.copyFileSync(targetPath, backupPath);
fs.writeFileSync(targetPath, updated, "utf8");

console.log("");
console.log("Tenant test-push button applied successfully.");
console.log("");
console.log("Updated:");
console.log("- app/(root)/(tabs)/profile.tsx");
console.log("");
console.log("Backup:");
console.log("- profile.tsx.push-test-button.bak");
console.log("");
console.log("Now run: npx tsc --noEmit");
