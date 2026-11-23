import test from 'node:test';
import assert from 'node:assert/strict';
import {
  exportMasterStoreReportPdf,
  exportSalesReportPdf,
  exportPurchasesReportPdf,
  exportExpensesReportPdf,
  exportProfitReportPdf,
  exportCashboxReportPdf,
  exportInventoryReportPdf,
  exportCustomerDebtsReportPdf,
  exportSupplierDebtsReportPdf,
} from './pdfExport';
import { getInitialState } from './storage';
import { computeFinancialSummary } from './accounting';
import { calculateStorageUsage } from '../services/firebaseSync';

test('pdfExport functions format reports without throwing errors', () => {
  const state = getInitialState();
  const todaySummary = computeFinancialSummary({
    sales: state.sales,
    purchases: state.purchases,
    expenses: state.expenses,
    customerPayments: state.customerPayments,
    supplierPayments: state.supplierPayments,
    products: state.products,
    customers: state.customers,
    suppliers: state.suppliers,
    cashTransactions: state.cashTransactions,
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    periodLabel: 'اليوم',
    initialCash: state.settings.initialCash,
  });
  const monthSummary = { ...todaySummary };
  const storageInfo = calculateStorageUsage(state);

  // In test environment without DOM, printHtmlAsPdf does nothing or skips window iframe
  assert.doesNotThrow(() => {
    exportSalesReportPdf('today', state.sales, state.settings, todaySummary);
  });

  assert.doesNotThrow(() => {
    exportPurchasesReportPdf('today', state.purchases, state.settings, todaySummary);
  });

  assert.doesNotThrow(() => {
    exportExpensesReportPdf('today', state.expenses, state.settings, todaySummary);
  });

  assert.doesNotThrow(() => {
    exportProfitReportPdf(todaySummary, monthSummary, state.settings);
  });

  assert.doesNotThrow(() => {
    exportCashboxReportPdf(state.cashTransactions, monthSummary.cashBalance, state.settings);
  });

  assert.doesNotThrow(() => {
    exportInventoryReportPdf(state.products, state.settings);
  });

  assert.doesNotThrow(() => {
    exportCustomerDebtsReportPdf(state.customers, state.settings);
  });

  assert.doesNotThrow(() => {
    exportSupplierDebtsReportPdf(state.suppliers, state.settings);
  });

  assert.doesNotThrow(() => {
    exportMasterStoreReportPdf(state, todaySummary, monthSummary, storageInfo);
  });
});
