// app/(root)/change-user-info.tsx
import ErrorModal from "@/components/ErrorModal";
import SuccessModal from "@/components/OperationSuccesfull";
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { account, logout } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface FormData {
  name: string;
  email: string;
  phone: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ChangeUserInfoScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { user, updateUser, fetchAuthenticatedUser } = useAuthStore();
  const [activeSection, setActiveSection] = useState<"profile" | "password">(
    "profile",
  );
  const [loading, setLoading] = useState(false);

  // Modal states
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [successConfig, setSuccessConfig] = useState({
    title: "",
    message: "",
  });
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorConfig, setErrorConfig] = useState({ title: "", message: "" });

  const [formData, setFormData] = useState<FormData>({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const validateProfile = (): string | null => {
    if (!formData.name.trim()) {
      return "Please enter your name";
    }
    if (!formData.email.trim()) {
      return "Please enter your email address";
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      return "Please enter a valid email address";
    }
    if (
      formData.email.trim() === user?.email &&
      formData.name === user?.name &&
      formData.phone === user?.phone
    ) {
      return "No changes to update";
    }
    return null;
  };

  const validatePassword = (): string | null => {
    if (!formData.currentPassword) {
      return "Please enter your current password";
    }
    if (!formData.newPassword) {
      return "Please enter a new password";
    }
    if (formData.newPassword.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (formData.newPassword !== formData.confirmPassword) {
      return "New passwords do not match";
    }
    if (formData.newPassword === formData.currentPassword) {
      return "New password must be different from current password";
    }
    return null;
  };

  const handleUpdateProfile = async () => {
    const validationError = validateProfile();
    if (validationError) {
      setErrorConfig({ title: "Validation Error", message: validationError });
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      const updates: any = {};
      let needsReauth = false;

      // Check if email is being changed
      if (formData.email.trim() !== user?.email) {
        if (!formData.currentPassword) {
          setErrorConfig({
            title: "Error",
            message: "Please enter your current password to change email",
          });
          setErrorModalVisible(true);
          setLoading(false);
          return;
        }
        // Update email in Appwrite Auth
        await account.updateEmail(
          formData.email.trim(),
          formData.currentPassword,
        );
        updates.email = formData.email.trim();
        needsReauth = true;
      }

      // Update name in Appwrite Auth
      if (formData.name !== user?.name) {
        await account.updateName(formData.name.trim());
        updates.name = formData.name.trim();
      }

      // Update phone in database
      if (formData.phone !== user?.phone) {
        updates.phone = formData.phone.trim();
      }

      // Update user document in database
      if (Object.keys(updates).length > 0) {
        const result = await updateUser(updates);
        if (!result.success) {
          throw new Error(result.error);
        }
      }

      // Refresh user data
      await fetchAuthenticatedUser();

      const message = needsReauth
        ? "Profile updated! Please sign in with your new email."
        : "Profile updated successfully!";

      setSuccessConfig({
        title: "Success",
        message: message,
      });
      setSuccessModalVisible(true);

      if (needsReauth) {
        setTimeout(() => {
          router.replace("/sign-in");
        }, 2000);
      }
    } catch (error: any) {
      console.error("Error updating profile:", error);
      if (error?.message?.includes("Invalid credentials")) {
        setErrorConfig({
          title: "Error",
          message: "Current password is incorrect",
        });
      } else if (error?.message?.includes("Email already exists")) {
        setErrorConfig({
          title: "Error",
          message: "This email is already in use",
        });
      } else {
        setErrorConfig({
          title: "Error",
          message: "Failed to update profile. Please try again.",
        });
      }
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    const validationError = validatePassword();
    if (validationError) {
      setErrorConfig({ title: "Validation Error", message: validationError });
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      // Directly update password using the current session
      // No need to create a new session
      await account.updatePassword(
        formData.newPassword,
        formData.currentPassword,
      );

      setSuccessConfig({
        title: "Success",
        message:
          "Password updated successfully! Please sign in with your new password.",
      });
      setSuccessModalVisible(true);

      setTimeout(async () => {
        await logout();
        router.replace("/sign-in");
      }, 2000);
    } catch (error: any) {
      console.error("Error updating password:", error);

      if (error?.message?.includes("Invalid credentials")) {
        setErrorConfig({
          title: "Error",
          message: "Current password is incorrect",
        });
      } else if (error?.message?.includes("missing scopes")) {
        // Session might be expired, redirect to login
        setErrorConfig({
          title: "Session Expired",
          message:
            "Your session has expired. Please log in again to change your password.",
        });
        setErrorModalVisible(true);
        setTimeout(async () => {
          await logout();
          router.replace("/sign-in");
        }, 2000);
      } else {
        setErrorConfig({
          title: "Error",
          message: "Failed to update password. Please try again.",
        });
        setErrorModalVisible(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderProfileSection = () => (
    <View>
      {/* Name Input */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          Full Name
        </Text>
        <TextInput
          value={formData.name}
          onChangeText={(text) => handleFieldChange("name", text)}
          placeholder="Enter your full name"
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
      </View>

      {/* Email Input */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          Email Address
        </Text>
        <TextInput
          value={formData.email}
          onChangeText={(text) => handleFieldChange("email", text)}
          placeholder="Enter your email"
          keyboardType="email-address"
          autoCapitalize="none"
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
        {formData.email !== user?.email && (
          <Text className="text-xs mt-1 text-orange-500">
            Changing email will require you to sign in again
          </Text>
        )}
      </View>

      {/* Phone Input */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          Phone Number
        </Text>
        <TextInput
          value={formData.phone}
          onChangeText={(text) => handleFieldChange("phone", text)}
          placeholder="Enter your phone number"
          keyboardType="phone-pad"
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
      </View>

      {/* Current Password Required for Email Change */}
      {formData.email !== user?.email && (
        <View className="mb-4">
          <Text
            className="text-sm font-rubik-medium mb-2"
            style={{ color: theme.muted }}
          >
            Current Password <Text className="text-red-500">*</Text>
          </Text>
          <TextInput
            value={formData.currentPassword}
            onChangeText={(text) => handleFieldChange("currentPassword", text)}
            placeholder="Enter your current password"
            secureTextEntry
            className="border rounded-lg px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "50",
              color: theme.text,
            }}
            placeholderTextColor={theme.muted}
          />
          <Text className="text-xs mt-1" style={{ color: theme.muted }}>
            Required to verify email change
          </Text>
        </View>
      )}

      {/* Update Profile Button */}
      <TouchableOpacity
        onPress={handleUpdateProfile}
        disabled={loading}
        className={`py-3 rounded-lg mt-4 ${loading ? "bg-gray-400" : "bg-primary-300"}`}
      >
        <Text className="text-white text-center font-rubik-bold">
          {loading ? "Updating..." : "Update Profile"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderPasswordSection = () => (
    <View>
      {/* Current Password */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          Current Password <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={formData.currentPassword}
          onChangeText={(text) => handleFieldChange("currentPassword", text)}
          placeholder="Enter your current password"
          secureTextEntry
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
      </View>

      {/* New Password */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          New Password <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={formData.newPassword}
          onChangeText={(text) => handleFieldChange("newPassword", text)}
          placeholder="Enter new password (min 8 characters)"
          secureTextEntry
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
      </View>

      {/* Confirm Password */}
      <View className="mb-4">
        <Text
          className="text-sm font-rubik-medium mb-2"
          style={{ color: theme.muted }}
        >
          Confirm New Password <Text className="text-red-500">*</Text>
        </Text>
        <TextInput
          value={formData.confirmPassword}
          onChangeText={(text) => handleFieldChange("confirmPassword", text)}
          placeholder="Confirm your new password"
          secureTextEntry
          className="border rounded-lg px-4 py-3"
          style={{
            backgroundColor: theme.surface,
            borderColor: theme.muted + "50",
            color: theme.text,
          }}
          placeholderTextColor={theme.muted}
        />
      </View>

      {/* Password Requirements */}
      {formData.newPassword.length > 0 && formData.newPassword.length < 8 && (
        <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <Text className="text-yellow-700 text-xs">
            Password must be at least 8 characters
          </Text>
        </View>
      )}

      {/* Update Password Button */}
      <TouchableOpacity
        onPress={handleUpdatePassword}
        disabled={loading}
        className={`py-3 rounded-lg mt-4 ${loading ? "bg-gray-400" : "bg-primary-300"}`}
      >
        <Text className="text-white text-center font-rubik-bold">
          {loading ? "Updating..." : "Update Password"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          Account Settings
        </Text>
      </View>

      {/* Tab Switcher */}
      <View className="flex-row px-5 pt-4 gap-4">
        <TouchableOpacity
          onPress={() => setActiveSection("profile")}
          className={`pb-2 ${activeSection === "profile" ? "border-b-2 border-primary-300" : ""}`}
        >
          <Text
            className={`text-base font-rubik-medium ${
              activeSection === "profile" ? "text-primary-300" : ""
            }`}
            style={{
              color:
                activeSection === "profile" ? theme.primary[300] : theme.muted,
            }}
          >
            Profile Info
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveSection("password")}
          className={`pb-2 ${activeSection === "password" ? "border-b-2 border-primary-300" : ""}`}
        >
          <Text
            className={`text-base font-rubik-medium ${
              activeSection === "password" ? "text-primary-300" : ""
            }`}
            style={{
              color:
                activeSection === "password" ? theme.primary[300] : theme.muted,
            }}
          >
            Change Password
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
        {activeSection === "profile"
          ? renderProfileSection()
          : renderPasswordSection()}
      </ScrollView>

      {/* Success Modal */}
      <SuccessModal
        visible={successModalVisible}
        onClose={() => setSuccessModalVisible(false)}
        title={successConfig.title}
        message={successConfig.message}
        autoClose={2000}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title={errorConfig.title}
        message={errorConfig.message}
        autoClose={3000}
      />
    </SafeAreaView>
  );
}
