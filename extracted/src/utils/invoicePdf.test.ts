import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoicePdfDocument } from './invoicePdf';
import { SaleInvoice, StoreSettings } from '../types/accounting';

import { DEFAULT_SETTINGS } from './storage';

const SAMPLE_SETTINGS: StoreSettings = {
  ...DEFAULT_SETTINGS,
  storeName: 'خردوات المامو',
  storeTagline: 'خردوات ومواد بناء وأدوات صحية وكهربائية',
  phone: '0944123456',
  address: 'دوار المامو',
  currencySymbol: 'ل.س',
  currencyPosition: 'after',
  taxNumber: 'TAX-991',
  invoiceHeaderNote: 'أهلاً بكم',
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
  invoicePrintLayout: 'thermal80',
  initialCash: 100000,
};

const SAMPLE_INVOICE: SaleInvoice = {
  id: 'sale-1',
  invoiceNumber: 'INV-2026-001',
  date: '2026-11-18',
  time: '10:30',
  customerId: 'cust-1',
  customerName: 'ورشة النور للمقاولات',
  isCashCustomer: false,
  items: [
    {
      productId: 'p1',
      productCode: 'EL-101',
      productName: 'قاطع كهربائي 16 أمبير شنايدر',
      category: 'كهربائية',
      unit: 'قطعة',
      quantity: 4,
      costPrice: 18000,
      unitPrice: 24000,
      discount: 0,
      total: 96000,
      profit: 24000,
    },
    {
      productId: 'p2',
      productCode: 'PL-202',
      productName: 'حنفية نحاس إيطالي مقاس نصف إنش',
      category: 'صحية',
      unit: 'قطعة',
      quantity: 2,
      costPrice: 30000,
      unitPrice: 40000,
      discount: 5000,
      total: 75000,
      profit: 15000,
    },
  ],
  subtotal: 171000,
  discount: 1000,
  total: 170000,
  cogs: 132000,
  grossProfit: 38000,
  paymentMethod: 'partial',
  paidAmount: 100000,
  remainingAmount: 70000,
  notes: 'التسليم في الموقع',
  status: 'completed',
  createdAt: '2026-11-18',
};

test('buildInvoicePdfDocument generates valid thermal80 PDF bytes via jsPDF', () => {
  const result = buildInvoicePdfDocument(SAMPLE_INVOICE, SAMPLE_SETTINGS, 'thermal80');
  assert.equal(result.layout, 'thermal80');
  assert.match(result.fileName, /^فاتورة_INV-2026-001_80mm\.pdf$/);
  assert.ok(result.pageCount >= 1);

  const bytes = new Uint8Array(result.doc.output('arraybuffer'));
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, '%PDF-');
  assert.ok(bytes.length > 400);
});

test('buildInvoicePdfDocument generates valid standard A4 PDF bytes via jsPDF', () => {
  const result = buildInvoicePdfDocument(SAMPLE_INVOICE, SAMPLE_SETTINGS, 'standard');
  assert.equal(result.layout, 'standard');
  assert.match(result.fileName, /^فاتورة_INV-2026-001_A4\.pdf$/);
  assert.ok(result.pageCount >= 1);

  const bytes = new Uint8Array(result.doc.output('arraybuffer'));
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  assert.equal(header, '%PDF-');
  assert.ok(bytes.length > 400);
});
