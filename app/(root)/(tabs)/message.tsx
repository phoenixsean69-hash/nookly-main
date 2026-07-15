// app/chat-support.tsx
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

// Tenant & Student-Focused Knowledge Base with proper spacing
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
      "Hello! Welcome to Nookly Tenant Support.\n\nI'm here to help you find properties and answer questions about renting.\n\nWHAT I CAN HELP WITH:\n• Finding properties to rent\n• Student accommodation\n• Contacting landlords\n• Viewing properties\n• Lease basics\n• Safety tips for tenants\n\nHow can I assist you today?\n\nFor urgent help, you can contact:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
    followUp: [
      "Find properties",
      "Student housing",
      "Contact landlord",
      "Viewing tips",
    ],
  },
  {
    keywords: ["thanks", "thank you", "appreciate", "grateful", "thx"],
    category: "gratitude",
    response:
      "You're welcome. I'm glad I could help.\n\nIs there anything else you'd like to know about finding properties on Nookly?\n\nRemember, you can always reach out to:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
  },
  {
    keywords: ["bye", "goodbye", "see you", "later", "peace", "cya"],
    category: "farewell",
    response:
      "Thanks for chatting.\n\nCONTACT US:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nCome back anytime. Good luck with your property search.",
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
  {
    keywords: ["sean", "michell", "agent", "human", "real person"],
    category: "contact",
    response:
      "You can speak directly with:\n\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\n\nThey're available to help with property inquiries, account issues, or any questions about Nookly.",
  },

  // Finding Properties
  {
    keywords: [
      "find property",
      "search",
      "looking for",
      "apartment",
      "house",
      "room",
      "rent",
      "properties near",
      "find home",
      "looking to rent",
      "need apartment",
    ],
    category: "search",
    response:
      "FINDING PROPERTIES ON NOOKLY\n\nGetting Started:\n1. Open the Nookly app\n2. Use the search bar or browse listings\n3. Apply filters to narrow down options\n\nFILTERS YOU CAN USE:\n• Location (city, suburb)\n• Price range (set your budget)\n• Property type (Apartment, House, Boarding)\n• Bedrooms (1, 2, 3, 4+)\n• Bathrooms\n• Amenities (parking, WiFi, security)\n\nTIPS FOR SUCCESS:\n• Save your searches to get alerts\n• Check new listings daily\n• Contact landlords quickly\n• Ask landlords what's included in rent\n\nWhat type of property are you looking for?",
    followUp: [
      "Filter by price",
      "Save favorites",
      "Contact landlord",
      "Viewing tips",
    ],
  },
  {
    keywords: [
      "filter by price",
      "price filter",
      "budget",
      "within budget",
      "affordable",
      "price range",
    ],
    category: "search",
    response:
      "USING PRICE FILTERS\n\nHow to Filter by Price:\n• Open search\n• Tap the 'Price' filter\n• Set your minimum and maximum budget\n• Apply and browse\n\nBUDGET TIPS:\n• Ask landlords what's included in the rent\n• Check if utilities are separate\n• Ask about deposit requirements\n\nPRICE BRACKETS:\n• Under $100\n• $100 - $200\n• $200 - $300\n• $300 - $400\n• $400 - $500\n• $500 and above",
  },
  {
    keywords: [
      "save favorites",
      "favorite",
      "bookmark",
      "heart",
      "saved properties",
      "wishlist",
    ],
    category: "favorites",
    response:
      "SAVING FAVORITE PROPERTIES\n\nHow to Save:\n• Tap the heart icon on any property\n• Saved to 'My Favorites'\n• Access anytime from your profile\n\nFEATURES:\n• Favorites sync across your devices\n• Get alerts when prices change\n• Compare multiple properties\n• Remove anytime\n\nPRO TIPS:\n• Save properties to compare later\n• Check your favorites regularly\n• Act quickly - good properties go fast",
  },

  // Student Accommodation
  {
    keywords: [
      "student housing",
      "student accommodation",
      "university",
      "college",
      "student",
      "campus",
      "boarding",
      "boarding house",
    ],
    category: "student",
    response:
      "STUDENT ACCOMMODATION GUIDE\n\nPOPULAR STUDENT AREAS:\n• Harare: Milton Park, Mount Pleasant\n• Bulawayo: Suburbs near NUST\n• Mutare: Hillside near Africa University\n\nWHAT TO LOOK FOR:\n• Close to campus\n• Safe neighborhood\n• Security features\n• Reliable WiFi\n• Shared utilities\n• Flexible lease (per semester)\n• Furnished options\n\nTYPICAL BUDGET: $150 - $400 per month\n\nTIPS FOR STUDENTS:\n• Consider roommates to split costs\n• Check WiFi speed before committing\n• Ask about curfew if applicable\n• Confirm what utilities are included\n• View properties with friends\n\nDOCUMENTS YOU MAY NEED:\n• Student ID\n• Proof of enrollment\n• Guardian contact information\n\nSome landlords offer student discounts - always ask.",
    followUp: ["Student areas", "Roommates", "Near campus", "Documents needed"],
  },
  {
    keywords: ["roommate", "roommates", "shared", "sharing", "split rent"],
    category: "student",
    response:
      "FINDING ROOMMATES\n\nBENEFITS OF ROOMMATES:\n• Split rent and utilities\n• Share household responsibilities\n• Built-in company\n\nTHINGS TO DISCUSS BEFOREHAND:\n• Budget contributions\n• Cleaning schedule\n• Guest policies\n• Study hours\n• Food sharing\n• Noise levels\n\nWHERE TO FIND ROOMMATES:\n• University notice boards\n• Student WhatsApp groups\n• Nookly roommate matching feature\n• Social media groups\n\nTIPS FOR SUCCESS:\n• Meet potential roommates first\n• Discuss expectations clearly\n• Get agreement in writing\n• Have a backup plan",
  },

  // Contacting Landlords
  {
    keywords: [
      "contact landlord",
      "message owner",
      "how to contact",
      "reach out",
      "inquire",
      "ask question",
      "message landlord",
    ],
    category: "communication",
    response:
      "CONTACTING LANDLORDS\n\nHow to Contact:\n1. Open property listing\n2. Tap 'Contact Landlord' button\n3. Write your message\n4. Send and wait for response\n\nMESSAGE TEMPLATE:\nHello, I'm interested in [Property Name] listed on Nookly.\n\nI'm looking to move in [date] for [duration].\n\nCould we schedule a viewing? I'm available [days/times].\n\nQUESTIONS TO ASK:\n• Is parking included?\n• What utilities are covered?\n• Are pets allowed?\n• When is the property available?\n\nThanks for your time.\n\nBEST PRACTICES:\n• Respond within hours to inquiries\n• Be professional and polite\n• Ask specific questions\n• Confirm viewing details",
    followUp: ["Message templates", "Viewing questions", "What to ask"],
  },
  {
    keywords: [
      "viewing tips",
      "property viewing",
      "what to check",
      "inspection",
      "viewing questions",
    ],
    category: "communication",
    response:
      "PROPERTY VIEWING CHECKLIST\n\nBEFORE VIEWING:\n• Research the neighborhood\n• Prepare your questions\n• Bring a friend if possible\n• Take notes and photos\n\nWHAT TO CHECK:\n\nGeneral:\n• Natural light\n• Ventilation\n• Noise levels\n• Security features\n\nBathroom:\n• Water pressure\n• Hot water\n• Toilet flush\n• No mould or dampness\n\nKitchen:\n• Appliances work\n• Cabinet condition\n• Counter space\n• Storage\n\nBedrooms:\n• Closet space\n• Window condition\n• Door locks\n\nOutside:\n• Parking availability\n• Garden/yard condition\n• Security\n\nQUESTIONS TO ASK THE LANDLORD:\n• How long has property been vacant?\n• What's included in rent?\n• Who handles maintenance?\n• Any planned renovations?\n\nRED FLAGS TO WATCH FOR:\n• Landlord rushing you\n• Can't show the property\n• Price too good to be true\n• Pressure to pay immediately",
  },

  // Account Management
  {
    keywords: [
      "profile",
      "edit profile",
      "update profile",
      "change photo",
      "account settings",
      "manage account",
    ],
    category: "account",
    response:
      "MANAGING YOUR PROFILE\n\nHow to Edit Your Profile:\n1. Tap the profile icon (top right)\n2. Select 'Edit Profile'\n3. Update your information:\n   • Profile picture\n   • Display name\n   • Contact info\n   • Bio/description\n4. Save changes\n\nACCOUNT SETTINGS:\n• Notifications - Customize alerts\n• Privacy - Who can contact you\n• Security - Change password\n\nComplete profiles get more responses from landlords.",
    followUp: [
      "Change password",
      "Notification settings",
      "Privacy",
      "Delete account",
    ],
  },
  {
    keywords: [
      "forgot password",
      "reset password",
      "can't login",
      "login issue",
      "password reset",
      "forgot login",
    ],
    category: "account",
    response:
      "PASSWORD RECOVERY\n\nStep by Step:\n1. On login screen, tap 'Forgot Password'\n2. Enter your registered email address\n3. Check your inbox for reset link (5-10 minutes)\n4. Check spam/junk folder if not in inbox\n5. Click the link and create a new password\n6. Login with your new password\n\nSTILL HAVING ISSUES?\n• Ensure email address is correct\n• Wait 15 minutes and try again\n• Clear browser cache\n• Contact support@nookly.com\n\nSECURITY NOTE: Nookly staff will never ask for your password.",
  },

  // Safety Tips
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
      "TENANT SAFETY GUIDE\n\nDO'S:\n• View property before paying anything\n• Use in-app messaging\n• Meet in public places\n• Verify property exists\n• Take someone with you\n• Document everything\n• Trust your instincts\n• Report suspicious listings\n\nDON'TS:\n• Share bank details\n• Pay before viewing\n• Accept wire transfers\n• Share personal ID\n• Rush into decisions\n• Ignore red flags\n\nCOMMON SCAMS TO AVOID:\n1. Fake Listings - Too good to be true\n2. Deposit Demands - Before viewing\n3. Identity Theft - Asking for ID\n4. Phishing - Fake Nookly emails\n\nRED FLAGS:\n• Landlord won't show property\n• Pressures for deposit\n• Only accepts wire transfer\n• Overseas landlord story\n• Can't answer questions\n• No lease agreement\n\nREPORT SUSPICIOUS ACTIVITY:\n• Flag listing immediately\n• Email: safety@nookly.com\n• Call: +263 77 114 4469\n\nYour safety is our priority.",
    followUp: [
      "Report listing",
      "Verify property",
      "Red flags",
      "Safe viewing",
    ],
  },
  {
    keywords: [
      "red flags",
      "warning signs",
      "suspicious",
      "scam signs",
      "danger signs",
    ],
    category: "safety",
    response:
      "RED FLAGS TO WATCH FOR\n\nLISTING RED FLAGS:\n• Price too good to be true\n• Blurry or stock photos\n• No address provided\n• Vague description\n• Newly created account\n• Multiple identical listings\n\nLANDLORD RED FLAGS:\n• Won't show the property\n• Pressures for deposit\n• Only accepts wire transfer\n• Overseas landlord story\n• Can't answer questions\n• No lease agreement\n\nPAYMENT RED FLAGS:\n• Western Union or MoneyGram\n• Cryptocurrency\n• Gift cards\n• Unmarked accounts\n• No receipt\n\nTrust your gut. If something feels wrong, walk away.\n\nReport immediately: safety@nookly.com",
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
      "TROUBLESHOOTING GUIDE\n\nQUICK FIXES:\n1. Restart the app\n2. Clear cache (Settings > Apps > Nookly > Clear Cache)\n3. Update the app\n4. Restart your device\n5. Check internet connection\n\nCOMMON ISSUES AND SOLUTIONS:\n\nApp Won't Load:\n• Check internet connection\n• Update the app\n• Clear cache\n• Reinstall if needed\n\nImages Not Loading:\n• Check data connection\n• Clear app cache\n• Allow storage permissions\n\nNotifications Not Coming:\n• Check phone settings\n• Enable app notifications\n• Don't use battery saver\n\nLogin Issues:\n• Check credentials\n• Reset password\n• Check internet connection\n\nSearch Not Working:\n• Clear filters\n• Update the app\n• Check location permissions\n\nSTILL HAVING ISSUES?\nContact support@nookly.com with:\n• Device model\n• App version\n• Screenshot of issue\n• Steps to reproduce the problem",
    followUp: [
      "Clear cache",
      "Update app",
      "Notification issues",
      "Contact support",
    ],
  },

  // Zimbabwe Specific
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
      "NOOKLY ZIMBABWE - LOCAL GUIDE\n\nCOVERED CITIES:\n• Harare - CBD, Borrowdale, Avondale, Mt Pleasant\n• Bulawayo - CBD, Hillside, Suburbs\n• Mutare - CBD, Hillside\n• Gweru - CBD, Woodlands\n• Kwekwe - CBD, Amaveni\n• Masvingo - CBD, Rhodene\n\nTYPICAL RENTALS (USD per month):\n• Studio: $150 - $250\n• 1-bedroom: $200 - $350\n• 2-bedroom: $300 - $500\n• 3-bedroom: $450 - $800\n• House: $500 - $1500+\n\nPAYMENT METHODS:\n• USD recommended\n• ZWL accepted\n• EcoCash\n• OneMoney\n• Bank transfer\n\nTIPS FOR ZIMBABWE:\n• Check water availability\n• Confirm security situation\n• Ask about generator or power backup\n• Verify borehole access\n• Inquire about refuse collection\n\nEMERGENCY NUMBERS:\n• Police: 999\n• Ambulance: 994\n• Fire: 993\n\nSUPPORT:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com",
  },

  // Fallback
  {
    keywords: [],
    category: "fallback",
    response:
      "I'm here to help.\n\nYou can ask me about:\n\nPROPERTIES:\n• Finding your dream home\n• Listing your property\n• Pricing and negotiations\n• Viewing tips\n\nACCOUNT:\n• Creating a profile\n• Password help\n• Notification settings\n• Privacy and security\n\nSAFETY:\n• Avoiding scams\n• Red flags\n• Property verification\n• Safe viewings\n\nTECHNICAL:\n• App issues\n• Notifications\n• Updates\n• Troubleshooting\n\nCONTACT:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nWhat would you like to know?",
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
      "I'd love to help. Could you tell me more about what you're looking for? I can help with property listings, account help, safety tips, and everything Nookly."
    );
  }

  if (lowerMsg.match(/thank|thanks|appreciate/)) {
    return "You're welcome. Is there anything else I can help you with? I'm here 24/7 for all your property needs.";
  }

  return "I'm here to help.\n\nTell me more about:\n• Finding properties\n• Student accommodation\n• Account management\n• Safety and security\n• Technical support\n• Zimbabwe rentals\n\nOr contact our team:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288\nEmail: support@nookly.com\n\nWhat would you like to know?";
};

