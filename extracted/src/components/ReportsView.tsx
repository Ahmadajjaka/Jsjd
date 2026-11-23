import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Calendar,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Percent,
  DollarSign,
  Boxes,
  Truck,
  ShoppingCart,
  Receipt,
  Scale,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { AppState } from '../utils/storage';
import {
  computeFinancialSummary,
  downloadCSV,
  formatCurrency,
  formatNumber,
  getTodayDateString,
} from '../utils/accounting';
import { exportProfitReportPdf } from '../utils/pdfExport';

interface ReportsViewProps {
  state: AppState;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ state }) => {
  const today = getTodayDateString();
  const [periodType, setPeriodType] = useState<
    'today' | 'this_week' | 'this_month' | 'this_year' | 'custom'
  >('this_month');

  const [customStartDate, setCustomStartDate] = useState(today.substring(0, 7) + '-01');
  const [customEndDate, setCustomEndDate] = useState(today);

  // Compute dates based on period
  const { startDate, endDate, periodLabel, prevStartDate, prevEndDate } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');

    if (periodType === 'today') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      return {
        startDate: today,
        endDate: today,
        periodLabel: `اليوم (${today})`,
        prevStartDate: yStr,
        prevEndDate: yStr,
      };
    }

    if (periodType === 'this_week') {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      const prevStart = new Date(now);
      prevStart.setDate(now.getDate() - 14);
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: today,
        periodLabel: 'آخر 7 أيام',
        prevStartDate: prevStart.toISOString().split('T')[0],
        prevEndDate: start.toISOString().split('T')[0],
      };
    }

    if (periodType === 'this_year') {
      return {
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
        periodLabel: `سنة ${y}`,
        prevStartDate: `${y - 1}-01-01`,
        prevEndDate: `${y - 1}-12-31`,
      };
    }

    if (periodType === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        periodLabel: `فترة مخصصة من ${customStartDate} إلى ${customEndDate}`,
        prevStartDate: customStartDate,
        prevEndDate: customEndDate,
      };
    }

    // Default: this_month
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pmY = prevMonthDate.getFullYear();
    const pmM = String(prevMonthDate.getMonth() + 1).padStart(2, '0');

    return {
      startDate: `${y}-${m}-01`,
      endDate: `${y}-${m}-31`,
      periodLabel: `شهر ${m} / ${y}`,
      prevStartDate: `${pmY}-${pmM}-01`,
      prevEndDate: `${pmY}-${pmM}-31`,
    };
  }, [periodType, today, customStartDate, customEndDate]);

  // Current Summary
  const currentSummary = useMemo(() => {
    return computeFinancialSummary({
      sales: state.sales,
      purchases: state.purchases,
      expenses: state.expenses,
      customerPayments: state.customerPayments,
      supplierPayments: state.supplierPayments,
      products: state.products,
      customers: state.customers,
      suppliers: state.suppliers,
      cashTransactions: state.cashTransactions,
      startDate,
      endDate,
      periodLabel,
      initialCash: state.settings.initialCash,
    });
  }, [state, startDate, endDate, periodLabel]);

  // Previous Period Summary for Comparison
  const prevSummary = useMemo(() => {
    return computeFinancialSummary({
      sales: state.sales,
      purchases: state.purchases,
      expenses: state.expenses,
      customerPayments: state.customerPayments,
      supplierPayments: state.supplierPayments,
      products: state.products,
      customers: state.customers,
      suppliers: state.suppliers,
      cashTransactions: state.cashTransactions,
      startDate: prevStartDate,
      endDate: prevEndDate,
      periodLabel: 'الفترة السابقة',
      initialCash: state.settings.initialCash,
    });
  }, [state, prevStartDate, prevEndDate]);

  // Growth calculations
  const salesGrowth = useMemo(() => {
    if (prevSummary.grossSales === 0) return currentSummary.grossSales > 0 ? 100 : 0;
    return Math.round(
      ((currentSummary.grossSales - prevSummary.grossSales) /
        prevSummary.grossSales) *
        100
    );
  }, [currentSummary.grossSales, prevSummary.grossSales]);

  const profitGrowth = useMemo(() => {
    if (prevSummary.netOperatingProfit === 0) return currentSummary.netOperatingProfit > 0 ? 100 : 0;
    return Math.round(
      ((currentSummary.netOperatingProfit - prevSummary.netOperatingProfit) /
        Math.abs(prevSummary.netOperatingProfit)) *
        100
    );
  }, [currentSummary.netOperatingProfit, prevSummary.netOperatingProfit]);

  // Export Report to CSV
  const handleExportCSV = () => {
    const headers = ['البند المالي المحاسبي', 'القيمة الرقمية'];
    const rows = [
      ['اسم المتجر', state.settings.storeName],
      ['الفترة الزمنية', periodLabel],
      ['إجمالي المبيعات (Gross Sales)', currentSummary.grossSales],
      ['مردودات وخصومات المبيعات', currentSummary.salesReturns],
      ['صافي المبيعات', currentSummary.netSales],
      ['تكلفة البضاعة المباعة (COGS)', currentSummary.cogs],
      ['مجمل الربح (Gross Profit)', currentSummary.grossProfit],
      ['هامش مجمل الربح %', `${currentSummary.grossProfitMargin}%`],
      ['المصروفات التشغيلية', currentSummary.operatingExpenses],
      ['صافي الربح التشغيلي (Net Operating Profit)', currentSummary.netOperatingProfit],
      ['هامش صافي الربح %', `${currentSummary.netProfitMargin}%`],
      ['نتيجة أداء الفترة', currentSummary.performanceStatus === 'profitable' ? 'رابح' : currentSummary.performanceStatus === 'loss' ? 'خاسر' : 'متعادل'],
      ['إجمالي المشتريات خلال الفترة', currentSummary.totalPurchases],
      ['المقبوضات النقدية من المبيعات', currentSummary.cashReceivedSales],
      ['المقبوضات من تسديد ديون قديمة', currentSummary.cashReceivedDebts],
      ['المدفوعات النقدية للموردين', currentSummary.cashPaidSuppliers],
      ['المصروفات النقدية المدفوعة', currentSummary.cashPaidExpenses],
      ['المبيعات الآجلة (ديون جديدة لنا)', currentSummary.creditSalesNew],
      ['المشتريات الآجلة (ديون جديدة علينا)', currentSummary.creditPurchasesNew],
      ['قيمة بضاعة المخزون الحالية', currentSummary.currentInventoryValue],
      ['إجمالي ذمم الزبائن المطلوبة', currentSummary.totalCustomerReceivables],
      ['إجمالي ذمم الموردين المستحقة', currentSummary.totalSupplierPayables],
      ['رصيد الصندوق النقدي الفعلي', currentSummary.cashBalance],
    ];

    downloadCSV(
      `التقرير_المالي_خردوات_المامو_${startDate}_${endDate}`,
      headers,
      rows
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            التقارير المالية والأرباح والخسائر
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            حساب مجمل وصافي الربح وفق المعايير المحاسبية الدقيقة ومقارنة الأداء الدوري
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير Excel/CSV</span>
          </button>
          <button
            type="button"
            onClick={() => exportProfitReportPdf(currentSummary, prevSummary, state.settings)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>طباعة وتصدير التقرير PDF</span>
          </button>
        </div>
      </div>

      {/* Period Selector Tabs */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setPeriodType('today')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodType === 'today'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('this_week')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodType === 'this_week'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذا الأسبوع
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('this_month')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodType === 'this_month'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذا الشهر
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('this_year')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodType === 'this_year'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              هذا العام
            </button>
            <button
              type="button"
              onClick={() => setPeriodType('custom')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                periodType === 'custom'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              فترة مخصصة
            </button>
          </div>

          <div className="text-xs font-bold text-slate-600">
            الفترة المحددة: <span className="text-slate-900 font-mono">{periodLabel}</span>
          </div>
        </div>

        {/* Custom Date Pickers */}
        {periodType === 'custom' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">من تاريخ:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-700">إلى تاريخ:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="p-2 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Income Statement Card (قائمة الدخل والأرباح) */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-6">
        {/* Banner with Performance Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-slate-50">
          <div>
            <span className="text-xs text-slate-500 block">نتيجة أعمال المتجر عن {periodLabel}</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`text-xl font-black ${
                  currentSummary.performanceStatus === 'profitable'
                    ? 'text-emerald-700'
                    : currentSummary.performanceStatus === 'loss'
                    ? 'text-rose-700'
                    : 'text-slate-700'
                }`}
              >
                {currentSummary.performanceStatus === 'profitable'
                  ? 'المتجر رابح (+)'
                  : currentSummary.performanceStatus === 'loss'
                  ? 'المتجر خاسر (-)'
                  : 'متعادل تماماً'}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-white border">
                هامش صافي الربح: {currentSummary.netProfitMargin}%
              </span>
            </div>
          </div>

          {/* Comparison with previous period */}
          <div className="flex items-center gap-4 text-xs font-bold text-left shrink-0">
            <div>
              <span className="text-slate-500 block">مقارنة المبيعات:</span>
              <span
                className={`font-mono tabular-nums ${
                  salesGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {salesGrowth >= 0 ? `+${salesGrowth}%` : `${salesGrowth}%`}
              </span>
            </div>
            <div className="border-r border-slate-200 pr-4">
              <span className="text-slate-500 block">مقارنة صافي الأرباح:</span>
              <span
                className={`font-mono tabular-nums ${
                  profitGrowth >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {profitGrowth >= 0 ? `+${profitGrowth}%` : `${profitGrowth}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Detailed Financial Calculation Breakdown (The Core Equation) */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-900">
            المعادلة المحاسبية للأرباح التشغيلية
          </h3>

          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
            {/* 1. Gross Sales */}
            <div className="flex items-center justify-between p-3.5 bg-white">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block text-sm">
                  1. إجمالي المبيعات (Gross Sales)
                </span>
                <span className="text-slate-500">
                  إجمالي قيمة كل ما تم بيعه للزبائن خلال الفترة
                </span>
              </div>
              <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                {formatCurrency(currentSummary.grossSales, state.settings)}
              </span>
            </div>

            {/* 2. Sales Returns */}
            {currentSummary.salesReturns > 0 && (
              <div className="flex items-center justify-between p-3.5 bg-rose-50/40 text-rose-800">
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    يخصم: مردودات وخصومات المبيعات
                  </span>
                  <span className="text-rose-600">
                    بضائع مرتجعة أو خصومات إضافية
                  </span>
                </div>
                <span className="font-mono font-bold tabular-nums">
                  - {formatCurrency(currentSummary.salesReturns, state.settings)}
                </span>
              </div>
            )}

            {/* 3. COGS */}
            <div className="flex items-center justify-between p-3.5 bg-amber-50/30">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block text-sm">
                  2. يطرح: تكلفة البضاعة المباعة (COGS)
                </span>
                <span className="text-slate-500">
                  التكلفة الفعلية لشراء المواد التي بيعت فقط (وليس كل المشتريات)
                </span>
              </div>
              <span className="font-mono font-bold text-rose-800 text-sm tabular-nums">
                - {formatCurrency(currentSummary.cogs, state.settings)}
              </span>
            </div>

            {/* 4. Gross Profit */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 font-bold">
              <div className="space-y-0.5">
                <span className="text-slate-900 block text-sm">
                  3. الناتج: مجمل الربح (Gross Profit)
                </span>
                <span className="text-slate-500 font-normal">
                  صافي المبيعات بعد الخصومات والإرجاعات − تكلفة البضاعة المباعة
                </span>
              </div>
              <span className="font-mono font-black text-slate-900 text-base tabular-nums">
                {formatCurrency(currentSummary.grossProfit, state.settings)}
              </span>
            </div>

            {/* 5. Operating Expenses */}
            <div className="flex items-center justify-between p-3.5 bg-rose-50/30">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block text-sm">
                  4. يطرح: المصروفات التشغيلية للمتجر
                </span>
                <span className="text-slate-500">
                  أجور العمال، إيجار المحل، فواتير الكهرباء، ونقل البضائع
                </span>
              </div>
              <span className="font-mono font-bold text-rose-800 text-sm tabular-nums">
                - {formatCurrency(currentSummary.operatingExpenses, state.settings)}
              </span>
            </div>

            {/* 6. Net Operating Profit */}
            <div className="flex items-center justify-between p-4 bg-emerald-50/70 border-t-2 border-emerald-500">
              <div className="space-y-0.5">
                <span className="font-black text-slate-950 block text-base">
                  5. النتيجة النهائية: صافي الربح التشغيلي (Net Operating Profit)
                </span>
                <span className="text-emerald-800 font-medium">
                  مجمل الربح − المصروفات التشغيلية
                </span>
              </div>
              <span
                className={`font-mono font-black text-xl tabular-nums ${
                  currentSummary.netOperatingProfit >= 0
                    ? 'text-emerald-900'
                    : 'text-rose-900'
                }`}
              >
                {formatCurrency(
                  currentSummary.netOperatingProfit,
                  state.settings
                )}
              </span>
            </div>
          </div>
        </div>

        {/* 14 Key Metrics Comprehensive Grid */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">
            التفاصيل المالية والتدفقات النقدية والديون عن الفترة
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">إجمالي المشتريات للتوريد:</span>
              <span className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                {formatCurrency(currentSummary.totalPurchases, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">المقبوضات النقدية من البيع:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.cashReceivedSales, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">المبيعات الآجلة (ديون جديدة):</span>
              <span className="font-mono font-bold text-teal-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.creditSalesNew, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">مقبوضات ديون قديمة:</span>
              <span className="font-mono font-bold text-emerald-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.cashReceivedDebts, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">المدفوعات النقدية للموردين:</span>
              <span className="font-mono font-bold text-rose-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.cashPaidSuppliers, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">قيمة المخزون بنهاية الفترة:</span>
              <span className="font-mono font-bold text-amber-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.currentInventoryValue, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">إجمالي مبالغ لي عند الزبائن:</span>
              <span className="font-mono font-bold text-teal-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.totalCustomerReceivables, state.settings)}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-slate-500 block mb-0.5">إجمالي مبالغ عليّ للموردين:</span>
              <span className="font-mono font-bold text-rose-700 text-sm tabular-nums">
                {formatCurrency(currentSummary.totalSupplierPayables, state.settings)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
