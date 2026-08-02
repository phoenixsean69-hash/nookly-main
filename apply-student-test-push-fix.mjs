import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const studentPath = path.join(
  root,
  "app",
  "(root)",
  "(student)",
  "s-profile.tsx",
);

const tenantPath = path.join(
  root,
  "app",
  "(root)",
  "(tabs)",
  "profile.tsx",
);

if (!fs.existsSync(studentPath)) {
  throw new Error(
    `File not found: ${studentPath}\n` +
      "Run this script from the Nookly project root.",
  );
}

const studentOriginal = fs.readFileSync(
  studentPath,
  "utf8",
);

const tenantExists = fs.existsSync(tenantPath);
const tenantOriginal = tenantExists
  ? fs.readFileSync(tenantPath, "utf8")
  : "";

let student = studentOriginal;
let tenant = tenantOriginal;

const replaceStudentRequired = (
  pattern,
  replacement,
  label,
) => {
  if (typeof pattern === "string") {
    if (!student.includes(pattern)) {
      throw new Error(
        `Could not locate ${label} in Student Profile. ` +
          "No files were written.",
      );
    }

    student = student.replace(pattern, replacement);
    return;
  }

  if (!pattern.test(student)) {
    throw new Error(
      `Could not locate ${label} in Student Profile. ` +
        "No files were written.",
    );
  }

  student = student.replace(pattern, replacement);
};

// ---------------------------------------------------------------------------
// 1. Add the secure Push Function service to Student Profile.
// ---------------------------------------------------------------------------
if (
  !student.includes(
    'import pushFunctionService from "@/services/push-function.service";',
  )
) {
  replaceStudentRequired(
    'import useAuthStore from "@/store/auth.store";',
    `import pushFunctionService from "@/services/push-function.service";
import useAuthStore from "@/store/auth.store";`,
    "the auth-store import",
  );
}

// ---------------------------------------------------------------------------
// 2. Add Student Profile test state.
// ---------------------------------------------------------------------------
if (
  !student.includes(
    "const [testingPush, setTestingPush]",
  )
) {
  replaceStudentRequired(
    "  const [logoutLoading, setLogoutLoading] = useState(false);",
    `  const [logoutLoading, setLogoutLoading] = useState(false);
  const [testingPush, setTestingPush] = useState(false);`,
    "the logout loading state",
  );
}

// ---------------------------------------------------------------------------
// 3. Add authenticated /test action.
// ---------------------------------------------------------------------------
if (
  !student.includes(
    "const handleTestPush = async () =>",
  )
) {
  replaceStudentRequired(
    "  // Logout\n  const handleLogout = async () => {",
    `  const handleTestPush = async () => {
    if (!user?.accountId) {
      Alert.alert(
        "Push Test",
        "No authenticated student account is available.",
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
        "Student test push error:",
        error,
      );

      Alert.alert(
        "Test Push Error",
        error instanceof Error
          ? error.message
          : "Could not send the student test push.",
      );
    } finally {
      setTestingPush(false);
    }
  };

  // Logout
  const handleLogout = async () => {`,
    "the Logout handler marker",
  );
}

// ---------------------------------------------------------------------------
// 4. Add the button immediately before Student Logout.
// ---------------------------------------------------------------------------
if (
  !student.includes(
    "{/* Student Push Delivery Test */}",
  )
) {
  replaceStudentRequired(
    `        {/* Logout Button */}
        <TouchableOpacity`,
    `        {/* Student Push Delivery Test */}
        <TouchableOpacity
          onPress={handleTestPush}
          disabled={testingPush}
          className="flex-row items-center justify-center mb-4 py-4 rounded-2xl"
          style={{
            backgroundColor:
              theme.primary[300] + "18",
            borderWidth: 1,
            borderColor:
              theme.primary[300] + "55",
            opacity: testingPush ? 0.7 : 1,
          }}
          accessibilityRole="button"
          accessibilityLabel="Send student test push notification"
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
                  tintColor:
                    theme.primary[300],
                }}
              />
              <Text
                className="font-rubik-medium"
                style={{
                  color:
                    theme.primary[300],
                }}
              >
                Send Test Push
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity`,
    "the Logout button",
  );
}

// ---------------------------------------------------------------------------
// 5. Remove the misplaced temporary button from Tenant Profile, if present.
// ---------------------------------------------------------------------------
if (tenantExists) {
  tenant = tenant.replace(
    'import pushFunctionService from "@/services/push-function.service";\n',
    "",
  );

  tenant = tenant.replace(
    /\s*const \[testingPush, setTestingPush\] = useState\(false\);/,
    "",
  );

  tenant = tenant.replace(
    /\n  const handleTestPush = async \(\) => \{[\s\S]*?\n  \};\n\n  \/\/ Logout\n  const handleLogout = async \(\) => \{/m,
    "\n  // Logout\n  const handleLogout = async () => {",
  );

  tenant = tenant.replace(
    /\n        \{\/\* Push Delivery Test \*\/\}[\s\S]*?\n        \{\/\* Logout Button \*\/\}\n        <TouchableOpacity/m,
    `
        {/* Logout Button */}
        <TouchableOpacity`,
  );
}

// ---------------------------------------------------------------------------
// Validation.
// ---------------------------------------------------------------------------
if (
  !student.includes(
    "await pushFunctionService.testCurrentUser();",
  )
) {
  throw new Error(
    "Validation failed: Student Profile does not call /test.",
  );
}

if (
  !student.includes(
    "{/* Student Push Delivery Test */}",
  ) ||
  !student.includes("Send Test Push")
) {
  throw new Error(
    "Validation failed: Student Profile test button is missing.",
  );
}

if (
  !student.includes(
    "const [testingPush, setTestingPush] = useState(false);",
  )
) {
  throw new Error(
    "Validation failed: Student Profile loading state is missing.",
  );
}

if (
  student.includes("ExponentPushToken[") ||
  student.includes("ExpoPushToken[")
) {
  throw new Error(
    "Validation failed: a raw push token was embedded.",
  );
}

if (
  tenantExists &&
  tenant.includes(
    "{/* Push Delivery Test */}",
  )
) {
  throw new Error(
    "Validation failed: misplaced Tenant Profile test button remains.",
  );
}

if (
  student === studentOriginal &&
  tenant === tenantOriginal
) {
  throw new Error("No changes were made.");
}

// ---------------------------------------------------------------------------
// Back up and write only after validation.
// ---------------------------------------------------------------------------
fs.copyFileSync(
  studentPath,
  `${studentPath}.student-push-test-fix.bak`,
);

fs.writeFileSync(
  studentPath,
  student,
  "utf8",
);

if (
  tenantExists &&
  tenant !== tenantOriginal
) {
  fs.copyFileSync(
    tenantPath,
    `${tenantPath}.remove-tenant-push-test.bak`,
  );

  fs.writeFileSync(
    tenantPath,
    tenant,
    "utf8",
  );
}

console.log("");
console.log("Student test-push correction applied.");
console.log("");
console.log("Updated:");
console.log("- app/(root)/(student)/s-profile.tsx");

if (
  tenantExists &&
  tenant !== tenantOriginal
) {
  console.log(
    "- app/(root)/(tabs)/profile.tsx " +
      "(removed misplaced temporary button)",
  );
}

console.log("");
console.log("Now run: npx tsc --noEmit");
