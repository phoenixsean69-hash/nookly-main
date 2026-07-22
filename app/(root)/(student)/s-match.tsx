// app/match.tsx
import ContactModal from "@/components/ContactModal";
import ProfileHiddenModal from "@/components/ProfileHiddenModal";
import ProfilePostedModal from "@/components/ProfilePostedModal";
import ProfileUpdatedModal from "@/components/ProfileUpdatedModal";
import ProfileVisibleModal from "@/components/ProfileVisibleModal";
import { Colors } from "@/constants/Colors";
import {
  client,
  config,
  createMatchProfile,
  getMatchProfiles,
  getUserMatchProfile,
  MatchProfile,
  updateMatchProfile,
} from "@/lib/appwrite";
import {
  computeCompatibilityScore,
  isCompatibleMatch,
  normalizeLifestyle,
} from "@/lib/matching";
import useAuthStore from "@/store/auth.store";
import { useMatchStore } from "@/store/match.store";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const Match = () => {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const { markMatchesAsViewed, fetchMatchCount } = useMatchStore();
  const [contactModalVisible, setContactModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<MatchProfile | null>(null);

  const openContactModal = (match: MatchProfile) => {
    setSelectedMatch(match);
    setContactModalVisible(true);
  };

  const handleContact = (match: MatchProfile) => {
    openContactModal(match);
  };

  // UI States
  const [loading, setLoading] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [myProfile, setMyProfile] = useState<MatchProfile | null>(null);
  const [matches, setMatches] = useState<MatchProfile[]>([]);
  const [searchLocation, setSearchLocation] = useState("");
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [userType, setUserType] = useState<
    "student" | "professional" | "tenant"
  >("student");
  const [isActive, setIsActive] = useState(true);
  const [showProfileUpdated, setShowProfileUpdated] = useState(false);
  const [showProfilePosted, setShowProfilePosted] = useState(false);
  const [showProfileHidden, setShowProfileHidden] = useState(false);
  const [showProfileVisible, setShowProfileVisible] = useState(false);

  // Date picker states
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // Form Data (matching database schema)
  const [formData, setFormData] = useState({
    role: "",
    gender: "any",
    preferredGender: "any",
    budget: "",
    preferredLocation: "",
    preferredRoommateType: "",
    lifestyle: [] as string[],
    about: "",
    moveInDate: "",
    lookingFor: "roommate",
  });

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const lifestyleOptions = [
    "Churchgoer",
    "Sober",
    "Study-focused",
    "Social",
    "Quiet",
    "Night owl",
    "Early bird",
    "Pet lover",
    "Non-smoker",
  ];

  // Function to hide badge for 1 minute
  const hideBadgeFor1Minute = async () => {
    if (!user?.accountId) return;
    const hideUntil = Date.now() + 1 * 60 * 1000;
    await AsyncStorage.setItem(
      `badge_hidden_until_${user.accountId}`,
      hideUntil.toString(),
    );
  };

  // Clear badge when screen is focused
  useFocusEffect(
    useCallback(() => {
      hideBadgeFor1Minute();
    }, [user]),
  );

  useEffect(() => {
    checkUserProfile();
  }, []);

  useEffect(() => {
    if (!myProfile) return;

    const unsubscribe = client.subscribe(
      `databases.${config.databaseId}.collections.${config.matchProfilesCollectionId}.documents`,
      (response) => {
        const payload = response.payload;
        if (!isMatchProfile(payload)) return;

        const isCreate = response.events.some((e) => e.endsWith(".create"));
        const isUpdate = response.events.some((e) => e.endsWith(".update"));
        const isDelete = response.events.some((e) => e.endsWith(".delete"));

        // Remove deleted or deactivated profiles from the list
        if (isDelete || (isUpdate && payload.isActive === false)) {
          setMatches((prev) => prev.filter((p) => p.$id !== payload.$id));
          return;
        }

        if (!isCreate && !isUpdate) return;
        if (payload.userId === user?.accountId) return;
        if (payload.isActive === false) return;

        // Use the same shared matching logic as the main list
        if (!isCompatibleMatch(myProfile, payload)) {
          // An update may have made an existing match incompatible
          if (isUpdate) {
            setMatches((prev) => prev.filter((p) => p.$id !== payload.$id));
          }
          return;
        }

        const scored = {
          ...payload,
          lifestyle: normalizeLifestyle(payload.lifestyle),
          matchScore: computeCompatibilityScore(myProfile, payload),
        };

        setMatches((prev) => {
          const without = prev.filter((p) => p.$id !== scored.$id);
          return [...without, scored].sort(
            (a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0),
          );
        });
      },
    );

    return () => unsubscribe();
  }, [myProfile]);

  useFocusEffect(
    useCallback(() => {
      markMatchesAsViewed();
      if (user?.accountId) {
        fetchMatchCount(user.accountId);
      }
    }, [user, markMatchesAsViewed, fetchMatchCount]),
  );

  // Combine date when all fields are filled
  useEffect(() => {
    if (day && month && year) {
      const monthNumber = monthNames.findIndex((m) => m === month) + 1;
      if (monthNumber > 0) {
        const formattedDate = `${year}-${monthNumber.toString().padStart(2, "0")}-${day.padStart(2, "0")}`;
        setFormData((prev) => ({ ...prev, moveInDate: formattedDate }));
      }
    }
  }, [day, month, year]);

  const checkUserProfile = async () => {
    if (!user?.accountId) return;
    const profile = await getUserMatchProfile(user.accountId);
    if (profile) {
      setMyProfile(profile as unknown as MatchProfile);
      setHasProfile(true);
      setIsActive(profile.isActive ?? true);
      setFormData({
        role: profile.role || "",
        gender: profile.gender || "any",
        preferredGender: profile.preferredGender || "any",
        budget: profile.budget?.toString() || "",
        preferredLocation: profile.preferredLocation || "",
        preferredRoommateType: profile.preferredRoommateType || "",
        lifestyle: profile.lifestyle || [],
        about: profile.about || "",
        moveInDate: profile.moveInDate || "",
        lookingFor: profile.lookingFor || "roommate",
      });
      setUserType(profile.userType || "student");
      if (profile.isActive) {
        loadMatches(profile as unknown as MatchProfile);
      }
    }
    setLoading(false);
  };

  const isMatchProfile = (data: any): data is MatchProfile => {
    return data && typeof data === "object" && "preferredLocation" in data;
  };

  const loadMatches = async (profile: MatchProfile) => {
    if (!user?.accountId) return;

    setLoading(true);

    const profiles = await getMatchProfiles({
      location: profile.preferredLocation,
      myGender: profile.gender,
      preferredGender: profile.preferredGender as any,
      myBudget: profile.budget,
      myLifestyle: profile.lifestyle,
      myMoveInDate: profile.moveInDate,
      myLookingFor: profile.lookingFor,
      excludeUserId: user.accountId,
    });

    // Results come back ranked best-first; replace the list to stay sorted
    setMatches(profiles as unknown as MatchProfile[]);

    setLoading(false);
  };

  const searchMatches = async () => {
    if (!searchLocation.trim()) return;
    setLoading(true);
    const profiles = await getMatchProfiles({
      location: searchLocation,
      myGender: myProfile?.gender,
      preferredGender: myProfile?.preferredGender as any,
      myBudget: myProfile?.budget,
      myLifestyle: myProfile?.lifestyle,
      myMoveInDate: myProfile?.moveInDate,
      myLookingFor: myProfile?.lookingFor,
      excludeUserId: user?.accountId,
    });
    setMatches(profiles as unknown as MatchProfile[]);
    setLoading(false);
  };

  const toggleLifestyle = (option: string) => {
    if (formData.lifestyle.includes(option)) {
      setFormData({
        ...formData,
        lifestyle: formData.lifestyle.filter((l) => l !== option),
      });
    } else {
      setFormData({ ...formData, lifestyle: [...formData.lifestyle, option] });
    }
  };

  const handleToggleActiveStatus = async () => {
    if (!myProfile || !user?.accountId) return;

    const newStatus = !isActive;
    setIsActive(newStatus);

    try {
      await updateMatchProfile(myProfile.$id, { isActive: newStatus });

      if (newStatus) {
        setShowProfileVisible(true);
        loadMatches(myProfile as unknown as MatchProfile);
      } else {
        setShowProfileHidden(true);
        setMatches([]);
      }
    } catch (error) {
      console.error("Error updating profile status:", error);
      setIsActive(!newStatus);
    }
  };

  const handleSubmitProfile = async () => {
    if (!user?.accountId) {
      Alert.alert("Error", "Please log in first");
      return;
    }

    if (!formData.preferredLocation.trim() || !formData.budget.trim()) {
      Alert.alert(
        "Error",
        "Please fill in required fields (Location and Budget)",
      );
      return;
    }

    const budgetValue = parseInt(formData.budget, 10);
    if (isNaN(budgetValue) || budgetValue <= 0) {
      Alert.alert("Error", "Please enter a valid budget amount");
      return;
    }

    if (formData.gender !== "male" && formData.gender !== "female") {
      Alert.alert("Error", "Please select your gender");
      return;
    }

    setLoading(true);
    try {
      const profileData = {
        userId: user.accountId,
        userType,
        name: user.name || "User",
        email: user.email || "",
        phone: user.phone || "",
        avatar: user.avatar,
        role:
          formData.role ||
          (userType === "student" ? "Student" : "Professional"),
        gender: formData.gender as any,
        preferredGender: formData.preferredGender as any,
        budget: budgetValue,
        preferredLocation: formData.preferredLocation,
        preferredRoommateType: formData.preferredRoommateType,
        lifestyle: formData.lifestyle,
        about: formData.about,
        moveInDate: formData.moveInDate || "Flexible",
        lookingFor: formData.lookingFor,
        isActive: true,
      };

      if (hasProfile && myProfile) {
        await updateMatchProfile(myProfile.$id, profileData);
        setMatches([]);
        await loadMatches({ ...myProfile, ...profileData } as MatchProfile);
        setShowProfileUpdated(true);
      } else {
        await createMatchProfile(profileData);
        setShowProfilePosted(true);
      }

      setShowProfileForm(false);
      checkUserProfile();
    } catch (error) {
      console.error("Error saving profile:", error);
      Alert.alert("Error", "Failed to save profile");
    } finally {
      setLoading(false);
    }
  };

  const contactMatch = (match: MatchProfile) => {
    Alert.alert(
      "Contact",
      `${match.name}\nEmail: ${match.email}\nPhone: ${match.phone || "Not provided"}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: () => Linking.openURL(`mailto:${match.email}`),
        },
        ...(match.phone
          ? [
              {
                text: "Call",
                onPress: () => Linking.openURL(`tel:${match.phone}`),
              },
            ]
          : []),
      ],
    );
  };

  const renderProfileForm = () => (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
      style={{ flex: 1 }}
    >
      <ScrollView
        className="p-5"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* User Type Selection */}
        <View className="mb-6">
          <Text
            className="text-base font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            I am a...
          </Text>
          <View className="flex-row gap-3">
            {[
              { value: "student", label: "Student", icon: "school-outline" },
              {
                value: "professional",
                label: "Professional",
                icon: "briefcase-outline",
              },
              { value: "tenant", label: "Tenant", icon: "home-outline" },
            ].map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setUserType(type.value as any)}
                className={`flex-1 py-3 rounded-xl items-center ${
                  userType === type.value ? "bg-primary-300" : "border"
                }`}
                style={{
                  backgroundColor:
                    userType === type.value ? theme.primary[300] : undefined,
                  borderColor: theme.muted + "40",
                }}
              >
                <Ionicons
                  name={type.icon as any}
                  size={22}
                  color={userType === type.value ? "#fff" : theme.muted}
                />
                <Text
                  className={`text-center text-sm font-rubik-medium mt-1 ${
                    userType === type.value ? "text-white" : ""
                  }`}
                  style={{
                    color: userType === type.value ? "#fff" : theme.text,
                  }}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text
            className="text-sm font-rubik-medium mb-1"
            style={{ color: theme.muted }}
          >
            Need a place in...
          </Text>
          <TextInput
            value={formData.preferredLocation}
            onChangeText={(text) =>
              setFormData({ ...formData, preferredLocation: text })
            }
            placeholder="e.g., Bindura near FSE campus"
            className="border rounded-xl px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "40",
              color: theme.text,
            }}
            placeholderTextColor={theme.muted}
          />
        </View>

        <View className="mb-4">
          {/* My Gender Section */}
          <View
            className="p-4 rounded-2xl mb-4"
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.muted + "20",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text
              className="text-sm font-rubik-bold mb-3"
              style={{ color: theme.primary[300] }}
            >
              My Gender
            </Text>
            <View className="flex-row gap-2">
              {["male", "female"].map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => setFormData({ ...formData, gender: g as any })}
                  className={`flex-1 py-3 rounded-xl ${
                    formData.gender === g ? "bg-primary-300" : "border"
                  }`}
                  style={{
                    backgroundColor:
                      formData.gender === g
                        ? theme.primary[300]
                        : theme.background,
                    borderColor: theme.muted + "40",
                  }}
                >
                  <Text
                    className={`text-center text-sm font-rubik-medium ${
                      formData.gender === g ? "text-white font-rubik-bold" : ""
                    }`}
                    style={{
                      color: formData.gender === g ? "#fff" : theme.text,
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Divider with arrow */}
          <View className="items-center my-2">
            <View className="w-12 h-12 rounded-full bg-primary-100 items-center justify-center">
              <Ionicons
                name="arrow-down-outline"
                size={24}
                color={theme.primary[300]}
              />
            </View>
          </View>

          {/* Looking For Section */}
          <View
            className="p-4 rounded-2xl"
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.muted + "20",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 4,
              elevation: 2,
            }}
          >
            <Text
              className="text-sm font-rubik-bold mb-3"
              style={{ color: theme.primary[300] }}
            >
              Looking for
            </Text>
            <View className="flex-row gap-2">
              {["male", "female"].map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() =>
                    setFormData({ ...formData, preferredGender: g as any })
                  }
                  className={`flex-1 py-3 rounded-xl ${
                    formData.preferredGender === g ? "bg-primary-300" : "border"
                  }`}
                  style={{
                    backgroundColor:
                      formData.preferredGender === g
                        ? theme.primary[300]
                        : theme.background,
                    borderColor: theme.muted + "40",
                  }}
                >
                  <Text
                    className={`text-center text-sm font-rubik-medium ${
                      formData.preferredGender === g
                        ? "text-white font-rubik-bold"
                        : ""
                    }`}
                    style={{
                      color:
                        formData.preferredGender === g ? "#fff" : theme.text,
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View className="mb-4">
          <Text
            className="text-sm font-rubik-medium mb-1"
            style={{ color: theme.muted }}
          >
            My Budget (USD/month)
          </Text>
          <TextInput
            value={formData.budget}
            onChangeText={(text) => setFormData({ ...formData, budget: text })}
            keyboardType="numeric"
            placeholder="e.g., 80"
            className="border rounded-xl px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "40",
              color: theme.text,
            }}
            placeholderTextColor={theme.muted}
          />
        </View>

        {/* Preferences */}
        <Text
          className="text-lg font-rubik-bold mt-4 mb-3"
          style={{ color: theme.title }}
        >
          Preferences
        </Text>

        <View className="mb-4">
          <Text
            className="text-sm font-rubik-medium mb-1"
            style={{ color: theme.muted }}
          >
            Preferred Roommate Type
          </Text>
          <TextInput
            value={formData.preferredRoommateType}
            onChangeText={(text) =>
              setFormData({ ...formData, preferredRoommateType: text })
            }
            placeholder="e.g., Churchgoer, Sober sense"
            className="border rounded-xl px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "40",
              color: theme.text,
            }}
            placeholderTextColor={theme.muted}
          />
        </View>

        <View className="mb-4 mt-5">
          <Text
            className="text-sm font-rubik-medium mb-2"
            style={{ color: theme.muted }}
          >
            My Lifestyle (select all that apply)
          </Text>
          <FlatList
            data={lifestyleOptions}
            numColumns={3}
            keyExtractor={(item) => item}
            scrollEnabled={false}
            columnWrapperStyle={{ gap: 8, justifyContent: "space-between" }}
            renderItem={({ item: option }) => {
              const getIcon = () => {
                switch (option) {
                  case "Churchgoer":
                    return "book-outline";
                  case "Sober":
                    return "wine-outline";
                  case "Study-focused":
                    return "book-outline";
                  case "Social":
                    return "people-outline";
                  case "Quiet":
                    return "volume-mute-outline";
                  case "Night owl":
                    return "moon-outline";
                  case "Early bird":
                    return "sunny-outline";
                  case "Pet lover":
                    return "paw-outline";
                  case "Non-smoker":
                    return "leaf-outline";
                  default:
                    return "checkmark-outline";
                }
              };

              return (
                <TouchableOpacity
                  onPress={() => toggleLifestyle(option)}
                  className="flex-1 m-1 px-3 py-2 rounded-full flex-row items-center justify-center gap-1"
                  style={{
                    backgroundColor: formData.lifestyle.includes(option)
                      ? theme.primary[300]
                      : theme.surface,
                    borderWidth: 1,
                    borderColor: formData.lifestyle.includes(option)
                      ? theme.primary[300]
                      : theme.muted + "40",
                  }}
                >
                  <Ionicons
                    name={getIcon()}
                    size={14}
                    color={
                      formData.lifestyle.includes(option) ? "#fff" : theme.muted
                    }
                  />
                  <Text
                    className={`text-sm font-rubik-medium ${
                      formData.lifestyle.includes(option) ? "text-white" : ""
                    }`}
                    style={{
                      color: formData.lifestyle.includes(option)
                        ? "#fff"
                        : theme.text,
                    }}
                    numberOfLines={1}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View className="mb-4 mt-5">
          <Text
            className="text-sm font-rubik-medium mb-1"
            style={{ color: theme.muted }}
          >
            About Me
          </Text>
          <TextInput
            value={formData.about}
            onChangeText={(text) => setFormData({ ...formData, about: text })}
            placeholder="Tell potential roommates about yourself..."
            multiline
            numberOfLines={4}
            className="border rounded-xl px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "40",
              color: theme.text,
              minHeight: 100,
            }}
            placeholderTextColor={theme.muted}
          />
        </View>

        <View className="mb-4">
          <Text
            className="text-sm font-rubik-medium mb-2"
            style={{ color: theme.muted }}
          >
            Preferred Move-in Date
          </Text>

          {/* Day Selector */}
          <View className="mb-4">
            <Text
              className="text-xs font-rubik-medium mb-1"
              style={{ color: theme.muted }}
            >
              Day
            </Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() =>
                  setDay((prev) => {
                    const current = parseInt(prev || "0");
                    const newValue = Math.max(1, current - 1);
                    return newValue.toString();
                  })
                }
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.primary[100] }}
              >
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  -
                </Text>
              </TouchableOpacity>

              <TextInput
                value={day}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  if (text === "") {
                    setDay("");
                  } else if (!isNaN(num) && num >= 1 && num <= 31) {
                    setDay(num.toString());
                  }
                }}
                keyboardType="numeric"
                placeholder="DD"
                maxLength={2}
                className="flex-1 h-12 text-center border rounded-xl"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "40",
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: "bold",
                }}
                placeholderTextColor={theme.muted}
              />

              <TouchableOpacity
                onPress={() =>
                  setDay((prev) => {
                    const current = parseInt(prev || "0");
                    const newValue = Math.min(31, current + 1);
                    return newValue.toString();
                  })
                }
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.primary[100] }}
              >
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Month Selector */}
          <View className="mb-4">
            <Text
              className="text-xs font-rubik-medium mb-1"
              style={{ color: theme.muted }}
            >
              Month
            </Text>
            <TouchableOpacity
              onPress={() => setShowMonthPicker(true)}
              className="border rounded-xl px-4 py-3 flex-row justify-between items-center"
              style={{
                backgroundColor: theme.surface,
                borderColor: theme.muted + "40",
              }}
            >
              <Text style={{ color: month ? theme.text : theme.muted }}>
                {month || "Select Month"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={theme.muted} />
            </TouchableOpacity>
          </View>

          {/* Year Selector */}
          <View className="mb-4">
            <Text
              className="text-xs font-rubik-medium mb-1"
              style={{ color: theme.muted }}
            >
              Year
            </Text>
            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() =>
                  setYear((prev) => {
                    const current = parseInt(prev || "2024");
                    const newValue = current - 1;
                    return newValue.toString();
                  })
                }
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.primary[100] }}
              >
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  -
                </Text>
              </TouchableOpacity>

              <TextInput
                value={year}
                onChangeText={(text) => {
                  const num = parseInt(text);
                  if (text === "") {
                    setYear("");
                  } else if (!isNaN(num) && num >= 2024 && num <= 2035) {
                    setYear(num.toString());
                  }
                }}
                keyboardType="numeric"
                placeholder="YYYY"
                maxLength={4}
                className="flex-1 h-12 text-center border rounded-xl"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: theme.muted + "40",
                  color: theme.text,
                  fontSize: 18,
                  fontWeight: "bold",
                }}
                placeholderTextColor={theme.muted}
              />

              <TouchableOpacity
                onPress={() =>
                  setYear((prev) => {
                    const current = parseInt(prev || "2024");
                    const newValue = Math.min(2035, current + 1);
                    return newValue.toString();
                  })
                }
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{ backgroundColor: theme.primary[100] }}
              >
                <Text
                  className="text-xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  +
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Display formatted date */}
          {day && month && year && (
            <View className="mt-2 p-3 rounded-lg bg-primary-100">
              <Text
                className="text-center text-sm font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                Selected Date: {month} {parseInt(day)}, {year}
              </Text>
            </View>
          )}
        </View>

        <View className="mb-6">
          <Text
            className="text-sm font-rubik-medium mb-1"
            style={{ color: theme.muted }}
          >
            Looking for
          </Text>
          <View className="flex-row gap-3">
            {["roommate", "place to rent", "both"].map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setFormData({ ...formData, lookingFor: option })}
                className={`flex-1 py-2 rounded-xl ${
                  formData.lookingFor === option ? "bg-primary-300" : "border"
                }`}
                style={{
                  backgroundColor:
                    formData.lookingFor === option
                      ? theme.primary[300]
                      : undefined,
                  borderColor: theme.muted + "40",
                }}
              >
                <Text
                  className={`text-center ${
                    formData.lookingFor === option ? "text-white" : ""
                  }`}
                  style={{
                    color: formData.lookingFor === option ? "#fff" : theme.text,
                  }}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmitProfile}
          disabled={loading}
          className="py-4 rounded-xl mb-10"
          style={{ backgroundColor: theme.primary[300] }}
        >
          <Text className="text-white text-center font-rubik-bold text-lg">
            {loading
              ? "Saving..."
              : hasProfile
                ? "Update Profile"
                : "Post My Search"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const renderMatchesList = () => (
    <>
      {/* Search Bar */}
      <View className="px-5 mt-4 mb-5">
        <View className="flex-row gap-3">
          <TextInput
            placeholder="Search by location..."
            value={searchLocation}
            onChangeText={setSearchLocation}
            className="flex-1 border rounded-xl px-4 py-3"
            style={{
              backgroundColor: theme.surface,
              borderColor: theme.muted + "40",
              color: theme.text,
            }}
            placeholderTextColor={theme.muted}
            returnKeyType="search"
            onSubmitEditing={searchMatches}
          />
          <TouchableOpacity
            onPress={searchMatches}
            className="px-5 rounded-xl items-center justify-center"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Ionicons name="search" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Matches List */}
      <FlatList
        data={matches}
        keyExtractor={(item) => item.$id}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={() => (
          <Text
            className="text-base font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            {matches.length} Potential Match{matches.length !== 1 ? "es" : ""}
          </Text>
        )}
        ListEmptyComponent={() => (
          <View className="items-center py-10">
            <Ionicons name="people-outline" size={50} color={theme.muted} />
            <Text className="text-center mt-3" style={{ color: theme.muted }}>
              No matches found yet
            </Text>
            <Text
              className="text-center text-sm mt-1"
              style={{ color: theme.muted }}
            >
              Try searching a different location
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View
            className="mb-4 rounded-2xl overflow-hidden"
            style={{
              backgroundColor: theme.surface,
              borderWidth: 1,
              borderColor: theme.muted + "30",
            }}
          >
            <View className="p-4">
              <View className="flex-row items-start">
                <View className="w-14 h-14 rounded-full overflow-hidden mr-3">
                  {item.avatar ? (
                    <Image
                      source={{ uri: item.avatar }}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="w-full h-full bg-primary-100 items-center justify-center">
                      <Text className="text-xl font-rubik-bold text-primary-300">
                        {item.name?.charAt(0) || "?"}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-lg font-rubik-bold flex-1 pr-2"
                      style={{ color: theme.title }}
                      numberOfLines={1}
                    >
                      {item.name}
                    </Text>
                    {typeof item.matchScore === "number" && (
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{ backgroundColor: theme.primary[100] }}
                      >
                        <Text
                          className="text-xs font-rubik-bold"
                          style={{ color: theme.primary[300] }}
                        >
                          {item.matchScore}% match
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm" style={{ color: theme.muted }}>
                    {item.userType === "student" ? "Student" : item.userType} •
                    Budget: ${item.budget}/month
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: theme.primary[300] }}
                  >
                    Searching in: {item.preferredLocation}
                  </Text>
                </View>
              </View>

              <View
                className="mt-3 pt-3 border-t"
                style={{ borderTopColor: theme.muted + "20" }}
              >
                <Text
                  className="text-sm"
                  style={{ color: theme.muted }}
                  numberOfLines={2}
                >
                  {item.about || "No description provided"}
                </Text>
              </View>

              <View className="flex-row gap-3 mt-4">
                <TouchableOpacity
                  onPress={() => openContactModal(item)}
                  className="flex-1 py-2 rounded-full"
                  style={{ backgroundColor: theme.primary[300] }}
                >
                  <Text className="text-white text-center font-rubik-medium text-sm">
                    Contact
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => Linking.openURL(`mailto:${item.email}`)}
                  className="flex-1 py-2 rounded-full border"
                  style={{ borderColor: theme.primary[300] }}
                >
                  <Text
                    className="text-center font-rubik-medium text-sm"
                    style={{ color: theme.primary[300] }}
                  >
                    Email
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />
    </>
  );

  // Month Picker Modal
  const renderMonthPickerModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showMonthPicker}
      onRequestClose={() => setShowMonthPicker(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-4"
          style={{ backgroundColor: theme.surface }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              Select Month
            </Text>
            <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
              <Ionicons name="close" size={24} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView className="max-h-80">
            {monthNames.map((m) => (
              <TouchableOpacity
                key={m}
                onPress={() => {
                  setMonth(m);
                  setShowMonthPicker(false);
                }}
                className="p-4 rounded-xl mb-2"
                style={{
                  backgroundColor:
                    month === m ? theme.primary[100] : theme.surface,
                }}
              >
                <Text
                  className="text-center"
                  style={{
                    color: month === m ? theme.primary[300] : theme.text,
                    fontWeight: month === m ? "bold" : "normal",
                  }}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // No profile yet - show prompt
  if (!hasProfile && !showProfileForm && !loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          className="flex-row items-center px-5 py-4 border-b"
          style={{ borderBottomColor: theme.muted + "30" }}
        >
          <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
            <Ionicons name="arrow-back" size={24} color={theme.title} />
          </TouchableOpacity>
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            Match Me
          </Text>
        </View>

        <View className="flex-1 justify-center items-center p-6">
          <Ionicons name="people-outline" size={80} color={theme.muted} />
          <Text
            className="text-xl font-rubik-bold text-center mt-4"
            style={{ color: theme.title }}
          >
            Find Your Perfect Match
          </Text>
          <Text
            className="text-sm text-center mt-2 mb-8"
            style={{ color: theme.muted }}
          >
            Post your search details to find compatible roommates or housing
          </Text>
          <TouchableOpacity
            onPress={() => setShowProfileForm(true)}
            className="px-8 py-4 rounded-full"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-white font-rubik-bold text-lg">
              Post My Search
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show profile form
  if (showProfileForm || (!hasProfile && !loading)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View
          className="flex-row items-center px-5 py-4 border-b"
          style={{ borderBottomColor: theme.muted + "30" }}
        >
          <TouchableOpacity
            onPress={() => {
              if (hasProfile) {
                setShowProfileForm(false);
              } else {
                router.back();
              }
            }}
            className="mr-4 p-2"
          >
            <Ionicons name="arrow-back" size={24} color={theme.title} />
          </TouchableOpacity>
          <Text
            className="text-2xl font-rubik-bold"
            style={{ color: theme.title }}
          >
            {hasProfile ? "Edit Profile" : "Post Your Search"}
          </Text>
        </View>
        {renderProfileForm()}
        {renderMonthPickerModal()}
      </SafeAreaView>
    );
  }

  // Main view
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.surface }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2">
          <Ionicons name="arrow-back" size={24} color={theme.title} />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          Match Me
        </Text>
        <TouchableOpacity
          onPress={() => setShowProfileForm(true)}
          className="p-2"
        >
          <Ionicons
            name="create-outline"
            size={24}
            color={theme.primary[300]}
          />
        </TouchableOpacity>
      </View>

      {/* Profile Summary Card */}
      <View
        className="mx-5 mt-4 rounded-3xl overflow-hidden"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.primary[300] + "20",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        {/* Top Gradient Accent */}
        <View
          style={{
            height: 6,
            backgroundColor: theme.primary[300],
          }}
        />

        <View className="p-5">
          {/* Header */}
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              {/* Small Badge */}
              <View
                className="self-start px-3 py-1 rounded-full mb-3"
                style={{
                  backgroundColor: theme.primary[100],
                }}
              >
                <Text
                  className="text-xs font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  YOUR SEARCH PROFILE
                </Text>
              </View>

              {/* Main Info */}
              <Text
                className="text-xl font-rubik-bold leading-8"
                style={{ color: theme.title }}
              >
                {myProfile?.userType === "student"
                  ? "🎓 Student"
                  : myProfile?.userType === "professional"
                    ? "💼 Professional"
                    : "🏠 Tenant"}
              </Text>

              <View className="flex-row items-center mt-2">
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={theme.primary[300]}
                />
                <Text
                  className="ml-1 text-sm font-rubik-medium"
                  style={{ color: theme.text }}
                >
                  {myProfile?.preferredLocation}
                </Text>
              </View>

              <View className="flex-row flex-wrap mt-4 gap-2">
                {/* Budget Pill */}
                <View
                  className="px-3 py-2 rounded-full flex-row items-center"
                  style={{
                    backgroundColor: theme.background,
                  }}
                >
                  <Ionicons
                    name="cash-outline"
                    size={14}
                    color={theme.primary[300]}
                  />
                  <Text
                    className="ml-1 text-xs font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    ${myProfile?.budget}/month
                  </Text>
                </View>

                {/* Looking For */}
                <View
                  className="px-3 py-2 rounded-full flex-row items-center"
                  style={{
                    backgroundColor: theme.background,
                  }}
                >
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={theme.primary[300]}
                  />
                  <Text
                    className="ml-1 text-xs font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {myProfile?.lookingFor}
                  </Text>
                </View>
              </View>
            </View>

            {/* Active Toggle */}
            <View className="items-end">
              <TouchableOpacity
                onPress={handleToggleActiveStatus}
                activeOpacity={0.8}
                className="px-4 py-3 rounded-2xl flex-row items-center"
                style={{
                  backgroundColor: isActive ? "#16A34A" : "#9CA3AF",
                  shadowColor: isActive ? "#16A34A" : "#9CA3AF",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Ionicons
                  name={isActive ? "checkmark-circle" : "pause-circle"}
                  size={18}
                  color="white"
                />

                <Text className="text-white text-xs font-rubik-bold ml-2">
                  {isActive ? "ACTIVE" : "PAUSED"}
                </Text>
              </TouchableOpacity>

              <Text
                className="text-[11px] mt-2 text-center"
                style={{ color: theme.muted }}
              >
                {isActive ? "Visible to matches" : "Hidden from matches"}
              </Text>
            </View>
          </View>

          {/* Bottom Actions */}
          <View
            className="flex-row justify-between items-center mt-5 pt-4"
            style={{
              borderTopWidth: 1,
              borderTopColor: theme.muted + "15",
            }}
          >
            <View className="flex-row items-center">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{
                  backgroundColor: isActive ? "#16A34A" : "#9CA3AF",
                }}
              />

              <Text
                className="text-xs font-rubik-medium"
                style={{ color: theme.muted }}
              >
                {isActive
                  ? "Searching for matches..."
                  : "Search currently paused"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setShowProfileForm(true)}
              activeOpacity={0.7}
              className="px-4 py-2 rounded-full flex-row items-center"
              style={{
                backgroundColor: theme.primary[100],
              }}
            >
              <Ionicons
                name="create-outline"
                size={14}
                color={theme.primary[300]}
              />

              <Text
                className="ml-1 text-xs font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                Edit Profile
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
        </View>
      ) : (
        renderMatchesList()
      )}

      {/* Modals */}
      <ProfileUpdatedModal
        visible={showProfileUpdated}
        onClose={() => setShowProfileUpdated(false)}
      />
      <ProfilePostedModal
        visible={showProfilePosted}
        onClose={() => setShowProfilePosted(false)}
      />
      <ProfileHiddenModal
        visible={showProfileHidden}
        onClose={() => setShowProfileHidden(false)}
      />
      <ProfileVisibleModal
        visible={showProfileVisible}
        onClose={() => setShowProfileVisible(false)}
      />

      {selectedMatch && (
        <ContactModal
          visible={contactModalVisible}
          onClose={() => setContactModalVisible(false)}
          name={selectedMatch.name}
          email={selectedMatch.email}
          phone={selectedMatch.phone}
          avatar={selectedMatch.avatar}
        />
      )}
    </SafeAreaView>
  );
};

export default Match;
