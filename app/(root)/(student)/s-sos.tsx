import SearchableInstitutionPicker from "@/components/SearchableInstitutionPicker";
import StudentSosSafetyModeCard from "@/components/student-sos/StudentSosSafetyModeCard";
import { Colors } from "@/constants/Colors";
import { isStudentTenant } from "@/lib/userMode";
import studentSosService from "@/services/student-sos.service";
import useAuthStore from "@/store/auth.store";

import type {
  StudentSosIncidentType,
  StudentSosLocation,
  StudentSosResult,
} from "@/types/student-sos";

import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

interface SosOption {
  type: StudentSosIncidentType;
  label: string;
  icon:
    keyof typeof Ionicons.glyphMap;
}

const SOS_OPTIONS: SosOption[] = [
  {
    type: "robbery",
    label: "Robbery",
    icon: "cash-outline",
  },
  {
    type: "burglary",
    label: "Burglary",
    icon: "home-outline",
  },
  {
    type: "being_followed",
    label: "Being followed",
    icon: "walk-outline",
  },
  {
    type: "assault_or_threat",
    label: "Assault or threat",
    icon: "warning-outline",
  },
  {
    type: "medical_emergency",
    label: "Medical emergency",
    icon: "medkit-outline",
  },
  {
    type: "unsafe_transport",
    label: "Unsafe transport",
    icon: "car-outline",
  },
  {
    type: "other_danger",
    label: "Other danger",
    icon: "alert-circle-outline",
  },
];

