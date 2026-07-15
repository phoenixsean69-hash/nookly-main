// app/landChat.tsx
import { Colors } from "@/constants/Colors";
import useAuthStore from "@/store/auth.store";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
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
}

interface FAQ {
  keywords: string[];
  response: string;
  category: string;
  followUp?: string[];
}

// Landlord-Focused Knowledge Base (No Lease Agreements)
const knowledgeBase: FAQ[] = [
  // Greetings
  {
    keywords: [
      "hi",
      "hello",
      "hey",
      "howdy",
      "greetings",
      "good morning",
      "good afternoon",
      "good evening",
      "hie",
      "yo",
      "sup",
      "whats up",
      "what's up",
    ],
    category: "greetings",
    response:
      "Hello! Welcome to Nookly Landlord Support. I'm here to help you manage your properties on Nookly.\n\nWhat I can help with:\n- Listing your properties (max 3 photos)\n- Managing tenant inquiries\n- Property pricing tips\n- Safety guidelines\n- Technical support\n- Zimbabwe rental market insights\n\nHow can I assist you today?\n\nFor urgent help, contact:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
    followUp: [
      "List property",
      "Pricing guide",
      "Tenant inquiries",
      "Safety tips",
    ],
  },
  {
    keywords: ["thanks", "thank you", "appreciate", "grateful", "thx"],
    category: "gratitude",
    response:
      "You're welcome. I'm glad I could help. Is there anything else you'd like to know about managing properties on Nookly?\n\nRemember, you can always reach out to:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
  },
  {
    keywords: ["bye", "goodbye", "see you", "later", "peace", "cya"],
    category: "farewell",
    response:
      "Thanks for chatting.\n\nCONTACT US:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nCome back anytime. Good luck with your properties.",
  },
  {
    keywords: [
      "contact",
      "support",
      "help",
      "reach",
      "call",
      "phone",
      "whatsapp",
    ],
    category: "contact",
    response:
      "You can reach our support team:\n\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\n\nEmail: support@nookly.com\n\nWe're available Monday to Friday, 9 AM to 6 PM.\n\nFeel free to call or WhatsApp.",
  },

  // Property Listings (Landlord Focus)
  {
    keywords: [
      "list property",
      "post property",
      "add listing",
      "advertise",
      "rent out",
      "how to list",
      "become landlord",
      "rent my house",
      "list my apartment",
    ],
    category: "listings",
    response:
      "LISTING YOUR PROPERTY ON NOOKLY\n\nStep by Step Guide:\n1. Go to your profile\n2. Tap 'My Properties'\n3. Click the + button\n4. Fill in property details:\n   • Property name and type\n   • Location and address\n   • Price and deposit\n   • Bedrooms and bathrooms\n   • Amenities\n5. Upload photos (maximum 3 photos)\n6. Write a detailed description\n7. Review and publish\n\nPHOTO LIMIT: You can upload up to 3 photos per property.\n\nPRO TIPS:\n• Make each photo count\n• Show the best angles first\n• Ensure good lighting\n• Highlight unique features\n\nNeed help with a specific step?",
    followUp: ["Photo tips", "Pricing guide", "Description examples"],
  },
  {
    keywords: [
      "photo tips",
      "best photos",
      "how to take photos",
      "pictures quality",
      "property photos",
      "photography tips",
      "3 photos",
      "three photos",
      "photo limit",
    ],
    category: "listings",
    response:
      "PROPERTY PHOTO GUIDE (3 PHOTO LIMIT)\n\nSince you can only upload 3 photos, make them count!\n\nBEST USE OF YOUR 3 PHOTOS:\n1. EXTERIOR/FRONT VIEW - First impression matters\n2. MAIN LIVING AREA OR KITCHEN - Show the heart of the home\n3. BEST BEDROOM OR BATHROOM - Highlight key features\n\nPHOTO TIPS:\n• Use natural light for best results\n• Clean and declutter before shooting\n• Show the room's best angle\n• Avoid blurry or dark photos\n• No filters that distort reality\n\nWHAT TO AVOID:\n• Multiple photos of same room\n• Cluttered or messy spaces\n• Poor lighting\n• Blurry images\n\nMake each of your 3 photos tell a story about your property!",
  },
  {
    keywords: [
      "pricing guide",
      "how to price",
      "rent price",
      "market rate",
      "what to charge",
      "pricing strategy",
    ],
    category: "listings",
    response:
      "SMART PRICING STRATEGY FOR LANDLORDS\n\nFactors to Consider:\n• Location (prime areas command higher rent)\n• Property size and condition\n• Furnished vs unfurnished\n• Parking availability\n• Security features\n• Nearby amenities\n• Current market demand\n\nAVERAGE RATES IN ZIMBABWE (USD/month):\n• Studio: $150 - $250\n• 1-bedroom: $200 - $350\n• 2-bedroom: $300 - $500\n• 3-bedroom: $450 - $800\n• House: $500 - $1500+\n\nPRICING TIPS:\n• Price slightly below market for quick rental\n• Consider first month discount for long leases\n• Be flexible on move-in dates\n• Highlight included utilities\n\nRight pricing = Faster rental + Quality tenants!",
  },
  {
    keywords: [
      "description examples",
      "how to write description",
      "property description",
      "listing description",
    ],
    category: "listings",
    response:
      "WRITING AN EFFECTIVE PROPERTY DESCRIPTION\n\nTEMPLATE STRUCTURE:\n\nHEADLINE: Charming 2-Bedroom in [Area] with Parking\n\nLOCATION: [Neighborhood], close to shops, schools, transport\n\nPROPERTY DETAILS:\n• 2 spacious bedrooms with built-in cupboards\n• Modern bathroom with shower\n• Open-plan living/dining area\n• Fully equipped kitchen\n• Private garden\n• Secure parking for 2 cars\n\nFEATURES:\n✓ 24/7 security\n✓ Prepaid electricity meter\n✓ Borehole water\n✓ Fibre-ready\n\nREQUIREMENTS:\n• Deposit: [amount]\n• Available: [date]\n\nABOUT TENANT: Looking for responsible tenant\n\nPRO TIPS:\n• Be honest about property condition\n• Highlight unique selling points\n• Mention nearby amenities\n• Set clear expectations\n• Use bullet points for readability",
  },

  // Managing Inquiries
  {
    keywords: [
      "tenant inquiry",
      "respond to tenant",
      "message from tenant",
      "handle inquiries",
    ],
    category: "inquiries",
    response:
      "MANAGING TENANT INQUIRIES\n\nBest Practices:\n• Respond within 24 hours\n• Be professional and friendly\n• Answer all questions clearly\n• Schedule viewings promptly\n\nRESPONSE TEMPLATE:\nThank you for your interest in [Property Name].\n\nThe property is still available for viewing.\n\nAvailable viewing times:\n• [Day]: [Time]\n• [Day]: [Time]\n\nPlease confirm which time works for you.\n\nI look forward to meeting you.\n\nTIPS:\n• Keep records of all communications\n• Follow up if no response in 48 hours\n• Prepare answers to common questions",
  },

  // Tenant Screening
  {
    keywords: [
      "screen tenant",
      "tenant screening",
      "check references",
      "verify tenant",
    ],
    category: "screening",
    response:
      "TENANT SCREENING GUIDE\n\nWHAT TO CHECK:\n• Employment verification\n• Income stability\n• Previous landlord references\n• Rental history\n• Identification verification\n\nQUESTIONS TO ASK REFERENCES:\n• Did tenant pay rent on time?\n• Any property damage?\n• Would you rent to them again?\n• Any complaints?\n\nRED FLAGS TO WATCH FOR:\n• Won't view property in person\n• Offers to pay more than asking\n• Pressures for immediate move-in\n• Suspicious payment methods\n• Can't provide references\n\nTRUST YOUR INSTINCTS!",
  },

  // Safety for Landlords
  {
    keywords: [
      "safety",
      "secure",
      "scam",
      "fraud",
      "trust",
      "verify",
      "legit",
      "safe",
      "security",
      "protect",
    ],
    category: "safety",
    response:
      "LANDLORD SAFETY GUIDE\n\nDO'S:\n• Verify tenant identity\n• Use in-app messaging\n• Meet in public places for first meeting\n• Document everything\n• Trust your instincts\n• Report suspicious tenants\n\nDON'TS:\n• Share bank details unnecessarily\n• Accept payments before lease signing\n• Rush into decisions\n• Ignore red flags\n\nCOMMON SCAMS TO AVOID:\n1. Fake tenants - Won't view property\n2. Overpayment scams - Send extra money\n3. Identity theft - Fake documents\n4. Phishing - Fake Nookly emails\n\nRED FLAGS:\n• Won't view property\n• Pressures for quick signing\n• Suspicious payment methods\n• Fake references\n\nREPORT SUSPICIOUS ACTIVITY:\n• Flag user immediately\n• Email: safety@nookly.com\n• Call: +263 77 114 4469",
    followUp: ["Report tenant", "Verify identity", "Red flags", "Safe viewing"],
  },

  // Technical Support
  {
    keywords: [
      "bug",
      "error",
      "crash",
      "not working",
      "freeze",
      "glitch",
      "issue",
      "problem",
      "technical issue",
    ],
    category: "technical",
    response:
      "TROUBLESHOOTING GUIDE\n\nQUICK FIXES:\n1. Restart the app\n2. Clear cache (Settings > Apps > Nookly > Clear Cache)\n3. Update the app\n4. Restart your device\n5. Check internet connection\n\nCOMMON ISSUES AND SOLUTIONS:\n\nApp Won't Load:\n• Check internet connection\n• Update the app\n• Clear cache\n\nImages Not Loading:\n• Check data connection\n• Clear app cache\n• Allow storage permissions\n\nNotifications Not Coming:\n• Check phone settings\n• Enable app notifications\n• Don't use battery saver\n\nLogin Issues:\n• Check credentials\n• Reset password\n• Check internet connection\n\nSTILL HAVING ISSUES?\nContact support@nookly.com with:\n• Device model\n• App version\n• Screenshot of issue\n• Steps to reproduce",
    followUp: [
      "Clear cache",
      "Update app",
      "Notification issues",
      "Contact support",
    ],
  },

  // Zimbabwe Specific for Landlords
  {
    keywords: [
      "zimbabwe",
      "zim",
      "harare",
      "bulawayo",
      "mutare",
      "gweru",
      "kwekwe",
      "masvingo",
      "victoria falls",
      "local",
    ],
    category: "local",
    response:
      "NOOKLY ZIMBABWE - LANDLORD GUIDE\n\nCOVERED CITIES:\n• Harare - CBD, Borrowdale, Avondale, Mt Pleasant\n• Bulawayo - CBD, Hillside, Suburbs\n• Mutare - CBD, Hillside\n• Gweru - CBD, Woodlands\n• Kwekwe - CBD, Amaveni\n• Masvingo - CBD, Rhodene\n\nTYPICAL RENTALS (USD per month):\n• Studio: $150 - $250\n• 1-bedroom: $200 - $350\n• 2-bedroom: $300 - $500\n• 3-bedroom: $450 - $800\n• House: $500 - $1500+\n\nPAYMENT METHODS:\n• USD recommended\n• ZWL accepted\n• EcoCash\n• OneMoney\n• Bank transfer\n\nTIPS FOR LANDLORDS:\n• Clearly state what utilities are included\n• Specify deposit requirements\n• Take photos before tenant moves in\n• Keep maintenance records\n\nEMERGENCY NUMBERS:\n• Police: 999\n• Ambulance: 994\n• Fire: 993\n\nSUPPORT:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com",
  },

  // Fallback
  {
    keywords: [],
    category: "fallback",
    response:
      "I'm here to help.\n\nYou can ask me about:\n\nPROPERTIES:\n• Listing your property (max 3 photos)\n• Pricing your rental\n• Writing descriptions\n• Photo tips\n\nTENANTS:\n• Handling inquiries\n• Screening tenants\n• Red flags to watch for\n\nSAFETY:\n• Avoiding scams\n• Verifying tenants\n• Safe practices\n\nTECHNICAL:\n• App issues\n• Notifications\n• Updates\n\nCONTACT:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nWhat would you like to know?",
  },
];

