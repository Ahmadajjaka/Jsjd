import React, { useState, useMemo } from 'react';
import {
  Receipt,
  Plus,
  Trash2,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Wallet,
  Tag,
  CheckCircle2,
  X,
} from 'lucide-react';
import { Expense, StoreSettings } from '../types/accounting';
import {
  formatCurrency,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';

interface ExpensesViewProps {
  expenses: Expense[];
  settings: StoreSettings;
  onSaveExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export const ExpensesView: React.FC<ExpensesViewProps> = ({
  expenses,
  settings,
  onSaveExpense,
  onDeleteExpense,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Form State
  const [date, setDate] = useState(getTodayDateString());
  const [time, setTime] = useState(getCurrentTimeString());
  const [category, setCategory] = useState(settings.expenseCategories[0] || 'أجور عمال');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank'>('cash');
  const [notes, setNotes] = useState('');

  const today = getTodayDateString();
  const currentMonth = today.substring(0, 7);

  // Stats
  const todayTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date === today)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, today]);

  const monthTotal = useMemo(() => {
    return expenses
      .filter((e) => e.date.startsWith(currentMonth))
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses, currentMonth]);

  const allTimeTotal = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (selectedCategory !== 'all' && e.category !== selectedCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            e.description.toLowerCase().includes(q) ||
            e.category.toLowerCase().includes(q) ||
            e.date.includes(q) ||
            (e.notes && e.notes.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .reverse();
  }, [expenses, selectedCategory, searchQuery]);

  // Handle open modal
  const handleOpenModal = () => {
    setDate(getTodayDateString());
    setTime(getCurrentTimeString());
    setCategory(settings.expenseCategories[0] || 'أجور عمال');
    setDescription('');
    setAmount(0);
    setPaymentMethod('cash');
    setNotes('');
    setIsModalOpen(true);
  };

  // Submit expense
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      alert('يرجى إدخال وصف المصروف');
      return;
    }
    if (amount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date,
      time,
      category,
      description: description.trim(),
      amount: Number(amount),
      paymentMethod,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveExpense(newExpense);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر المصروفات التشغيلية اليومية
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تسجيل أجور العمال، إيجار المحل، الكهرباء، والنقل لخصمها بدقة من صافي أرباح المتجر
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>تسجيل مصروف جديد</span>
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">مصروفات اليوم</span>
          <span className="text-xl font-bold font-mono text-rose-700 tabular-nums">
            {formatCurrency(todayTotal, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            مخصومة مباشرة من الصندوق
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي مصروفات هذا الشهر
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(monthTotal, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            تخصم من مجمل الربح لتحديد صافي الربح
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي المصروفات التراكمية
          </span>
          <span className="text-xl font-bold font-mono text-slate-700 tabular-nums">
            {formatCurrency(allTimeTotal, settings)}
          </span>
        </div>
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث بوصف المصروف، التصنيف، أو التاريخ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
          >
            <option value="all">جميع التصنيفات</option>
            {settings.expenseCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">التاريخ والوقت</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4">البيان والوصف</th>
                <th className="py-3 px-4 text-left">المبلغ</th>
                <th className="py-3 px-4 text-center">طريقة الدفع</th>
                <th className="py-3 px-4">ملاحظات</th>
                <th className="py-3 px-4 text-center">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد مصروفات مسجلة مطابقة.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                      {exp.date} · {exp.time}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-left font-mono font-bold text-rose-700 tabular-nums">
                      {formatCurrency(exp.amount, settings)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-slate-600">
                        {exp.paymentMethod === 'cash' ? 'الصندوق النقدي' : 'حساب بنكي'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {exp.notes || '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`هل أنت متأكد من حذف مصروف «${exp.description}»؟`)) {
                            onDeleteExpense(exp.id);
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                تسجيل مصروف تشغيلي جديد
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    التاريخ
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    الوقت
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  تصنيف المصروف
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {settings.expenseCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  وصف وبيان المصروف *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: يومية عمال تنزيل شاحنة الرمل..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المبلغ المدفوع *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  placeholder="المبلغ..."
                  value={amount || ''}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  طريقة الدفع
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="cash">نقداً من الصندوق (يخصم فوراً)</option>
                  <option value="bank">حساب بنكي / تحويل</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات أو رقم الإيصال
                </label>
                <input
                  type="text"
                  placeholder="رقم وصل رسمي أو اسم الشخص المستلم..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  حفظ المصروف وخصم الصندوق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
