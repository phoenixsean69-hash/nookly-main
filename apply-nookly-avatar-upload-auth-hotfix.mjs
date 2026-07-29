#!/usr/bin/env node

import {
  cp,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupRoot = path.join(
  root,
  ".nookly-backups",
  `avatar-upload-auth-${timestamp}`,
);

const files = [
  "app/(auth)/sign-up.tsx",
  "lib/appwrite.ts",
];

const backupFiles = async () => {
  for (const relativePath of files) {
    const source = path.join(root, relativePath);
    const destination = path.join(backupRoot, relativePath);

    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination);
  }
};

const replaceOnce = (content, oldValue, newValue, label) => {
  const index = content.indexOf(oldValue);

  if (index < 0) {
    throw new Error(`Could not find ${label}. The file may have changed.`);
  }

  return (
    content.slice(0, index) +
    newValue +
    content.slice(index + oldValue.length)
  );
};

const replaceBetween = (
  content,
  startMarker,
  endMarker,
  replacement,
  label,
) => {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker, start + startMarker.length);

  if (start < 0 || end < 0) {
    throw new Error(`Could not find ${label}. The file may have changed.`);
  }

  return content.slice(0, start) + replacement + content.slice(end);
};

const patchAppwrite = async () => {
  const relativePath = "lib/appwrite.ts";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  content = replaceOnce(
    content,
    '  platform: "com.tekto99.rentify",',
    '  platform: "com.shon1123.Nookly",',
    "old Appwrite platform identifier",
  );

  const newUploadFunction = `export async function uploadImage(image: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}) {
  if (!image?.uri) {
    throw new Error("The selected image is unavailable.");
  }

  if (!config.bucketId) {
    throw new Error("The Appwrite storage bucket is not configured.");
  }

  try {
    const compressedImage = await ImageManipulator.manipulateAsync(
      image.uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.7,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );

    const localFile = new ExpoFile(compressedImage.uri);
    const fileSize = Number(localFile.size || image.fileSize || 0);

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      throw new Error("Could not determine the selected image size.");
    }

    const fileName =
      image.fileName?.trim() || \`avatar-\${Date.now()}.jpg\`;

    const uploadedFile = await storage.createFile(
      config.bucketId,
      ID.unique(),
      {
        uri: compressedImage.uri,
        name: fileName.toLowerCase().endsWith(".jpg")
          ? fileName
          : \`\${fileName.replace(/\\.[^.]+$/, "")}.jpg\`,
        type: "image/jpeg",
        size: fileSize,
      },
    );

    return storage
      .getFileView(config.bucketId, uploadedFile.$id)
      .toString();
  } catch (error) {
    console.error("Error in uploadImage:", error);
    throw error;
  }
}

`;

  content = replaceBetween(
    content,
    "export async function uploadImage(image: any) {",
    "export async function uploadVideo(",
    newUploadFunction,
    "uploadImage function",
  );

  await writeFile(filePath, content, "utf8");
  console.log("✓ Fixed Appwrite Android platform and image upload helper");
};

const patchSignUp = async () => {
  const relativePath = "app/(auth)/sign-up.tsx";
  const filePath = path.join(root, relativePath);
  let content = await readFile(filePath, "utf8");

  const replacement = `  const handleSignUp = async () => {
    setErrorMessage("");
    const errors = validateForm();

    if (errors.length > 0) {
      showValidationErrors(errors);
      return;
    }

    setIsLoading(true);

    try {
      // Create the account and authenticated session first. A private Appwrite
      // bucket should never need public/guest CREATE permission for signup.
      const signupResult = await signUp({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        phone: formData.phone.trim(),
        userMode: formData.userMode as PrimaryUserMode,
        tenantType:
          formData.userMode === "tenant" && formData.tenantType
            ? formData.tenantType
            : undefined,
        schoolLocation:
          formData.userMode === "tenant" &&
          formData.tenantType === "student"
            ? formData.schoolLocation.trim()
            : undefined,
        avatar: undefined,
      });

      if (!signupResult.success) {
        throw new Error(
          signupResult.error || "Could not create your account.",
        );
      }

      // Upload the optional avatar only after Appwrite has created the session.
      // Failure here must not roll back an otherwise valid account.
      if (formData.avatar) {
        setUploadingAvatar(true);

        try {
          const uploadedAvatarUrl = await uploadImage({
            uri: formData.avatar,
            fileName: \`avatar_\${Date.now()}.jpg\`,
            mimeType: "image/jpeg",
          });

          const avatarUpdateResult =
            await useAuthStore.getState().updateUser({
              avatar: uploadedAvatarUrl,
            });

          if (!avatarUpdateResult.success) {
            console.warn(
              "Account created, but avatar profile update failed:",
              avatarUpdateResult.error,
            );
          }
        } catch (avatarError) {
          console.warn(
            "Account created with the default avatar because upload failed:",
            avatarError,
          );
        } finally {
          setUploadingAvatar(false);
        }
      }

      const destinationUser: Record<string, unknown> = {
        userMode: formData.userMode,
        ...(formData.userMode === "tenant" && formData.tenantType
          ? { tenantType: formData.tenantType }
          : {}),
        ...(formData.userMode === "tenant" &&
        formData.tenantType === "student"
          ? { schoolLocation: formData.schoolLocation.trim() }
          : {}),
      };

      setShowSuccess(true);

      setTimeout(() => {
        router.replace(getUserHomeRoute(destinationUser as any) as any);
      }, 850);
    } catch (error: any) {
      console.error("Sign up failed:", error);

      let message = error?.message || "Could not create your account.";

      if (message.toLowerCase().includes("already exists")) {
        message = "This email is already registered. Sign in instead.";
      }

      setErrorMessage(message);
      setErrorModalVisible(true);
    } finally {
      setIsLoading(false);
      setUploadingAvatar(false);
    }
  };

`;

  content = replaceBetween(
    content,
    "  const handleSignUp = async () => {",
    "  return (",
    replacement,
    "sign-up submission flow",
  );

  await writeFile(filePath, content, "utf8");
  console.log("✓ Moved avatar upload after authenticated signup");
};

const main = async () => {
  console.log("\nInstalling Nookly avatar upload auth hotfix...\n");

  await backupFiles();
  console.log(`✓ Backup created: ${path.relative(root, backupRoot)}`);

  await patchAppwrite();
  await patchSignUp();

  console.log("\n✓ Avatar upload hotfix installed.");
  console.log("\nNext verification command:");
  console.log(
    'npx eslint "app/(auth)/sign-up.tsx" "lib/appwrite.ts"',
  );
};

main().catch((error) => {
  console.error("\n✗ Avatar upload auth hotfix failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
