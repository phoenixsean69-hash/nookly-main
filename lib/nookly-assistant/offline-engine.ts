import {
  getPrimaryUserMode,
  getTenantType,
} from "@/lib/userMode";

import type {
  AssistantIntent,
  AssistantPropertyCard,
  AssistantResponse,
  AssistantUserContext,
  AssistantUserSource,
  NooklyAssistantProperty,
  NooklyAssistantRequest,
  OfflineAssistantInput,
  RankedAssistantProperty,
} from "./types";

const STOP_WORDS = new Set([
  "a",
  "about",
  "all",
  "and",
  "are",
  "around",
  "best",
  "can",
  "cheap",
  "cheapest",
  "compare",
  "find",
  "for",
  "from",
  "good",
  "help",
  "home",
  "house",
  "i",
  "in",
  "is",
  "listing",
  "me",
  "my",
  "near",
  "nookly",
  "of",
  "on",
  "or",
  "place",
  "places",
  "property",
  "properties",
  "recommend",
  "show",
  "some",
  "the",
  "to",
  "under",
  "want",
  "what",
  "which",
  "with",
]);

const STUDENT_FACILITIES = [
  "wifi",
  "internet",
  "transport",
  "bus",
  "study",
  "desk",
  "security",
  "water",
  "electricity",
  "furnished",
];

const FAMILY_FACILITIES = [
  "security",
  "yard",
  "garden",
  "parking",
  "wall",
  "gate",
  "water",
  "solar",
  "school",
  "clinic",
];

const SINGLE_FACILITIES = [
  "furnished",
  "wifi",
  "internet",
  "utilities",
  "water",
  "electricity",
  "security",
  "private",
  "parking",
];

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

const asNumber = (
  value: unknown,
  fallback = 0,
): number => {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
};

const asBoolean = (
  value: unknown,
  fallback = true,
): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = asText(value).toLowerCase();

  if (normalized === "true") return true;
  if (normalized === "false") return false;

  return fallback;
};

const normalizeText = (
  value: unknown,
): string =>
  asText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueStrings = (
  values: string[],
): string[] =>
  [...new Set(
    values
      .map((value) => value.trim())
      .filter(Boolean),
  )];

const parseFacilities = (
  value: unknown,
): string[] => {
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.map(asText),
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return uniqueStrings(
      Object.values(
        value as Record<string, unknown>,
      ).map(asText),
    );
  }

  const text = asText(value);

  if (!text) return [];

  if (
    text.startsWith("[") ||
    text.startsWith("{")
  ) {
    try {
      return parseFacilities(
        JSON.parse(text) as unknown,
      );
    } catch {
      // Continue with plain-text parsing.
    }
  }

  return uniqueStrings(
    text
      .split(/[,;|]/)
      .map((item) => item.trim()),
  );
};

const getPropertyId = (
  property: NooklyAssistantProperty,
): string =>
  asText(property.$id) ||
  asText(property.id);

const getPropertyName = (
  property: NooklyAssistantProperty,
): string =>
  asText(property.propertyName) ||
  "Unnamed property";

const getPropertyLocation = (
  property: NooklyAssistantProperty,
): string =>
  asText(property.address) ||
  asText(property.city) ||
  asText(property.location) ||
  "Location not saved";

const getPropertyPrice = (
  property: NooklyAssistantProperty,
): number => {
  const standardPrice = Math.max(
    0,
    asNumber(property.price),
  );

  const dealPrice = Math.max(
    0,
    asNumber(property.new_price),
  );

  if (
    dealPrice > 0 &&
    (
      standardPrice <= 0 ||
      dealPrice < standardPrice
    )
  ) {
    return dealPrice;
  }

  return standardPrice;
};

const formatPrice = (
  price: number,
): string => {
  if (price <= 0) {
    return "Price not saved";
  }

  return `$${Math.round(price).toLocaleString(
    "en-US",
  )}/month`;
};

