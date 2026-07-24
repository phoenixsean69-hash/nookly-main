import { getOfflineDatabase } from "./database";
import type {
  EnqueueOfflineActionInput,
  OfflineAction,
  OfflineActionStatus,
} from "./types";

interface PendingActionRow {
  id: string;
  user_id: string;
  action_type: string;
  entity_id: string | null;
  dedupe_key: string | null;
  payload_json: string;
  status: OfflineActionStatus;
  retry_count: number;
  next_retry_at: number | null;
  created_at: number;
  updated_at: number;
  last_error: string | null;
}

const createActionId = () =>
  `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const parseAction = <TPayload = Record<string, unknown>>(
  row: PendingActionRow,
): OfflineAction<TPayload> => ({
  id: row.id,
  userId: row.user_id,
  type: row.action_type,
  entityId: row.entity_id,
  dedupeKey: row.dedupe_key,
  payload: JSON.parse(row.payload_json) as TPayload,
  status: row.status,
  retryCount: row.retry_count,
  nextRetryAt: row.next_retry_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastError: row.last_error,
});

export const enqueueOfflineAction = async <
  TPayload = Record<string, unknown>,
>(
  input: EnqueueOfflineActionInput<TPayload>,
): Promise<OfflineAction<TPayload>> => {
  const database = await getOfflineDatabase();
  const now = Date.now();
  const id = input.id ?? createActionId();
  const dedupeKey = input.dedupeKey ?? null;

  await database.withTransactionAsync(async () => {
    if (dedupeKey) {
      await database.runAsync(
        `DELETE FROM pending_actions
         WHERE user_id = ?
           AND dedupe_key = ?
           AND status IN ('pending', 'failed')`,
        input.userId,
        dedupeKey,
      );
    }

    await database.runAsync(
      `INSERT INTO pending_actions (
        id,
        user_id,
        action_type,
        entity_id,
        dedupe_key,
        payload_json,
        status,
        retry_count,
        next_retry_at,
        created_at,
        updated_at,
        last_error
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, NULL, ?, ?, NULL)`,
      id,
      input.userId,
      input.type,
      input.entityId ?? null,
      dedupeKey,
      JSON.stringify(input.payload),
      now,
      now,
    );
  });

  return {
    id,
    userId: input.userId,
    type: input.type,
    entityId: input.entityId ?? null,
    dedupeKey,
    payload: input.payload,
    status: "pending",
    retryCount: 0,
    nextRetryAt: null,
    createdAt: now,
    updatedAt: now,
    lastError: null,
  };
};

export const getReadyOfflineActions = async (
  limit = 50,
): Promise<OfflineAction[]> => {
  const database = await getOfflineDatabase();
  const now = Date.now();
  const rows = await database.getAllAsync<PendingActionRow>(
    `SELECT * FROM pending_actions
     WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?`,
    now,
    Math.max(1, Math.min(limit, 200)),
  );

  return rows.map((row) => parseAction(row));
};

export const markOfflineActionSyncing = async (id: string): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.runAsync(
    `UPDATE pending_actions
     SET status = 'syncing', updated_at = ?, last_error = NULL
     WHERE id = ?`,
    Date.now(),
    id,
  );
};

export const completeOfflineAction = async (id: string): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.runAsync("DELETE FROM pending_actions WHERE id = ?", id);
};

export const failOfflineAction = async (
  action: OfflineAction,
  error: unknown,
): Promise<void> => {
  const database = await getOfflineDatabase();
  const retryCount = action.retryCount + 1;
  const baseDelay = 5_000;
  const maxDelay = 6 * 60 * 60 * 1000;
  const retryDelay = Math.min(baseDelay * 2 ** (retryCount - 1), maxDelay);
  const message =
    error instanceof Error ? error.message : "Unknown synchronization error";

  await database.runAsync(
    `UPDATE pending_actions
     SET status = 'failed',
         retry_count = ?,
         next_retry_at = ?,
         updated_at = ?,
         last_error = ?
     WHERE id = ?`,
    retryCount,
    Date.now() + retryDelay,
    Date.now(),
    message.slice(0, 500),
    action.id,
  );
};

export const countPendingOfflineActions = async (
  userId?: string,
): Promise<number> => {
  const database = await getOfflineDatabase();
  const row = userId
    ? await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM pending_actions
         WHERE user_id = ? AND status != 'completed'`,
        userId,
      )
    : await database.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count
         FROM pending_actions
         WHERE status != 'completed'`,
      );

  return row?.count ?? 0;
};

export const deletePendingAction = async (id: string): Promise<void> => {
  const database = await getOfflineDatabase();
  await database.runAsync("DELETE FROM pending_actions WHERE id = ?", id);
};
