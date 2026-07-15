// app/(root)/messages.tsx
import { Colors } from "@/constants/Colors";
import icons from "@/constants/icons";
import images from "@/constants/images";
import useAuthStore from "@/store/auth.store";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: Date;
  read: boolean;
}

interface Conversation {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  messages: Message[];
}

const Messages = () => {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);
  const [messageText, setMessageText] = useState("");
  const flatListRef = useRef<FlatList>(null);
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];

  useEffect(() => {
    fetchConversations();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (selectedConversation && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [selectedConversation, selectedConversation?.messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call to fetch conversations
      const mockConversations: Conversation[] = [
        {
          id: "1",
          userId: "user1",
          userName: "John Doe",
          userAvatar: images.human2,
          lastMessage: "Hey, is the property still available?",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 30),
          unreadCount: 2,
          messages: [
            {
              id: "m1",
              senderId: "user1",
              senderName: "John Doe",
              text: "Hey, is the property still available?",
              timestamp: new Date(Date.now() - 1000 * 60 * 60),
              read: false,
            },
            {
              id: "m2",
              senderId: "currentUser",
              senderName: "You",
              text: "Yes, it's still available! When would you like to view it?",
              timestamp: new Date(Date.now() - 1000 * 60 * 45),
              read: true,
            },
            {
              id: "m3",
              senderId: "user1",
              senderName: "John Doe",
              text: "Can I come tomorrow afternoon?",
              timestamp: new Date(Date.now() - 1000 * 60 * 30),
              read: false,
            },
          ],
        },
        {
          id: "2",
          userId: "user2",
          userName: "Jane Smith",
          userAvatar: images.human1,
          lastMessage: "Thanks for the info!",
          lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2),
          unreadCount: 0,
          messages: [
            {
              id: "m4",
              senderId: "user2",
              senderName: "Jane Smith",
              text: "What's the exact address?",
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
              read: true,
            },
            {
              id: "m5",
              senderId: "currentUser",
              senderName: "You",
              text: "123 Main Street, Downtown",
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2.5),
              read: true,
            },
            {
              id: "m6",
              senderId: "user2",
              senderName: "Jane Smith",
              text: "Thanks for the info!",
              timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
              read: true,
            },
          ],
        },
      ];

      setConversations(mockConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = () => {
    if (!messageText.trim() || !selectedConversation) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: "currentUser",
      senderName: "You",
      text: messageText,
      timestamp: new Date(),
      read: true,
    };

    const updatedConversation = {
      ...selectedConversation,
      messages: [...selectedConversation.messages, newMessage],
      lastMessage: messageText,
      lastMessageTime: new Date(),
    };

    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConversation.id ? updatedConversation : conv,
      ),
    );

    setSelectedConversation(updatedConversation);
    setMessageText("");
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      onPress={() => setSelectedConversation(item)}
      className="flex-row items-center px-4 py-3 border-b"
      style={{ borderBottomColor: theme.muted + "30" }}
    >
      <Image
        source={item.userAvatar || images.human1}
        className="w-12 h-12 rounded-full mr-3"
      />
      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-1">
          <Text
            className="font-rubik-bold text-base"
            style={{ color: theme.text }}
          >
            {item.userName}
          </Text>
          <Text className="text-xs" style={{ color: theme.muted }}>
            {formatTime(item.lastMessageTime)}
          </Text>
        </View>
        <View className="flex-row justify-between items-center">
          <Text
            className="text-sm flex-1 mr-2"
            style={{ color: item.unreadCount > 0 ? theme.text : theme.muted }}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View className="bg-primary-300 rounded-full min-w-[20px] h-5 px-1 items-center justify-center">
              <Text className="text-white text-xs font-rubik-bold">
                {item.unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isCurrentUser = item.senderId === "currentUser";

    return (
      <View className={`mb-3 ${isCurrentUser ? "items-end" : "items-start"}`}>
        <View
          className="max-w-[80%] rounded-2xl px-4 py-2"
          style={{
            backgroundColor: isCurrentUser ? theme.primary[300] : theme.surface,
          }}
        >
          {!isCurrentUser && (
            <Text
              className="text-xs mb-1 font-rubik-medium"
              style={{ color: theme.primary[300] }}
            >
              {item.senderName}
            </Text>
          )}
          <Text
            className="text-sm"
            style={{ color: isCurrentUser ? "#FFFFFF" : theme.text }}
          >
            {item.text}
          </Text>
          <Text
            className="text-xs mt-1"
            style={{
              color: isCurrentUser ? "rgba(255,255,255,0.7)" : theme.muted,
            }}
          >
            {formatTime(item.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={theme.primary[300]} />
          <Text className="mt-4" style={{ color: theme.muted }}>
            Loading messages...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedConversation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        {/* Chat Header */}
        <View
          className="flex-row items-center px-4 py-3 border-b"
          style={{
            borderBottomColor: theme.muted + "30",
            backgroundColor: theme.navBackground,
          }}
        >
          <TouchableOpacity
            onPress={() => setSelectedConversation(null)}
            className="mr-3"
          >
            <Image
              source={icons.backArrow}
              className="w-6 h-6"
              style={{ tintColor: theme.text }}
            />
          </TouchableOpacity>
          <Image
            source={selectedConversation.userAvatar || images.human1}
            className="w-10 h-10 rounded-full mr-3"
          />
          <View className="flex-1">
            <Text
              className="font-rubik-bold text-base"
              style={{ color: theme.text }}
            >
              {selectedConversation.userName}
            </Text>
            <Text className="text-xs" style={{ color: theme.muted }}>
              Online
            </Text>
          </View>
        </View>

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={selectedConversation.messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        />

        {/* Message Input */}
        <View
          className="flex-row items-center px-4 py-3 border-t"
          style={{
            borderTopColor: theme.muted + "30",
            backgroundColor: theme.navBackground,
          }}
        >
          <TextInput
            value={messageText}
            onChangeText={setMessageText}
            placeholder="Type a message..."
            placeholderTextColor={theme.muted}
            className="flex-1 rounded-full px-4 py-2 mr-2"
            style={{ backgroundColor: theme.surface, color: theme.text }}
            multiline
          />
          <TouchableOpacity
            onPress={sendMessage}
            disabled={!messageText.trim()}
            className={`w-10 h-10 rounded-full items-center justify-center ${
              messageText.trim() ? "bg-primary-300" : "bg-gray-300"
            }`}
          >
            <Image
              source={icons.send}
              className="w-5 h-5"
              style={{ tintColor: "#FFFFFF" }}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-5 py-4 border-b"
        style={{ borderBottomColor: theme.muted + "30" }}
      >
        <TouchableOpacity
          onPress={() => {
            router.replace(
              user?.userMode === "landlord" ? "/landHome" : "/tenantHome",
            );
          }}
          className="mr-4 p-2"
        >
          <Image
            source={icons.backArrow}
            className="w-6 h-6"
            style={{ tintColor: theme.text }}
          />
        </TouchableOpacity>
        <Text
          className="text-2xl font-rubik-bold"
          style={{ color: theme.title }}
        >
          Messages
        </Text>
      </View>

      {conversations.length === 0 ? (
        <View className="flex-1 justify-center items-center px-5">
          <Image
            source={icons.chat}
            className="w-20 h-20 opacity-30 mb-4"
            style={{ tintColor: theme.muted }}
          />
          <Text
            className="text-lg font-rubik-medium text-center"
            style={{ color: theme.text }}
          >
            No messages yet
          </Text>
          <Text
            className="text-sm text-center mt-2 px-10"
            style={{ color: theme.muted }}
          >
            When you message property owners or tenants, your conversations will
            appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversationItem}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

export default Messages;