const getPropertySearchText = (
  property: NooklyAssistantProperty,
): string => {
  const facilities = parseFacilities(
    property.facilities,
  );

  return normalizeText(
    [
      property.propertyName,
      property.type,
      property.description,
      property.address,
      property.city,
      property.location,
      facilities.join(" "),
    ].join(" "),
  );
};

const getMeaningfulTokens = (
  value: string,
): string[] =>
  uniqueStrings(
    normalizeText(value)
      .split(" ")
      .filter(
        (token) =>
          token.length >= 3 &&
          !STOP_WORDS.has(token) &&
          !/^\d+(?:\.\d+)?$/.test(token),
      ),
  );

const extractBudget = (
  message: string,
): number | null => {
  const patterns = [
    /\b(?:under|below|less than|max|maximum|budget(?: of)?|up to)\s*(?:usd|\$)?\s*(\d+(?:\.\d+)?)/i,
    /(?:usd|\$)\s*(\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    const amount = Number(match?.[1]);

    if (
      Number.isFinite(amount) &&
      amount > 0
    ) {
      return amount;
    }
  }

  return null;
};

const extractMinimumBedrooms = (
  message: string,
): number | null => {
  const match = message.match(
    /\b(\d+)\s*(?:bed|bedroom|bedrooms)\b/i,
  );

  const bedrooms = Number(match?.[1]);

  return (
    Number.isInteger(bedrooms) &&
    bedrooms > 0
  )
    ? bedrooms
    : null;
};

const getDateNotice = (
  value: OfflineAssistantInput["dataSavedAt"],
): {
  dataAsOf: string | null;
  notice: string;
} => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return {
      dataAsOf: null,
      notice:
        "Using Nookly data currently saved on this device. Availability may have changed.",
    };
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return {
      dataAsOf: null,
      notice:
        "Using saved Nookly data. The saved time is unavailable.",
    };
  }

  const formatted = date.toLocaleString();

  return {
    dataAsOf: date.toISOString(),
    notice:
      `Using saved Nookly data from ${formatted}. Availability may have changed.`,
  };
};

export const buildAssistantUserContext = (
  user: AssistantUserSource,
): AssistantUserContext => {
  const primaryMode =
    getPrimaryUserMode(user) ?? "tenant";

  const tenantType =
    primaryMode === "tenant"
      ? getTenantType(user) ?? undefined
      : undefined;

  return {
    accountId:
      asText(user.accountId) ||
      asText(user.$id),
    name:
      asText(user.name) ||
      "Nookly user",
    primaryMode,
    tenantType,
    schoolLocation:
      tenantType === "student"
        ? asText(user.schoolLocation) ||
          undefined
        : undefined,
    organizationId:
      tenantType === "student"
        ? asText(user.organizationId) ||
          undefined
        : undefined,
  };
};

const detectIntent = (
  message: string,
  user: AssistantUserContext,
): AssistantIntent => {
  const normalized = normalizeText(message);

  if (
    /^(hi|hello|hey|hie|good morning|good afternoon|good evening)\b/.test(
      normalized,
    )
  ) {
    return "greeting";
  }

  if (
    /\b(compare|difference|versus|vs)\b/.test(
      normalized,
    )
  ) {
    return "property_comparison";
  }

  if (
    /\b(cheapest|cheap|lowest price|most affordable)\b/.test(
      normalized,
    )
  ) {
    return "cheapest_properties";
  }

  if (
    user.primaryMode === "landlord" &&
    /\b(improve|missing|wrong|description|photos|listing)\b/.test(
      normalized,
    )
  ) {
    return "listing_improvement";
  }

  if (
    user.primaryMode === "landlord" &&
    /\b(portfolio|performance|performing|views|likes|requests|occupancy|properties|property)\b/.test(
      normalized,
    )
  ) {
    return "landlord_portfolio";
  }

  if (
    /\b(find|show|search|near|under|below|bedroom|boarding|studio)\b/.test(
      normalized,
    )
  ) {
    return "property_search";
  }

  if (
    /\b(recommend|best|suitable|fit|should i choose)\b/.test(
      normalized,
    )
  ) {
    return "property_recommendation";
  }

  if (
    /\b(help|what can you do|commands|options)\b/.test(
      normalized,
    )
  ) {
    return "help";
  }

  return user.primaryMode === "landlord"
    ? "landlord_portfolio"
    : "property_recommendation";
};

