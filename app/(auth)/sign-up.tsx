import CustomInput from "@/components/CustomInput";
import ErrorModal from "@/components/ErrorModal";
import OperationSuccesfull from "@/components/OperationSuccesfull";
import DriverOrganizationPicker from "@/components/driver/DriverOrganizationPicker";
import SearchableInstitutionPicker from "@/components/SearchableInstitutionPicker";
import { Colors } from "@/constants/Colors";
import images from "@/constants/images";
import { uploadImage } from "@/lib/appwrite";
import {
  getUserHomeRoute,
  PrimaryUserMode,
  TenantType,
} from "@/lib/userMode";
import {
  saveDriverOnboardingDraft,
} from "@/services/driver-onboarding-draft.service";
import { submitDriverOnboarding } from "@/services/driver.service";
import useAuthStore from "@/store/auth.store";
import type { DriverOnboardingInput } from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
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
  userMode: PrimaryUserMode | "";
  tenantType: TenantType | "";
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  avatar: string;
  schoolLocation: string;
  driverOrganizationId: string;
  driverInstitution: string;
  driverLicenceNumber: string;
  driverLicenceExpiry: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleRegistrationNumber: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  vehicleCapacity: string;
  vehicleType: string;
  manufactureYear: string;
  insuranceExpiry: string;
  fitnessExpiry: string;
}

interface ValidationError {
  field: keyof FormData;
  message: string;
}

interface TenantOption {
  value: TenantType;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

interface ModeOption {
  value: PrimaryUserMode;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const TENANT_OPTIONS: TenantOption[] = [
  {
    value: "student",
    title: "Student",
    description: "Campus-friendly and shared accommodation",
    icon: "school-outline",
  },
  {
    value: "family",
    title: "Family",
    description: "Space, safety and family-friendly facilities",
    icon: "people-outline",
  },
  {
    value: "single",
    title: "Single",
    description: "Studios, rooms and affordable solo living",
    icon: "person-outline",
  },
];

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "tenant",
    title: "Tenant",
    description: "Find and manage a place to live.",
    icon: "home-outline",
  },
  {
    value: "landlord",
    title: "Landlord",
    description: "List properties and manage tenants.",
    icon: "business-outline",
  },
  {
    value: "driver",
    title: "Driver",
    description:
      "Receive student ride requests and send offers after verification.",
    icon: "car-sport-outline",
  },
];

