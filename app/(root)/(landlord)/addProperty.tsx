import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import { AddListing, uploadImage} from "@/lib/appwrite";
import * as ImagePicker from "expo-image-picker";
import { ImagePickerAsset } from "expo-image-picker";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { categories, facilities } from "@/constants/data";
import useAuthStore from "@/store/auth.store";

const AddPropertyScreen = () => {
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [loadingUser, setLoadingUser] = useState(true);

  // Form state
  const [propertyName, setPropertyName] = useState("");
  const [type, setType] = useState("");
  const [typeModalVisible, setTypeModalVisible] = useState(false);
  const [description, setDescription] = useState("");

  // Address breakdown
  const [houseNumber, setHouseNumber] = useState("");
  const [streetName, setStreetName] = useState("");
  const [neighbourhood, setNeighbourhood] = useState("");
  const [cityTown, setCityTown] = useState("");

  const [price, setPrice] = useState("");
  const [priceThreshold, setPriceThreshold] = useState("");
  const [area, setArea] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [roomFor, setRoomFor] = useState("");
  const [bathrooms, setBathrooms] = useState("");

  // Curfew state
  const [curfew, setCurfew] = useState("");
  const [curfewAmPm, setCurfewAmPm] = useState<"AM" | "PM" | "">("");
  const [curfewModalVisible, setCurfewModalVisible] = useState(false);

  // Facilities state
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);
  const [facilitiesModalVisible, setFacilitiesModalVisible] = useState(false);

  const [images, setImages] = useState<ImagePickerAsset[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals for success and error messages
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [errorModalVisible, setErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Check if user is loaded
  useEffect(() => {
    if (user) {
      setLoadingUser(false);
    }
  }, [user]);

  const isBoardingHouse = type === "Boarding";

  const getFullAddress = () => {
    const parts = [houseNumber, streetName, neighbourhood, cityTown].filter(
      (part) => part.trim() !== "",
    );
    return parts.join(", ");
  };

  // Image picker
  const pickImage = async () => {
    if (images.length >= 3) {
      Alert.alert("Limit Reached", "You can only upload up to 3 images");
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsMultipleSelection: true,
        selectionLimit: 3 - images.length,
      });

      if (!result.canceled) {
        setImages((prev) => [...prev, ...result.assets]);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick images");
      console.error(error);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };


  const toggleFacility = (facilityTitle: string) => {
    setSelectedFacilities((prev) => {
      if (prev.includes(facilityTitle)) {
        return prev.filter((f) => f !== facilityTitle);
      } else {
        return [...prev, facilityTitle];
      }
    });
  };

  const validateForm = () => {
    // Basic required fields
    if (
      !propertyName.trim() ||
      !type ||
      !description.trim() ||
      !getFullAddress() ||
      !price ||
      !area ||
      !bedrooms ||
      !bathrooms
    ) {
      Alert.alert("Error", "Please fill all required fields");
      return false;
    }

    // Boarding house specific validations
    if (isBoardingHouse) {
      if (!roomFor) {
        Alert.alert("Error", "Please fill all boarding house fields");
        return false;
      }
    }

    if (images.length === 0) {
      Alert.alert("Error", "Please upload at least one image");
      return false;
    }

    // Validate numeric fields
    if (isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert("Error", "Please enter a valid price");
      return false;
    }

    if (
      priceThreshold &&
      (isNaN(Number(priceThreshold)) || Number(priceThreshold) < 0)
    ) {
      Alert.alert("Error", "Please enter a valid price threshold");
      return false;
    }

    if (isNaN(Number(area)) || Number(area) <= 0) {
      Alert.alert("Error", "Please enter a valid area");
      return false;
    }

    if (isNaN(Number(bedrooms)) || Number(bedrooms) < 0) {
      Alert.alert("Error", "Please enter a valid number of bedrooms");
      return false;
    }

    if (isNaN(Number(bathrooms)) || Number(bathrooms) < 0) {
      Alert.alert("Error", "Please enter a valid number of bathrooms");
      return false;
    }

    if (isBoardingHouse) {
      if (isNaN(Number(roomFor)) || Number(roomFor) < 0) {
        Alert.alert("Error", "Please enter a valid number of people");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!user) {
      setErrorMessage("You must be logged in to add a listing");
      setErrorModalVisible(true);
      return;
    }

    if (!user.accountId) {
      setErrorMessage("User account ID not found");
      setErrorModalVisible(true);
      return;
    }

    setLoading(true);
    try {
      // Upload images
      const uploadedImageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        try {
          console.log(`Uploading image ${i + 1}/${images.length}...`);
          const imageUrl = await uploadImage(img);
          uploadedImageUrls.push(imageUrl);
        } catch (error) {
          console.error(`Failed to upload image ${i + 1}:`, error);
          setErrorMessage(`Failed to upload image ${i + 1}`);
          setErrorModalVisible(true);
          setLoading(false);
          return;
        }
      }

      // Prepare listing data
      const listingData: any = {
        propertyName: propertyName.trim(),
        type: type,
        description: description.trim(),
        address: getFullAddress(),
        price: Number(price),
        area: Number(area),
        bedrooms: Number(bedrooms),
        bathrooms: Number(bathrooms),
        facilities: selectedFacilities.join(", "),
        agent: user.$id,
        creatorId: user.accountId,
      };

      // Add price threshold if provided
      if (priceThreshold && priceThreshold.trim() !== "") {
        listingData.priceThreshold = Number(priceThreshold);
      }

      // Add boarding house specific fields
      if (isBoardingHouse) {
        listingData.roomFor = Number(roomFor);
        listingData.curfew = curfewAmPm ? `${curfew} ${curfewAmPm}` : "";
      }

      // Assign image URLs
      if (uploadedImageUrls[0]) listingData.image1 = uploadedImageUrls[0];
      if (uploadedImageUrls[1]) listingData.image2 = uploadedImageUrls[1];
      if (uploadedImageUrls[2]) listingData.image3 = uploadedImageUrls[2];

      console.log("Full listing data:", listingData);

      // Add the listing
      await AddListing(listingData);

      setSuccessModalVisible(true);
    } catch (error) {
      console.error("Error saving listing:", error);
      setErrorMessage(
        "Failed to save listing. Please check your connection and try again.",
      );
      setErrorModalVisible(true);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPropertyName("");
    setType("");
    setDescription("");
    setHouseNumber("");
    setStreetName("");
    setNeighbourhood("");
    setCityTown("");
    setPrice("");
    setPriceThreshold("");
    setArea("");
    setBedrooms("");
    setBathrooms("");
    setRoomFor("");
    setCurfew("");
    setCurfewAmPm("");
    setSelectedFacilities([]);
    setImages([]);
  };

  // Property Type Modal with Icons
  const renderTypeModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={typeModalVisible}
      onRequestClose={() => setTypeModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.navBackground,
            maxHeight: "70%",
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Select Property Type
            </Text>
            <TouchableOpacity onPress={() => setTypeModalVisible(false)}>
              <Text style={{ color: theme.text, fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={categories.filter((c) => c.category !== "All")}
            keyExtractor={(item) => item.category}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  setType(item.category);
                  setTypeModalVisible(false);
                }}
                className={`p-4 mb-2 rounded-xl border flex-row items-center ${
                  type === item.category
                    ? "bg-primary-100 border-primary-300"
                    : "bg-white border-gray-200"
                }`}
                style={{
                  backgroundColor:
                    type === item.category
                      ? theme.primary[100]
                      : theme.navBackground,
                  borderColor:
                    type === item.category ? theme.primary[300] : theme.title,
                }}
              >
                {/* Icon based on property type */}
                <Image
                  source={
                    item.category === "Apartment"
                      ? icons.apartment
                      : item.category === "House"
                        ? icons.house
                        : item.category === "Luxury"
                          ? icons.luxury
                          : item.category === "Boarding"
                            ? icons.boarding
                            : item.category === "Studio"
                              ? icons.studio
                              : item.category === "Land"
                                ? icons.land
                                : item.category === "Other"
                                  ? icons.other
                                  : item.category === "Workplace"
                                    ? icons.workplace
                                    : item.category === "Duplex"
                                      ? icons.duplex
                                      : icons.other
                  }
                  className="w-6 h-6 mr-3"
                  style={{
                    tintColor:
                      type === item.category ? theme.primary[300] : theme.muted,
                  }}
                />
                <Text
                  className={`text-lg font-rubik-medium flex-1 ${
                    type === item.category
                      ? "text-primary-300"
                      : "text-black-300"
                  }`}
                  style={{
                    color:
                      type === item.category ? theme.primary[300] : theme.text,
                  }}
                >
                  {item.title}
                </Text>
                {type === item.category && (
                  <Text
                    className="text-primary-300 font-rubik-bold"
                    style={{ color: theme.primary[300] }}
                  >
                    ✓
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
  // Curfew Modal
  const renderCurfewModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={curfewModalVisible}
      onRequestClose={() => setCurfewModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{ backgroundColor: theme.navBackground }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Select Curfew Time
            </Text>
            <TouchableOpacity onPress={() => setCurfewModalVisible(false)}>
              <Text style={{ color: theme.text, fontSize: 24 }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-4 mb-4">
            <View className="flex-1">
              <Text
                className="text-sm font-rubik-medium mb-2"
                style={{ color: theme.muted }}
              >
                Hour
              </Text>
              <FlatList
                data={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
                numColumns={3}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      setCurfew(item.toString());
                      setCurfewModalVisible(false);
                    }}
                    className={`m-1 p-3 rounded-lg border ${
                      curfew === item.toString()
                        ? "bg-primary-100 border-primary-300"
                        : "bg-white border-gray-200"
                    }`}
                    style={{
                      backgroundColor:
                        curfew === item.toString()
                          ? theme.primary[100]
                          : theme.navBackground,
                      borderColor:
                        curfew === item.toString()
                          ? theme.primary[300]
                          : theme.title,
                    }}
                  >
                    <Text
                      className={`text-center ${
                        curfew === item.toString()
                          ? "text-primary-300"
                          : "text-black-300"
                      }`}
                      style={{
                        color:
                          curfew === item.toString()
                            ? theme.primary[300]
                            : theme.text,
                      }}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>

          <View className="flex-row gap-4">
            <TouchableOpacity
              onPress={() => {
                setCurfewAmPm("AM");
                setCurfewModalVisible(false);
              }}
              className={`flex-1 p-4 rounded-xl border ${
                curfewAmPm === "AM"
                  ? "bg-primary-100 border-primary-300"
                  : "bg-white border-gray-200"
              }`}
              style={{
                backgroundColor:
                  curfewAmPm === "AM"
                    ? theme.primary[100]
                    : theme.navBackground,
                borderColor:
                  curfewAmPm === "AM" ? theme.primary[300] : theme.title,
              }}
            >
              <Text
                className={`text-center font-rubik-bold ${
                  curfewAmPm === "AM" ? "text-primary-300" : "text-black-300"
                }`}
                style={{
                  color: curfewAmPm === "AM" ? theme.primary[300] : theme.text,
                }}
              >
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setCurfewAmPm("PM");
                setCurfewModalVisible(false);
              }}
              className={`flex-1 p-4 rounded-xl border ${
                curfewAmPm === "PM"
                  ? "bg-primary-100 border-primary-300"
                  : "bg-white border-gray-200"
              }`}
              style={{
                backgroundColor:
                  curfewAmPm === "PM"
                    ? theme.primary[100]
                    : theme.navBackground,
                borderColor:
                  curfewAmPm === "PM" ? theme.primary[300] : theme.title,
              }}
            >
              <Text
                className={`text-center font-rubik-bold ${
                  curfewAmPm === "PM" ? "text-primary-300" : "text-black-300"
                }`}
                style={{
                  color: curfewAmPm === "PM" ? theme.primary[300] : theme.text,
                }}
              >
                PM
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Facilities Modal
  const renderFacilitiesModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={facilitiesModalVisible}
      onRequestClose={() => setFacilitiesModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View
          className="rounded-t-3xl p-6"
          style={{
            backgroundColor: theme.navBackground,
            maxHeight: "80%",
          }}
        >
          <View className="flex-row justify-between items-center mb-4">
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Select Facilities
            </Text>
            <TouchableOpacity onPress={() => setFacilitiesModalVisible(false)}>
              <Text
                className="text-primary-300 font-rubik-bold"
                style={{ color: theme.primary[300] }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={facilities}
            keyExtractor={(item) => item.title}
            numColumns={2}
            renderItem={({ item }) => {
              const isSelected = selectedFacilities.includes(item.title);
              return (
                <TouchableOpacity
                  onPress={() => toggleFacility(item.title)}
                  className={`flex-1 m-2 p-4 rounded-xl border items-center ${
                    isSelected
                      ? "bg-primary-100 border-primary-300"
                      : "bg-white border-gray-200"
                  }`}
                  style={{
                    backgroundColor: isSelected
                      ? theme.primary[100]
                      : theme.navBackground,
                    borderColor: isSelected ? theme.primary[300] : theme.title,
                  }}
                >
                  <Image
                    source={item.icon}
                    className="w-8 h-8 mb-2"
                    style={{
                      tintColor: isSelected ? theme.primary[300] : theme.muted,
                    }}
                  />
                  <Text
                    className={`text-sm font-rubik-medium text-center ${
                      isSelected ? "text-primary-300" : "text-black-300"
                    }`}
                    style={{
                      color: isSelected ? theme.primary[300] : theme.text,
                    }}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );

  if (loadingUser) {
    return (
      <SafeAreaView
        className="flex-1 justify-center items-center"
        style={{ backgroundColor: theme.background }}
      >
        <ActivityIndicator size="large" color={theme.primary[300]} />
        <Text className="mt-2" style={{ color: theme.muted }}>
          Loading user...
        </Text>
      </SafeAreaView>
    );
  }

  const renderSuccessModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={successModalVisible}
      onRequestClose={() => setSuccessModalVisible(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="rounded-3xl p-6 w-[85%] items-center"
          style={{ backgroundColor: theme.navBackground }}
        >
          {/* Success Icon */}
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: theme.primary[300] + "20" }}
          >
            <Text className="text-5xl">✓</Text>
          </View>

          <Text
            className="text-2xl font-rubik-bold mb-2 text-center"
            style={{ color: theme.text }}
          >
            Success!
          </Text>

          <Text
            className="text-base font-rubik mb-6 text-center"
            style={{ color: theme.muted }}
          >
            Your property has been listed successfully
          </Text>

          {/* Buttons */}
          <TouchableOpacity
            onPress={() => {
              setSuccessModalVisible(false);
              resetForm();
            }}
            className="w-full py-4 rounded-xl mb-3"
            style={{ backgroundColor: theme.surface }}
          >
            <Text
              className="text-center font-rubik-bold text-base"
              style={{ color: theme.text }}
            >
              Stay Here
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setSuccessModalVisible(false);
              router.replace({
                pathname: "/landHome",
                params: { refresh: "true" },
              });
            }}
            className="w-full py-4 rounded-xl"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-center font-rubik-bold text-base text-white">
              Go Home
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderErrorModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={errorModalVisible}
      onRequestClose={() => setErrorModalVisible(false)}
    >
      <View className="flex-1 justify-center items-center bg-black/50">
        <View
          className="rounded-3xl p-6 w-[85%] items-center"
          style={{ backgroundColor: theme.navBackground }}
        >
          {/* Error Icon */}
          <View
            className="w-20 h-20 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: theme.danger + "20" }}
          >
            <Text className="text-5xl">✕</Text>
          </View>

          <Text
            className="text-2xl font-rubik-bold mb-2 text-center"
            style={{ color: theme.text }}
          >
            Error!
          </Text>

          <Text
            className="text-base font-rubik mb-6 text-center"
            style={{ color: theme.muted }}
          >
            {errorMessage || "Failed to save listing. Please try again."}
          </Text>

          <TouchableOpacity
            onPress={() => setErrorModalVisible(false)}
            className="w-full py-4 rounded-xl"
            style={{ backgroundColor: theme.primary[300] }}
          >
            <Text className="text-center font-rubik-bold text-base text-white">
              Try Again
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="flex-row items-center w-full justify-between px-6 pt-4">
            <TouchableOpacity
              onPress={() => router.replace("/landHome")}
              className="rounded-full w-11 h-11 items-center justify-center"
              style={{ backgroundColor: theme.primary[200] }}
            >
              <Image
                source={icons.backArrow}
                className="size-5"
                style={{ tintColor: theme.text }}
              />
            </TouchableOpacity>
            <Text
              className="text-xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              Add Listing
            </Text>
            <View className="w-11" />
          </View>

          <View className="px-6 pt-4 pb-2">
            <Text
              className="text-2xl font-rubik-bold"
              style={{ color: theme.text }}
            >
              New Property
            </Text>
            <Text
              className="text-sm font-rubik mt-1"
              style={{ color: theme.muted }}
            >
              Fill in the details to list your property
            </Text>
          </View>

          {/* Form Fields */}
          <View className="px-6">
            {/* Property Name with icon */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Property Name
              </Text>
              <View
                className="flex-row items-center border rounded-lg"
                style={{
                  borderColor: theme.text,
                  backgroundColor: theme.navBackground,
                }}
              >
                <Image
                  source={icons.home}
                  className="w-5 h-5 ml-3"
                  style={{ tintColor: theme.muted }}
                />
                <TextInput
                  placeholder="e.g. Sunset Apartments, Green Villa"
                  placeholderTextColor={theme.muted + "80"}
                  value={propertyName}
                  onChangeText={setPropertyName}
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                />
              </View>
            </View>

            {/* Property Type - Dropdown */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Property Type
              </Text>
              <TouchableOpacity
                onPress={() => setTypeModalVisible(true)}
                className="flex-row items-center justify-between border rounded-lg px-4 py-3"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                <Text style={{ color: type ? theme.text : theme.muted + "80" }}>
                  {type || "Select property type"}
                </Text>
                <Text style={{ color: theme.muted }}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Description
              </Text>
              <TextInput
                placeholder="Describe your property features, condition, etc."
                placeholderTextColor={theme.muted + "80"}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                className="border rounded-lg px-4 py-3 h-24"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                  color: theme.text,
                }}
                textAlignVertical="top"
              />
            </View>

            {/* Address Breakdown */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-2"
                style={{ color: theme.text }}
              >
                Address
              </Text>

              {/* House Number */}
              <View
                className="flex-row items-center border rounded-lg mb-2"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                <Image
                  source={icons.location}
                  className="w-5 h-5 ml-3"
                  style={{ tintColor: theme.muted }}
                />
                <TextInput
                  placeholder="Property Address (e.g. 22)"
                  placeholderTextColor={theme.muted + "80"}
                  value={houseNumber}
                  onChangeText={setHouseNumber}
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                />
              </View>

              {/* Street Name */}
              <TextInput
                placeholder="Street Name (e.g. Hay Rd)"
                placeholderTextColor={theme.muted + "80"}
                value={streetName}
                onChangeText={setStreetName}
                className="border rounded-lg px-4 py-3 mb-2"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                  color: theme.text,
                }}
              />

              {/* Neighbourhood */}
              <TextInput
                placeholder="Neighbourhood (e.g. ShashiView)"
                placeholderTextColor={theme.muted + "80"}
                value={neighbourhood}
                onChangeText={setNeighbourhood}
                className="border rounded-lg px-4 py-3 mb-2"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                  color: theme.text,
                }}
              />

              {/* City/Town */}
              <TextInput
                placeholder="City/Town (e.g. Bindura)"
                placeholderTextColor={theme.muted + "80"}
                value={cityTown}
                onChangeText={setCityTown}
                className="border rounded-lg px-4 py-3"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                  color: theme.text,
                }}
              />

              {/* Preview of combined address */}
              {getFullAddress() && (
                <Text className="text-xs mt-2" style={{ color: theme.muted }}>
                  Full address: {getFullAddress()}
                </Text>
              )}
            </View>

            {/* Price */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                {isBoardingHouse
                  ? "Price (per head)"
                  : type === "Luxury"
                    ? "Price (per night)"
                    : "Price (per month)"}
              </Text>
              <View
                className="flex-row items-center border rounded-lg"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                <Text
                  className="px-3 font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  $
                </Text>
                <TextInput
                  placeholder="1500"
                  placeholderTextColor={theme.muted + "80"}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                />
              </View>
            </View>

            {/* Price Threshold - New Field */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Price Threshold (Optional)
              </Text>
              <View
                className="flex-row items-center border rounded-lg"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                <Text
                  className="px-3 font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  $
                </Text>
                <TextInput
                  placeholder="Minimum price to show (e.g., 2000)"
                  placeholderTextColor={theme.muted + "80"}
                  value={priceThreshold}
                  onChangeText={setPriceThreshold}
                  keyboardType="numeric"
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                />
              </View>
              <Text
                className="text-xs mt-1"
                style={{ color: theme.muted + "80" }}
              >
                Tenants with budgets matching this threshold will be notified
              </Text>
            </View>

            {/* Area */}
            <View className="mb-4">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                {type === "Boarding"
                  ? "Space for student (sqm)"
                  : type === "Luxury"
                    ? "Room Area (sqm)"
                    : "Property Area (sqm)"}
              </Text>
              <View
                className="flex-row items-center border rounded-lg"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                <TextInput
                  placeholder="850"
                  placeholderTextColor={theme.muted + "80"}
                  value={area}
                  onChangeText={setArea}
                  keyboardType="numeric"
                  className="flex-1 px-4 py-3"
                  style={{ color: theme.text }}
                />
                <Text
                  className="px-3 font-rubik-medium"
                  style={{ color: theme.muted }}
                >
                  sqm
                </Text>
              </View>
            </View>

            {/* Bedrooms & Bathrooms row */}
            <View className="flex-row gap-4 mb-4">
              <View className="flex-1">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Bedrooms
                </Text>
                <TextInput
                  placeholder="2"
                  placeholderTextColor={theme.muted + "80"}
                  value={bedrooms}
                  onChangeText={setBedrooms}
                  keyboardType="numeric"
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: theme.title,
                    backgroundColor: theme.navBackground,
                    color: theme.text,
                  }}
                />
              </View>
              <View className="flex-1">
                <Text
                  className="text-sm font-rubik-medium mb-1"
                  style={{ color: theme.text }}
                >
                  Bathrooms
                </Text>
                <TextInput
                  placeholder="1"
                  placeholderTextColor={theme.muted + "80"}
                  value={bathrooms}
                  onChangeText={setBathrooms}
                  keyboardType="numeric"
                  className="border rounded-lg px-4 py-3"
                  style={{
                    borderColor: theme.title,
                    backgroundColor: theme.navBackground,
                    color: theme.text,
                  }}
                />
              </View>
            </View>

            {/* Boarding House Specific Fields */}
            {isBoardingHouse && (
              <>
                {/* Room For */}
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-1"
                    style={{ color: theme.text }}
                  >
                    Room For (people)
                  </Text>
                  <TextInput
                    placeholder="3"
                    placeholderTextColor={theme.muted + "80"}
                    value={roomFor}
                    onChangeText={setRoomFor}
                    keyboardType="numeric"
                    className="border rounded-lg px-4 py-3"
                    style={{
                      borderColor: theme.title,
                      backgroundColor: theme.navBackground,
                      color: theme.text,
                    }}
                  />
                </View>

                {/* Curfew - Modern Design */}
                {/* Curfew - Modern Design with "No Curfew" Option */}
                <View className="mb-4">
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{ color: theme.text }}
                  >
                    Curfew
                  </Text>

                  <View
                    className="rounded-xl overflow-hidden"
                    style={{
                      backgroundColor: theme.surface,
                      borderWidth: 1,
                      borderColor: theme.muted + "30",
                    }}
                  >
                    {/* No Curfew Toggle */}
                    <TouchableOpacity
                      onPress={() => {
                        if (curfew === "none") {
                          setCurfew("");
                          setCurfewAmPm("");
                        } else {
                          setCurfew("none");
                          setCurfewAmPm("");
                        }
                      }}
                      className={`p-4 flex-row items-center justify-between border-b ${
                        curfew === "none" ? "bg-primary-100" : ""
                      }`}
                      style={{
                        borderBottomColor: theme.muted + "30",
                        backgroundColor:
                          curfew === "none"
                            ? theme.primary[100]
                            : "transparent",
                      }}
                    >
                      <View className="flex-row items-center gap-2">
                        <View
                          className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                            curfew === "none"
                              ? "border-primary-300 bg-primary-300"
                              : "border-gray-400"
                          }`}
                        >
                          {curfew === "none" && (
                            <Text className="text-white text-xs">✓</Text>
                          )}
                        </View>
                        <Text
                          className="text-base font-rubik-medium"
                          style={{
                            color:
                              curfew === "none"
                                ? theme.primary[300]
                                : theme.text,
                          }}
                        >
                          No Curfew
                        </Text>
                      </View>
                      {curfew === "none" && (
                        <Text
                          className="text-xs"
                          style={{ color: theme.primary[300] }}
                        >
                          Selected
                        </Text>
                      )}
                    </TouchableOpacity>

                    {/* Time Display (only show when curfew is set and not "none") */}
                    {curfew && curfew !== "none" && (
                      <View
                        className="p-4 items-center justify-center"
                        style={{
                          backgroundColor: theme.primary[100],
                        }}
                      >
                        <Text
                          className="text-4xl font-rubik-bold mb-1"
                          style={{ color: theme.primary[300] }}
                        >
                          {curfew && curfewAmPm
                            ? `${curfew} ${curfewAmPm}`
                            : "Not Set"}
                        </Text>
                        <Text
                          className="text-xs"
                          style={{ color: theme.muted }}
                        >
                          Tap below to select curfew time
                        </Text>
                      </View>
                    )}

                    {/* Only show time selection when not "none" */}
                    {curfew !== "none" && (
                      <>
                        {/* Hour Slider */}
                        <View className="p-4">
                          <Text
                            className="text-xs font-rubik-medium mb-2"
                            style={{ color: theme.muted }}
                          >
                            HOUR
                          </Text>
                          <View className="flex-row justify-between items-center">
                            <TouchableOpacity
                              onPress={() => {
                                const currentHour = parseInt(curfew) || 1;
                                let newHour = currentHour - 1;
                                if (newHour < 1) newHour = 12;
                                setCurfew(newHour.toString());
                              }}
                              className="w-10 h-10 rounded-full items-center justify-center"
                              style={{ backgroundColor: theme.surface }}
                            >
                              <Text
                                className="text-2xl"
                                style={{ color: theme.text }}
                              >
                                −
                              </Text>
                            </TouchableOpacity>

                            <Text
                              className="text-3xl font-rubik-bold mx-4"
                              style={{ color: theme.text }}
                            >
                              {curfew && curfew !== "none" ? curfew : "1"}
                            </Text>

                            <TouchableOpacity
                              onPress={() => {
                                const currentHour = parseInt(curfew) || 1;
                                let newHour = currentHour + 1;
                                if (newHour > 12) newHour = 1;
                                setCurfew(newHour.toString());
                              }}
                              className="w-10 h-10 rounded-full items-center justify-center"
                              style={{ backgroundColor: theme.surface }}
                            >
                              <Text
                                className="text-2xl"
                                style={{ color: theme.text }}
                              >
                                +
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Period Selection */}
                        <View className="px-4 pb-2">
                          <Text
                            className="text-xs font-rubik-medium mb-2"
                            style={{ color: theme.muted }}
                          >
                            PERIOD
                          </Text>
                          <View className="flex-row gap-3">
                            <TouchableOpacity
                              onPress={() => setCurfewAmPm("AM")}
                              className="flex-1 py-3 rounded-lg items-center"
                              style={{
                                backgroundColor:
                                  curfewAmPm === "AM"
                                    ? theme.primary[300]
                                    : theme.surface,
                                borderWidth: 1,
                                borderColor:
                                  curfewAmPm === "AM"
                                    ? theme.primary[300]
                                    : theme.muted + "30",
                              }}
                            >
                              <Text
                                className="font-rubik-bold text-base"
                                style={{
                                  color:
                                    curfewAmPm === "AM"
                                      ? "#FFFFFF"
                                      : theme.text,
                                }}
                              >
                                AM
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              onPress={() => setCurfewAmPm("PM")}
                              className="flex-1 py-3 rounded-lg items-center"
                              style={{
                                backgroundColor:
                                  curfewAmPm === "PM"
                                    ? theme.primary[300]
                                    : theme.surface,
                                borderWidth: 1,
                                borderColor:
                                  curfewAmPm === "PM"
                                    ? theme.primary[300]
                                    : theme.muted + "30",
                              }}
                            >
                              <Text
                                className="font-rubik-bold text-base"
                                style={{
                                  color:
                                    curfewAmPm === "PM"
                                      ? "#FFFFFF"
                                      : theme.text,
                                }}
                              >
                                PM
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>

                        {/* Quick Select Grid */}
                        <View className="p-4 pt-2">
                          <Text
                            className="text-xs font-rubik-medium mb-2"
                            style={{ color: theme.muted }}
                          >
                            QUICK SELECT
                          </Text>
                          <View className="flex-row flex-wrap gap-2">
                            {[
                              { hour: "8", period: "PM", label: "8 PM" },
                              { hour: "9", period: "PM", label: "9 PM" },
                              { hour: "10", period: "PM", label: "10 PM" },
                              { hour: "11", period: "PM", label: "11 PM" },
                              { hour: "12", period: "AM", label: "12 AM" },
                              { hour: "1", period: "AM", label: "1 AM" },
                            ].map((preset) => (
                              <TouchableOpacity
                                key={preset.label}
                                onPress={() => {
                                  setCurfew(preset.hour);
                                  setCurfewAmPm(preset.period as "AM" | "PM");
                                }}
                                className="px-4 py-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    curfew === preset.hour &&
                                    curfewAmPm === preset.period
                                      ? theme.primary[300]
                                      : theme.surface,
                                  borderWidth: 1,
                                  borderColor:
                                    curfew === preset.hour &&
                                    curfewAmPm === preset.period
                                      ? theme.primary[300]
                                      : theme.muted + "30",
                                }}
                              >
                                <Text
                                  className="text-sm font-rubik-medium"
                                  style={{
                                    color:
                                      curfew === preset.hour &&
                                      curfewAmPm === preset.period
                                        ? "#FFFFFF"
                                        : theme.text,
                                  }}
                                >
                                  {preset.label}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      </>
                    )}

                    {/* Clear Button - only show when curfew is set and not "none" */}
                    {curfew && curfew !== "none" && (
                      <TouchableOpacity
                        onPress={() => {
                          setCurfew("");
                          setCurfewAmPm("");
                        }}
                        className="py-2 items-center justify-center border-t"
                        style={{ borderColor: theme.muted + "30" }}
                      >
                        <Text
                          className="text-sm"
                          style={{ color: theme.danger }}
                        >
                          Clear selection
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}

            {/* Facilities */}
            <View className="mb-6">
              <Text
                className="text-sm font-rubik-medium mb-1"
                style={{ color: theme.text }}
              >
                Facilities
              </Text>
              <TouchableOpacity
                onPress={() => setFacilitiesModalVisible(true)}
                className="border rounded-lg px-4 py-3"
                style={{
                  borderColor: theme.title,
                  backgroundColor: theme.navBackground,
                }}
              >
                {selectedFacilities.length > 0 ? (
                  <View className="flex-row flex-wrap">
                    {selectedFacilities.slice(0, 3).map((facility, index) => (
                      <View
                        key={index}
                        className="bg-primary-100 px-2 py-1 rounded-full mr-2 mb-1"
                        style={{ backgroundColor: theme.primary[100] }}
                      >
                        <Text
                          className="text-xs font-rubik-medium"
                          style={{ color: theme.primary[300] }}
                        >
                          {facility}
                        </Text>
                      </View>
                    ))}
                    {selectedFacilities.length > 3 && (
                      <View className="bg-gray-200 px-2 py-1 rounded-full">
                        <Text className="text-gray-600 text-xs font-rubik-medium">
                          +{selectedFacilities.length - 3} more
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={{ color: theme.muted + "80" }}>
                    Select facilities
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Image Upload Section */}
            <View className="mb-6">
              <Text
                className="text-sm font-rubik-medium mb-2"
                style={{ color: theme.text }}
              >
                Property Images (max 3)
              </Text>

              {/* Only show upload button if less than 3 images */}
              {images.length < 3 && (
                <TouchableOpacity
                  onPress={pickImage}
                  className="py-6 rounded-lg border-2 border-dashed mb-3 items-center justify-center"
                  style={{
                    borderColor: theme.title,
                    backgroundColor: theme.navBackground,
                  }}
                >
                  <Image
                    source={icons.camera}
                    className="w-8 h-8 mb-2"
                    style={{ tintColor: theme.muted }}
                  />
                  <Text
                    className="text-center font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {images.length === 0
                      ? "Tap to upload images"
                      : `Add more images (${images.length}/3)`}
                  </Text>
                  <Text
                    className="text-center text-xs mt-1"
                    style={{ color: theme.muted + "80" }}
                  >
                    Supported: JPG, PNG
                  </Text>
                </TouchableOpacity>
              )}

              {/* Image Previews */}
              {images.length > 0 && (
                <View>
                  <Text
                    className="text-sm font-rubik-medium mb-2"
                    style={{ color: theme.text }}
                  >
                    Selected Images:
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    {images.map((img, idx) => (
                      <View key={idx} className="relative">
                        <Image
                          source={{ uri: img.uri }}
                          className="w-24 h-24 rounded-lg border"
                          style={{ borderColor: theme.title }}
                        />
                        <TouchableOpacity
                          onPress={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full w-6 h-6 items-center justify-center shadow-md"
                        >
                          <Text className="text-white font-bold text-lg">
                            ×
                          </Text>
                        </TouchableOpacity>
                        <View className="absolute bottom-1 left-1 bg-black/60 px-2 py-0.5 rounded">
                          <Text className="text-white text-xs font-rubik">
                            {idx === 0 ? "Main" : `#${idx + 1}`}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Optional: Show message when max images reached */}
              {images.length === 3 && (
                <View
                  className="mt-2 py-2 px-4 rounded-lg"
                  style={{ backgroundColor: theme.primary[100] }}
                >
                  <Text
                    className="text-xs text-center"
                    style={{ color: theme.primary[300] }}
                  >
                    Maximum 3 images reached. Remove an image to add more.
                  </Text>
                </View>
              )}
            </View>


            {loading && (
              <Text
                className="text-xs text-center mb-2"
                style={{ color: theme.muted }}
              >
                Uploading and compressing images, this can take a moment for
                larger files...
              </Text>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              className={`py-4 rounded-lg mb-8 ${loading ? "bg-gray-400" : "bg-primary-300"}`}
              style={{
                backgroundColor: loading ? theme.muted : theme.primary[300],
              }}
            >
              {loading ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text className="text-white text-center text-lg font-rubik-bold ml-2">
                    Saving...
                  </Text>
                </View>
              ) : (
                <Text className="text-white text-center text-lg font-rubik-bold">
                  Save Listing
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      {renderTypeModal()}
      {renderFacilitiesModal()}
      {renderCurfewModal()}
      {renderSuccessModal()}
      {renderErrorModal()}
    </SafeAreaView>
  );
};

export default AddPropertyScreen;
