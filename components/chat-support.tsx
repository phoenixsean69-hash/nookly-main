// components/AIChatModal.tsx
import { Colors } from "@/constants/Colors";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sentiment?: "positive" | "negative" | "neutral";
  intent?: string;
}

interface ConversationContext {
  lastTopic?: string;
  userMood?: "happy" | "frustrated" | "curious" | "neutral";
  mentionedProperty?: string;
  pendingIssue?: boolean;
  stage: "greeting" | "problem" | "solution" | "followup" | "closing";
}

// Advanced NLP utilities
class NLPEngine {
  static tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2);
  }

  static extractEntities(text: string): { type: string; value: string }[] {
    const entities: { type: string; value: string }[] = [];
    const lowerText = text.toLowerCase();

    const propertyTypes = [
      "apartment",
      "house",
      "condo",
      "studio",
      "villa",
      "townhouse",
    ];
    propertyTypes.forEach((type) => {
      if (lowerText.includes(type)) {
        entities.push({ type: "property_type", value: type });
      }
    });

    const priceMatch = lowerText.match(/\$?(\d+(?:,\d+)?(?:\s*k)?)/);
    if (priceMatch) {
      entities.push({ type: "price", value: priceMatch[1] });
    }

    const locations = ["downtown", "suburbs", "city", "beach", "mountain"];
    locations.forEach((loc) => {
      if (lowerText.includes(loc)) {
        entities.push({ type: "location", value: loc });
      }
    });

    const numberMatch = lowerText.match(/\b(\d+)\b/);
    if (numberMatch) {
      entities.push({ type: "number", value: numberMatch[1] });
    }

    return entities;
  }

  static detectIntent(text: string): string {
    const lower = text.toLowerCase();
    const intents = [
      {
        keywords: [
          "list",
          "post",
          "add property",
          "rent out",
          "become landlord",
        ],
        intent: "list_property",
      },
      {
        keywords: ["find", "search", "look for", "rent", "apartment", "house"],
        intent: "find_property",
      },
      {
        keywords: ["favorite", "save", "heart", "bookmark"],
        intent: "favorites",
      },
      {
        keywords: ["contact", "message", "landlord", "owner"],
        intent: "contact_landlord",
      },
      {
        keywords: ["profile", "account", "update", "change", "edit"],
        intent: "profile",
      },
      {
        keywords: ["password", "login", "sign in", "forgot"],
        intent: "account",
      },
      {
        keywords: ["pay", "payment", "cost", "price", "fee"],
        intent: "pricing",
      },
      {
        keywords: ["bug", "error", "crash", "not working", "issue"],
        intent: "technical",
      },
      { keywords: ["review", "rating", "feedback"], intent: "reviews" },
      { keywords: ["notification", "alert", "bell"], intent: "notifications" },
      { keywords: ["safe", "security", "scam", "trust"], intent: "safety" },
      { keywords: ["help", "support", "assist"], intent: "help" },
      { keywords: ["thank", "thanks", "appreciate"], intent: "gratitude" },
      { keywords: ["bye", "goodbye", "see you", "later"], intent: "farewell" },
    ];

    for (const intent of intents) {
      if (intent.keywords.some((keyword) => lower.includes(keyword))) {
        return intent.intent;
      }
    }
    return "general";
  }

  static analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
    const positiveWords = [
      "good",
      "great",
      "awesome",
      "love",
      "like",
      "happy",
      "thanks",
      "helpful",
      "excellent",
      "amazing",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "hate",
      "dislike",
      "angry",
      "frustrated",
      "annoying",
      "slow",
      "broken",
      "error",
    ];

    const words = text.toLowerCase().split(/\s+/);
    let positiveScore = 0;
    let negativeScore = 0;

    words.forEach((word) => {
      if (positiveWords.includes(word)) positiveScore++;
      if (negativeWords.includes(word)) negativeScore++;
    });

    if (positiveScore > negativeScore) return "positive";
    if (negativeScore > negativeScore) return "negative";
    return "neutral";
  }

  static extractUrgency(text: string): "high" | "medium" | "low" {
    const urgentWords = [
      "urgent",
      "asap",
      "immediately",
      "now",
      "quick",
      "emergency",
      "critical",
    ];
    const lowerText = text.toLowerCase();

    if (urgentWords.some((word) => lowerText.includes(word))) return "high";
    if (lowerText.includes("soon") || lowerText.includes("please"))
      return "medium";
    return "low";
  }
}

