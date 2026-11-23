import {
  Customer,
  CustomerPayment,
  PurchaseInvoice,
  SaleInvoice,
  Supplier,
  SupplierPayment,
} from '../types/accounting';

export interface OverdueDebtAlert {
  id: string;
  entityType: 'customer' | 'supplier';
  entityId: string;
  name: string;
  company?: string;
  phone?: string;
  totalDebt: number;
  oldestUnpaidDate: string;
  referenceNumber: string;
  daysElapsed: number;
  allowedDays: number;
  daysOverdue: number;
  severity: 'warning' | 'critical';
}

export interface OverdueDebtSummary {
  customerAlerts: OverdueDebtAlert[];
  supplierAlerts: OverdueDebtAlert[];
  allAlerts: OverdueDebtAlert[];
  totalOverdueCustomerDebt: number;
  totalOverdueSupplierDebt: number;
  customerDueDays: number;
  supplierDueDays: number;
}

function parseIsoDateUtc(dateStr?: string): number | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const clean = dateStr.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const utc = Date.UTC(year, month, day);
  if (Number.isNaN(utc)) return null;
  return utc;
}

export function diffDaysBetweenDates(laterDateStr: string, earlierDateStr: string): number {
  const laterUtc = parseIsoDateUtc(laterDateStr);
  const earlierUtc = parseIsoDateUtc(earlierDateStr);
  if (laterUtc === null || earlierUtc === null) return 0;
  const diffMs = laterUtc - earlierUtc;
  return Math.max(0, Math.floor(diffMs / 86_400_000));
}

function findOldestUncoveredDebtOrigin(
  totalDebt: number,
  creditDocs: Array<{ date: string; remainingAmount: number; invoiceNumber: string }>,
  fallbackDate: string,
  todayStr: string
): { oldestDate: string; referenceNumber: string } {
  const sortedNewestFirst = [...creditDocs]
    .filter((d) => d.remainingAmount > 0 && d.date)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (sortedNewestFirst.length === 0) {
    return {
      oldestDate: parseIsoDateUtc(fallbackDate) !== null ? fallbackDate : todayStr,
      referenceNumber: 'رصيد افتتاحي / قيد حساب',
    };
  }

  let uncovered = Math.max(0, totalDebt);
  let oldestDoc = sortedNewestFirst[0];

  for (const docItem of sortedNewestFirst) {
    oldestDoc = docItem;
    uncovered -= docItem.remainingAmount;
    if (uncovered <= 0.01) {
      return {
        oldestDate: docItem.date,
        referenceNumber: docItem.invoiceNumber,
      };
    }
  }

  // Remaining portion came from opening balance or earlier unlinked debt
  const validFallback = parseIsoDateUtc(fallbackDate);
  const oldestDocUtc = parseIsoDateUtc(oldestDoc.date);
  if (validFallback !== null && (oldestDocUtc === null || validFallback <= oldestDocUtc)) {
    return {
      oldestDate: fallbackDate,
      referenceNumber: 'رصيد افتتاحي + فواتير سابقة',
    };
  }

  return {
    oldestDate: oldestDoc.date,
    referenceNumber: oldestDoc.invoiceNumber,
  };
}

