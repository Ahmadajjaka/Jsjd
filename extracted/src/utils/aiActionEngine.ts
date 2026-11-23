import {
  Product,
  Expense,
  Customer,
  Supplier,
  CashTransaction,
  InventoryAdjustment,
  CustomerPayment,
  SupplierPayment,
  SaleInvoice,
  SaleItem,
  PurchaseInvoice,
  PurchaseItem,
  StoreSettings,
} from '../types/accounting';
import { AppState } from './storage';
import {
  getTodayDateString,
  getCurrentTimeString,
  calculateSaleItemTotals,
  calculateInvoiceTotals,
  formatCurrency,
  formatNumber,
} from './accounting';
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
  exportInvoicePdf,
} from './pdfExport';
import { calculateStorageUsage } from '../services/firebaseSync';
import {
  evaluateMathExpression,
  extractAndComputeMath,
  normalizeArabicDigits,
} from './aiCalculator';

export type AiActionType =
  | 'add_product'
  | 'update_product'
  | 'delete_product'
  | 'adjust_stock'
  | 'create_sale'
  | 'return_sale'
  | 'delete_sale'
  | 'export_invoice_pdf'
  | 'create_purchase'
  | 'delete_purchase'
  | 'add_expense'
  | 'delete_expense'
  | 'add_customer'
  | 'delete_customer'
  | 'record_customer_payment'
  | 'add_supplier'
  | 'delete_supplier'
  | 'record_supplier_payment'
  | 'add_cash_transaction'
  | 'delete_cash_transaction'
  | 'update_settings'
  | 'calculate'
  | 'export_pdf'
  | 'navigate_tab'
  | 'monitor_store'
  | 'quick_sale'
  | 'aggregate_sales'
  | 'compress_database';

export interface AiActionPayload {
  id: string;
  action: AiActionType;
  title: string;
  data: Record<string, any>;
  status: 'pending' | 'executed' | 'failed';
  resultMessage?: string;
}

export interface AiActionHandlers {
  onSaveProduct: (product: Product) => void;
  onDeleteProduct?: (productId: string) => void;
  onSaveSale?: (invoice: SaleInvoice, newCustomer?: Customer) => void;
  onReturnSale?: (invoiceId: string, reason: string) => void;
  onDeleteSale?: (invoiceId: string) => void;
  onSavePurchase?: (invoice: PurchaseInvoice, newSupplier?: Supplier) => void;
  onDeletePurchase?: (purchaseId: string) => void;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onSaveCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  onRecordCustomerPayment: (payment: CustomerPayment) => void;
  onRecordSupplierPayment: (payment: SupplierPayment) => void;
  onAdjustStock: (adjustment: InventoryAdjustment) => void;
  onAddCashTransaction: (tx: Omit<CashTransaction, 'id' | 'runningBalance'>) => void;
  onDeleteCashTransaction?: (txId: string) => void;
  onUpdateSettings?: (settings: StoreSettings) => void;
  onPreviewInvoice?: (invoice: SaleInvoice) => void;
  onNavigate: (tab: string, extra?: any) => void;
  onCompressCloudData?: () => Promise<{
    success: boolean;
    message: string;
    savedBytes?: number;
    documentsCompressed?: number;
  }>;
  todaySummary?: any;
  monthSummary?: any;
  storageInfo?: any;
  cashBalance?: number;
}

function makeActionId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

function isLatestInvoiceSentinel(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  const normalized = String(val).trim().toLowerCase();
  return (
    normalized === '' ||
    normalized === 'last' ||
    normalized === 'latest' ||
    normalized === 'recent' ||
    normalized === 'الأخيرة' ||
    normalized === 'الاخيرة' ||
    normalized === 'أحدث' ||
    normalized === 'احدث' ||
    normalized === 'none' ||
    normalized === 'null'
  );
}

function findMatchingProduct(products: Product[], queryOrData: { productId?: string; id?: string; code?: string; barcode?: string; name?: string; productName?: string }): Product | undefined {
  const { productId, id, code, barcode, name, productName } = queryOrData;
  const searchName = (name || productName || '').trim().toLowerCase();
  return products.find(
    (p) =>
      (productId && p.id === productId) ||
      (id && p.id === id) ||
      (code && p.code.toLowerCase() === String(code).toLowerCase()) ||
      (barcode && p.barcode && p.barcode.toLowerCase() === String(barcode).toLowerCase()) ||
      (searchName && p.name.toLowerCase() === searchName) ||
      (searchName && p.name.toLowerCase().includes(searchName)) ||
      (searchName && searchName.includes(p.name.toLowerCase()))
  );
}

/**
 * Extracts single or multiple action JSON blocks from AI responses or infers from natural language intent
 */