// Helper function to get best match
const getBestMatch = (userMessage: string): FAQ | null => {
  const message = userMessage.toLowerCase().trim();

  const scoredMatches = knowledgeBase
    .map((faq) => {
      let score = 0;
      let matchedKeywords = 0;

      faq.keywords.forEach((keyword) => {
        if (message.includes(keyword)) {
          score += keyword.length;
          matchedKeywords++;
          if (message.startsWith(keyword)) score += 10;
          if (message === keyword) score += 20;
        }
      });

      if (matchedKeywords > 0) score += matchedKeywords * 5;
      return { faq, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredMatches.length > 0 && scoredMatches[0].score > 0) {
    return scoredMatches[0].faq;
  }

  return null;
};

// AI response generator
const getSmartAIResponse = (
  userMessage: string,
  messageHistory: Message[],
): string => {
  const bestMatch = getBestMatch(userMessage);

  if (bestMatch) {
    let response = bestMatch.response;

    if (bestMatch.followUp && bestMatch.followUp.length > 0) {
      const lastMessages = messageHistory.slice(-3);
      const hasFollowUp = lastMessages.some(
        (m) =>
          m.isUser &&
          bestMatch.followUp?.some((f) =>
            m.text.toLowerCase().includes(f.toLowerCase()),
          ),
      );

      if (!hasFollowUp && !userMessage.toLowerCase().includes("no thanks")) {
        response +=
          "\n\nWOULD YOU LIKE TO KNOW ABOUT:\n" +
          bestMatch.followUp.map((f) => "• " + f).join("\n");
      }
    }

    return response;
  }

  const lowerMsg = userMessage.toLowerCase();

  if (lowerMsg.match(/how|what|where|when|why/)) {
    return (
      knowledgeBase.find((kb) => kb.category === "fallback")?.response ||
      "I'd love to help. Could you tell me more about what you're looking for? I can help with property listings, tenant inquiries, safety tips, and everything Nookly."
    );
  }

  if (lowerMsg.match(/thank|thanks|appreciate/)) {
    return "You're welcome. Is there anything else I can help you with? I'm here 24/7 for all your property management needs.";
  }

  return "I'm here to help.\n\nTell me more about:\n• Listing your property\n• Managing tenant inquiries\n• Safety and security\n• Technical support\n• Zimbabwe rentals\n\nOr contact our team:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nWhat would you like to know?";
};

const ChatSupport = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Welcome to Nookly Landlord Support.\n\nI'm your AI-powered guide, trained to help landlords with:\n\n• Listing properties - Post your rental (max 3 photos)\n• Tenant inquiries - Handle messages professionally\n• Pricing guide - Set competitive rates\n• Safety tips - Protect yourself\n• Technical support - App help\n• Zimbabwe market - Local insights\n\nWhat can I help you with today?\n\nFor urgent help, contact:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "How to list a property?",
    "Photo tips (3 photo limit)",
    "Pricing my rental",
    "Respond to tenant inquiries",
    "Safety tips for landlords",
    "Zimbabwe rental market",
  ]);

  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const sendMessage = async (text?: string) => {
    const messageText = text || inputText;
    if (!messageText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: messageText,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    const thinkingTime = Math.min(800, 300 + messageText.length / 15);

    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getSmartAIResponse(messageText, messages),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
      setIsTyping(false);
      setTimeout(
        () => flatListRef.current?.scrollToEnd({ animated: true }),
        100,
      );

      const lowerMsg = messageText.toLowerCase();
      if (
        lowerMsg.includes("list") ||
        lowerMsg.includes("post") ||
        lowerMsg.includes("add listing")
      ) {
        setSuggestions([
          "Photo tips (3 photo limit)",
          "Pricing guide",
          "Description examples",
        ]);
      } else if (
        lowerMsg.includes("photo") ||
        lowerMsg.includes("picture") ||
        lowerMsg.includes("image")
      ) {
        setSuggestions([
          "Best 3 photos to upload",
          "Photo quality tips",
          "What to show in photos",
        ]);
      } else if (
        lowerMsg.includes("tenant") ||
        lowerMsg.includes("inquiry") ||
        lowerMsg.includes("message")
      ) {
        setSuggestions([
          "Response template",
          "Screening questions",
          "Viewing setup",
        ]);
      } else if (lowerMsg.includes("safety") || lowerMsg.includes("scam")) {
        setSuggestions([
          "Red flags",
          "Verify tenant",
          "Report suspicious activity",
        ]);
      } else if (lowerMsg.includes("harare") || lowerMsg.includes("zimbabwe")) {
        setSuggestions([
          "Areas in Harare",
          "Typical prices",
          "Payment methods",
        ]);
      } else {
        setSuggestions([
          "How to list a property?",
          "Photo tips (3 photo limit)",
          "Pricing my rental",
          "Respond to tenant inquiries",
          "Safety tips",
        ]);
      }
    }, thinkingTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [
          {
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          },
        ],
      }}
    >
      <View
        className={`flex-row mb-4 ${item.isUser ? "justify-end" : "justify-start"}`}
      >
        {!item.isUser && (
          <View className="w-8 h-8 rounded-full bg-primary-300 items-center justify-center mr-2 self-end mb-1">
            <Text className="text-white font-rubik-bold text-xs">AI</Text>
          </View>
        )}
        <View
          className={`max-w-[85%] p-4 rounded-2xl ${item.isUser ? "rounded-br-none" : "rounded-bl-none"}`}
          style={{
            backgroundColor: item.isUser ? theme.primary[300] : theme.surface,
          }}
        >
          <Text
            className={`text-base leading-6 ${item.isUser ? "text-white" : ""}`}
            style={{ color: item.isUser ? "#fff" : theme.text }}
          >
            {item.text}
          </Text>
          <Text
            className={`text-xs mt-2 ${item.isUser ? "text-blue-100" : ""}`}
            style={{ color: item.isUser ? "#e0f2fe" : theme.muted }}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    </Animated.View>
  );

  const renderSuggestion = ({ item }: { item: string }) => (
    <TouchableOpacity
      onPress={() => {
        setInputText(item);
        setTimeout(() => sendMessage(item), 100);
      }}
      className="mr-2 px-4 py-2 rounded-xl"
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

  const renderTypingIndicator = () => (
    <View className="flex-row justify-start mb-4">
      <View className="w-8 h-8 rounded-full bg-primary-300 items-center justify-center mr-2 self-end mb-1">
        <Text className="text-white font-rubik-bold text-xs">AI</Text>
      </View>
      <View
        className="p-3 rounded-2xl rounded-bl-none"
        style={{ backgroundColor: theme.surface }}
      >
        <View className="flex-row">
          <View className="w-2 h-2 rounded-full bg-gray-400 mr-1" />
          <View className="w-2 h-2 rounded-full bg-gray-400 mr-1" />
          <View className="w-2 h-2 rounded-full bg-gray-400" />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header - No Gradient, just simple */}
      <View
        className="px-5 pt-4 pb-3"
        style={{
          backgroundColor: theme.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.muted + "20",
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color={theme.title} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text
              className="text-lg font-rubik-bold"
              style={{ color: theme.title }}
            >
              Nookly Assistant
            </Text>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-400 mr-1" />
              <Text className="text-xs" style={{ color: theme.muted }}>
                Landlord Support • AI-Powered
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push("/help")}>
            <Ionicons
              name="help-circle-outline"
              size={24}
              color={theme.muted}
            />
          </TouchableOpacity>
        </View>
      </View>

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
      {isTyping && renderTypingIndicator()}

      {/* Suggestions */}
      {!isTyping && messages.length > 0 && (
        <View className="px-4 py-3">
          <Text
            className="text-xs font-rubik-medium mb-2 px-1"
            style={{ color: theme.muted }}
          >
            SUGGESTED QUESTIONS
          </Text>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, index) => index.toString()}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          />
        </View>
      )}

      {/* Input Area */}
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
              placeholder="Ask me about managing your properties..."
              placeholderTextColor={theme.muted}
              multiline
              className="max-h-32"
              style={{ color: theme.text, fontSize: 16 }}
            />
          </View>
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={!inputText.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${!inputText.trim() ? "opacity-50" : ""}`}
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
  );
};

export default ChatSupport;