export function computeOverdueDebts(params: {
  customers: Customer[];
  suppliers: Supplier[];
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  customerPayments?: CustomerPayment[];
  supplierPayments?: SupplierPayment[];
  customerDebtDueDays?: number;
  supplierDebtDueDays?: number;
  today: string;
}): OverdueDebtSummary {
  const {
    customers,
    suppliers,
    sales,
    purchases,
    customerDebtDueDays = 30,
    supplierDebtDueDays = 30,
    today,
  } = params;

  const allowedCustDays = Math.max(0, Number.isFinite(Number(customerDebtDueDays)) ? Number(customerDebtDueDays) : 30);
  const allowedSuppDays = Math.max(0, Number.isFinite(Number(supplierDebtDueDays)) ? Number(supplierDebtDueDays) : 30);

  const customerAlerts: OverdueDebtAlert[] = [];
  for (const c of customers || []) {
    if (!c || (Number(c.totalDebt) || 0) <= 0.01) continue;

    const custCreditSales = (sales || [])
      .filter((s) => s.customerId === c.id && s.status === 'completed' && s.remainingAmount > 0)
      .map((s) => ({
        date: s.date,
        remainingAmount: s.remainingAmount,
        invoiceNumber: s.invoiceNumber,
      }));

    const origin = findOldestUncoveredDebtOrigin(
      c.totalDebt,
      custCreditSales,
      c.createdAt,
      today
    );

    const daysElapsed = diffDaysBetweenDates(today, origin.oldestDate);
    const daysOverdue = daysElapsed - allowedCustDays;

    if (daysOverdue > 0) {
      const severity: 'warning' | 'critical' =
        daysOverdue >= Math.max(15, Math.ceil(allowedCustDays * 0.5)) ? 'critical' : 'warning';
      customerAlerts.push({
        id: `alert-cust-${c.id}`,
        entityType: 'customer',
        entityId: c.id,
        name: c.name,
        phone: c.phone,
        totalDebt: Math.round(c.totalDebt * 100) / 100,
        oldestUnpaidDate: origin.oldestDate,
        referenceNumber: origin.referenceNumber,
        daysElapsed,
        allowedDays: allowedCustDays,
        daysOverdue,
        severity,
      });
    }
  }

  const supplierAlerts: OverdueDebtAlert[] = [];
  for (const s of suppliers || []) {
    if (!s || (Number(s.totalDebt) || 0) <= 0.01) continue;

    const suppCreditPurchases = (purchases || [])
      .filter((p) => p.supplierId === s.id && p.remainingAmount > 0)
      .map((p) => ({
        date: p.date,
        remainingAmount: p.remainingAmount,
        invoiceNumber: p.invoiceNumber,
      }));

    const origin = findOldestUncoveredDebtOrigin(
      s.totalDebt,
      suppCreditPurchases,
      s.createdAt,
      today
    );

    const daysElapsed = diffDaysBetweenDates(today, origin.oldestDate);
    const daysOverdue = daysElapsed - allowedSuppDays;

    if (daysOverdue > 0) {
      const severity: 'warning' | 'critical' =
        daysOverdue >= Math.max(15, Math.ceil(allowedSuppDays * 0.5)) ? 'critical' : 'warning';
      supplierAlerts.push({
        id: `alert-supp-${s.id}`,
        entityType: 'supplier',
        entityId: s.id,
        name: s.name,
        company: s.company,
        phone: s.phone,
        totalDebt: Math.round(s.totalDebt * 100) / 100,
        oldestUnpaidDate: origin.oldestDate,
        referenceNumber: origin.referenceNumber,
        daysElapsed,
        allowedDays: allowedSuppDays,
        daysOverdue,
        severity,
      });
    }
  }

  const sortAlerts = (a: OverdueDebtAlert, b: OverdueDebtAlert) => {
    if (b.daysOverdue !== a.daysOverdue) return b.daysOverdue - a.daysOverdue;
    return b.totalDebt - a.totalDebt;
  };

  customerAlerts.sort(sortAlerts);
  supplierAlerts.sort(sortAlerts);

  const allAlerts = [...customerAlerts, ...supplierAlerts].sort(sortAlerts);
  const totalOverdueCustomerDebt =
    Math.round(customerAlerts.reduce((sum, a) => sum + a.totalDebt, 0) * 100) / 100;
  const totalOverdueSupplierDebt =
    Math.round(supplierAlerts.reduce((sum, a) => sum + a.totalDebt, 0) * 100) / 100;

  return {
    customerAlerts,
    supplierAlerts,
    allAlerts,
    totalOverdueCustomerDebt,
    totalOverdueSupplierDebt,
    customerDueDays: allowedCustDays,
    supplierDueDays: allowedSuppDays,
  };
}
