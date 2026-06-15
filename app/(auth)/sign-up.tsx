// app/(auth)/sign-up.tsx
import CustomInput from "@/components/CustomInput";
import ErrorModal from "@/components/ErrorModal";
import OperationSuccesfull from "@/components/OperationSuccesfull";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { uploadImage } from "@/lib/appwrite";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

interface FormData {
  name: string;
  userMode: "tenant" | "landlord" | "";
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  avatar: string;
}

interface ValidationError {
  field: string;
  message: string;
}

// Function to get initials from name
const getInitials = (name: string): string => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

// Generate a consistent color based on name
const getInitialsColor = (name: string): string => {
  const colors = [
    "#3B82F6", // Blue
    "#10B981", // Green
    "#F59E0B", // Orange
    "#EF4444", // Red
    "#8B5CF6", // Purple
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const SignUp = () => {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [formData, setFormData] = useState<FormData>({
    name: "",
    userMode: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    avatar: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const { signUp, user, isAuthenticated } = useAuthStore();

  // Animation for error messages
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  // Show error with animation
  const showValidationError = (errors: ValidationError[]) => {
    setValidationErrors(errors);
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(5000),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setValidationErrors([]);
    });
  };

  // Clear a specific error
  const clearError = (field: string) => {
    setValidationErrors((prev) =>
      prev.filter((error) => error.field !== field),
    );
  };

  // Clear all errors
  const clearAllErrors = () => {
    setValidationErrors([]);
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  // Redirect when user is authenticated
  React.useEffect(() => {
    if (user && isAuthenticated) {
      if (user.userMode === "tenant") {
        router.replace("/tenantHome");
      } else if (user.userMode === "landlord") {
        router.replace("/landHome");
      }
    }
  }, [user, isAuthenticated, router]);

  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        showValidationError([
          {
            field: "avatar",
            message: "Please allow photo access to upload avatar.",
          },
        ]);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        aspect: [1, 1],
      });

      if (!result.canceled) {
        const uri = result.assets[0]?.uri;
        if (uri) {
          setFormData((prev) => ({ ...prev, avatar: uri }));
        }
      }
    } catch (error) {
      console.error("ImagePicker error:", error);
      showValidationError([
        {
          field: "avatar",
          message: "Could not open image library.",
        },
      ]);
    }
  };

  const removeAvatar = () => {
    setFormData((prev) => ({ ...prev, avatar: "" }));
  };

  const validateForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!formData.name?.trim()) {
      errors.push({ field: "name", message: "Please enter your full name" });
    }

    if (!formData.userMode) {
      errors.push({
        field: "userMode",
        message: "Please select whether you're a tenant or landlord",
      });
    }

    if (!formData.email?.trim()) {
      errors.push({ field: "email", message: "Please enter your email" });
    }

    if (!formData.phone?.trim()) {
      errors.push({
        field: "phone",
        message: "Please enter your phone number",
      });
    }

    if (!formData.password) {
      errors.push({ field: "password", message: "Please create a password" });
    }

    if (formData.password.length < 8 && formData.password.length > 0) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters",
      });
    }

    if (
      formData.password !== formData.confirmPassword &&
      formData.confirmPassword
    ) {
      errors.push({
        field: "confirmPassword",
        message: "Passwords do not match",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.push({
        field: "email",
        message: "Please enter a valid email address",
      });
    }

    return errors;
  };

  // app/(auth)/sign-up.tsx - Update handleSignUp function

  const handleSignUp = async () => {
    // Clear previous errors
    clearAllErrors();
    setErrorMessage("");

    // Validate form first - before any API calls
    const errors = validateForm();
    if (errors.length > 0) {
      showValidationError(errors);
      return;
    }

    setIsLoading(true);
    let uploadedAvatarUrl = "";

    try {
      // Upload avatar ONLY if user selected one (optional)
      if (formData.avatar) {
        setUploadingAvatar(true);
        try {
          console.log("📸 Uploading avatar...");
          uploadedAvatarUrl = await uploadImage({
            uri: formData.avatar,
            fileName: `avatar_${Date.now()}.jpg`,
            mimeType: "image/jpeg",
          });
          console.log(" Avatar uploaded:", uploadedAvatarUrl);
        } catch (uploadError: any) {
          console.error("Error uploading avatar:", uploadError);
          // Don't block signup - show warning but continue
          showValidationError([
            {
              field: "avatar",
              message:
                "Could not upload avatar. You can add one later from profile.",
            },
          ]);
        } finally {
          setUploadingAvatar(false);
        }
      }

      console.log("Attempting signup with:", formData.email);
      const result = await signUp({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        phone: formData.phone,
        userMode: formData.userMode as "tenant" | "landlord",
        avatar: uploadedAvatarUrl,
      });

      console.log("Signup result:", result);

      if (result.success) {
        setShowSuccess(true);
        // Redirect will happen after modal closes
      } else {
        setErrorMessage(result.error || "Could not create account");
        setErrorModalVisible(true);
      }
    } catch (error: any) {
      console.error("Sign up error details:", error);

      let errorMessage = "An unexpected error occurred";

      // Handle specific error messages
      if (error?.message?.includes("already exists")) {
        errorMessage =
          "This email is already registered. Please sign in instead.";
      } else if (error?.message?.includes("weak password")) {
        errorMessage =
          "Password is too weak. Use at least 8 characters with a mix of letters, numbers, and symbols.";
      } else if (error?.message?.includes("invalid email")) {
        errorMessage = "Please enter a valid email address.";
      } else if (error?.message?.includes("network")) {
        errorMessage = "Network error. Please check your internet connection.";
      } else {
        errorMessage =
          error?.message || "Failed to create account. Please try again.";
      }

      setErrorMessage(errorMessage);
      setErrorModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  // Get error for a specific field
  const getFieldError = (field: string): string | undefined => {
    const error = validationErrors.find((e) => e.field === field);
    return error ? error.message : undefined;
  };

  // Get initials for display (only show when no avatar and name exists)
  const displayInitials =
    formData.name && !formData.avatar ? getInitials(formData.name) : "";
  const initialsColor = formData.name
    ? getInitialsColor(formData.name)
    : "#3B82F6";

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View className="flex-1" style={{ backgroundColor: theme.navBackground }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
          style={{ flex: 1 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 40,
            }}
          >
            {/* House Banner */}
            <Image
              source={images.dayHouse}
              className="w-full h-96"
              resizeMode="cover"
            />

            {/* Content Container */}
            <View
              className="flex-1 px-6 pt-8 pb-8 -mt-8 rounded-t-3xl"
              style={{ backgroundColor: theme.navBackground }}
            >
              <Text
                className="text-3xl font-semibold mb-2"
                style={{ color: theme.title }}
              >
                Create account
              </Text>
              <Text className="text-base mb-8" style={{ color: theme.muted }}>
                Sign up to get started
              </Text>

              {/* Global Error Container - Shows all errors at once */}
              {validationErrors.length > 0 && (
                <Animated.View
                  className="mb-6 rounded-xl overflow-hidden"
                  style={{
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-20, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <View className="bg-red-50 border-l-4 border-red-500 p-4">
                    <View className="flex-row items-start">
                      <View className="flex-1">
                        <Text className="text-red-800 font-rubik-bold mb-2">
                          Please fix the following:
                        </Text>
                        {validationErrors.map((error, index) => (
                          <View
                            key={index}
                            className="flex-row items-center mb-1"
                          >
                            <View className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2" />
                            <Text className="text-red-700 text-sm flex-1 font-rubik">
                              {error.message}
                            </Text>
                            <TouchableOpacity
                              onPress={() => clearError(error.field)}
                              className="ml-2"
                            >
                              <Ionicons
                                name="close"
                                size={16}
                                color="#EF4444"
                              />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </Animated.View>
              )}

              {/* Avatar Upload - Optional */}
              <TouchableOpacity
                onPress={pickImage}
                disabled={uploadingAvatar}
                className="items-center mb-8"
              >
                <View
                  className="w-24 h-24 rounded-full items-center justify-center relative overflow-hidden"
                  style={{
                    backgroundColor: theme.surface,
                    borderWidth: 2,
                    borderColor: getFieldError("avatar")
                      ? "#EF4444"
                      : theme.primary[300],
                  }}
                >
                  {uploadingAvatar ? (
                    <ActivityIndicator
                      size="large"
                      color={theme.primary[300]}
                    />
                  ) : formData.avatar ? (
                    <Image
                      source={{ uri: formData.avatar }}
                      className="w-full h-full"
                    />
                  ) : formData.name ? (
                    // Show initials avatar when name exists but no uploaded avatar
                    <View
                      className="w-full h-full items-center justify-center"
                      style={{ backgroundColor: initialsColor }}
                    >
                      <Text className="text-white text-2xl font-rubik-bold">
                        {displayInitials}
                      </Text>
                    </View>
                  ) : (
                    <Ionicons
                      name="camera-outline"
                      size={32}
                      color={theme.muted}
                    />
                  )}

                  {/* Edit Icon Overlay */}
                  <View
                    className="absolute bottom-0 right-0 rounded-full p-1"
                    style={{ backgroundColor: theme.primary[300] }}
                  >
                    <Ionicons name="pencil" size={12} color="white" />
                  </View>
                </View>

                <View className="flex-row items-center justify-center mt-2">
                  <Text
                    className="text-sm font-rubik-medium"
                    style={{
                      color: getFieldError("avatar") ? "#EF4444" : theme.muted,
                    }}
                  >
                    {uploadingAvatar
                      ? "Uploading..."
                      : formData.avatar
                        ? "Change Photo"
                        : "Add Profile Photo (Optional)"}
                  </Text>
                  {formData.avatar && (
                    <TouchableOpacity onPress={removeAvatar} className="ml-2">
                      <Ionicons name="close-circle" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
                <Text
                  className="text-xs mt-1"
                  style={{ color: theme.muted + "80" }}
                >
                  {!formData.avatar && "Your initials will be used as avatar"}
                </Text>
              </TouchableOpacity>

              {/* Form Fields */}
              <View className="space-y-4">
                <CustomInput
                  label="Full name"
                  value={formData.name}
                  onChangeText={(text) => {
                    setFormData({ ...formData, name: text });
                    if (getFieldError("name")) clearError("name");
                  }}
                  placeholder="Enter your full name"
                  error={getFieldError("name")}
                />

                <CustomInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(text) => {
                    setFormData({ ...formData, email: text });
                    if (getFieldError("email")) clearError("email");
                  }}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={getFieldError("email")}
                />

                <CustomInput
                  label="Phone number"
                  value={formData.phone}
                  onChangeText={(text) => {
                    setFormData({ ...formData, phone: text });
                    if (getFieldError("phone")) clearError("phone");
                  }}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  error={getFieldError("phone")}
                />

                {/* User Mode Toggle */}
                <View className="mb-4">
                  <Text
                    className="text-sm font-medium mb-2 font-rubik-medium"
                    style={{
                      color: getFieldError("userMode")
                        ? "#EF4444"
                        : theme.muted,
                    }}
                  >
                    Select Your User Mode
                  </Text>
                  <View
                    className="flex-row justify-between rounded-2xl p-1.5"
                    style={{
                      backgroundColor: theme.surface,
                      borderWidth: getFieldError("userMode") ? 1 : 0,
                      borderColor: "#EF4444",
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => {
                        setFormData({ ...formData, userMode: "tenant" });
                        if (getFieldError("userMode")) clearError("userMode");
                      }}
                      className={`flex-1 py-3 rounded-xl items-center ${
                        formData.userMode === "tenant" ? "bg-blue-600" : ""
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          formData.userMode === "tenant"
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        Tenant
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        setFormData({ ...formData, userMode: "landlord" });
                        if (getFieldError("userMode")) clearError("userMode");
                      }}
                      className={`flex-1 py-3 rounded-xl items-center ${
                        formData.userMode === "landlord" ? "bg-blue-600" : ""
                      }`}
                    >
                      <Text
                        className={`font-semibold ${
                          formData.userMode === "landlord"
                            ? "text-white"
                            : "text-gray-700"
                        }`}
                      >
                        Landlord
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {getFieldError("userMode") && (
                    <Text className="text-red-500 text-xs mt-1 font-rubik">
                      {getFieldError("userMode")}
                    </Text>
                  )}
                </View>

                <CustomInput
                  label="Password"
                  value={formData.password}
                  onChangeText={(text) => {
                    setFormData({ ...formData, password: text });
                    if (getFieldError("password")) clearError("password");
                  }}
                  placeholder="Create a password"
                  secureTextEntry
                  error={getFieldError("password")}
                />

                <CustomInput
                  label="Confirm password"
                  value={formData.confirmPassword}
                  onChangeText={(text) => {
                    setFormData({ ...formData, confirmPassword: text });
                    if (getFieldError("confirmPassword"))
                      clearError("confirmPassword");
                  }}
                  placeholder="Confirm your password"
                  secureTextEntry
                  error={getFieldError("confirmPassword")}
                />

                {/* Password Requirements Helper */}
                {formData.password.length > 0 &&
                  formData.password.length < 8 && (
                    <View className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-2">
                      <Text className="text-yellow-700 text-xs font-rubik">
                        💡 Password must be at least 8 characters
                      </Text>
                    </View>
                  )}

                {/* Sign Up Button */}
                <TouchableOpacity
                  onPress={handleSignUp}
                  disabled={isLoading || uploadingAvatar}
                  className={`w-full py-4 rounded-2xl mt-6 ${
                    isLoading || uploadingAvatar ? "bg-gray-400" : "bg-blue-600"
                  }`}
                >
                  {isLoading ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-white text-center font-semibold text-base ml-2">
                        Creating account...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-semibold text-base">
                      Sign Up
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Sign In Link */}
                <View className="flex-row justify-center mt-6">
                  <Text className="text-gray-600">
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/sign-in")}>
                    <Text className="text-orange-500 font-semibold">
                      Sign In
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Success Modal */}
        <OperationSuccesfull
          visible={showSuccess}
          onClose={() => {
            setShowSuccess(false);
          }}
          title="Account Created!"
          message="Your account has been created successfully. Redirecting..."
        />

        {/* Error Modal */}
        <ErrorModal
          visible={errorModalVisible}
          onClose={() => setErrorModalVisible(false)}
          title="Sign Up Failed"
          message={errorMessage}
        />
      </View>
    </>
  );
};

export default SignUp;