const countTokenMatches = (
  haystack: string,
  tokens: string[],
): number =>
  tokens.reduce(
    (count, token) =>
      count + (
        haystack.includes(token)
          ? 1
          : 0
      ),
    0,
  );

const getMedianPrice = (
  properties: NooklyAssistantProperty[],
): number => {
  const prices = properties
    .map(getPropertyPrice)
    .filter((price) => price > 0)
    .sort((left, right) => left - right);

  if (prices.length === 0) return 0;

  const middle = Math.floor(
    prices.length / 2,
  );

  if (prices.length % 2 === 0) {
    return (
      prices[middle - 1] +
      prices[middle]
    ) / 2;
  }

  return prices[middle];
};

const scoreTenantProperty = (
  property: NooklyAssistantProperty,
  user: AssistantUserContext,
  message: string,
  medianPrice: number,
): RankedAssistantProperty => {
  const propertyId = getPropertyId(
    property,
  );

  const reasons: string[] = [];
  let score = 0;

  const price = getPropertyPrice(
    property,
  );

  const rating = Math.max(
    0,
    asNumber(property.rating),
  );

  const likes = Math.max(
    0,
    asNumber(property.likes),
  );

  const views = Math.max(
    0,
    asNumber(property.views),
  );

  const bedrooms = Math.max(
    0,
    asNumber(property.bedrooms),
  );

  const bathrooms = Math.max(
    0,
    asNumber(property.bathrooms),
  );

  const availableSlots = Math.max(
    0,
    asNumber(property.availableSlots),
  );

  const type = normalizeText(
    property.type,
  );

  const searchText =
    getPropertySearchText(property);

  const facilities = normalizeText(
    parseFacilities(
      property.facilities,
    ).join(" "),
  );

  const budget = extractBudget(message);
  const minimumBedrooms =
    extractMinimumBedrooms(message);

  const messageTokens =
    getMeaningfulTokens(message);

  if (
    asBoolean(
      property.isAvailable,
      true,
    )
  ) {
    score += 15;
    reasons.push("currently marked available");
  }

  if (rating > 0) {
    score += Math.min(25, rating * 5);
    reasons.push(
      `rated ${rating.toFixed(1)}`,
    );
  }

  score += Math.min(
    8,
    Math.log2(likes + 1) * 2,
  );

  score += Math.min(
    5,
    Math.log2(views + 1),
  );

  if (
    price > 0 &&
    medianPrice > 0 &&
    price <= medianPrice
  ) {
    score += 12;
    reasons.push(
      "priced below or near saved market median",
    );
  }

  if (budget !== null) {
    if (
      price > 0 &&
      price <= budget
    ) {
      score += 25;
      reasons.push(
        `within your $${budget} budget`,
      );
    } else if (price > budget) {
      score -= 35;
    }
  }

  if (
    minimumBedrooms !== null
  ) {
    if (
      bedrooms >= minimumBedrooms
    ) {
      score += 20;
      reasons.push(
        `has at least ${minimumBedrooms} bedrooms`,
      );
    } else {
      score -= 30;
    }
  }

  const queryMatches =
    countTokenMatches(
      searchText,
      messageTokens,
    );

  if (queryMatches > 0) {
    score += Math.min(
      20,
      queryMatches * 5,
    );
    reasons.push(
      "matches details in your question",
    );
  }

  switch (user.tenantType) {
    case "student": {
      const schoolTokens =
        getMeaningfulTokens(
          user.schoolLocation ?? "",
        );

      const schoolMatches =
        countTokenMatches(
          normalizeText(
            [
              property.address,
              property.city,
              property.location,
            ].join(" "),
          ),
          schoolTokens,
        );

      if (schoolMatches > 0) {
        score += 32;
        reasons.push(
          "address matches your institution area",
        );
      }

      if (
        /\b(boarding|hostel|student)\b/.test(
          type,
        )
      ) {
        score += 20;
        reasons.push(
          "student-oriented property type",
        );
      }

      const facilityMatches =
        STUDENT_FACILITIES.filter(
          (facility) =>
            facilities.includes(facility),
        );

      if (facilityMatches.length > 0) {
        score += Math.min(
          20,
          facilityMatches.length * 4,
        );

        reasons.push(
          `student-friendly facilities: ${facilityMatches
            .slice(0, 3)
            .join(", ")}`,
        );
      }

      if (availableSlots > 0) {
        score += 10;
        reasons.push(
          `${availableSlots} saved available slot${
            availableSlots === 1
              ? ""
              : "s"
          }`,
        );
      }

      break;
    }

    case "family": {
      if (bedrooms >= 3) {
        score += 25;
        reasons.push(
          `${bedrooms} bedrooms for family space`,
        );
      } else if (bedrooms >= 2) {
        score += 14;
        reasons.push(
          `${bedrooms} bedrooms`,
        );
      } else if (bedrooms > 0) {
        score -= 12;
      }

      if (bathrooms >= 2) {
        score += 10;
        reasons.push(
          `${bathrooms} bathrooms`,
        );
      }

      if (
        /\b(house|cottage|duplex|townhouse|apartment)\b/.test(
          type,
        )
      ) {
        score += 12;
      }

      if (
        /\b(room|boarding|hostel|studio)\b/.test(
          type,
        )
      ) {
        score -= 15;
      }

      const facilityMatches =
        FAMILY_FACILITIES.filter(
          (facility) =>
            facilities.includes(facility),
        );

      if (facilityMatches.length > 0) {
        score += Math.min(
          24,
          facilityMatches.length * 4,
        );

        reasons.push(
          `family-friendly features: ${facilityMatches
            .slice(0, 3)
            .join(", ")}`,
        );
      }

      break;
    }

    case "single": {
      if (
        /\b(studio|room|apartment|cottage|bedsitter)\b/.test(
          type,
        )
      ) {
        score += 22;
        reasons.push(
          "property type suits one person",
        );
      }

      if (
        price > 0 &&
        medianPrice > 0 &&
        price < medianPrice
      ) {
        score += 12;
        reasons.push(
          "one of the more affordable saved options",
        );
      }

      const facilityMatches =
        SINGLE_FACILITIES.filter(
          (facility) =>
            facilities.includes(facility),
        );

      if (facilityMatches.length > 0) {
        score += Math.min(
          20,
          facilityMatches.length * 4,
        );

        reasons.push(
          `useful single-tenant features: ${facilityMatches
            .slice(0, 3)
            .join(", ")}`,
        );
      }

      break;
    }

    default: {
      if (bedrooms > 0) {
        score += Math.min(
          10,
          bedrooms * 3,
        );
      }
    }
  }

  return {
    property,
    propertyId,
    score: Number(score.toFixed(2)),
    reasons: uniqueStrings(reasons).slice(
      0,
      5,
    ),
  };
};

