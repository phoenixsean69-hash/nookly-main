import CustomInput from "@/components/CustomInput";
import ErrorModal from "@/components/ErrorModal";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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

interface ValidationError {
  field: string;
  message: string;
}

const SignIn = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { signIn, user, fetchAuthenticatedUser } = useAuthStore();

  // Animation for error messages
  const fadeAnim = useRef(new Animated.Value(0)).current;

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

  // Get error for a specific field
  const getFieldError = (field: string): string | undefined => {
    const error = validationErrors.find((e) => e.field === field);
    return error ? error.message : undefined;
  };

  // Navigate based on user mode after successful sign-in
  useEffect(() => {
    if (user) {
      console.log("User detected in SignIn:", user.userMode);
      console.log("User avatar:", user.avatar);

      if (user.userMode === "tenant") {
        router.replace("/tenantHome");
      } else if (user.userMode === "landlord") {
        router.replace("/landHome");
      }
    }
  }, [user]);

  const validateForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!email.trim()) {
      errors.push({
        field: "email",
        message: "Please enter your email address",
      });
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push({
          field: "email",
          message: "Please enter a valid email address",
        });
      }
    }

    if (!password) {
      errors.push({ field: "password", message: "Please enter your password" });
    } else if (password.length < 6) {
      errors.push({
        field: "password",
        message: "Password must be at least 6 characters",
      });
    }

    return errors;
  };

  const handleSignIn = async () => {
    // Clear previous errors
    clearAllErrors();
    setErrorMessage("");

    // Validate form
    const errors = validateForm();
    if (errors.length > 0) {
      showValidationError(errors);
      return;
    }

    setIsLoading(true);
    try {
      console.log("Attempting sign in...");
      const result = await signIn(email, password);

      if (result.success) {
        console.log("Sign-in successful, fetching user data...");
        await fetchAuthenticatedUser();
        console.log("User data fetched, navigation will happen via useEffect");
      } else {
        // Show specific error message
        setErrorMessage(
          result.error || "Invalid email or password. Please try again.",
        );
        setErrorModalVisible(true);
      }
    } catch (error: any) {
      console.error("Sign-in error:", error);

      let errorMessage = "An unexpected error occurred";

      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        switch (error.code) {
          case 401:
            errorMessage = "Invalid email or password. Please try again.";
            break;
          case 404:
            errorMessage = "Account not found. Please sign up first.";
            break;
          case 429:
            errorMessage = "Too many attempts. Please try again later.";
            break;
          case 500:
            errorMessage = "Server error. Please try again later.";
            break;
          default:
            errorMessage =
              error.message || `Error ${error.code}: Something went wrong`;
        }
      }

      if (errorMessage.toLowerCase().includes("network")) {
        errorMessage =
          "Network error. Please check your internet connection and try again.";
      }

      setErrorMessage(errorMessage);
      setErrorModalVisible(true);
    } finally {
      setIsLoading(false);
    }
  };

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

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
              source={images.nightHouse2}
              className="w-full h-96"
              resizeMode="cover"
            />

            {/* Content Container */}
            <View
              className="flex-1 px-6 pt-8 pb-8 -mt-8 rounded-t-3xl"
              style={{ backgroundColor: theme.navBackground }}
            >
              {/* Back Button */}
              <TouchableOpacity
                onPress={() => router.back()}
                className="w-10 h-10 mb-4 items-center justify-center"
              >
                <Ionicons name="arrow-back" size={24} color={theme.title} />
              </TouchableOpacity>

              {/* Title */}
              <Text
                className="text-3xl font-semibold mb-2"
                style={{ color: theme.title }}
              >
                Welcome Back
              </Text>
              <Text className="text-base mb-8" style={{ color: theme.muted }}>
                Sign in to continue to your account
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

              {/* Form */}
              <View className="space-y-4">
                {/* Email Field */}
                <CustomInput
                  label="Email"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (getFieldError("email")) clearError("email");
                  }}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={getFieldError("email")}
                />

                {/* Password Field */}
                <CustomInput
                  label="Password"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (getFieldError("password")) clearError("password");
                  }}
                  placeholder="Enter your password"
                  secureTextEntry
                  error={getFieldError("password")}
                />

                {/* Sign In Button */}
                <TouchableOpacity
                  onPress={handleSignIn}
                  disabled={isLoading}
                  className={`w-full py-4 rounded-2xl mt-6 ${
                    isLoading ? "bg-gray-400" : "bg-blue-600"
                  }`}
                >
                  {isLoading ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-white text-center font-semibold text-base ml-2">
                        Signing In...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-semibold text-base">
                      Sign In
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Sign Up Link */}
                <View className="flex-row justify-center mt-6">
                  <Text className="text-gray-600">
                    Don&apos;t have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/sign-up")}>
                    <Text className="text-orange-500 font-semibold">
                      Sign Up
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {/* Error Modal */}
      <ErrorModal
        visible={errorModalVisible}
        onClose={() => setErrorModalVisible(false)}
        title="Sign In Failed"
        message={errorMessage}
      />
    </>
  );
};

export default SignIn;
