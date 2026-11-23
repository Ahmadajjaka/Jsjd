import test from 'node:test';
import assert from 'node:assert/strict';
import { findProductByBarcode, normalizeBarcodeInput } from './barcodeMatch.ts';
import type { Product } from '../types/accounting.ts';

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    code: 'ELE-001',
    barcode: '6221234567890',
    name: 'قاطع كهربائي شنايدر 32 أمبير',
    category: 'كهربائية',
    unit: 'قطعة',
    currentStock: 25,
    costPrice: 40000,
    sellingPrice: 55000,
    minStock: 5,
    createdAt: '2026-10-01',
  },
  {
    id: 'prod-2',
    code: 'SAN-012',
    name: 'حنفية نحاس إيطالي',
    category: 'صحية',
    unit: 'قطعة',
    currentStock: 10,
    costPrice: 70000,
    sellingPrice: 95000,
    minStock: 3,
    createdAt: '2026-10-01',
  },
];

test('normalizeBarcodeInput converts Arabic-Indic digits to ASCII', () => {
  assert.equal(normalizeBarcodeInput('  ٦٢٢١٢٣٤٥٦٧٨٩٠ '), '6221234567890');
  assert.equal(normalizeBarcodeInput('ELE-٠٠١'), 'ELE-001');
});

test('findProductByBarcode matches exact barcode field first', () => {
  const res = findProductByBarcode(SAMPLE_PRODUCTS, '6221234567890');
  assert.equal(res.product?.id, 'prod-1');
  assert.equal(res.matchedBy, 'barcode');
});

test('findProductByBarcode matches product code case-insensitively and with Arabic digits', () => {
  const res = findProductByBarcode(SAMPLE_PRODUCTS, 'san-٠١٢');
  assert.equal(res.product?.id, 'prod-2');
  assert.equal(res.matchedBy, 'code');
});

test('findProductByBarcode returns null when no product matches', () => {
  const res = findProductByBarcode(SAMPLE_PRODUCTS, '9999999999999');
  assert.equal(res.product, null);
  assert.equal(res.matchedBy, null);
});