export const rankPropertiesForUser = (
  properties: NooklyAssistantProperty[],
  user: AssistantUserContext,
  message: string,
): RankedAssistantProperty[] => {
  const availableProperties =
    properties.filter(
      (property) =>
        Boolean(getPropertyId(property)) &&
        asBoolean(
          property.isAvailable,
          true,
        ),
    );

  const medianPrice = getMedianPrice(
    availableProperties,
  );

  const budget = extractBudget(message);
  const minimumBedrooms =
    extractMinimumBedrooms(message);

  return availableProperties
    .filter((property) => {
      const price =
        getPropertyPrice(property);

      if (
        budget !== null &&
        price > 0 &&
        price > budget
      ) {
        return false;
      }

      if (
        minimumBedrooms !== null &&
        asNumber(property.bedrooms) <
          minimumBedrooms
      ) {
        return false;
      }

      return true;
    })
    .map((property) =>
      scoreTenantProperty(
        property,
        user,
        message,
        medianPrice,
      ),
    )
    .sort((left, right) => {
      const scoreDifference =
        right.score - left.score;

      if (scoreDifference !== 0) {
        return scoreDifference;
      }

      return (
        getPropertyPrice(
          left.property,
        ) -
        getPropertyPrice(
          right.property,
        )
      );
    });
};

