/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Automatic Offline-First Cloud Synchronization Engine.
 * Queues all local mutations in IndexedDB and automatically flushes them
 * to Cloud Firestore as soon as internet connectivity & auth are active.
 */

import {
  getOutbox,
  getOutboxSync,
  getSyncMetaSync,
  enqueueLocalMutation,
  replaceOutbox,
  saveSyncMeta,
} from './localDatabase';
import { processOutboxQueue } from './syncLogic';
import {
  isFirebaseAuthActive,
  pushDocToFirestoreStrict,
  removeDocFromFirestoreStrict,
} from './firebaseSync';
import { AppState } from '../utils/storage';

export type SyncStateKind =
  | 'synced'
  | 'offline'
  | 'syncing'
  | 'pending'
  | 'needs_auth'
  | 'error';

export interface SyncStatusSnapshot {
  isOnline: boolean;
  isFirebaseAuthenticated: boolean;
  pendingCount: number;
  status: SyncStateKind;
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  isSyncing: boolean;
}

type SyncListener = (snapshot: SyncStatusSnapshot) => void;

const listeners = new Set<SyncListener>();
let isCurrentlySyncing = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function checkIsOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

export function getSyncStatusSnapshot(
  overridePendingCount?: number
): SyncStatusSnapshot {
  const isOnline = checkIsOnline();
  const isAuth = isFirebaseAuthActive();
  const pendingCount =
    overridePendingCount !== undefined
      ? overridePendingCount
      : getOutboxSync().length;
  const meta = getSyncMetaSync();

  let status: SyncStateKind = 'synced';
  if (!isOnline) {
    status = 'offline';
  } else if (isCurrentlySyncing) {
    status = 'syncing';
  } else if (pendingCount > 0 && !isAuth) {
    status = 'needs_auth';
  } else if (pendingCount > 0) {
    status = meta.lastSyncError ? 'error' : 'pending';
  } else if (meta.lastSyncError && !isAuth) {
    status = 'needs_auth';
  }

  return {
    isOnline,
    isFirebaseAuthenticated: isAuth,
    pendingCount,
    status,
    lastSyncedAt: meta.lastSyncedAt,
    lastSyncError: meta.lastSyncError,
    isSyncing: isCurrentlySyncing,
  };
}

function notifyListeners(overridePendingCount?: number): void {
  const snap = getSyncStatusSnapshot(overridePendingCount);
  listeners.forEach((cb) => {
    try {
      cb(snap);
    } catch {}
  });
}

export function subscribeToSyncStatus(listener: SyncListener): () => void {
  ensureSyncEngineInitialized();
  listeners.add(listener);
  listener(getSyncStatusSnapshot());
  return () => {
    listeners.delete(listener);
  };
}

export function ensureSyncEngineInitialized(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('online', () => {
    notifyListeners();
    // Auto-flush queued offline operations as soon as internet reconnects
    scheduleFlush(250);
  });

  window.addEventListener('offline', () => {
    notifyListeners();
  });
}

function scheduleFlush(delayMs: number = 150): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushOutboxToCloud().catch(() => {});
  }, delayMs);
}

/**
 * Enqueues an upsert into the local IndexedDB outbox and attempts immediate sync if online.
 */
export async function queueAndSyncUpsert(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  ensureSyncEngineInitialized();
  const nextOutbox = await enqueueLocalMutation({
    collectionName,
    docId,
    op: 'upsert',
    data,
    timestamp: Date.now(),
  });
  notifyListeners(nextOutbox.length);

  if (checkIsOnline() && isFirebaseAuthActive()) {
    scheduleFlush(80);
  }
}

/**
 * Enqueues a delete into the local IndexedDB outbox and attempts immediate sync if online.
 */