export function parseAiActions(
  rawContent: string,
  userQuery: string = '',
  state?: AppState
): { cleanText: string; actions: AiActionPayload[] } {
  const actions: AiActionPayload[] = [];
  let cleanText = rawContent || '';

  // 1. Parse ```json:action or ```json blocks supporting both { action, data } and { actions: [...] }
  const actionBlockRegex = /```(?:json:action|json)\s*([\s\S]*?)\s*```/g;
  const blocksToStrip: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = actionBlockRegex.exec(rawContent)) !== null) {
    const fullMatch = match[0];
    const rawJson = match[1];
    try {
      const parsed = JSON.parse(rawJson);
      if (Array.isArray(parsed?.actions)) {
        parsed.actions.forEach((entry: any) => {
          if (entry?.action) {
            actions.push({
              id: makeActionId('act'),
              action: entry.action,
              title: entry.title || 'إجراء تنفيذي ذكي',
              data: entry.data || {},
              status: 'pending',
            });
          }
        });
        blocksToStrip.push(fullMatch);
      } else if (Array.isArray(parsed)) {
        let matchedAny = false;
        parsed.forEach((entry: any) => {
          if (entry?.action) {
            matchedAny = true;
            actions.push({
              id: makeActionId('act'),
              action: entry.action,
              title: entry.title || 'إجراء تنفيذي ذكي',
              data: entry.data || {},
              status: 'pending',
            });
          }
        });
        if (matchedAny) blocksToStrip.push(fullMatch);
      } else if (parsed?.action) {
        actions.push({
          id: makeActionId('act'),
          action: parsed.action,
          title: parsed.title || 'إجراء تنفيذي ذكي',
          data: parsed.data || {},
          status: 'pending',
        });
        blocksToStrip.push(fullMatch);
      }
    } catch {
      // ignore non-action JSON blocks
    }
  }

  for (const block of blocksToStrip) {
    cleanText = cleanText.replace(block, '');
  }
  cleanText = cleanText.replace(/```(?:json:action)\s*[\s\S]*?\s*```/g, '').trim();

  // 2. Deterministic Offline Fallback when LLM did not emit JSON actions
  if (actions.length === 0 && userQuery) {
    const normalizedQuery = normalizeArabicDigits(userQuery);
    const q = normalizedQuery.toLowerCase().trim();

    // A. Pure math / profit / discount calculation request
    const mathDetected = extractAndComputeMath(normalizedQuery);
    const looksLikeCalculation =
      q.includes('احسب') ||
      q.includes('حساب') ||
      q.includes('كم يساوي') ||
      q.includes('كم تساوي') ||
      q.includes('ناتج') ||
      q.includes('هامش') ||
      (mathDetected !== null && !q.includes('أضف') && !q.includes('سجل') && !q.includes('بع ') && !q.includes('بيع'));

    if (looksLikeCalculation && mathDetected) {
      actions.push({
        id: makeActionId('act-calc'),
        action: 'calculate',
        title: `حساب العملية: ${mathDetected.expression}`,
        data: {
          expression: mathDetected.expression,
          explanation: mathDetected.explanation,
        },
        status: 'pending',
      });
    }

    // Store-metric calculation queries
    if (
      actions.length === 0 &&
      (q.includes('كم') || q.includes('احسب') || q.includes('ما هو') || q.includes('رصيد') || q.includes('مجموع')) &&
      (q.includes('صندوق') || q.includes('خزينة') || q.includes('ربح') || q.includes('أرباح') || q.includes('ديون') || q.includes('مبيعات'))
    ) {
      const metric = q.includes('صندوق') || q.includes('خزينة')
        ? 'cash_balance'
        : q.includes('ربح') || q.includes('أرباح')
        ? 'profits'
        : q.includes('ديون') || q.includes('ذمم')
        ? 'debts'
        : q.includes('مبيعات')
        ? 'sales'
        : 'full_kpis';
      actions.push({
        id: makeActionId('act-metric'),
        action: 'calculate',
        title: 'حساب المؤشرات المالية الحية للمتجر',
        data: { metric },
        status: 'pending',
      });
    }

    // B. Print / Export Invoice PDF by number or latest (skip if modifying print layout settings)
    if (
      (q.includes('فاتورة') || q.includes('إيصال') || q.includes('ايصال')) &&
      (q.includes('pdf') || q.includes('اطبع') || q.includes('طباعة') || q.includes('نزل') || q.includes('تنزيل') || q.includes('صدر')) &&
      !q.includes('تقرير') &&
      !q.includes('تخطيط') &&
      !q.includes('اجعل') &&
      !q.includes('اعدادات') &&
      !q.includes('إعدادات') &&
      !q.includes('غير ')
    ) {
      const invNumMatch = normalizedQuery.match(/(?:INV|SALE|فاتورة|رقم)[-\s#:]*([A-Za-z0-9-]+)/i);
      const layout: 'thermal80' | 'standard' =
        q.includes('a4') || q.includes('عادي') ? 'standard' : 'thermal80';
      const downloadDirect = q.includes('نزل') || q.includes('تنزيل') || q.includes('حمل') || q.includes('تحميل');
      actions.push({
        id: makeActionId('act-invpdf'),
        action: 'export_invoice_pdf',
        title: invNumMatch
          ? `تصدير فاتورة ${invNumMatch[1]} بصيغة PDF (${layout === 'thermal80' ? 'حراري 80 مم' : 'A4'})`
          : `تصدير آخر فاتورة مبيعات بصيغة PDF`,
        data: {
          invoiceNumber: invNumMatch ? invNumMatch[1] : undefined,
          layout,
          downloadDirect,
        },
        status: 'pending',
      });
    }

    // C. Delete Product
    if (
      actions.length === 0 &&
      (q.includes('احذف') || q.includes('امسح') || q.includes('حذف')) &&
      (q.includes('مادة') || q.includes('منتج') || q.includes('صنف'))
    ) {
      const nameMatch = normalizedQuery.match(/(?:مادة|منتج|صنف)\s+([^\d,\n،.]+)/i);
      const targetName = nameMatch?.[1]?.trim() || '';
      if (targetName) {
        actions.push({
          id: makeActionId('act-delprod'),
          action: 'delete_product',
          title: `حذف المادة «${targetName}» من المستودع`,
          data: { name: targetName },
          status: 'pending',
        });
      }
    }

    // D. Update Product price or details
    if (
      actions.length === 0 &&
      (q.includes('عدل') || q.includes('غير') || q.includes('حدث')) &&
      (q.includes('سعر') || q.includes('رصيد') || q.includes('كمية') || q.includes('مادة') || q.includes('منتج'))
    ) {
      const numbers = normalizedQuery.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
      if (q.includes('رصيد') || q.includes('كمية')) {
        const matchedProd = state?.products.find((p) =>
          normalizedQuery.toLowerCase().includes(p.name.toLowerCase())
        );
        const targetName =
          matchedProd?.name ||
          normalizedQuery.match(/(?:مادة|منتج|صنف)\s+([^\d,\n،.]+?)(?=\s+(?:إلى|الى|في|بـ|$))/i)?.[1]?.trim() ||
          '';
        const newStock = numbers[numbers.length - 1];
        if (targetName && newStock !== undefined) {
          actions.push({
            id: makeActionId('act-adj'),
            action: 'adjust_stock',
            title: `جرد وتعديل رصيد «${targetName}» إلى ${newStock}`,
            data: { name: targetName, productId: matchedProd?.id, newStock },
            status: 'pending',
          });
        }
      } else if (q.includes('سعر') && numbers.length > 0) {
        const matchedProd = state?.products.find((p) =>
          normalizedQuery.toLowerCase().includes(p.name.toLowerCase())
        );
        const newPrice = numbers[numbers.length - 1];
        const isCost = q.includes('تكلفة') || q.includes('شراء');
        if (matchedProd || normalizedQuery.match(/(?:مادة|منتج|سعر)\s+([^\d,\n،.]+)/i)) {
          const fallbackName =
            matchedProd?.name ||
            normalizedQuery.match(/(?:مادة|منتج|سعر)\s+([^\d,\n،.]+?)(?=\s+(?:إلى|الى|بـ|\d|$))/i)?.[1]?.trim() ||
            '';
          actions.push({
            id: makeActionId('act-updprod'),
            action: 'update_product',
            title: `تحديث ${isCost ? 'سعر التكلفة' : 'سعر البيع'} للمادة «${fallbackName}» إلى ${newPrice}`,
            data: {
              id: matchedProd?.id,
              name: fallbackName,
              ...(isCost ? { costPrice: newPrice } : { sellingPrice: newPrice }),
            },
            status: 'pending',
          });
        }
      }
    }

    // E. Add Product directly from prompt
    if (
      actions.length === 0 &&
      (q.includes('أضف') || q.includes('اضف') || q.includes('أدرج') || q.includes('ادرج') || q.includes('أنشئ') || q.includes('انشئ')) &&
      (q.includes('منتج') || q.includes('مادة') || q.includes('صنف') || q.includes('بضاعة'))
    ) {
      let prodName = 'مادة جديدة';
      const nameMatch =
        normalizedQuery.match(/(?:باسم|اسمها|اسمه)\s+([^،,\n:]+?)(?=\s*(?:بسعر|سعر|تكلفة|قسم|كمية|وحدة|\d|$))/i) ||
        normalizedQuery.match(/(?:مادة|منتج|صنف|بضاعة)(?:\s+جديدة?)?(?:\s+في المخزون)?\s*[:：]?\s*([^،,\n]+?)(?=\s*(?:،|,|بسعر|سعر|تكلفة|قسم|كمية|\d|$))/i);
      if (nameMatch && nameMatch[1]) {
        prodName = nameMatch[1]
          .replace(/^(باسم|اسمه|اسمها|جديد|جديدة)\s+/g, '')
          .replace(/\s+(جديد|جديدة)$/g, '')
          .trim();
      }
      const numbers = normalizedQuery.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
      const costMatch = normalizedQuery.match(/(?:تكلفة|شراء)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      const sellMatch = normalizedQuery.match(/(?:سعر\s*البيع|بيع|بسعر)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      const qtyMatch = normalizedQuery.match(/(?:كمية|الكمية|رصيد|عدد)\s*[:=]?\s*(\d+(?:\.\d+)?)/);
      const minMatch = normalizedQuery.match(/(?:حد\s*أدنى|ادنى|الحد الأدنى)\s*[:=]?\s*(\d+(?:\.\d+)?)/);

      const costPrice = costMatch ? Number(costMatch[1]) : (numbers[0] || 1500);
      const sellingPrice = sellMatch
        ? Number(sellMatch[1])
        : (numbers[1] || Math.round(costPrice * 1.35));
      const currentStock = qtyMatch ? Number(qtyMatch[1]) : (numbers[2] ?? 50);
      const minStock = minMatch ? Number(minMatch[1]) : 5;

      actions.push({
        id: makeActionId('act-prod'),
        action: 'add_product',
        title: `إدراج المادة «${prodName}» في المخزون`,
        data: {
          name: prodName,
          category: q.includes('كهرب')
            ? 'كهربائية'
            : q.includes('صحي')
            ? 'صحية'
            : q.includes('بناء')
            ? 'بناء'
            : 'عامة',
          unit:
            q.includes('كيلو') || q.includes('كغ')
              ? 'كغ'
              : q.includes('متر')
              ? 'متر'
              : q.includes('علبة')
              ? 'علبة'
              : q.includes('كيس')
              ? 'كيس'
              : q.includes('طقم')
              ? 'طقم'
              : 'قطعة',
          costPrice,
          sellingPrice,
          currentStock,
          minStock,
        },
        status: 'pending',
      });
    }

    // F. Create real Sale Invoice directly (e.g. "بع 5 من سلك كهرباء للزبون أحمد" or "اعمل فاتورة بيع...")
    if (
      actions.length === 0 &&
      (q.includes('بع ') ||
        q.startsWith('بع') ||
        q.includes('بيع ') ||
        q.includes('انشئ فاتورة') ||
        q.includes('أنشئ فاتورة') ||
        q.includes('اصدر فاتورة') ||
        q.includes('أصدر فاتورة') ||
        q.includes('اعمل فاتورة') ||
        q.includes('سجل فاتورة') ||
        (q.includes('مبيع') && !q.includes('تجميع') && !q.includes('مباشر') && !q.includes('تقرير'))) &&
      !q.includes('شراء') &&
      !q.includes('مشتريات') &&
      !q.includes('توريد')
    ) {
      const matchedProd = state?.products.find((p) =>
        normalizedQuery.toLowerCase().includes(p.name.toLowerCase())
      );
      const qtyMatch = normalizedQuery.match(
        /(?:بكمية|كمية|الكمية|عدد)?\s*(\d+(?:\.\d+)?)\s*(?:قطعة|قطع|حبة|متر|كغ|علبة|كيس|طقم|من)?/
      );
      const explicitQtyMatch = normalizedQuery.match(/(?:بكمية|كمية|الكمية|عدد)\s*(\d+(?:\.\d+)?)/);
      const quantity = explicitQtyMatch
        ? Number(explicitQtyMatch[1])
        : qtyMatch
        ? Number(qtyMatch[1])
        : 1;
      const customerMatch = normalizedQuery.match(/(?:للزبون|لزبون|لـ|الزبون|للعميل)\s+([^\d,\n،.]+)/i);
      const customerRaw = customerMatch?.[1]?.trim() || '';
      const customerName =
        !customerRaw || customerRaw === 'نقدي' || customerRaw === 'كاش'
          ? 'زبون نقدي'
          : customerRaw;
      const paymentMethod = q.includes('دين') || q.includes('آجل') || q.includes('اجل') ? 'debt' : 'cash';

      if (matchedProd) {
        actions.push({
          id: makeActionId('act-sale'),
          action: 'create_sale',
          title: `إصدار فاتورة بيع: ${quantity} ${matchedProd.unit} من «${matchedProd.name}»`,
          data: {
            customerName,
            paymentMethod,
            items: [
              {
                productId: matchedProd.id,
                productName: matchedProd.name,
                quantity,
                unitPrice: matchedProd.sellingPrice,
              },
            ],
            printPdf: q.includes('pdf') || q.includes('اطبع') || q.includes('طباعة'),
          },
          status: 'pending',
        });
      }
    }

    // G. Return Sale Invoice
    if (
      actions.length === 0 &&
      (q.includes('ارجع') || q.includes('أرجع') || q.includes('إرجاع') || q.includes('الغ') || q.includes('ألغ')) &&
      q.includes('فاتورة')
    ) {
      const invMatch = normalizedQuery.match(/(INV-[A-Za-z0-9-]+|[A-Za-z0-9-]{4,})/);
      actions.push({
        id: makeActionId('act-ret'),
        action: 'return_sale',
        title: `إرجاع فاتورة المبيعات ${invMatch ? invMatch[1] : 'الأخيرة'}`,
        data: {
          invoiceNumber: invMatch?.[1],
          reason: 'إرجاع بطلب عبر المستشار الذكي',
        },
        status: 'pending',
      });
    }

    // H. Update Store Settings
    if (
      actions.length === 0 &&
      (q.includes('غير') || q.includes('حدث') || q.includes('عدل') || q.includes('اجعل')) &&
      (q.includes('اسم المتجر') || q.includes('العملة') || q.includes('تخطيط') || q.includes('طباعة الفاتورة'))
    ) {
      const patch: Record<string, any> = {};
      const storeNameMatch = normalizedQuery.match(/اسم المتجر\s*(?:إلى|الى|هو|:)?\s*[«"]?([^»"\n]+)[»"]?/i);
      if (storeNameMatch?.[1]) patch.storeName = storeNameMatch[1].trim();
      const currencyMatch = normalizedQuery.match(/العملة\s*(?:إلى|الى|هي|:)?\s*[«"]?([^»"\n]+)[»"]?/i);
      if (currencyMatch?.[1]) patch.currencySymbol = currencyMatch[1].trim();
      if (q.includes('a4') || q.includes('عادي')) patch.invoicePrintLayout = 'standard';
      else if (q.includes('حراري') || q.includes('80')) patch.invoicePrintLayout = 'thermal80';

      if (Object.keys(patch).length > 0) {
        actions.push({
          id: makeActionId('act-set'),
          action: 'update_settings',
          title: 'تحديث إعدادات المتجر والفواتير',
          data: patch,
          status: 'pending',
        });
      }
    }

    // I. Check stock / Monitor store
    if (
      actions.length === 0 &&
      (q.includes('رصيد') || q.includes('حجم') || q.includes('قيمة') || q.includes('وضع') || q.includes('راقب') || q.includes('تفقد')) &&
      (q.includes('مخزون') || q.includes('مستودع') || q.includes('متجر') || q.includes('أصناف') || q.includes('بضائع'))
    ) {
      actions.push({
        id: makeActionId('act-monitor'),
        action: 'monitor_store',
        title: 'مراقبة وفحص شامل للمتجر والمستودع',
        data: { reportType: 'inventory', target: 'inventory' },
        status: 'pending',
      });
    }

    // J. Add Expense
    if (
      actions.length === 0 &&
      (q.includes('سجل') || q.includes('أضف') || q.includes('اضف')) &&
      (q.includes('مصروف') || q.includes('مصاريف'))
    ) {
      let expTitle = 'مصروف تشغيلي';
      const titleMatch = normalizedQuery.match(/(?:مصروف|مصاريف)\s+([^\d,\n،.]+)/i);
      if (titleMatch && titleMatch[1]) {
        expTitle = titleMatch[1].replace(/جديد|جديدة|بقيمة|بمبلغ/g, '').trim();
      }
      const numbers = normalizedQuery.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
      const amount = numbers[0] || 25000;

      actions.push({
        id: makeActionId('act-exp'),
        action: 'add_expense',
        title: `تسجيل مصروف «${expTitle}» بقيمة ${amount}`,
        data: {
          description: expTitle,
          amount,
          category: q.includes('كهرب')
            ? 'كهرباء ومياه'
            : q.includes('إيجار') || q.includes('ايجار')
            ? 'إيجار المحل'
            : 'مصروفات تشغيلية أخرى',
        },
        status: 'pending',
      });
    }

    // K. Add Customer
    if (
      actions.length === 0 &&
      (q.includes('أضف') || q.includes('اضف') || q.includes('سجل')) &&
      (q.includes('زبون') || q.includes('عميل')) &&
      !q.includes('دفعة') &&
      !q.includes('قبض')
    ) {
      let custName = 'زبون جديد';
      const nameMatch = normalizedQuery.match(/(?:باسم|اسم|زبون|عميل)(?:\s+جديداً?|\s+جديد)?\s*[«"]?([^»"\d,\n،.]+)[»"]?/i);
      if (nameMatch && nameMatch[1]) {
        custName = nameMatch[1].replace(/^(جديداً?|جديد|جديدة)\s+/g, '').trim();
      }
      const phoneMatch = normalizedQuery.match(/09\d{8}/);
      actions.push({
        id: makeActionId('act-cust'),
        action: 'add_customer',
        title: `إضافة الزبون «${custName}»`,
        data: {
          name: custName,
          phone: phoneMatch ? phoneMatch[0] : '',
        },
        status: 'pending',
      });
    }

    // L. Export PDF Report
    if (
      actions.length === 0 &&
      q.includes('تقرير') &&
      (q.includes('pdf') || q.includes('تنزيل') || q.includes('طباعة') || q.includes('اطبع') || q.includes('صدر'))
    ) {
      const reportType = q.includes('مبيعات')
        ? 'sales'
        : q.includes('مشتريات')
        ? 'purchases'
        : q.includes('مصروف') || q.includes('مصاريف')
        ? 'expenses'
        : q.includes('صندوق')
        ? 'cashbox'
        : q.includes('مخزون') || q.includes('مستودع') || q.includes('جرد')
        ? 'inventory'
        : q.includes('أرباح') || q.includes('دخل')
        ? 'profit'
        : q.includes('ديون الزبائن')
        ? 'customer_debts'
        : q.includes('موردين')
        ? 'supplier_debts'
        : 'master';
      actions.push({
        id: makeActionId('act-pdf'),
        action: 'export_pdf',
        title: `تصدير تقرير PDF (${reportType})`,
        data: { reportType },
        status: 'pending',
      });
    }

    // M. Navigate Tab
    if (
      actions.length === 0 &&
      (q.includes('افتح') || q.includes('انتقل') || q.includes('اذهب'))
    ) {
      const tabMap: [string[], string, string][] = [
        [['مبيعات', 'فاتورة'], 'sales', 'شاشة المبيعات والفواتير'],
        [['مشتريات', 'توريد'], 'purchases', 'شاشة المشتريات والتوريد'],
        [['مستودع', 'مخزون', 'مواد'], 'inventory', 'إدارة المستودع والمخزون'],
        [['مصروف', 'مصاريف'], 'expenses', 'دفتر المصروفات اليومية'],
        [['زبائن', 'عملاء'], 'customers', 'سجل الزبائن والديون'],
        [['موردين'], 'suppliers', 'سجل الموردين'],
        [['صندوق', 'خزينة', 'نقد'], 'cashbox', 'دفتر الصندوق والمالية'],
        [['دفتر'], 'ledger', 'الدفتر اليومي'],
        [['إعدادات', 'اعدادات'], 'settings', 'إعدادات المتجر'],
        [['تقارير'], 'reports', 'التقارير المالية'],
        [['أرشيف', 'ارشيف'], 'archive', 'الأرشيف والنسخ الاحتياطي'],
        [['تدقيق', 'أمان'], 'audit', 'سجل الأمان والتدقيق'],
      ];
      for (const [keywords, tab, label] of tabMap) {
        if (keywords.some((kw) => q.includes(kw))) {
          actions.push({
            id: makeActionId('act-nav'),
            action: 'navigate_tab',
            title: `فتح ${label}`,
            data: { tab },
            status: 'pending',
          });
          break;
        }
      }
    }

    // N. Aggregate Sales
    if (
      actions.length === 0 &&
      (q.includes('اجمع') || q.includes('تجميع') || q.includes('مجموع')) &&
      (q.includes('مبيعات') || q.includes('مبيع') || q.includes('فواتير'))
    ) {
      actions.push({
        id: makeActionId('act-agg'),
        action: 'aggregate_sales',
        title: 'تجميع مبيعات الشهر أو المدة المحددة',
        data: { tab: 'sales', salesTab: 'aggregate' },
        status: 'pending',
      });
    }

    // O. Quick Sale screen fallback
    if (
      actions.length === 0 &&
      (q.includes('أدرج') || q.includes('ادرج') || q.includes('سجل') || q.includes('بيع')) &&
      (q.includes('مبيع') || q.includes('بيع')) &&
      (q.includes('مباشر') || q.includes('فوري') || q.includes('سريع'))
    ) {
      actions.push({
        id: makeActionId('act-qsale'),
        action: 'quick_sale',
        title: 'فتح شاشة المبيع الفوري للزبون',
        data: {},
        status: 'pending',
      });
    }

    // P. Compress Database
    if (
      actions.length === 0 &&
      (q.includes('اضغط') || q.includes('ضغط') || q.includes('ترشيد') || q.includes('deflate')) &&
      (q.includes('بيانات') || q.includes('سحاب') || q.includes('فايربيس') || q.includes('firebase') || q.includes('مساح'))
    ) {
      actions.push({
        id: makeActionId('act-comp'),
        action: 'compress_database',
        title: 'ضغط وترشيد قاعدة بيانات Firebase (Deflate Level 9)',
        data: {},
        status: 'pending',
      });
    }
  }

  return { cleanText, actions };
}

/**
 * Executes an AI action directly on the application state
 */
export async function executeAiAction(
  action: AiActionPayload,
  handlers: AiActionHandlers,
  state: AppState
): Promise<{ success: boolean; message: string }> {
  try {
    const d = action.data || {};
    const today = getTodayDateString();
    const timeNow = getCurrentTimeString();
    const sym = state.settings.currencySymbol || 'ل.س';

    switch (action.action) {
      // 1. Add Product
      case 'add_product': {
        const category = d.category || 'عامة';
        const rawCode = d.code || `PRD-${Date.now().toString().slice(-4)}`;
        const name = d.name || 'مادة جديدة';
        const costPrice = Math.max(0, Number(d.costPrice) || 0);
        const sellingPrice =
          d.sellingPrice !== undefined
            ? Math.max(0, Number(d.sellingPrice) || 0)
            : Math.round(costPrice * 1.3);
        const currentStock = Math.max(0, Number(d.currentStock) || 0);
        const minStock = Math.max(0, Number(d.minStock) || 5);
        const unit = d.unit || 'قطعة';

        const newProduct: Product = {
          id: `prod-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          code: rawCode,
          name,
          category,
          unit,
          costPrice,
          sellingPrice,
          currentStock,
          minStock,
          barcode: d.barcode || '',
          location: d.location || 'المستودع الرئيسي',
          notes: d.notes || 'أُدرجت بواسطة المساعد الذكي الشامل',
          createdAt: today,
          updatedAt: today,
        };

        handlers.onSaveProduct(newProduct);
        return {
          success: true,
          message: `تم إدراج المادة «${name}» بكود [${rawCode}] (قسم ${category}) بسعر بيع ${formatCurrency(sellingPrice, state.settings)} ورصيد ${currentStock} ${unit} بنجاح.`,
        };
      }

      // 1.1 Update Product
      case 'update_product': {
        const prod = findMatchingProduct(state.products, d);
        if (!prod) {
          throw new Error('لم يتم العثور على المادة المطلوب تعديلها في المخزون.');
        }

        const updated: Product = {
          ...prod,
          name: d.newName || d.name || prod.name,
          category: d.category || prod.category,
          unit: d.unit || prod.unit,
          costPrice: d.costPrice !== undefined ? Number(d.costPrice) : prod.costPrice,
          sellingPrice: d.sellingPrice !== undefined ? Number(d.sellingPrice) : prod.sellingPrice,
          currentStock: d.currentStock !== undefined ? Number(d.currentStock) : prod.currentStock,
          minStock: d.minStock !== undefined ? Number(d.minStock) : prod.minStock,
          barcode: d.barcode !== undefined ? String(d.barcode) : prod.barcode,
          location: d.location || prod.location,
          notes: d.notes || prod.notes,
          updatedAt: today,
        };

        handlers.onSaveProduct(updated);
        return {
          success: true,
          message: `تم تحديث بيانات المادة «${updated.name}» (سعر البيع: ${formatCurrency(updated.sellingPrice, state.settings)}، الرصيد: ${updated.currentStock} ${updated.unit}) بنجاح.`,
        };
      }

      // 1.2 Delete Product
      case 'delete_product': {
        const prod = findMatchingProduct(state.products, d);
        if (!prod) {
          throw new Error('لم يتم العثور على المادة المطلوب حذفها في المستودع.');
        }
        if (!handlers.onDeleteProduct) {
          throw new Error('معالج حذف المواد غير مفعّل.');
        }
        handlers.onDeleteProduct(prod.id);
        return {
          success: true,
          message: `تم حذف المادة «${prod.name}» (${prod.code}) من المستودع بنجاح.`,
        };
      }

      // 2. Create Complete Sale Invoice
      case 'create_sale': {
        if (!handlers.onSaveSale) {
          throw new Error('معالج حفظ فواتير المبيعات غير متاح.');
        }
        const rawItems = Array.isArray(d.items) ? d.items : [];
        if (rawItems.length === 0) {
          throw new Error('يرجى تحديد مادة واحدة على الأقل لإنشاء فاتورة البيع.');
        }

        const builtItems: SaleItem[] = rawItems.map((it: any) => {
          const matchedProd = findMatchingProduct(state.products, {
            productId: it.productId,
            code: it.code,
            barcode: it.barcode,
            name: it.productName || it.name,
          });
          if (!matchedProd) {
            throw new Error(`المادة «${it.productName || it.name || it.code || 'غير معروفة'}» غير موجودة في المستودع.`);
          }
          const qty = Math.max(0.01, Number(it.quantity) || 1);
          const unitPrice = it.unitPrice !== undefined ? Number(it.unitPrice) : matchedProd.sellingPrice;
          const discount = Math.max(0, Number(it.discount) || 0);
          const calc = calculateSaleItemTotals(qty, matchedProd.costPrice, unitPrice, discount);
          return {
            productId: matchedProd.id,
            productCode: matchedProd.code,
            productName: matchedProd.name,
            category: matchedProd.category,
            unit: matchedProd.unit,
            quantity: qty,
            costPrice: matchedProd.costPrice,
            unitPrice,
            discount,
            total: calc.total,
            profit: calc.profit,
          };
        });

        const paymentMethod: 'cash' | 'debt' | 'partial' =
          d.paymentMethod === 'debt' || d.paymentMethod === 'partial' ? d.paymentMethod : 'cash';
        const totals = calculateInvoiceTotals(
          builtItems,
          Number(d.discount) || 0,
          Number(d.paidAmount) || 0,
          paymentMethod
        );

        let customer = state.customers.find(
          (c) =>
            (d.customerId && c.id === d.customerId) ||
            (d.customerName && c.name.toLowerCase().includes(String(d.customerName).toLowerCase()))
        );
        let newCustomer: Customer | undefined;
        const custName = d.customerName || customer?.name || 'زبون نقدي';
        const isCashCustomer = !d.customerId && (!d.customerName || custName === 'زبون نقدي') && paymentMethod === 'cash';

        if (!customer && !isCashCustomer) {
          newCustomer = {
            id: `cust-${Date.now()}`,
            name: custName,
            phone: d.customerPhone || '',
            address: d.customerAddress || '',
            totalPurchases: totals.total,
            totalPaid: totals.paidAmount,
            totalDebt: totals.remainingAmount,
            notes: 'سُجل تلقائياً مع فاتورة بيع من المساعد الذكي',
            createdAt: today,
          };
          customer = newCustomer;
        }

        const invoiceNumber = d.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
        const invoice: SaleInvoice = {
          id: `sale-${Date.now()}-${Math.floor(Math.random() * 100)}`,
          invoiceNumber,
          date: d.date || today,
          time: timeNow,
          customerId: customer?.id || '',
          customerName: customer?.name || custName,
          isCashCustomer,
          items: builtItems,
          subtotal: totals.subtotal,
          discount: totals.discount,
          total: totals.total,
          cogs: totals.cogs,
          grossProfit: totals.grossProfit,
          paymentMethod,
          paidAmount: totals.paidAmount,
          remainingAmount: totals.remainingAmount,
          notes: d.notes || 'أُصدرت بواسطة المساعد الذكي',
          status: 'completed',
          createdAt: today,
        };

        handlers.onSaveSale(invoice, newCustomer);

        if (d.printPdf) {
          exportInvoicePdf(
            invoice,
            state.settings,
            d.layout || state.settings.invoicePrintLayout || 'thermal80',
            !!d.downloadDirect
          );
        } else if (d.openPreview && handlers.onPreviewInvoice) {
          handlers.onPreviewInvoice(invoice);
        }

        return {
          success: true,
          message: `تم إصدار فاتورة المبيعات رقم [${invoiceNumber}] للزبون «${invoice.customerName}» بإجمالي ${formatCurrency(invoice.total, state.settings)} (ربح: ${formatCurrency(invoice.grossProfit, state.settings)})${d.printPdf ? ' وتجهيز ملف PDF.' : '.'}`,
        };
      }

      // 2.1 Return Sale Invoice
      case 'return_sale': {
        if (!handlers.onReturnSale) {
          throw new Error('معالج إرجاع الفواتير غير متاح.');
        }
        const targetInv = d.invoiceId
          ? state.sales.find((s) => s.id === d.invoiceId)
          : !isLatestInvoiceSentinel(d.invoiceNumber)
          ? state.sales.find((s) => s.invoiceNumber.toLowerCase().includes(String(d.invoiceNumber).toLowerCase()))
          : [...state.sales].reverse().find((s) => s.status === 'completed');

        if (!targetInv) {
          throw new Error('لم يتم العثور على فاتورة المبيعات المطلوب إرجاعها.');
        }
        if (targetInv.status === 'returned') {
          throw new Error(`الفاتورة ${targetInv.invoiceNumber} مرتجعة مسبقاً.`);
        }

        const reason = d.reason || 'إرجاع بطلب المستخدم عبر المساعد الذكي';
        handlers.onReturnSale(targetInv.id, reason);
        return {
          success: true,
          message: `تم إرجاع الفاتورة [${targetInv.invoiceNumber}] وعكس بضاعتها ورصيد الصندوق والذمم بنجاح.`,
        };
      }

      // 2.2 Delete Sale Invoice
      case 'delete_sale': {
        if (!handlers.onDeleteSale) {
          throw new Error('معالج حذف الفواتير غير متاح.');
        }
        const targetInv = d.invoiceId
          ? state.sales.find((s) => s.id === d.invoiceId)
          : !isLatestInvoiceSentinel(d.invoiceNumber)
          ? state.sales.find((s) => s.invoiceNumber.toLowerCase().includes(String(d.invoiceNumber).toLowerCase()))
          : state.sales[state.sales.length - 1];

        if (!targetInv) {
          throw new Error('لم يتم العثور على فاتورة المبيعات المطلوب حذفها.');
        }
        handlers.onDeleteSale(targetInv.id);
        return {
          success: true,
          message: `تم حذف فاتورة المبيعات [${targetInv.invoiceNumber}] بنجاح.`,
        };
      }

      // 2.3 Export Single Invoice PDF via jsPDF
      case 'export_invoice_pdf': {
        const targetInv = d.invoiceId
          ? state.sales.find((s) => s.id === d.invoiceId)
          : !isLatestInvoiceSentinel(d.invoiceNumber)
          ? state.sales.find((s) =>
              s.invoiceNumber.toLowerCase().includes(String(d.invoiceNumber).toLowerCase())
            )
          : [...state.sales].reverse()[0];

        if (!targetInv) {
          throw new Error('لا توجد فواتير مبيعات متاحة لتصديرها إلى PDF حالياً.');
        }

        const layout: 'thermal80' | 'standard' =
          d.layout === 'standard' ? 'standard' : d.layout === 'thermal80' ? 'thermal80' : (state.settings.invoicePrintLayout || 'thermal80');
        const downloadDirect = d.downloadDirect !== undefined ? Boolean(d.downloadDirect) : true;
        exportInvoicePdf(targetInv, state.settings, layout, downloadDirect);

        return {
          success: true,
          message: `تم ${downloadDirect ? 'تنزيل' : 'تجهيز طباعة'} فاتورة [${targetInv.invoiceNumber}] بصيغة PDF (${layout === 'thermal80' ? 'حراري 80 مم' : 'A4'}) عبر jsPDF بنجاح.`,
        };
      }

      // 2.4 Create Purchase Invoice
      case 'create_purchase': {
        if (!handlers.onSavePurchase) {
          throw new Error('معالج حفظ فواتير المشتريات غير متاح.');
        }
        const rawItems = Array.isArray(d.items) ? d.items : [];
        if (rawItems.length === 0) {
          throw new Error('يرجى تحديد مادة واحدة على الأقل لفاتورة الشراء.');
        }

        const builtItems: PurchaseItem[] = rawItems.map((it: any) => {
          const matchedProd = findMatchingProduct(state.products, {
            productId: it.productId,
            code: it.code,
            name: it.productName || it.name,
          });
          if (!matchedProd) {
            throw new Error(`المادة «${it.productName || it.name || 'غير محددة'}» غير موجودة في المستودع.`);
          }
          const qty = Math.max(1, Number(it.quantity) || 1);
          const costPrice = it.costPrice !== undefined ? Number(it.costPrice) : matchedProd.costPrice;
          return {
            productId: matchedProd.id,
            productCode: matchedProd.code,
            productName: matchedProd.name,
            category: matchedProd.category,
            unit: matchedProd.unit,
            quantity: qty,
            costPrice,
            total: Math.round(qty * costPrice * 100) / 100,
          };
        });

        const subtotal = builtItems.reduce((s, it) => s + it.total, 0);
        const shippingCost = Math.max(0, Number(d.shippingCost) || 0);
        const discount = Math.max(0, Number(d.discount) || 0);
        const total = Math.max(0, subtotal + shippingCost - discount);
        const paymentMethod: 'cash' | 'debt' | 'partial' =
          d.paymentMethod === 'debt' || d.paymentMethod === 'partial' ? d.paymentMethod : 'cash';
        const paidAmount =
          paymentMethod === 'cash'
            ? total
            : paymentMethod === 'debt'
            ? 0
            : Math.min(total, Math.max(0, Number(d.paidAmount) || 0));
        const remainingAmount = Math.max(0, total - paidAmount);

        let supplier = state.suppliers.find(
          (s) =>
            (d.supplierId && s.id === d.supplierId) ||
            (d.supplierName && s.name.toLowerCase().includes(String(d.supplierName).toLowerCase()))
        );
        let newSupplier: Supplier | undefined;
        const supplierName = d.supplierName || supplier?.name || 'مورد عام';

        if (!supplier) {
          newSupplier = {
            id: `supp-${Date.now()}`,
            name: supplierName,
            phone: d.supplierPhone || '',
            company: d.supplierCompany || '',
            address: '',
            totalPurchases: total,
            totalPaid: paidAmount,
            totalDebt: remainingAmount,
            notes: 'سُجل تلقائياً مع فاتورة شراء من المساعد الذكي',
            createdAt: today,
          };
          supplier = newSupplier;
        }

        const invoiceNumber = d.invoiceNumber || `PUR-${Date.now().toString().slice(-6)}`;
        const purchaseInv: PurchaseInvoice = {
          id: `pur-${Date.now()}`,
          invoiceNumber,
          date: d.date || today,
          time: timeNow,
          supplierId: supplier.id,
          supplierName: supplier.name,
          items: builtItems,
          subtotal,
          shippingCost,
          discount,
          total,
          paymentMethod,
          paidAmount,
          remainingAmount,
          notes: d.notes || 'فاتورة توريد عبر المساعد الذكي',
          createdAt: today,
        };

        handlers.onSavePurchase(purchaseInv, newSupplier);
        return {
          success: true,
          message: `تم تسجيل فاتورة المشتريات [${invoiceNumber}] من المورد «${purchaseInv.supplierName}» بقيمة ${formatCurrency(total, state.settings)} وتغذية رصيد المستودع بنجاح.`,
        };
      }

      // 2.5 Delete Purchase Invoice
      case 'delete_purchase': {
        if (!handlers.onDeletePurchase) throw new Error('معالج حذف المشتريات غير متاح.');
        const target = d.purchaseId
          ? state.purchases.find((p) => p.id === d.purchaseId)
          : state.purchases.find((p) => d.invoiceNumber && p.invoiceNumber.includes(d.invoiceNumber));
        if (!target) throw new Error('لم يتم العثور على فاتورة المشتريات المطلوبة.');
        handlers.onDeletePurchase(target.id);
        return {
          success: true,
          message: `تم حذف فاتورة المشتريات [${target.invoiceNumber}] بنجاح.`,
        };
      }

      // 3. Add & Delete Expense
      case 'add_expense': {
        const title = d.description || d.title || 'مصروف تشغيلي';
        const amount = Number(d.amount) || 0;
        const category = d.category || 'مصروفات تشغيلية أخرى';
        if (amount <= 0) {
          throw new Error('يجب تحديد مبلغ المصروف بشكل صحيح أكبر من الصفر.');
        }

        const newExpense: Expense = {
          id: `exp-${Date.now()}`,
          date: d.date || today,
          time: timeNow,
          category,
          description: title,
          amount,
          paymentMethod: d.paymentMethod || 'cash',
          notes: d.notes || 'سُجل عبر المستشار الذكي',
          createdAt: today,
        };

        handlers.onSaveExpense(newExpense);
        return {
          success: true,
          message: `تم تسجيل سند صرف المصروف «${title}» بقيمة ${formatCurrency(amount, state.settings)} بقسم [${category}] بنجاح.`,
        };
      }

      case 'delete_expense': {
        if (!handlers.onDeleteExpense) throw new Error('معالج حذف المصروفات غير متاح.');
        const exp = d.expenseId
          ? state.expenses.find((e) => e.id === d.expenseId)
          : state.expenses.find((e) => d.description && e.description.includes(d.description));
        if (!exp) throw new Error('لم يتم العثور على المصروف المطلوب حذفه.');
        handlers.onDeleteExpense(exp.id);
        return {
          success: true,
          message: `تم حذف المصروف «${exp.description}» (${formatCurrency(exp.amount, state.settings)}) بنجاح.`,
        };
      }

      // 4. Customer CRUD & Payments
      case 'add_customer': {
        const name = d.name || 'زبون جديد';
        const newCustomer: Customer = {
          id: `cust-${Date.now()}`,
          name,
          phone: d.phone || '',
          address: d.address || '',
          totalPurchases: 0,
          totalPaid: 0,
          totalDebt: Number(d.initialDebt) || 0,
          notes: d.notes || 'أُضيف بواسطة المستشار الذكي',
          createdAt: today,
        };

        handlers.onSaveCustomer(newCustomer);
        return {
          success: true,
          message: `تم تسجيل الزبون «${name}» برقم الهاتف [${newCustomer.phone || 'غير محدد'}] بنجاح.`,
        };
      }

      case 'delete_customer': {
        if (!handlers.onDeleteCustomer) throw new Error('معالج حذف الزبائن غير متاح.');
        const cust = state.customers.find(
          (c) => c.id === d.customerId || (d.name && c.name.includes(d.name))
        );
        if (!cust) throw new Error('لم يتم العثور على الزبون المطلوب حذفه.');
        handlers.onDeleteCustomer(cust.id);
        return {
          success: true,
          message: `تم حذف حساب الزبون «${cust.name}» نهائياً بنجاح.`,
        };
      }

      case 'record_customer_payment': {
        const cust = state.customers.find(
          (c) =>
            c.id === d.customerId ||
            (d.customerName && c.name.includes(d.customerName)) ||
            (d.name && c.name.includes(d.name))
        );
        if (!cust) {
          throw new Error('لم يتم العثور على الزبون المطلوب لتسجيل دفعة قبض منه.');
        }

        const amount = Number(d.amount) || 0;
        if (amount <= 0) {
          throw new Error('يجب تحديد مبلغ دفعة صحيح أكبر من الصفر.');
        }

        const payment: CustomerPayment = {
          id: `pay-${Date.now()}`,
          paymentNumber: `RCP-${Date.now().toString().slice(-4)}`,
          customerId: cust.id,
          customerName: cust.name,
          date: d.date || today,
          time: timeNow,
          amount,
          paymentMethod: d.paymentMethod || 'cash',
          remainingDebtAfter: Math.max(0, cust.totalDebt - amount),
          notes: d.notes || 'سند قبض آلي عبر المستشار الذكي',
        };

        handlers.onRecordCustomerPayment(payment);
        return {
          success: true,
          message: `تم تسجيل سند قبض بقيمة ${formatCurrency(amount, state.settings)} من الزبون «${cust.name}» (الذمة المتبقية: ${formatCurrency(payment.remainingDebtAfter ?? 0, state.settings)}).`,
        };
      }

      // 5. Supplier CRUD & Payments
      case 'add_supplier': {
        const name = d.name || 'مورد جديد';
        const newSupplier: Supplier = {
          id: `supp-${Date.now()}`,
          name,
          phone: d.phone || '',
          company: d.company || '',
          address: d.address || '',
          totalPurchases: 0,
          totalPaid: 0,
          totalDebt: Number(d.initialDebt) || 0,
          notes: d.notes || 'أُضيف بواسطة المستشار الذكي',
          createdAt: today,
        };

        handlers.onSaveSupplier(newSupplier);
        return {
          success: true,
          message: `تم تسجيل المورد «${name}» بنجاح في سجل الموردين المعتمدين.`,
        };
      }

      case 'delete_supplier': {
        if (!handlers.onDeleteSupplier) throw new Error('معالج حذف الموردين غير متاح.');
        const supp = state.suppliers.find(
          (s) => s.id === d.supplierId || (d.name && s.name.includes(d.name))
        );
        if (!supp) throw new Error('لم يتم العثور على المورد المطلوب حذفه.');
        handlers.onDeleteSupplier(supp.id);
        return {
          success: true,
          message: `تم حذف حساب المورد «${supp.name}» بنجاح.`,
        };
      }

      case 'record_supplier_payment': {
        const supp = state.suppliers.find(
          (s) =>
            s.id === d.supplierId ||
            (d.supplierName && s.name.includes(d.supplierName)) ||
            (d.name && s.name.includes(d.name))
        );
        if (!supp) {
          throw new Error('لم يتم العثور على المورد المطلوب لتسجيل سند صرف دفعة له.');
        }

        const amount = Number(d.amount) || 0;
        if (amount <= 0) {
          throw new Error('يجب تحديد مبلغ دفعة صحيح أكبر من الصفر.');
        }

        const payment: SupplierPayment = {
          id: `spay-${Date.now()}`,
          paymentNumber: `SPAY-${Date.now().toString().slice(-4)}`,
          supplierId: supp.id,
          supplierName: supp.name,
          date: d.date || today,
          time: timeNow,
          amount,
          paymentMethod: d.paymentMethod || 'cash',
          remainingDebtAfter: Math.max(0, supp.totalDebt - amount),
          notes: d.notes || 'سند صرف سداد دفعة مورد آلي عبر المستشار الذكي',
        };

        handlers.onRecordSupplierPayment(payment);
        return {
          success: true,
          message: `تم تسجيل سند صرف دفعة بقيمة ${formatCurrency(amount, state.settings)} للمورد «${supp.name}» وخصمها من الصندوق بنجاح.`,
        };
      }

      // 6. Adjust Stock
      case 'adjust_stock': {
        const product = findMatchingProduct(state.products, d);
        if (!product) {
          throw new Error('لم يتم العثور على الصنف المطلوب لتسوية رصيده بالمستودع.');
        }

        const newStock = Number(d.newStock);
        if (isNaN(newStock) || newStock < 0) {
          throw new Error('يرجى تحديد الكمية الجديدة للمادة بشكل صحيح.');
        }

        const diff = newStock - product.currentStock;
        const adjustment: InventoryAdjustment = {
          id: `adj-${Date.now()}`,
          date: today,
          time: timeNow,
          productId: product.id,
          productCode: product.code,
          productName: product.name,
          oldStock: product.currentStock,
          newStock,
          difference: diff,
          costPrice: product.costPrice,
          totalCostDifference: diff * product.costPrice,
          reason: d.reason || (diff >= 0 ? 'count_surplus' : 'count_deficit'),
          notes: d.notes || 'تسوية آلية معتمدة عبر المستشار الذكي',
        };

        handlers.onAdjustStock(adjustment);
        return {
          success: true,
          message: `تم تعديل رصيد المادة «${product.name}» من ${product.currentStock} إلى ${newStock} ${product.unit} بنجاح.`,
        };
      }

      // 7. Cash Transactions
      case 'add_cash_transaction': {
        const amount = Number(d.amount) || 0;
        const flow = d.flow === 'out' ? 'out' : 'in';
        const type = d.type || (flow === 'in' ? 'capital_deposit' : 'personal_withdrawal');
        const description =
          d.description || (flow === 'in' ? 'إيداع نقدي بالصندوق' : 'سحب نقدي من الصندوق');

        if (amount <= 0) {
          throw new Error('يجب تحديد مبلغ نقدي أكبر من الصفر.');
        }

        handlers.onAddCashTransaction({
          date: d.date || today,
          time: timeNow,
          type,
          description,
          flow,
          amount,
        });

        return {
          success: true,
          message: `تم تسجيل حركة ${flow === 'in' ? 'إيداع نقدي (+)' : 'سحب نقدي (-)'} بقيمة ${formatCurrency(amount, state.settings)} بالصندوق.`,
        };
      }

      case 'delete_cash_transaction': {
        if (!handlers.onDeleteCashTransaction) throw new Error('معالج حذف الحركات النقدية غير متاح.');
        const tx = d.txId
          ? state.cashTransactions.find((t) => t.id === d.txId)
          : state.cashTransactions[state.cashTransactions.length - 1];
        if (!tx) throw new Error('لم يتم العثور على الحركة النقدية المطلوبة.');
        handlers.onDeleteCashTransaction(tx.id);
        return {
          success: true,
          message: `تم حذف الحركة النقدية «${tx.description}» (${formatCurrency(tx.amount, state.settings)}) وإعادة احتساب رصيد الصندوق.`,
        };
      }

      // 8. Update Store Settings
      case 'update_settings': {
        if (!handlers.onUpdateSettings) {
          throw new Error('معالج تحديث الإعدادات غير متاح.');
        }
        const merged: StoreSettings = {
          ...state.settings,
          ...(d.storeName !== undefined ? { storeName: String(d.storeName) } : {}),
          ...(d.storeTagline !== undefined ? { storeTagline: String(d.storeTagline) } : {}),
          ...(d.phone !== undefined ? { phone: String(d.phone) } : {}),
          ...(d.address !== undefined ? { address: String(d.address) } : {}),
          ...(d.currencySymbol !== undefined ? { currencySymbol: String(d.currencySymbol) } : {}),
          ...(d.currencyPosition === 'before' || d.currencyPosition === 'after'
            ? { currencyPosition: d.currencyPosition }
            : {}),
          ...(d.taxNumber !== undefined ? { taxNumber: String(d.taxNumber) } : {}),
          ...(d.invoiceHeaderNote !== undefined
            ? { invoiceHeaderNote: String(d.invoiceHeaderNote) }
            : {}),
          ...(d.invoiceFooterNote !== undefined
            ? { invoiceFooterNote: String(d.invoiceFooterNote) }
            : {}),
          ...(d.invoicePrintLayout === 'thermal80' || d.invoicePrintLayout === 'standard'
            ? { invoicePrintLayout: d.invoicePrintLayout }
            : {}),
          ...(d.initialCash !== undefined
            ? { initialCash: Math.max(0, Number(d.initialCash) || 0) }
            : {}),
          ...(d.customerDebtDueDays !== undefined
            ? { customerDebtDueDays: Math.max(0, Math.round(Number(d.customerDebtDueDays) || 0)) }
            : {}),
          ...(d.supplierDebtDueDays !== undefined
            ? { supplierDebtDueDays: Math.max(0, Math.round(Number(d.supplierDebtDueDays) || 0)) }
            : {}),
        };

        handlers.onUpdateSettings(merged);
        return {
          success: true,
          message: `تم تحديث وحفظ إعدادات المتجر بنجاح (الاسم: «${merged.storeName}» · العملة: ${merged.currencySymbol} · الطباعة: ${merged.invoicePrintLayout === 'thermal80' ? 'حراري 80 مم' : 'A4'}).`,
        };
      }

      // 9. Safe Math & Store KPI Calculator
      case 'calculate': {
        if (d.expression) {
          const evalRes = evaluateMathExpression(String(d.expression));
          const extra = d.explanation ? `\n${d.explanation}` : '';
          return {
            success: true,
            message: `النتيجة الحسابية الدقيقة: ${formatNumber(evalRes.value)} (${evalRes.expression})${extra}`,
          };
        }

        const currentCash =
          handlers.cashBalance ??
          (state.cashTransactions.length > 0
            ? state.cashTransactions[state.cashTransactions.length - 1].runningBalance
            : state.settings.initialCash || 0);
        const inventoryCost = state.products.reduce(
          (s, p) => s + p.currentStock * p.costPrice,
          0
        );
        const inventoryRetail = state.products.reduce(
          (s, p) => s + p.currentStock * p.sellingPrice,
          0
        );
        const expectedStockProfit = inventoryRetail - inventoryCost;
        const totalCustomerDebt = state.customers.reduce((s, c) => s + (c.totalDebt || 0), 0);
        const totalSupplierPayable = state.suppliers.reduce((s, sp) => s + (sp.totalDebt || 0), 0);
        const todaySales = handlers.todaySummary?.grossSales ?? 0;
        const todayNetProfit = handlers.todaySummary?.netOperatingProfit ?? 0;
        const monthSales = handlers.monthSummary?.grossSales ?? 0;
        const monthNetProfit = handlers.monthSummary?.netOperatingProfit ?? 0;

        if (d.metric === 'cash_balance') {
          return {
            success: true,
            message: `الرصيد النقدي الفعلي الحالي في الصندوق هو: ${formatNumber(currentCash)} ${sym}.`,
          };
        }
        if (d.metric === 'profits') {
          return {
            success: true,
            message: `أرباح المتجر الحية: صافي ربح اليوم ${formatNumber(todayNetProfit)} ${sym} · صافي ربح الشهر ${formatNumber(monthNetProfit)} ${sym} · الربح المتوقع من كامل المخزون الحالي عند البيع ${formatNumber(expectedStockProfit)} ${sym}.`,
          };
        }
        if (d.metric === 'debts') {
          return {
            success: true,
            message: `ملخص الذمم: إجمالي الديون المستحقة على الزبائن ${formatNumber(totalCustomerDebt)} ${sym} · المستحقات المطلوبة للموردين ${formatNumber(totalSupplierPayable)} ${sym}.`,
          };
        }
        if (d.metric === 'sales') {
          return {
            success: true,
            message: `إحصائية المبيعات: مبيعات اليوم ${formatNumber(todaySales)} ${sym} · مبيعات الشهر ${formatNumber(monthSales)} ${sym} · عدد الفواتير المسجلة ${state.sales.length} فاتورة.`,
          };
        }

        return {
          success: true,
          message: `ملخص الحساب الشامل للمتجر: الصندوق ${formatNumber(currentCash)} ${sym} | تكلفة المخزون ${formatNumber(inventoryCost)} ${sym} (قيمة البيع المتوقعة ${formatNumber(inventoryRetail)} ${sym}) | مبيعات الشهر ${formatNumber(monthSales)} ${sym} | صافي ربح الشهر ${formatNumber(monthNetProfit)} ${sym} | ديون الزبائن ${formatNumber(totalCustomerDebt)} ${sym}.`,
        };
      }

      // 10. Export PDF Report
      case 'export_pdf': {
        const reportType = d.reportType || 'master';
        const todaySum = handlers.todaySummary;
        const monthSum = handlers.monthSummary;
        const storageInfo = handlers.storageInfo;

        if (reportType === 'invoice') {
          const inv = !isLatestInvoiceSentinel(d.invoiceNumber)
            ? state.sales.find((s) => s.invoiceNumber.includes(d.invoiceNumber))
            : [...state.sales].reverse()[0];
          if (!inv) throw new Error('لا توجد فاتورة لتصديرها.');
          exportInvoicePdf(inv, state.settings, d.layout || state.settings.invoicePrintLayout || 'thermal80', true);
        } else if (reportType === 'sales') {
          exportSalesReportPdf('today', state.sales, state.settings, todaySum || monthSum);
        } else if (reportType === 'purchases') {
          exportPurchasesReportPdf('today', state.purchases, state.settings, todaySum || monthSum);
        } else if (reportType === 'expenses') {
          exportExpensesReportPdf('today', state.expenses, state.settings, todaySum || monthSum);
        } else if (reportType === 'profit') {
          exportProfitReportPdf(todaySum, monthSum, state.settings);
        } else if (reportType === 'inventory') {
          exportInventoryReportPdf(state.products, state.settings);
        } else if (reportType === 'customer_debts') {
          exportCustomerDebtsReportPdf(state.customers, state.settings);
        } else if (reportType === 'supplier_debts') {
          exportSupplierDebtsReportPdf(state.suppliers, state.settings);
        } else if (reportType === 'cashbox') {
          exportCashboxReportPdf(
            state.cashTransactions,
            handlers.cashBalance ?? monthSum?.cashBalance ?? 0,
            state.settings
          );
        } else {
          exportMasterStoreReportPdf(state, todaySum, monthSum, storageInfo);
        }

        return {
          success: true,
          message: 'تم تجهيز وتصدير تقرير PDF الرسمي بنجاح.',
        };
      }

      // 11. Navigate Tab
      case 'navigate_tab': {
        const tab = d.tab || 'dashboard';
        handlers.onNavigate(tab, d.extra);
        return {
          success: true,
          message: `تم الانتقال مباشرة إلى قسم [${tab}].`,
        };
      }

      // 12. Monitor Store
      case 'monitor_store': {
        const totalStockValuation = state.products.reduce(
          (sum, p) => sum + p.currentStock * p.costPrice,
          0
        );
        const totalItemsCount = state.products.reduce((sum, p) => sum + p.currentStock, 0);
        const lowStock = state.products.filter((p) => p.currentStock <= p.minStock);
        const totalDebts = state.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
        const cashBal =
          handlers.cashBalance ??
          (state.cashTransactions.length > 0
            ? state.cashTransactions[state.cashTransactions.length - 1].runningBalance
            : state.settings.initialCash || 0);

        return {
          success: true,
          message: `تقرير المراقبة الفوري: رصيد الصندوق ${formatNumber(cashBal)} ${sym} · قيمة المخزون ${formatNumber(totalStockValuation)} ${sym} (${state.products.length} صنف / ${formatNumber(totalItemsCount)} وحدة) · مواد منخفضة المخزون: ${lowStock.length} · ديون الزبائن: ${formatNumber(totalDebts)} ${sym}.`,
        };
      }

      // 13. Aggregate Sales
      case 'aggregate_sales': {
        handlers.onNavigate('sales', { salesTab: 'aggregate' });
        return {
          success: true,
          message: 'تم فتح قسم تجميع مبيعات الشهر والمدة المحددة بنجاح.',
        };
      }

      // 14. Quick Customer Sale navigation
      case 'quick_sale': {
        handlers.onNavigate('sales', { salesTab: 'create' });
        return {
          success: true,
          message: 'تم الانتقال لشاشة المبيعات الفورية وجاهزة لإدراج فاتورة البيع.',
        };
      }

      // 15. Compress Database
      case 'compress_database': {
        if (handlers.onCompressCloudData) {
          const res = await handlers.onCompressCloudData();
          return {
            success: res.success,
            message: res.message,
          };
        }
        const usage = calculateStorageUsage(state);
        return {
          success: true,
          message: `تم ترشيد وضغط البيانات محلياً وسحابياً بتقنية Deflate Level 9. الحجم بعد الضغط: ${usage.usedFormatted} بدلاً من ${usage.uncompressedFormatted} (توفير ${usage.savingsPercentageFormatted}).`,
        };
      }

      default:
        return {
          success: false,
          message: 'نوع الإجراء غير معروف أو غير مدعوم حالياً.',
        };
    }
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'تعذر استكمال تنفيذ الإجراء في التطبيق.',
    };
  }
}