// Intelligent response generator
class IntelligentResponseGenerator {
  private context: ConversationContext;

  constructor() {
    this.context = {
      stage: "greeting",
      userMood: "neutral",
      pendingIssue: false,
    };
  }

  updateContext(userMessage: string, intent: string, sentiment: any) {
    this.context.lastTopic = intent;
    this.context.userMood =
      sentiment === "positive"
        ? "happy"
        : sentiment === "negative"
          ? "frustrated"
          : "curious";

    if (intent === "technical" || intent === "account") {
      this.context.pendingIssue = true;
    }
  }

  generateResponse(
    userMessage: string,
    intent: string,
    entities: any[],
    sentiment: any,
    urgency: any,
  ): string {
    this.updateContext(userMessage, intent, sentiment);

    if (urgency === "high") {
      return this.getHighPriorityResponse(intent, entities);
    }

    switch (intent) {
      case "list_property":
        return this.getListingResponse(entities, sentiment);
      case "find_property":
        return this.getFindingResponse(entities, sentiment);
      case "favorites":
        return this.getFavoritesResponse();
      case "contact_landlord":
        return this.getContactResponse();
      case "profile":
        return this.getProfileResponse();
      case "account":
        return this.getAccountResponse(urgency);
      case "pricing":
        return this.getPricingResponse();
      case "technical":
        return this.getTechnicalResponse(entities, urgency);
      case "reviews":
        return this.getReviewsResponse();
      case "notifications":
        return this.getNotificationsResponse();
      case "safety":
        return this.getSafetyResponse();
      case "gratitude":
        return this.getGratitudeResponse();
      case "farewell":
        return this.getFarewellResponse();
      case "help":
        return this.getHelpResponse();
      default:
        return this.getGeneralResponse(userMessage, sentiment);
    }
  }

  private getEmojiByMood(sentiment: string): string {
    if (sentiment === "positive") return "😊";
    if (sentiment === "negative") return "🤗";
    return "🤔";
  }

  private getHighPriorityResponse(intent: string, entities: any[]): string {
    const urgentActions: Record<string, string> = {
      technical:
        "🚨 I understand this is urgent! Let me get you immediate help:\n\n1. Try force closing and reopening the app\n2. Clear app cache in settings\n3. If issue persists, I'll connect you with a human agent right away\n\nShould I transfer you to a live agent?",
      account:
        "🔐 I see this is urgent! Let's resolve your account issue:\n\n• Check your email for password reset link\n• Make sure you're using correct credentials\n• Need immediate help? Contact support@nookly.com with 'URGENT' in subject\n\nWhat specific issue are you facing?",
      default:
        "⚠️ I see this is urgent! Let me prioritize your issue:\n\nWhat specific problem are you experiencing? I'll do my best to help quickly!",
    };

    return urgentActions[intent] || urgentActions.default;
  }

  private getListingResponse(entities: any[], sentiment: string): string {
    const propertyType =
      entities.find((e) => e.type === "property_type")?.value || "property";
    const price = entities.find((e) => e.type === "price")?.value;

    let response = `🏠 Ready to list your ${propertyType}! Here's what you need:\n\n`;
    response += `📋 **Required Information:**\n• Property address\n• ${price ? `Price: $${price}` : "Monthly rent amount"}\n• Bedrooms & bathrooms count\n• Property photos (up to 10)\n• Amenities\n\n`;
    response += `📝 **Steps:**\n1. Go to Profile → My Properties\n2. Tap + button\n3. Fill in all details\n4. Upload photos\n5. Preview & Publish!\n\n`;
    response +=
      sentiment === "positive"
        ? "🎉 Your property will be visible within minutes! Want tips for making it stand out?"
        : "💡 Need help with any step? I can guide you through the process!";

    return response;
  }

  private getFindingResponse(entities: any[], sentiment: string): string {
    const propertyType =
      entities.find((e) => e.type === "property_type")?.value || "property";
    const location = entities.find((e) => e.type === "location")?.value;
    const price = entities.find((e) => e.type === "price")?.value;

    let response = `🔍 Finding your perfect ${propertyType}!\n\n`;
    response += `**Current Filters:**\n`;
    if (location) response += `📍 Location: ${location}\n`;
    if (price) response += `💰 Budget: $${price}\n`;
    response += `🏠 Type: ${propertyType}\n\n`;
    response += `**Quick Tips:**\n• Use filters on search page\n• Sort by newest or price\n• Save favorites \n• Enable notifications for new listings\n\n`;

    if (sentiment === "positive") {
      response +=
        "✨ Found something interesting? Tap to view details and contact landlords directly!";
    } else {
      response +=
        "🤝 Not finding what you need? Try adjusting your filters or check back daily for new listings!";
    }

    return response;
  }

