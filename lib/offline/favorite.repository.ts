import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  getOfflineDatabase,
  getOfflineMetadata,
  setOfflineMetadata,
} from "./database";
import { setCachedPropertyFavorite } from "./property.repository";

interface FavoriteRow {
  data_json: string;
}

const LEGACY_FAVORITE_KEYS = ["@rentify:favorites", "favorites"] as const;

export const upsertOfflineFavorite = async (
  userId: string,
  property: Record<string, any>,
): Promise<void> => {
  const propertyId = property.$id ?? property.id;
  if (!propertyId || typeof propertyId !== "string") {
    throw new Error("Cannot save a favorite without a property ID.");
  }

  const database = await getOfflineDatabase();
  const now = Date.now();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO offline_favorites (
        user_id,
        property_id,
        data_json,
        sync_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, 'local', ?, ?)
      ON CONFLICT(user_id, property_id) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at`,
      userId,
      propertyId,
      JSON.stringify({ ...property, cachedAt: new Date(now).toISOString() }),
      now,
      now,
    );

    await setCachedPropertyFavorite(userId, propertyId, true);
  });
};

export const removeOfflineFavorite = async (
  userId: string,
  propertyId: string,
): Promise<void> => {
  const database = await getOfflineDatabase();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `DELETE FROM offline_favorites
       WHERE user_id = ? AND property_id = ?`,
      userId,
      propertyId,
    );
    await setCachedPropertyFavorite(userId, propertyId, false);
  });
};

export const getOfflineFavorites = async <
  T extends Record<string, any>,
>(
  userId: string,
): Promise<T[]> => {
  const database = await getOfflineDatabase();
  const rows = await database.getAllAsync<FavoriteRow>(
    `SELECT data_json
     FROM offline_favorites
     WHERE user_id = ?
     ORDER BY updated_at DESC`,
    userId,
  );

  return rows.reduce<T[]>((favorites, row) => {
    try {
      favorites.push(JSON.parse(row.data_json) as T);
    } catch (error) {
      console.error("Failed to parse an offline favorite:", error);
    }
    return favorites;
  }, []);
};

export const hasOfflineFavorite = async (
  userId: string,
  propertyId: string,
): Promise<boolean> => {
  const database = await getOfflineDatabase();
  const row = await database.getFirstAsync<{ exists_flag: number }>(
    `SELECT 1 AS exists_flag
     FROM offline_favorites
     WHERE user_id = ? AND property_id = ?
     LIMIT 1`,
    userId,
    propertyId,
  );
  return row?.exists_flag === 1;
};

export const clearOfflineFavorites = async (userId: string): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "DELETE FROM offline_favorites WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      `UPDATE cached_properties
       SET is_favorite = 0, updated_at = ?
       WHERE user_id = ?`,
      Date.now(),
      userId,
    );
  });
};

export const migrateLegacyFavorites = async (
  userId: string,
): Promise<void> => {
  const migrationKey = `legacy_favorites_migrated:${userId}`;
  const alreadyMigrated = await getOfflineMetadata(migrationKey);
  if (alreadyMigrated === "true") return;

  for (const key of LEGACY_FAVORITE_KEYS) {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;

      for (const property of parsed) {
        if (property && typeof property === "object") {
          await upsertOfflineFavorite(userId, property);
        }
      }

      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error(`Failed to migrate legacy favorites from ${key}:`, error);
    }
  }

  await setOfflineMetadata(migrationKey, "true");
};