const ChatSupport = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Welcome to Nookly Tenant Support.\n\nI'm your AI-powered guide, trained to help tenants and students with:\n\n• Property search - Find your dream home\n• Student accommodation - Boarding and near campus\n• Account help - Profile and settings\n• Safety tips - Stay secure\n• Technical support - App help\n• Zimbabwe local - Areas and prices\n\nWhat can I help you with today?\n\nFor urgent help, contact:\nSean: +263 77 114 4469\nMichell: +263 77 600 6288",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Find properties in towns",
    "Student accommodation near campus",
    "How to contact a landlord",
    "Safety tips for tenants",
    "Account help",
    "Viewing checklist",
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
        lowerMsg.includes("find") ||
        lowerMsg.includes("search") ||
        lowerMsg.includes("looking for")
      ) {
        setSuggestions([
          "Filter by price",
          "Save favorites",
          "Contact landlord",
          "Viewing tips",
        ]);
      } else if (
        lowerMsg.includes("student") ||
        lowerMsg.includes("university")
      ) {
        setSuggestions([
          "Student areas",
          "Budget options",
          "Roommates",
          "Near campus",
        ]);
      } else if (lowerMsg.includes("safety") || lowerMsg.includes("scam")) {
        setSuggestions([
          "Red flags",
          "Verify property",
          "Report listing",
          "Safe viewing tips",
        ]);
      } else if (
        lowerMsg.includes("account") ||
        lowerMsg.includes("login") ||
        lowerMsg.includes("password")
      ) {
        setSuggestions([
          "Reset password",
          "Edit profile",
          "Notification settings",
          "Delete account",
        ]);
      } else if (
        lowerMsg.includes("harare") ||
        lowerMsg.includes("bulawayo") ||
        lowerMsg.includes("zimbabwe")
      ) {
        setSuggestions([
          "Areas in Towns",
          "Typical prices",
          "Payment methods",
          "Water and electricity",
        ]);
      } else {
        setSuggestions([
          "Find properties",
          "Student housing",
          "Safety tips",
          "Contact support",
          "Viewing checklist",
        ]);
      }
    }, thinkingTime);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const renderMessage = ({ item }: { item: Message }) => (
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
      {/* Header */}
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white text-lg font-rubik-bold">
              Nookly Assistant
            </Text>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full bg-green-400 mr-1" />
              <Text className="text-xs text-white/90">
                Tenant Support • AI-Powered
              </Text>
            </View>
          </View>
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
              placeholder="Ask me anything about Nookly..."
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
