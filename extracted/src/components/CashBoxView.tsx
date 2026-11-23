import React, { useState, useMemo } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  Scale,
  DollarSign,
  Download,
  Trash2,
} from 'lucide-react';
import {
  CashTransaction,
  CashTransactionType,
  StoreSettings,
} from '../types/accounting';
import {
  downloadCSV,
  formatCurrency,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';

interface CashBoxViewProps {
  cashTransactions: CashTransaction[];
  settings: StoreSettings;
  onAddTransaction: (tx: Omit<CashTransaction, 'id' | 'runningBalance'>) => void;
  onDeleteTransaction?: (txId: string) => void;
}

export const CashBoxView: React.FC<CashBoxViewProps> = ({
  cashTransactions,
  settings,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modals
  const [isCashFlowModalOpen, setIsCashFlowModalOpen] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);

  // Cash flow modal state
  const [flowType, setFlowType] = useState<'capital_deposit' | 'personal_withdrawal'>(
    'capital_deposit'
  );
  const [flowAmount, setFlowAmount] = useState<number>(0);
  const [flowDescription, setFlowDescription] = useState('');
  const [flowDate, setFlowDate] = useState(getTodayDateString());
  const [flowTime, setFlowTime] = useState(getCurrentTimeString());

  // Reconciliation modal state
  const [physicalCashCounted, setPhysicalCashCounted] = useState<number>(0);
  const [reconciliationNotes, setReconciliationNotes] = useState('');

  // Current balance
  const currentBalance = useMemo(() => {
    if (cashTransactions.length === 0) return settings.initialCash;
    return cashTransactions[cashTransactions.length - 1].runningBalance;
  }, [cashTransactions, settings.initialCash]);

  // Total In & Out
  const totalIn = useMemo(() => {
    return cashTransactions
      .filter((t) => t.flow === 'in')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [cashTransactions]);

  const totalOut = useMemo(() => {
    return cashTransactions
      .filter((t) => t.flow === 'out')
      .reduce((sum, t) => sum + t.amount, 0);
  }, [cashTransactions]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return cashTransactions
      .filter((tx) => {
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            tx.description.toLowerCase().includes(q) ||
            tx.date.includes(q) ||
            (tx.referenceNumber && tx.referenceNumber.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .reverse();
  }, [cashTransactions, typeFilter, searchQuery]);

  // Type label helper
  const getTypeBadge = (type: CashTransactionType) => {
    switch (type) {
      case 'sale_receipt':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">مقبوضات مبيعات</span>;
      case 'customer_payment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-700">تحصيل دين زبون</span>;
      case 'supplier_payment':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">سداد دفعة لمورد</span>;
      case 'expense':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">مصروف تشغيلي</span>;
      case 'capital_deposit':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700">إيداع رأس مال</span>;
      case 'personal_withdrawal':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700">مسحوبات شخصية</span>;
      case 'sale_return_refund':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700">إرجاع مبيعات نقداً</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">تسوية / رصيد</span>;
    }
  };

  // Submit flow
  const handleCashFlowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (flowAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }
    if (!flowDescription.trim()) {
      alert('يرجى كتابة بيان وتفاصيل الحركة');
      return;
    }

    onAddTransaction({
      date: flowDate,
      time: flowTime,
      type: flowType,
      description: flowDescription.trim(),
      flow: flowType === 'capital_deposit' ? 'in' : 'out',
      amount: Number(flowAmount),
    });

    setIsCashFlowModalOpen(false);
    setFlowAmount(0);
    setFlowDescription('');
  };

  // Submit reconciliation
  const handleReconciliationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const diff = Number(physicalCashCounted) - currentBalance;

    if (diff === 0) {
      alert('الصندوق الفعلي مطابق تماماً للرصيد الدفتري المسجل!');
      setIsReconciliationModalOpen(false);
      return;
    }

    onAddTransaction({
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      type: 'inventory_adjustment_cash',
      description: `مطابقة صندوق: ${diff > 0 ? 'فائض نقدي' : 'عجز نقدي'} بمقدار ${formatCurrency(Math.abs(diff), settings)} - ${reconciliationNotes.trim()}`,
      flow: diff > 0 ? 'in' : 'out',
      amount: Math.abs(diff),
    });

    setIsReconciliationModalOpen(false);
    setPhysicalCashCounted(0);
    setReconciliationNotes('');
  };

  // Export CSV
  const handleExportCSV = () => {
    const headers = [
      'التاريخ',
      'الوقت',
      'النوع',
      'البيان',
      'الاتجاه',
      'المبلغ',
      'الرصيد التراكمي',
      'المرجع',
    ];

    const rows = cashTransactions.map((tx) => [
      tx.date,
      tx.time,
      tx.type,
      tx.description,
      tx.flow === 'in' ? 'داخل (+)' : 'خارج (-)',
      tx.amount,
      tx.runningBalance,
      tx.referenceNumber || '',
    ]);

    downloadCSV(`حركات_صندوق_خردوات_المامو_${getTodayDateString()}`, headers, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر الصندوق والحركات النقدية (الخزينة)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل دقيق لجميع المقبوضات والمدفوعات الفعلية ومطابقة النقد بالدرج
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            تصدير CSV
          </button>

          <button
            type="button"
            onClick={() => {
              setPhysicalCashCounted(currentBalance);
              setIsReconciliationModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors shadow-xs"
          >
            <Scale className="w-4 h-4" />
            <span>مطابقة الصندوق الفعلي</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCashFlowModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>إيداع رأس مال / سحب شخصي</span>
          </button>
        </div>
      </div>

      {/* 3 Main Treasury KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-5 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-xs">
          <span className="text-xs text-emerald-800 font-semibold block mb-1">
            رصيد الصندوق النقدي الحالي
          </span>
          <span className="text-2xl font-black font-mono text-emerald-950 tabular-nums">
            {formatCurrency(currentBalance, settings)}
          </span>
          <span className="text-[11px] text-emerald-700 block mt-1">
            النقد المتوفر بالدرج الآن
          </span>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي المقبوضات النقدية الداخلة
          </span>
          <span className="text-xl font-bold font-mono text-emerald-700 tabular-nums">
            + {formatCurrency(totalIn, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            مبيعات نقداً + تحصيل ديون + إيداعات
          </span>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي المدفوعات النقدية الخارجة
          </span>
          <span className="text-xl font-bold font-mono text-rose-700 tabular-nums">
            - {formatCurrency(totalOut, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            مشتريات نقداً + سداد موردين + مصروفات
          </span>
        </div>
      </div>

      {/* Accounting Notice */}
      <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p>
          <strong>قواعد محاسبية دقيقة:</strong> المسحوبات الشخصية للمالك لا تعتبر مصروفات تشغيلية ولا تخصم من أرباح المتجر. كذلك إيداعات رأس المال لا تعتبر مبيعات. تحصيل دين قديم لا يعتبر بيعاً جديداً، وسداد دين المورد لا يعتبر شراءً جديداً.
        </p>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بالبيان، التاريخ، أو رقم المرجع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
          >
            <option value="all">جميع أنواع الحركات</option>
            <option value="sale_receipt">مقبوضات مبيعات</option>
            <option value="customer_payment">تحصيل ديون زبائن</option>
            <option value="supplier_payment">سداد لموردين</option>
            <option value="expense">مصروفات تشغيلية</option>
            <option value="capital_deposit">إيداع رأس مال</option>
            <option value="personal_withdrawal">مسحوبات شخصية</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">نوع الحركة</th>
                <th className="py-3 px-4">البيان والتفاصيل</th>
                <th className="py-3 px-4 text-left">المبلغ</th>
                <th className="py-3 px-4 text-left">الرصيد بعد الحركة</th>
                <th className="py-3 px-4 text-center">المرجع</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد حركات نقدية مطابقة.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {tx.date} · {tx.time}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getTypeBadge(tx.type)}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {tx.description}
                    </td>
                    <td
                      className={`py-3 px-4 text-left font-mono font-bold tabular-nums whitespace-nowrap ${
                        tx.flow === 'in' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {tx.flow === 'in' ? '+' : '-'} {formatCurrency(tx.amount, settings)}
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatCurrency(tx.runningBalance, settings)}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-500 text-[11px]">
                      {tx.referenceNumber || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {onDeleteTransaction && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(tx.id)}
                          title="حذف الحركة النقدية من قاعدة البيانات (Firebase)"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Capital Deposit / Owner Withdrawal Modal */}
      {isCashFlowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                تسجيل حركة رأس مال أو مسحوبات شخصية
              </h3>
              <button
                type="button"
                onClick={() => setIsCashFlowModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCashFlowSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  نوع الحركة المالية
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setFlowType('capital_deposit')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      flowType === 'capital_deposit'
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    إيداع رأس مال (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowType('personal_withdrawal')}
                    className={`py-2 text-xs font-bold rounded-lg transition-all ${
                      flowType === 'personal_withdrawal'
                        ? 'bg-white text-purple-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    مسحوبات شخصية للمالك (-)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    required
                    value={flowDate}
                    onChange={(e) => setFlowDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    الوقت
                  </label>
                  <input
                    type="time"
                    value={flowTime}
                    onChange={(e) => setFlowTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المبلغ *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  placeholder="المبلغ..."
                  value={flowAmount || ''}
                  onChange={(e) => setFlowAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  البيان والسبب *
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    flowType === 'capital_deposit'
                      ? 'مثال: إيداع دعم سيولة من المالك في الصندوق...'
                      : 'مثال: سحب مصاريف منزل المالك الخاصة...'
                  }
                  value={flowDescription}
                  onChange={(e) => setFlowDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCashFlowModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  حفظ الحركة بالصندوق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cash Reconciliation Modal (مطابقة الصندوق الفعلي) */}
      {isReconciliationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                مطابقة الصندوق الفعلي والعد اليدوي
              </h3>
              <button
                type="button"
                onClick={() => setIsReconciliationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReconciliationSubmit} className="space-y-3.5">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-600">
                  <span>الرصيد الدفتري المسجل بالنظام:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(currentBalance, settings)}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المبلغ المعدود يدوياً في درج الكاشير الآن
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={physicalCashCounted}
                  onChange={(e) => setPhysicalCashCounted(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="p-3 rounded-xl border text-xs">
                {Number(physicalCashCounted) - currentBalance === 0 ? (
                  <span className="font-bold text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    الصندوق متطابق تماماً ولا يوجد أي فرق!
                  </span>
                ) : (
                  <div className="space-y-1">
                    <span
                      className={`font-bold block ${
                        Number(physicalCashCounted) - currentBalance > 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {Number(physicalCashCounted) - currentBalance > 0
                        ? `يوجد زيادة (فائض) في الصندوق بمقدار: ${formatCurrency(
                            Number(physicalCashCounted) - currentBalance,
                            settings
                          )}`
                        : `يوجد نقص (عجز) في الصندوق بمقدار: ${formatCurrency(
                            Math.abs(Number(physicalCashCounted) - currentBalance),
                            settings
                          )}`}
                    </span>
                    <span className="text-[11px] text-slate-500 block">
                      سيتم تسجيل حركة تسوية بالصندوق لضبط الرصيد الفعلي.
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات المطابقة
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات جرد إغلاق الوردية، أسماء المستلمين..."
                  value={reconciliationNotes}
                  onChange={(e) => setReconciliationNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReconciliationModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  اعتماد التسوية والمطابقة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Cash Transaction Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                حذف الحركة النقدية من قاعدة البيانات (Firebase)
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              تحذير: هل أنت متأكد من حذف هذا القيد النقدي تماماً من قاعدة بيانات Firebase السحابية؟
              سيتم إعادة احتساب الرصيد التراكمي وتحديث سعة التخزين السحابي.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTransaction && deleteConfirmId) {
                    onDeleteTransaction(deleteConfirmId);
                  }
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                تأكيد الحذف من Firebase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