const toPropertyCard = (
  ranked: RankedAssistantProperty,
): AssistantPropertyCard => {
  const property = ranked.property;
  const price = getPropertyPrice(
    property,
  );

  return {
    propertyId: ranked.propertyId,
    title: getPropertyName(property),
    subtitle: getPropertyLocation(
      property,
    ),
    price,
    priceLabel: formatPrice(price),
    image:
      asText(property.image1) ||
      asText(property.image2) ||
      asText(property.image3) ||
      undefined,
    score: ranked.score,
    reasons: ranked.reasons,
    route:
      `/properties/${ranked.propertyId}`,
  };
};

const getTenantSuggestions = (
  user: AssistantUserContext,
): string[] => {
  switch (user.tenantType) {
    case "student":
      return [
        "Best places near my institution",
        "Show boarding houses under $100",
        "Compare my cheapest options",
      ];

    case "family":
      return [
        "Show family homes with 3 bedrooms",
        "Which homes have security and parking?",
        "Compare the best family properties",
      ];

    case "single":
      return [
        "Show affordable studios",
        "Find private rooms under $100",
        "Compare my cheapest options",
      ];

    default:
      return [
        "Recommend properties for me",
        "Show the cheapest available places",
        "Compare the best two properties",
      ];
  }
};

const getLandlordSuggestions = (): string[] => [
  "Which listing needs attention?",
  "Why do I have views but few likes?",
  "What details are missing from my properties?",
];

const getOwnedProperties = (
  properties: NooklyAssistantProperty[],
  accountId: string,
): NooklyAssistantProperty[] => {
  if (!accountId) return [];

  return properties.filter(
    (property) =>
      asText(property.creatorId) ===
      accountId,
  );
};

const getRequestCount = (
  propertyId: string,
  requests: NooklyAssistantRequest[],
): number =>
  requests.filter(
    (request) =>
      asText(request.propertyId) ===
      propertyId,
  ).length;

const analyseLandlordProperty = (
  property: NooklyAssistantProperty,
  requests: NooklyAssistantRequest[],
): RankedAssistantProperty => {
  const propertyId =
    getPropertyId(property);

  const reasons: string[] = [];
  let attentionScore = 0;

  const views = Math.max(
    0,
    asNumber(property.views),
  );

  const likes = Math.max(
    0,
    asNumber(property.likes),
  );

  const rating = Math.max(
    0,
    asNumber(property.rating),
  );

  const requestCount = Math.max(
    asNumber(property.requests),
    getRequestCount(
      propertyId,
      requests,
    ),
  );

  const description =
    asText(property.description);

  const facilities =
    parseFacilities(
      property.facilities,
    );

  const price =
    getPropertyPrice(property);

  const hasImage = Boolean(
    asText(property.image1) ||
    asText(property.image2) ||
    asText(property.image3),
  );

  if (description.length < 80) {
    attentionScore += 18;
    reasons.push(
      "description is too short or missing",
    );
  }

  if (!hasImage) {
    attentionScore += 22;
    reasons.push(
      "no saved property image",
    );
  }

  if (facilities.length === 0) {
    attentionScore += 14;
    reasons.push(
      "facilities are not listed",
    );
  }

  if (price <= 0) {
    attentionScore += 20;
    reasons.push(
      "price is missing",
    );
  }

  if (
    views >= 20 &&
    likes / Math.max(views, 1) < 0.04
  ) {
    attentionScore += 24;
    reasons.push(
      `${views} views but only ${likes} likes`,
    );
  }

  if (
    views >= 20 &&
    requestCount === 0
  ) {
    attentionScore += 24;
    reasons.push(
      `${views} views with no saved requests`,
    );
  }

  if (
    rating > 0 &&
    rating < 3
  ) {
    attentionScore += 16;
    reasons.push(
      `low saved rating of ${rating.toFixed(1)}`,
    );
  }

  if (
    !asBoolean(
      property.isAvailable,
      true,
    )
  ) {
    attentionScore -= 8;
    reasons.push(
      "currently marked unavailable",
    );
  }

  if (reasons.length === 0) {
    reasons.push(
      "no major listing issue detected in saved data",
    );
  }

  return {
    property,
    propertyId,
    score: Number(
      attentionScore.toFixed(2),
    ),
    reasons: uniqueStrings(reasons).slice(
      0,
      5,
    ),
  };
};

