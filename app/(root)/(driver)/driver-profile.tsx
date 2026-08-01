import CustomInput from "@/components/CustomInput";
import DriverOrganizationPicker from "@/components/driver/DriverOrganizationPicker";
import { Colors } from "@/constants/Colors";
import {
  loadDriverOnboardingDraft,
  saveDriverOnboardingDraft,
} from "@/services/driver-onboarding-draft.service";
import {
  getDriverDashboard,
  submitDriverOnboarding,
} from "@/services/driver.service";
import useAuthStore from "@/store/auth.store";
import type {
  DriverDashboard,
  DriverOnboardingInput,
} from "@/types/driver";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface OnboardingFormState {
  organizationId: string;
  institutionName: string;
  licenceNumber: string;
  licenceExpiry: string;
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

const EMPTY_FORM: OnboardingFormState = {
  organizationId: "",
  institutionName: "",
  licenceNumber: "",
  licenceExpiry: "",
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
};

const toDateInputValue = (value?: string): string =>
  value ? String(value).slice(0, 10) : "";

const formFromOnboardingInput = (
  input: DriverOnboardingInput,
): OnboardingFormState => ({
  organizationId: input.organizationId || "",
  institutionName: input.institutionName || "",
  licenceNumber: input.licenceNumber || "",
  licenceExpiry: toDateInputValue(input.licenceExpiry),
  emergencyContactName: input.emergencyContactName || "",
  emergencyContactPhone: input.emergencyContactPhone || "",
  vehicleRegistrationNumber: input.vehicleRegistrationNumber || "",
  vehicleMake: input.vehicleMake || "",
  vehicleModel: input.vehicleModel || "",
  vehicleColor: input.vehicleColor || "",
  vehicleCapacity:
    input.vehicleCapacity > 0 ? String(input.vehicleCapacity) : "",
  vehicleType: input.vehicleType || "Car",
  manufactureYear: input.manufactureYear
    ? String(input.manufactureYear)
    : "",
  insuranceExpiry: toDateInputValue(input.insuranceExpiry),
  fitnessExpiry: toDateInputValue(input.fitnessExpiry),
});

const formFromDashboard = (
  dashboard: DriverDashboard,
): OnboardingFormState => {
  const profile = dashboard.profile;
  const vehicle = dashboard.vehicles[0];
  const institution = dashboard.institutions?.[0];

  return {
    organizationId:
      institution?.organizationId || profile.organizationId || "",
    institutionName: institution?.organizationName || "",
    licenceNumber: profile.licenceNumber || "",
    licenceExpiry: toDateInputValue(profile.licenceExpiry),
    emergencyContactName: profile.emergencyContactName || "",
    emergencyContactPhone: profile.emergencyContactPhone || "",
    vehicleRegistrationNumber: vehicle?.registrationNumber || "",
    vehicleMake: vehicle?.make || "",
    vehicleModel: vehicle?.model || "",
    vehicleColor: vehicle?.color || "",
    vehicleCapacity: vehicle
      ? String(vehicle.passengerCapacity ?? vehicle.capacity ?? "")
      : "",
    vehicleType: vehicle?.vehicleType || "Car",
    manufactureYear: vehicle?.manufactureYear
      ? String(vehicle.manufactureYear)
      : "",
    insuranceExpiry: toDateInputValue(vehicle?.insuranceExpiry),
    fitnessExpiry: toDateInputValue(vehicle?.fitnessExpiry),
  };
};

const mergeRetainedForm = (
  dashboardForm: OnboardingFormState,
  retainedForm: OnboardingFormState | null,
): OnboardingFormState => {
  if (!retainedForm) return dashboardForm;

  const result = { ...dashboardForm };

  (Object.keys(result) as Array<keyof OnboardingFormState>).forEach((key) => {
    const retainedValue = String(retainedForm[key] || "").trim();

    if (retainedValue) {
      result[key] = retainedForm[key];
    }
  });

  return result;
};

const formatProfileDate = (value?: string): string => {
  if (!value?.trim()) return "Not provided";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-ZW", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const APPROVED_RELATIONSHIP_STATUSES = new Set([
  "active",
  "approved",
  "acknowledged",
  "verified",
]);

