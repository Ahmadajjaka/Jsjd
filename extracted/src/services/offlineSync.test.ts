import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCompositeKey,
  enqueueOutboxMutation,
  mergeRemoteCollectionWithPending,
  mergeRemoteSettingsWithPending,
  processOutboxQueue,
  SyncOutboxItem,
} from './syncLogic';

test('enqueueOutboxMutation deduplicates repeated updates to the same document', () => {
  let queue: SyncOutboxItem[] = [];
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'products',
    docId: 'p1',
    op: 'upsert',
    data: { id: 'p1', name: 'مفك', currentStock: 10 },
    timestamp: 100,
  });
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'products',
    docId: 'p1',
    op: 'upsert',
    data: { id: 'p1', name: 'مفك براغي', currentStock: 8 },
    timestamp: 200,
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0].data.currentStock, 8);
  assert.equal(queue[0].data.name, 'مفك براغي');
});

test('enqueueOutboxMutation collapses upsert followed by delete into a delete', () => {
  let queue: SyncOutboxItem[] = [];
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'sales',
    docId: 's1',
    op: 'upsert',
    data: { id: 's1', total: 5000 },
    timestamp: 100,
  });
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'sales',
    docId: 's1',
    op: 'delete',
    timestamp: 200,
  });

  assert.equal(queue.length, 1);
  assert.equal(queue[0].op, 'delete');
  assert.equal(queue[0].data, undefined);
});

test('mergeRemoteCollectionWithPending protects offline edits and deletes from stale remote snapshots', () => {
  const localProducts = [
    { id: 'p1', name: 'محلي محدث', currentStock: 5 },
    { id: 'p3', name: 'جديد أوفلاين', currentStock: 20 },
  ];
  const remoteProducts = [
    { id: 'p1', name: 'قديم من السحابة', currentStock: 12 },
    { id: 'p2', name: 'مادة محذوفة أوفلاين', currentStock: 3 },
    { id: 'p4', name: 'مادة سحابية أخرى', currentStock: 7 },
  ];

  let outbox: SyncOutboxItem[] = [];
  outbox = enqueueOutboxMutation(outbox, {
    collectionName: 'products',
    docId: 'p1',
    op: 'upsert',
    data: localProducts[0],
    timestamp: 100,
  });
  outbox = enqueueOutboxMutation(outbox, {
    collectionName: 'products',
    docId: 'p2',
    op: 'delete',
    timestamp: 150,
  });
  outbox = enqueueOutboxMutation(outbox, {
    collectionName: 'products',
    docId: 'p3',
    op: 'upsert',
    data: localProducts[1],
    timestamp: 200,
  });

  const merged = mergeRemoteCollectionWithPending(
    localProducts,
    remoteProducts,
    outbox,
    'products'
  );

  assert.equal(merged.length, 3);
  assert.equal(merged.find((x) => x.id === 'p1')?.currentStock, 5);
  assert.equal(merged.find((x) => x.id === 'p2'), undefined);
  assert.equal(merged.find((x) => x.id === 'p3')?.name, 'جديد أوفلاين');
  assert.equal(merged.find((x) => x.id === 'p4')?.currentStock, 7);
});

test('mergeRemoteSettingsWithPending protects local settings when pending outbox exists', () => {
  const local = { storeName: 'خردوات المامو - تعديل أوفلاين' };
  const remote = { storeName: 'خردوات المامو' };

  const outbox = enqueueOutboxMutation([], {
    collectionName: 'store_settings',
    docId: 'main',
    op: 'upsert',
    data: local,
    timestamp: 100,
  });

  assert.equal(
    mergeRemoteSettingsWithPending(local, remote, outbox).storeName,
    'خردوات المامو - تعديل أوفلاين'
  );
  assert.equal(
    mergeRemoteSettingsWithPending(local, remote, []).storeName,
    'خردوات المامو'
  );
});

test('processOutboxQueue flushes in order and halts safely on network offline error', async () => {
  let queue: SyncOutboxItem[] = [];
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'products',
    docId: 'p1',
    op: 'upsert',
    data: { id: 'p1' },
    timestamp: 10,
  });
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'sales',
    docId: 's1',
    op: 'upsert',
    data: { id: 's1' },
    timestamp: 20,
  });
  queue = enqueueOutboxMutation(queue, {
    collectionName: 'expenses',
    docId: 'e1',
    op: 'delete',
    timestamp: 30,
  });

  const executed: string[] = [];
  const res = await processOutboxQueue(queue, {
    upsert: async (col, id) => {
      if (col === 'sales') {
        throw new Error('network client is offline');
      }
      executed.push(`upsert:${buildCompositeKey(col, id)}`);
    },
    remove: async (col, id) => {
      executed.push(`delete:${buildCompositeKey(col, id)}`);
    },
  });

  assert.deepEqual(executed, ['upsert:products::p1']);
  assert.equal(res.syncedCount, 1);
  assert.equal(res.failedCount, 1);
  assert.equal(res.remaining.length, 2);
  assert.equal(res.remaining[0].compositeKey, 'sales::s1');
  assert.equal(res.remaining[0].retryCount, 1);
  assert.equal(res.remaining[1].compositeKey, 'expenses::e1');
  assert.equal(res.remaining[1].retryCount, 0);
});