const createGreetingResponse = (
  user: AssistantUserContext,
  dataAsOf: string | null,
  dataNotice: string,
): AssistantResponse => {
  const audience =
    user.primaryMode === "landlord"
      ? "landlord"
      : user.tenantType
        ? `${user.tenantType} tenant`
        : "tenant";

  return {
    mode: "offline",
    intent: "greeting",
    title: `Hello, ${user.name}`,
    message:
      `I am using your Nookly profile as a ${audience}. ` +
      "I can analyse saved Nookly properties and account data without giving generic housing answers.",
    cards: [],
    suggestions:
      user.primaryMode === "landlord"
        ? getLandlordSuggestions()
        : getTenantSuggestions(user),
    dataAsOf,
    dataNotice,
  };
};

const createHelpResponse = (
  user: AssistantUserContext,
  dataAsOf: string | null,
  dataNotice: string,
): AssistantResponse => ({
  mode: "offline",
  intent: "help",
  title: "What Nookly Assistant can do offline",
  message:
    user.primaryMode === "landlord"
      ? "I can analyse your saved listings, identify missing details and highlight properties with weak engagement. Live availability and database changes require internet."
      : "I can search, rank and compare properties already saved by Nookly. Live availability, new requests and account changes require internet.",
  cards: [],
  suggestions:
    user.primaryMode === "landlord"
      ? getLandlordSuggestions()
      : getTenantSuggestions(user),
  dataAsOf,
  dataNotice,
});

const createTenantResponse = (
  input: OfflineAssistantInput,
  user: AssistantUserContext,
  intent: AssistantIntent,
  dataAsOf: string | null,
  dataNotice: string,
): AssistantResponse => {
  const ranked = rankPropertiesForUser(
    input.properties,
    user,
    input.message,
  );

  if (ranked.length === 0) {
    return {
      mode: "offline",
      intent,
      title: "No matching saved properties",
      message:
        "I could not find a suitable match in the properties currently saved on this device. Connect to the internet to refresh Nookly's live listings.",
      cards: [],
      suggestions:
        getTenantSuggestions(user),
      dataAsOf,
      dataNotice,
    };
  }

  let selected = ranked.slice(0, 5);
  let title =
    "Best saved matches for you";
  let message =
    `I ranked ${ranked.length} saved available ` +
    `propert${ranked.length === 1 ? "y" : "ies"} ` +
    "using your Nookly tenant profile, price, property details and saved engagement.";

  if (
    intent === "cheapest_properties"
  ) {
    selected = [...ranked]
      .filter(
        (item) =>
          getPropertyPrice(
            item.property,
          ) > 0,
      )
      .sort(
        (left, right) =>
          getPropertyPrice(
            left.property,
          ) -
          getPropertyPrice(
            right.property,
          ),
      )
      .slice(0, 5);

    title = "Cheapest saved options";
    message =
      "These are the lowest-priced available properties currently saved by Nookly. I still show why each may or may not suit your tenant type.";
  }

  if (
    intent ===
    "property_comparison"
  ) {
    selected = ranked.slice(0, 2);
    title = "Property comparison";

    if (selected.length === 1) {
      message =
        "Only one matching saved property is available, so I cannot make a reliable two-property comparison yet.";
    } else {
      const first =
        selected[0].property;
      const second =
        selected[1].property;

      message =
        `${getPropertyName(first)} ranks higher than ` +
        `${getPropertyName(second)} for your current profile. ` +
        "Open both cards to compare their full details.";
    }
  }

  return {
    mode: "offline",
    intent,
    title,
    message,
    cards: selected.map(
      toPropertyCard,
    ),
    suggestions:
      getTenantSuggestions(user),
    dataAsOf,
    dataNotice,
  };
};

