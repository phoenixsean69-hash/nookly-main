// components/RequestModal.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";

export interface RequestData {
  proposedPrice: number;
  message: string;
  moveInDate?: string;
  leaseDuration?: string;
  questions: string[];
}

interface RequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: RequestData) => void;
  propertyName: string;
  currentPrice: number;
  priceThreshold?: number;
  isLoading?: boolean;
}

export const RequestModal = ({
  visible,
  onClose,
  onSubmit,
  propertyName,
  currentPrice,
  priceThreshold = 0,
  isLoading = false,
}: RequestModalProps) => {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const [proposedPrice, setProposedPrice] = useState(currentPrice.toString());
  const [message, setMessage] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [leaseDuration, setLeaseDuration] = useState("");
  const [customDurationYears, setCustomDurationYears] = useState("");
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [questions, setQuestions] = useState<string[]>([""]);
  const [selectedPriceOption, setSelectedPriceOption] = useState<
    "full" | "negotiate"
  >("full");

  const addQuestion = () => {
    setQuestions([...questions, ""]);
  };

  const removeQuestion = (index: number) => {
    const newQuestions = questions.filter((_, i) => i !== index);
    setQuestions(newQuestions);
  };

  const updateQuestion = (text: string, index: number) => {
    const newQuestions = [...questions];
    newQuestions[index] = text;
    setQuestions(newQuestions);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const formattedDate = selectedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      setMoveInDate(formattedDate);
      setTempDate(selectedDate);
    }
  };

  const handleDurationSelect = (duration: string) => {
    if (duration === "custom") {
      setIsCustomDuration(true);
      setLeaseDuration("");
      setCustomDurationYears("");
    } else {
      setIsCustomDuration(false);
      setLeaseDuration(duration);
      setCustomDurationYears("");
    }
  };

  const handleCustomDurationChange = (text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, "");
    setCustomDurationYears(numericText);

    // Update leaseDuration with the formatted value
    if (numericText) {
      const yearText = parseInt(numericText) === 1 ? "year" : "years";
      setLeaseDuration(`${numericText} ${yearText}`);
    } else {
      setLeaseDuration("");
    }
  };

  const handleProposedPriceChange = (text: string) => {
    // Only allow numbers
    const numericText = text.replace(/[^0-9]/g, "");
    setProposedPrice(numericText);
  };

  const handleSubmit = () => {
    // Validate
    if (
      selectedPriceOption === "negotiate" &&
      (!proposedPrice || parseInt(proposedPrice) <= 0)
    ) {
      Alert.alert("Error", "Please enter a valid proposed price");
      return;
    }

    // Check if proposed price is below threshold
    if (selectedPriceOption === "negotiate") {
      const proposed = parseInt(proposedPrice);
      if (priceThreshold > 0 && proposed < priceThreshold) {
        Alert.alert(
          "Price Too Low",
          `The minimum acceptable price for this property is $${priceThreshold}/month. Please adjust your offer.`,
          [{ text: "OK" }],
        );
        return;
      }
    }

    // Validate custom duration if selected
    if (
      isCustomDuration &&
      (!customDurationYears || parseInt(customDurationYears) <= 0)
    ) {
      Alert.alert("Error", "Please enter a valid number of years");
      return;
    }

    const filteredQuestions = questions.filter((q) => q.trim());

    onSubmit({
      proposedPrice:
        selectedPriceOption === "full" ? currentPrice : parseInt(proposedPrice),
      message: message.trim(),
      moveInDate: moveInDate || undefined,
      leaseDuration: leaseDuration || undefined,
      questions: filteredQuestions,
    });
  };

  // Determine if price is below threshold for visual feedback
  // Fix: Ensure we return a boolean, not a string or empty string
  const isBelowThreshold = (() => {
    if (selectedPriceOption !== "negotiate") return false;
    if (!proposedPrice || proposedPrice === "") return false;
    const price = parseInt(proposedPrice);
    if (isNaN(price)) return false;
    return priceThreshold > 0 && price < priceThreshold;
  })();

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        style={{ flex: 1 }}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <SafeAreaView
            className="rounded-t-3xl max-h-[90%]"
            style={{ backgroundColor: theme.background }}
          >
            {/* Fixed Header with SafeArea padding */}
            <View
              className="pt-4 pb-3 px-4 border-b"
              style={{ borderBottomColor: theme.muted + "30" }}
            >
              <View className="flex-row items-center justify-between">
                <View className="w-10" />
                <Text
                  className="flex-1 text-center text-xl font-rubik-bold"
                  style={{ color: theme.text }}
                >
                  Request to Rent
                </Text>
                <TouchableOpacity
                  onPress={onClose}
                  className="p-2 -mr-2"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    style={{ color: theme.text }}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Property Name */}
            <View className="px-4 py-2">
              <Text
                className="text-center text-md font-rubik-medium"
                style={{ color: theme.muted }}
              >
                {propertyName}
              </Text>
            </View>

            <ScrollView
              className="px-5 pt-2 pb-5"
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Price Negotiation */}
              <View className="mb-5">
                <Text
                  className="text-base font-rubik-bold mb-2"
                  style={{ color: theme.title }}
                >
                  Price Negotiation
                </Text>

                {/* Price Options */}
                <View className="flex-row gap-3 mb-3">
                  <TouchableOpacity
                    onPress={() => setSelectedPriceOption("full")}
                    className={`flex-1 p-3 rounded-xl border-2 ${
                      selectedPriceOption === "full"
                        ? "border-primary-300 bg-primary-50"
                        : "border-gray-300"
                    }`}
                  >
                    <Text
                      className="text-center font-rubik-medium"
                      style={{ color: theme.text }}
                    >
                      Pay Full Price
                    </Text>
                    <Text className="text-center text-sm text-primary-300 font-rubik-bold mt-1">
                      ${currentPrice}/month
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setSelectedPriceOption("negotiate")}
                    className={`flex-1 p-3 rounded-xl border-2 ${
                      selectedPriceOption === "negotiate"
                        ? "border-primary-300 bg-primary-50"
                        : "border-gray-300"
                    }`}
                  >
                    <Text
                      className="text-center font-rubik-medium"
                      style={{ color: theme.text }}
                    >
                      Negotiate Price
                    </Text>
                    <Text className="text-center text-sm text-gray-500 mt-1">
                      Propose your offer
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Proposed Price Input */}
                {selectedPriceOption === "negotiate" && (
                  <View>
                    <View
                      className={`flex-row items-center border rounded-xl px-3 py-2 mt-2 ${
                        isBelowThreshold ? "border-red-500" : ""
                      }`}
                      style={{
                        borderColor: isBelowThreshold
                          ? "#EF4444"
                          : theme.muted + "50",
                        backgroundColor: theme.surface,
                      }}
                    >
                      <Text
                        className="text-lg font-rubik-bold"
                        style={{ color: theme.text }}
                      >
                        $
                      </Text>
                      <TextInput
                        value={proposedPrice}
                        onChangeText={handleProposedPriceChange}
                        keyboardType="numeric"
                        placeholder={`Proposed price (Current: $${currentPrice})`}
                        placeholderTextColor={theme.muted}
                        className="flex-1 ml-2 text-base"
                        style={{ color: theme.text }}
                      />
                      <Text className="text-sm" style={{ color: theme.muted }}>
                        /month
                      </Text>
                    </View>

                    {/* Price Threshold Warning */}
                    {priceThreshold > 0 && (
                      <View className="mt-2">
                        <Text
                          className="text-xs"
                          style={{
                            color: isBelowThreshold ? "#EF4444" : theme.muted,
                          }}
                        >
                          {isBelowThreshold ? (
                            <>
                              <Ionicons
                                name="warning"
                                size={14}
                                color="#EF4444"
                              />{" "}
                              Price must be at least ${priceThreshold}/month
                            </>
                          ) : (
                            <>
                              Minimum acceptable price: ${priceThreshold}/month
                            </>
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* Move-in Date */}
              <View className="mb-5">
                <Text
                  className="text-base font-rubik-bold mb-2"
                  style={{ color: theme.title }}
                >
                  Preferred Move-in Date
                </Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  className="border rounded-xl px-4 py-3"
                  style={{
                    borderColor: theme.muted + "50",
                    backgroundColor: theme.surface,
                  }}
                >
                  <Text
                    style={{ color: moveInDate ? theme.text : theme.muted }}
                  >
                    {moveInDate || "Select preferred move-in date"}
                  </Text>
                </TouchableOpacity>

                {showDatePicker && (
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={handleDateChange}
                    minimumDate={new Date()}
                  />
                )}
              </View>

              {/* Lease Duration with Custom Input */}
              <View className="mb-5">
                <Text
                  className="text-base font-rubik-bold mb-2"
                  style={{ color: theme.title }}
                >
                  Lease Duration
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {[
                    "3 months",
                    "6 months",
                    "9 months",
                    "12 months",
                    "24 months",
                  ].map((duration) => (
                    <TouchableOpacity
                      key={duration}
                      onPress={() => handleDurationSelect(duration)}
                      className={`px-4 py-2 rounded-full ${
                        leaseDuration === duration && !isCustomDuration
                          ? "bg-primary-300"
                          : "border"
                      }`}
                      style={{
                        borderColor: theme.muted + "50",
                        backgroundColor:
                          leaseDuration === duration && !isCustomDuration
                            ? undefined
                            : theme.surface,
                      }}
                    >
                      <Text
                        className={
                          leaseDuration === duration && !isCustomDuration
                            ? "text-white"
                            : "text-gray-600"
                        }
                      >
                        {duration}
                      </Text>
                    </TouchableOpacity>
                  ))}

                  {/* Custom Duration Option */}
                  <TouchableOpacity
                    onPress={() => handleDurationSelect("custom")}
                    className={`px-4 py-2 rounded-full ${
                      isCustomDuration ? "bg-primary-300" : "border"
                    }`}
                    style={{
                      borderColor: theme.muted + "50",
                      backgroundColor: isCustomDuration
                        ? undefined
                        : theme.surface,
                    }}
                  >
                    <Text
                      className={
                        isCustomDuration ? "text-white" : "text-gray-600"
                      }
                    >
                      Custom
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Custom Duration Input */}
                {isCustomDuration && (
                  <View
                    className="flex-row items-center border rounded-xl px-4 py-3 mt-3"
                    style={{
                      borderColor: theme.muted + "50",
                      backgroundColor: theme.surface,
                    }}
                  >
                    <TextInput
                      value={customDurationYears}
                      onChangeText={handleCustomDurationChange}
                      placeholder="Enter number of years (e.g., 2)"
                      placeholderTextColor={theme.muted}
                      keyboardType="numeric"
                      className="flex-1 text-base"
                      style={{ color: theme.text }}
                      returnKeyType="done"
                      blurOnSubmit={true}
                      maxLength={3}
                    />
                    {customDurationYears ? (
                      <Text
                        className="text-sm ml-2"
                        style={{ color: theme.muted }}
                      >
                        {parseInt(customDurationYears) === 1 ? "year" : "years"}
                      </Text>
                    ) : null}
                    {customDurationYears !== "" && (
                      <TouchableOpacity
                        onPress={() => {
                          setCustomDurationYears("");
                          setLeaseDuration("");
                          setIsCustomDuration(false);
                        }}
                        className="ml-2"
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={theme.muted}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              {/* Questions Section - With KeyboardAvoidingView */}
              <View className="mb-5">
                <View className="flex-row justify-between items-center mb-2">
                  <Text
                    className="text-base font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    Questions for Landlord
                  </Text>
                  <TouchableOpacity
                    onPress={addQuestion}
                    className="flex-row items-center"
                  >
                    <Ionicons
                      name="add-circle"
                      size={24}
                      color={theme.primary[300]}
                    />
                    <Text
                      className="text-xs ml-1"
                      style={{ color: theme.primary[300] }}
                    >
                      Add
                    </Text>
                  </TouchableOpacity>
                </View>

                {questions.map((question, index) => (
                  <KeyboardAvoidingView
                    key={index}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
                    className="mb-2"
                  >
                    <View className="flex-row items-start gap-2">
                      <View className="flex-1">
                        <TextInput
                          value={question}
                          onChangeText={(text) => updateQuestion(text, index)}
                          placeholder={`Question ${index + 1} (e.g., Is parking available?)`}
                          placeholderTextColor={theme.muted}
                          multiline
                          className="border rounded-xl px-3 py-2 text-base"
                          style={{
                            borderColor: theme.muted + "50",
                            backgroundColor: theme.surface,
                            color: theme.text,
                            minHeight: 60,
                            maxHeight: 120,
                            textAlignVertical: "top",
                          }}
                          returnKeyType="done"
                          blurOnSubmit={true}
                        />
                      </View>
                      {questions.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeQuestion(index)}
                          className="p-2 mt-1"
                        >
                          <Ionicons
                            name="trash-outline"
                            size={20}
                            color={theme.danger}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  </KeyboardAvoidingView>
                ))}
              </View>

              {/* Personal Message - With KeyboardAvoidingView */}
              <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={Platform.OS === "ios" ? 150 : 0}
                className="mb-5"
              >
                <View>
                  <Text
                    className="text-base font-rubik-bold mb-2"
                    style={{ color: theme.title }}
                  >
                    Personal Message
                  </Text>
                  <TextInput
                    value={message}
                    onChangeText={setMessage}
                    placeholder="Introduce yourself and explain why you're interested..."
                    placeholderTextColor={theme.muted}
                    multiline
                    numberOfLines={4}
                    className="border rounded-xl px-4 py-3 text-base"
                    style={{
                      borderColor: theme.muted + "50",
                      backgroundColor: theme.surface,
                      color: theme.text,
                      minHeight: 100,
                      maxHeight: 150,
                      textAlignVertical: "top",
                    }}
                    returnKeyType="done"
                    blurOnSubmit={true}
                  />
                </View>
              </KeyboardAvoidingView>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading || isBelowThreshold}
                className={`py-4 rounded-xl mb-5 mt-2 ${
                  isBelowThreshold ? "opacity-50" : ""
                }`}
                style={{
                  backgroundColor: isBelowThreshold
                    ? theme.muted
                    : theme.primary[300],
                }}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-center font-rubik-bold text-lg">
                    {isBelowThreshold ? "Price Below Minimum" : "Send Request"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
