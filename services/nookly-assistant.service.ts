import NetInfo from "@react-native-community/netinfo";

import {
  getAvailableProperties,
} from "@/lib/appwrite";

import {
  answerNooklyAssistantOffline,
} from "@/lib/nookly-assistant/offline-engine";

import type {
  AssistantResponse,
  AssistantUserSource,
  NooklyAssistantProperty,
  NooklyAssistantRequest,
  OfflineAssistantInput,
} from "@/lib/nookly-assistant/types";

import {
  getPrimaryUserMode,
} from "@/lib/userMode";

import { localDB } from "@/services/localDatabase.service";
import useAuthStore from "@/store/auth.store";

export interface AssistantContext {
  user: AssistantUserSource;
  properties: NooklyAssistantProperty[];
  favoritePropertyIds: string[];
  requests: NooklyAssistantRequest[];
  dataSavedAt: string | null;
}

const MAX_MESSAGE_LENGTH = 1000;
const LIVE_PROPERTY_LIMIT = 100;

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

const requireCurrentUser = (): AssistantUserSource => {
  const user =
    useAuthStore.getState().user;

  if (!user) {
    throw new Error(
      "Sign in before using Nookly Assistant.",
    );
  }

  return user;
};

const getAccountId = (
  user: AssistantUserSource,
): string =>
  asText(user.accountId) ||
  asText(user.$id);

const validateMessage = (
  message: string,
): string => {
  const normalizedMessage =
    message.trim();

  if (!normalizedMessage) {
    throw new Error(
      "Enter a message for Nookly Assistant.",
    );
  }

  if (
    normalizedMessage.length >
    MAX_MESSAGE_LENGTH
  ) {
    throw new Error(
      "Assistant messages must be 1,000 characters or fewer.",
    );
  }

  return normalizedMessage;
};

const getPropertyId = (
  property: Record<string, unknown>,
): string =>
  asText(property.$id) ||
  asText(property.id) ||
  asText(property.propertyId);

const normalizeProperty = (
  value: unknown,
  fallbackId = "",
): NooklyAssistantProperty | null => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const record =
    value as Record<string, unknown>;

  const propertyId =
    getPropertyId(record) ||
    fallbackId.trim();

  if (!propertyId) {
    return null;
  }

  return {
    ...record,
    $id: propertyId,
  } as NooklyAssistantProperty;
};

const normalizeProperties = (
  values: unknown[],
): NooklyAssistantProperty[] => {
  const propertyMap = new Map<
    string,
    NooklyAssistantProperty
  >();

  values.forEach((value) => {
    const property =
      normalizeProperty(value);

    if (!property?.$id) {
      return;
    }

    propertyMap.set(
      property.$id,
      property,
    );
  });

  return [...propertyMap.values()];
};

const mergeSavedProperties = (
  cachedProperties: unknown[],
  favorites: unknown[],
): NooklyAssistantProperty[] => {
  const propertyMap = new Map<
    string,
    NooklyAssistantProperty
  >();

  normalizeProperties(
    cachedProperties,
  ).forEach((property) => {
    if (!property.$id) return;

    propertyMap.set(
      property.$id,
      property,
    );
  });

  favorites.forEach((value) => {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return;
    }

    const favorite =
      value as Record<string, unknown>;

    const favoriteId =
      asText(favorite.propertyId) ||
      getPropertyId(favorite);

    if (!favoriteId) {
      return;
    }

    const favoriteProperty =
      normalizeProperty(
        favorite,
        favoriteId,
      );

    if (!favoriteProperty) {
      return;
    }

    const existing =
      propertyMap.get(favoriteId);

    propertyMap.set(
      favoriteId,
      {
        ...favoriteProperty,
        ...existing,
        $id: favoriteId,
      },
    );
  });

  return [...propertyMap.values()];
};

const getFavoritePropertyIds = (
  favorites: unknown[],
): string[] => [
  ...new Set(
    favorites
      .map((value) => {
        if (
          !value ||
          typeof value !== "object" ||
          Array.isArray(value)
        ) {
          return "";
        }

        const favorite =
          value as Record<string, unknown>;

        return (
          asText(favorite.propertyId) ||
          getPropertyId(favorite)
        );
      })
      .filter(Boolean),
  ),
];