const createLandlordResponse = (
  input: OfflineAssistantInput,
  user: AssistantUserContext,
  intent: AssistantIntent,
  dataAsOf: string | null,
  dataNotice: string,
): AssistantResponse => {
  const ownedProperties =
    getOwnedProperties(
      input.properties,
      user.accountId,
    );

  if (ownedProperties.length === 0) {
    return {
      mode: "offline",
      intent,
      title: "No landlord portfolio saved",
      message:
        "I do not have a safely verified local copy of your landlord-owned properties. Connect to the internet so Nookly can load your portfolio before I analyse it.",
      cards: [],
      suggestions:
        getLandlordSuggestions(),
      dataAsOf,
      dataNotice,
    };
  }

  const requests =
    input.requests ?? [];

  const analysed = ownedProperties
    .map((property) =>
      analyseLandlordProperty(
        property,
        requests,
      ),
    )
    .sort(
      (left, right) =>
        right.score - left.score,
    );

  const needingAttention =
    analysed.filter(
      (item) => item.score > 0,
    );

  const selected = (
    needingAttention.length > 0
      ? needingAttention
      : analysed
  ).slice(0, 5);

  const top = selected[0];

  const title =
    intent === "listing_improvement"
      ? "Listing improvements"
      : "Landlord portfolio analysis";

  const message =
    needingAttention.length === 0
      ? `I checked ${ownedProperties.length} saved landlord propert${
          ownedProperties.length === 1
            ? "y"
            : "ies"
        } and found no major issue in the fields currently cached.`
      : `${getPropertyName(
          top.property,
        )} currently needs the most attention because ${top.reasons
          .slice(0, 2)
          .join(" and ")}.`;

  return {
    mode: "offline",
    intent,
    title,
    message,
    cards: selected.map(
      toPropertyCard,
    ),
    suggestions:
      getLandlordSuggestions(),
    dataAsOf,
    dataNotice,
  };
};

export const answerNooklyAssistantOffline = (
  input: OfflineAssistantInput,
): AssistantResponse => {
  const now = input.now ?? new Date();
  const user =
    buildAssistantUserContext(
      input.user,
    );

  const message =
    asText(input.message);

  const {
    dataAsOf,
    notice,
  } = getDateNotice(
    input.dataSavedAt,
  );

  const dataNotice =
    `${notice} Offline response generated at ${now.toLocaleTimeString()}.`;

  const intent = detectIntent(
    message,
    user,
  );

  if (intent === "greeting") {
    return createGreetingResponse(
      user,
      dataAsOf,
      dataNotice,
    );
  }

  if (intent === "help") {
    return createHelpResponse(
      user,
      dataAsOf,
      dataNotice,
    );
  }

  if (
    user.primaryMode === "landlord"
  ) {
    return createLandlordResponse(
      input,
      user,
      intent,
      dataAsOf,
      dataNotice,
    );
  }

  return createTenantResponse(
    input,
    user,
    intent,
    dataAsOf,
    dataNotice,
  );
};

export default answerNooklyAssistantOffline;