  private getFavoritesResponse(): string {
    return `💖 **Your Favorites**\n\n• Tap Save,on each property to save it for offline view\n• View all in 'My Favorites'\n• Get notified when price drops\n• Share favorites with friends\n• Remove by tapping ❤️ again\n\n💡 **Pro Tip:** Enable notifications to never miss updates on your favorite properties!`;
  }

  private getContactResponse(): string {
    return `📱 **Contacting Landlords**\n\n**In-App Messaging:**\n1. Open property listing\n2. Tap 'Contact Landlord'\n3. Write your message\n4. Send & wait for response\n\n**Tips for success:**\n• Be specific about your interest\n• Mention move-in date\n• Ask about availability\n• Keep it professional\n\n💬 Landlords typically respond within 24 hours. Follow up if needed!`;
  }

  private getProfileResponse(): string {
    return `👤 **Your Profile**\n\n**Manage Your Account:**\n• ✏️ Edit profile info\n• 📸 Update profile picture\n• 📞 Change contact details\n• 🔐 Update password\n• 📊 View your activity\n\n**Quick Actions:**\n• My Properties (Landlords)\n• My Favorites (All users)\n• Messages & notifications\n• Payment history\n\nNeed to update something specific? Let me know!`;
  }

  private getAccountResponse(urgency: string): string {
    if (urgency === "high") {
      return `🔐 **URGENT: Account Access**\n\nPlease try these immediately:\n\n1️⃣ **Forgot Password?**\n• Tap 'Forgot Password' on login\n• Check spam folder for reset email\n• Link expires in 1 hour\n\n2️⃣ **Can't Login?**\n• Clear app cache\n• Check internet connection\n• Update app version\n\n❌ Still stuck? Reply 'HUMAN' and I'll connect you with support ASAP!`;
    }

    return `🔐 **Account Management**\n\n**Password Reset:**\n• Tap 'Forgot Password' on sign-in\n• Enter your email\n• Check inbox (spam too!)\n• Follow link to reset\n\n**Account Security:**\n• Use strong passwords\n• Enable 2FA (coming soon)\n• Never share credentials\n\nNeed help with anything else?`;
  }

  private getPricingResponse(): string {
    return `💰 **Nookly is 100% FREE!**\n\n**What's Free:**\n✅ Unlimited property listings\n✅ No commission fees\n✅ Direct messaging\n✅ Favorites & saved searches\n✅ 24/7 AI support\n\n**Coming Soon (Premium):**\n✨ Featured listings\n✨ Analytics dashboard\n✨ Priority support\n✨ Virtual tours\n\nYou're getting amazing value already! 🎉`;
  }

  private getTechnicalResponse(entities: any[], urgency: string): string {
    const troubleshooting = [
      "🔄 Force close & restart app",
      "🗑️ Clear app cache (Settings → Apps → Nookly → Clear Cache)",
      "📱 Update to latest version (Play Store/App Store)",
      "📡 Check internet connection",
      "🔄 Log out and back in",
    ];

    let response = `🔧 **Troubleshooting**\n\n**Try these steps:**\n${troubleshooting.map((step, i) => `${i + 1}. ${step}`).join("\n")}\n\n`;

    if (urgency === "high") {
      response +=
        "🚨 Still having issues? Type 'REPORT' to submit a detailed bug report, and I'll escalate to our tech team!";
    } else {
      response +=
        "💡 Usually one of these steps fixes the issue! Let me know if you need more help.";
    }

    return response;
  }

  private getReviewsResponse(): string {
    return `⭐ **Reviews & Ratings**\n\n**Leaving Reviews:**\n1. Visit property you've rented\n2. Tap 'Write Review'\n3. Rate 1-5 stars\n4. Share your experience\n5. Help others decide!\n\n**Review Guidelines:**\n• Be honest & constructive\n• Focus on experience\n• No personal info\n• Respect landlords\n\nYour reviews help build trust in our community! 🌟`;
  }

