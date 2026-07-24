import * as SQLite from "expo-sqlite";

const DATABASE_NAME = "nookly-offline.db";
const DATABASE_VERSION = 1;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION_1 = `
  CREATE TABLE IF NOT EXISTS offline_metadata (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cached_properties (
    user_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    school_location TEXT NOT NULL DEFAULT '',
    property_name TEXT,
    property_type TEXT,
    address TEXT,
    price REAL,
    bedrooms INTEGER,
    is_available INTEGER,
    is_favorite INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL,
    cached_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    expires_at INTEGER,
    PRIMARY KEY (user_id, property_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cached_properties_user_mode
    ON cached_properties(user_id, mode, school_location);

  CREATE INDEX IF NOT EXISTS idx_cached_properties_filters
    ON cached_properties(user_id, property_type, price, bedrooms);

  CREATE INDEX IF NOT EXISTS idx_cached_properties_accessed
    ON cached_properties(user_id, last_accessed_at DESC);

  CREATE TABLE IF NOT EXISTS offline_favorites (
    user_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    data_json TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'local',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, property_id)
  );

  CREATE INDEX IF NOT EXISTS idx_offline_favorites_user
    ON offline_favorites(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS cached_requests (
    user_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    property_id TEXT,
    status TEXT,
    data_json TEXT NOT NULL,
    cached_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, request_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cached_requests_user
    ON cached_requests(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS cached_notifications (
    user_id TEXT NOT NULL,
    notification_id TEXT NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    data_json TEXT NOT NULL,
    cached_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, notification_id)
  );

  CREATE INDEX IF NOT EXISTS idx_cached_notifications_user
    ON cached_notifications(user_id, is_read, updated_at DESC);

  CREATE TABLE IF NOT EXISTS pending_actions (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    action_type TEXT NOT NULL,
    entity_id TEXT,
    dedupe_key TEXT,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    retry_count INTEGER NOT NULL DEFAULT 0,
    next_retry_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_error TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_pending_actions_ready
    ON pending_actions(status, next_retry_at, created_at);

  CREATE INDEX IF NOT EXISTS idx_pending_actions_user
    ON pending_actions(user_id, created_at);

  CREATE INDEX IF NOT EXISTS idx_pending_actions_dedupe
    ON pending_actions(user_id, dedupe_key);

  CREATE TABLE IF NOT EXISTS sync_metadata (
    user_id TEXT NOT NULL,
    resource TEXT NOT NULL,
    last_synced_at INTEGER,
    cursor TEXT,
    metadata_json TEXT,
    PRIMARY KEY (user_id, resource)
  );
`;

const migrateDatabase = async (database: SQLite.SQLiteDatabase) => {
  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  let currentVersion = versionRow?.user_version ?? 0;

  if (currentVersion < 1) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(SCHEMA_VERSION_1);
      await database.execAsync("PRAGMA user_version = 1");
    });
    currentVersion = 1;
  }

  if (currentVersion !== DATABASE_VERSION) {
    throw new Error(
      `Unsupported Nookly offline database version ${currentVersion}. Expected ${DATABASE_VERSION}.`,
    );
  }

  // A process can terminate while an action is marked as syncing. Recover it.
  await database.runAsync(
    `UPDATE pending_actions
     SET status = 'pending', updated_at = ?
     WHERE status = 'syncing'`,
    Date.now(),
  );
};

export const getOfflineDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = (async () => {
      const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await database.execAsync("PRAGMA journal_mode = WAL");
      await database.execAsync("PRAGMA foreign_keys = ON");
      await database.execAsync("PRAGMA busy_timeout = 5000");
      await migrateDatabase(database);
      return database;
    })().catch((error) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
};

export const initializeOfflineDatabase = async (): Promise<void> => {
  await getOfflineDatabase();
};

export const setOfflineMetadata = async (
  key: string,
  value: string | null,
): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.runAsync(
    `INSERT INTO offline_metadata (key, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at = excluded.updated_at`,
    key,
    value,
    Date.now(),
  );
};

export const getOfflineMetadata = async (
  key: string,
): Promise<string | null> => {
  const database = await getOfflineDatabase();
  const row = await database.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM offline_metadata WHERE key = ?",
    key,
  );
  return row?.value ?? null;
};

export const clearOfflineDataForUser = async (
  userId: string,
): Promise<void> => {
  const database = await getOfflineDatabase();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      "DELETE FROM cached_properties WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      "DELETE FROM offline_favorites WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      "DELETE FROM cached_requests WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      "DELETE FROM cached_notifications WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      "DELETE FROM pending_actions WHERE user_id = ?",
      userId,
    );
    await database.runAsync(
      "DELETE FROM sync_metadata WHERE user_id = ?",
      userId,
    );
  });
};
