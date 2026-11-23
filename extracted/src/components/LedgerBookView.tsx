import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Receipt,
  Wallet,
  Users,
  Coins,
  CheckCircle2,
  FileText,
  RotateCcw,
  Sparkles,
  Eye,
  StickyNote,
} from 'lucide-react';
import {
  Customer,
  CustomerPayment,
  Expense,
  Product,
  PurchaseInvoice,
  SaleInvoice,
  StoreSettings,
  Supplier,
  SupplierPayment,
  CashTransaction,
} from '../types/accounting';
import {
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';

interface LedgerBookViewProps {
  sales: SaleInvoice[];
  expenses: Expense[];
  cashTransactions: CashTransaction[];
  customerPayments: CustomerPayment[];
  supplierPayments: SupplierPayment[];
  purchases: PurchaseInvoice[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  settings: StoreSettings;
  onSaveSale: (invoice: SaleInvoice, newCustomer?: Customer) => void;
  onSaveExpense: (expense: Expense) => void;
  onRecordCustomerPayment: (payment: CustomerPayment) => void;
  onAddCashTransaction?: (tx: Omit<CashTransaction, 'id' | 'runningBalance'>) => void;
  onPreviewInvoice: (invoice: SaleInvoice) => void;
}

type LedgerSection = 'all' | 'sales' | 'cashbox' | 'expenses' | 'debts';

interface LedgerEntry {
  id: string;
  sequence: number;
  date: string;
  time: string;
  docNumber: string;
  docType: 'sale' | 'expense' | 'customer_payment' | 'supplier_payment' | 'cash' | 'purchase';
  description: string;
  debit: number; // مدين (له / مقبوض / داخل)
  credit: number; // دائن (عليه / مدفوع / خارج)
  partyName: string;
  category?: string;
  paymentMethod?: string;
  invoiceRef?: SaleInvoice;
}

export const LedgerBookView: React.FC<LedgerBookViewProps> = ({
  sales,
  expenses,
  cashTransactions,
  customerPayments,
  supplierPayments,
  purchases,
  customers,
  suppliers,
  products,
  settings,
  onSaveSale,
  onSaveExpense,
  onRecordCustomerPayment,
  onAddCashTransaction,
  onPreviewInvoice,
}) => {
  // Navigation & Filter State
  const [activeSection, setActiveSection] = useState<LedgerSection>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isFilterAllDates, setIsFilterAllDates] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 14;

  // Quick Direct Entry Modal
  const [isAddEntryModalOpen, setIsAddEntryModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'quick_sale' | 'expense' | 'debt_payment' | 'cash_in_out'>('quick_sale');
  
  // Quick Entry Form
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formItemName, setFormItemName] = useState('');
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formPaidAmount, setFormPaidAmount] = useState<number>(0);
  const [formNotes, setFormNotes] = useState('');
  const [formExpenseCategory, setFormExpenseCategory] = useState('نثريات');
  const [formCashFlow, setFormCashFlow] = useState<'in' | 'out'>('in');

  // Build unified chronological ledger entries
  const allEntries: LedgerEntry[] = useMemo(() => {
    const list: LedgerEntry[] = [];

    // 1. Sales
    sales.forEach((s) => {
      const isCash = s.isCashCustomer;
      const customer = customers.find((c) => c.id === s.customerId);
      const party = isCash ? (s.customerName || 'زبون نقدي مباشر') : (customer?.name || s.customerName || 'زبون حساب');
      const itemsSummary = s.items.map((it) => `${it.productName} (${it.quantity})`).join(', ');

      list.push({
        id: `sale-${s.id}`,
        sequence: 0,
        date: s.date,
        time: s.time,
        docNumber: s.invoiceNumber,
        docType: 'sale',
        description: `مبيع فاتورة: ${itemsSummary}${s.notes ? ` - ${s.notes}` : ''}`,
        debit: s.paidAmount, // مقبوض في الصندوق
        credit: s.remainingAmount, // آجل (ذمة على الزبون)
        partyName: party,
        category: 'مبيعات',
        paymentMethod: s.paymentMethod === 'cash' ? 'نقداً' : s.paymentMethod === 'debt' ? 'آجل' : 'دفعة وجزء دين',
        invoiceRef: s,
      });
    });

    // 2. Expenses
    expenses.forEach((e) => {
      list.push({
        id: `exp-${e.id}`,
        sequence: 0,
        date: e.date,
        time: e.time,
        docNumber: `صرف-${e.id.slice(-4)}`,
        docType: 'expense',
        description: `مصروف: ${e.description}${e.notes ? ` (${e.notes})` : ''}`,
        debit: 0,
        credit: e.amount, // خارج من الصندوق
        partyName: e.notes || 'مصروف متجر',
        category: e.category,
        paymentMethod: 'نقداً من الصندوق',
      });
    });

    // 3. Customer Payments (سدادات ديون الزبائن)
    customerPayments.forEach((cp) => {
      const customer = customers.find((c) => c.id === cp.customerId);
      list.push({
        id: `cpay-${cp.id}`,
        sequence: 0,
        date: cp.date,
        time: cp.time,
        docNumber: `سند-${cp.id.slice(-4)}`,
        docType: 'customer_payment',
        description: `سداد دفعة دين من زبون${cp.notes ? ` - ${cp.notes}` : ''}`,
        debit: cp.amount, // مقبوض
        credit: 0,
        partyName: customer?.name || 'زبون حساب',
        category: 'سداد ديون',
        paymentMethod: 'نقداً',
      });
    });

    // 4. Supplier Payments
    supplierPayments.forEach((sp) => {
      const supplier = suppliers.find((s) => s.id === sp.supplierId);
      list.push({
        id: `spay-${sp.id}`,
        sequence: 0,
        date: sp.date,
        time: sp.time,
        docNumber: `دفعة-${sp.id.slice(-4)}`,
        docType: 'supplier_payment',
        description: `دفعة حساب للمورد${sp.notes ? ` - ${sp.notes}` : ''}`,
        debit: 0,
        credit: sp.amount,
        partyName: supplier?.name || 'مورد بضاعة',
        category: 'دفعات موردين',
        paymentMethod: 'نقداً',
      });
    });

    // Sort chronologically ascending (or descending for active day)
    list.sort((a, b) => {
      const compDate = a.date.localeCompare(b.date);
      if (compDate !== 0) return compDate;
      return a.time.localeCompare(b.time);
    });

    // Assign sequence numbers
    return list.map((item, index) => ({
      ...item,
      sequence: index + 1,
    }));
  }, [sales, expenses, customerPayments, supplierPayments, customers, suppliers]);

  // Filter entries according to active section, date, and search
  const filteredEntries = useMemo(() => {
    return allEntries.filter((item) => {
      // 1. Section filter
      if (activeSection === 'sales' && item.docType !== 'sale') return false;
      if (activeSection === 'expenses' && item.docType !== 'expense') return false;
      if (
        activeSection === 'cashbox' &&
        item.docType !== 'customer_payment' &&
        item.docType !== 'expense' &&
        !(item.docType === 'sale' && item.debit > 0)
      ) {
        return false;
      }
      if (activeSection === 'debts' && !(item.docType === 'sale' && item.credit > 0) && item.docType !== 'customer_payment') {
        return false;
      }

      // 2. Date filter
      if (!isFilterAllDates && selectedDate) {
        if (item.date !== selectedDate) return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchParty = item.partyName.toLowerCase().includes(q);
        const matchDoc = item.docNumber.toLowerCase().includes(q);
        if (!matchDesc && !matchParty && !matchDoc) return false;
      }

      return true;
    });
  }, [allEntries, activeSection, selectedDate, isFilterAllDates, searchQuery]);

  // Running balance calculation for the displayed page
  const pageEntriesWithBalance = useMemo(() => {
    let running = 0;
    return filteredEntries.map((entry) => {
      running += entry.debit - (entry.docType === 'expense' || entry.docType === 'supplier_payment' ? entry.credit : 0);
      return {
        ...entry,
        calculatedBalance: running,
      };
    });
  }, [filteredEntries]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(pageEntriesWithBalance.length / rowsPerPage));
  const displayedEntries = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return pageEntriesWithBalance.slice(startIndex, startIndex + rowsPerPage);
  }, [pageEntriesWithBalance, currentPage, rowsPerPage]);

  // Page Summary totals (Debit, Credit, Net)
  const pageTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let totalDebtIssued = 0;

    pageEntriesWithBalance.forEach((e) => {
      totalDebit += e.debit;
      if (e.docType === 'expense' || e.docType === 'supplier_payment') {
        totalCredit += e.credit;
      } else if (e.docType === 'sale') {
        totalDebtIssued += e.credit;
      }
    });

    return {
      totalDebit,
      totalCredit,
      totalDebtIssued,
      netCash: totalDebit - totalCredit,
      entriesCount: pageEntriesWithBalance.length,
    };
  }, [pageEntriesWithBalance]);

  // Handle Quick Entry Submission directly into the ledger
  const handleCreateDirectEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const today = getTodayDateString();
    const timeNow = getCurrentTimeString();

    if (entryType === 'quick_sale') {
      if (formAmount <= 0) return;
      const remaining = Math.max(0, formAmount - formPaidAmount);
      const cost = formAmount * 0.8;
      const profit = formAmount - cost;
      const customerId = remaining > 0 ? `direct-cust-${Date.now()}` : 'cash_customer';

      const newSaleInvoice: SaleInvoice = {
        id: `sale-${Date.now()}`,
        invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
        date: today,
        time: timeNow,
        customerId: customerId,
        customerName: formCustomerName.trim() || 'زبون نقدي مباشر',
        isCashCustomer: remaining === 0,
        items: [
          {
            productId: 'direct-item',
            productCode: 'DIR-01',
            productName: formItemName.trim() || 'بضاعة وخردوات متنوعة',
            category: 'خردوات عامة',
            unit: 'قطعة',
            quantity: 1,
            unitPrice: formAmount,
            costPrice: cost,
            discount: 0,
            total: formAmount,
            profit: profit,
          },
        ],
        subtotal: formAmount,
        discount: 0,
        total: formAmount,
        cogs: cost,
        grossProfit: profit,
        paidAmount: formPaidAmount,
        remainingAmount: remaining,
        paymentMethod: remaining === 0 ? 'cash' : formPaidAmount === 0 ? 'debt' : 'partial',
        status: 'completed',
        notes: formNotes || 'تدوين مباشر في دفتر الحسابات',
        createdAt: today,
      };

      let newCustomerObj: Customer | undefined;
      if (remaining > 0 && formCustomerName.trim()) {
        newCustomerObj = {
          id: customerId,
          name: formCustomerName.trim(),
          phone: '',
          address: '',
          notes: 'عميل آجل مسجل من الدفتر الورقي',
          totalPurchases: formAmount,
          totalPaid: formPaidAmount,
          totalDebt: remaining,
          createdAt: today,
        };
      }

      onSaveSale(newSaleInvoice, newCustomerObj);
    } else if (entryType === 'expense') {
      if (formAmount <= 0) return;
      const newExpense: Expense = {
        id: `exp-${Date.now()}`,
        description: formItemName.trim() || 'مصروف عام للمتجر',
        amount: formAmount,
        category: formExpenseCategory,
        date: today,
        time: timeNow,
        paymentMethod: 'cash',
        notes: formCustomerName ? `المستفيد: ${formCustomerName} - ${formNotes}` : formNotes || 'مدون في دفتر الحسابات واليومية',
        createdAt: today,
      };
      onSaveExpense(newExpense);
    } else if (entryType === 'debt_payment') {
      if (formAmount <= 0) return;
      const targetCustomer = customers[0];
      const payment: CustomerPayment = {
        id: `cpay-${Date.now()}`,
        paymentNumber: `ق-${Date.now().toString().slice(-5)}`,
        customerId: targetCustomer?.id || 'cash_customer',
        customerName: formCustomerName.trim() || targetCustomer?.name || 'زبون حساب',
        amount: formAmount,
        date: today,
        time: timeNow,
        paymentMethod: 'cash',
        notes: `قبض من: ${formCustomerName || 'زبون'} - ${formNotes}`,
      };
      onRecordCustomerPayment(payment);
    } else if (entryType === 'cash_in_out' && onAddCashTransaction) {
      if (formAmount <= 0) return;
      onAddCashTransaction({
        date: today,
        time: timeNow,
        type: formCashFlow === 'in' ? 'capital_deposit' : 'personal_withdrawal',
        flow: formCashFlow,
        amount: formAmount,
        description: `${formCashFlow === 'in' ? 'توريد نقدي' : 'سحب نقدي'}: ${formNotes || formItemName || 'حركة دفتر الصندوق'}`,
      });
    }

    // Reset form and close
    setFormCustomerName('');
    setFormItemName('');
    setFormAmount(0);
    setFormPaidAmount(0);
    setFormNotes('');
    setIsAddEntryModalOpen(false);
  };

  const handlePrintLedger = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-['Cairo',sans-serif]">
      {/* Top Action Bar & Date / Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 dark:bg-slate-900 text-white p-4 rounded-2xl shadow-xl border border-amber-500/30 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
            <BookOpen className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-amber-300">
                دفتر الحسابات واليومية العامة
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                الواجهة الدفترية التقليدية 📖
              </span>
            </div>
            <p className="text-xs text-slate-300">
              سجل يدوي دفتري مطابق لدفاتر اليومية التجارية في المحلات والأسواق
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
            <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setIsFilterAllDates(false);
                setCurrentPage(1);
              }}
              disabled={isFilterAllDates}
              className="bg-transparent text-white font-mono focus:outline-hidden disabled:opacity-50 cursor-pointer"
            />
          </div>

          {/* Toggle All Dates */}
          <button
            type="button"
            onClick={() => {
              setIsFilterAllDates(!isFilterAllDates);
              setCurrentPage(1);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              isFilterAllDates
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {isFilterAllDates ? 'عرض اليوم المحدد' : 'كافة الأيام والتاريخ'}
          </button>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrintLedger}
            title="طباعة ورقة الدفتر الحالية A4"
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">طباعة الصفحة</span>
          </button>

          {/* Quick Direct Ledger Entry Button */}
          <button
            type="button"
            onClick={() => {
              setFormPaidAmount(formAmount);
              setIsAddEntryModalOpen(true);
            }}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:brightness-110 text-slate-950 font-black text-xs md:text-sm flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>تدوين قيد جديد ✍️</span>
          </button>
        </div>
      </div>

      {/* THE PHYSICAL LEDGER BOOK CONTAINER */}
      <div className="relative">
        {/* Skeuomorphic Leather Binder / Hardcover Backing */}
        <div className="relative rounded-3xl p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-[#2a1d17] via-[#1d1410] to-[#2a1d17] shadow-2xl border-4 border-[#3d2c22] overflow-visible">
          
          {/* Golden Brass Corner Brackets (Traditional Syrian/Damascene Merchant Ledgers) */}
          <div className="absolute top-2 right-2 w-10 h-10 border-t-4 border-r-4 border-amber-400/90 rounded-tr-2xl pointer-events-none shadow-md shadow-amber-500/20" />
          <div className="absolute top-2 left-2 w-10 h-10 border-t-4 border-l-4 border-amber-400/90 rounded-tl-2xl pointer-events-none shadow-md shadow-amber-500/20" />
          <div className="absolute bottom-2 right-2 w-10 h-10 border-b-4 border-r-4 border-amber-400/90 rounded-br-2xl pointer-events-none shadow-md shadow-amber-500/20" />
          <div className="absolute bottom-2 left-2 w-10 h-10 border-b-4 border-l-4 border-amber-400/90 rounded-bl-2xl pointer-events-none shadow-md shadow-amber-500/20" />

          {/* Gold Foil Embossed Spine Title */}
          <div className="text-center pb-4 mb-2 border-b border-amber-600/30">
            <span className="text-[11px] sm:text-xs font-mono tracking-widest text-amber-400/80 uppercase">
              ★ المتجر المعتمد للعدد والأدوات الصناعية والبنائية ★
            </span>
            <h1 className="text-lg sm:text-2xl font-black text-amber-200 tracking-wide drop-shadow-md">
              دفتر يومية وحسابات متجر خردوات المامو
            </h1>
            <p className="text-xs text-amber-300/70 font-medium">
              بإدارة أحمد المامو (أحمد نوار المامو) — السجل المحاسبي التجاري اليومي
            </p>
          </div>

          {/* SECTION INDEX TABS (ألسنة الفهارس الملونة البارزة من أعلى/جانب الدفتر) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0 px-2 sm:px-6 relative z-10 translate-y-2">
            {[
              { id: 'all', label: 'اليومية الشاملة', icon: BookOpen, color: 'bg-amber-600 hover:bg-amber-500 text-white' },
              { id: 'sales', label: 'دفتر المبيعات', icon: ShoppingCart, color: 'bg-emerald-700 hover:bg-emerald-600 text-white' },
              { id: 'cashbox', label: 'دفتر الصندوق', icon: Wallet, color: 'bg-blue-700 hover:bg-blue-600 text-white' },
              { id: 'expenses', label: 'دفتر المصروفات', icon: Receipt, color: 'bg-rose-700 hover:bg-rose-600 text-white' },
              { id: 'debts', label: 'دفتر ديون الزبائن', icon: Users, color: 'bg-purple-700 hover:bg-purple-600 text-white' },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveSection(tab.id as LedgerSection);
                    setCurrentPage(1);
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-t-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer border-t-2 border-x-2 ${
                    isActive
                      ? 'bg-[#fcfbf7] dark:bg-[#1a1918] text-slate-900 dark:text-amber-300 border-amber-500/60 shadow-lg -translate-y-1'
                      : `${tab.color} border-black/30 opacity-80 hover:opacity-100`
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* THE PHYSICAL AGED LEDGER SHEET */}
          <div
            className="relative rounded-2xl shadow-2xl p-4 sm:p-7 transition-colors duration-200 border border-stone-300 dark:border-stone-800"
            style={{
              backgroundColor: '#fbf9f2',
              backgroundImage:
                'repeating-linear-gradient(to bottom, transparent, transparent 35px, #d1d5db 36px)',
              backgroundAttachment: 'local',
            }}
          >
            {/* SPIRAL RING BINDING COILS (السلك الحلزوني على حافة الدفتر اليمنى في RTL) */}
            <div className="hidden md:flex flex-col justify-around absolute top-6 bottom-6 right-2 w-6 pointer-events-none z-20">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div key={idx} className="relative flex items-center justify-center my-1.5">
                  {/* Punch Hole */}
                  <div className="w-3.5 h-3.5 rounded-full bg-[#1d1410] shadow-inner border border-stone-400" />
                  {/* Metallic Wire Loop */}
                  <div
                    className="absolute -right-3 w-7 h-3 rounded-full bg-gradient-to-r from-stone-400 via-stone-100 to-stone-500 shadow-md border border-stone-600 transform -rotate-12"
                    style={{
                      boxShadow: '1px 2px 4px rgba(0,0,0,0.4)',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* DUAL RED MARGIN LINES (خط الهامش الأحمر المزدوج التقليدي) */}
            <div className="hidden sm:block absolute top-0 bottom-0 right-12 md:right-16 w-3 pointer-events-none border-r-2 border-r-rose-400/90 border-l border-l-rose-300/80 z-10" />

            {/* Inner Content Container */}
            <div className="sm:pr-14 md:pr-18 pl-2 space-y-5 text-slate-900">
              
              {/* LEDGER PAGE HEADER */}
              <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-3 border-b-2 border-stone-800">
                {/* Store Header Details */}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                      دفتر اليومية العامة والمبيعات
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-800 border border-stone-300">
                      رقم السجل: 2026/01
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-700 mt-1">
                    <span>
                      <strong>المتجر:</strong> خردوات المامو
                    </span>
                    <span>•</span>
                    <span>
                      <strong>المدير المسؤول:</strong> أحمد المامو
                    </span>
                    <span>•</span>
                    <span>
                      <strong>التاريخ الدفتري:</strong>{' '}
                      <span className="font-mono font-bold text-stone-900">
                        {isFilterAllDates ? 'كافة التواريخ المسجلة' : selectedDate}
                      </span>
                    </span>
                  </div>
                </div>

                {/* AUTHENTIC VINTAGE RUBBER INK STAMP SEAL (ختم المتجر التقليدي) */}
                <div className="flex items-center gap-4">
                  {/* Stamp */}
                  <div className="relative transform -rotate-6 select-none pointer-events-none opacity-85">
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-4 border-dashed border-indigo-700 text-indigo-800 flex flex-col items-center justify-center p-1 text-center shadow-xs">
                      <div className="w-full h-full rounded-full border-2 border-indigo-700/60 flex flex-col items-center justify-center p-1">
                        <span className="text-[9px] font-black tracking-tighter">خردوات المامو</span>
                        <span className="text-[11px] font-black leading-tight text-indigo-900">معتمد</span>
                        <span className="text-[8px] font-bold text-indigo-700">بإدارة أحمد المامو</span>
                        <span className="text-[8px] font-mono font-bold mt-0.5">2026 ★ سورية</span>
                      </div>
                    </div>
                  </div>

                  {/* REALISTIC YELLOW STICKY NOTE SUMMARY (ورقة الملاحظة اللاصقة) */}
                  <div className="w-48 sm:w-56 p-3 rounded-lg bg-yellow-200 text-yellow-950 shadow-lg border border-yellow-300 transform rotate-2 select-none">
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-yellow-300/80">
                      <div className="flex items-center gap-1 text-[11px] font-bold">
                        <StickyNote className="w-3.5 h-3.5 text-yellow-700" />
                        <span>ملخص صفحة اليوم:</span>
                      </div>
                      <span className="text-[10px] font-mono text-yellow-800">
                        {pageTotals.entriesCount} قيود
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-yellow-900">مقبوضات الصندوق:</span>
                        <strong className="font-mono text-emerald-800">
                          {formatCurrency(pageTotals.totalDebit, settings)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-900">المصروفات والمدفوع:</span>
                        <strong className="font-mono text-rose-800">
                          {formatCurrency(pageTotals.totalCredit, settings)}
                        </strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-yellow-900">ذمم ديون متبقية:</span>
                        <strong className="font-mono text-amber-900">
                          {formatCurrency(pageTotals.totalDebtIssued, settings)}
                        </strong>
                      </div>
                      <div className="pt-1 mt-1 border-t border-yellow-300/80 flex justify-between font-bold text-xs">
                        <span>صافي التدفق:</span>
                        <span
                          className={`font-mono ${
                            pageTotals.netCash >= 0 ? 'text-emerald-900' : 'text-rose-900'
                          }`}
                        >
                          {formatCurrency(pageTotals.netCash, settings)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* SEARCH & FILTER BAR ON PAPER */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-stone-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="ابحث في شروحات وبيانات الدفتر..."
                    className="w-full pr-9 pl-3 py-1.5 bg-stone-100/90 border border-stone-300 rounded-lg text-xs text-stone-900 placeholder:text-stone-500 focus:outline-hidden focus:border-stone-500"
                  />
                </div>

                <div className="flex items-center gap-2 text-xs font-medium text-stone-700">
                  <span>
                    القسم الحالي: <strong>{activeSection === 'all' ? 'اليومية الشاملة' : activeSection === 'sales' ? 'المبيعات' : activeSection === 'cashbox' ? 'الصندوق' : activeSection === 'expenses' ? 'المصروفات' : 'الديون'}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    إجمالي القيود المطابقة: <strong className="font-mono">{filteredEntries.length}</strong>
                  </span>
                </div>
              </div>

              {/* THE ACCOUNTING LEDGER TABLE (جدول التدوين المسطر) */}
              <div className="overflow-x-auto rounded-xl border border-stone-400 bg-white/70 shadow-inner">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-300/80 text-stone-900 border-b-2 border-stone-400 font-bold divide-x divide-x-reverse divide-stone-300">
                      <th className="py-2 px-2 text-center w-10">م</th>
                      <th className="py-2 px-3 w-28">التاريخ والوقت</th>
                      <th className="py-2 px-3 w-28">رقم السند/الفاتورة</th>
                      <th className="py-2 px-4 min-w-[220px]">البيان والشرح الدفتري</th>
                      <th className="py-2 px-3 text-emerald-900 bg-emerald-50/60 w-28 text-left">
                        مدين (مقبوض)
                      </th>
                      <th className="py-2 px-3 text-rose-900 bg-rose-50/60 w-28 text-left">
                        دائن (مدفوع/آجل)
                      </th>
                      <th className="py-2 px-3 text-stone-800 bg-stone-100 w-28 text-left font-mono">
                        الرصيد التراكمي
                      </th>
                      <th className="py-2 px-3 min-w-[140px]">الطرف / الزبون</th>
                      <th className="py-2 px-2 text-center w-20">معاينة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-300 font-medium">
                    {displayedEntries.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-stone-500">
                          <BookOpen className="w-10 h-10 mx-auto text-stone-400 mb-2 opacity-60" />
                          <p className="text-sm font-bold text-stone-700">لا توجد قيود مدونة في هذه الصفحة</p>
                          <p className="text-xs text-stone-500 mt-1">
                            يمكنك تدوين حركة بيع، دفعة، أو مصروف جديد بالضغط على "تدوين قيد جديد ✍️" أعلاه.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      displayedEntries.map((row, index) => {
                        const isEven = index % 2 === 0;
                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-amber-100/60 transition-colors divide-x divide-x-reverse divide-stone-200 ${
                              isEven ? 'bg-transparent' : 'bg-stone-50/40'
                            }`}
                            style={{ height: '36px' }}
                          >
                            {/* Sequence number */}
                            <td className="py-2 px-2 text-center font-mono font-bold text-stone-600">
                              {(currentPage - 1) * rowsPerPage + index + 1}
                            </td>

                            {/* Date & Time */}
                            <td className="py-2 px-3 font-mono text-[11px] text-stone-700 whitespace-nowrap">
                              <div>{row.date}</div>
                              <div className="text-[10px] text-stone-500">{row.time}</div>
                            </td>

                            {/* Doc Number */}
                            <td className="py-2 px-3 font-mono text-[11px] font-bold text-stone-800 whitespace-nowrap">
                              <span className="px-1.5 py-0.5 rounded bg-stone-200/80 text-stone-900 border border-stone-300">
                                {row.docNumber}
                              </span>
                            </td>

                            {/* Description / Statement */}
                            <td className="py-2 px-4 text-stone-900 font-semibold leading-snug">
                              <div className="flex items-center gap-1.5">
                                {row.docType === 'sale' && (
                                  <ShoppingCart className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                )}
                                {row.docType === 'expense' && (
                                  <Receipt className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                )}
                                {row.docType === 'customer_payment' && (
                                  <Coins className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                )}
                                <span>{row.description}</span>
                              </div>
                              {row.paymentMethod && (
                                <span className="text-[10px] text-stone-500 block mt-0.5 font-normal">
                                  طريقة الدفع: {row.paymentMethod}
                                </span>
                              )}
                            </td>

                            {/* Debit (له / مقبوض) */}
                            <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800 bg-emerald-50/30 whitespace-nowrap">
                              {row.debit > 0 ? formatCurrency(row.debit, settings) : '—'}
                            </td>

                            {/* Credit (عليه / مدفوع) */}
                            <td className="py-2 px-3 text-left font-mono font-bold text-rose-800 bg-rose-50/30 whitespace-nowrap">
                              {row.credit > 0 ? formatCurrency(row.credit, settings) : '—'}
                            </td>

                            {/* Running Balance */}
                            <td className="py-2 px-3 text-left font-mono font-bold text-stone-900 bg-stone-100/50 whitespace-nowrap">
                              {formatCurrency(row.calculatedBalance, settings)}
                            </td>

                            {/* Party / Customer Name */}
                            <td className="py-2 px-3 text-stone-800 font-bold whitespace-nowrap">
                              {row.partyName}
                            </td>

                            {/* Actions (View Invoice) */}
                            <td className="py-2 px-2 text-center">
                              {row.invoiceRef ? (
                                <button
                                  type="button"
                                  onClick={() => onPreviewInvoice(row.invoiceRef!)}
                                  title="معاينة وطباعة الفاتورة"
                                  className="p-1 text-stone-600 hover:text-amber-800 hover:bg-stone-200 rounded transition-colors cursor-pointer"
                                >
                                  <Eye className="w-4 h-4 mx-auto" />
                                </button>
                              ) : (
                                <span className="text-[10px] text-stone-400 font-mono">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {/* Table Footer with Page Totals */}
                  {displayedEntries.length > 0 && (
                    <tfoot>
                      <tr className="bg-stone-200/90 font-bold text-stone-900 border-t-2 border-stone-400 divide-x divide-x-reverse divide-stone-300">
                        <td colSpan={4} className="py-2.5 px-4 text-right">
                          <span className="text-xs">المجموع الدفتري لهذه الصفحة:</span>
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-emerald-900 bg-emerald-100/60">
                          {formatCurrency(pageTotals.totalDebit, settings)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-rose-900 bg-rose-100/60">
                          {formatCurrency(pageTotals.totalCredit, settings)}
                        </td>
                        <td className="py-2.5 px-3 text-left font-mono text-stone-900 bg-stone-300/60">
                          {formatCurrency(pageTotals.netCash, settings)}
                        </td>
                        <td colSpan={2} className="py-2.5 px-3 text-stone-600 text-[11px]">
                          صافي حركة الصندوق
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* PAGE TURNER & FOOTER (تقليب الصفحات الدفترية) */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t-2 border-stone-400">
                <div className="text-xs text-stone-700">
                  <span>الصفحة </span>
                  <strong className="font-mono text-sm text-stone-900">{currentPage}</strong>
                  <span> من </span>
                  <strong className="font-mono text-sm text-stone-900">{totalPages}</strong>
                  <span className="mr-2 text-stone-500 font-medium">
                    (إجمالي القيود في السجل: {pageEntriesWithBalance.length})
                  </span>
                </div>

                {/* Page Navigation Controls */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-800 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed border border-stone-300"
                  >
                    <ChevronRight className="w-4 h-4" />
                    <span>◄ الصفحة السابقة</span>
                  </button>

                  <div className="px-3 py-1 rounded-md bg-stone-100 border border-stone-300 font-mono font-black text-xs text-stone-900">
                    ص {currentPage}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 disabled:opacity-40 text-stone-800 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer disabled:cursor-not-allowed border border-stone-300"
                  >
                    <span>الصفحة التالية ►</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* STORE AUDIT SEAL FOOTER */}
              <div className="text-center pt-2 text-[11px] text-stone-500 border-t border-dashed border-stone-300">
                سجل يومية رسمي - متجر خردوات المامو (بإدارة أحمد المامو) • حلب / إدلب • تدقيق الحسابات المستمر 2026
              </div>

            </div>
          </div>

          {/* Ribbon Bookmark Draping Out (شريط فاصل قماشي أحمر من الحافة السفلية) */}
          <div className="absolute -bottom-6 left-16 w-8 h-12 bg-gradient-to-b from-rose-700 via-rose-800 to-rose-900 shadow-xl rounded-b-md border-x border-b border-rose-950 pointer-events-none transform -rotate-3" />
        </div>
      </div>

      {/* MODAL: DIRECT QUICK ENTRY IN LEDGER ("تدوين قيد جديد في الدفتر ✍️") */}
      {isAddEntryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fcfbf7] dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border-4 border-[#3d2c22] relative animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-stone-400 dark:border-stone-700">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500 text-slate-950">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">تدوين قيد فوري في الدفتر</h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    تسجيل حركة مباشرة سريعة في دفتر اليومية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddEntryModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-white p-1 rounded-lg text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Entry Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {[
                { id: 'quick_sale', label: 'مبيع مباشر', icon: ShoppingCart },
                { id: 'expense', label: 'مصروف متجر', icon: Receipt },
                { id: 'debt_payment', label: 'قبض دين', icon: Coins },
                { id: 'cash_in_out', label: 'توريد/سحب', icon: Wallet },
              ].map((t) => {
                const Icon = t.icon;
                const isSelected = entryType === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEntryType(t.id as any)}
                    className={`p-2.5 rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-black'
                        : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-300 dark:border-slate-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Form */}
            <form onSubmit={handleCreateDirectEntry} className="space-y-3.5 text-xs">
              {/* Party / Customer Name */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                  {entryType === 'expense'
                    ? 'الجهة المستفيدة / المستلم:'
                    : entryType === 'debt_payment'
                    ? 'اسم الزبون المسدد:'
                    : 'اسم الزبون / الطرف:'}
                </label>
                <input
                  type="text"
                  value={formCustomerName}
                  onChange={(e) => setFormCustomerName(e.target.value)}
                  placeholder={
                    entryType === 'quick_sale'
                      ? 'زبون نقدي مباشر (أو اكتب اسم الزبون)'
                      : entryType === 'expense'
                      ? 'مصاريف محل / أجور / فاتورة'
                      : 'اسم العميل'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {/* Item / Statement Description */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                  البيان والشرح الدفتري:
                </label>
                <input
                  type="text"
                  required
                  value={formItemName}
                  onChange={(e) => setFormItemName(e.target.value)}
                  placeholder={
                    entryType === 'quick_sale'
                      ? 'مثال: علبة مسامير + قفل باب نحاسي'
                      : entryType === 'expense'
                      ? 'مثال: فاتورة كهرباء ومياه / أجور نقل بضاعة'
                      : 'شرح وتفاصيل الحركة'
                  }
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {/* Amount Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                    المبلغ الإجمالي ({settings.currency}):
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={formAmount || ''}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setFormAmount(val);
                      if (entryType !== 'quick_sale') {
                        setFormPaidAmount(val);
                      }
                    }}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm font-bold focus:outline-hidden focus:border-amber-500 text-left"
                  />
                </div>

                {entryType === 'quick_sale' ? (
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                      المقبوض نقداً في الصندوق:
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={formPaidAmount || ''}
                      onChange={(e) => setFormPaidAmount(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-sm font-bold focus:outline-hidden focus:border-amber-500 text-left"
                    />
                    {formAmount > formPaidAmount && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 block font-bold">
                        المتبقي آجل (دين): {formatCurrency(formAmount - formPaidAmount, settings)}
                      </span>
                    )}
                  </div>
                ) : entryType === 'expense' ? (
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                      بند المصروف:
                    </label>
                    <select
                      value={formExpenseCategory}
                      onChange={(e) => setFormExpenseCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                    >
                      <option value="نثريات">نثريات وضيافة</option>
                      <option value="فواتير">فواتير وكهرباء وماء</option>
                      <option value="أجور">أجور ونقل وشحن</option>
                      <option value="إيجار">إيجار المحل</option>
                      <option value="صيانة">صيانة وأدوات</option>
                      <option value="أخرى">مصاريف أخرى</option>
                    </select>
                  </div>
                ) : entryType === 'cash_in_out' ? (
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                      نوع الحركة:
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setFormCashFlow('in')}
                        className={`flex-1 py-2 rounded-xl font-bold border ${
                          formCashFlow === 'in'
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-stone-100 text-stone-700 border-stone-300'
                        }`}
                      >
                        توريد للصندوق +
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormCashFlow('out')}
                        className={`flex-1 py-2 rounded-xl font-bold border ${
                          formCashFlow === 'out'
                            ? 'bg-rose-600 text-white border-rose-700'
                            : 'bg-stone-100 text-stone-700 border-stone-300'
                        }`}
                      >
                        سحب من الصندوق -
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Notes */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-slate-300 mb-1">
                  ملاحظات إضافية (اختياري):
                </label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="أي تفاصيل خاصة بالحركة..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:border-amber-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-300 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEntryModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-stone-600 dark:text-slate-400 hover:bg-stone-200 dark:hover:bg-slate-800 font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formAmount <= 0}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 disabled:opacity-50 text-slate-950 font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تثبيت القيد في الدفتر ✍️</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
