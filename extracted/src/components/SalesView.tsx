import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Printer,
  Search,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Eye,
  UserPlus,
  Receipt,
  Tag,
  ArrowRight,
  Filter,
  BarChart3,
  Calendar,
  BookOpen,
  ScanBarcode,
  Camera,
  X,
  FileDown,
} from 'lucide-react';
import { exportInvoicePdf } from '../utils/pdfExport';
import {
  Customer,
  Product,
  SaleInvoice,
  SaleItem,
  StoreSettings,
} from '../types/accounting';
import {
  calculateInvoiceTotals,
  calculateSaleItemTotals,
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';
import { findProductByBarcode, playScanBeep } from '../utils/barcodeMatch';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { SalesAggregationView } from './SalesAggregationView';
import { QuickCustomerSaleModal } from './QuickCustomerSaleModal';

interface SalesViewProps {
  products: Product[];
  customers: Customer[];
  sales: SaleInvoice[];
  settings: StoreSettings;
  onSaveSale: (invoice: SaleInvoice, newCustomer?: Customer) => void;
  onReturnSale: (invoiceId: string, reason: string) => void;
  onPreviewInvoice: (invoice: SaleInvoice) => void;
  onDeleteSale?: (invoiceId: string) => void;
  initialTab?: 'create' | 'list' | 'aggregate';
  onNavigateToLedger?: () => void;
}

export const SalesView: React.FC<SalesViewProps> = ({
  products,
  customers,
  sales,
  settings,
  onSaveSale,
  onReturnSale,
  onPreviewInvoice,
  onDeleteSale,
  initialTab = 'create',
  onNavigateToLedger,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list' | 'aggregate'>(initialTab);
  const [isQuickCustomerSaleOpen, setIsQuickCustomerSaleOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // New Invoice Form State
  const [invoiceDate, setInvoiceDate] = useState(getTodayDateString());
  const [invoiceTime, setInvoiceTime] = useState(getCurrentTimeString());
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('cash_customer');
  const [customCustomerName, setCustomCustomerName] = useState<string>('');
  const [customCustomerPhone, setCustomCustomerPhone] = useState<string>('');
  const [isAddingNewCustomer, setIsAddingNewCustomer] = useState(false);

  // Items in active invoice
  const [items, setItems] = useState<SaleItem[]>([]);

  // Current item being prepared
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemUnitPrice, setItemUnitPrice] = useState<number>(0);
  const [itemCostPrice, setItemCostPrice] = useState<number>(0);
  const [itemDiscount, setItemDiscount] = useState<number>(0);
  const [itemUnit, setItemUnit] = useState<string>('قطعة');
  const [itemCategory, setItemCategory] = useState<string>('');
  const [itemNotes, setItemNotes] = useState<string>('');

  // Invoice Level Payment
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debt' | 'partial'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<number>(0);
  const [invoiceNotes, setInvoiceNotes] = useState<string>('');

  // Search & Filter in invoices list
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'returned'>('all');

  // Barcode Scanner & Quick Code Lookup State
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [quickBarcodeInput, setQuickBarcodeInput] = useState('');
  const [barcodeFeedback, setBarcodeFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Return modal state
  const [returnInvoiceId, setReturnInvoiceId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState<string>('');

  // Compute next invoice number
  const nextInvoiceNumber = useMemo(() => {
    const count = sales.length + 1;
    return `ف-${1000 + count}`;
  }, [sales.length]);

  // Product Selection handler
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setItemUnitPrice(prod.sellingPrice);
      setItemCostPrice(prod.costPrice);
      setItemUnit(prod.unit);
      setItemCategory(prod.category);
    }
  };

  // Add or increment a matched product directly from barcode scan
  const handleProductScanned = (prod: Product, autoAdd: boolean) => {
    if (!autoAdd) {
      handleSelectProduct(prod.id);
      setBarcodeFeedback({
        type: 'success',
        message: `تم اختيار المادة «${prod.name}» (${prod.barcode || prod.code}) — اضبط الكمية واضغط إدراج.`,
      });
      return;
    }

    setItems((prevItems) => {
      const existingIndex = prevItems.findIndex(
        (it) =>
          it.productId === prod.id &&
          it.unitPrice === prod.sellingPrice &&
          it.discount === 0
      );

      if (existingIndex !== -1) {
        return prevItems.map((it, idx) => {
          if (idx !== existingIndex) return it;
          const nextQty = it.quantity + 1;
          const calc = calculateSaleItemTotals(
            nextQty,
            it.costPrice,
            it.unitPrice,
            it.discount
          );
          return {
            ...it,
            quantity: nextQty,
            total: calc.total,
            profit: calc.profit,
          };
        });
      }

      const calc = calculateSaleItemTotals(
        1,
        prod.costPrice,
        prod.sellingPrice,
        0
      );
      const newItem: SaleItem = {
        productId: prod.id,
        productCode: prod.code,
        productName: prod.name,
        category: prod.category,
        unit: prod.unit,
        quantity: 1,
        costPrice: prod.costPrice,
        unitPrice: prod.sellingPrice,
        discount: 0,
        total: calc.total,
        profit: calc.profit,
      };
      return [...prevItems, newItem];
    });

    setBarcodeFeedback({
      type: 'success',
      message: `تم مسح وإدراج «${prod.name}» إلى الفاتورة (${formatCurrency(prod.sellingPrice, settings)}).`,
    });
  };

  // Quick manual / USB scanner lookup submit
  const handleQuickBarcodeLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickBarcodeInput.trim()) return;
    const match = findProductByBarcode(products, quickBarcodeInput);
    if (match.product) {
      playScanBeep(true);
      handleProductScanned(match.product, true);
      setQuickBarcodeInput('');
    } else {
      playScanBeep(false);
      setBarcodeFeedback({
        type: 'error',
        message: `لم يتم العثور على مادة مطابقة للباركود أو الكود: ${quickBarcodeInput.trim()}`,
      });
    }
  };

  // Add Item to Invoice table
  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (itemQuantity <= 0) {
      alert('يرجى تحديد كمية صحيحة أكبر من صفر');
      return;
    }

    const itemCalculations = calculateSaleItemTotals(
      itemQuantity,
      itemCostPrice,
      itemUnitPrice,
      itemDiscount
    );

    const newItem: SaleItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      category: itemCategory || prod.category,
      unit: itemUnit || prod.unit,
      quantity: Number(itemQuantity),
      costPrice: Number(itemCostPrice),
      unitPrice: Number(itemUnitPrice),
      discount: Number(itemDiscount),
      total: itemCalculations.total,
      profit: itemCalculations.profit,
    };

    setItems([...items, newItem]);

    // Reset item form
    setSelectedProductId('');
    setItemQuantity(1);
    setItemUnitPrice(0);
    setItemCostPrice(0);
    setItemDiscount(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate totals of current invoice
  const currentTotals = useMemo(() => {
    return calculateInvoiceTotals(
      items,
      invoiceDiscount,
      paidAmountInput,
      paymentMethod
    );
  }, [items, invoiceDiscount, paidAmountInput, paymentMethod]);

  // Complete Sale
  const handleCompleteSale = () => {
    if (items.length === 0) {
      alert('يرجى إضافة مادة واحدة على الأقل إلى الفاتورة');
      return;
    }

    let customerName = 'زبون نقدي عام';
    let isCashCust = true;
    let newCustomerObj: Customer | undefined;

    if (isAddingNewCustomer && customCustomerName.trim()) {
      customerName = customCustomerName.trim();
      isCashCust = false;
      newCustomerObj = {
        id: `cust-${Date.now()}`,
        name: customerName,
        phone: customCustomerPhone.trim(),
        totalPurchases: currentTotals.total,
        totalPaid: currentTotals.paidAmount,
        totalDebt: currentTotals.remainingAmount,
        notes: 'تمت إضافته أثناء البيع',
        createdAt: invoiceDate,
      };
    } else if (selectedCustomerId !== 'cash_customer') {
      const existingCust = customers.find((c) => c.id === selectedCustomerId);
      if (existingCust) {
        customerName = existingCust.name;
        isCashCust = false;
      }
    }

    // Safety: if debt or partial, require a customer name
    if (paymentMethod !== 'cash' && isCashCust) {
      alert('تنبيه: لا يمكن البيع بالدين لـ «زبون نقدي عام» دون اسم. يرجى اختيار زبون مسجل أو إدخال اسم الزبون لتوثيق الدين.');
      return;
    }

    const newInvoice: SaleInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber,
      date: invoiceDate,
      time: invoiceTime,
      customerId: newCustomerObj ? newCustomerObj.id : selectedCustomerId,
      customerName,
      isCashCustomer: isCashCust,
      items: [...items],
      subtotal: currentTotals.subtotal,
      discount: currentTotals.discount,
      total: currentTotals.total,
      cogs: currentTotals.cogs,
      grossProfit: currentTotals.grossProfit,
      paymentMethod,
      paidAmount: currentTotals.paidAmount,
      remainingAmount: currentTotals.remainingAmount,
      status: 'completed',
      notes: invoiceNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSaveSale(newInvoice, newCustomerObj);

    // Reset Form
    setItems([]);
    setInvoiceDiscount(0);
    setPaymentMethod('cash');
    setPaidAmountInput(0);
    setInvoiceNotes('');
    setIsAddingNewCustomer(false);
    setCustomCustomerName('');
    setCustomCustomerPhone('');
    setSelectedCustomerId('cash_customer');
    setInvoiceTime(getCurrentTimeString());

    // Open print preview
    onPreviewInvoice(newInvoice);
  };

  // Filtered sales list
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => {
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchNum = s.invoiceNumber.toLowerCase().includes(q);
          const matchCust = s.customerName.toLowerCase().includes(q);
          const matchItem = s.items.some((it) =>
            it.productName.toLowerCase().includes(q)
          );
          const matchDate = s.date.includes(q);
          return matchNum || matchCust || matchItem || matchDate;
        }
        return true;
      })
      .reverse();
  }, [sales, statusFilter, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر المبيعات اليومية وفواتير البيع
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تسجيل عمليات البيع، خصم المخزون، حساب الأرباح، وتوثيق المقبوضات والديون
          </p>
        </div>

        {/* Action & Tab switch */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setIsQuickCustomerSaleOpen(true)}
            className="px-3.5 py-2 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ مبيع زبون مباشر</span>
          </button>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'create'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              + فاتورة جديدة
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'list'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              سجل الفواتير ({sales.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('aggregate')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'aggregate'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>تجميع مبيعات شهر / مدة</span>
            </button>
            {onNavigateToLedger && (
              <button
                type="button"
                onClick={onNavigateToLedger}
                className="px-3.5 py-1.5 text-xs font-black rounded-lg transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-amber-600 to-amber-700 text-white hover:brightness-110 shadow-xs border border-amber-500/50"
                title="الانتقال إلى الواجهة الدفترية الورقية التقليدية"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>الدفتر الورقي 📖</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Invoice Form (2 cols) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Invoice Top Details Card */}
            <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  بيانات الفاتورة والزبون
                </span>
                <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md">
                  رقم الفاتورة: <span className="font-mono">{nextInvoiceNumber}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    تاريخ العملية
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    الوقت
                  </label>
                  <input
                    type="time"
                    value={invoiceTime}
                    onChange={(e) => setInvoiceTime(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      اختيار الزبون
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewCustomer(!isAddingNewCustomer)}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700"
                    >
                      {isAddingNewCustomer ? 'اختيار من المسجلين' : '+ زبون جديد'}
                    </button>
                  </div>

                  {!isAddingNewCustomer ? (
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
                    >
                      <option value="cash_customer">زبون نقدي عام (دون تسجيل اسم)</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.totalDebt > 0 ? `(عليه دين: ${formatCurrency(c.totalDebt, settings)})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="اسم الزبون الجديد..."
                        value={customCustomerName}
                        onChange={(e) => setCustomCustomerName(e.target.value)}
                        className="w-full text-xs p-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        placeholder="رقم الهاتف (اختياري)..."
                        value={customCustomerPhone}
                        onChange={(e) => setCustomCustomerPhone(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Add Items to Invoice Card */}
            <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  إضافة المواد المباعة
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setBarcodeFeedback(null);
                    setIsBarcodeScannerOpen(true);
                  }}
                  className="px-3.5 py-2 text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer min-h-[40px]"
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <ScanBarcode className="w-4 h-4 shrink-0" />
                  <span>مسح باركود بالكاميرا</span>
                </button>
              </div>

              {/* Quick Barcode / Product Code Input Bar */}
              <form
                onSubmit={handleQuickBarcodeLookup}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              >
                <div className="relative flex-1">
                  <ScanBarcode className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={quickBarcodeInput}
                    onChange={(e) => setQuickBarcodeInput(e.target.value)}
                    placeholder="إدخال سريع بالباركود أو كود المادة (ثم Enter للإدراج الفوري)..."
                    className="w-full text-xs pr-9 pl-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden font-mono"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors shrink-0 cursor-pointer"
                >
                  إدراج بالباركود
                </button>
              </form>

              {barcodeFeedback && (
                <div
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                    barcodeFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-rose-50 border-rose-200 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {barcodeFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span className="font-bold truncate">{barcodeFeedback.message}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBarcodeFeedback(null)}
                    aria-label="إغلاق التنبيه"
                    className="p-1 rounded-md hover:bg-black/5 shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Product selection inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    المادة من المستودع
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
                  >
                    <option value="">-- اختر مادة من المخزون --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (متوفر: {p.currentStock} {p.unit}) - {formatCurrency(p.sellingPrice, settings)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    الكمية المباعة
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={itemQuantity}
                    onChange={(e) => setItemQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    الوحدة
                  </label>
                  <input
                    type="text"
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-slate-50 font-medium"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    سعر البيع
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemUnitPrice}
                    onChange={(e) => setItemUnitPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    خصم السطر
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemDiscount}
                    onChange={(e) => setItemDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {/* Selected product cost & profit preview */}
              {selectedProductId && (
                <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-4 text-slate-600">
                    <span>
                      سعر التكلفة: <strong className="font-mono">{formatCurrency(itemCostPrice, settings)}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      مجمل ربح السطر المتوقع: <strong className="font-mono text-emerald-700">
                        {formatCurrency(
                          calculateSaleItemTotals(itemQuantity, itemCostPrice, itemUnitPrice, itemDiscount).profit,
                          settings
                        )}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>إدراج المادة للفاتورة</span>
                  </button>
                </div>
              )}

              {/* Items Table in current invoice */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">المادة</th>
                      <th className="py-2 px-3">التصنيف</th>
                      <th className="py-2 px-3 text-center">الكمية</th>
                      <th className="py-2 px-3 text-center">الوحدة</th>
                      <th className="py-2 px-3 text-left">سعر البيع</th>
                      <th className="py-2 px-3 text-left">التكلفة</th>
                      <th className="py-2 px-3 text-left">الإجمالي</th>
                      <th className="py-2 px-3 text-left">الربح</th>
                      <th className="py-2 px-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          لم يتم إدراج مواد بعد. اختر مادة من القائمة أعلاه واضغط «إدراج المادة للفاتورة».
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{it.productName}</td>
                          <td className="py-2 px-3 text-slate-500">{it.category}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold">{it.quantity}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums">{formatCurrency(it.unitPrice, settings)}</td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums text-slate-500">{formatCurrency(it.costPrice, settings)}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(it.total, settings)}</td>
                          <td className="py-2 px-3 text-left font-mono font-semibold text-emerald-700 tabular-nums">{formatCurrency(it.profit, settings)}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              aria-label="حذف السطر"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-md transition-colors"
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
          </div>

          {/* Invoice Summary & Checkout Card (1 col) */}
          <div className="space-y-4">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 sticky top-20">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                ملخص الفاتورة والدفع
              </h3>

              {/* Subtotal & Discount */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المجموع الفرعي ({items.length} مواد):</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrency(currentTotals.subtotal, settings)}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    خصم إضافي على كامل الفاتورة
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={invoiceDiscount}
                    onChange={(e) => setInvoiceDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>صافي إجمالي الفاتورة:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(currentTotals.total, settings)}
                  </span>
                </div>

                <div className="flex justify-between text-xs text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg">
                  <span>مجمل الربح المحقق:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(currentTotals.grossProfit, settings)}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block">
                  طريقة الدفع
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setPaidAmountInput(currentTotals.total);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نقداً
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('debt');
                      setPaidAmountInput(0);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      paymentMethod === 'debt'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    آجل (دين)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('partial')}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      paymentMethod === 'partial'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    دفعة جزئية
                  </button>
                </div>
              </div>

              {/* Payment Details */}
              {paymentMethod === 'partial' && (
                <div className="space-y-2 p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                      المبلغ المقبوض نقداً الآن
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={currentTotals.total}
                      value={paidAmountInput}
                      onChange={(e) => setPaidAmountInput(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Amounts summary */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-emerald-800">
                  <span>المبلغ المقبوض للصندوق:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(currentTotals.paidAmount, settings)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-rose-700">
                  <span>المبلغ المتبقي دين على الزبون:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(currentTotals.remainingAmount, settings)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ملاحظات الفاتورة (اختياري)
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات تسليم، مكان الورشة..."
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              {/* Submit CTA */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={items.length === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  items.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>إتمام البيع وحفظ الفاتورة</span>
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === 'list' ? (
        /* Saved Invoices List Tab */
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة، اسم الزبون، المادة، أو التاريخ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
              >
                <option value="all">جميع الحالات</option>
                <option value="completed">مكتملة فقط</option>
                <option value="returned">مرتجعة / ملغاة</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الفاتورة</th>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">الزبون</th>
                    <th className="py-3 px-4 text-center">عدد المواد</th>
                    <th className="py-3 px-4 text-left">إجمالي الفاتورة</th>
                    <th className="py-3 px-4 text-left">المدفوع</th>
                    <th className="py-3 px-4 text-left">الدين المتبقي</th>
                    <th className="py-3 px-4 text-left">الربح</th>
                    <th className="py-3 px-4 text-center">الحالة</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        لا توجد فواتير مطابقة للبحث.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold font-mono text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {inv.date} · {inv.time}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {inv.customerName}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {inv.items.length}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(inv.total, settings)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-emerald-700 tabular-nums font-semibold">
                          {formatCurrency(inv.paidAmount, settings)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-rose-700 tabular-nums font-semibold">
                          {inv.remainingAmount > 0
                            ? formatCurrency(inv.remainingAmount, settings)
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-teal-700 tabular-nums">
                          {formatCurrency(inv.grossProfit, settings)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              inv.status === 'completed'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {inv.status === 'completed' ? 'مكتملة' : 'مرتجعة'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onPreviewInvoice(inv)}
                              title="معاينة وطباعة الفاتورة"
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            >
                              <Printer className="w-4 h-4" />
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
                              title="تنزيل الفاتورة بصيغة PDF عبر jsPDF"
                              className="p-1.5 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>
                            {inv.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReturnInvoiceId(inv.id);
                                  setReturnReason('');
                                }}
                                title="إرجاع بضاعة الفاتورة أو إلغاؤها"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {onDeleteSale && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(inv.id)}
                                title="حذف الفاتورة نهائياً من قاعدة البيانات (Firebase)"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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
      ) : (
        <SalesAggregationView
          sales={sales}
          customers={customers}
          products={products}
          settings={settings}
          onPreviewInvoice={onPreviewInvoice}
          onOpenQuickSale={() => setIsQuickCustomerSaleOpen(true)}
        />
      )}

      {/* Return Invoice Confirmation Modal */}
      {returnInvoiceId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                إرجاع فاتورة مبيعات وعكس الحسابات والمخزون
              </h3>
            </div>
            <p className="text-xs text-slate-600">
              سيقوم التطبيق تلقائياً بإعادة الكميات المباعة إلى المستودع، وخصم المبلغ المقبوض من الصندوق، وإلغاء أي مديونية مرتبطة بهذه الفاتورة مع توثيق الحركة في سجل التدقيق.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                سبب الإرجاع أو الإلغاء (مطلوب للتوثيق)
              </label>
              <input
                type="text"
                placeholder="مثال: تبديل مقاس الأنبوب، خطأ في الحساب..."
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReturnInvoiceId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!returnReason.trim()) {
                    alert('يرجى كتابة سبب الإرجاع لحماية دقة الحسابات');
                    return;
                  }
                  onReturnSale(returnInvoiceId, returnReason.trim());
                  setReturnInvoiceId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
              >
                تأكيد الإرجاع وعكس القيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Permanently from Firebase Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                حذف الفاتورة نهائياً من قاعدة البيانات (Firebase)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              تحذير: هل أنت متأكد من رغبتك في حذف هذه الفاتورة تماماً من قاعدة بيانات Firebase السحابية؟
              سيتم محو سجل الفاتورة وتفريغ المساحة المرتبطة بها في الخادم السحابي.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteSale && deleteConfirmId) {
                    onDeleteSale(deleteConfirmId);
                  }
                  setDeleteConfirmId(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs cursor-pointer"
              >
                تأكيد الحذف من Firebase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Customer Direct Sale Modal */}
      <QuickCustomerSaleModal
        isOpen={isQuickCustomerSaleOpen}
        onClose={() => setIsQuickCustomerSaleOpen(false)}
        customers={customers}
        products={products}
        settings={settings}
        onSaveSale={onSaveSale}
        onPreviewInvoice={onPreviewInvoice}
      />

      {/* Device Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        products={products}
        settings={settings}
        onProductScanned={handleProductScanned}
        defaultAutoAdd={true}
      />
    </div>
  );
};