const readableStatus = (value?: string): string =>
  String(value || "pending")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function DriverProfileScreen() {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { user, signOut } = useAuthStore();

  const [dashboard, setDashboard] = useState<DriverDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_FORM);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const accountId = user?.accountId || "";
    const savedDraft = await loadDriverOnboardingDraft(accountId);
    const retainedForm = savedDraft
      ? formFromOnboardingInput(savedDraft)
      : null;

    try {
      const result = await getDriverDashboard();
      setDashboard(result);
      setForm(mergeRetainedForm(formFromDashboard(result), retainedForm));

      if (result.profile.verificationStatus === "rejected") {
        setShowApplicationForm(false);
      }
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load the driver profile.";

      setDashboard(null);
      setErrorMessage(message);

      if (retainedForm) {
        setForm(retainedForm);
      }

      if (message.toLowerCase().includes("no driver profile")) {
        setShowApplicationForm(true);
      }
    } finally {
      setLoading(false);
    }
  }, [user?.accountId]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboard();
    }, [loadDashboard]),
  );

  const updateForm = <K extends keyof OnboardingFormState>(
    field: K,
    value: OnboardingFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateApplication = (): string | null => {
    const requiredFields: Array<[string, string]> = [
      [
        form.organizationId,
        "Select an institution that has completed Nookly Web setup.",
      ],
      [form.licenceNumber, "Enter your driver licence number."],
      [form.emergencyContactName, "Enter an emergency contact name."],
      [form.emergencyContactPhone, "Enter an emergency contact phone."],
      [form.vehicleRegistrationNumber, "Enter the vehicle registration number."],
      [form.vehicleMake, "Enter the vehicle make."],
      [form.vehicleModel, "Enter the vehicle model."],
      [form.vehicleColor, "Enter the vehicle color."],
      [form.vehicleCapacity, "Enter the passenger capacity."],
    ];

    const missing = requiredFields.find(([value]) => !value.trim());
    if (missing) return missing[1];

    const capacity = Number(form.vehicleCapacity);
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 200) {
      return "Enter a valid passenger capacity.";
    }

    if (form.manufactureYear.trim()) {
      const year = Number(form.manufactureYear);
      const maximumYear = new Date().getFullYear() + 1;

      if (!Number.isInteger(year) || year < 1900 || year > maximumYear) {
        return "Enter a valid vehicle manufacture year.";
      }
    }

    return null;
  };

  const submitApplication = async () => {
    const validationError = validateApplication();

    if (validationError) {
      Alert.alert("Check application", validationError);
      return;
    }

    const payload: DriverOnboardingInput = {
      organizationId: form.organizationId.trim(),
      institutionName: form.institutionName.trim(),
      licenceNumber: form.licenceNumber.trim(),
      licenceExpiry: form.licenceExpiry.trim() || undefined,
      emergencyContactName: form.emergencyContactName.trim(),
      emergencyContactPhone: form.emergencyContactPhone.trim(),
      vehicleRegistrationNumber:
        form.vehicleRegistrationNumber.trim().toUpperCase(),
      vehicleMake: form.vehicleMake.trim(),
      vehicleModel: form.vehicleModel.trim(),
      vehicleColor: form.vehicleColor.trim(),
      vehicleCapacity: Number(form.vehicleCapacity),
      vehicleType: form.vehicleType.trim() || "Car",
      manufactureYear: form.manufactureYear.trim()
        ? Number(form.manufactureYear)
        : undefined,
      insuranceExpiry: form.insuranceExpiry.trim() || undefined,
      fitnessExpiry: form.fitnessExpiry.trim() || undefined,
    };

    setSubmittingApplication(true);

    try {
      const accountId = user?.accountId || "";
      await saveDriverOnboardingDraft(accountId, payload);

      const result = await submitDriverOnboarding(payload);

      // Keep the submitted application locally as a profile snapshot.
      // Backend data remains the source of truth, while this fills any fields
      // that older Appwrite rows or dashboard responses may omit.
      await saveDriverOnboardingDraft(accountId, payload);

      Alert.alert(
        "Application submitted",
        `${result.organization.name} can now review your driver and vehicle details on Nookly Web.`,
      );

      setShowApplicationForm(false);
      await loadDashboard();
    } catch (caughtError) {
      Alert.alert(
        "Application failed",
        caughtError instanceof Error
          ? caughtError.message
          : "Could not submit the driver application.",
      );
    } finally {
      setSubmittingApplication(false);
    }
  };

  const handleSignOut = async () => {
    const confirmed = await new Promise<boolean>((resolve) => {
      Alert.alert("Sign out", "Sign out of the driver account?", [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => resolve(true),
        },
      ]);
    });

    if (!confirmed) return;

    setSigningOut(true);
    const result = await signOut();
    setSigningOut(false);

    if (result.success) {
      router.replace("/sign-in");
    } else {
      Alert.alert("Sign out failed", result.error || "Please try again.");
    }
  };

  const profile = dashboard?.profile;
  const vehicle = dashboard?.vehicles[0];
  const institution = dashboard?.institutions?.[0];

  const retainedInstitutionName =
    institution?.organizationName || form.institutionName || "Not linked";
  const retainedLicenceNumber =
    profile?.licenceNumber || form.licenceNumber || "Not available";
  const retainedLicenceExpiry =
    profile?.licenceExpiry || form.licenceExpiry || "";
  const retainedEmergencyName =
    profile?.emergencyContactName ||
    form.emergencyContactName ||
    "Not provided";
  const retainedEmergencyPhone =
    profile?.emergencyContactPhone ||
    form.emergencyContactPhone ||
    "Not provided";
  const retainedVehicleRegistration =
    vehicle?.registrationNumber ||
    form.vehicleRegistrationNumber ||
    "Not available";
  const retainedVehicleMake = vehicle?.make || form.vehicleMake || "";
  const retainedVehicleModel = vehicle?.model || form.vehicleModel || "";
  const retainedVehicleColor = vehicle?.color || form.vehicleColor || "";
  const retainedVehicleCapacity =
    vehicle?.passengerCapacity ??
    vehicle?.capacity ??
    (form.vehicleCapacity ? Number(form.vehicleCapacity) : 0);
  const retainedVehicleType =
    vehicle?.vehicleType || form.vehicleType || "Car";
  const retainedManufactureYear =
    vehicle?.manufactureYear ||
    (form.manufactureYear ? Number(form.manufactureYear) : undefined);
  const retainedInsuranceExpiry =
    vehicle?.insuranceExpiry || form.insuranceExpiry || "";
  const retainedFitnessExpiry =
    vehicle?.fitnessExpiry || form.fitnessExpiry || "";

  const applicationApproved = useMemo(
    () =>
      profile?.verificationStatus === "verified" &&
      Boolean(
        institution &&
          APPROVED_RELATIONSHIP_STATUSES.has(
            String(institution.status).toLowerCase(),
          ),
      ) &&
      vehicle?.status === "active",
    [institution, profile?.verificationStatus, vehicle?.status],
  );

  const statusColor = applicationApproved
    ? "#16A34A"
    : profile?.verificationStatus === "rejected"
      ? "#DC2626"
      : "#D97706";

  const showForm =
    showApplicationForm ||
    (!loading && !profile && errorMessage.toLowerCase().includes("no driver profile"));

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
        <Text
          className="text-3xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Driver profile
        </Text>

        <View
          className="mt-6 items-center rounded-2xl border p-6"
          style={{
            backgroundColor: theme.surface,
            borderColor: `${theme.muted}25`,
          }}
        >
          {profile?.avatar || user?.avatar ? (
            <Image
              source={{ uri: profile?.avatar || user?.avatar }}
              className="h-24 w-24 rounded-full"
            />
          ) : (
            <View
              className="h-24 w-24 items-center justify-center rounded-full"
              style={{ backgroundColor: `${theme.primary[300]}18` }}
            >
              <Ionicons
                name="person"
                size={42}
                color={theme.primary[300]}
              />
            </View>
          )}

          <Text
            className="mt-4 text-xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {profile?.name || user?.name || "Driver"}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
            {profile?.email || user?.email}
          </Text>
          <Text className="mt-1 text-sm" style={{ color: theme.muted }}>
            {profile?.phone || user?.phone || "Phone not provided"}
          </Text>

          <View
            className="mt-4 rounded-full px-4 py-1.5"
            style={{ backgroundColor: `${statusColor}18` }}
          >
            <Text
              className="text-xs font-rubik-bold"
              style={{ color: statusColor }}
            >
              {applicationApproved
                ? "Marketplace ready"
                : profile
                  ? `${readableStatus(profile.verificationStatus)} verification`
                  : "Application incomplete"}
            </Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator className="mt-7" color={theme.primary[300]} />
        ) : (
          <>
            {!!errorMessage && !showForm && (
              <TouchableOpacity
                onPress={() => void loadDashboard()}
                className="mt-5 flex-row items-center rounded-2xl border p-4"
                style={{
                  backgroundColor: `${theme.danger}08`,
                  borderColor: `${theme.danger}30`,
                }}
              >
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={theme.danger}
                />
                <Text className="ml-3 flex-1" style={{ color: theme.text }}>
                  {errorMessage}
                </Text>
                <Ionicons
                  name="refresh"
                  size={18}
                  color={theme.primary[300]}
                />
              </TouchableOpacity>
            )}

            {showForm ? (
              <View
                className="mt-5 rounded-2xl border p-5"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: `${theme.muted}25`,
                }}
              >
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.title }}
                >
                  Complete driver application
                </Text>
                <Text className="mt-2 text-sm" style={{ color: theme.muted }}>
                  Submit your licence and vehicle details. Your selected
                  institution will approve or reject the application from the
                  separate Nookly Web platform.
                </Text>

                <View className="mt-5 gap-4">
                  <DriverOrganizationPicker
                    value={form.organizationId}
                    selectedName={form.institutionName}
                    onChange={(organization) => {
                      updateForm("organizationId", organization?.$id || "");
                      updateForm("institutionName", organization?.name || "");
                    }}
                  />

                  <CustomInput
                    label="Driver licence number"
                    value={form.licenceNumber}
                    onChangeText={(value) => updateForm("licenceNumber", value)}
                    placeholder="e.g. ZW-DL-123456"
                    autoCapitalize="characters"
                  />

                  <CustomInput
                    label="Driver licence expiry (optional)"
                    value={form.licenceExpiry}
                    onChangeText={(value) => updateForm("licenceExpiry", value)}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />

                  <CustomInput
                    label="Emergency contact name"
                    value={form.emergencyContactName}
                    onChangeText={(value) =>
                      updateForm("emergencyContactName", value)
                    }
                    placeholder="Full name"
                  />

                  <CustomInput
                    label="Emergency contact phone"
                    value={form.emergencyContactPhone}
                    onChangeText={(value) =>
                      updateForm("emergencyContactPhone", value)
                    }
                    placeholder="Phone number"
                    keyboardType="phone-pad"
                  />

                  <CustomInput
                    label="Vehicle registration number"
                    value={form.vehicleRegistrationNumber}
                    onChangeText={(value) =>
                      updateForm("vehicleRegistrationNumber", value)
                    }
                    placeholder="e.g. ABE 1234"
                    autoCapitalize="characters"
                  />

                  <CustomInput
                    label="Vehicle make"
                    value={form.vehicleMake}
                    onChangeText={(value) => updateForm("vehicleMake", value)}
                    placeholder="e.g. Toyota"
                  />

                  <CustomInput
                    label="Vehicle model"
                    value={form.vehicleModel}
                    onChangeText={(value) => updateForm("vehicleModel", value)}
                    placeholder="e.g. Wish"
                  />

                  <CustomInput
                    label="Vehicle color"
                    value={form.vehicleColor}
                    onChangeText={(value) => updateForm("vehicleColor", value)}
                    placeholder="e.g. Silver"
                  />

                  <CustomInput
                    label="Passenger capacity"
                    value={form.vehicleCapacity}
                    onChangeText={(value) =>
                      updateForm(
                        "vehicleCapacity",
                        value.replace(/[^0-9]/g, ""),
                      )
                    }
                    placeholder="e.g. 4"
                    keyboardType="number-pad"
                  />

                  <CustomInput
                    label="Vehicle type"
                    value={form.vehicleType}
                    onChangeText={(value) => updateForm("vehicleType", value)}
                    placeholder="Car, van, minibus..."
                  />

                  <CustomInput
                    label="Manufacture year (optional)"
                    value={form.manufactureYear}
                    onChangeText={(value) =>
                      updateForm(
                        "manufactureYear",
                        value.replace(/[^0-9]/g, ""),
                      )
                    }
                    placeholder="e.g. 2018"
                    keyboardType="number-pad"
                  />

                  <CustomInput
                    label="Insurance expiry (optional)"
                    value={form.insuranceExpiry}
                    onChangeText={(value) =>
                      updateForm("insuranceExpiry", value)
                    }
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />

                  <CustomInput
                    label="Vehicle fitness expiry (optional)"
                    value={form.fitnessExpiry}
                    onChangeText={(value) => updateForm("fitnessExpiry", value)}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    onPress={() => void submitApplication()}
                    disabled={submittingApplication}
                    className="mt-2 rounded-2xl py-4"
                    style={{ backgroundColor: theme.primary[300] }}
                  >
                    {submittingApplication ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text className="text-center font-rubik-bold text-white">
                        Submit application
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {!applicationApproved && profile && (
                  <View
                    className="mt-5 rounded-2xl border p-5"
                    style={{
                      backgroundColor: `${statusColor}0D`,
                      borderColor: `${statusColor}35`,
                    }}
                  >
                    <View className="flex-row items-start">
                      <Ionicons
                        name={
                          profile.verificationStatus === "rejected"
                            ? "close-circle-outline"
                            : "time-outline"
                        }
                        size={23}
                        color={statusColor}
                      />
                      <View className="ml-3 flex-1">
                        <Text
                          className="font-rubik-bold"
                          style={{ color: theme.title }}
                        >
                          {profile.verificationStatus === "rejected"
                            ? "Application needs changes"
                            : "Institution review pending"}
                        </Text>
                        <Text
                          className="mt-1 text-sm"
                          style={{ color: theme.muted }}
                        >
                          {institution?.organizationName || "Your institution"}
                          {" reviews this application through Nookly Web. You cannot receive student ride requests until both the driver and vehicle are approved."}
                        </Text>
                      </View>
                    </View>

                    {profile.verificationStatus === "rejected" && (
                      <TouchableOpacity
                        onPress={() => setShowApplicationForm(true)}
                        className="mt-4 rounded-xl py-3"
                        style={{ backgroundColor: statusColor }}
                      >
                        <Text className="text-center font-rubik-bold text-white">
                          Update and resubmit
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View
                  className="mt-5 rounded-2xl border p-5"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: `${theme.muted}25`,
                  }}
                >
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Institution verification
                  </Text>

                  <View className="mt-4 gap-3">
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Institution</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedInstitutionName}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Application</Text>
                      <Text
                        className="font-rubik-medium"
                        style={{ color: statusColor }}
                      >
                        {readableStatus(institution?.status)}
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  className="mt-5 rounded-2xl border p-5"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: `${theme.muted}25`,
                  }}
                >
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Licence and emergency contact
                  </Text>

                  <View className="mt-4 gap-3">
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Licence number</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedLicenceNumber}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Licence expiry</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {formatProfileDate(retainedLicenceExpiry)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Emergency contact</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedEmergencyName}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Emergency phone</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedEmergencyPhone}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: theme.muted }}>Completed trips</Text>
                      <Text
                        className="font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {profile?.completedTrips ?? 0}
                      </Text>
                    </View>
                    <View className="flex-row justify-between">
                      <Text style={{ color: theme.muted }}>Rating</Text>
                      <Text
                        className="font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {profile?.rating?.toFixed(1) || "0.0"}
                      </Text>
                    </View>
                  </View>
                </View>

                <View
                  className="mt-5 rounded-2xl border p-5"
                  style={{
                    backgroundColor: theme.surface,
                    borderColor: `${theme.muted}25`,
                  }}
                >
                  <Text
                    className="text-lg font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Registered vehicle
                  </Text>

                  <View className="mt-4 gap-3">
                    <Text
                      className="text-base font-rubik-bold"
                      style={{ color: theme.text }}
                    >
                      {[
                        retainedVehicleColor,
                        retainedVehicleMake,
                        retainedVehicleModel,
                      ]
                        .filter(Boolean)
                        .join(" ") || "Vehicle details retained"}
                    </Text>

                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Registration</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedVehicleRegistration}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Vehicle type</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedVehicleType}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Passenger capacity</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedVehicleCapacity || "Not provided"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Manufacture year</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {retainedManufactureYear || "Not provided"}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Insurance expiry</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {formatProfileDate(retainedInsuranceExpiry)}
                      </Text>
                    </View>
                    <View className="flex-row justify-between gap-4">
                      <Text style={{ color: theme.muted }}>Fitness expiry</Text>
                      <Text
                        className="flex-1 text-right font-rubik-medium"
                        style={{ color: theme.text }}
                      >
                        {formatProfileDate(retainedFitnessExpiry)}
                      </Text>
                    </View>

                    <Text
                      className="mt-1 text-sm font-rubik-medium"
                      style={{
                        color:
                          vehicle?.status === "active" ? "#16A34A" : "#D97706",
                      }}
                    >
                      {vehicle
                        ? `${readableStatus(vehicle.status)} vehicle`
                        : "Waiting for vehicle record"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </>
        )}

        <TouchableOpacity
          onPress={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-7 rounded-2xl border py-4"
          style={{
            borderColor: theme.danger,
            backgroundColor: `${theme.danger}08`,
          }}
        >
          {signingOut ? (
            <ActivityIndicator color={theme.danger} />
          ) : (
            <Text
              className="text-center font-rubik-bold"
              style={{ color: theme.danger }}
            >
              Sign out
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
