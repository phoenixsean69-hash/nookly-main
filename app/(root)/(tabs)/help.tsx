import { Colors } from "@/constants/Colors";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Alert,
  findNodeHandle,
  Linking,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Import the AI Chat component
import AIChatModal from "@/components/chat-support";

// Enable LayoutAnimation for Android
if (Platform.OS === "android") {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

export default function Help() {
  const { user } = useAuthStore();
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [faqModalVisible, setFaqModalVisible] = useState(false);
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set());
  const [highlightCategory, setHighlightCategory] = useState<string | null>(
    null,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const categoryRefs = useRef<Record<string, View | null>>({});
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const handleBackPress = () => {
    router.push("/profile");
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

  const openFaqModalWithHighlight = (category: string) => {
    setHighlightCategory(category);
    setFaqModalVisible(true);

    // Scroll to the category after modal is rendered
    setTimeout(() => {
      if (categoryRefs.current[category]) {
        const nodeHandle = findNodeHandle(categoryRefs.current[category]);
        if (nodeHandle && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({ y: 0, animated: true });
          // Use measure to get position
          categoryRefs.current[category]?.measureLayout(
            findNodeHandle(scrollViewRef.current),
            (x, y) => {
              scrollViewRef.current?.scrollTo({ y: y - 100, animated: true });
            },
            () => {},
          );
        }
      }
    }, 300);
  };

  const faqs = [
    // Finding Properties
    {
      id: 1,
      question: "How do I find properties to rent?",
      answer:
        "Use the search bar on the home screen. You can filter by location, price range, property type, number of bedrooms, and amenities. Sort by newest, price, or popularity to find your perfect home. Save your searches to get notified when new properties match your criteria!",
      category: "Finding Properties",
    },
    {
      id: 2,
      question: "How do I save favorite properties?",
      answer:
        "Tap the heart icon on any property card to save it to your favorites. You can view all saved properties in the 'My Favorites' section. Favorites sync across all your devices, and you'll get notified when the price drops on saved properties.",
      category: "Finding Properties",
    },
    {
      id: 3,
      question: "How do I contact a landlord?",
      answer:
        "Open any property listing and tap the 'Contact Landlord' button. You can send a message directly through the app. Landlords typically respond within 24 hours. Be specific about your interest, mention your move-in date, and ask about availability for a better response.",
      category: "Finding Properties",
    },
    {
      id: 4,
      question: "What should I ask before viewing a property?",
      answer:
        "Key questions to ask: Is the property still available? What's included in rent (water, electricity, WiFi)? Is parking available? What's the neighborhood like? Are pets allowed? How long is the lease? What's the deposit amount? When can I view the property?",
      category: "Finding Properties",
    },

    // Student-Specific Content
    {
      id: 5,
      question: "🎓 How do I find student accommodation?",
      answer:
        "To find student-friendly properties: 1) Use the 'Student Housing' filter in search, 2) Look for 'Boarding' property type, 3) Check areas near universities (Milton Park, Mount Pleasant, campus areas), 4) Filter by price range ($150-400/month), 5) Look for keywords like 'students welcome', 'near campus', 'shared facilities'. Many landlords offer special student rates and flexible lease terms!",
      category: "Student Tips",
    },
    {
      id: 6,
      question: "🎓 What should students look for in a rental?",
      answer:
        "As a student, prioritize: ✅ Proximity to campus/public transport ✅ Affordable rent ($150-400/month) ✅ Utilities included or clearly stated ✅ Safe neighborhood ✅ Study-friendly environment ✅ Reliable WiFi ✅ Flexible lease terms (per semester) ✅ Furnished room (bed, desk, chair) ✅ Shared kitchen/living space ✅ Good security (locks, burglar bars). Always view the property before paying any deposit!",
      category: "Student Tips",
    },
    {
      id: 7,
      question: "🎓 Can I rent with friends/roommates?",
      answer:
        "Yes! Many properties accept multiple tenants. Tips for group renting: 1) Look for 'shared accommodation' or 'student house', 2) Ensure everyone is on the lease, 3) Discuss budget and expectations beforehand, 4) Designate who contacts landlord, 5) Split utilities fairly, 6) Have a roommate agreement for chores/guests. Boarding houses often have individual room rentals with shared common areas.",
      category: "Student Tips",
    },
    {
      id: 8,
      question: "🎓 What documents do students need to rent?",
      answer:
        "Students typically need: 📄 Student ID or acceptance letter 📄 Proof of enrollment 📄 Guarantor/Parent information (if no income) 📄 References (previous landlord or character) 📄 Deposit (usually 1 month rent) 📄 Valid ID/Passport. Some landlords may also request a co-signer for first-time renters.",
      category: "Student Tips",
    },
    {
      id: 9,
      question: "🎓 Are there student discounts?",
      answer:
        "Yes! Many landlords offer student discounts: 🎓 5-10% off rent with valid student ID 🎓 Reduced deposit for students 🎓 Flexible payment terms 🎓 Shorter lease options (per semester). Always mention you're a student when contacting landlords - they may have special student rates not listed publicly!",
      category: "Student Tips",
    },

    // Account Management
    {
      id: 10,
      question: "How do I update my profile?",
      answer:
        "Go to your profile page and tap on the edit icon near your avatar. You can update your name, phone number, email address, and profile picture. Changes are saved automatically and synced across all your devices.",
      category: "Account",
    },
    {
      id: 11,
      question: "How do I change my password?",
      answer:
        "Go to Settings from your profile, then select 'Change Password'. Enter your current password and new password to update. Make sure to use a strong password with at least 8 characters, including numbers and special characters for better security.",
      category: "Account",
    },
    {
      id: 12,
      question: "How do I delete my account?",
      answer:
        "To delete your account, go to Settings → Account → Delete Account. Please note that this action is permanent and cannot be undone. All your favorites and messages will be permanently removed.",
      category: "Account",
    },

    // Safety
    {
      id: 13,
      question: "How do I spot a scam listing?",
      answer:
        "🚩 Red flags to watch for: ❌ Price too good to be true ❌ Landlord won't show property ❌ Requests deposit before viewing ❌ Poor quality or stolen photos ❌ Vague descriptions ❌ Pressure to pay immediately ❌ Only accepts wire transfer/crypto. Always verify the property exists, view in person, and never pay before signing a lease!",
      category: "Safety",
    },
    {
      id: 14,
      question: "How do I report a suspicious listing?",
      answer:
        "If you encounter a suspicious listing, tap the three dots menu on the property page and select 'Report'. Our team will review it within 24 hours. You can also email us at support@nookly.com with the property link and details. Your safety is our priority!",
      category: "Safety",
    },
    {
      id: 15,
      question: "Safe viewing tips for students?",
      answer:
        "📌 Stay safe during viewings: • Bring a friend/roommate • Tell someone where you're going • Meet during daylight • Trust your instincts • Don't go alone to isolated properties • Take photos/videos • Ask lots of questions • Never carry large amounts of cash. Report anything suspicious immediately!",
      category: "Safety",
    },

    // Payments & Pricing
    {
      id: 16,
      question: "Is Nookly free to use?",
      answer:
        "Yes! Nookly is 100% free for tenants. We don't charge any fees for searching, contacting landlords, or saving favorites. You'll never pay to use our platform - it's completely free to find your perfect home!",
      category: "Pricing",
    },
    {
      id: 17,
      question: "What should I know about deposits?",
      answer:
        "💰 Deposit tips: • Usually 1-2 months rent • Get a written receipt • Document property condition before moving in (photos/videos) • Understand return conditions • Ask about deductions • Get deposit return timeline in writing. Never pay deposit before viewing and signing a lease!",
      category: "Payments",
    },
    {
      id: 18,
      question: "What utilities are typically included?",
      answer:
        "Common inclusions: 🏠 Sometimes included: Water, refuse collection, security 🏠 Often separate: Electricity (prepaid), WiFi, parking 🏠 Ask about: Generator/backup power, borehole water, internet options. Always clarify what's included BEFORE signing the lease to avoid surprises!",
      category: "Payments",
    },

    // Notifications & Settings
    {
      id: 19,
      question: "How do I enable notifications?",
      answer:
        "To enable notifications: 1) Go to your device Settings → Apps → Nookly → Notifications → Toggle ON, 2) In the app, go to Settings → Notifications Preferences to customize what you receive (new listings, price drops, messages). Enable notifications to never miss your dream home!",
      category: "Settings",
    },
    {
      id: 20,
      question: "How do I get alerts for new properties?",
      answer:
        "Set up saved searches: 1) Perform a search with your criteria (location, price, type), 2) Tap 'Save Search', 3) Toggle notifications ON. You'll get instant alerts when new properties match your preferences! Perfect for finding great deals before others.",
      category: "Settings",
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

        {/* Student Special Section */}
        <View className="mx-4 mt-6">
          <LinearGradient
            colors={["#8B5CF6", "#6D28D9"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            className="p-5 rounded-2xl"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="school-outline" size={28} color="#fff" />
              <Text className="text-white text-xl font-rubik-bold ml-2">
                Student Hub 🎓
              </Text>
            </View>
            <Text className="text-white/90 text-sm mb-3">
              Need help finding student accommodation? Check out our
              student-specific guides and tips!
            </Text>
            <TouchableOpacity
              onPress={() => openFaqModalWithHighlight("Student Tips")}
              className="bg-white/20 px-4 py-2 rounded-full self-start"
            >
              <Text className="text-white font-rubik-medium text-sm">
                View Student Tips →
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>

        {/* Quick Stats */}
        <View className="mx-4 mt-6">
          <Text
            className="text-lg font-rubik-bold mb-3"
            style={{ color: theme.title }}
          >
            Quick Stats
          </Text>
          <View className="flex-row gap-3">
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
                  Happy Students
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
          <View className="gap-3">{faqs.slice(0, 5).map(renderFAQItem)}</View>
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
            Found a bug, suspicious listing, or have a complaint? Let us know
            and we'll fix it immediately.
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
          Version 1.0.0 • For Tenants • Student-Friendly
        </Text>
      </ScrollView>

      {/* FAQ Modal with Highlight */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={faqModalVisible}
        onRequestClose={() => {
          setFaqModalVisible(false);
          setHighlightCategory(null);
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
          <LinearGradient
            colors={[theme.primary[100], theme.background]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="px-4 py-3 flex-row items-center"
          >
            <TouchableOpacity
              onPress={() => {
                setFaqModalVisible(false);
                setHighlightCategory(null);
              }}
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
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
            {Object.entries(groupedFaqs).map(([category, categoryFaqs]) => {
              const isHighlighted = highlightCategory === category;

              return (
                <View
                  key={category}
                  className={`mb-6 ${isHighlighted ? "rounded-2xl overflow-hidden" : ""}`}
                  ref={(ref) => {
                    categoryRefs.current[category] = ref;
                  }}
                >
                  {/* Highlight border and background for Student Tips */}
                  {isHighlighted ? (
                    <View
                      className="rounded-2xl p-4"
                      style={{
                        backgroundColor: "#8B5CF6" + "10",
                        borderWidth: 2,
                        borderColor: "#8B5CF6",
                        shadowColor: "#8B5CF6",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.3,
                        shadowRadius: 10,
                        elevation: 5,
                      }}
                    >
                      <View className="flex-row items-center mb-3">
                        <View
                          className="w-1 h-6 rounded-full mr-2"
                          style={{ backgroundColor: "#8B5CF6" }}
                        />
                        <Text
                          className="text-base font-rubik-bold"
                          style={{ color: "#8B5CF6" }}
                        >
                          {category}
                        </Text>
                        <Text
                          className="text-xs ml-2"
                          style={{ color: theme.muted }}
                        >
                          {categoryFaqs.length} articles
                        </Text>
                        <View className="ml-2 bg-purple-500 px-2 py-0.5 rounded-full">
                          <Text className="text-white text-xs font-rubik-medium">
                            Featured
                          </Text>
                        </View>
                      </View>
                      {categoryFaqs.map(renderFAQItem)}
                    </View>
                  ) : (
                    <>
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
                        <Text
                          className="text-xs ml-2"
                          style={{ color: theme.muted }}
                        >
                          {categoryFaqs.length} articles
                        </Text>
                      </View>
                      {categoryFaqs.map(renderFAQItem)}
                    </>
                  )}
                </View>
              );
            })}
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
