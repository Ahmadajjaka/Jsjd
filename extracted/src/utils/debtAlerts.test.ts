import test from 'node:test';
import assert from 'node:assert/strict';
import { computeOverdueDebts, diffDaysBetweenDates } from './debtAlerts';
import { Customer, PurchaseInvoice, SaleInvoice, Supplier } from '../types/accounting';

test('diffDaysBetweenDates calculates exact UTC day offsets', () => {
  assert.equal(diffDaysBetweenDates('2026-11-18', '2026-11-18'), 0);
  assert.equal(diffDaysBetweenDates('2026-11-18', '2026-11-08'), 10);
  assert.equal(diffDaysBetweenDates('2026-11-18', '2026-10-18'), 31);
  assert.equal(diffDaysBetweenDates('2026-11-10', '2026-11-18'), 0);
});

test('computeOverdueDebts detects overdue customers and suppliers exceeding configured settings', () => {
  const customers: Customer[] = [
    {
      id: 'cust-overdue',
      name: 'ورشة النور',
      phone: '0944000111',
      totalPurchases: 50000,
      totalPaid: 10000,
      totalDebt: 40000,
      createdAt: '2026-09-01',
    },
    {
      id: 'cust-ok',
      name: 'زبون منتظم',
      phone: '0944000222',
      totalPurchases: 20000,
      totalPaid: 5000,
      totalDebt: 15000,
      createdAt: '2026-11-10',
    },
    {
      id: 'cust-paid',
      name: 'زبون مسدد بالكامل',
      totalPurchases: 30000,
      totalPaid: 30000,
      totalDebt: 0,
      createdAt: '2026-01-01',
    },
  ];

  const suppliers: Supplier[] = [
    {
      id: 'supp-overdue',
      name: 'شركة الشام للكهربائيات',
      company: 'الشام',
      phone: '0933111222',
      totalPurchases: 100000,
      totalPaid: 20000,
      totalDebt: 80000,
      createdAt: '2026-09-15',
    },
    {
      id: 'supp-ok',
      name: 'مورد حديث',
      totalPurchases: 10000,
      totalPaid: 0,
      totalDebt: 10000,
      createdAt: '2026-11-12',
    },
  ];

  const sales: SaleInvoice[] = [
    {
      id: 's1',
      invoiceNumber: 'ف-101',
      date: '2026-10-01', // 48 days before 2026-11-18 -> overdue if limit=30
      time: '10:00',
      customerId: 'cust-overdue',
      customerName: 'ورشة النور',
      isCashCustomer: false,
      items: [],
      subtotal: 40000,
      discount: 0,
      total: 40000,
      cogs: 25000,
      grossProfit: 15000,
      paymentMethod: 'debt',
      paidAmount: 0,
      remainingAmount: 40000,
      status: 'completed',
      createdAt: '2026-10-01',
    },
    {
      id: 's2',
      invoiceNumber: 'ف-102',
      date: '2026-11-10', // 8 days before 2026-11-18 -> NOT overdue when limit=30
      time: '11:00',
      customerId: 'cust-ok',
      customerName: 'زبون منتظم',
      isCashCustomer: false,
      items: [],
      subtotal: 15000,
      discount: 0,
      total: 15000,
      cogs: 10000,
      grossProfit: 5000,
      paymentMethod: 'debt',
      paidAmount: 0,
      remainingAmount: 15000,
      status: 'completed',
      createdAt: '2026-11-10',
    },
  ];

  const purchases: PurchaseInvoice[] = [
    {
      id: 'p1',
      invoiceNumber: 'ش-201',
      date: '2026-10-05', // 44 days before 2026-11-18
      time: '09:00',
      supplierId: 'supp-overdue',
      supplierName: 'شركة الشام للكهربائيات',
      items: [],
      subtotal: 80000,
      shippingCost: 0,
      discount: 0,
      total: 80000,
      paidAmount: 0,
      remainingAmount: 80000,
      paymentMethod: 'debt',
      createdAt: '2026-10-05',
    },
  ];

  const summary = computeOverdueDebts({
    customers,
    suppliers,
    sales,
    purchases,
    customerDebtDueDays: 30,
    supplierDebtDueDays: 30,
    today: '2026-11-18',
  });

  assert.equal(summary.customerAlerts.length, 1);
  assert.equal(summary.customerAlerts[0].name, 'ورشة النور');
  assert.equal(summary.customerAlerts[0].daysElapsed, 48);
  assert.equal(summary.customerAlerts[0].daysOverdue, 18);
  assert.equal(summary.customerAlerts[0].severity, 'critical');
  assert.equal(summary.totalOverdueCustomerDebt, 40000);

  assert.equal(summary.supplierAlerts.length, 1);
  assert.equal(summary.supplierAlerts[0].name, 'شركة الشام للكهربائيات');
  assert.equal(summary.supplierAlerts[0].daysElapsed, 44);
  assert.equal(summary.supplierAlerts[0].daysOverdue, 14);
  assert.equal(summary.totalOverdueSupplierDebt, 80000);

  // Tightening settings due days to 5 days flags both cust-ok (8 days) and supp-ok (6 days)
  const strictSummary = computeOverdueDebts({
    customers,
    suppliers,
    sales,
    purchases,
    customerDebtDueDays: 5,
    supplierDebtDueDays: 5,
    today: '2026-11-18',
  });
  assert.equal(strictSummary.customerAlerts.length, 2);
  assert.equal(strictSummary.supplierAlerts.length, 2);
});

test('computeOverdueDebts attributes remaining debt to newest uncovered invoices', () => {
  const customers: Customer[] = [
    {
      id: 'cust-fifo',
      name: 'مقاولات السلام',
      totalPurchases: 60000,
      totalPaid: 40000,
      totalDebt: 20000,
      createdAt: '2026-08-01',
    },
  ];
  const sales: SaleInvoice[] = [
    {
      id: 'old-inv',
      invoiceNumber: 'ف-001',
      date: '2026-08-05',
      time: '10:00',
      customerId: 'cust-fifo',
      customerName: 'مقاولات السلام',
      isCashCustomer: false,
      items: [],
      subtotal: 40000,
      discount: 0,
      total: 40000,
      cogs: 30000,
      grossProfit: 10000,
      paymentMethod: 'debt',
      paidAmount: 0,
      remainingAmount: 40000,
      status: 'completed',
      createdAt: '2026-08-05',
    },
    {
      id: 'new-inv',
      invoiceNumber: 'ف-002',
      date: '2026-11-15',
      time: '12:00',
      customerId: 'cust-fifo',
      customerName: 'مقاولات السلام',
      isCashCustomer: false,
      items: [],
      subtotal: 20000,
      discount: 0,
      total: 20000,
      cogs: 15000,
      grossProfit: 5000,
      paymentMethod: 'debt',
      paidAmount: 0,
      remainingAmount: 20000,
      status: 'completed',
      createdAt: '2026-11-15',
    },
  ];

  const summary = computeOverdueDebts({
    customers,
    suppliers: [],
    sales,
    purchases: [],
    customerDebtDueDays: 10,
    supplierDebtDueDays: 10,
    today: '2026-11-18',
  });

  // Since totalDebt=20000 is fully covered by newest invoice (2026-11-15, only 3 days ago), NOT overdue
  assert.equal(summary.customerAlerts.length, 0);
});