const normalizeRequests = (
  values: unknown[],
): NooklyAssistantRequest[] =>
  values
    .filter(
      (
        value,
      ): value is Record<string, unknown> =>
        Boolean(
          value &&
          typeof value === "object" &&
          !Array.isArray(value),
        ),
    )
    .map(
      (value) =>
        value as NooklyAssistantRequest,
    );

const parseDate = (
  value: unknown,
): Date | null => {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
};

const findLatestSavedAt = (
  properties: NooklyAssistantProperty[],
): string | null => {
  const dates = properties
    .flatMap((property) => [
      parseDate(property.cachedAt),
      parseDate(property.$updatedAt),
      parseDate(property.$createdAt),
    ])
    .filter(
      (date): date is Date =>
        date !== null,
    )
    .sort(
      (left, right) =>
        right.getTime() -
        left.getTime(),
    );

  return dates[0]?.toISOString() ?? null;
};

const isDeviceDefinitelyOffline =
  async (): Promise<boolean> => {
    try {
      const network =
        await NetInfo.fetch();

      return (
        network.isConnected === false ||
        network.isInternetReachable === false
      );
    } catch (error) {
      console.warn(
        "Could not read Nookly network state:",
        error,
      );

      // An unknown network state must not be
      // incorrectly classified as offline.
      return false;
    }
  };

const replaceSavedLanguage = (
  value: string,
): string =>
  value
    .replace(
      /\bsaved properties\b/gi,
      "live properties",
    )
    .replace(
      /\bsaved available\b/gi,
      "live available",
    )
    .replace(
      /\bsaved options\b/gi,
      "live options",
    )
    .replace(
      /\bsaved listings\b/gi,
      "live listings",
    )
    .replace(
      /\bsaved engagement\b/gi,
      "current engagement",
    )
    .replace(
      /\bsaved market median\b/gi,
      "current listing median",
    )
    .replace(
      /\bsaved data\b/gi,
      "live data",
    );

const createOnlineResponse = (
  response: AssistantResponse,
  user: AssistantUserSource,
): AssistantResponse => {
  const fetchedAt =
    new Date();

  const primaryMode =
    getPrimaryUserMode(user);

  if (
    response.title ===
    "No matching saved properties"
  ) {
    return {
      ...response,
      mode: "online",
      title:
        "No matching live properties",
      message:
        "I checked Nookly's live listings, but none matched your current question and profile. Try changing the location, budget, property type or bedroom requirement.",
      dataAsOf:
        fetchedAt.toISOString(),
      dataNotice:
        `Using live Nookly listings fetched at ${fetchedAt.toLocaleString()}.`,
    };
  }

  if (
    response.intent === "greeting"
  ) {
    return {
      ...response,
      mode: "online",
      title: response.title,
      message:
        primaryMode === "landlord"
          ? "I am connected to Nookly's live property data. I can analyse your current listings, engagement and property details. If your device goes offline, I automatically use data saved on this device."
          : "I am connected to Nookly's live property listings and using your tenant profile to search, rank and compare current options. If your device goes offline, I automatically use data saved on this device.",
      dataAsOf:
        fetchedAt.toISOString(),
      dataNotice:
        `Using live Nookly listings fetched at ${fetchedAt.toLocaleString()}.`,
    };
  }

  if (
    response.intent === "help"
  ) {
    return {
      ...response,
      mode: "online",
      title:
        "What Nookly Assistant can do online",
      message:
        primaryMode === "landlord"
          ? "I can analyse your current Nookly listings, identify missing details and highlight properties with weak engagement. Offline mode is used only when this device has no internet connection."
          : "I can search, rank and compare Nookly's current live listings using your tenant type, budget, location and property requirements. Offline mode is used only when this device has no internet connection.",
      dataAsOf:
        fetchedAt.toISOString(),
      dataNotice:
        `Using live Nookly listings fetched at ${fetchedAt.toLocaleString()}.`,
    };
  }

  return {
    ...response,
    mode: "online",
    title:
      replaceSavedLanguage(
        response.title,
      ),
    message:
      replaceSavedLanguage(
        response.message,
      ),
    dataAsOf:
      fetchedAt.toISOString(),
    dataNotice:
      `Using live Nookly property data fetched at ${fetchedAt.toLocaleString()}. Favorite and request history may include information saved on this device.`,
  };
};

