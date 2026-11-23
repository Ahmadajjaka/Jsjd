import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPrefixForCategory } from '../components/InventoryView';
import { DEFAULT_SETTINGS } from './storage';

test('DEFAULT_SETTINGS contains the 4 requested core categories', () => {
  assert.deepEqual(DEFAULT_SETTINGS.categories, ['كهربائية', 'صحية', 'بناء', 'عامة']);
});

test('getPrefixForCategory assigns expected hardware prefixes', () => {
  assert.equal(getPrefixForCategory('كهربائية'), 'ELE');
  assert.equal(getPrefixForCategory('كهربائيات عامة'), 'ELE');
  assert.equal(getPrefixForCategory('صحية'), 'SAN');
  assert.equal(getPrefixForCategory('أدوات صحية'), 'SAN');
  assert.equal(getPrefixForCategory('بناء'), 'BLD');
  assert.equal(getPrefixForCategory('مواد بناء وإسمنت'), 'BLD');
  assert.equal(getPrefixForCategory('عامة'), 'GEN');
  assert.equal(getPrefixForCategory('أي تصنيف آخر'), 'GEN');
});
