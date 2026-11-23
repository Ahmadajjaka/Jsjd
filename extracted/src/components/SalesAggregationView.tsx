import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Filter,
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Users,
  Boxes,
  FileDown,
  Printer,
  ChevronLeft,
  Search,
  Eye,
  CheckCircle2,
  Clock,
  RotateCcw,
  Tag,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { Customer, Product, SaleInvoice, StoreSettings } from '../types/accounting';
import {
  ARABIC_MONTHS,
  formatCurrency,
  formatNumber,
  getTodayDateString,
  downloadCSV,
} from '../utils/accounting';
import {
  exportInvoicePdf,
  exportSalesAggregationPdf,
  SalesAggregationData,
} from '../utils/pdfExport';

interface SalesAggregationViewProps {
  sales: SaleInvoice[];
  customers: Customer[];
  products: Product[];
  settings: StoreSettings;
  onPreviewInvoice: (invoice: SaleInvoice) => void;
  onOpenQuickSale?: () => void;
}

export const SalesAggregationView: React.FC<SalesAggregationViewProps> = ({
  sales,
  customers,
  products,
  settings,
  onPreviewInvoice,
  onOpenQuickSale,
}) => {
  const today = getTodayDateString();
  const currentYear = today.split('-')[0];
  const currentMonth = today.split('-')[1];

  // Aggregation Mode
  const [mode, setMode] = useState<'month' | 'range'>('month');

  // Month mode state
  const [selectedYear, setSelectedYear] = useState<string>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Range mode state
  const [startDate, setStartDate] = useState<string>(`${currentYear}-${currentMonth}-01`);
  const [endDate, setEndDate] = useState<string>(today);

  // Extra filters
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<'all' | 'cash' | 'debt' | 'partial'>('all');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Quick preset helper
  const applyPreset = (preset: 'this_month' | 'last_month' | 'this_week' | 'today') => {
    const now = new Date();
    if (preset === 'today') {
      setMode('range');
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'this_week') {
      setMode('range');
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      const sStr = start.toISOString().split('T')[0];
      setStartDate(sStr);
      setEndDate(today);
    } else if (preset === 'this_month') {
      setMode('month');
      setSelectedYear(currentYear);
      setSelectedMonth(currentMonth);
    } else if (preset === 'last_month') {
      setMode('month');
      const prevDate = new Date(Number(currentYear), Number(currentMonth) - 2, 1);
      setSelectedYear(prevDate.getFullYear().toString());
      setSelectedMonth(String(prevDate.getMonth() + 1).padStart(2, '0'));
    }
  };

  // Compute effective date range
  const { effectiveStart, effectiveEnd, periodLabel } = useMemo(() => {
    if (mode === 'month') {
      const start = `${selectedYear}-${selectedMonth}-01`;
      // calculate last day of month
      const lastDay = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
      const end = `${selectedYear}-${selectedMonth}-${String(lastDay).padStart(2, '0')}`;
      const monthObj = ARABIC_MONTHS.find((m) => m.num === selectedMonth);
      const label = `شهر ${monthObj ? monthObj.name : selectedMonth} ${selectedYear}`;
      return { effectiveStart: start, effectiveEnd: end, periodLabel: label };
    } else {
      return {
        effectiveStart: startDate,
        effectiveEnd: endDate,
        periodLabel: `الفترة من ${startDate} إلى ${endDate}`,
      };
    }
  }, [mode, selectedYear, selectedMonth, startDate, endDate]);

  // Filter sales matching period and criteria
  const matchingSales = useMemo(() => {
    return sales.filter((s) => {
      if (s.date < effectiveStart || s.date > effectiveEnd) return false;
      if (filterCustomerId !== 'all' && s.customerId !== filterCustomerId) return false;
      if (filterPaymentMethod !== 'all' && s.paymentMethod !== filterPaymentMethod) return false;
      return true;
    });
  }, [sales, effectiveStart, effectiveEnd, filterCustomerId, filterPaymentMethod]);

  // Completed vs Returned
  const completedSales = useMemo(() => matchingSales.filter((s) => s.status === 'completed'), [matchingSales]);
  const returnedSales = useMemo(() => matchingSales.filter((s) => s.status === 'returned'), [matchingSales]);

  // Metrics
  const totalGrossSales = useMemo(() => completedSales.reduce((sum, s) => sum + s.total, 0), [completedSales]);
  const totalReturns = useMemo(() => returnedSales.reduce((sum, s) => sum + s.total, 0), [returnedSales]);
  const netSales = Math.max(0, totalGrossSales);
  const totalCash = useMemo(() => completedSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0), [completedSales]);
  const totalDebt = useMemo(() => completedSales.reduce((sum, s) => sum + (s.remainingAmount || 0), 0), [completedSales]);
  const totalCogs = useMemo(() => completedSales.reduce((sum, s) => sum + (s.cogs || 0), 0), [completedSales]);
  const totalProfit = useMemo(() => completedSales.reduce((sum, s) => sum + (s.grossProfit || 0), 0), [completedSales]);
  const profitMargin = netSales > 0 ? (totalProfit / netSales) * 100 : 0;
  const averageInvoiceValue = completedSales.length > 0 ? netSales / completedSales.length : 0;

  // Breakdown by Customer
  const customerBreakdown = useMemo(() => {
    const map = new Map<string, { customerName: string; total: number; count: number; paid: number; debt: number }>();

    completedSales.forEach((s) => {
      const name = s.customerName || 'زبون نقدي';
      const existing = map.get(name) || { customerName: name, total: 0, count: 0, paid: 0, debt: 0 };
      existing.total += s.total;
      existing.count += 1;
      existing.paid += s.paidAmount || 0;
      existing.debt += s.remainingAmount || 0;
      map.set(name, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [completedSales]);

  // Breakdown by Category
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, { category: string; total: number; quantity: number }>();

    completedSales.forEach((s) => {
      s.items.forEach((item) => {
        const cat = item.category || 'عامة';
        const existing = map.get(cat) || { category: cat, total: 0, quantity: 0 };
        existing.total += item.total || 0;
        existing.quantity += item.quantity || 0;
        map.set(cat, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [completedSales]);

  // Breakdown by Product
  const productBreakdown = useMemo(() => {
    const map = new Map<string, { productName: string; quantity: number; total: number; profit: number }>();

    completedSales.forEach((s) => {
      s.items.forEach((item) => {
        const name = item.productName || 'مادة';
        const existing = map.get(name) || { productName: name, quantity: 0, total: 0, profit: 0 };
        existing.quantity += item.quantity || 0;
        existing.total += item.total || 0;
        existing.profit += item.profit || 0;
        map.set(name, existing);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [completedSales]);

  // Daily Trend within period
  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { date: string; total: number; count: number; profit: number }>();

    completedSales.forEach((s) => {
      const d = s.date;
      const existing = map.get(d) || { date: d, total: 0, count: 0, profit: 0 };
      existing.total += s.total;
      existing.count += 1;
      existing.profit += s.grossProfit || 0;
      map.set(d, existing);
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [completedSales]);

  const maxDailyTotal = useMemo(() => {
    return Math.max(...dailyBreakdown.map((d) => d.total), 1);
  }, [dailyBreakdown]);

  // Table search
  const searchedInvoices = useMemo(() => {
    if (!tableSearchQuery.trim()) return matchingSales;
    const q = tableSearchQuery.toLowerCase();
    return matchingSales.filter(
      (s) => s.invoiceNumber.toLowerCase().includes(q) || s.customerName.toLowerCase().includes(q)
    );
  }, [matchingSales, tableSearchQuery]);

  // Export Aggregation to PDF
  const handleExportPdf = () => {
    const data: SalesAggregationData = {
      periodLabel,
      startDate: effectiveStart,
      endDate: effectiveEnd,
      totalSales: netSales,
      totalCash,
      totalDebt,
      totalCogs,
      totalProfit,
      profitMargin,
      invoicesCount: completedSales.length,
      returnsCount: returnedSales.length,
      returnsTotal: totalReturns,
      averageInvoiceValue,
      sales: matchingSales,
      customerBreakdown,
      categoryBreakdown,
      productBreakdown,
    };
    exportSalesAggregationPdf(data, settings);
  };

  // Export Aggregation to CSV
  const handleExportCsv = () => {
    const headers = [
      'رقم الفاتورة',
      'التاريخ',
      'الوقت',
      'اسم الزبون',
      'طريقة الدفع',
      'عدد المواد',
      'إجمالي الفاتورة',
      'المقبوض نقداً',
      'المتبقي دين',
      'مجمل الربح',
      'الحالة',
    ];
    const rows = matchingSales.map((s) => [
      s.invoiceNumber,
      s.date,
      s.time,
      s.customerName,
      s.paymentMethod,
      s.items.length,
      s.total,
      s.paidAmount || 0,
      s.remainingAmount || 0,
      s.grossProfit || 0,
      s.status,
    ]);
    downloadCSV(`تجميع_مبيعات_${effectiveStart}_إلى_${effectiveEnd}`, headers, rows);
  };

  return (
    <div className="space-y-6 font-['Cairo',sans-serif]">
      {/* Header & Controls Toolbar */}
      <div className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-amber-500 font-bold text-xs mb-1">
              <Calendar className="w-4 h-4" />
              <span>نظام التجميع والتدقيق المالي للمبيعات</span>
            </div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              تجميع مبيعات شهر كامل أو مدة محددة
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحليل إجمالي المبيعات، المقبوضات النقدية، الديون الآجلة، والأرباح المحققة مع كشوفات تفصيلية
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {onOpenQuickSale && (
              <button
                type="button"
                onClick={onOpenQuickSale}
                className="px-3.5 py-2 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>+ مبيع زبون مباشر</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportPdf}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="تصدير تقرير تجميع المبيعات الكامل بصيغة PDF للطباعة"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>تصدير تقرير تجميع PDF</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
              title="تصدير البيانات إلى جدول إكسل (CSV)"
            >
              <FileDown className="w-4 h-4 text-emerald-500" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        {/* Mode Switcher & Date Controls */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mode Toggle */}
            <div className="flex items-center p-1 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setMode('month')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  mode === 'month'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                📅 تجميع شهر كامل
              </button>
              <button
                type="button"
                onClick={() => setMode('range')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  mode === 'range'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ⏳ مدة محددة مخصصة
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => applyPreset('this_month')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-amber-50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last_month')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-amber-50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                الشهر الماضي
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this_week')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-amber-50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                هذا الأسبوع
              </button>
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className="px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-amber-50 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                اليوم
              </button>
            </div>
          </div>

          {/* Month / Range Form Fields */}
          <div className="flex flex-wrap items-center gap-2.5">
            {mode === 'month' ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  {ARABIC_MONTHS.map((m) => (
                    <option key={m.num} value={m.num}>
                      {m.name}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-slate-500">من:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-slate-500">إلى:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            {/* Extra Filter: Customer */}
            <select
              value={filterCustomerId}
              onChange={(e) => setFilterCustomerId(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">كل الزبائن</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Extra Filter: Payment Method */}
            <select
              value={filterPaymentMethod}
              onChange={(e) => setFilterPaymentMethod(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">كل طرق الدفع</option>
              <option value="cash">نقداً فقط</option>
              <option value="debt">آجل / دين فقط</option>
              <option value="partial">دفع جزئي</option>
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Sales */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">إجمالي المبيعات الصافية</span>
            <ShoppingCart className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatCurrency(netSales, settings)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            عدد الفواتير: {completedSales.length} فاتورة معتمدة
          </span>
        </div>

        {/* Gross Profit */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-amber-500 mb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مجمل الأرباح المحققة</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatCurrency(totalProfit, settings)}
          </p>
          <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 mt-1 block font-mono">
            نسبة هامش الربح: {profitMargin.toFixed(1)}%
          </span>
        </div>

        {/* Cash Inflow */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-teal-600 mb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المقبوض نقداً بالصندوق</span>
            <ArrowDownLeft className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-teal-600 font-mono">
            {formatCurrency(totalCash, settings)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            متوسط الفاتورة: {formatCurrency(averageInvoiceValue, settings)}
          </span>
        </div>

        {/* Credit Debt Sales */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">مبيعات الآجل والدين</span>
            <ArrowUpRight className="w-4 h-4" />
          </div>
          <p className="text-lg sm:text-2xl font-black text-rose-600 font-mono">
            {formatCurrency(totalDebt, settings)}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            المرتجعات: {returnedSales.length} ({formatCurrency(totalReturns, settings)})
          </span>
        </div>
      </div>

      {/* Daily Sales Bar Chart */}
      {dailyBreakdown.length > 0 && (
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              تطور المبيعات اليومية خلال الفترة ({dailyBreakdown.length} أيام نشطة)
            </h3>
            <span className="text-xs text-slate-400 font-mono font-bold">
              أعلى يوم: {formatCurrency(maxDailyTotal, settings)}
            </span>
          </div>

          <div className="h-44 flex items-end gap-1.5 sm:gap-3 pt-6 pb-2 px-2 overflow-x-auto">
            {dailyBreakdown.map((d) => {
              const heightPct = Math.max(8, Math.round((d.total / maxDailyTotal) * 100));
              const dayNum = d.date.split('-')[2];
              return (
                <div key={d.date} className="flex-1 min-w-[28px] max-w-[48px] flex flex-col items-center gap-1 group relative">
                  {/* Tooltip */}
                  <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-10 font-mono font-bold shadow-md">
                    {d.date}: {formatCurrency(d.total, settings)} ({d.count} فاتورة)
                  </div>

                  <div
                    className="w-full bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-md transition-all group-hover:brightness-110 shadow-xs"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{dayNum}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdowns: Top Customers & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-500" />
              الزبائن الأعلى شراءً في الفترة ({customerBreakdown.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="p-2">الزبون</th>
                  <th className="p-2 text-center">الفواتير</th>
                  <th className="p-2 text-left">إجمالي الشراء</th>
                  <th className="p-2 text-left">المتبقي دين</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      لا توجد بيانات زبائن
                    </td>
                  </tr>
                ) : (
                  customerBreakdown.slice(0, 8).map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 font-bold text-slate-900 dark:text-white">{c.customerName}</td>
                      <td className="p-2 text-center font-mono">{c.count}</td>
                      <td className="p-2 text-left font-mono font-bold text-emerald-600">
                        {formatCurrency(c.total, settings)}
                      </td>
                      <td className="p-2 text-left font-mono">
                        {c.debt > 0 ? (
                          <span className="text-rose-600 font-bold">{formatCurrency(c.debt, settings)}</span>
                        ) : (
                          <span className="text-slate-400">خالص</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-500" />
              المواد الأكثر مبيعاً في الفترة ({productBreakdown.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-bold">
                <tr>
                  <th className="p-2">المادة</th>
                  <th className="p-2 text-center">الكمية</th>
                  <th className="p-2 text-left">المبيعات</th>
                  <th className="p-2 text-left">الربح المقدر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {productBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-slate-400">
                      لا توجد بيانات مواد
                    </td>
                  </tr>
                ) : (
                  productBreakdown.slice(0, 8).map((p, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 font-bold text-slate-900 dark:text-white">{p.productName}</td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                        {p.quantity}
                      </td>
                      <td className="p-2 text-left font-mono font-bold text-emerald-600">
                        {formatCurrency(p.total, settings)}
                      </td>
                      <td className="p-2 text-left font-mono font-bold text-amber-600">
                        {formatCurrency(p.profit, settings)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detailed Invoices Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              سجل فواتير الفترة المجمعة ({searchedInvoices.length} فاتورة)
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              [المجموع: {formatCurrency(netSales, settings)}]
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={(e) => setTableSearchQuery(e.target.value)}
              placeholder="بحث برقم الفاتورة أو الزبون..."
              className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
              <tr>
                <th className="p-3">رقم الفاتورة</th>
                <th className="p-3">التاريخ والوقت</th>
                <th className="p-3">اسم الزبون</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3 text-center">الأصناف</th>
                <th className="p-3 text-left">الصافي</th>
                <th className="p-3 text-left">الربح</th>
                <th className="p-3 text-center">الحالة</th>
                <th className="p-3 text-center">معاينة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {searchedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    لا توجد فواتير مطابقة للفترة المحددة.
                  </td>
                </tr>
              ) : (
                searchedInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">
                      <code>{inv.invoiceNumber}</code>
                    </td>
                    <td className="p-3 text-slate-500 font-mono">
                      {inv.date} <span className="text-[10px] text-slate-400">{inv.time}</span>
                    </td>
                    <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{inv.customerName}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.paymentMethod === 'cash'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                            : inv.paymentMethod === 'debt'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                        }`}
                      >
                        {inv.paymentMethod === 'cash' ? 'نقداً' : inv.paymentMethod === 'debt' ? 'آجل' : 'جزئي'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono">{inv.items.length}</td>
                    <td className="p-3 text-left font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(inv.total, settings)}
                    </td>
                    <td className="p-3 text-left font-mono text-amber-600 font-bold">
                      {formatCurrency(inv.grossProfit, settings)}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`text-[10px] font-bold ${
                          inv.status === 'completed' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {inv.status === 'completed' ? 'معتمدة' : 'مرتجعة'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(inv)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          title="معاينة وطباعة الفاتورة"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            exportInvoicePdf(
                              inv,
                              settings,
                              settings.invoicePrintLayout || 'thermal80',
                              true
                            )
                          }
                          className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                          title="تنزيل الفاتورة بصيغة PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