class NooklyAssistantService {
  async buildOfflineContext():
    Promise<AssistantContext> {
    const user =
      requireCurrentUser();

    const accountId =
      getAccountId(user);

    const [
      cachedProperties,
      favorites,
      savedRequests,
    ] = await Promise.all([
      localDB.getCachedProperties(),
      localDB.getFavorites(),
      localDB.getUserApplications(
        accountId,
      ),
    ]);

    const properties =
      mergeSavedProperties(
        cachedProperties,
        favorites,
      );

    return {
      user,
      properties,
      favoritePropertyIds:
        getFavoritePropertyIds(
          favorites,
        ),
      requests:
        normalizeRequests(
          savedRequests,
        ),
      dataSavedAt:
        findLatestSavedAt(
          properties,
        ),
    };
  }

  async buildOnlineContext():
    Promise<AssistantContext> {
    const user =
      requireCurrentUser();

    const accountId =
      getAccountId(user);

    const primaryMode =
      getPrimaryUserMode(user);

    const [
      liveResult,
      favorites,
      savedRequests,
    ] = await Promise.all([
      getAvailableProperties({
        filter: "",
        query: "",
        limit:
          LIVE_PROPERTY_LIMIT,
        ...(primaryMode === "landlord"
          ? {
              creatorId:
                accountId,
            }
          : {}),
      }),
      localDB.getFavorites(),
      localDB.getUserApplications(
        accountId,
      ),
    ]);

    const liveValues =
      Array.isArray(liveResult)
        ? liveResult
        : [];

    return {
      user,
      properties:
        normalizeProperties(
          liveValues,
        ),
      favoritePropertyIds:
        getFavoritePropertyIds(
          favorites,
        ),
      requests:
        normalizeRequests(
          savedRequests,
        ),
      dataSavedAt:
        new Date().toISOString(),
    };
  }

  async askOffline(
    message: string,
  ): Promise<AssistantResponse> {
    const normalizedMessage =
      validateMessage(message);

    const context =
      await this.buildOfflineContext();

    const input: OfflineAssistantInput = {
      message: normalizedMessage,
      user: context.user,
      properties:
        context.properties,
      favoritePropertyIds:
        context.favoritePropertyIds,
      requests:
        context.requests,
      dataSavedAt:
        context.dataSavedAt,
    };

    return answerNooklyAssistantOffline(
      input,
    );
  }

  async askOnline(
    message: string,
  ): Promise<AssistantResponse> {
    const normalizedMessage =
      validateMessage(message);

    let context: AssistantContext;

    try {
      context =
        await this.buildOnlineContext();
    } catch (error) {
      console.error(
        "Could not load live Nookly Assistant data:",
        error,
      );

      throw new Error(
        "Your device is online, but Nookly could not load the live property data. Please try again.",
      );
    }

    const input: OfflineAssistantInput = {
      message: normalizedMessage,
      user: context.user,
      properties:
        context.properties,
      favoritePropertyIds:
        context.favoritePropertyIds,
      requests:
        context.requests,
      dataSavedAt:
        context.dataSavedAt,
    };

    const response =
      answerNooklyAssistantOffline(
        input,
      );

    return createOnlineResponse(
      response,
      context.user,
    );
  }

  async ask(
    message: string,
  ): Promise<AssistantResponse> {
    const normalizedMessage =
      validateMessage(message);

    const offline =
      await isDeviceDefinitelyOffline();

    if (offline) {
      return this.askOffline(
        normalizedMessage,
      );
    }

    return this.askOnline(
      normalizedMessage,
    );
  }

  async getWelcomeResponse():
    Promise<AssistantResponse> {
    return this.ask("Hello");
  }
}

export const nooklyAssistantService =
  new NooklyAssistantService();

export default nooklyAssistantService;