export default function StudentSosScreen() {
  const colorScheme =
    useColorScheme();

  const theme =
    Colors[colorScheme ?? "light"];

  const {
    user,
    updateUser,
  } = useAuthStore();

  const [
    location,
    setLocation,
  ] =
    useState<StudentSosLocation | null>(
      null,
    );

  const [
    locationError,
    setLocationError,
  ] = useState("");

  const [
    loadingLocation,
    setLoadingLocation,
  ] = useState(false);

  const [
    sendingType,
    setSendingType,
  ] =
    useState<StudentSosIncidentType | null>(
      null,
    );

  const [
    lastAlert,
    setLastAlert,
  ] =
    useState<StudentSosResult | null>(
      null,
    );

  const [
    selectedInstitutionName,
    setSelectedInstitutionName,
  ] = useState(
    user?.schoolLocation?.trim() ||
      "",
  );

  const [
    selectedOrganizationId,
    setSelectedOrganizationId,
  ] = useState(
    user?.organizationId?.trim() ||
      "",
  );

  const [
    linkingInstitution,
    setLinkingInstitution,
  ] = useState(false);

  const [
    linkError,
    setLinkError,
  ] = useState("");

  const institutionLinked =
    Boolean(
      user?.organizationId?.trim(),
    );

  const institutionName =
    user?.schoolLocation?.trim() ||
    selectedInstitutionName ||
    "your Institution";

  const loadLocation =
    useCallback(async () => {
      if (
        !user
          ?.organizationId
          ?.trim()
      ) {
        setLoadingLocation(false);
        setLocation(null);
        return;
      }

      setLoadingLocation(true);
      setLocationError("");

      try {
        const currentLocation =
          await studentSosService
            .getCurrentLocation();

        setLocation(
          currentLocation,
        );
      } catch (error) {
        setLocation(null);

        setLocationError(
          error instanceof Error
            ? error.message
            : "Could not get your location.",
        );
      } finally {
        setLoadingLocation(false);
      }
    }, [user?.organizationId]);

  useEffect(() => {
    setSelectedInstitutionName(
      user?.schoolLocation?.trim() ||
        "",
    );

    setSelectedOrganizationId(
      user
        ?.organizationId
        ?.trim() || "",
    );
  }, [
    user?.schoolLocation,
    user?.organizationId,
  ]);

  useEffect(() => {
    if (
      user &&
      isStudentTenant(user) &&
      user.organizationId?.trim()
    ) {
      void loadLocation();
    }
  }, [
    loadLocation,
    user?.accountId,
    user?.organizationId,
  ]);

  const linkInstitution =
    async () => {
      if (
        !selectedInstitutionName.trim() ||
        !selectedOrganizationId.trim()
      ) {
        setLinkError(
          "Pick your Institution.",
        );
        return;
      }

      setLinkingInstitution(true);
      setLinkError("");

      try {
        const result =
          await updateUser({
            schoolLocation:
              selectedInstitutionName.trim(),
            organizationId:
              selectedOrganizationId.trim(),
            tenantType: "student",
          });

        if (!result.success) {
          throw new Error(
            result.error ||
              "Could not link your Institution.",
          );
        }

        await Haptics
          .notificationAsync(
            Haptics
              .NotificationFeedbackType
              .Success,
          );
      } catch (error) {
        setLinkError(
          error instanceof Error
            ? error.message
            : "Could not link your Institution.",
        );
      } finally {
        setLinkingInstitution(false);
      }
    };

  const sendSos = async (
    option: SosOption,
  ) => {
    if (sendingType) {
      return;
    }

    setSendingType(option.type);
    setLastAlert(null);

    try {
      await Haptics
        .notificationAsync(
          Haptics
            .NotificationFeedbackType
            .Warning,
        );

      const freshLocation =
        await studentSosService
          .getCurrentLocation();

      setLocation(freshLocation);

      const result =
        await studentSosService.send(
          option.type,
          freshLocation,
        );

      setLastAlert(result);

      await Haptics
        .notificationAsync(
          Haptics
            .NotificationFeedbackType
            .Success,
        );

      const pushAccepted =
        Number(
          result.push?.accepted ?? 0,
        );

      const confirmationMessage =
        pushAccepted > 0
          ? `Your SOS was recorded and a mobile push alert was accepted for ${result.organizationName}.`
          : `Your SOS was recorded for ${result.organizationName}. No active mobile push device was available, but the in-app alert was saved.`;

      Alert.alert(
        result.duplicate
          ? "SOS already recorded"
          : "SOS recorded",
        confirmationMessage,
      );
    } catch (error) {
      await Haptics
        .notificationAsync(
          Haptics
            .NotificationFeedbackType
            .Error,
        );

      Alert.alert(
        "SOS not sent",
        error instanceof Error
          ? error.message
          : "The SOS could not be sent.",
      );
    } finally {
      setSendingType(null);
    }
  };

  const confirmSos = (
    option: SosOption,
  ) => {
    if (!location) {
      Alert.alert(
        "Location required",
        "Nookly needs your current location before sending an SOS.",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Get location",
            onPress: () => {
              void loadLocation();
            },
          },
        ],
      );

      return;
    }

    Alert.alert(
      `Send ${option.label} SOS?`,
      `Your identity and current location will be sent immediately to ${institutionName}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "SEND SOS",
          style: "destructive",
          onPress: () => {
            void sendSos(option);
          },
        },
      ],
    );
  };

  if (
    !user ||
    !isStudentTenant(user)
  ) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center px-8"
        style={{
          backgroundColor:
            theme.background,
        }}
      >
        <Ionicons
          name="lock-closed-outline"
          size={42}
          color={theme.muted}
        />

        <Text
          className="text-xl font-rubik-bold mt-4"
          style={{
            color: theme.title,
          }}
        >
          Student access only
        </Text>

        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          className="mt-6 rounded-full px-6 py-3"
          style={{
            backgroundColor:
              theme.primary[300],
          }}
        >
          <Text className="text-white font-rubik-bold">
            Go back
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const canSend =
    institutionLinked &&
    Boolean(location) &&
    !loadingLocation &&
    !sendingType;

  return (
    <SafeAreaView
      className="flex-1"
      edges={[
        "top",
        "left",
        "right",
      ]}
      style={{
        backgroundColor:
          theme.background,
      }}
    >
      <StatusBar
        barStyle={
          colorScheme === "dark"
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={
          theme.background
        }
      />

      <View
        className="flex-row items-center px-5 py-3"
        style={{
          borderBottomWidth: 1,
          borderBottomColor:
            `${theme.muted}20`,
        }}
      >
        <TouchableOpacity
          onPress={() =>
            router.back()
          }
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{
            backgroundColor:
              theme.surface,
          }}
        >
          <Ionicons
            name="chevron-back"
            size={23}
            color={theme.title}
          />
        </TouchableOpacity>

        <View className="flex-1 ml-3">
          <Text
            className="text-xl font-rubik-bold"
            style={{
              color: theme.title,
            }}
          >
            Emergency SOS
          </Text>

          <Text
            numberOfLines={1}
            className="text-xs mt-0.5"
            style={{
              color: theme.muted,
            }}
          >
            {institutionLinked
              ? `Alert ${institutionName}`
              : "Pick your Institution first"}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: 50,
        }}
      >
        {!institutionLinked ? (
          <View>
            <View className="items-center">
              <View
                className="w-20 h-20 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    `${theme.primary[300]}18`,
                }}
              >
                <Ionicons
                  name="school-outline"
                  size={38}
                  color={
                    theme.primary[300]
                  }
                />
              </View>

              <Text
                className="text-2xl font-rubik-bold mt-4 text-center"
                style={{
                  color: theme.title,
                }}
              >
                Pick your Institution
              </Text>

              <Text
                className="text-sm mt-2 text-center leading-5"
                style={{
                  color: theme.muted,
                }}
              >
                Select the exact school
                registered on Nookly. You
                only need to do this once.
              </Text>
            </View>

            <View className="mt-7">
              <SearchableInstitutionPicker
                studentMode
                value={
                  selectedInstitutionName
                }
                organizationId={
                  selectedOrganizationId
                }
                onChange={
                  setSelectedInstitutionName
                }
                onOrganizationChange={(
                  organization,
                ) => {
                  setSelectedOrganizationId(
                    organization?.$id ||
                      "",
                  );

                  setLinkError("");
                }}
                error={linkError}
              />
            </View>

            <TouchableOpacity
              onPress={() => {
                void linkInstitution();
              }}
              disabled={
                linkingInstitution ||
                !selectedOrganizationId
              }
              activeOpacity={0.85}
              className="rounded-2xl py-4 mt-6 items-center justify-center"
              style={{
                backgroundColor:
                  linkingInstitution ||
                  !selectedOrganizationId
                    ? theme.muted
                    : theme.primary[300],
              }}
            >
              {linkingInstitution ? (
                <View className="flex-row items-center">
                  <ActivityIndicator
                    size="small"
                    color="#FFFFFF"
                  />

                  <Text className="text-white font-rubik-bold ml-2">
                    Linking...
                  </Text>
                </View>
              ) : (
                <Text className="text-white font-rubik-bold">
                  Link Institution
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <StudentSosSafetyModeCard />

            <View className="items-center">
              <View
                className="w-20 h-20 rounded-full items-center justify-center"
                style={{
                  backgroundColor:
                    "#DC2626",
                }}
              >
                <Ionicons
                  name="shield-outline"
                  size={40}
                  color="#FFFFFF"
                />
              </View>

              <Text
                className="text-2xl font-rubik-bold mt-4 text-center"
                style={{
                  color: theme.title,
                }}
              >
                What is happening?
              </Text>

              <Text
                className="text-sm mt-2 text-center leading-5"
                style={{
                  color: theme.muted,
                }}
              >
                Choose one emergency below.
                Your current location will
                be included.
              </Text>
            </View>

            <View
              className="rounded-2xl px-4 py-4 mt-6"
              style={{
                backgroundColor:
                  location
                    ? "#10B98112"
                    : "#DC262612",
                borderWidth: 1,
                borderColor:
                  location
                    ? "#10B98140"
                    : "#DC262640",
              }}
            >
              <View className="flex-row items-start">
                {loadingLocation ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      theme.primary[300]
                    }
                  />
                ) : (
                  <Ionicons
                    name={
                      location
                        ? "location"
                        : "location-outline"
                    }
                    size={23}
                    color={
                      location
                        ? "#10B981"
                        : "#DC2626"
                    }
                  />
                )}

                <View className="flex-1 ml-3">
                  <Text
                    className="text-xs font-rubik-medium"
                    style={{
                      color: theme.muted,
                    }}
                  >
                    Current location
                  </Text>

                  <Text
                    className="text-sm font-rubik-bold mt-1 leading-5"
                    style={{
                      color: theme.text,
                    }}
                  >
                    {loadingLocation
                      ? "Getting your current location..."
                      : location
                        ? location.address
                        : "Location unavailable"}
                  </Text>

                  {location && (
                    <View className="mt-2">
                      <Text
                        className="text-xs"
                        style={{
                          color: theme.muted,
                        }}
                      >
                        Latitude:{" "}
                        {location.latitude.toFixed(
                          6,
                        )}
                      </Text>

                      <Text
                        className="text-xs mt-1"
                        style={{
                          color: theme.muted,
                        }}
                      >
                        Longitude:{" "}
                        {location.longitude.toFixed(
                          6,
                        )}
                      </Text>

                      {location.accuracy !==
                        null && (
                        <Text
                          className="text-xs mt-1"
                          style={{
                            color:
                              theme.muted,
                          }}
                        >
                          Accuracy: about{" "}
                          {Math.round(
                            location.accuracy,
                          )}{" "}
                          metres
                        </Text>
                      )}
                    </View>
                  )}

                  {!!locationError && (
                    <Text
                      className="text-xs mt-2 leading-4"
                      style={{
                        color:
                          "#DC2626",
                      }}
                    >
                      {locationError}
                    </Text>
                  )}
                </View>

                {!loadingLocation && (
                  <TouchableOpacity
                    onPress={() => {
                      void loadLocation();
                    }}
                    className="rounded-full px-3 py-2 ml-2"
                    style={{
                      backgroundColor:
                        theme.surface,
                    }}
                  >
                    <Text
                      className="text-xs font-rubik-bold"
                      style={{
                        color:
                          theme.primary[300],
                      }}
                    >
                      Refresh
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View className="flex-row flex-wrap justify-between mt-6">
              {SOS_OPTIONS.map(
                (option) => {
                  const sending =
                    sendingType ===
                    option.type;

                  return (
                    <Pressable
                      key={option.type}
                      disabled={!canSend}
                      onPress={() =>
                        confirmSos(option)
                      }
                      className="w-[48%] min-h-[102px] rounded-2xl items-center justify-center px-3 mb-4"
                      style={({
                        pressed,
                      }) => ({
                        backgroundColor:
                          pressed
                            ? "#DC262620"
                            : theme.surface,
                        borderWidth: 1.5,
                        borderColor:
                          "#DC262650",
                        opacity:
                          canSend
                            ? 1
                            : 0.45,
                      })}
                    >
                      {sending ? (
                        <ActivityIndicator
                          color="#DC2626"
                        />
                      ) : (
                        <Ionicons
                          name={
                            option.icon
                          }
                          size={28}
                          color="#DC2626"
                        />
                      )}

                      <Text
                        className="text-sm font-rubik-bold text-center mt-3"
                        style={{
                          color:
                            theme.title,
                        }}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                },
              )}
            </View>

            {lastAlert && (
              <View
                className="rounded-2xl p-4 mt-1"
                style={{
                  backgroundColor:
                    "#10B98112",
                  borderColor:
                    "#10B98140",
                  borderWidth: 1,
                }}
              >
                <View className="flex-row items-center">
                  <Ionicons
                    name="checkmark-circle"
                    size={23}
                    color="#10B981"
                  />

                  <Text
                    className="font-rubik-bold ml-2"
                    style={{
                      color:
                        theme.title,
                    }}
                  >
                    SOS recorded successfully
                  </Text>
                </View>

                <Text
                  className="text-xs mt-2"
                  style={{
                    color: theme.muted,
                  }}
                >
                  Alert ID:{" "}
                  {lastAlert.alertId}
                </Text>
              </View>
            )}

            <View
              className="rounded-2xl p-4 mt-3 flex-row items-start"
              style={{
                backgroundColor:
                  "#DC26260D",
              }}
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color="#DC2626"
              />

              <Text
                className="text-xs leading-5 ml-2 flex-1"
                style={{
                  color: theme.text,
                }}
              >
                Use this only for genuine
                emergencies. This alerts
                your registered Institution;
                it does not automatically
                contact police or ambulance
                services.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}