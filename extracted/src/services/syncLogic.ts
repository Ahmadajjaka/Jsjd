/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure, decoupled local-first synchronization and conflict-resolution logic.
 * Handles outbox mutation coalescing, snapshot merging with dirty protection,
 * and ordered cloud queue flushing.
 */

export type SyncOperationType = 'upsert' | 'delete';

export interface SyncOutboxItem {
  compositeKey: string;
  collectionName: string;
  docId: string;
  op: SyncOperationType;
  data?: any;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface SyncMutationInput {
  collectionName: string;
  docId: string;
  op: SyncOperationType;
  data?: any;
  timestamp?: number;
}

export interface OutboxExecutor {
  upsert: (collectionName: string, docId: string, data: any) => Promise<void>;
  remove: (collectionName: string, docId: string) => Promise<void>;
}

export interface OutboxProcessResult {
  remaining: SyncOutboxItem[];
  syncedCount: number;
  failedCount: number;
  lastError?: string;
}

export function buildCompositeKey(collectionName: string, docId: string): string {
  return `${collectionName}::${docId}`;
}

/**
 * Enqueues a local database mutation into the outbox while deduplicating
 * previous mutations on the same (collectionName, docId).
 */
export function enqueueOutboxMutation(
  queue: SyncOutboxItem[],
  mutation: SyncMutationInput
): SyncOutboxItem[] {
  const compositeKey = buildCompositeKey(mutation.collectionName, mutation.docId);
  const filtered = queue.filter((item) => item.compositeKey !== compositeKey);

  const nextItem: SyncOutboxItem = {
    compositeKey,
    collectionName: mutation.collectionName,
    docId: mutation.docId,
    op: mutation.op,
    data: mutation.op === 'upsert' ? mutation.data : undefined,
    timestamp: mutation.timestamp ?? Date.now(),
    retryCount: 0,
  };

  return [...filtered, nextItem].sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Removes specific keys from the outbox once confirmed synced.
 */
export function removeOutboxKeys(
  queue: SyncOutboxItem[],
  syncedKeys: Set<string>
): SyncOutboxItem[] {
  if (syncedKeys.size === 0) return queue;
  return queue.filter((item) => !syncedKeys.has(item.compositeKey));
}

/**
 * Merges a collection received from Firestore with local state while protecting
 * any documents that have un-synced local mutations in the outbox.
 */
export function mergeRemoteCollectionWithPending<T extends { id: string }>(
  localItems: T[],
  remoteItems: T[],
  pendingOutbox: SyncOutboxItem[],
  collectionName: string,
  sortFn?: (a: T, b: T) => number
): T[] {
  const pendingForCol = pendingOutbox.filter(
    (item) => item.collectionName === collectionName
  );

  if (pendingForCol.length === 0) {
    const copy = [...remoteItems];
    return sortFn ? copy.sort(sortFn) : copy;
  }

  const pendingDeletes = new Set<string>();
  const pendingUpserts = new Map<string, T>();

  for (const item of pendingForCol) {
    if (item.op === 'delete') {
      pendingDeletes.add(item.docId);
      pendingUpserts.delete(item.docId);
    } else if (item.op === 'upsert') {
      pendingDeletes.delete(item.docId);
      if (item.data) {
        pendingUpserts.set(item.docId, item.data as T);
      } else {
        const localMatch = localItems.find((x) => x.id === item.docId);
        if (localMatch) {
          pendingUpserts.set(item.docId, localMatch);
        }
      }
    }
  }

  const mergedMap = new Map<string, T>();

  // 1. Add remote items unless locally deleted
  for (const remoteItem of remoteItems) {
    if (pendingDeletes.has(remoteItem.id)) continue;
    mergedMap.set(remoteItem.id, remoteItem);
  }

  // 2. Overlay local pending upserts (protects offline edits/creations)
  for (const [docId, localData] of pendingUpserts.entries()) {
    mergedMap.set(docId, localData);
  }

  const result = Array.from(mergedMap.values());
  return sortFn ? result.sort(sortFn) : result;
}

/**
 * Protects locally modified store settings until synced.
 */
export function mergeRemoteSettingsWithPending<T>(
  localSettings: T,
  remoteSettings: T,
  pendingOutbox: SyncOutboxItem[]
): T {
  const key = buildCompositeKey('store_settings', 'main');
  const hasPending = pendingOutbox.some((item) => item.compositeKey === key);
  return hasPending ? localSettings : remoteSettings;
}

/**
 * Processes pending outbox items sequentially against the cloud executor.
 * Stops early if a network/offline failure occurs so order is preserved.
 */
export async function processOutboxQueue(
  queue: SyncOutboxItem[],
  executor: OutboxExecutor
): Promise<OutboxProcessResult> {
  if (queue.length === 0) {
    return { remaining: [], syncedCount: 0, failedCount: 0 };
  }

  const sorted = [...queue].sort((a, b) => a.timestamp - b.timestamp);
  const remaining: SyncOutboxItem[] = [];
  let syncedCount = 0;
  let failedCount = 0;
  let lastError: string | undefined;
  let networkHalted = false;

  for (let i = 0; i < sorted.length; i++) {
    const item = sorted[i];

    if (networkHalted) {
      remaining.push(item);
      continue;
    }

    try {
      if (item.op === 'upsert') {
        await executor.upsert(item.collectionName, item.docId, item.data);
      } else {
        await executor.remove(item.collectionName, item.docId);
      }
      syncedCount++;
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : String(err);
      failedCount++;
      lastError = msg;

      remaining.push({
        ...item,
        retryCount: (item.retryCount || 0) + 1,
        lastError: msg,
      });

      // Halt further writes on connectivity or auth error to preserve causal order
      const lower = msg.toLowerCase();
      if (
        lower.includes('offline') ||
        lower.includes('network') ||
        lower.includes('unavailable') ||
        lower.includes('failed-precondition') ||
        lower.includes('permission') ||
        lower.includes('unauthenticated') ||
        lower.includes('auth')
      ) {
        networkHalted = true;
      }
    }
  }

  return {
    remaining,
    syncedCount,
    failedCount,
    lastError,
  };
}
