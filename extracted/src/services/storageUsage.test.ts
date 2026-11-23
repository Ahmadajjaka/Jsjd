import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStorageUsage, formatByteSize } from './firebaseSync';
import { getInitialState } from '../utils/storage';

test('formatByteSize formats bytes properly into Arabic units', () => {
  assert.equal(formatByteSize(500), '500 بايت');
  assert.equal(formatByteSize(2048), '2.0 ك.ب (كيلوبايت)');
  assert.equal(formatByteSize(5 * 1024 * 1024), '5.00 م.ب (ميغابايت)');
  assert.equal(formatByteSize(1024 * 1024 * 1024), '1.000 ج.ب (جيجابايت)');
});

test('calculateStorageUsage computes valid usage, remaining capacity, and breakdown', () => {
  const state = getInitialState();
  const usage = calculateStorageUsage(state);

  assert.ok(usage.usedBytes > 0, 'Used bytes should be greater than 0');
  assert.equal(usage.totalBytes, 1024 * 1024 * 1024);
  assert.ok(usage.remainingBytes > 0, 'Remaining bytes should be greater than 0');
  assert.ok(usage.percentage > 0 && usage.percentage <= 100);
  assert.ok(usage.breakdown.length > 0, 'Breakdown should contain all system collections');

  const productsCollection = usage.breakdown.find((b) => b.name === 'products');
  assert.ok(productsCollection);
  assert.equal(productsCollection.count, state.products.length);
});

test('initial clean state has zero dummy products, sales, customers, suppliers, and transactions', () => {
  const state = getInitialState();
  assert.equal(state.products.length, 0);
  assert.equal(state.sales.length, 0);
  assert.equal(state.purchases.length, 0);
  assert.equal(state.customers.length, 0);
  assert.equal(state.suppliers.length, 0);
  assert.equal(state.expenses.length, 0);
  assert.equal(state.cashTransactions.length, 0);
  assert.equal(state.settings.initialCash, 0);
});
