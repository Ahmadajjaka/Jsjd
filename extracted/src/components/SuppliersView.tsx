import React, { useState, useMemo, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  Printer,
  Phone,
  MapPin,
  ArrowUpRight,
  Truck,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import {
  PurchaseInvoice,
  StoreSettings,
  Supplier,
  SupplierPayment,
} from '../types/accounting';
import {
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';
import { exportSingleSupplierStatementPdf } from '../utils/pdfExport';

interface SuppliersViewProps {
  suppliers: Supplier[];
  purchases: PurchaseInvoice[];
  supplierPayments: SupplierPayment[];
  settings: StoreSettings;
  onSaveSupplier: (supplier: Supplier) => void;
  onRecordSupplierPayment: (payment: SupplierPayment) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  initialSupplierId?: string;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({
  suppliers,
  purchases,
  supplierPayments,
  settings,
  onSaveSupplier,
  onRecordSupplierPayment,
  onDeleteSupplier,
  initialSupplierId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    initialSupplierId || null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSupplierId) {
      setSelectedSupplierId(initialSupplierId);
    }
  }, [initialSupplierId]);

  // Modals
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingSupplierId, setPayingSupplierId] = useState<string>('');

  // Supplier Form
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialDebt, setInitialDebt] = useState<number>(0);
  const [notes, setNotes] = useState('');

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentTime, setPaymentTime] = useState(getCurrentTimeString());
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Stats
  const totalPayables = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + Math.max(0, s.totalDebt), 0);
  }, [suppliers]);

  const activeCreditorsCount = useMemo(() => {
    return suppliers.filter((s) => s.totalDebt > 0).length;
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.company && s.company.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(q))
      );
    });
  }, [suppliers, searchQuery]);

  const selectedSupplier = useMemo(() => {
    return suppliers.find((s) => s.id === selectedSupplierId) || null;
  }, [suppliers, selectedSupplierId]);

  const supplierPurchasesList = useMemo(() => {
    if (!selectedSupplierId) return [];
    return purchases.filter((p) => p.supplierId === selectedSupplierId).reverse();
  }, [purchases, selectedSupplierId]);

  const supplierPaymentsList = useMemo(() => {
    if (!selectedSupplierId) return [];
    return supplierPayments.filter((p) => p.supplierId === selectedSupplierId).reverse();
  }, [supplierPayments, selectedSupplierId]);

  // Handle Save New Supplier
  const handleSaveSupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم المورد');
      return;
    }

    const newSupp: Supplier = {
      id: `supp-${Date.now()}`,
      name: name.trim(),
      company: company.trim(),
      phone: phone.trim(),
      address: address.trim(),
      totalPurchases: Number(initialDebt) || 0,
      totalPaid: 0,
      totalDebt: Number(initialDebt) || 0,
      notes: notes.trim(),
      createdAt: getTodayDateString(),
    };

    onSaveSupplier(newSupp);
    setIsAddSupplierModalOpen(false);
    setName('');
    setCompany('');
    setPhone('');
    setAddress('');
    setInitialDebt(0);
    setNotes('');
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (supplierId: string) => {
    const s = suppliers.find((supp) => supp.id === supplierId);
    if (!s) return;
    setPayingSupplierId(supplierId);
    setPaymentAmount(s.totalDebt > 0 ? s.totalDebt : 0);
    setPaymentDate(getTodayDateString());
    setPaymentTime(getCurrentTimeString());
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Submit Supplier Payment
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = suppliers.find((supp) => supp.id === payingSupplierId);
    if (!s) return;

    if (paymentAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const payment: SupplierPayment = {
      id: `sp-${Date.now()}`,
      paymentNumber: `ص-${1000 + supplierPayments.length + 1}`,
      date: paymentDate,
      time: paymentTime,
      supplierId: s.id,
      supplierName: s.name,
      amount: Number(paymentAmount),
      paymentMethod,
      notes: paymentNotes.trim(),
    };

    onRecordSupplierPayment(payment);
    setIsPaymentModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر الموردين وحسابات التوريد
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            سجل الموردين، أرصدة الذمم الدائنة، كشوفات الحساب، وسندات صرف الدفعات
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddSupplierModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4 text-amber-400" />
          <span>إضافة مورد جديد</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي الديون التي عليّ للموردين
          </span>
          <span className="text-xl font-bold font-mono text-rose-700 tabular-nums">
            {formatCurrency(totalPayables, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            ذمم دائنة مستحقة السداد للشركات
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            عدد الموردين الذين لديهم ديون علينا
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            {activeCreditorsCount} موردين
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي عدد الموردين المسجلين
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            {suppliers.length} مورد
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="بحث باسم المورد، اسم الشركة، أو الهاتف..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pr-9 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
        />
      </div>

      {/* Main Suppliers Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Suppliers List */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="p-3.5 bg-slate-100 font-bold text-xs text-slate-700 border-b border-slate-200 flex justify-between items-center">
            <span>قائمة الموردين ({filteredSuppliers.length})</span>
            <span className="text-[11px] text-slate-500">اختر لعرض الكشف</span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا يوجد موردون مسجلون.
              </div>
            ) : (
              filteredSuppliers.map((supp) => {
                const isSelected = selectedSupplierId === supp.id;
                return (
                  <div
                    key={supp.id}
                    onClick={() => setSelectedSupplierId(supp.id)}
                    className={`p-3.5 text-right cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50/80 border-r-4 border-slate-900'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-900">
                        {supp.name}
                      </h4>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          supp.totalDebt > 0 ? 'text-rose-700' : 'text-slate-500'
                        }`}
                      >
                        {supp.totalDebt > 0
                          ? `له دين: ${formatCurrency(supp.totalDebt, settings)}`
                          : 'مسدد'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{supp.company || supp.phone || 'بدون تفاصيل'}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPaymentModal(supp.id);
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
                      >
                        + سداد دفعة
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Supplier Profile & Statement */}
        <div className="lg:col-span-2 space-y-4">
          {selectedSupplier ? (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">
                      {selectedSupplier.name}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        selectedSupplier.totalDebt > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {selectedSupplier.totalDebt > 0
                        ? `له دين علينا: ${formatCurrency(selectedSupplier.totalDebt, settings)}`
                        : 'الحساب خالص'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    {selectedSupplier.company && (
                      <span className="font-semibold text-slate-700">
                        {selectedSupplier.company}
                      </span>
                    )}
                    {selectedSupplier.phone && (
                      <span className="font-mono">{selectedSupplier.phone}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenPaymentModal(selectedSupplier.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-xs"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    <span>سداد دفعة للمورد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportSingleSupplierStatementPdf(
                        selectedSupplier,
                        purchases,
                        supplierPayments,
                        settings
                      )
                    }
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="طباعة وتصدير كشف حساب المورد والمشتريات والسداد بصيغة PDF"
                  >
                    <Printer className="w-4 h-4 text-amber-500" />
                    <span>طباعة كشف الحساب PDF</span>
                  </button>
                  {onDeleteSupplier && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(selectedSupplier.id)}
                      title="حذف حساب المورد من قاعدة البيانات (Firebase)"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف المورد</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">إجمالي المشتريات منه:</span>
                  <span className="font-bold font-mono text-slate-900 text-sm">
                    {formatCurrency(selectedSupplier.totalPurchases, settings)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">إجمالي ما دفعناه له:</span>
                  <span className="font-bold font-mono text-emerald-700 text-sm">
                    {formatCurrency(selectedSupplier.totalPaid, settings)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">المبلغ المتبقي له (دين):</span>
                  <span className="font-bold font-mono text-rose-700 text-sm">
                    {formatCurrency(selectedSupplier.totalDebt, settings)}
                  </span>
                </div>
              </div>

              {/* Purchases history */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">
                  سجل فواتير التوريد من المورد
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم الشراء الداخلي</th>
                        <th className="py-2.5 px-3">فاتورة المورد</th>
                        <th className="py-2.5 px-3">التاريخ</th>
                        <th className="py-2.5 px-3 text-left">إجمالي الفاتورة</th>
                        <th className="py-2.5 px-3 text-left">المدفوع نقداً</th>
                        <th className="py-2.5 px-3 text-left">المتبقي دين</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierPurchasesList.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            لا توجد فواتير توريد مسجلة لهذا المورد.
                          </td>
                        </tr>
                      ) : (
                        supplierPurchasesList.map((p) => (
                          <tr key={p.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {p.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500">
                              {p.supplierInvoiceNumber || '-'}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {p.date} · {p.time}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrency(p.total, settings)}
                            </td>
                            <td className="py-2 px-3 text-left font-mono text-rose-700 tabular-nums">
                              {formatCurrency(p.paidAmount, settings)}
                            </td>
                            <td className="py-2 px-3 text-left font-mono text-amber-700 tabular-nums">
                              {p.remainingAmount > 0
                                ? formatCurrency(p.remainingAmount, settings)
                                : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payments history */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700">
                  سجل سندات الصرف وسداد الدفعات
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم سند الصرف</th>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3 text-left">المبلغ المدفوع</th>
                        <th className="py-2.5 px-3">طريقة السداد</th>
                        <th className="py-2.5 px-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {supplierPaymentsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            لا توجد سندات صرف دفعات مسجلة خارج الفواتير.
                          </td>
                        </tr>
                      ) : (
                        supplierPaymentsList.map((sp) => (
                          <tr key={sp.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {sp.paymentNumber}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {sp.date} · {sp.time}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-rose-700 tabular-nums">
                              {formatCurrency(sp.amount, settings)}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {sp.paymentMethod === 'cash' ? 'نقداً من الصندوق' : 'تحويل'}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {sp.notes || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-2xl shadow-xs text-center text-slate-400">
              <Building2 className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">
                اختر مورداً من القائمة الجانبية
              </p>
              <p className="text-xs text-slate-500 mt-1">
                لعرض فواتير التوريد، الأرصدة المتبقية، وسندات صرف الدفعات
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isAddSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                إضافة مورد جديد
              </h3>
              <button
                type="button"
                onClick={() => setIsAddSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplierSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  اسم الشخص المسؤول أو المندوب *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: السيد حسام النجار..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  اسم الشركة أو المعمل
                </label>
                <input
                  type="text"
                  placeholder="شركة الشام للتجهيزات الصناعية..."
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="011... أو 09..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  العنوان أو المدينة
                </label>
                <input
                  type="text"
                  placeholder="المنطقة الصناعية..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  رصيد دين افتتاحي مستحق له سابقاً (إن وجد)
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialDebt}
                  onChange={(e) => setInitialDebt(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات
                </label>
                <input
                  type="text"
                  placeholder="خصم نقدي 5%، التوريد أيام السبت..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  حفظ المورد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Supplier Payment Modal («سداد دفعة لمورد») */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                سداد دفعة لمورد (سند صرف)
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المورد المستفيد
                </label>
                <select
                  value={payingSupplierId}
                  onChange={(e) => {
                    setPayingSupplierId(e.target.value);
                    const s = suppliers.find((supp) => supp.id === e.target.value);
                    if (s && s.totalDebt > 0) setPaymentAmount(s.totalDebt);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (الدين المستحق له: {formatCurrency(s.totalDebt, settings)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    تاريخ السداد
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    الوقت
                  </label>
                  <input
                    type="time"
                    value={paymentTime}
                    onChange={(e) => setPaymentTime(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المبلغ المدفوع نقداً من الصندوق *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  placeholder="أدخل المبلغ..."
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm text-rose-700 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  * هذا المبلغ سيقلل دين المورد ويخصم من رصيد الصندوق النقدي فوراً.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  طريقة السداد
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="cash">نقداً من صندوق المحل</option>
                  <option value="transfer">حوالة مصرفية</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات أو رقم إشعار الدفع
                </label>
                <input
                  type="text"
                  placeholder="دفعة عن شحنة الدهان..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-xs"
                >
                  تأكيد سداد الدفعة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                حذف حساب المورد نهائياً من قاعدة البيانات (Firebase)
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              تحذير: هل أنت متأكد من حذف حساب هذا المورد تماماً من قاعدة بيانات Firebase السحابية؟
              سيتم تفريغ المساحة المخزنة وتحديث سجل التخزين السحابي.
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
                  if (onDeleteSupplier && deleteConfirmId) {
                    onDeleteSupplier(deleteConfirmId);
                    setSelectedSupplierId(null);
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
