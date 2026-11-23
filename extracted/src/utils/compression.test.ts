import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compressToBytes,
  decompressFromBytes,
  packDocumentForFirestore,
  unpackDocumentFromFirestore,
  compressForLocalStorage,
  decompressFromLocalStorage,
} from './compression';

test('compressToBytes and decompressFromBytes preserves complex Arabic objects', () => {
  const original = {
    id: 'inv-999',
    customerName: 'أحمد نوار المامو للمقاولات العامة',
    items: [
      { name: 'مسمار صلب 5 سم', quantity: 100, price: 500, total: 50000 },
      { name: 'قاطع كهربائي 16 أمبير شنايدر أصلي', quantity: 20, price: 18000, total: 360000 },
      { name: 'أنبوب مياه بي بي آر فوش 1 إنش ضغط عالي', quantity: 45, price: 8500, total: 382500 },
    ],
    notes: 'ملاحظة: التسليم إلى الورشة الكائنة بجانب دوار المامو مع ضمان الجودة',
    subtotal: 792500,
    discount: 12500,
    total: 780000,
    paidAmount: 500000,
    remainingAmount: 280000,
    date: '2026-11-05',
  };

  const comp = compressToBytes(original);
  assert.ok(comp.compressedSize > 0);
  assert.ok(comp.compressedSize < comp.originalSize, 'Compressed size should be smaller than original');
  assert.ok(comp.savingsPercentage > 20, 'Savings should be substantial (>20%)');

  const restored = decompressFromBytes(comp.compressedBytes);
  assert.deepEqual(restored, original);
});

test('packDocumentForFirestore and unpackDocumentFromFirestore compresses and restores accurately', () => {
  const product = {
    id: 'prod-777',
    name: 'مفك براغي كهربائي ذكي ماركة بوش',
    category: 'كهربائية',
    unit: 'قطعة',
    currentStock: 45,
    minStock: 5,
    costPrice: 22000,
    sellingPrice: 29500,
    notes: 'مستورد ألماني من الوكيل الرسمي لخردوات المامو',
  };

  const packed = packDocumentForFirestore(product.id, product);
  assert.equal(packed._c, true);
  assert.equal(packed._alg, 'deflate-9');
  assert.ok(packed.d);

  const unpacked = unpackDocumentFromFirestore(packed);
  assert.deepEqual(unpacked, product);
});

test('unpackDocumentFromFirestore handles legacy uncompressed documents seamlessly', () => {
  const legacy = {
    id: 'cust-123',
    name: 'ورشة السلام',
    balance: 45000,
  };

  const unpacked = unpackDocumentFromFirestore(legacy);
  assert.deepEqual(unpacked, legacy);
});

test('localStorage compression and decompression roundtrip', () => {
  const state = {
    theme: 'dark',
    settings: { storeName: 'خردوات المامو', currency: 'SYP' },
    counts: [1, 2, 3, 4, 5],
  };

  const compressedStr = compressForLocalStorage(state);
  assert.ok(compressedStr.startsWith('__COMPRESSED_DEF9__:'));

  const restored = decompressFromLocalStorage(compressedStr);
  assert.deepEqual(restored, state);
});
