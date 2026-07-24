import { getOfflineDatabase } from "./database";
import type {
  CachedPropertyMetadata,
  CachedPropertyQuery,
  NooklyUserMode,
} from "./types";

interface CachedPropertyRow {
  property_id: string;
  data_json: string;
  is_favorite: number;
  cached_at: number;
  updated_at: number;
  last_accessed_at: number;
  expires_at: number | null;
}

export interface CachePropertyInput {
  userId: string;
  mode: Extract<NooklyUserMode, "tenant" | "student">;
  schoolLocation?: string;
  property: Record<string, any>;
  ttlMs?: number | null;
  isFavorite?: boolean;
}

export type OfflineCachedProperty<T extends Record<string, any>> = T & {
  __offline: CachedPropertyMetadata;
};

const DEFAULT_PROPERTY_TTL = 7 * 24 * 60 * 60 * 1000;

const normalizeText = (value?: string | null) =>
  value?.trim().toLowerCase() ?? "";

const toBooleanInteger = (value: unknown): number | null => {
  if (typeof value !== "boolean") return null;
  return value ? 1 : 0;
};

const getPropertyId = (property: Record<string, any>): string => {
  const id = property.$id ?? property.id;
  if (!id || typeof id !== "string") {
    throw new Error("Cannot cache a property without a valid $id or id.");
  }
  return id;
};

const parseProperty = <T extends Record<string, any>>(
  row: CachedPropertyRow,
): OfflineCachedProperty<T> | null => {
  try {
    const property = JSON.parse(row.data_json) as T;
    return {
      ...property,
      __offline: {
        cachedAt: row.cached_at,
        updatedAt: row.updated_at,
        lastAccessedAt: row.last_accessed_at,
        expiresAt: row.expires_at,
        isFavorite: row.is_favorite === 1,
      },
    };
  } catch (error) {
    console.error("Failed to parse cached property:", error);
    return null;
  }
};

const writeProperty = async (
  input: CachePropertyInput,
  now: number,
): Promise<void> => {
  const database = await getOfflineDatabase();
  const propertyId = getPropertyId(input.property);
  const ttl = input.ttlMs === undefined ? DEFAULT_PROPERTY_TTL : input.ttlMs;
  const expiresAt = ttl === null ? null : now + Math.max(0, ttl);

  await database.runAsync(
    `INSERT INTO cached_properties (
      user_id,
      property_id,
      mode,
      school_location,
      property_name,
      property_type,
      address,
      price,
      bedrooms,
      is_available,
      is_favorite,
      data_json,
      cached_at,
      updated_at,
      last_accessed_at,
      expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, property_id) DO UPDATE SET
      mode = excluded.mode,
      school_location = excluded.school_location,
      property_name = excluded.property_name,
      property_type = excluded.property_type,
      address = excluded.address,
      price = excluded.price,
      bedrooms = excluded.bedrooms,
      is_available = excluded.is_available,
      is_favorite = CASE
        WHEN cached_properties.is_favorite = 1 THEN 1
        ELSE excluded.is_favorite
      END,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at,
      last_accessed_at = excluded.last_accessed_at,
      expires_at = excluded.expires_at`,
    input.userId,
    propertyId,
    input.mode,
    normalizeText(input.schoolLocation),
    input.property.propertyName ?? input.property.name ?? null,
    input.property.type ?? null,
    input.property.address ?? null,
    typeof input.property.price === "number" ? input.property.price : null,
    typeof input.property.bedrooms === "number"
      ? input.property.bedrooms
      : null,
    toBooleanInteger(input.property.isAvailable),
    input.isFavorite ? 1 : 0,
    JSON.stringify(input.property),
    now,
    now,
    now,
    expiresAt,
  );
};

export const cacheProperty = async (
  input: CachePropertyInput,
): Promise<void> => {
  await writeProperty(input, Date.now());
};

export const cacheProperties = async (
  inputs: CachePropertyInput[],
): Promise<void> => {
  if (inputs.length === 0) return;

  const database = await getOfflineDatabase();
  const now = Date.now();
  await database.withTransactionAsync(async () => {
    for (const input of inputs) {
      await writeProperty(input, now);
    }
  });
};

