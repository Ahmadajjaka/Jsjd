import { AppState } from './storage';
import { formatCurrency, formatNumber } from './accounting';
import { StorageUsageSummary } from '../services/firebaseSync';
import { exportInvoicePdfWithJsPdf } from './invoicePdf';
import {
  Product,
  SaleInvoice,
  PurchaseInvoice,
  Expense,
  Customer,
  Supplier,
  CashTransaction,
  FinancialSummary,
  CustomerPayment,
  SupplierPayment,
  StoreSettings,
} from '../types/accounting';

/**
 * Base HTML document template for high-quality printable PDF export with RTL support
 */
function wrapInPdfTemplate(title: string, bodyContent: string, storeSettings: any): string {
  const now = new Date().toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const time = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${title} - ${storeSettings.storeName || 'خردوات المامو'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    
    @page {
      size: A4;
      margin: 12mm 10mm 15mm 10mm;
      @bottom-center {
        content: "صفحة " counter(page);
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 10px;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.5;
    }

    .report-header {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .store-info h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      font-weight: 900;
      color: #0f172a;
    }

    .store-info p {
      margin: 0;
      font-size: 11px;
      color: #475569;
    }

    .report-meta {
      text-align: left;
      font-size: 10px;
      color: #475569;
    }

    .report-title-badge {
      display: inline-block;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }

    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 10px;
    }

    .kpi-card.highlight {
      background: #fefce8;
      border-color: #fde047;
    }

    .kpi-card.emerald {
      background: #f0fdf4;
      border-color: #bbf7d0;
    }

    .kpi-card.rose {
      background: #fff1f2;
      border-color: #fecdd3;
    }

    .kpi-label {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 2px;
      font-weight: 600;
    }

    .kpi-value {
      font-size: 14px;
      font-weight: 800;
      font-family: monospace;
      color: #0f172a;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 10.5px;
    }

    th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 8px;
      text-align: right;
      font-weight: 700;
      border: 1px solid #0f172a;
    }

    td {
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
      text-align: right;
    }

    tr:nth-child(even) {
      background: #f8fafc;
    }

    .num {
      font-family: monospace;
      font-weight: 700;
      direction: ltr;
      display: inline-block;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      border-right: 4px solid #f59e0b;
      padding-right: 8px;
      margin: 16px 0 8px 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
    }

    .badge-cash { background: #dcfce7; color: #166534; }
    .badge-debt { background: #fee2e2; color: #991b1b; }
    .badge-partial { background: #fef3c7; color: #92400e; }

    .report-footer {
      margin-top: 25px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 10px;
      color: #64748b;
    }

    .signatures {
      display: flex;
      gap: 40px;
    }

    .sign-box {
      text-align: center;
      min-width: 120px;
      border-top: 1px solid #94a3b8;
      padding-top: 4px;
      margin-top: 25px;
      font-weight: 600;
    }

    @media print {
      body {
        padding: 0;
      }
      .no-print {
        display: none !important;
      }
      .page-break {
        page-break-before: always;
      }
    }
  </style>
</head>
<body>
  <div class="report-header">
    <div class="store-info">
      <h1>${storeSettings.storeName || 'خردوات المامو'}</h1>
      <p>${storeSettings.storeTagline || 'النظام المحاسبي وإدارة المخزون لمواد البناء والخردوات'}</p>
      <p>الهاتف: ${storeSettings.phone || 'غير محدد'} | العنوان: ${storeSettings.address || 'غير محدد'}</p>
    </div>
    <div class="report-meta">
      <div class="report-title-badge">${title}</div>
      <div>التاريخ: ${now}</div>
      <div>الوقت: ${time}</div>
      <div>العملة: ${storeSettings.currencySymbol || 'ل.س'} (${storeSettings.currency || 'SYP'})</div>
    </div>
  </div>

  ${bodyContent}

  <div class="report-footer">
    <div>
      <p style="margin: 0 0 2px 0; font-weight: 700;">خردوات المامو — تقرير محاسبي رسمي صادر إلكترونياً</p>
      <p style="margin: 0;">جميع العمليات متوافقة مع القيد المالي المحاسبي ومسجلة بالسيرفر السحابي.</p>
    </div>
    <div class="signatures">
      <div class="sign-box">توقيع المحاسب</div>
      <div class="sign-box">ختم واعتماد الإدارة</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Direct download of HTML printable document as a fallback
 */
export function downloadHtmlDocument(htmlContent: string, fileName: string) {
  if (typeof document === 'undefined') return;
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(url);
    }, 1500);
  } catch (err) {
    console.warn('downloadHtmlDocument error:', err);
  }
}

/**
 * Print or trigger browser Save as PDF dialog seamlessly via rendered hidden iframe
 */
export function printHtmlAsPdf(htmlContent: string, documentTitle: string = 'تقرير-خردوات-المامو') {
  if (typeof document === 'undefined') {
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '150px';
  iframe.style.height = '150px';
  iframe.style.opacity = '0.01';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(htmlContent);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.warn('Print iframe error, triggering fallback download:', e);
      downloadHtmlDocument(htmlContent, `${documentTitle}.html`);
    }
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 8000);
  }, 400);
}

