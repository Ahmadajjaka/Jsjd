import {
  CashTransaction,
  Customer,
  CustomerPayment,
  Expense,
  FinancialSummary,
  Product,
  PurchaseInvoice,
  SaleInvoice,
  SaleItem,
  StoreSettings,
  Supplier,
  SupplierPayment,
} from '../types/accounting';

/**
 * Calculates a single sale item's total and profit based on actual cost
 */
export function calculateSaleItemTotals(
  quantity: number,
  costPrice: number,
  unitPrice: number,
  discount: number = 0
): { total: number; profit: number; cogs: number } {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safeCost = Math.max(0, Number(costPrice) || 0);
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  const safeDiscount = Math.max(0, Number(discount) || 0);

  const rawTotal = safeQty * safePrice;
  const total = Math.max(0, rawTotal - safeDiscount);
  const cogs = safeQty * safeCost;
  const profit = total - cogs;

  return {
    total: Math.round(total * 100) / 100,
    profit: Math.round(profit * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
  };
}

/**
 * Calculates totals for a complete sale invoice
 */
export function calculateInvoiceTotals(
  items: SaleItem[],
  invoiceDiscount: number = 0,
  paidAmount: number = 0,
  paymentMethod: 'cash' | 'debt' | 'partial' = 'cash'
): {
  subtotal: number;
  discount: number;
  total: number;
  cogs: number;
  grossProfit: number;
  paidAmount: number;
  remainingAmount: number;
} {
  const subtotal = items.reduce((sum, item) => sum + (item.total || 0), 0);
  const safeDiscount = Math.min(subtotal, Math.max(0, Number(invoiceDiscount) || 0));
  const total = Math.max(0, subtotal - safeDiscount);
  const cogs = items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
  const grossProfit = total - cogs;

  let actualPaid = 0;
  if (paymentMethod === 'cash') {
    actualPaid = total;
  } else if (paymentMethod === 'debt') {
    actualPaid = 0;
  } else {
    actualPaid = Math.min(total, Math.max(0, Number(paidAmount) || 0));
  }

  const remainingAmount = Math.max(0, total - actualPaid);

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(safeDiscount * 100) / 100,
    total: Math.round(total * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    paidAmount: Math.round(actualPaid * 100) / 100,
    remainingAmount: Math.round(remainingAmount * 100) / 100,
  };
}

/**
 * Calculates gross profit: Net Sales - COGS
 */
export function calculateGrossProfit(netSales: number, cogs: number): number {
  return Math.round((netSales - cogs) * 100) / 100;
}

/**
 * Calculates operating net profit: Gross Profit - Operational Expenses
 */
export function calculateNetOperatingProfit(grossProfit: number, operatingExpenses: number): number {
  return Math.round((grossProfit - operatingExpenses) * 100) / 100;
}

/**
 * Calculates total inventory valuation at cost price
 */
export function calculateInventoryValuation(products: Product[]): number {
  return products.reduce((acc, p) => acc + (p.currentStock * p.costPrice), 0);
}

/**
 * Format currency with locale and custom symbol placement
 */
export function formatCurrency(amount: number, settings?: Partial<StoreSettings>): string {
  const symbol = settings?.currencySymbol || 'ل.س';
  const pos = settings?.currencyPosition || 'after';
  const val = Number(amount) || 0;
  const formatted = val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return pos === 'before' ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}

/**
 * Formats a plain number with commas
 */
export function formatNumber(val: number): string {
  return (Number(val) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Computes complete financial summary for a period
 */
export function computeFinancialSummary(params: {
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
  customerPayments: CustomerPayment[];
  supplierPayments: SupplierPayment[];
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  cashTransactions: CashTransaction[];
  startDate: string;
  endDate: string;
  periodLabel: string;
  initialCash?: number;
}): FinancialSummary {
  const {
    sales,
    purchases,
    expenses,
    customerPayments,
    supplierPayments,
    products,
    customers,
    suppliers,
    cashTransactions,
    startDate,
    endDate,
    periodLabel,
    initialCash = 0,
  } = params;

  // Filter items in period
  const periodSales = sales.filter(s => s.date >= startDate && s.date <= endDate);
  const activeSales = periodSales.filter(s => s.status === 'completed');
  const returnedSales = periodSales.filter(s => s.status === 'returned');

  const grossSales = activeSales.reduce((sum, s) => sum + s.total, 0);
  const salesReturns = returnedSales.reduce((sum, s) => sum + s.total, 0);
  const netSales = grossSales; // returned already separated

  // COGS only on completed sales
  const cogs = activeSales.reduce((sum, s) => sum + (s.cogs || 0), 0);
  const grossProfit = calculateGrossProfit(netSales, cogs);
  const grossProfitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0;

  // Operating Expenses
  const periodExpenses = expenses.filter(e => e.date >= startDate && e.date <= endDate);
  const operatingExpenses = periodExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Net Operating Profit
  const netOperatingProfit = calculateNetOperatingProfit(grossProfit, operatingExpenses);
  const netProfitMargin = netSales > 0 ? (netOperatingProfit / netSales) * 100 : 0;

  // Performance status
  let performanceStatus: 'profitable' | 'loss' | 'breakeven' = 'breakeven';
  if (netOperatingProfit > 0.01) {
    performanceStatus = 'profitable';
  } else if (netOperatingProfit < -0.01) {
    performanceStatus = 'loss';
  }

  // Purchases in period
  const periodPurchases = purchases.filter(p => p.date >= startDate && p.date <= endDate);
  const totalPurchases = periodPurchases.reduce((sum, p) => sum + p.total, 0);

  // Cash flows in period
  const cashReceivedSales = activeSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const periodCustPayments = customerPayments.filter(cp => cp.date >= startDate && cp.date <= endDate);
  const cashReceivedDebts = periodCustPayments.reduce((sum, cp) => sum + cp.amount, 0);

  const cashPaidSuppliersFromPurchases = periodPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
  const periodSuppPayments = supplierPayments.filter(sp => sp.date >= startDate && sp.date <= endDate);
  const cashPaidSuppliersDirect = periodSuppPayments.reduce((sum, sp) => sum + sp.amount, 0);
  const cashPaidSuppliers = cashPaidSuppliersFromPurchases + cashPaidSuppliersDirect;

  const cashPaidExpenses = operatingExpenses;

  // Credit sales & credit purchases
  const creditSalesNew = activeSales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
  const creditPurchasesNew = periodPurchases.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);

  // Snapshot positions
  const currentInventoryValue = calculateInventoryValuation(products);
  const totalCustomerReceivables = customers.reduce((sum, c) => sum + Math.max(0, c.totalDebt), 0);
  const totalSupplierPayables = suppliers.reduce((sum, s) => sum + Math.max(0, s.totalDebt), 0);

  // Current actual cash balance (all-time running)
  const currentCashBalance = cashTransactions.length > 0
    ? cashTransactions[cashTransactions.length - 1].runningBalance
    : initialCash;

  return {
    periodLabel,
    startDate,
    endDate,
    grossSales: Math.round(grossSales * 100) / 100,
    salesReturns: Math.round(salesReturns * 100) / 100,
    netSales: Math.round(netSales * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossProfitMargin: Math.round(grossProfitMargin * 10) / 10,
    operatingExpenses: Math.round(operatingExpenses * 100) / 100,
    netOperatingProfit: Math.round(netOperatingProfit * 100) / 100,
    netProfitMargin: Math.round(netProfitMargin * 10) / 10,
    performanceStatus,
    totalPurchases: Math.round(totalPurchases * 100) / 100,
    cashReceivedSales: Math.round(cashReceivedSales * 100) / 100,
    cashReceivedDebts: Math.round(cashReceivedDebts * 100) / 100,
    cashPaidSuppliers: Math.round(cashPaidSuppliers * 100) / 100,
    cashPaidExpenses: Math.round(cashPaidExpenses * 100) / 100,
    creditSalesNew: Math.round(creditSalesNew * 100) / 100,
    creditPurchasesNew: Math.round(creditPurchasesNew * 100) / 100,
    currentInventoryValue: Math.round(currentInventoryValue * 100) / 100,
    totalCustomerReceivables: Math.round(totalCustomerReceivables * 100) / 100,
    totalSupplierPayables: Math.round(totalSupplierPayables * 100) / 100,
    cashBalance: Math.round(currentCashBalance * 100) / 100,
  };
}

/**
 * Generate standard Arabic month names for archive
 */
export const ARABIC_MONTHS = [
  { num: '01', name: 'كانون الثاني (يناير)' },
  { num: '02', name: 'شباط (فبراير)' },
  { num: '03', name: 'آذار (مارس)' },
  { num: '04', name: 'نيسان (أبريل)' },
  { num: '05', name: 'أيار (مايو)' },
  { num: '06', name: 'حزيران (يونيو)' },
  { num: '07', name: 'تموز (يوليو)' },
  { num: '08', name: 'آب (أغسطس)' },
  { num: '09', name: 'أيلول (سبتمبر)' },
  { num: '10', name: 'تشرين الأول (أكتوبر)' },
  { num: '11', name: 'تشرين الثاني (نوفمبر)' },
  { num: '12', name: 'كانون الأول (ديسمبر)' },
];

/**
 * Get current local date YYYY-MM-DD
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current time HH:mm
 */
export function getCurrentTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Helper to download CSV with UTF-8 BOM
 */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csvContent = '\uFEFF' + [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
