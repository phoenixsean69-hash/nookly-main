import { Colors } from "@/constants/Colors";
import type {
  AssistantPropertyCard,
} from "@/lib/nookly-assistant/types";
import useNooklyAssistantStore, {
  type NooklyAssistantMessage,
} from "@/store/nookly-assistant.store";
import useAuthStore from "@/store/auth.store";
import { getUserModeLabel } from "@/lib/userMode";
import { useNetInfo } from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";



const MAX_MESSAGE_LENGTH = 1000;

const formatMessageTime = (
  value: string,
): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AssistantPropertyResult = ({
  card,
  theme,
}: {
  card: AssistantPropertyCard;
  theme: (typeof Colors)["light"];
}) => {
  const openProperty = () => {
    router.push(card.route as any);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={openProperty}
      className="w-[252px] mr-3 rounded-2xl overflow-hidden"
      style={{
        backgroundColor: theme.surface,
        borderColor: `${theme.muted}24`,
        borderWidth: 1,
      }}
    >
      <View
        className="h-28 items-center justify-center"
        style={{
          backgroundColor: `${theme.primary[300]}12`,
        }}
      >
        {card.image ? (
          <Image
            source={{ uri: card.image }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center justify-center">
            <Ionicons
              name="home-outline"
              size={30}
              color={theme.primary[300]}
            />
            <Text
              className="text-xs mt-2 font-rubik-medium"
              style={{ color: theme.muted }}
            >
              Property image unavailable
            </Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text
          className="text-base font-rubik-bold"
          style={{ color: theme.title }}
          numberOfLines={1}
        >
          {card.title}
        </Text>

        <View className="flex-row items-center mt-1">
          <Ionicons
            name="location-outline"
            size={14}
            color={theme.muted}
          />
          <Text
            className="text-xs ml-1 flex-1"
            style={{ color: theme.muted }}
            numberOfLines={1}
          >
            {card.subtitle}
          </Text>
        </View>

        <Text
          className="text-base font-rubik-bold mt-3"
          style={{ color: theme.primary[300] }}
        >
          {card.priceLabel}
        </Text>

        {card.reasons.length > 0 && (
          <View className="mt-3">
            {card.reasons.slice(0, 3).map((reason) => (
              <View
                key={`${card.propertyId}-${reason}`}
                className="flex-row items-start mb-1"
              >
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={theme.primary[300]}
                />
                <Text
                  className="text-xs leading-4 ml-1 flex-1"
                  style={{ color: theme.text }}
                >
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View
          className="flex-row items-center justify-center mt-3 pt-3"
          style={{
            borderTopColor: `${theme.muted}20`,
            borderTopWidth: 1,
          }}
        >
          <Text
            className="text-sm font-rubik-medium mr-1"
            style={{ color: theme.primary[300] }}
          >
            View property
          </Text>
          <Ionicons
            name="arrow-forward"
            size={15}
            color={theme.primary[300]}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const AssistantMessageBubble = ({
  message,
  theme,
}: {
  message: NooklyAssistantMessage;
  theme: (typeof Colors)["light"];
}) => {
  const isUser = message.role === "user";
  const response = message.response;

  return (
    <View
      className={`mb-5 ${
        isUser ? "items-end" : "items-start"
      }`}
    >
      {!isUser && (
        <View className="flex-row items-center mb-2 ml-1">
          <View
            className="w-7 h-7 rounded-full items-center justify-center"
            style={{
              backgroundColor: theme.primary[300],
            }}
          >
            <Ionicons
              name="sparkles"
              size={15}
              color="#FFFFFF"
            />
          </View>

          <Text
            className="text-xs font-rubik-medium ml-2"
            style={{ color: theme.muted }}
          >
            Nookly Assistant
          </Text>
        </View>
      )}

      <View
        className="rounded-3xl px-4 py-3"
        style={{
          maxWidth: "88%",
          backgroundColor: isUser
            ? theme.primary[300]
            : theme.surface,
          borderBottomRightRadius: isUser ? 8 : 24,
          borderBottomLeftRadius: isUser ? 24 : 8,
          borderWidth: isUser ? 0 : 1,
          borderColor: `${theme.muted}20`,
        }}
      >
        {response?.title && (
          <Text
            className="text-sm font-rubik-bold mb-1"
            style={{
              color: isUser
                ? "#FFFFFF"
                : theme.title,
            }}
          >
            {response.title}
          </Text>
        )}

        <Text
          className="text-[15px] leading-6"
          style={{
            color: isUser
              ? "#FFFFFF"
              : theme.text,
          }}
        >
          {message.text}
        </Text>

        <Text
          className="text-[10px] mt-2 self-end"
          style={{
            color: isUser
              ? "rgba(255,255,255,0.72)"
              : theme.muted,
          }}
        >
          {formatMessageTime(message.createdAt)}
        </Text>
      </View>

      {!isUser &&
        response &&
        response.cards.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-3"
            contentContainerStyle={{
              paddingRight: 20,
            }}
          >
            {response.cards.map((card) => (
              <AssistantPropertyResult
                key={card.propertyId}
                card={card}
                theme={theme}
              />
            ))}
          </ScrollView>
        )}

      {!isUser && response?.dataNotice && (
        <View
          className="flex-row items-start mt-2 px-2"
          style={{ maxWidth: "92%" }}
        >
          <Ionicons
            name={
              response.mode === "online"
                ? "cloud-done-outline"
                : "cloud-offline-outline"
            }
            size={13}
            color={
              response.mode === "online"
                ? theme.primary[300]
                : theme.muted
            }
          />
          <Text
            className="text-[11px] leading-4 ml-1 flex-1"
            style={{ color: theme.muted }}
          >
            {response.dataNotice}
          </Text>
        </View>
      )}
    </View>
  );
};

export default function NooklyAssistantScreen() {
  const colorScheme = useColorScheme();
  const theme =
    Colors[colorScheme ?? "light"] as
      (typeof Colors)["light"];

  const listRef =
    useRef<FlatList<NooklyAssistantMessage>>(null);

  const [input, setInput] = useState("");

  const user = useAuthStore(
    (state) => state.user,
  );

  const {
    messages,
    suggestions,
    isHydrated,
    isLoading,
    error,
    hydrate,
    ask,
    clearConversation,
    dismissError,
  } = useNooklyAssistantStore();

  const roleLabel = useMemo(
    () => getUserModeLabel(user),
    [user],
  );

  const networkState = useNetInfo();

  const isDefinitelyOffline =
    networkState.isConnected === false ||
    networkState.isInternetReachable === false;

  const scrollToBottom = useCallback(
    (animated = true) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated,
        });
      });
    },
    [],
  );

  useEffect(() => {
    void hydrate();
  }, [
    hydrate,
    user?.accountId,
    user?.$id,
  ]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(false);
    }
  }, [
    messages.length,
    scrollToBottom,
  ]);

  const submitMessage = async (
    text = input,
  ) => {
    const normalized = text.trim();

    if (!normalized || isLoading) {
      return;
    }

    setInput("");

    await ask(normalized);
    scrollToBottom();
  };

  const confirmClear = () => {
    Alert.alert(
      "Clear conversation?",
      "This removes the locally saved Nookly Assistant conversation for the current account.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void clearConversation();
          },
        },
      ],
    );
  };

  if (!user) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center px-8"
        style={{
          backgroundColor: theme.background,
        }}
      >
        <Ionicons
          name="lock-closed-outline"
          size={42}
          color={theme.primary[300]}
        />

        <Text
          className="text-xl font-rubik-bold mt-4 text-center"
          style={{ color: theme.title }}
        >
          Sign in required
        </Text>

        <Text
          className="text-sm mt-2 text-center leading-5"
          style={{ color: theme.muted }}
        >
          Sign in so Nookly Assistant can use your tenant or landlord profile.
        </Text>

        <TouchableOpacity
          onPress={() => router.replace("/sign-in")}
          className="rounded-2xl px-8 py-4 mt-6"
          style={{
            backgroundColor: theme.primary[300],
          }}
        >
          <Text className="text-white font-rubik-bold">
            Go to sign in
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{
        backgroundColor: theme.background,
      }}
      edges={["top", "left", "right"]}
    >
      <StatusBar
        barStyle={
          colorScheme === "dark"
            ? "light-content"
            : "dark-content"
        }
        backgroundColor={theme.background}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <View
          className="px-4 py-3 flex-row items-center"
          style={{
            borderBottomColor: `${theme.muted}18`,
            borderBottomWidth: 1,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor: theme.surface,
            }}
          >
            <Ionicons
              name="chevron-back"
              size={23}
              color={theme.title}
            />
          </TouchableOpacity>

          <View className="flex-1 flex-row items-center ml-3">
            <View
              className="w-11 h-11 rounded-2xl items-center justify-center"
              style={{
                backgroundColor: theme.primary[300],
              }}
            >
              <Ionicons
                name="sparkles"
                size={22}
                color="#FFFFFF"
              />
            </View>

            <View className="ml-3 flex-1">
              <Text
                className="text-lg font-rubik-bold"
                style={{ color: theme.title }}
              >
                Nookly Assistant
              </Text>

              <View className="flex-row items-center mt-0.5">
                <View
                  className="w-2 h-2 rounded-full mr-1.5"
                  style={{
                    backgroundColor:
                      isDefinitelyOffline
                        ? theme.muted
                        : "#10B981",
                  }}
                />
                <Text
                  className="text-xs"
                  style={{ color: theme.muted }}
                >
                  {isDefinitelyOffline
                    ? "Offline saved data"
                    : "Live Nookly data"}{" "}
                  • {roleLabel}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={confirmClear}
            disabled={isLoading}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor: theme.surface,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            <Ionicons
              name="trash-outline"
              size={19}
              color={theme.danger}
            />
          </TouchableOpacity>
        </View>

        {error && (
          <Pressable
            onPress={dismissError}
            className="mx-4 mt-3 rounded-2xl px-4 py-3 flex-row items-start"
            style={{
              backgroundColor: `${theme.danger}14`,
              borderColor: `${theme.danger}35`,
              borderWidth: 1,
            }}
          >
            <Ionicons
              name="alert-circle-outline"
              size={20}
              color={theme.danger}
            />

            <Text
              className="text-sm leading-5 ml-2 flex-1"
              style={{ color: theme.danger }}
            >
              {error}
            </Text>

            <Ionicons
              name="close"
              size={18}
              color={theme.danger}
            />
          </Pressable>
        )}

        {!isHydrated ? (
          <View className="flex-1 items-center justify-center">
            <View
              className="w-16 h-16 rounded-3xl items-center justify-center"
              style={{
                backgroundColor: `${theme.primary[300]}12`,
              }}
            >
              <ActivityIndicator
                size="large"
                color={theme.primary[300]}
              />
            </View>

            <Text
              className="text-sm font-rubik-medium mt-4"
              style={{ color: theme.muted }}
            >
              Preparing your Nookly context...
            </Text>
          </View>
        ) : (
          <>
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <AssistantMessageBubble
                  message={item}
                  theme={theme}
                />
              )}
              className="flex-1"
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 20,
                paddingBottom: 16,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() =>
                scrollToBottom(false)
              }
              ListFooterComponent={
                isLoading ? (
                  <View className="items-start mb-4">
                    <View className="flex-row items-center mb-2 ml-1">
                      <View
                        className="w-7 h-7 rounded-full items-center justify-center"
                        style={{
                          backgroundColor:
                            theme.primary[300],
                        }}
                      >
                        <Ionicons
                          name="sparkles"
                          size={15}
                          color="#FFFFFF"
                        />
                      </View>

                      <Text
                        className="text-xs font-rubik-medium ml-2"
                        style={{ color: theme.muted }}
                      >
                        {isDefinitelyOffline
                          ? "Analysing saved Nookly data"
                          : "Checking live Nookly data"}
                      </Text>
                    </View>

                    <View
                      className="rounded-3xl rounded-bl-lg px-4 py-3 flex-row"
                      style={{
                        backgroundColor: theme.surface,
                        borderColor: `${theme.muted}20`,
                        borderWidth: 1,
                      }}
                    >
                      {[0, 1, 2].map((dot) => (
                        <View
                          key={dot}
                          className="w-2 h-2 rounded-full mx-1"
                          style={{
                            backgroundColor:
                              theme.primary[300],
                            opacity:
                              1 - dot * 0.22,
                          }}
                        />
                      ))}
                    </View>
                  </View>
                ) : null
              }
            />

            {suggestions.length > 0 && (
              <View
                style={{
                  borderTopColor: `${theme.muted}12`,
                  borderTopWidth: 1,
                }}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 10,
                    paddingBottom: 8,
                  }}
                >
                  {suggestions.map((suggestion) => (
                    <TouchableOpacity
                      key={suggestion}
                      activeOpacity={0.82}
                      disabled={isLoading}
                      onPress={() => {
                        void submitMessage(
                          suggestion,
                        );
                      }}
                      className="rounded-full px-4 py-2.5 mr-2"
                      style={{
                        backgroundColor:
                          `${theme.primary[300]}10`,
                        borderColor:
                          `${theme.primary[300]}35`,
                        borderWidth: 1,
                        opacity: isLoading ? 0.5 : 1,
                      }}
                    >
                      <Text
                        className="text-xs font-rubik-medium"
                        style={{
                          color: theme.primary[300],
                        }}
                      >
                        {suggestion}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View
              className="px-4 pt-2 pb-3"
              style={{
                backgroundColor: theme.background,
                borderTopColor: `${theme.muted}14`,
                borderTopWidth: 1,
              }}
            >
              <View
                className="rounded-3xl flex-row items-end px-4 py-2"
                style={{
                  backgroundColor: theme.surface,
                  borderColor: `${theme.muted}24`,
                  borderWidth: 1,
                }}
              >
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder="Ask about Nookly properties..."
                  placeholderTextColor={theme.muted}
                  multiline
                  maxLength={MAX_MESSAGE_LENGTH}
                  editable={!isLoading}
                  className="flex-1 text-[15px] leading-5 py-2 mr-2"
                  style={{
                    color: theme.text,
                    maxHeight: 110,
                    minHeight: 40,
                  }}
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={() => {
                    if (!input.includes("\n")) {
                      void submitMessage();
                    }
                  }}
                />

                <TouchableOpacity
                  activeOpacity={0.82}
                  disabled={
                    isLoading ||
                    !input.trim()
                  }
                  onPress={() => {
                    void submitMessage();
                  }}
                  className="w-11 h-11 rounded-full items-center justify-center"
                  style={{
                    backgroundColor:
                      isLoading || !input.trim()
                        ? `${theme.muted}45`
                        : theme.primary[300],
                  }}
                >
                  <Ionicons
                    name={
                      isLoading
                        ? "hourglass-outline"
                        : "arrow-up"
                    }
                    size={21}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              <Text
                className="text-[10px] text-center mt-2"
                style={{ color: theme.muted }}
              >
                {isDefinitelyOffline
                  ? "Offline mode is using locally saved Nookly data."
                  : "Online mode is using Nookly's current live property data."}
              </Text>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}