  private getNotificationsResponse(): string {
    return `🔔 **Stay Updated**\n\n**Enable Notifications for:**\n• 📧 New property alerts\n• 💬 Message responses\n• ❤️ Favorite updates\n• 🏷️ Price drops\n• 📝 Review replies\n\n**How to enable:**\nSettings → App Settings → Notifications → Toggle ON\n\nNever miss an opportunity! 🚀`;
  }

  private getSafetyResponse(): string {
    return `🛡️ **Stay Safe on Nookly**\n\n**⚠️ DO:**\n• ✅ Verify property details\n• ✅ Meet in public places\n• ✅ Use in-app messaging\n• ✅ Trust your instincts\n• ✅ Report suspicious listings\n\n**❌ DON'T:**\n• ❌ Share banking info\n• ❌ Pay before viewing\n• ❌ Wire transfers\n• ❌ Share passwords\n• ❌ Ignore red flags\n\nYour safety is our priority! 🚨 Report suspicious activity immediately.`;
  }

  private getGratitudeResponse(): string {
    const responses = [
      "You're welcome! 😊 Anything else I can help with?",
      "Happy to help! 🌟 What else would you like to know?",
      "My pleasure! 🎉 Need assistance with anything else?",
      "Always glad to assist! 💪 How can I help further?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getFarewellResponse(): string {
    return `👋 Thanks for chatting! Here's how to reach us:\n\n📧 Email: support@nookly.com\n📞 Phone: +263 77 114 4469\n\+263 77 600 6288\n\💬 Come back anytime!\n\nHave a great day! `;
  }

  private getHelpResponse(): string {
    return ` **I can help with:**\n\n **Properties**\n• List, find, favorite\n• Contact landlords\n• Compare options\n\n **Account**\n• Profile management\n• Password reset\n• Settings\n\n **Support**\n• Technical issues\n• Safety tips\n• FAQs\n\n **Pricing**\n• Free features\n• Premium plans\n\nWhat would you like to know? Type a topic or ask anything!`;
  }

  private getGeneralResponse(userMessage: string, sentiment: string): string {
    const entities = NLPEngine.extractEntities(userMessage);
    const entitiesText = entities.map((e) => e.value).join(", ");

    let response = `🤔 Hmm, interesting question!\n\n`;
    response += `Here's what I understood: `;
    if (entitiesText) {
      response += `I noticed you mentioned ${entitiesText}. `;
    }
    response += `\n\n💡 **I can help with:**\n• Finding/listing properties\n• Account management\n• Technical support\n• Safety guidelines\n• General questions\n\n`;

    if (sentiment === "negative") {
      response += `I'm here to help! Could you tell me more about what you need? 😊`;
    } else {
      response += `What specific topic would you like to explore? Try asking about:\n→ "How to list a property"\n→ "Find apartments downtown"\n→ "Password reset"`;
    }

    return response;
  }
}

interface AIChatModalProps {
  visible: boolean;
  onClose: () => void;
}

const AIChatModal: React.FC<AIChatModalProps> = ({ visible, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "👋 Hi there! I'm your intelligent Nookly assistant.\n\nI can help you with:\n Finding or listing properties\n Account & security\n Technical support\n Pricing & features\n Reviews & ratings\n\nWhat can I help you with today?",
      isUser: false,
      timestamp: new Date(),
      sentiment: "positive",
      intent: "greeting",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "How to list a property?",
    "Find apartments near me",
    "Can't login to account",
    "Safety tips",
    "How to contact landlord?",
  ]);
  const flatListRef = useRef<FlatList>(null);
  const responseGenerator = useRef(new IntelligentResponseGenerator());

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    setTimeout(() => {
      const intent = NLPEngine.detectIntent(inputText);
      const entities = NLPEngine.extractEntities(inputText);
      const sentiment = NLPEngine.analyzeSentiment(inputText);
      const urgency = NLPEngine.extractUrgency(inputText);

      const responseText = responseGenerator.current.generateResponse(
        inputText,
        intent,
        entities,
        sentiment,
        urgency,
      );

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        isUser: false,
        timestamp: new Date(),
        sentiment,
        intent,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsTyping(false);

      if (intent === "find_property") {
        setSuggestions([
          "Filter by price",
          "Save favorites",
          "Contact landlord",
        ]);
      } else if (intent === "list_property") {
        setSuggestions([
          "How to add photos",
          "Pricing tips",
          "Featured listing",
        ]);
      } else {
        setSuggestions([
          "Find properties",
          "Account help",
          "Safety tips",
          "Contact support",
        ]);
      }

      flatListRef.current?.scrollToEnd({ animated: true });
    }, 800);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      className={`flex-row mb-3 ${item.isUser ? "justify-end" : "justify-start"}`}
    >
      <View
        className={`max-w-[85%] p-3 rounded-2xl ${
          item.isUser ? "rounded-br-none" : "rounded-bl-none"
        }`}
        style={{
          backgroundColor: item.isUser ? theme.primary[300] : theme.surface,
        }}
      >
        <Text
          className={`text-base leading-5 ${item.isUser ? "text-white" : ""}`}
          style={{ color: item.isUser ? "#fff" : theme.text }}
        >
          {item.text}
        </Text>
        <Text
          className={`text-xs mt-1 ${item.isUser ? "text-blue-100" : ""}`}
          style={{ color: item.isUser ? "#e0f2fe" : theme.muted }}
        >
          {formatTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  // components/AIChatModal.tsx (updated suggestions section)

  // ... keep all your existing code until the suggestions part

  const renderSuggestion = ({ item }: { item: string }) => (
    <TouchableOpacity
      onPress={() => {
        setInputText(item);
        setTimeout(() => sendMessage(), 100);
      }}
      className="mr-2 px-4 py-2.5 rounded-xl"
      style={{
        backgroundColor: theme.primary[300] + "15",
        borderWidth: 0.5,
        borderColor: theme.primary[300] + "40",
      }}
    >
      <Text
        style={{ color: theme.primary[300] }}
        className="text-sm font-rubik-medium"
      >
        {item}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Header - Keep as is */}
        <LinearGradient
          colors={[theme.primary[100], theme.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          className="px-4 py-3 flex-row items-center"
        >
          <TouchableOpacity onPress={onClose} className="mr-3 p-1">
            <Ionicons name="close" size={24} color={theme.title} />
          </TouchableOpacity>
          <View className="flex-1 flex-row items-center">
            <View className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 items-center justify-center mr-3">
              <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
            </View>
            <View>
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                Nookly AI Assistant
              </Text>
              <View className="flex-row items-center">
                <View className="w-2 h-2 rounded-full bg-green-500 mr-1" />
                <Text className="text-xs" style={{ color: theme.muted }}>
                  Advanced AI • Always learning
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Typing Indicator */}
        {isTyping && (
          <View className="px-4 py-2">
            <View
              className="p-3 rounded-2xl rounded-bl-none self-start"
              style={{ backgroundColor: theme.surface }}
            >
              <View className="flex-row space-x-1">
                <View className="w-2 h-2 rounded-full bg-gray-400 animate-pulse" />
                <View className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-75" />
                <View className="w-2 h-2 rounded-full bg-gray-400 animate-pulse delay-150" />
              </View>
            </View>
          </View>
        )}

        {/* Suggestions Section - REDESIGNED */}
        {!isTyping && messages.length > 0 && (
          <View className="px-4 py-3">
            <Text
              className="text-xs font-rubik-medium mb-2 px-1"
              style={{ color: theme.muted }}
            >
              Suggested questions
            </Text>
            <FlatList
              data={suggestions}
              renderItem={renderSuggestion}
              keyExtractor={(item, index) => index.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{
                paddingRight: 16,
              }}
            />
          </View>
        )}

        {/* Input Area - Keep as is */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          <View
            className="flex-row items-end p-4 border-t"
            style={{
              backgroundColor: theme.background,
              borderTopColor: theme.muted + "30",
            }}
          >
            <View
              className="flex-1 rounded-2xl px-4 py-2 mr-2"
              style={{
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.muted + "30",
              }}
            >
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Ask me anything about Nookly..."
                placeholderTextColor={theme.muted}
                multiline
                className="max-h-32"
                style={{ color: theme.text, fontSize: 16 }}
              />
            </View>
            <TouchableOpacity
              onPress={sendMessage}
              disabled={!inputText.trim()}
              className={`w-10 h-10 rounded-full items-center justify-center ${
                inputText.trim() ? "" : "opacity-50"
              }`}
              style={{
                backgroundColor: inputText.trim()
                  ? theme.primary[300]
                  : theme.muted,
              }}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

export default AIChatModal;
