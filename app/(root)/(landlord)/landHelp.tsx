import { Colors } from "@/constants/Colors";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import the AI Chat component
import AIChatModal from "@/components/chat-support";

export default function Help() {
  const { user } = useAuthStore();
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const isLandlord = user?.userMode === "landlord";

  const handleBackPress = () => {
    if (isLandlord) {
      router.push("/landProfile");
    } else {
      router.push("/profile");
    }
  };

  const handleEmailPress = async () => {
    await Linking.openURL("mailto:support@nookly.com");
  };

  const handleCallPress = () => {
    Alert.alert(
      "Contact Support",
      "Choose a number to call:",
      [
        {
          text: "+263 77 114 4469",
          onPress: () => Linking.openURL("tel:+263771144469"),
        },
        {
          text: "+263 77 600 6288",
          onPress: () => Linking.openURL("tel:+263776006288"),
        },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  };

  const toggleExpand = (faqId: number) => {
    const newExpanded = new Set(expandedFaqs);
    if (newExpanded.has(faqId)) {
      newExpanded.delete(faqId);
    } else {
      newExpanded.add(faqId);
    }
    setExpandedFaqs(newExpanded);
  };

  const faqs = [
    {
      id: 1,
      question: "How do I list a property?",
      answer:
        "Go to your profile, tap on 'My Properties', then click the '+' button to add a new property. Fill in all details (address, price, bedrooms, bathrooms, amenities), upload photos (up to 10), and publish. Your listing will be visible within minutes!",
      category: "Properties",
    },
    {
      id: 2,
      question: "How do I find properties to rent?",
      answer:
        "Use the search bar on the home screen. You can filter by location, price range, property type, number of bedrooms, and amenities. Sort by newest, price, or popularity to find your perfect home. Save your searches to get notified when new properties match your criteria!",
      category: "Properties",
    },
    {
      id: 3,
      question: "How do I save favorite properties?",
      answer:
        "Tap the heart icon on any property card to save it to your favorites. You can view all saved properties in the 'My Favorites' section. Favorites sync across all your devices, and you'll get notified when the price drops on saved properties.",
      category: "Properties",
    },
    {
      id: 4,
      question: "How do I contact a landlord?",
      answer:
        "Open any property listing and tap the 'Contact Landlord' button. You can send a message directly through the app. Landlords typically respond within 24 hours. Be specific about your interest, mention your move-in date, and ask about availability for a better response.",
      category: "Properties",
    },
    {
      id: 5,
      question: "How do I update my profile?",
      answer:
        "Go to your profile page and tap on the edit icon near your avatar. You can update your name, phone number, email address, and profile picture. Changes are saved automatically and synced across all your devices.",
      category: "Account",
    },
    {
      id: 6,
      question: "How do I change my password?",
      answer:
        "Go to Settings from your profile, then select 'Change Password'. Enter your current password and new password to update. Make sure to use a strong password with at least 8 characters, including numbers and special characters for better security.",
      category: "Account",
    },
    {
      id: 7,
      question: "How do I delete my account?",
      answer:
        "To delete your account, go to Settings → Account → Delete Account. Please note that this action is permanent and cannot be undone. All your listings, favorites, and messages will be permanently removed.",
      category: "Account",
    },
    {
      id: 8,
      question: "How do I report a suspicious listing?",
      answer:
        "If you encounter a suspicious listing, tap the three dots menu on the property page and select 'Report'. Our team will review it within 24 hours. You can also email us at safety@nookly.com with the property link and details.",
      category: "Safety",
    },
    {
      id: 9,
      question: "Is Nookly free to use?",
      answer:
        "Yes! Nookly is 100% free for both tenants and landlords. We don't charge any listing fees, commission, or subscription fees. Premium features like featured listings and analytics will be available soon.",
      category: "Pricing",
    },
    {
      id: 10,
      question: "How do I enable notifications?",
      answer:
        "To enable notifications, go to your device Settings → Apps → Nookly → Notifications → Toggle ON. In the app, you can customize what notifications you receive in Settings → Notifications Preferences.",
      category: "Settings",
    },
    {
      id: 11,
      question: "How do I edit or remove a property listing?",
      answer:
        "Go to your profile → My Properties, tap on the property you want to edit, then tap the edit icon. You can update details, add or remove photos, change pricing, or mark it as rented. To remove, tap the delete icon.",
      category: "Properties",
    },
    {
      id: 12,
      question: "What payment methods are accepted?",
      answer:
        "Nookly is currently free to use. When premium features launch, we'll accept credit/debit cards, PayPal, and mobile money. All payments are processed securely through our payment partners.",
      category: "Pricing",
    },
  ];

  const supportOptions = [
    {
      icon: "mail-outline",
      title: "Email Support",
      description: "Get response within 24 hours",
      value: "support@nookly.com",
      onPress: handleEmailPress,
      color: "#3B82F6",
    },
    {
      icon: "call-outline",
      title: "Phone Support",
      description: "Mon-Fri, 9 AM - 6 PM",
      value: "Tap to see contact numbers",
      onPress: handleCallPress,
      color: "#10B981",
    },
    {
      icon: "chatbubble-outline",
      title: "Live Chat",
      description: "Available 24/7",
      value: "Start conversation",
      onPress: () => setChatModalVisible(true),
      color: "#F59E0B",
    },
  ];

  // Group FAQs by category
  const groupedFaqs = faqs.reduce(
    (acc, faq) => {
      if (!acc[faq.category]) {
        acc[faq.category] = [];
      }
      acc[faq.category].push(faq);
      return acc;
    },
    {} as Record<string, typeof faqs>,
  );

  const renderFAQItem = (faq: (typeof faqs)[0]) => {
    const isExpanded = expandedFaqs.has(faq.id);

    return (
      <TouchableOpacity
        key={faq.id}
        className="p-4 rounded-2xl mb-3"
        style={{
          backgroundColor: theme.surface,
          borderWidth: 1,
          borderColor: theme.muted + "30",
        }}
        onPress={() => toggleExpand(faq.id)}
        activeOpacity={0.7}
      >
        <View className="flex-row items-start">
          <View className="w-6 h-6 rounded-full items-center justify-center mr-3 mt-0.5">
            <Ionicons
              name={isExpanded ? "remove-circle" : "add-circle"}
              size={20}
              color={theme.primary[300]}
            />
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-rubik-medium mb-1"
              style={{ color: theme.text }}
            >
              {faq.question}
            </Text>
            {isExpanded && (
              <Text
                className="text-sm leading-5 mt-2"
                style={{ color: theme.muted }}
              >
                {faq.answer}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: theme.background }}
    >
      {/* Custom Header with Back Button */}
      <View
        className="flex-row items-center px-4 py-3 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity onPress={handleBackPress} className="p-2 mr-3">
          <Ionicons name="arrow-back" size={24} color={theme.title} />
        </TouchableOpacity>
        <Text
          className="text-xl font-rubik-bold flex-1"
          style={{ color: theme.title }}
        >
          Help & Support
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={[theme.primary[100], theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="mx-4 mt-4 p-6 rounded-3xl"
        >
          <View className="items-center">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: theme.primary[300] + "20" }}
            >
              <Ionicons
                name="help-circle"
                size={32}
                color={theme.primary[300]}
              />
            </View>
            <Text
              className="text-xl font-rubik-bold text-center"
              style={{ color: theme.title }}
            >
              How can we help you?
            </Text>
            <Text
              className="text-sm text-center mt-2"
              style={{ color: theme.muted }}
            >
              Find answers to common questions or contact our support team
            </Text>
          </View>
        </LinearGradient>

        {/* Quick Stats */}
        <View className="mx-4 mt-6">
          <Text
            className="text-lg font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            Quick Stats
          </Text>
          <View className="flex-row gap-3">
            {/* Stat Card 1 */}
            <View
              className="flex-1 rounded-2xl overflow-hidden"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <LinearGradient
                colors={[theme.primary[300] + "10", theme.primary[300] + "05"]}
                className="p-4 items-center"
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: theme.primary[300] + "20" }}
                >
                  <Ionicons
                    name="time-outline"
                    size={24}
                    color={theme.primary[300]}
                  />
                </View>
                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  24/7
                </Text>
                <Text
                  className="text-xs text-center mt-1"
                  style={{ color: theme.muted }}
                >
                  Support Available
                </Text>
              </LinearGradient>
            </View>

            {/* Stat Card 2 */}
            <View
              className="flex-1 rounded-2xl overflow-hidden"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <View
                className="p-4 items-center"
                style={{ backgroundColor: theme.primary[300] + "05" }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: theme.primary[300] + "20" }}
                >
                  <Ionicons
                    name="flash-outline"
                    size={24}
                    color={theme.primary[300]}
                  />
                </View>
                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  &lt;24h
                </Text>
                <Text
                  className="text-xs text-center mt-1"
                  style={{ color: theme.muted }}
                >
                  Response Time
                </Text>
              </View>
            </View>

            {/* Stat Card 3 */}
            <View
              className="flex-1 rounded-2xl overflow-hidden"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <LinearGradient
                colors={[theme.primary[300] + "10", theme.primary[300] + "05"]}
                className="p-4 items-center"
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: theme.primary[300] + "20" }}
                >
                  <Ionicons
                    name="people-outline"
                    size={24}
                    color={theme.primary[300]}
                  />
                </View>
                <Text
                  className="text-2xl font-rubik-bold"
                  style={{ color: theme.primary[300] }}
                >
                  1000+
                </Text>
                <Text
                  className="text-xs text-center mt-1"
                  style={{ color: theme.muted }}
                >
                  Happy Users
                </Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        {/* Support Options */}
        <View className="mx-4 mt-6">
          <Text
            className="text-lg font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            Contact Support
          </Text>
          <View className="gap-3">
            {supportOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                onPress={option.onPress}
                className="p-4 rounded-2xl flex-row items-center"
                style={{
                  backgroundColor: theme.surface,
                  borderWidth: 1,
                  borderColor: theme.muted + "30",
                }}
              >
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{ backgroundColor: option.color + "20" }}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={24}
                    color={option.color}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-base font-rubik-medium"
                    style={{ color: theme.text }}
                  >
                    {option.title}
                  </Text>
                  <Text
                    className="text-xs mt-0.5"
                    style={{ color: theme.muted }}
                  >
                    {option.description}
                  </Text>
                  <Text
                    className="text-sm font-rubik-medium mt-1"
                    style={{ color: option.color }}
                  >
                    {option.value}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.muted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View className="mx-4 mt-6">
          <View className="flex-row justify-between items-center mb-3">
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              Frequently Asked Questions
            </Text>
            <TouchableOpacity onPress={() => setFaqModalVisible(true)}>
              <Text
                className="text-sm font-rubik-medium"
                style={{ color: theme.primary[300] }}
              >
                View All ({faqs.length})
              </Text>
            </TouchableOpacity>
          </View>
          <View className="gap-3">{faqs.slice(0, 3).map(renderFAQItem)}</View>
        </View>

        {/* Report Issue Section */}
        <View
          className="mx-4 mt-6 p-5 rounded-2xl"
          style={{
            backgroundColor: theme.danger + "10",
            borderWidth: 1,
            borderColor: theme.danger + "30",
          }}
        >
          <View className="flex-row items-center mb-2">
            <Ionicons name="flag-outline" size={24} color={theme.danger} />
            <Text
              className="text-base font-rubik-bold ml-2"
              style={{ color: theme.danger }}
            >
              Report an Issue
            </Text>
          </View>
          <Text className="text-sm mb-3" style={{ color: theme.muted }}>
            Found a bug or have a complaint? Let us know and we&apos;ll fix it
            immediately.
          </Text>
          <TouchableOpacity
            className="py-2 px-4 rounded-xl self-start"
            style={{ backgroundColor: theme.danger }}
            onPress={handleEmailPress}
          >
            <Text className="text-white font-rubik-medium text-sm">
              Report to us
            </Text>
          </TouchableOpacity>
        </View>

        {/* Version Info */}
        <Text
          className="text-center text-xs mt-6"
          style={{ color: theme.muted + "80" }}
        >
          Version 1.0.0 • Terms of Service • Privacy Policy
        </Text>
      </ScrollView>

      {/* FAQ Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={faqModalVisible}
        onRequestClose={() => setFaqModalVisible(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          {/* Modal Header */}
          <LinearGradient
            colors={[theme.primary[100], theme.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-4 py-3 flex-row items-center"
          >
            <TouchableOpacity
              onPress={() => setFaqModalVisible(false)}
              className="mr-3 p-1"
            >
              <Ionicons name="arrow-back" size={24} color={theme.title} />
            </TouchableOpacity>
            <View className="flex-1">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                All FAQs
              </Text>
              <Text className="text-xs" style={{ color: theme.muted }}>
                {faqs.length} articles • Tap to expand
              </Text>
            </View>
          </LinearGradient>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => (
              <View key={category} className="mb-6">
                <View className="flex-row items-center mb-3">
                  <View
                    className="w-1 h-6 rounded-full mr-2"
                    style={{ backgroundColor: theme.primary[300] }}
                  />
                  <Text
                    className="text-base font-rubik-bold"
                    style={{ color: theme.title }}
                  >
                    {category}
                  </Text>
                  <Text className="text-xs ml-2" style={{ color: theme.muted }}>
                    {categoryFaqs.length} articles
                  </Text>
                </View>
                {categoryFaqs.map(renderFAQItem)}
              </View>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* AI Chat Modal */}
      <AIChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
      />
    </SafeAreaView>
  );
}
