import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSaleItemTotals,
  calculateInvoiceTotals,
  calculateGrossProfit,
  calculateNetOperatingProfit,
  calculateInventoryValuation,
  computeFinancialSummary,
} from './accounting';
import { Product, SaleInvoice, Expense, CashTransaction, Customer, Supplier } from '../types/accounting';
import { DEFAULT_SETTINGS } from './storage';

test('calculateSaleItemTotals computes correct item total, cogs, and gross profit', () => {
  // 5 pieces, bought at 10 each, sold at 15 each, with 5 discount
  // Total = 5 * 15 - 5 = 70. COGS = 5 * 10 = 50. Profit = 70 - 50 = 20.
  const res = calculateSaleItemTotals(5, 10, 15, 5);
  assert.equal(res.total, 70);
  assert.equal(res.cogs, 50);
  assert.equal(res.profit, 20);
});

test('calculateInvoiceTotals handles cash payment method properly', () => {
  const items = [
    {
      productId: 'p1',
      productCode: 'ITM-01',
      productName: 'إسمنت بورتلاندي',
      category: 'مواد بناء',
      unit: 'كيس',
      quantity: 10,
      costPrice: 40,
      unitPrice: 50,
      discount: 0,
      total: 500,
      profit: 100,
    },
    {
      productId: 'p2',
      productCode: 'ITM-02',
      productName: 'مطرقة حديدية',
      category: 'عدد يدوية',
      unit: 'قطعة',
      quantity: 2,
      costPrice: 15,
      unitPrice: 25,
      discount: 0,
      total: 50,
      profit: 20,
    },
  ];

  // Additional invoice discount: 10
  // Subtotal = 550, Discount = 10, Total = 540.
  // COGS = (10 * 40) + (2 * 15) = 430.
  // Gross Profit = 540 - 430 = 110.
  const res = calculateInvoiceTotals(items, 10, 0, 'cash');
  assert.equal(res.subtotal, 550);
  assert.equal(res.discount, 10);
  assert.equal(res.total, 540);
  assert.equal(res.cogs, 430);
  assert.equal(res.grossProfit, 110);
  assert.equal(res.paidAmount, 540);
  assert.equal(res.remainingAmount, 0);
});

test('calculateInvoiceTotals handles credit (debt) and partial payment methods', () => {
  const items = [
    {
      productId: 'p1',
      productCode: 'ITM-01',
      productName: 'دهان أبيض',
      category: 'دهانات',
      unit: 'سطل',
      quantity: 4,
      costPrice: 80,
      unitPrice: 100,
      discount: 0,
      total: 400,
      profit: 80,
    },
  ];

  // Debt payment: paid 0, remaining 400
  const debtRes = calculateInvoiceTotals(items, 0, 0, 'debt');
  assert.equal(debtRes.total, 400);
  assert.equal(debtRes.paidAmount, 0);
  assert.equal(debtRes.remainingAmount, 400);

  // Partial payment: paid 150, remaining 250
  const partialRes = calculateInvoiceTotals(items, 0, 150, 'partial');
  assert.equal(partialRes.total, 400);
  assert.equal(partialRes.paidAmount, 150);
  assert.equal(partialRes.remainingAmount, 250);
});

test('calculateGrossProfit and calculateNetOperatingProfit adhere strictly to accounting equations', () => {
  // Gross profit = Net Sales (10,000) - COGS (7,000) = 3,000
  const gross = calculateGrossProfit(10000, 7000);
  assert.equal(gross, 3000);

  // Net operating profit = Gross Profit (3,000) - Operating Expenses (800) = 2,200
  const net = calculateNetOperatingProfit(gross, 800);
  assert.equal(net, 2200);

  // If operating expenses exceed gross profit: Net = 3,000 - 3,500 = -500 (Loss)
  const netLoss = calculateNetOperatingProfit(gross, 3500);
  assert.equal(netLoss, -500);
});

test('calculateInventoryValuation sums all items based on cost price', () => {
  const products: Product[] = [
    {
      id: '1',
      code: 'A',
      name: 'أنبوب بلاستيك',
      category: 'أدوات صحية',
      unit: 'متر',
      currentStock: 100,
      costPrice: 2,
      sellingPrice: 3.5,
      minStock: 20,
      createdAt: '2026-01-01',
    },
    {
      id: '2',
      code: 'B',
      name: 'قاطع كهربائي',
      category: 'كهربائيات',
      unit: 'قطعة',
      currentStock: 50,
      costPrice: 10,
      sellingPrice: 15,
      minStock: 10,
      createdAt: '2026-01-01',
    },
  ];

  // Valuation = (100 * 2) + (50 * 10) = 200 + 500 = 700
  assert.equal(calculateInventoryValuation(products), 700);
});

test('computeFinancialSummary calculates realistic period summary correctly', () => {
  const sales: SaleInvoice[] = [
    {
      id: 's1',
      invoiceNumber: 'ف-101',
      date: '2026-10-24',
      time: '10:00',
      customerId: 'cash_customer',
      customerName: 'زبون نقدي',
      isCashCustomer: true,
      items: [],
      subtotal: 1000,
      discount: 0,
      total: 1000,
      cogs: 700,
      grossProfit: 300,
      paymentMethod: 'cash',
      paidAmount: 1000,
      remainingAmount: 0,
      status: 'completed',
      createdAt: '2026-10-24',
    },
  ];

  const expenses: Expense[] = [
    {
      id: 'e1',
      date: '2026-10-24',
      time: '11:00',
      category: 'أجور عمال',
      description: 'يومية عامل المتجر',
      amount: 100,
      paymentMethod: 'cash',
      createdAt: '2026-10-24',
    },
  ];

  const cashTx: CashTransaction[] = [
    {
      id: 't1',
      date: '2026-10-24',
      time: '10:00',
      type: 'sale_receipt',
      description: 'مقبوضات فاتورة ف-101',
      flow: 'in',
      amount: 1000,
      runningBalance: 1000,
    },
    {
      id: 't2',
      date: '2026-10-24',
      time: '11:00',
      type: 'expense',
      description: 'أجور عمال',
      flow: 'out',
      amount: 100,
      runningBalance: 900,
    },
  ];

  const summary = computeFinancialSummary({
    sales,
    purchases: [],
    expenses,
    customerPayments: [],
    supplierPayments: [],
    products: [],
    customers: [],
    suppliers: [],
    cashTransactions: cashTx,
    startDate: '2026-10-24',
    endDate: '2026-10-24',
    periodLabel: 'اليوم',
  });

  assert.equal(summary.grossSales, 1000);
  assert.equal(summary.cogs, 700);
  assert.equal(summary.grossProfit, 300);
  assert.equal(summary.operatingExpenses, 100);
  assert.equal(summary.netOperatingProfit, 200);
  assert.equal(summary.performanceStatus, 'profitable');
  assert.equal(summary.cashBalance, 900);
});

test('DEFAULT_SETTINGS configures thermal80 as default print layout', () => {
  assert.equal(DEFAULT_SETTINGS.invoicePrintLayout, 'thermal80');
});

