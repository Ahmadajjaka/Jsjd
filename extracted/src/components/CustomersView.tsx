import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  DollarSign,
  Printer,
  Phone,
  MapPin,
  ArrowDownLeft,
  Calendar,
  FileText,
  CheckCircle2,
  X,
  CreditCard,
  Trash2,
  ShoppingBag,
} from 'lucide-react';
import {
  Customer,
  CustomerPayment,
  Product,
  SaleInvoice,
  StoreSettings,
} from '../types/accounting';
import {
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';
import { exportSingleCustomerStatementPdf } from '../utils/pdfExport';
import { QuickCustomerSaleModal } from './QuickCustomerSaleModal';

interface CustomersViewProps {
  customers: Customer[];
  sales: SaleInvoice[];
  customerPayments: CustomerPayment[];
  settings: StoreSettings;
  products?: Product[];
  onSaveCustomer: (customer: Customer) => void;
  onRecordCustomerPayment: (payment: CustomerPayment) => void;
  onPreviewInvoice: (invoice: SaleInvoice) => void;
  onSaveSale?: (invoice: SaleInvoice, newCustomer?: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  initialCustomerId?: string;
}

export const CustomersView: React.FC<CustomersViewProps> = ({
  customers,
  sales,
  customerPayments,
  settings,
  products = [],
  onSaveCustomer,
  onRecordCustomerPayment,
  onPreviewInvoice,
  onSaveSale,
  onDeleteCustomer,
  initialCustomerId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    initialCustomerId || null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  // Modals
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payingCustomerId, setPayingCustomerId] = useState<string>('');
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);
  const [quickSaleCustomerId, setQuickSaleCustomerId] = useState<string>('cash_customer');

  // Customer Form
  const [name, setName] = useState('');
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
  const totalReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + Math.max(0, c.totalDebt), 0);
  }, [customers]);

  const activeDebtorsCount = useMemo(() => {
    return customers.filter((c) => c.totalDebt > 0).length;
  }, [customers]);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [customers, searchQuery]);

  // Selected Customer details
  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  const customerInvoices = useMemo(() => {
    if (!selectedCustomerId) return [];
    return sales.filter((s) => s.customerId === selectedCustomerId).reverse();
  }, [sales, selectedCustomerId]);

  const customerPaymentsList = useMemo(() => {
    if (!selectedCustomerId) return [];
    return customerPayments.filter((p) => p.customerId === selectedCustomerId).reverse();
  }, [customerPayments, selectedCustomerId]);

  // Handle Save New Customer
  const handleSaveCustomerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم الزبون');
      return;
    }

    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
      totalPurchases: Number(initialDebt) || 0,
      totalPaid: 0,
      totalDebt: Number(initialDebt) || 0,
      notes: notes.trim(),
      createdAt: getTodayDateString(),
    };

    onSaveCustomer(newCust);
    setIsAddCustomerModalOpen(false);
    setName('');
    setPhone('');
    setAddress('');
    setInitialDebt(0);
    setNotes('');
  };

  // Open Payment modal
  const handleOpenPaymentModal = (customerId: string) => {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return;
    setPayingCustomerId(customerId);
    setPaymentAmount(cust.totalDebt > 0 ? cust.totalDebt : 0);
    setPaymentDate(getTodayDateString());
    setPaymentTime(getCurrentTimeString());
    setPaymentNotes('');
    setIsPaymentModalOpen(true);
  };

  // Submit Customer Payment (قبض دفعة من زبون)
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === payingCustomerId);
    if (!cust) return;

    if (paymentAmount <= 0) {
      alert('يرجى إدخال مبلغ صحيح أكبر من صفر');
      return;
    }

    const payment: CustomerPayment = {
      id: `cp-${Date.now()}`,
      paymentNumber: `ق-${1000 + customerPayments.length + 1}`,
      date: paymentDate,
      time: paymentTime,
      customerId: cust.id,
      customerName: cust.name,
      amount: Number(paymentAmount),
      paymentMethod,
      notes: paymentNotes.trim(),
      receiptPrinted: false,
    };

    onRecordCustomerPayment(payment);
    setIsPaymentModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر الزبائن ومتابعة الديون والذمم
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ملف كامل لكل زبون، كشوفات حساب تفصيلية، وتسجيل مقبوضات الديون وسندات القبض
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onSaveSale && (
            <button
              type="button"
              onClick={() => {
                setQuickSaleCustomerId(selectedCustomerId || 'cash_customer');
                setIsQuickSaleOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-xs cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4 text-slate-900" />
              <span>+ مبيع زبون مباشر</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddCustomerModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>إضافة زبون جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي الديون التي لي عند الزبائن
          </span>
          <span className="text-xl font-bold font-mono text-teal-700 tabular-nums">
            {formatCurrency(totalReceivables, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            أموال متجر خردوات المامو بالسوق
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            عدد الزبائن المدينين حالياً
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            {activeDebtorsCount} زبائن
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي عدد الزبائن المسجلين
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            {customers.length} زبون
          </span>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="بحث باسم الزبون، رقم الهاتف، أو العنوان..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pr-9 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
        />
      </div>

      {/* Customers List & Selected Profile Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customers Table / Cards */}
        <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[600px]">
          <div className="p-3.5 bg-slate-100 font-bold text-xs text-slate-700 border-b border-slate-200 flex justify-between items-center">
            <span>قائمة الزبائن ({filteredCustomers.length})</span>
            <span className="text-[11px] text-slate-500">اختر لعرض الحساب</span>
          </div>

          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                لا يوجد زبائن مسجلين.
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = selectedCustomerId === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`p-3.5 text-right cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50/80 border-r-4 border-slate-900'
                        : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-xs font-bold text-slate-900">
                        {cust.name}
                      </h4>
                      <span
                        className={`text-xs font-mono font-bold tabular-nums ${
                          cust.totalDebt > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}
                      >
                        {cust.totalDebt > 0
                          ? `دين: ${formatCurrency(cust.totalDebt, settings)}`
                          : 'مسدد'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{cust.phone || 'بدون هاتف'}</span>
                      <div className="flex items-center gap-1">
                        {onSaveSale && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setQuickSaleCustomerId(cust.id);
                              setIsQuickSaleOpen(true);
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-md transition-colors"
                            title="إدراج مبيع مباشر لهذا الزبون"
                          >
                            + مبيع
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPaymentModal(cust.id);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors"
                        >
                          + قبض
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Customer Statement of Account (كشف حساب الزبون) */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCustomer ? (
            <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-5">
              {/* Profile Top Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900">
                      {selectedCustomer.name}
                    </h3>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        selectedCustomer.totalDebt > 0
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {selectedCustomer.totalDebt > 0
                        ? `عليه دين: ${formatCurrency(selectedCustomer.totalDebt, settings)}`
                        : 'الحساب خالص'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    {selectedCustomer.phone && (
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {selectedCustomer.phone}
                      </span>
                    )}
                    {selectedCustomer.address && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {selectedCustomer.address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {onSaveSale && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuickSaleCustomerId(selectedCustomer.id);
                        setIsQuickSaleOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg transition-colors shadow-xs cursor-pointer"
                      title="إدراج مبيع مباشر لهذا الزبون"
                    >
                      <ShoppingBag className="w-4 h-4 text-slate-900" />
                      <span>+ إدراج مبيع مباشر</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleOpenPaymentModal(selectedCustomer.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors shadow-xs"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    <span>قبض دفعة من الزبون</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportSingleCustomerStatementPdf(
                        selectedCustomer,
                        sales,
                        customerPayments,
                        settings
                      )
                    }
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    title="طباعة وتصدير كشف حساب تفصيلي للزبون بصيغة PDF"
                  >
                    <Printer className="w-4 h-4 text-amber-500" />
                    <span>طباعة كشف الحساب PDF</span>
                  </button>
                  {onDeleteCustomer && (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(selectedCustomer.id)}
                      title="حذف حساب الزبون من قاعدة البيانات (Firebase)"
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>حذف الزبون</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Customer Financial Summary */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block">إجمالي المشتريات:</span>
                  <span className="font-bold font-mono text-slate-900 text-sm">
                    {formatCurrency(selectedCustomer.totalPurchases, settings)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">إجمالي ما دفعه:</span>
                  <span className="font-bold font-mono text-emerald-700 text-sm">
                    {formatCurrency(selectedCustomer.totalPaid, settings)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">الرصيد المتبقي دين:</span>
                  <span className="font-bold font-mono text-rose-700 text-sm">
                    {formatCurrency(selectedCustomer.totalDebt, settings)}
                  </span>
                </div>
              </div>

              {/* Invoices History Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700">
                  سجل فواتير مشتريات الزبون
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم الفاتورة</th>
                        <th className="py-2.5 px-3">التاريخ</th>
                        <th className="py-2.5 px-3 text-left">قيمة الفاتورة</th>
                        <th className="py-2.5 px-3 text-left">المدفوع حينها</th>
                        <th className="py-2.5 px-3 text-left">المتبقي دين</th>
                        <th className="py-2.5 px-3 text-center">معاينة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-400">
                            لا توجد فواتير مبيعات مسجلة لهذا الزبون.
                          </td>
                        </tr>
                      ) : (
                        customerInvoices.map((inv) => (
                          <tr key={inv.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {inv.date} · {inv.time}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">
                              {formatCurrency(inv.total, settings)}
                            </td>
                            <td className="py-2 px-3 text-left font-mono text-emerald-700 tabular-nums">
                              {formatCurrency(inv.paidAmount, settings)}
                            </td>
                            <td className="py-2 px-3 text-left font-mono text-rose-700 tabular-nums">
                              {inv.remainingAmount > 0
                                ? formatCurrency(inv.remainingAmount, settings)
                                : '-'}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => onPreviewInvoice(inv)}
                                className="p-1 text-slate-600 hover:text-slate-900 rounded-md"
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

              {/* Payments History Table */}
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-bold text-slate-700">
                  سجل سندات القبض والدفعات المسددة
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">رقم السند</th>
                        <th className="py-2.5 px-3">التاريخ والوقت</th>
                        <th className="py-2.5 px-3 text-left">المبلغ المقبوض</th>
                        <th className="py-2.5 px-3">طريقة الدفع</th>
                        <th className="py-2.5 px-3">ملاحظات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerPaymentsList.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-400">
                            لا توجد سندات قبض مسجلة خارج الفواتير.
                          </td>
                        </tr>
                      ) : (
                        customerPaymentsList.map((cp) => (
                          <tr key={cp.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {cp.paymentNumber}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {cp.date} · {cp.time}
                            </td>
                            <td className="py-2 px-3 text-left font-mono font-bold text-emerald-700 tabular-nums">
                              {formatCurrency(cp.amount, settings)}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {cp.paymentMethod === 'cash' ? 'نقداً للصندوق' : 'تحويل'}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {cp.notes || '-'}
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
              <Users className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700">
                اختر زبوناً من القائمة الجانبية
              </p>
              <p className="text-xs text-slate-500 mt-1">
                لعرض كشف الحساب التفصيلي، فواتير المبيعات، وتسجيل سندات القبض
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                إضافة زبون جديد
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomerSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  اسم الزبون أو اسم الورشة / المقاول *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المعلم أبو خالد للإنشاءات..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  رقم الهاتف (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="09..."
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  العنوان أو موقع العمل
                </label>
                <input
                  type="text"
                  placeholder="المنطقة، الشارع، أو اسم المشروع..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  رصيد دين افتتاحي سابق (إن وجد)
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
                  placeholder="طريقة السداد المعتادة، كفيل..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  حفظ الزبون
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal («قبض دفعة من زبون») */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                تسجيل سند قبض دفعة من زبون
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
                  الزبون المسدد
                </label>
                <select
                  value={payingCustomerId}
                  onChange={(e) => {
                    setPayingCustomerId(e.target.value);
                    const c = customers.find((cust) => cust.id === e.target.value);
                    if (c && c.totalDebt > 0) setPaymentAmount(c.totalDebt);
                  }}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (الدين الحالي: {formatCurrency(c.totalDebt, settings)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    تاريخ القبض
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
                  المبلغ المقبوض نقداً للصندوق *
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  placeholder="أدخل المبلغ..."
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm text-emerald-700 focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  * هذا المبلغ سيقلل دين الزبون ويزيد رصيد الصندوق النقدي فوراً، ولا يعتبر عملية بيع جديدة.
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  طريقة القبض
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="cash">نقداً في صندوق المحل</option>
                  <option value="transfer">تحويل مالي</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات السند
                </label>
                <input
                  type="text"
                  placeholder="تسديد دفعة عن حساب الإسمنت..."
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
                  className="px-5 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs"
                >
                  تأكيد القبض وإصدار السند
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Customer Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                حذف حساب الزبون نهائياً من قاعدة البيانات (Firebase)
              </h3>
            </div>
            <p className="text-slate-600 leading-relaxed">
              تحذير: هل أنت متأكد من حذف حساب هذا الزبون نهائياً من قاعدة بيانات Firebase السحابية؟
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
                  if (onDeleteCustomer && deleteConfirmId) {
                    onDeleteCustomer(deleteConfirmId);
                    setSelectedCustomerId(null);
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

      {/* Quick Customer Direct Sale Modal */}
      {onSaveSale && (
        <QuickCustomerSaleModal
          isOpen={isQuickSaleOpen}
          onClose={() => setIsQuickSaleOpen(false)}
          customers={customers}
          products={products}
          settings={settings}
          preselectedCustomerId={quickSaleCustomerId}
          onSaveSale={onSaveSale}
          onPreviewInvoice={onPreviewInvoice}
        />
      )}
    </div>
  );
};
