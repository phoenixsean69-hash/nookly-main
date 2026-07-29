export type NooklyUserMode = "tenant" | "student" | "landlord";

export type OfflineActionStatus =
  | "pending"
  | "syncing"
  | "failed"
  | "completed";

export type OfflineActionType =
  | "favorite.add"
  | "favorite.remove"
  | "like.toggle"
  | "request.create"
  | "query.create"
  | "review.create"
  | "notification.read"
  | "profile.update"
  | (string & {});

export interface OfflineAction<TPayload = Record<string, unknown>> {
  id: string;
  userId: string;
  type: OfflineActionType;
  entityId?: string | null;
  dedupeKey?: string | null;
  payload: TPayload;
  status: OfflineActionStatus;
  retryCount: number;
  nextRetryAt?: number | null;
  createdAt: number;
  updatedAt: number;
  lastError?: string | null;
}

export interface EnqueueOfflineActionInput<
  TPayload = Record<string, unknown>,
> {
  id?: string;
  userId: string;
  type: OfflineActionType;
  entityId?: string | null;
  dedupeKey?: string | null;
  payload: TPayload;
}

export interface OfflineSyncSnapshot {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  isSyncing: boolean;
  pendingActions: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

export interface CachedPropertyQuery {
  userId: string;
  mode?: Extract<NooklyUserMode, "tenant" | "student">;
  schoolLocation?: string;
  propertyType?: string;
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  favoritesOnly?: boolean;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
}

export interface CachedPropertyMetadata {
  cachedAt: number;
  updatedAt: number;
  lastAccessedAt: number;
  expiresAt: number | null;
  isFavorite: boolean;
}