export async function queueAndSyncDelete(
  collectionName: string,
  docId: string
): Promise<void> {
  ensureSyncEngineInitialized();
  const nextOutbox = await enqueueLocalMutation({
    collectionName,
    docId,
    op: 'delete',
    timestamp: Date.now(),
  });
  notifyListeners(nextOutbox.length);

  if (checkIsOnline() && isFirebaseAuthActive()) {
    scheduleFlush(80);
  }
}

/**
 * Flushes all pending local IndexedDB mutations to Cloud Firestore in chronological order.
 */
export async function flushOutboxToCloud(): Promise<{
  syncedCount: number;
  remainingCount: number;
  error?: string;
}> {
  ensureSyncEngineInitialized();

  if (isCurrentlySyncing) {
    const cur = getOutboxSync();
    return { syncedCount: 0, remainingCount: cur.length };
  }

  const queue = await getOutbox();
  if (queue.length === 0) {
    await saveSyncMeta({ lastSyncError: null });
    notifyListeners(0);
    return { syncedCount: 0, remainingCount: 0 };
  }

  if (!checkIsOnline()) {
    notifyListeners(queue.length);
    return {
      syncedCount: 0,
      remainingCount: queue.length,
      error: 'الجهاز غير متصل بالإنترنت حالياً. تم حفظ العمليات محلياً وستُرفع تلقائياً عند توفر الاتصال.',
    };
  }

  if (!isFirebaseAuthActive()) {
    notifyListeners(queue.length);
    return {
      syncedCount: 0,
      remainingCount: queue.length,
      error: 'يرجى تسجيل الدخول بحساب Google لإتمام مزامنة العمليات المحلية مع السحابة.',
    };
  }

  isCurrentlySyncing = true;
  notifyListeners(queue.length);

  try {
    const result = await processOutboxQueue(queue, {
      upsert: pushDocToFirestoreStrict,
      remove: removeDocFromFirestoreStrict,
    });

    await replaceOutbox(result.remaining);

    await saveSyncMeta({
      lastSyncedAt: result.syncedCount > 0 ? Date.now() : getSyncMetaSync().lastSyncedAt,
      lastSyncError: result.lastError || null,
      lastSyncedCount: result.syncedCount,
    });

    isCurrentlySyncing = false;
    notifyListeners(result.remaining.length);

    return {
      syncedCount: result.syncedCount,
      remainingCount: result.remaining.length,
      error: result.lastError,
    };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    await saveSyncMeta({ lastSyncError: msg });
    isCurrentlySyncing = false;
    const cur = await getOutbox();
    notifyListeners(cur.length);
    return {
      syncedCount: 0,
      remainingCount: cur.length,
      error: msg,
    };
  }
}

/**
 * Enqueues a full local state snapshot (e.g., after restoring a JSON backup offline)
 * so every record is synced cleanly to Firestore.
 */
export async function queueFullStateSync(state: AppState): Promise<void> {
  await queueAndSyncUpsert('store_settings', 'main', state.settings);

  const collectionMap: Array<[string, Array<{ id: string }>]> = [
    ['products', state.products || []],
    ['customers', state.customers || []],
    ['suppliers', state.suppliers || []],
    ['sales', state.sales || []],
    ['purchases', state.purchases || []],
    ['expenses', state.expenses || []],
    ['cash_transactions', state.cashTransactions || []],
    ['customer_payments', state.customerPayments || []],
    ['supplier_payments', state.supplierPayments || []],
    ['inventory_adjustments', state.inventoryAdjustments || []],
    ['audit_logs', state.auditLogs || []],
  ];

  for (const [colName, docs] of collectionMap) {
    for (const item of docs) {
      if (item && item.id) {
        await enqueueLocalMutation({
          collectionName: colName,
          docId: item.id,
          op: 'upsert',
          data: item,
          timestamp: Date.now(),
        });
      }
    }
  }

  const outbox = await getOutbox();
  notifyListeners(outbox.length);

  if (checkIsOnline() && isFirebaseAuthActive()) {
    scheduleFlush(100);
  }
}