const getInitials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const getInitialsColor = (name: string): string => {
  const colors = [
    "#3B82F6",
    "#10B981",
    "#F59E0B",
    "#EF4444",
    "#8B5CF6",
    "#EC4899",
    "#06B6D4",
    "#F97316",
  ];

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

const buildDriverOnboardingPayload = (
  formData: FormData,
): DriverOnboardingInput => ({
  organizationId: formData.driverOrganizationId.trim(),
  institutionName: formData.driverInstitution.trim(),
  licenceNumber: formData.driverLicenceNumber.trim(),
  licenceExpiry: formData.driverLicenceExpiry.trim() || undefined,
  emergencyContactName: formData.emergencyContactName.trim(),
  emergencyContactPhone: formData.emergencyContactPhone.trim(),
  vehicleRegistrationNumber:
    formData.vehicleRegistrationNumber.trim().toUpperCase(),
  vehicleMake: formData.vehicleMake.trim(),
  vehicleModel: formData.vehicleModel.trim(),
  vehicleColor: formData.vehicleColor.trim(),
  vehicleCapacity: Number(formData.vehicleCapacity),
  vehicleType: formData.vehicleType.trim() || "Car",
  manufactureYear: formData.manufactureYear.trim()
    ? Number(formData.manufactureYear)
    : undefined,
  insuranceExpiry: formData.insuranceExpiry.trim() || undefined,
  fitnessExpiry: formData.fitnessExpiry.trim() || undefined,
});

export default function SignUp() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const signUp = useAuthStore((state) => state.signUp);

  const [formData, setFormData] = useState<FormData>({
    name: "",
    userMode: "",
    tenantType: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    avatar: "",
    schoolLocation: "",
    driverOrganizationId: "",
    driverInstitution: "",
    driverLicenceNumber: "",
    driverLicenceExpiry: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    vehicleRegistrationNumber: "",
    vehicleMake: "",
    vehicleModel: "",
    vehicleColor: "",
    vehicleCapacity: "",
    vehicleType: "Car",
    manufactureYear: "",
    insuranceExpiry: "",
    fitnessExpiry: "",
  });

  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const displayInitials = useMemo(
    () => (formData.name && !formData.avatar ? getInitials(formData.name) : ""),
    [formData.avatar, formData.name],
  );

  const initialsColor = useMemo(
    () => (formData.name ? getInitialsColor(formData.name) : "#3B82F6"),
    [formData.name],
  );

  const updateField = <K extends keyof FormData>(
    field: K,
    value: FormData[K],
  ) => {
    setFormData((current) => ({ ...current, [field]: value }));
    setValidationErrors((current) =>
      current.filter((error) => error.field !== field),
    );
  };

  const getFieldError = (field: keyof FormData): string | undefined =>
    validationErrors.find((error) => error.field === field)?.message;

  const showValidationErrors = (errors: ValidationError[]) => {
    setValidationErrors(errors);
    fadeAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const validateForm = (): ValidationError[] => {
    const errors: ValidationError[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.name.trim()) {
      errors.push({ field: "name", message: "Enter your full name." });
    }

    if (!formData.email.trim()) {
      errors.push({ field: "email", message: "Enter your email address." });
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.push({ field: "email", message: "Enter a valid email address." });
    }

    if (!formData.phone.trim()) {
      errors.push({ field: "phone", message: "Enter your phone number." });
    }

    if (!formData.userMode) {
      errors.push({
        field: "userMode",
        message: "Choose whether you are a tenant, landlord or driver.",
      });
    }

    if (formData.userMode === "tenant" && !formData.tenantType) {
      errors.push({
        field: "tenantType",
        message: "Choose your tenant type.",
      });
    }

    if (
      formData.userMode === "tenant" &&
      formData.tenantType === "student" &&
      !formData.schoolLocation.trim()
    ) {
      errors.push({
        field: "schoolLocation",
        message: "Select your university, polytechnic or tertiary college.",
      });
    }

    if (formData.userMode === "driver") {
      if (!formData.driverOrganizationId.trim()) {
        errors.push({
          field: "driverInstitution",
          message:
            "Select an institution that has completed Nookly Web setup.",
        });
      }

      if (!formData.driverLicenceNumber.trim()) {
        errors.push({
          field: "driverLicenceNumber",
          message: "Enter your driver licence number.",
        });
      }

      if (!formData.emergencyContactName.trim()) {
        errors.push({
          field: "emergencyContactName",
          message: "Enter an emergency contact name.",
        });
      }

      if (!formData.emergencyContactPhone.trim()) {
        errors.push({
          field: "emergencyContactPhone",
          message: "Enter an emergency contact phone number.",
        });
      }

      if (!formData.vehicleRegistrationNumber.trim()) {
        errors.push({
          field: "vehicleRegistrationNumber",
          message: "Enter the vehicle registration number.",
        });
      }

      if (!formData.vehicleMake.trim()) {
        errors.push({ field: "vehicleMake", message: "Enter the vehicle make." });
      }

      if (!formData.vehicleModel.trim()) {
        errors.push({ field: "vehicleModel", message: "Enter the vehicle model." });
      }

      if (!formData.vehicleColor.trim()) {
        errors.push({ field: "vehicleColor", message: "Enter the vehicle color." });
      }

      const capacity = Number(formData.vehicleCapacity);
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
        errors.push({
          field: "vehicleCapacity",
          message: "Enter a valid passenger capacity.",
        });
      }

      if (formData.manufactureYear.trim()) {
        const year = Number(formData.manufactureYear);
        const maximumYear = new Date().getFullYear() + 1;

        if (!Number.isInteger(year) || year < 1900 || year > maximumYear) {
          errors.push({
            field: "manufactureYear",
            message: "Enter a valid vehicle manufacture year.",
          });
        }
      }

      const optionalDates: Array<[keyof FormData, string]> = [
        ["driverLicenceExpiry", "driver licence expiry"],
        ["insuranceExpiry", "insurance expiry"],
        ["fitnessExpiry", "vehicle fitness expiry"],
      ];

      optionalDates.forEach(([field, label]) => {
        const value = String(formData[field] || "").trim();

        if (value && Number.isNaN(new Date(value).getTime())) {
          errors.push({
            field,
            message: `Enter a valid ${label} date using YYYY-MM-DD.`,
          });
        }
      });
    }

    if (!formData.password) {
      errors.push({ field: "password", message: "Create a password." });
    } else if (formData.password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must contain at least 8 characters.",
      });
    }

    if (!formData.confirmPassword) {
      errors.push({
        field: "confirmPassword",
        message: "Confirm your password.",
      });
    } else if (formData.password !== formData.confirmPassword) {
      errors.push({
        field: "confirmPassword",
        message: "Passwords do not match.",
      });
    }

    return errors;
  };

  const pickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") {
        showValidationErrors([
          {
            field: "avatar",
            message: "Allow photo access to choose a profile photo.",
          },
        ]);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        updateField("avatar", result.assets[0].uri);
      }
    } catch (error) {
      console.error("Image picker failed:", error);
      showValidationErrors([
        {
          field: "avatar",
          message: "Could not open your image library.",
        },
      ]);
    }
  };

  const handleSignUp = async () => {
    let accountCreated = false;
    const driverOnboardingPayload =
      formData.userMode === "driver"
        ? buildDriverOnboardingPayload(formData)
        : null;

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

      accountCreated = true;

      if (driverOnboardingPayload) {
        const accountId = useAuthStore.getState().user?.accountId || "";

        try {
          await saveDriverOnboardingDraft(
            accountId,
            driverOnboardingPayload,
          );
        } catch (draftError) {
          console.warn(
            "Could not retain the driver application details:",
            draftError,
          );
        }
      }

      // Upload the optional avatar only after Appwrite has created the session.
      // Failure here must not roll back an otherwise valid account.
      if (formData.avatar) {
        setUploadingAvatar(true);

        try {
          const uploadedAvatarUrl = await uploadImage({
            uri: formData.avatar,
            fileName: `avatar_${Date.now()}.jpg`,
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

      if (driverOnboardingPayload) {
        await submitDriverOnboarding(driverOnboardingPayload);

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

      if (accountCreated && formData.userMode === "driver") {
        message =
          `Your account was created, but the driver application was not submitted. ${message} You can retry from Driver profile.`;

        setTimeout(() => {
          router.replace("/driver-profile" as any);
        }, 1600);
      }

      setErrorMessage(message);
      setErrorModalVisible(true);
    } finally {
      setIsLoading(false);
      setUploadingAvatar(false);
    }
  };

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
            contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
          >
            <Image
              source={images.dayHouse}
              className="w-full h-80"
              resizeMode="cover"
            />

            <View
              className="flex-1 px-6 pt-8 pb-8 -mt-8 rounded-t-3xl"
              style={{ backgroundColor: theme.navBackground }}
            >
              <Text
                className="text-3xl font-rubik-bold"
                style={{ color: theme.title }}
              >
                Create account
              </Text>
              <Text
                className="text-base mt-2 mb-7"
                style={{ color: theme.muted }}
              >
                Join Nookly and get a feed tailored to you.
              </Text>

              {validationErrors.length > 0 && (
                <Animated.View
                  className="mb-6 rounded-xl overflow-hidden"
                  style={{ opacity: fadeAnim }}
                >
                  <View className="bg-red-50 border-l-4 border-red-500 p-4">
                    <Text className="text-red-800 font-rubik-bold mb-2">
                      Please fix the following:
                    </Text>
                    {validationErrors.map((error) => (
                      <Text
                        key={`${error.field}-${error.message}`}
                        className="text-red-700 text-sm mb-1"
                      >
                        • {error.message}
                      </Text>
                    ))}
                  </View>
                </Animated.View>
              )}

              <TouchableOpacity
                onPress={pickImage}
                disabled={uploadingAvatar}
                activeOpacity={0.85}
                className="items-center mb-8"
              >
                <View
                  className="w-24 h-24 rounded-full items-center justify-center overflow-hidden"
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
                </View>

                <Text
                  className="text-sm font-rubik-medium mt-2"
                  style={{ color: theme.muted }}
                >
                  {formData.avatar
                    ? "Change profile photo"
                    : "Add profile photo (optional)"}
                </Text>
              </TouchableOpacity>

              <View className="gap-4">
                <CustomInput
                  label="Full name"
                  value={formData.name}
                  onChangeText={(value) => updateField("name", value)}
                  placeholder="Enter your full name"
                  error={getFieldError("name")}
                />

                <CustomInput
                  label="Email"
                  value={formData.email}
                  onChangeText={(value) => updateField("email", value)}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={getFieldError("email")}
                />

                <CustomInput
                  label="Phone number"
                  value={formData.phone}
                  onChangeText={(value) => updateField("phone", value)}
                  placeholder="Enter your phone number"
                  keyboardType="phone-pad"
                  error={getFieldError("phone")}
                />

                <View>
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{
                      color: getFieldError("userMode")
                        ? "#EF4444"
                        : theme.muted,
                    }}
                  >
                    How will you use Nookly?
                  </Text>

                  <View className="gap-3">
                    {MODE_OPTIONS.map((option) => {
                      const selected = formData.userMode === option.value;

                      return (
                        <TouchableOpacity
                          key={option.value}
                          activeOpacity={0.85}
                          onPress={() => {
                            setFormData((current) => ({
                              ...current,
                              userMode: option.value,
                              ...(option.value === "tenant"
                                ? {}
                                : {
                                    tenantType: "",
                                    schoolLocation: "",
                                  }),
                              ...(option.value === "driver"
                                ? {}
                                : {
                                    driverOrganizationId: "",
                                    driverInstitution: "",
                                    driverLicenceNumber: "",
                                    driverLicenceExpiry: "",
                                    emergencyContactName: "",
                                    emergencyContactPhone: "",
                                    vehicleRegistrationNumber: "",
                                    vehicleMake: "",
                                    vehicleModel: "",
                                    vehicleColor: "",
                                    vehicleCapacity: "",
                                    vehicleType: "Car",
                                    manufactureYear: "",
                                    insuranceExpiry: "",
                                    fitnessExpiry: "",
                                  }),
                            }));

                            setValidationErrors((current) =>
                              current.filter(
                                (error) =>
                                  error.field !== "tenantType" &&
                                  error.field !== "schoolLocation" &&
                                  error.field !== "driverInstitution" &&
                                  error.field !== "driverLicenceNumber" &&
                                  error.field !== "driverLicenceExpiry" &&
                                  error.field !== "emergencyContactName" &&
                                  error.field !== "emergencyContactPhone" &&
                                  error.field !== "vehicleRegistrationNumber" &&
                                  error.field !== "vehicleMake" &&
                                  error.field !== "vehicleModel" &&
                                  error.field !== "vehicleColor" &&
                                  error.field !== "vehicleCapacity" &&
                                  error.field !== "vehicleType" &&
                                  error.field !== "manufactureYear" &&
                                  error.field !== "insuranceExpiry" &&
                                  error.field !== "fitnessExpiry" &&
                                  error.field !== "userMode",
                              ),
                            );
                          }}
                          className="rounded-2xl p-4 flex-row items-center"
                          style={{
                            backgroundColor: selected
                              ? `${theme.primary[300]}12`
                              : theme.surface,
                            borderWidth: 1.5,
                            borderColor: selected
                              ? theme.primary[300]
                              : `${theme.muted}28`,
                          }}
                        >
                          <View
                            className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                            style={{
                              backgroundColor: selected
                                ? theme.primary[300]
                                : `${theme.primary[300]}12`,
                            }}
                          >
                            <Ionicons
                              name={option.icon}
                              size={22}
                              color={
                                selected ? "#FFFFFF" : theme.primary[300]
                              }
                            />
                          </View>

                          <View className="flex-1">
                            <Text
                              className="font-rubik-bold"
                              style={{ color: theme.title }}
                            >
                              {option.title}
                            </Text>
                            <Text
                              className="text-xs mt-1"
                              style={{ color: theme.muted }}
                            >
                              {option.description}
                            </Text>
                          </View>

                          <Ionicons
                            name={
                              selected
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            size={22}
                            color={
                              selected ? theme.primary[300] : theme.muted
                            }
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {!!getFieldError("userMode") && (
                    <Text className="text-red-500 text-xs mt-2">
                      {getFieldError("userMode")}
                    </Text>
                  )}
                </View>

                {formData.userMode === "tenant" && (
                  <View>
                    <Text
                      className="text-sm font-rubik-medium mb-2"
                      style={{
                        color: getFieldError("tenantType")
                          ? "#EF4444"
                          : theme.muted,
                      }}
                    >
                      What type of tenant are you?
                    </Text>

                    <View className="gap-3">
                      {TENANT_OPTIONS.map((option) => {
                        const selected =
                          formData.tenantType === option.value;

                        return (
                          <TouchableOpacity
                            key={option.value}
                            activeOpacity={0.85}
                            onPress={() => {
                              updateField("tenantType", option.value);

                              if (option.value !== "student") {
                                updateField("schoolLocation", "");
                              }
                            }}
                            className="rounded-2xl p-4 flex-row items-center"
                            style={{
                              backgroundColor: selected
                                ? `${theme.primary[300]}12`
                                : theme.surface,
                              borderWidth: 1.5,
                              borderColor: selected
                                ? theme.primary[300]
                                : `${theme.muted}28`,
                            }}
                          >
                            <View
                              className="w-11 h-11 rounded-xl items-center justify-center mr-3"
                              style={{
                                backgroundColor: selected
                                  ? theme.primary[300]
                                  : `${theme.primary[300]}12`,
                              }}
                            >
                              <Ionicons
                                name={option.icon}
                                size={22}
                                color={
                                  selected ? "#FFFFFF" : theme.primary[300]
                                }
                              />
                            </View>

                            <View className="flex-1">
                              <Text
                                className="font-rubik-bold"
                                style={{ color: theme.title }}
                              >
                                {option.title}
                              </Text>
                              <Text
                                className="text-xs mt-1"
                                style={{ color: theme.muted }}
                              >
                                {option.description}
                              </Text>
                            </View>

                            <Ionicons
                              name={
                                selected
                                  ? "checkmark-circle"
                                  : "ellipse-outline"
                              }
                              size={22}
                              color={
                                selected ? theme.primary[300] : theme.muted
                              }
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {!!getFieldError("tenantType") && (
                      <Text className="text-red-500 text-xs mt-2">
                        {getFieldError("tenantType")}
                      </Text>
                    )}
                  </View>
                )}

                {formData.userMode === "tenant" &&
                  formData.tenantType === "student" && (
                    <SearchableInstitutionPicker
                      value={formData.schoolLocation}
                      onChange={(value) =>
                        updateField("schoolLocation", value)
                      }
                      error={getFieldError("schoolLocation")}
                    />
                  )}

                {formData.userMode === "driver" && (
                  <View className="gap-4">
                    <View
                      className="rounded-2xl border p-4"
                      style={{
                        backgroundColor: `${theme.primary[300]}0D`,
                        borderColor: `${theme.primary[300]}35`,
                      }}
                    >
                      <Text
                        className="text-base font-rubik-bold"
                        style={{ color: theme.title }}
                      >
                        Driver verification application
                      </Text>
                      <Text
                        className="mt-1 text-sm"
                        style={{ color: theme.muted }}
                      >
                        Your institution reviews this information on Nookly Web.
                        Ride requests remain locked until approval.
                      </Text>
                    </View>

                    <DriverOrganizationPicker
                      value={formData.driverOrganizationId}
                      selectedName={formData.driverInstitution}
                      onChange={(organization) => {
                        updateField(
                          "driverOrganizationId",
                          organization?.$id || "",
                        );
                        updateField(
                          "driverInstitution",
                          organization?.name || "",
                        );
                      }}
                      error={getFieldError("driverInstitution")}
                    />

                    <Text
                      className="text-lg font-rubik-bold mt-1"
                      style={{ color: theme.title }}
                    >
                      Licence and safety
                    </Text>

                    <CustomInput
                      label="Driver licence number"
                      value={formData.driverLicenceNumber}
                      onChangeText={(value) =>
                        updateField("driverLicenceNumber", value)
                      }
                      placeholder="e.g. ZW-DL-123456"
                      autoCapitalize="characters"
                      error={getFieldError("driverLicenceNumber")}
                    />

                    <CustomInput
                      label="Driver licence expiry (optional)"
                      value={formData.driverLicenceExpiry}
                      onChangeText={(value) =>
                        updateField("driverLicenceExpiry", value)
                      }
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      error={getFieldError("driverLicenceExpiry")}
                    />

                    <CustomInput
                      label="Emergency contact name"
                      value={formData.emergencyContactName}
                      onChangeText={(value) =>
                        updateField("emergencyContactName", value)
                      }
                      placeholder="Full name"
                      error={getFieldError("emergencyContactName")}
                    />

                    <CustomInput
                      label="Emergency contact phone"
                      value={formData.emergencyContactPhone}
                      onChangeText={(value) =>
                        updateField("emergencyContactPhone", value)
                      }
                      placeholder="Phone number"
                      keyboardType="phone-pad"
                      error={getFieldError("emergencyContactPhone")}
                    />

                    <Text
                      className="text-lg font-rubik-bold mt-2"
                      style={{ color: theme.title }}
                    >
                      Vehicle details
                    </Text>

                    <CustomInput
                      label="Registration number"
                      value={formData.vehicleRegistrationNumber}
                      onChangeText={(value) =>
                        updateField("vehicleRegistrationNumber", value)
                      }
                      placeholder="e.g. ABE 1234"
                      autoCapitalize="characters"
                      error={getFieldError("vehicleRegistrationNumber")}
                    />

                    <CustomInput
                      label="Vehicle make"
                      value={formData.vehicleMake}
                      onChangeText={(value) => updateField("vehicleMake", value)}
                      placeholder="e.g. Toyota"
                      error={getFieldError("vehicleMake")}
                    />

                    <CustomInput
                      label="Vehicle model"
                      value={formData.vehicleModel}
                      onChangeText={(value) => updateField("vehicleModel", value)}
                      placeholder="e.g. Wish"
                      error={getFieldError("vehicleModel")}
                    />

                    <CustomInput
                      label="Vehicle color"
                      value={formData.vehicleColor}
                      onChangeText={(value) => updateField("vehicleColor", value)}
                      placeholder="e.g. Silver"
                      error={getFieldError("vehicleColor")}
                    />

                    <CustomInput
                      label="Passenger capacity"
                      value={formData.vehicleCapacity}
                      onChangeText={(value) =>
                        updateField("vehicleCapacity", value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="e.g. 4"
                      keyboardType="number-pad"
                      error={getFieldError("vehicleCapacity")}
                    />

                    <CustomInput
                      label="Vehicle type"
                      value={formData.vehicleType}
                      onChangeText={(value) => updateField("vehicleType", value)}
                      placeholder="Car, van, minibus..."
                      error={getFieldError("vehicleType")}
                    />

                    <CustomInput
                      label="Manufacture year (optional)"
                      value={formData.manufactureYear}
                      onChangeText={(value) =>
                        updateField("manufactureYear", value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="e.g. 2018"
                      keyboardType="number-pad"
                      error={getFieldError("manufactureYear")}
                    />

                    <CustomInput
                      label="Insurance expiry (optional)"
                      value={formData.insuranceExpiry}
                      onChangeText={(value) =>
                        updateField("insuranceExpiry", value)
                      }
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      error={getFieldError("insuranceExpiry")}
                    />

                    <CustomInput
                      label="Vehicle fitness expiry (optional)"
                      value={formData.fitnessExpiry}
                      onChangeText={(value) => updateField("fitnessExpiry", value)}
                      placeholder="YYYY-MM-DD"
                      autoCapitalize="none"
                      error={getFieldError("fitnessExpiry")}
                    />
                  </View>
                )}

                <CustomInput
                  label="Password"
                  value={formData.password}
                  onChangeText={(value) => updateField("password", value)}
                  placeholder="Create a password"
                  secureTextEntry
                  error={getFieldError("password")}
                />

                <CustomInput
                  label="Confirm password"
                  value={formData.confirmPassword}
                  onChangeText={(value) =>
                    updateField("confirmPassword", value)
                  }
                  placeholder="Confirm your password"
                  secureTextEntry
                  error={getFieldError("confirmPassword")}
                />

                <TouchableOpacity
                  onPress={handleSignUp}
                  disabled={isLoading || uploadingAvatar}
                  activeOpacity={0.85}
                  className="w-full py-4 rounded-2xl mt-4"
                  style={{
                    backgroundColor:
                      isLoading || uploadingAvatar
                        ? theme.muted
                        : theme.primary[300],
                  }}
                >
                  {isLoading ? (
                    <View className="flex-row items-center justify-center">
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text className="text-white font-rubik-bold ml-2">
                        Creating account...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white text-center font-rubik-bold text-base">
                      Sign Up
                    </Text>
                  )}
                </TouchableOpacity>

                <View className="flex-row justify-center mt-3">
                  <Text style={{ color: theme.muted }}>
                    Already have an account?{" "}
                  </Text>
                  <TouchableOpacity onPress={() => router.push("/sign-in")}>
                    <Text className="text-orange-500 font-rubik-bold">
                      Sign In
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <OperationSuccesfull
          visible={showSuccess}
          onClose={() => setShowSuccess(false)}
          title="Account created"
          message={
            formData.userMode === "driver"
              ? "Your driver application was submitted. Your institution will review it on Nookly Web before ride access is activated."
              : "Your personalised Nookly account is ready."
          }
        />

        <ErrorModal
          visible={errorModalVisible}
          onClose={() => setErrorModalVisible(false)}
          title="Sign up failed"
          message={errorMessage}
        />
      </View>
    </>
  );
}