// ============================================================================
// 1. Master Comprehensive Report (تقرير شامل لكل معلومات المتجر)
// ============================================================================

export function exportMasterStoreReportPdf(
  state: AppState,
  todaySummary: FinancialSummary,
  monthSummary: FinancialSummary,
  storageInfo: StorageUsageSummary
) {
  const totalStockValuation = state.products.reduce(
    (sum, p) => sum + p.currentStock * p.costPrice,
    0
  );
  const totalDebts = state.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
  const totalPayables = state.suppliers.reduce((sum, s) => sum + (s.totalDebt || 0), 0);
  const lowStock = state.products.filter((p) => p.currentStock <= p.minStock);

  // Category breakdown
  const catStats: Record<string, { count: number; value: number }> = {
    كهربائية: { count: 0, value: 0 },
    صحية: { count: 0, value: 0 },
    بناء: { count: 0, value: 0 },
    عامة: { count: 0, value: 0 },
  };

  state.products.forEach((p) => {
    let key = 'عامة';
    if (p.category.includes('كهربائ')) key = 'كهربائية';
    else if (p.category.includes('صحي')) key = 'صحية';
    else if (p.category.includes('بناء')) key = 'بناء';
    catStats[key].count += 1;
    catStats[key].value += p.currentStock * p.costPrice;
  });

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card emerald">
        <div class="kpi-label">مبيعات اليوم</div>
        <div class="kpi-value">${formatCurrency(todaySummary.grossSales, state.settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">مشتريات اليوم</div>
        <div class="kpi-value">${formatCurrency(todaySummary.totalPurchases, state.settings)}</div>
      </div>
      <div class="kpi-card rose">
        <div class="kpi-label">مصروفات اليوم</div>
        <div class="kpi-value">${formatCurrency(todaySummary.operatingExpenses, state.settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">صافي ربح اليوم</div>
        <div class="kpi-value">${formatCurrency(todaySummary.netOperatingProfit, state.settings)}</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card emerald">
        <div class="kpi-label">مبيعات الشهر الحالي</div>
        <div class="kpi-value">${formatCurrency(monthSummary.grossSales, state.settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">صافي أرباح الشهر</div>
        <div class="kpi-value">${formatCurrency(monthSummary.netOperatingProfit, state.settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">رصيد الصندوق النقدي</div>
        <div class="kpi-value">${formatCurrency(monthSummary.cashBalance, state.settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">تقييم بضاعة المستودع</div>
        <div class="kpi-value">${formatCurrency(totalStockValuation, state.settings)}</div>
      </div>
    </div>

    <!-- Section: Categories Breakdown -->
    <div class="section-title">
      <span>توزيع بضاعة المستودع حسب الأقسام الأربعة</span>
      <span style="font-size: 11px; font-weight: 600;">إجمالي المواد: ${state.products.length} صنف</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>القسم والتصنيف</th>
          <th>عدد الأصناف المسجلة</th>
          <th>القيمة التقديرية (سعر التكلفة)</th>
          <th>النسبة من رأس مال البضاعة</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(catStats)
          .map(([cat, stat]) => {
            const pct = totalStockValuation > 0 ? ((stat.value / totalStockValuation) * 100).toFixed(1) : '0';
            return `<tr>
              <td><strong>${cat}</strong></td>
              <td>${stat.count} مواد</td>
              <td class="num">${formatCurrency(stat.value, state.settings)}</td>
              <td>${pct}%</td>
            </tr>`;
          })
          .join('')}
      </tbody>
    </table>

    <!-- Section: Debtors & Payables -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
      <div>
        <div class="section-title">
          <span>ذمم الزبائن والديون</span>
          <span style="font-size: 11px; font-weight: bold; color: #dc2626;">الإجمالي: ${formatCurrency(totalDebts, state.settings)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>الزبون</th>
              <th>الهاتف</th>
              <th>المبلغ المستحق</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.customers.filter((c) => (c.totalDebt || 0) > 0).length === 0
                ? `<tr><td colspan="3" style="text-align:center; color:#64748b;">لا توجد أي ديون مستحقة على الزبائن (الحسابات مسددة).</td></tr>`
                : state.customers
                    .filter((c) => (c.totalDebt || 0) > 0)
                    .slice(0, 10)
                    .map(
                      (c) => `<tr>
                        <td><strong>${c.name}</strong></td>
                        <td>${c.phone || '-'}</td>
                        <td class="num" style="color:#b91c1c;">${formatCurrency(c.totalDebt, state.settings)}</td>
                      </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div>
        <div class="section-title">
          <span>ذمم ومستحقات الموردين</span>
          <span style="font-size: 11px; font-weight: bold; color: #d97706;">الإجمالي: ${formatCurrency(totalPayables, state.settings)}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>المورد</th>
              <th>الهاتف</th>
              <th>المبلغ المطلوب منا</th>
            </tr>
          </thead>
          <tbody>
            ${
              state.suppliers.filter((s) => (s.totalDebt || 0) > 0).length === 0
                ? `<tr><td colspan="3" style="text-align:center; color:#64748b;">لا توجد مبالغ متبقية للموردين.</td></tr>`
                : state.suppliers
                    .filter((s) => (s.totalDebt || 0) > 0)
                    .slice(0, 10)
                    .map(
                      (s) => `<tr>
                        <td><strong>${s.name}</strong></td>
                        <td>${s.phone || '-'}</td>
                        <td class="num" style="color:#b45309;">${formatCurrency(s.totalDebt, state.settings)}</td>
                      </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Section: Low Stock Warnings -->
    ${
      lowStock.length > 0
        ? `
      <div class="section-title">
        <span style="color:#b45309;">تنبيه نواقص المستودع (مواد وصلت للحد الأدنى)</span>
        <span style="font-size: 11px;">عدد المواد: ${lowStock.length}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>كود الصنف</th>
            <th>اسم المادة</th>
            <th>القسم</th>
            <th>الرصيد الحالي</th>
            <th>حد الطلب الأدنى</th>
            <th>سعر التكلفة</th>
          </tr>
        </thead>
        <tbody>
          ${lowStock
            .slice(0, 10)
            .map(
              (p) => `<tr>
                <td><code>${p.code}</code></td>
                <td><strong>${p.name}</strong></td>
                <td>${p.category}</td>
                <td style="color:#dc2626; font-weight:bold;">${p.currentStock} ${p.unit}</td>
                <td>${p.minStock} ${p.unit}</td>
                <td class="num">${formatCurrency(p.costPrice, state.settings)}</td>
              </tr>`
            )
            .join('')}
        </tbody>
      </table>
    `
        : ''
    }

    <!-- Section: Cloud Storage Consumption -->
    <div class="section-title">
      <span>مساحة التخزين السحابي المضغوط (Firebase Firestore - Deflate Level 9)</span>
      <span style="font-size: 10px; color:#475569;">المتبقي الشاغر: ${storageInfo.remainingFormatted}</span>
    </div>
    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; font-size:10px; display:flex; flex-direction:column; gap:4px;">
      <div style="display:flex; justify-content:space-between;">
        <span>الحجم الفعلي المضغوط: <strong style="color:#4338ca;">${storageInfo.usedFormatted}</strong> (${storageInfo.percentageFormatted})</span>
        <span>الحجم الأصلي قبل الضغط: <strong style="color:#64748b;">${storageInfo.uncompressedFormatted}</strong></span>
        <span>المساحة الموفرة: <strong style="color:#059669;">${storageInfo.savedFormatted} (${storageInfo.savingsPercentageFormatted})</strong></span>
      </div>
      <div style="display:flex; justify-content:space-between; border-top:1px dashed #cbd5e1; padding-top:4px; color:#475569;">
        <span>الخوارزمية: <strong>Deflate L9 + Protocol Buffer Raw Bytes</strong></span>
        <span>عدد السجلات الكلية: <strong>${storageInfo.totalDocCount} سجل</strong></span>
        <span>السعة المجانية المتوفرة: <strong>1.00 جيجابايت</strong></span>
      </div>
    </div>
  `;

  const html = wrapInPdfTemplate('التقرير المالي والمخزوني الشامل', content, state.settings);
  printHtmlAsPdf(html);
}

// ============================================================================
// 2. Individual Card PDF Reports (تنزيل PDF لكل بطاقة / أيقونة منفصلة)
// ============================================================================

export function exportSalesReportPdf(period: 'today' | 'month', sales: SaleInvoice[], settings: any, summary: FinancialSummary) {
  const title = period === 'today' ? 'تقرير مبيعات اليوم وفواتيرها' : 'تقرير مبيعات الشهر وفواتيرها';
  const filteredSales = sales.filter((s) => s.status === 'completed');

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card emerald">
        <div class="kpi-label">إجمالي المبيعات</div>
        <div class="kpi-value">${formatCurrency(summary.grossSales, settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">مجمل الربح المحقق</div>
        <div class="kpi-value">${formatCurrency(summary.grossProfit, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد الفواتير</div>
        <div class="kpi-value">${filteredSales.length} فاتورة</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">المقبوض نقداً</div>
        <div class="kpi-value">${formatCurrency(summary.cashReceivedSales, settings)}</div>
      </div>
    </div>

    <div class="section-title"><span>سجل الفواتير التفصيلي</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ والوقت</th>
          <th>اسم الزبون</th>
          <th>طريقة الدفع</th>
          <th>عدد المواد</th>
          <th>الإجمالي الصافي</th>
        </tr>
      </thead>
      <tbody>
        ${
          filteredSales.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد فواتير بيع مسجلة لهذه الفترة.</td></tr>`
            : filteredSales
                .slice(0, 30)
                .map(
                  (s) => `<tr>
                    <td><code>${s.invoiceNumber}</code></td>
                    <td>${s.date} ${s.time}</td>
                    <td><strong>${s.customerName}</strong></td>
                    <td><span class="badge ${s.paymentMethod === 'cash' ? 'badge-cash' : s.paymentMethod === 'debt' ? 'badge-debt' : 'badge-partial'}">${s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'debt' ? 'آجل (دين)' : 'جزئي'}</span></td>
                    <td>${s.items.length} أصناف</td>
                    <td class="num" style="color:#059669;">${formatCurrency(s.total, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(title, content, settings);
  printHtmlAsPdf(html);
}

export interface SalesAggregationData {
  periodLabel: string;
  startDate: string;
  endDate: string;
  totalSales: number;
  totalCash: number;
  totalDebt: number;
  totalCogs: number;
  totalProfit: number;
  profitMargin: number;
  invoicesCount: number;
  returnsCount: number;
  returnsTotal: number;
  averageInvoiceValue: number;
  sales: SaleInvoice[];
  customerBreakdown: { customerName: string; total: number; count: number; paid: number; debt: number }[];
  categoryBreakdown: { category: string; total: number; quantity: number }[];
  productBreakdown: { productName: string; quantity: number; total: number; profit: number }[];
}

/**
 * Exports comprehensive sales aggregation report for a month or custom date range
 */
export function exportSalesAggregationPdf(
  data: SalesAggregationData,
  settings: StoreSettings
) {
  const title = `تقرير تجميع مبيعات: ${data.periodLabel}`;

  const content = `
    <div style="background:#f1f5f9; border-radius:8px; padding:10px 14px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
      <div>
        <strong style="font-size:13px; color:#0f172a;">ملخص تجميع المبيعات المعتمد (${data.periodLabel})</strong>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">الفترة المحاسبية: من ${data.startDate} إلى ${data.endDate}</div>
      </div>
      <div style="text-align:left; font-size:11px;">
        <span style="background:#0f172a; color:#f8fafc; padding:3px 8px; border-radius:4px; font-weight:bold;">${data.invoicesCount} فواتير مباعة</span>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="kpi-grid">
      <div class="kpi-card emerald">
        <div class="kpi-label">صافي إجمالي المبيعات</div>
        <div class="kpi-value">${formatCurrency(data.totalSales, settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">مجمل الربح المحقق</div>
        <div class="kpi-value">${formatCurrency(data.totalProfit, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">نسبة هامش الربح</div>
        <div class="kpi-value" style="color:#0284c7;">${data.profitMargin.toFixed(1)}%</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">المقبوض نقداً بالصندوق</div>
        <div class="kpi-value" style="color:#059669;">${formatCurrency(data.totalCash, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">مبيعات الآجل والدين</div>
        <div class="kpi-value" style="color:#b91c1c;">${formatCurrency(data.totalDebt, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">متوسط قيمة الفاتورة</div>
        <div class="kpi-value">${formatCurrency(data.averageInvoiceValue, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">تكلفة البضاعة المباعة (COGS)</div>
        <div class="kpi-value">${formatCurrency(data.totalCogs, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">المرتجعات (${data.returnsCount})</div>
        <div class="kpi-value" style="color:#d97706;">${formatCurrency(data.returnsTotal, settings)}</div>
      </div>
    </div>

    <!-- Breakdown by Top Customers -->
    <div class="section-title">
      <span>تجميع المبيعات بحسب الزبائن (الأعلى شراءً في الفترة)</span>
      <span style="font-size:10px; color:#64748b;">عدد الزبائن: ${data.customerBreakdown.length}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>اسم الزبون</th>
          <th>عدد الفواتير</th>
          <th>إجمالي المشتريات</th>
          <th>المدفوع نقداً</th>
          <th>المتبقي دين في الفترة</th>
        </tr>
      </thead>
      <tbody>
        ${
          data.customerBreakdown.length === 0
            ? `<tr><td colspan="5" style="text-align:center;">لا توجد مشتريات زبائن مسجلة في هذه الفترة.</td></tr>`
            : data.customerBreakdown
                .slice(0, 15)
                .map(
                  (c) => `<tr>
                    <td><strong>${c.customerName}</strong></td>
                    <td class="num">${c.count}</td>
                    <td class="num" style="color:#059669; font-weight:bold;">${formatCurrency(c.total, settings)}</td>
                    <td class="num" style="color:#0284c7;">${formatCurrency(c.paid, settings)}</td>
                    <td class="num" style="color:${c.debt > 0 ? '#dc2626' : '#64748b'}; font-weight:${c.debt > 0 ? 'bold' : 'normal'};">
                      ${c.debt > 0 ? formatCurrency(c.debt, settings) : 'خالص'}
                    </td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>

    <!-- Breakdown by Category & Top Products -->
    <div style="display:grid; grid-template-columns: 1fr 2fr; gap:12px; margin-top:14px;">
      <div>
        <div class="section-title"><span>المبيعات حسب القسم</span></div>
        <table>
          <thead>
            <tr>
              <th>القسم</th>
              <th>الكمية</th>
              <th>المبيعات</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.categoryBreakdown.length === 0
                ? `<tr><td colspan="3" style="text-align:center;">لا توجد بيانات</td></tr>`
                : data.categoryBreakdown
                    .map(
                      (cat) => `<tr>
                        <td><strong>${cat.category}</strong></td>
                        <td class="num">${cat.quantity}</td>
                        <td class="num" style="color:#059669;">${formatCurrency(cat.total, settings)}</td>
                      </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>

      <div>
        <div class="section-title"><span>الأصناف والمواد الأكثر مبيعاً</span></div>
        <table>
          <thead>
            <tr>
              <th>المادة</th>
              <th>الكمية المباعة</th>
              <th>إجمالي المبيعات</th>
              <th>الربح المقدر</th>
            </tr>
          </thead>
          <tbody>
            ${
              data.productBreakdown.length === 0
                ? `<tr><td colspan="4" style="text-align:center;">لا توجد بيانات مواد</td></tr>`
                : data.productBreakdown
                    .slice(0, 8)
                    .map(
                      (p) => `<tr>
                        <td><strong>${p.productName}</strong></td>
                        <td class="num font-bold">${p.quantity}</td>
                        <td class="num" style="color:#059669;">${formatCurrency(p.total, settings)}</td>
                        <td class="num" style="color:#b45309; font-weight:bold;">${formatCurrency(p.profit, settings)}</td>
                      </tr>`
                    )
                    .join('')
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Detailed Invoices Table -->
    <div class="section-title" style="margin-top:16px;">
      <span>سجل الفواتير المشمولة بالتجميع (${data.sales.length} فاتورة)</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ والوقت</th>
          <th>الزبون</th>
          <th>طريقة الدفع</th>
          <th>الأصناف</th>
          <th>الصافي</th>
          <th>الربح</th>
          <th>الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${
          data.sales.length === 0
            ? `<tr><td colspan="8" style="text-align:center;">لا توجد فواتير بيع في الفترة المحددة.</td></tr>`
            : data.sales
                .slice(0, 40)
                .map(
                  (s) => `<tr>
                    <td><code>${s.invoiceNumber}</code></td>
                    <td>${s.date} ${s.time}</td>
                    <td><strong>${s.customerName}</strong></td>
                    <td><span class="badge ${s.paymentMethod === 'cash' ? 'badge-cash' : s.paymentMethod === 'debt' ? 'badge-debt' : 'badge-partial'}">${s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'debt' ? 'دين' : 'جزئي'}</span></td>
                    <td class="num">${s.items.length}</td>
                    <td class="num" style="color:#059669; font-weight:bold;">${formatCurrency(s.total, settings)}</td>
                    <td class="num" style="color:#b45309;">${formatCurrency(s.grossProfit, settings)}</td>
                    <td><span style="font-weight:bold; color:${s.status === 'completed' ? '#059669' : '#dc2626'}">${s.status === 'completed' ? 'معتمدة' : 'مرتجعة'}</span></td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(title, content, settings);
  printHtmlAsPdf(html);
}

export function exportPurchasesReportPdf(period: 'today' | 'month', purchases: PurchaseInvoice[], settings: any, summary: FinancialSummary) {
  const title = period === 'today' ? 'تقرير مشتريات وتوريد اليوم' : 'تقرير مشتريات وتوريد الشهر';

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">إجمالي المشتريات</div>
        <div class="kpi-value">${formatCurrency(summary.totalPurchases, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد الفواتير</div>
        <div class="kpi-value">${purchases.length} فاتورة</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-label">المدفوع للموردين</div>
        <div class="kpi-value">${formatCurrency(summary.cashPaidSuppliers, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">بضائع مدخلة للمستودع</div>
        <div class="kpi-value">${purchases.length} شحنات</div>
      </div>
    </div>

    <div class="section-title"><span>فواتير الشراء والتوريد التفصيلية</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ</th>
          <th>اسم المورد</th>
          <th>طريقة الدفع</th>
          <th>عدد المواد</th>
          <th>الإجمالي</th>
        </tr>
      </thead>
      <tbody>
        ${
          purchases.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد فواتير شراء وتوريد مسجلة.</td></tr>`
            : purchases
                .slice(0, 30)
                .map(
                  (p) => `<tr>
                    <td><code>${p.invoiceNumber}</code></td>
                    <td>${p.date}</td>
                    <td><strong>${p.supplierName}</strong></td>
                    <td>${p.paymentMethod === 'cash' ? 'نقداً' : 'آجل'}</td>
                    <td>${p.items.length} أصناف</td>
                    <td class="num">${formatCurrency(p.total, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(title, content, settings);
  printHtmlAsPdf(html);
}

export function exportExpensesReportPdf(period: 'today' | 'month', expenses: Expense[], settings: any, summary: FinancialSummary) {
  const title = period === 'today' ? 'كشف المصروفات اليومية' : 'كشف المصروفات الشهرية';

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card rose">
        <div class="kpi-label">إجمالي المصروفات</div>
        <div class="kpi-value">${formatCurrency(summary.operatingExpenses, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد السندات</div>
        <div class="kpi-value">${expenses.length} سند</div>
      </div>
    </div>

    <div class="section-title"><span>سندات الصرف والمصروفات</span></div>
    <table>
      <thead>
        <tr>
          <th>التاريخ والوقت</th>
          <th>بند المصروف</th>
          <th>التصنيف</th>
          <th>المسؤول / المستلم</th>
          <th>المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${
          expenses.length === 0
            ? `<tr><td colspan="5" style="text-align:center;">لا توجد مصروفات مسجلة لهذه الفترة.</td></tr>`
            : expenses
                .slice(0, 30)
                .map(
                  (e) => `<tr>
                    <td>${e.date}</td>
                    <td><strong>${e.description}</strong></td>
                    <td>${e.category}</td>
                    <td>${e.notes || '-'}</td>
                    <td class="num" style="color:#b91c1c;">${formatCurrency(e.amount, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(title, content, settings);
  printHtmlAsPdf(html);
}

export function exportProfitReportPdf(todaySummary: FinancialSummary, monthSummary: FinancialSummary, settings: any) {
  const content = `
    <div class="section-title"><span>قائمة الدخل وصافي الأرباح لليوم</span></div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">إجمالي المبيعات</div>
        <div class="kpi-value">${formatCurrency(todaySummary.grossSales, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">تكلفة البضاعة المباعة (COGS)</div>
        <div class="kpi-value">${formatCurrency(todaySummary.cogs, settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">مجمل الربح التجاري</div>
        <div class="kpi-value">${formatCurrency(todaySummary.grossProfit, settings)}</div>
      </div>
      <div class="kpi-card ${todaySummary.netOperatingProfit >= 0 ? 'emerald' : 'rose'}">
        <div class="kpi-label">صافي الربح التشغيلي</div>
        <div class="kpi-value">${formatCurrency(todaySummary.netOperatingProfit, settings)}</div>
      </div>
    </div>

    <div class="section-title"><span>قائمة الدخل وصافي الأرباح للشهر الحالي</span></div>
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">إجمالي مبيعات الشهر</div>
        <div class="kpi-value">${formatCurrency(monthSummary.grossSales, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">تكلفة البضاعة المباعة للشهر</div>
        <div class="kpi-value">${formatCurrency(monthSummary.cogs, settings)}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">مجمل أرباح الشهر</div>
        <div class="kpi-value">${formatCurrency(monthSummary.grossProfit, settings)}</div>
      </div>
      <div class="kpi-card ${monthSummary.netOperatingProfit >= 0 ? 'emerald' : 'rose'}">
        <div class="kpi-label">صافي أرباح الشهر (بعد المصروفات)</div>
        <div class="kpi-value">${formatCurrency(monthSummary.netOperatingProfit, settings)}</div>
      </div>
    </div>
  `;

  const html = wrapInPdfTemplate('تقرير الأرباح وقائمة الدخل الرسمية', content, settings);
  printHtmlAsPdf(html);
}

export function exportCashboxReportPdf(transactions: CashTransaction[], initialCash: number, settings: any) {
  const content = `
    <div class="kpi-grid">
      <div class="kpi-card emerald">
        <div class="kpi-label">الرصيد النقدي الحالي في الصندوق</div>
        <div class="kpi-value">${formatCurrency(initialCash, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد الحركات النقدية</div>
        <div class="kpi-value">${transactions.length} حركة</div>
      </div>
    </div>

    <div class="section-title"><span>كشف حركة الصندوق الأخيرة</span></div>
    <table>
      <thead>
        <tr>
          <th>التاريخ والوقت</th>
          <th>البيان والتفصيل</th>
          <th>النوع</th>
          <th>المبلغ</th>
          <th>الرصيد التراكمي</th>
        </tr>
      </thead>
      <tbody>
        ${
          transactions.length === 0
            ? `<tr><td colspan="5" style="text-align:center;">لا توجد حركات مسجلة بالصندوق.</td></tr>`
            : transactions
                .slice(-25)
                .reverse()
                .map(
                  (t) => `<tr>
                    <td>${t.date} ${t.time}</td>
                    <td><strong>${t.description}</strong></td>
                    <td>${t.flow === 'in' ? 'قبض (+)' : 'صرف (-)'}</td>
                    <td class="num" style="color:${t.flow === 'in' ? '#059669' : '#dc2626'};">${t.flow === 'in' ? '+' : '-'}${formatCurrency(t.amount, settings)}</td>
                    <td class="num">${formatCurrency(t.runningBalance, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate('كشف حساب وحركة الصندوق النقدي', content, settings);
  printHtmlAsPdf(html);
}

export function exportInventoryReportPdf(products: Product[], settings: any) {
  const totalValue = products.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">عدد المواد المسجلة</div>
        <div class="kpi-value">${products.length} صنف</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">إجمالي تقييم المستودع (تكلفة)</div>
        <div class="kpi-value">${formatCurrency(totalValue, settings)}</div>
      </div>
    </div>

    <div class="section-title"><span>جرد أصناف المستودع والمخزون</span></div>
    <table>
      <thead>
        <tr>
          <th>كود الصنف</th>
          <th>اسم المادة</th>
          <th>القسم</th>
          <th>الكمية المتوفرة</th>
          <th>الوحدة</th>
          <th>سعر التكلفة</th>
          <th>سعر البيع</th>
          <th>القيمة الإجمالية</th>
        </tr>
      </thead>
      <tbody>
        ${
          products.length === 0
            ? `<tr><td colspan="8" style="text-align:center;">المستودع فارغ حالياً.</td></tr>`
            : products
                .slice(0, 40)
                .map(
                  (p) => `<tr>
                    <td><code>${p.code}</code></td>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.category}</td>
                    <td>${p.currentStock}</td>
                    <td>${p.unit}</td>
                    <td class="num">${formatCurrency(p.costPrice, settings)}</td>
                    <td class="num">${formatCurrency(p.sellingPrice, settings)}</td>
                    <td class="num" style="color:#2563eb;">${formatCurrency(p.currentStock * p.costPrice, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate('تقرير جرد وتقييم مخزون المستودع', content, settings);
  printHtmlAsPdf(html);
}

export function exportCustomerDebtsReportPdf(customers: Customer[], settings: any) {
  const debtors = customers.filter((c) => (c.totalDebt || 0) > 0);
  const totalDebt = debtors.reduce((sum, c) => sum + c.totalDebt, 0);

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card rose">
        <div class="kpi-label">إجمالي الديون المستحقة على الزبائن</div>
        <div class="kpi-value">${formatCurrency(totalDebt, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد الزبائن المدينين</div>
        <div class="kpi-value">${debtors.length} زبون</div>
      </div>
    </div>

    <div class="section-title"><span>قائمة ديون الزبائن والذمم المدينة</span></div>
    <table>
      <thead>
        <tr>
          <th>اسم الزبون</th>
          <th>رقم الهاتف</th>
          <th>العنوان / الملاحظات</th>
          <th>المبلغ المستحق</th>
        </tr>
      </thead>
      <tbody>
        ${
          debtors.length === 0
            ? `<tr><td colspan="4" style="text-align:center;">لا توجد أي ديون مستحقة على الزبائن.</td></tr>`
            : debtors
                .map(
                  (c) => `<tr>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.phone || '-'}</td>
                    <td>${c.address || '-'}</td>
                    <td class="num" style="color:#b91c1c;">${formatCurrency(c.totalDebt, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate('كشف ديون الزبائن والذمم المدينة', content, settings);
  printHtmlAsPdf(html);
}

export function exportSupplierDebtsReportPdf(suppliers: Supplier[], settings: any) {
  const creditors = suppliers.filter((s) => (s.totalDebt || 0) > 0);
  const totalPayable = creditors.reduce((sum, s) => sum + s.totalDebt, 0);

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card highlight">
        <div class="kpi-label">إجمالي المستحقات المطلوبة للموردين</div>
        <div class="kpi-value">${formatCurrency(totalPayable, settings)}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">عدد الموردين الدائنين</div>
        <div class="kpi-value">${creditors.length} مورد</div>
      </div>
    </div>

    <div class="section-title"><span>قائمة مستحقات الموردين والذمم الدائنة</span></div>
    <table>
      <thead>
        <tr>
          <th>اسم المورد / الشركة</th>
          <th>رقم الهاتف</th>
          <th>اسم المندوب</th>
          <th>المبلغ المستحق له</th>
        </tr>
      </thead>
      <tbody>
        ${
          creditors.length === 0
            ? `<tr><td colspan="4" style="text-align:center;">لا توجد مستحقات باقية للموردين.</td></tr>`
            : creditors
                .map(
                  (s) => `<tr>
                    <td><strong>${s.name}</strong></td>
                    <td>${s.phone || '-'}</td>
                    <td>${s.company || s.notes || '-'}</td>
                    <td class="num" style="color:#d97706;">${formatCurrency(s.totalDebt, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate('كشف مستحقات الموردين والذمم الدائنة', content, settings);
  printHtmlAsPdf(html, 'كشف-مستحقات-الموردين');
}

// ============================================================================
// 3. Invoice PDF Export via jsPDF (Thermal 80mm or Standard A4)
// ============================================================================

export function exportInvoicePdf(
  invoice: SaleInvoice,
  settings: StoreSettings,
  layout: 'thermal80' | 'standard' = 'thermal80',
  downloadDirect: boolean = false
) {
  return exportInvoicePdfWithJsPdf(invoice, settings, layout, downloadDirect);
}

// ============================================================================
// 4. Single Customer Account Statement PDF
// ============================================================================

export function exportSingleCustomerStatementPdf(
  customer: Customer,
  sales: SaleInvoice[],
  payments: CustomerPayment[],
  settings: StoreSettings
) {
  const custSales = sales.filter((s) => s.customerId === customer.id && s.status === 'completed');
  const custPayments = payments.filter((p) => p.customerId === customer.id);
  const title = `كشف-حساب-الزبون-${customer.name}`;

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">اسم الزبون</div>
        <div class="kpi-value">${customer.name}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">إجمالي المشتريات</div>
        <div class="kpi-value">${formatCurrency(customer.totalPurchases, settings)}</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-label">المسدد والمدفوع</div>
        <div class="kpi-value">${formatCurrency(customer.totalPaid, settings)}</div>
      </div>
      <div class="kpi-card ${customer.totalDebt > 0 ? 'rose' : 'emerald'}">
        <div class="kpi-label">الرصيد المتبقي ذمة (دين)</div>
        <div class="kpi-value">${formatCurrency(customer.totalDebt, settings)}</div>
      </div>
    </div>

    <div class="section-title"><span>فواتير المبيعات المسجلة على الزبون</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ والوقت</th>
          <th>طريقة الدفع</th>
          <th>قيمة الفاتورة</th>
          <th>المقبوض منها</th>
          <th>المتبقي دين</th>
        </tr>
      </thead>
      <tbody>
        ${
          custSales.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد فواتير مبيعات مسجلة لهذا الزبون.</td></tr>`
            : custSales
                .map(
                  (s) => `<tr>
                    <td><code>${s.invoiceNumber}</code></td>
                    <td>${s.date} ${s.time}</td>
                    <td>${s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'debt' ? 'آجل' : 'جزئي'}</td>
                    <td class="num">${formatCurrency(s.total, settings)}</td>
                    <td class="num" style="color:#059669;">${formatCurrency(s.paidAmount, settings)}</td>
                    <td class="num" style="color:#b91c1c;">${formatCurrency(s.remainingAmount, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>

    <div class="section-title" style="margin-top:16px;"><span>سندات قبض دفعات الديون</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم السند</th>
          <th>التاريخ والوقت</th>
          <th>المبلغ المقبوض</th>
          <th>طريقة القبض</th>
          <th>الرصيد بعد السداد</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${
          custPayments.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد سندات دفعات مسجلة بعد.</td></tr>`
            : custPayments
                .map(
                  (p) => `<tr>
                    <td><code>${p.paymentNumber}</code></td>
                    <td>${p.date} ${p.time}</td>
                    <td class="num" style="color:#059669; font-weight:bold;">${formatCurrency(p.amount, settings)}</td>
                    <td>${p.paymentMethod === 'cash' ? 'نقداً' : 'تحويل'}</td>
                    <td class="num">${p.remainingDebtAfter !== undefined ? formatCurrency(p.remainingDebtAfter, settings) : '-'}</td>
                    <td>${p.notes || '-'}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(`كشف حساب الزبون: ${customer.name}`, content, settings);
  printHtmlAsPdf(html, title);
}

// ============================================================================
// 5. Single Supplier Account Statement PDF
// ============================================================================

export function exportSingleSupplierStatementPdf(
  supplier: Supplier,
  purchases: PurchaseInvoice[],
  payments: SupplierPayment[],
  settings: StoreSettings
) {
  const suppPurchases = purchases.filter((p) => p.supplierId === supplier.id);
  const suppPayments = payments.filter((p) => p.supplierId === supplier.id);
  const title = `كشف-حساب-المورد-${supplier.name}`;

  const content = `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">اسم المورد / الشركة</div>
        <div class="kpi-value">${supplier.name} ${supplier.company ? `(${supplier.company})` : ''}</div>
      </div>
      <div class="kpi-card highlight">
        <div class="kpi-label">إجمالي التوريدات والمشتريات</div>
        <div class="kpi-value">${formatCurrency(supplier.totalPurchases, settings)}</div>
      </div>
      <div class="kpi-card emerald">
        <div class="kpi-label">المسدد له فعلياً</div>
        <div class="kpi-value">${formatCurrency(supplier.totalPaid, settings)}</div>
      </div>
      <div class="kpi-card ${supplier.totalDebt > 0 ? 'rose' : 'emerald'}">
        <div class="kpi-label">الرصيد المتبقي له (مستحق السداد)</div>
        <div class="kpi-value">${formatCurrency(supplier.totalDebt, settings)}</div>
      </div>
    </div>

    <div class="section-title"><span>فواتير الشراء والتوريد من المورد</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>التاريخ والوقت</th>
          <th>طريقة الدفع</th>
          <th>قيمة الفاتورة</th>
          <th>المدفوع منها</th>
          <th>المتبقي له</th>
        </tr>
      </thead>
      <tbody>
        ${
          suppPurchases.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد فواتير شراء مسجلة لهذا المورد.</td></tr>`
            : suppPurchases
                .map(
                  (p) => `<tr>
                    <td><code>${p.invoiceNumber}</code></td>
                    <td>${p.date} ${p.time}</td>
                    <td>${p.paymentMethod === 'cash' ? 'نقداً' : p.paymentMethod === 'debt' ? 'آجل' : 'جزئي'}</td>
                    <td class="num">${formatCurrency(p.total, settings)}</td>
                    <td class="num" style="color:#059669;">${formatCurrency(p.paidAmount, settings)}</td>
                    <td class="num" style="color:#d97706;">${formatCurrency(p.remainingAmount, settings)}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>

    <div class="section-title" style="margin-top:16px;"><span>سندات صرف سداد دفعات المورد</span></div>
    <table>
      <thead>
        <tr>
          <th>رقم السند</th>
          <th>التاريخ والوقت</th>
          <th>المبلغ المسدد</th>
          <th>طريقة السداد</th>
          <th>المتبقي بعد السداد</th>
          <th>ملاحظات</th>
        </tr>
      </thead>
      <tbody>
        ${
          suppPayments.length === 0
            ? `<tr><td colspan="6" style="text-align:center;">لا توجد سندات صرف دفعات لهذا المورد بعد.</td></tr>`
            : suppPayments
                .map(
                  (p) => `<tr>
                    <td><code>${p.paymentNumber}</code></td>
                    <td>${p.date} ${p.time}</td>
                    <td class="num" style="color:#d97706; font-weight:bold;">${formatCurrency(p.amount, settings)}</td>
                    <td>${p.paymentMethod === 'cash' ? 'نقداً' : 'تحويل'}</td>
                    <td class="num">${p.remainingDebtAfter !== undefined ? formatCurrency(p.remainingDebtAfter, settings) : '-'}</td>
                    <td>${p.notes || '-'}</td>
                  </tr>`
                )
                .join('')
        }
      </tbody>
    </table>
  `;

  const html = wrapInPdfTemplate(`كشف حساب المورد: ${supplier.name}`, content, settings);
  printHtmlAsPdf(html, title);
}
