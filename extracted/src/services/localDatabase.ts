/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * IndexedDB Local-First Database Engine + LocalStorage Backup Mirror.
 * Provides full offline persistence for all accounting collections,
 * active session continuity, and a durable synchronization outbox queue.
 */

import { AppUser } from '../types/accounting';
import { AppState } from '../utils/storage';
import {
  compressForLocalStorage,
  decompressFromLocalStorage,
} from '../utils/compression';
import {
  enqueueOutboxMutation,
  SyncMutationInput,
  SyncOutboxItem,
} from './syncLogic';

const DB_NAME = 'almamo_local_db';
const DB_VERSION = 1;

const STORE_SNAPSHOTS = 'app_snapshots';
const STORE_OUTBOX = 'sync_outbox';
const STORE_RECORDS = 'collection_records';

const LS_OUTBOX_KEY = 'almamo_sync_outbox_v1';
const LS_META_KEY = 'almamo_sync_meta_v1';
const LS_SESSION_KEY = 'almamo_offline_session_v1';

export interface SyncMeta {
  lastSyncedAt: number | null;
  lastSyncError: string | null;
  lastSyncedCount: number;
}

export interface CachedSession {
  user: AppUser | null;
  mode: 'google' | 'offline';
  savedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openLocalDB(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'compositeKey' });
        }
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, {
            keyPath: 'compositeKey',
          });
          store.createIndex('by_collection', 'collectionName', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = () => {
        console.warn('IndexedDB open failed, using localStorage mirror:', request.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('IndexedDB initialization exception:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbGet<T = any>(storeName: string, key: string): Promise<T | null> {
  const db = await openLocalDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(storeName: string, value: any): Promise<void> {
  const db = await openLocalDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(value);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbGetAll<T = any>(storeName: string): Promise<T[]> {
  const db = await openLocalDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as T[]) || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbReplaceAll(storeName: string, items: any[]): Promise<void> {
  const db = await openLocalDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Synchronous read of queued outbox from localStorage mirror
 */
export function getOutboxSync(): SyncOutboxItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = decompressFromLocalStorage<SyncOutboxItem[]>(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOutboxToMirror(items: SyncOutboxItem[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_OUTBOX_KEY, compressForLocalStorage(items));
  } catch (err) {
    console.warn('Outbox localStorage mirror error:', err);
  }
}

export async function getOutbox(): Promise<SyncOutboxItem[]> {
  const mirror = getOutboxSync();
  const idbItems = await idbGetAll<SyncOutboxItem>(STORE_OUTBOX);
  if (idbItems.length === 0) return mirror;
  if (mirror.length === 0) {
    saveOutboxToMirror(idbItems);
    return idbItems.sort((a, b) => a.timestamp - b.timestamp);
  }
  // Merge both taking newer timestamp per compositeKey
  const map = new Map<string, SyncOutboxItem>();
  for (const item of idbItems) map.set(item.compositeKey, item);
  for (const item of mirror) {
    const existing = map.get(item.compositeKey);
    if (!existing || item.timestamp >= existing.timestamp) {
      map.set(item.compositeKey, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export async function replaceOutbox(items: SyncOutboxItem[]): Promise<void> {
  const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
  saveOutboxToMirror(sorted);
  await idbReplaceAll(STORE_OUTBOX, sorted);
}

export async function enqueueLocalMutation(
  mutation: SyncMutationInput
): Promise<SyncOutboxItem[]> {
  const current = await getOutbox();
  const next = enqueueOutboxMutation(current, mutation);
  await replaceOutbox(next);
  return next;
}

/**
 * Persist entire AppState into IndexedDB snapshot + per-collection IndexedDB records
 */
export async function saveStateToLocalDB(state: AppState): Promise<void> {
  const cleanState: AppState = {
    ...state,
    currentUser: null, // Session stored separately in active_session
  };

  await idbPut(STORE_SNAPSHOTS, {
    key: 'main_state',
    payload: cleanState,
    updatedAt: Date.now(),
  });

  // Also index individual collection records inside IndexedDB
  const db = await openLocalDB();
  if (!db) return;

  const collections: Array<[string, any[]]> = [
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
    ['login_attempts', state.loginAttempts || []],
    ['users', state.users || []],
  ];

  try {
    const tx = db.transaction(STORE_RECORDS, 'readwrite');
    const store = tx.objectStore(STORE_RECORDS);
    store.clear();
    store.put({
      compositeKey: 'store_settings::main',
      collectionName: 'store_settings',
      docId: 'main',
      data: state.settings,
      updatedAt: Date.now(),
    });
    for (const [colName, docs] of collections) {
      for (const d of docs) {
        if (d && d.id) {
          store.put({
            compositeKey: `${colName}::${d.id}`,
            collectionName: colName,
            docId: d.id,
            data: d,
            updatedAt: Date.now(),
          });
        }
      }
    }
  } catch (err) {
    console.warn('IndexedDB records indexing note:', err);
  }
}

export async function loadStateFromLocalDB(): Promise<AppState | null> {
  const record = await idbGet<{ key: string; payload: AppState }>(
    STORE_SNAPSHOTS,
    'main_state'
  );
  return record?.payload || null;
}

/**
 * Session persistence so users remain authenticated across reloads even when offline
 */
export function loadCachedSessionSync(): CachedSession {
  if (typeof localStorage === 'undefined') {
    return { user: null, mode: 'google', savedAt: 0 };
  }
  try {
    const raw = localStorage.getItem(LS_SESSION_KEY);
    if (!raw) return { user: null, mode: 'google', savedAt: 0 };
    const parsed = decompressFromLocalStorage<CachedSession>(raw);
    if (parsed && parsed.user) {
      return parsed;
    }
  } catch {}
  return { user: null, mode: 'google', savedAt: 0 };
}

export async function saveCachedSession(
  user: AppUser | null,
  mode: 'google' | 'offline' = 'google'
): Promise<void> {
  const payload: CachedSession = {
    user,
    mode,
    savedAt: Date.now(),
  };

  if (typeof localStorage !== 'undefined') {
    try {
      if (user) {
        localStorage.setItem(LS_SESSION_KEY, compressForLocalStorage(payload));
      } else {
        localStorage.removeItem(LS_SESSION_KEY);
      }
    } catch {}
  }

  await idbPut(STORE_SNAPSHOTS, {
    key: 'active_session',
    payload,
  });
}

export async function loadCachedSession(): Promise<CachedSession> {
  const syncSession = loadCachedSessionSync();
  if (syncSession.user) return syncSession;
  const idbRecord = await idbGet<{ key: string; payload: CachedSession }>(
    STORE_SNAPSHOTS,
    'active_session'
  );
  return idbRecord?.payload || { user: null, mode: 'google', savedAt: 0 };
}

/**
 * Sync Metadata (last synced timestamp, error status)
 */
export function getSyncMetaSync(): SyncMeta {
  if (typeof localStorage === 'undefined') {
    return { lastSyncedAt: null, lastSyncError: null, lastSyncedCount: 0 };
  }
  try {
    const raw = localStorage.getItem(LS_META_KEY);
    if (!raw) return { lastSyncedAt: null, lastSyncError: null, lastSyncedCount: 0 };
    return JSON.parse(raw) as SyncMeta;
  } catch {
    return { lastSyncedAt: null, lastSyncError: null, lastSyncedCount: 0 };
  }
}

export async function saveSyncMeta(partial: Partial<SyncMeta>): Promise<SyncMeta> {
  const prev = getSyncMetaSync();
  const next: SyncMeta = {
    ...prev,
    ...partial,
  };
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LS_META_KEY, JSON.stringify(next));
    } catch {}
  }
  await idbPut(STORE_SNAPSHOTS, {
    key: 'sync_meta',
    payload: next,
  });
  return next;
}

/**
 * Security Camera Snapshots (captured on password / PIN entry)
 * Stored locally in IndexedDB so large base64 images never bloat Firestore documents.
 */
export interface SecuritySnapshotRecord {
  id: string;
  imageDataUrl: string;
  createdAt: number;
  userName: string;
  entryMethod: 'lock_screen' | 'password_login' | 'pin_confirm' | 'google_auth';
  status: 'success' | 'failed' | 'cancelled' | 'blocked';
}

const SECURITY_PHOTO_INDEX_KEY = 'security_photo_index';
const SECURITY_PHOTO_PREFIX = 'security_photo:';
const MAX_LOCAL_SECURITY_SNAPSHOTS = 60;

export async function saveSecuritySnapshot(record: SecuritySnapshotRecord): Promise<void> {
  if (!record.id || !record.imageDataUrl) return;

  await idbPut(STORE_SNAPSHOTS, {
    key: `${SECURITY_PHOTO_PREFIX}${record.id}`,
    payload: record,
  });

  // Update index & prune oldest entries beyond cap
  try {
    const existingIndexRec = await idbGet<{ key: string; payload: string[] }>(
      STORE_SNAPSHOTS,
      SECURITY_PHOTO_INDEX_KEY
    );
    const prevIds = Array.isArray(existingIndexRec?.payload)
      ? existingIndexRec!.payload
      : [];
    const nextIds = [record.id, ...prevIds.filter((id) => id !== record.id)].slice(
      0,
      MAX_LOCAL_SECURITY_SNAPSHOTS
    );
    await idbPut(STORE_SNAPSHOTS, {
      key: SECURITY_PHOTO_INDEX_KEY,
      payload: nextIds,
    });
  } catch {}
}

export async function getSecuritySnapshot(
  snapshotId: string
): Promise<SecuritySnapshotRecord | null> {
  if (!snapshotId) return null;
  const rec = await idbGet<{ key: string; payload: SecuritySnapshotRecord }>(
    STORE_SNAPSHOTS,
    `${SECURITY_PHOTO_PREFIX}${snapshotId}`
  );
  return rec?.payload || null;
}

export async function getAllSecuritySnapshots(): Promise<Record<string, SecuritySnapshotRecord>> {
  const all = await idbGetAll<{ key: string; payload: any }>(STORE_SNAPSHOTS);
  const map: Record<string, SecuritySnapshotRecord> = {};
  for (const entry of all) {
    if (entry?.key?.startsWith(SECURITY_PHOTO_PREFIX) && entry.payload?.id) {
      map[entry.payload.id] = entry.payload as SecuritySnapshotRecord;
    }
  }
  return map;
}

export async function clearAllSecuritySnapshots(): Promise<void> {
  const db = await openLocalDB();
  if (!db) return;
  const all = await idbGetAll<{ key: string }>(STORE_SNAPSHOTS);
  const toDelete = all
    .map((e) => e.key)
    .filter((k) => k.startsWith(SECURITY_PHOTO_PREFIX) || k === SECURITY_PHOTO_INDEX_KEY);
  if (toDelete.length === 0) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      for (const k of toDelete) {
        store.delete(k);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