export const getCachedProperty = async <T extends Record<string, any>>(
  userId: string,
  propertyId: string,
  includeExpired = true,
): Promise<OfflineCachedProperty<T> | null> => {
  const database = await getOfflineDatabase();
  const now = Date.now();
  const row = await database.getFirstAsync<CachedPropertyRow>(
    `SELECT property_id, data_json, is_favorite, cached_at, updated_at,
            last_accessed_at, expires_at
     FROM cached_properties
     WHERE user_id = ?
       AND property_id = ?
       AND (? = 1 OR expires_at IS NULL OR expires_at > ?)
     LIMIT 1`,
    userId,
    propertyId,
    includeExpired ? 1 : 0,
    now,
  );

  if (!row) return null;

  await database.runAsync(
    `UPDATE cached_properties
     SET last_accessed_at = ?
     WHERE user_id = ? AND property_id = ?`,
    now,
    userId,
    propertyId,
  );

  return parseProperty<T>({ ...row, last_accessed_at: now });
};

export const getCachedProperties = async <T extends Record<string, any>>(
  query: CachedPropertyQuery,
): Promise<Array<OfflineCachedProperty<T>>> => {
  const database = await getOfflineDatabase();
  const clauses = ["user_id = ?"];
  const parameters: Array<string | number> = [query.userId];

  if (query.mode) {
    clauses.push("mode = ?");
    parameters.push(query.mode);
  }
  if (query.schoolLocation) {
    clauses.push("school_location = ?");
    parameters.push(normalizeText(query.schoolLocation));
  }
  if (query.propertyType) {
    clauses.push("LOWER(property_type) = ?");
    parameters.push(normalizeText(query.propertyType));
  }
  if (query.query?.trim()) {
    clauses.push("(LOWER(property_name) LIKE ? OR LOWER(address) LIKE ?)");
    const pattern = `%${normalizeText(query.query)}%`;
    parameters.push(pattern, pattern);
  }
  if (typeof query.minPrice === "number") {
    clauses.push("price >= ?");
    parameters.push(query.minPrice);
  }
  if (typeof query.maxPrice === "number") {
    clauses.push("price <= ?");
    parameters.push(query.maxPrice);
  }
  if (typeof query.minBedrooms === "number") {
    clauses.push("bedrooms >= ?");
    parameters.push(query.minBedrooms);
  }
  if (query.favoritesOnly) {
    clauses.push("is_favorite = 1");
  }
  if (!query.includeExpired) {
    clauses.push("(expires_at IS NULL OR expires_at > ?)");
    parameters.push(Date.now());
  }

  const limit = Math.max(1, Math.min(query.limit ?? 100, 500));
  const offset = Math.max(0, query.offset ?? 0);
  parameters.push(limit, offset);

  const rows = await database.getAllAsync<CachedPropertyRow>(
    `SELECT property_id, data_json, is_favorite, cached_at, updated_at,
            last_accessed_at, expires_at
     FROM cached_properties
     WHERE ${clauses.join(" AND ")}
     ORDER BY is_favorite DESC, last_accessed_at DESC
     LIMIT ? OFFSET ?`,
    parameters,
  );

  return rows
    .map((row) => parseProperty<T>(row))
    .filter(
      (property): property is OfflineCachedProperty<T> => property !== null,
    );
};

export const setCachedPropertyFavorite = async (
  userId: string,
  propertyId: string,
  isFavorite: boolean,
): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.runAsync(
    `UPDATE cached_properties
     SET is_favorite = ?, updated_at = ?
     WHERE user_id = ? AND property_id = ?`,
    isFavorite ? 1 : 0,
    Date.now(),
    userId,
    propertyId,
  );
};

export const removeExpiredCachedProperties = async (): Promise<number> => {
  const database = await getOfflineDatabase();
  const result = await database.runAsync(
    `DELETE FROM cached_properties
     WHERE expires_at IS NOT NULL
       AND expires_at <= ?
       AND is_favorite = 0`,
    Date.now(),
  );
  return result.changes;
};
