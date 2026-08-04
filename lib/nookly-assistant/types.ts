import type {
  ModeAwareUser,
  PrimaryUserMode,
  TenantType,
} from "@/lib/userMode";

export type AssistantOperatingMode =
  | "offline"
  | "online"
  | "cached";

export type AssistantIntent =
  | "greeting"
  | "help"
  | "property_recommendation"
  | "property_search"
  | "property_comparison"
  | "cheapest_properties"
  | "landlord_portfolio"
  | "listing_improvement"
  | "unknown";

export interface AssistantUserSource
  extends ModeAwareUser {
  $id?: string;
  accountId?: string;
  name?: string;
  email?: string;
  schoolLocation?: string;
  organizationId?: string;
}

export interface AssistantUserContext {
  accountId: string;
  name: string;
  primaryMode: PrimaryUserMode;
  tenantType?: TenantType;
  schoolLocation?: string;
  organizationId?: string;
}

export interface NooklyAssistantProperty
  extends Record<string, unknown> {
  $id?: string;
  id?: string;
  propertyName?: string;
  type?: string;
  description?: string;
  address?: string;
  city?: string;
  location?: string;
  creatorId?: string;
  creatorName?: string;
  price?: number | string;
  new_price?: number | string;
  bedrooms?: number | string;
  bathrooms?: number | string;
  area?: number | string;
  rating?: number | string;
  likes?: number | string;
  views?: number | string;
  requests?: number | string;
  totalSlots?: number | string;
  availableSlots?: number | string;
  facilities?: unknown;
  reviews?: unknown;
  image1?: string;
  image2?: string;
  image3?: string;
  isAvailable?: boolean | string;
  $createdAt?: string;
  $updatedAt?: string;
}

export interface NooklyAssistantRequest
  extends Record<string, unknown> {
  $id?: string;
  propertyId?: string;
  tenantId?: string;
  landlordId?: string;
  status?: string;
  $createdAt?: string;
}

export interface AssistantPropertyCard {
  propertyId: string;
  title: string;
  subtitle: string;
  price: number;
  priceLabel: string;
  image?: string;
  score: number;
  reasons: string[];
  route: string;
}

export interface AssistantResponse {
  mode: AssistantOperatingMode;
  intent: AssistantIntent;
  title: string;
  message: string;
  cards: AssistantPropertyCard[];
  suggestions: string[];
  dataAsOf: string | null;
  dataNotice: string;
}

export interface OfflineAssistantInput {
  message: string;
  user: AssistantUserSource;
  properties: NooklyAssistantProperty[];
  favoritePropertyIds?: string[];
  requests?: NooklyAssistantRequest[];
  dataSavedAt?: string | number | Date | null;
  now?: Date;
}

export interface RankedAssistantProperty {
  property: NooklyAssistantProperty;
  propertyId: string;
  score: number;
  reasons: string[];
}