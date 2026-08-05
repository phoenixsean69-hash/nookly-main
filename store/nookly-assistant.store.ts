import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import type {
  AssistantResponse,
} from "@/lib/nookly-assistant/types";

import nooklyAssistantService from "@/services/nookly-assistant.service";
import useAuthStore from "@/store/auth.store";

const STORAGE_PREFIX =
  "@nookly:assistant-conversation:v1";

const MAX_MESSAGES = 80;

export type AssistantMessageRole =
  | "user"
  | "assistant";

export interface NooklyAssistantMessage {
  id: string;
  role: AssistantMessageRole;
  text: string;
  createdAt: string;
  response?: AssistantResponse;
}

interface StoredConversation {
  accountId: string;
  messages: NooklyAssistantMessage[];
  savedAt: string;
}

interface NooklyAssistantState {
  activeAccountId: string | null;
  messages: NooklyAssistantMessage[];
  suggestions: string[];
  isHydrated: boolean;
  isLoading: boolean;
  error: string | null;

  hydrate: () => Promise<void>;

  ask: (
    message: string,
  ) => Promise<AssistantResponse | null>;

  clearConversation: () => Promise<void>;

  dismissError: () => void;
}

const asText = (
  value: unknown,
): string => {
  if (typeof value === "string") {
    return value.trim();
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return "";
};

const getCurrentAccountId = (): string => {
  const user =
    useAuthStore.getState().user;

  return (
    asText(user?.accountId) ||
    asText(user?.$id)
  );
};

const getStorageKey = (
  accountId: string,
): string =>
  `${STORAGE_PREFIX}:${accountId}`;

const createMessageId = (
  role: AssistantMessageRole,
): string => {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 10);

  return [
    "assistant",
    role,
    Date.now().toString(36),
    random,
  ].join("_");
};

const isAssistantResponse = (
  value: unknown,
): value is AssistantResponse => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Partial<AssistantResponse>;

  return (
    typeof candidate.mode === "string" &&
    typeof candidate.intent === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.message === "string" &&
    Array.isArray(candidate.cards) &&
    Array.isArray(candidate.suggestions)
  );
};

const isStoredMessage = (
  value: unknown,
): value is NooklyAssistantMessage => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const candidate =
    value as Partial<NooklyAssistantMessage>;

  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    (
      candidate.role !== "user" &&
      candidate.role !== "assistant"
    ) ||
    typeof candidate.text !== "string" ||
    typeof candidate.createdAt !== "string"
  ) {
    return false;
  }

  if (
    candidate.response !== undefined &&
    !isAssistantResponse(
      candidate.response,
    )
  ) {
    return false;
  }

  return true;
};

const readConversation = async (
  accountId: string,
): Promise<NooklyAssistantMessage[]> => {
  try {
    const raw = await AsyncStorage.getItem(
      getStorageKey(accountId),
    );

    if (!raw) return [];

    const parsed =
      JSON.parse(raw) as Partial<StoredConversation>;

    if (
      parsed.accountId !== accountId ||
      !Array.isArray(parsed.messages)
    ) {
      return [];
    }

    return parsed.messages
      .filter(isStoredMessage)
      .slice(-MAX_MESSAGES);
  } catch (error) {
    console.warn(
      "Could not restore Nookly Assistant conversation:",
      error,
    );

    return [];
  }
};

const writeConversation = async (
  accountId: string,
  messages: NooklyAssistantMessage[],
): Promise<void> => {
  const trimmedMessages =
    messages.slice(-MAX_MESSAGES);

  const conversation: StoredConversation = {
    accountId,
    messages: trimmedMessages,
    savedAt: new Date().toISOString(),
  };

  try {
    await AsyncStorage.setItem(
      getStorageKey(accountId),
      JSON.stringify(conversation),
    );
  } catch (error) {
    console.warn(
      "Could not save Nookly Assistant conversation:",
      error,
    );
  }
};

const createAssistantMessage = (
  response: AssistantResponse,
): NooklyAssistantMessage => ({
  id: createMessageId("assistant"),
  role: "assistant",
  text: response.message,
  createdAt: new Date().toISOString(),
  response,
});

const createUserMessage = (
  text: string,
): NooklyAssistantMessage => ({
  id: createMessageId("user"),
  role: "user",
  text,
  createdAt: new Date().toISOString(),
});

