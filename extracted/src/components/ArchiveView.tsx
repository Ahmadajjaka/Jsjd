import React, { useState, useMemo } from 'react';
import {
  CalendarDays,
  Calendar,
  FolderOpen,
  Search,
  ShoppingCart,
  Truck,
  Receipt,
  TrendingUp,
  TrendingDown,
  Printer,
  ChevronLeft,
  ChevronRight,
  FileText,
  DollarSign,
} from 'lucide-react';
import { AppState } from '../utils/storage';
import {
  ARABIC_MONTHS,
  computeFinancialSummary,
  formatCurrency,
  getTodayDateString,
} from '../utils/accounting';
import { exportSalesReportPdf } from '../utils/pdfExport';
import { SaleInvoice } from '../types/accounting';

interface ArchiveViewProps {
  state: AppState;
  onPreviewInvoice: (invoice: SaleInvoice) => void;
}

export const ArchiveView: React.FC<ArchiveViewProps> = ({
  state,
  onPreviewInvoice,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthNum);
  const [archiveSearchQuery, setArchiveSearchQuery] = useState('');

  // Years list (e.g. 2025, 2026, 2027)
  const availableYears = [currentYear - 1, currentYear, currentYear + 1];

  // Month date range
  const monthPrefix = `${selectedYear}-${selectedMonth}`;
  const startDate = `${monthPrefix}-01`;
  const endDate = `${monthPrefix}-31`;

  const selectedMonthObj = ARABIC_MONTHS.find((m) => m.num === selectedMonth);
  const monthName = selectedMonthObj ? selectedMonthObj.name : selectedMonth;

  // Monthly summary
  const monthSummary = useMemo(() => {
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
      periodLabel: `${monthName} ${selectedYear}`,
      initialCash: state.settings.initialCash,
    });
  }, [state, startDate, endDate, monthName, selectedYear]);

  // Month's sales invoices
  const monthSales = useMemo(() => {
    return state.sales
      .filter((s) => s.date.startsWith(monthPrefix))
      .filter((s) => {
        if (!archiveSearchQuery.trim()) return true;
        const q = archiveSearchQuery.toLowerCase();
        return (
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          s.items.some((it) => it.productName.toLowerCase().includes(q))
        );
      })
      .reverse();
  }, [state.sales, monthPrefix, archiveSearchQuery]);

  // Month's purchases
  const monthPurchases = useMemo(() => {
    return state.purchases
      .filter((p) => p.date.startsWith(monthPrefix))
      .reverse();
  }, [state.purchases, monthPrefix]);

  // Month's expenses
  const monthExpenses = useMemo(() => {
    return state.expenses
      .filter((e) => e.date.startsWith(monthPrefix))
      .reverse();
  }, [state.expenses, monthPrefix]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            الأرشيف الشهري والسنوي الدائم
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تصفح تاريخ وسجلات المتجر حسب السنوات والأشهر دون فقدان أي بيانات سابقة
          </p>
        </div>

        {/* Year Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl">
          {availableYears.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setSelectedYear(y)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                selectedYear === y
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900'
              }`}
            >
              سنة {y}
            </button>
          ))}
        </div>
      </div>

      {/* 12 Months Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
        {ARABIC_MONTHS.map((m) => {
          const isSelected = selectedMonth === m.num;
          const mPrefix = `${selectedYear}-${m.num}`;
          const monthSalesCount = state.sales.filter((s) =>
            s.date.startsWith(mPrefix)
          ).length;

          return (
            <button
              key={m.num}
              type="button"
              onClick={() => setSelectedMonth(m.num)}
              className={`flex flex-col items-start p-3 rounded-xl border text-right transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-400'
                  : 'bg-white text-slate-900 border-slate-200 hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-[11px] font-mono opacity-60">
                  {m.num} / {selectedYear}
                </span>
                <FolderOpen className={`w-3.5 h-3.5 ${isSelected ? 'text-amber-400' : 'text-slate-400'}`} />
              </div>
              <span className="text-xs font-bold">{m.name}</span>
              <span className={`text-[10px] mt-1 ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                {monthSalesCount} فاتورة بيع
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Month Dashboard Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <span className="text-xs text-slate-500 block">ملف الأرشيف المفتوح حالياً</span>
            <h3 className="text-lg font-black text-slate-900">
              أرشيف: {monthName} لسنة {selectedYear}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 text-xs font-black rounded-lg ${
                monthSummary.performanceStatus === 'profitable'
                  ? 'bg-emerald-100 text-emerald-800'
                  : monthSummary.performanceStatus === 'loss'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-slate-100 text-slate-700'
              }`}
            >
              نتيجة الشهر: {monthSummary.performanceStatus === 'profitable' ? 'رابح' : monthSummary.performanceStatus === 'loss' ? 'خاسر' : 'متعادل'}
            </span>
            <button
              type="button"
              onClick={() => exportSalesReportPdf('month', monthSales, state.settings, monthSummary)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="طباعة وتصدير تقرير مبيعات هذا الشهر كملف PDF"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>طباعة PDF</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Monthly KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-0.5">إجمالي المبيعات:</span>
            <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(monthSummary.grossSales, state.settings)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-0.5">إجمالي المشتريات:</span>
            <span className="text-base font-bold font-mono text-slate-900 tabular-nums">
              {formatCurrency(monthSummary.totalPurchases, state.settings)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-500 block mb-0.5">المصروفات التشغيلية:</span>
            <span className="text-base font-bold font-mono text-rose-700 tabular-nums">
              {formatCurrency(monthSummary.operatingExpenses, state.settings)}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 rounded-xl border border-emerald-200">
            <span className="text-xs text-emerald-800 block mb-0.5 font-semibold">صافي الربح الفعلي:</span>
            <span className="text-base font-black font-mono text-emerald-950 tabular-nums">
              {formatCurrency(monthSummary.netOperatingProfit, state.settings)}
            </span>
          </div>
        </div>

        {/* Search input in active month archive */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث في فواتير هذا الشهر برقم الفاتورة، اسم الزبون، أو المادة المباعة..."
            value={archiveSearchQuery}
            onChange={(e) => setArchiveSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
          />
        </div>

        {/* Month Invoices Table */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700">
            فواتير المبيعات المسجلة خلال {monthName} ({monthSales.length})
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">رقم الفاتورة</th>
                  <th className="py-2.5 px-3">التاريخ والوقت</th>
                  <th className="py-2.5 px-3">الزبون</th>
                  <th className="py-2.5 px-3 text-left">قيمة الفاتورة</th>
                  <th className="py-2.5 px-3 text-left">المدفوع نقداً</th>
                  <th className="py-2.5 px-3 text-left">الدين المتبقي</th>
                  <th className="py-2.5 px-3 text-left">الربح</th>
                  <th className="py-2.5 px-3 text-center">معاينة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthSales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      لا توجد فواتير مبيعات مسجلة في هذا الشهر.
                    </td>
                  </tr>
                ) : (
                  monthSales.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-600">
                        {inv.date} · {inv.time}
                      </td>
                      <td className="py-2 px-3 font-bold text-slate-800">
                        {inv.customerName}
                      </td>
                      <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(inv.total, state.settings)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-emerald-700 tabular-nums font-semibold">
                        {formatCurrency(inv.paidAmount, state.settings)}
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-rose-700 tabular-nums">
                        {inv.remainingAmount > 0
                          ? formatCurrency(inv.remainingAmount, state.settings)
                          : '-'}
                      </td>
                      <td className="py-2 px-3 text-left font-mono text-teal-700 tabular-nums">
                        {formatCurrency(inv.grossProfit, state.settings)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onPreviewInvoice(inv)}
                          className="p-1 text-slate-600 hover:text-slate-900 rounded-md"
                          title="معاينة وطباعة الفاتورة"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
