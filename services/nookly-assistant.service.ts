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

import { localDB } from "@/services/localDatabase.service";
import useAuthStore from "@/store/auth.store";

export interface OfflineAssistantContext {
  user: AssistantUserSource;
  properties: NooklyAssistantProperty[];
  favoritePropertyIds: string[];
  requests: NooklyAssistantRequest[];
  dataSavedAt: string | null;
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

  const record = value as Record<string, unknown>;

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

const mergeSavedProperties = (
  cachedProperties: unknown[],
  favorites: unknown[],
): NooklyAssistantProperty[] => {
  const propertyMap = new Map<
    string,
    NooklyAssistantProperty
  >();

  cachedProperties.forEach((value) => {
    const property = normalizeProperty(value);

    if (!property?.$id) return;

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

    if (!favoriteId) return;

    const favoriteProperty =
      normalizeProperty(
        favorite,
        favoriteId,
      );

    if (!favoriteProperty) return;

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
      (value): value is Record<string, unknown> =>
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
        right.getTime() - left.getTime(),
    );

  return dates[0]?.toISOString() ?? null;
};

class NooklyAssistantService {
  async buildOfflineContext():
    Promise<OfflineAssistantContext> {
    const user =
      useAuthStore.getState().user;

    if (!user) {
      throw new Error(
        "Sign in before using Nookly Assistant.",
      );
    }

    const accountId =
      user.accountId || user.$id;

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

  async askOffline(
    message: string,
  ): Promise<AssistantResponse> {
    const normalizedMessage =
      message.trim();

    if (!normalizedMessage) {
      throw new Error(
        "Enter a message for Nookly Assistant.",
      );
    }

    if (
      normalizedMessage.length > 1000
    ) {
      throw new Error(
        "Assistant messages must be 1,000 characters or fewer.",
      );
    }

    const context =
      await this.buildOfflineContext();

    const input: OfflineAssistantInput = {
      message: normalizedMessage,
      user: context.user,
      properties: context.properties,
      favoritePropertyIds:
        context.favoritePropertyIds,
      requests: context.requests,
      dataSavedAt:
        context.dataSavedAt,
    };

    return answerNooklyAssistantOffline(
      input,
    );
  }

  async getWelcomeResponse():
    Promise<AssistantResponse> {
    return this.askOffline("Hello");
  }
}

export const nooklyAssistantService =
  new NooklyAssistantService();

export default nooklyAssistantService;