const getSuggestionsFromMessages = (
  messages: NooklyAssistantMessage[],
): string[] => {
  for (
    let index = messages.length - 1;
    index >= 0;
    index -= 1
  ) {
    const suggestions =
      messages[index]?.response?.suggestions;

    if (
      Array.isArray(suggestions) &&
      suggestions.length > 0
    ) {
      return suggestions;
    }
  }

  return [];
};

const useNooklyAssistantStore =
  create<NooklyAssistantState>(
    (set, get) => ({
      activeAccountId: null,
      messages: [],
      suggestions: [],
      isHydrated: false,
      isLoading: false,
      error: null,

      hydrate: async () => {
        const accountId =
          getCurrentAccountId();

        if (!accountId) {
          set({
            activeAccountId: null,
            messages: [],
            suggestions: [],
            isHydrated: true,
            isLoading: false,
            error: null,
          });

          return;
        }

        if (
          get().isHydrated &&
          get().activeAccountId === accountId
        ) {
          return;
        }

        set({
          isLoading: true,
          error: null,
        });

        try {
          const storedMessages =
            await readConversation(
              accountId,
            );

          if (storedMessages.length > 0) {
            set({
              activeAccountId: accountId,
              messages: storedMessages,
              suggestions:
                getSuggestionsFromMessages(
                  storedMessages,
                ),
              isHydrated: true,
              isLoading: false,
              error: null,
            });

            return;
          }

          const welcomeResponse =
            await nooklyAssistantService
              .getWelcomeResponse();

          const welcomeMessage =
            createAssistantMessage(
              welcomeResponse,
            );

          const initialMessages = [
            welcomeMessage,
          ];

          await writeConversation(
            accountId,
            initialMessages,
          );

          set({
            activeAccountId: accountId,
            messages: initialMessages,
            suggestions:
              welcomeResponse.suggestions,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not open Nookly Assistant.";

          set({
            activeAccountId: accountId,
            isHydrated: true,
            isLoading: false,
            error: message,
          });
        }
      },

      ask: async (
        message: string,
      ) => {
        const normalizedMessage =
          message.trim();

        if (!normalizedMessage) {
          set({
            error:
              "Enter a message for Nookly Assistant.",
          });

          return null;
        }

        if (get().isLoading) {
          return null;
        }

        const accountId =
          getCurrentAccountId();

        if (!accountId) {
          set({
            error:
              "Sign in before using Nookly Assistant.",
          });

          return null;
        }

        if (
          get().activeAccountId !== accountId
        ) {
          set({
            activeAccountId: accountId,
            messages: [],
            suggestions: [],
            isHydrated: false,
          });

          await get().hydrate();
        }

        const userMessage =
          createUserMessage(
            normalizedMessage,
          );

        const messagesWithUser = [
          ...get().messages,
          userMessage,
        ].slice(-MAX_MESSAGES);

        set({
          messages: messagesWithUser,
          isLoading: true,
          error: null,
        });

        await writeConversation(
          accountId,
          messagesWithUser,
        );

        try {
          const response =
            await nooklyAssistantService
              .ask(
                normalizedMessage,
              );

          const assistantMessage =
            createAssistantMessage(
              response,
            );

          const completedMessages = [
            ...messagesWithUser,
            assistantMessage,
          ].slice(-MAX_MESSAGES);

          await writeConversation(
            accountId,
            completedMessages,
          );

          set({
            messages: completedMessages,
            suggestions:
              response.suggestions,
            isLoading: false,
            error: null,
          });

          return response;
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Nookly Assistant could not answer that request.";

          set({
            isLoading: false,
            error: errorMessage,
          });

          return null;
        }
      },

      clearConversation: async () => {
        const accountId =
          getCurrentAccountId();

        set({
          messages: [],
          suggestions: [],
          error: null,
          isLoading: true,
        });

        if (!accountId) {
          set({
            activeAccountId: null,
            isHydrated: true,
            isLoading: false,
          });

          return;
        }

        try {
          await AsyncStorage.removeItem(
            getStorageKey(accountId),
          );

          const welcomeResponse =
            await nooklyAssistantService
              .getWelcomeResponse();

          const welcomeMessage =
            createAssistantMessage(
              welcomeResponse,
            );

          const initialMessages = [
            welcomeMessage,
          ];

          await writeConversation(
            accountId,
            initialMessages,
          );

          set({
            activeAccountId: accountId,
            messages: initialMessages,
            suggestions:
              welcomeResponse.suggestions,
            isHydrated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Could not clear the assistant conversation.";

          set({
            isLoading: false,
            error: message,
          });
        }
      },

      dismissError: () => {
        set({
          error: null,
        });
      },
    }),
  );

export default useNooklyAssistantStore;