import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart,
  X,
  Plus,
  Trash2,
  Check,
  Search,
  User,
  CreditCard,
  Printer,
  Boxes,
  Percent,
  CheckCircle2,
  AlertCircle,
  ScanBarcode,
} from 'lucide-react';
import { Customer, Product, SaleInvoice, SaleItem, StoreSettings } from '../types/accounting';
import {
  calculateInvoiceTotals,
  calculateSaleItemTotals,
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';
import { BarcodeScannerModal } from './BarcodeScannerModal';

interface QuickCustomerSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  products: Product[];
  settings: StoreSettings;
  initialCustomerId?: string;
  preselectedCustomerId?: string;
  onSaveSale: (invoice: SaleInvoice, newCustomer?: Customer) => void;
  onPreviewInvoice?: (invoice: SaleInvoice) => void;
}

export const QuickCustomerSaleModal: React.FC<QuickCustomerSaleModalProps> = ({
  isOpen,
  onClose,
  customers,
  products,
  settings,
  initialCustomerId,
  preselectedCustomerId,
  onSaveSale,
  onPreviewInvoice,
}) => {
  // Customer selection
  const effectiveCustId = preselectedCustomerId || initialCustomerId || '';
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(effectiveCustId);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedCustomerId(effectiveCustId);
    }
  }, [isOpen, effectiveCustId]);

  // Cart / Items
  const [items, setItems] = useState<SaleItem[]>([]);

  // Item inputs
  const [productSearch, setProductSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);

  // Invoice parameters
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debt' | 'partial'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [shouldPrint, setShouldPrint] = useState(true);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Sync initial customer
  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
      setIsNewCustomer(false);
    } else if (customers.length > 0 && !selectedCustomerId) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [initialCustomerId, customers]);

  // Autocomplete products
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return [];
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
      .slice(0, 6);
  }, [products, productSearch]);

  const handleSelectProduct = (p: Product) => {
    setSelectedProduct(p);
    setUnitPrice(p.sellingPrice);
    setProductSearch(p.name);
  };

  const handleAddItem = () => {
    if (!selectedProduct && !productSearch.trim()) return;

    const prodName = selectedProduct ? selectedProduct.name : productSearch.trim();
    const prodCode = selectedProduct ? selectedProduct.code : `صنف-${Date.now().toString().slice(-4)}`;
    const cost = selectedProduct ? selectedProduct.costPrice : Math.round(unitPrice * 0.75);
    const cat = selectedProduct ? selectedProduct.category : 'عامة';
    const unit = selectedProduct ? selectedProduct.unit : 'قطعة';

    const safeQty = Math.max(1, Number(quantity) || 1);
    const safePrice = Math.max(0, Number(unitPrice) || 0);
    const safeDiscount = Math.max(0, Number(discount) || 0);

    const { total, profit } = calculateSaleItemTotals(safeQty, cost, safePrice, safeDiscount);

    const newItem: SaleItem = {
      productId: selectedProduct ? selectedProduct.id : `quick-prod-${Date.now()}`,
      productCode: prodCode,
      productName: prodName,
      category: cat,
      unit,
      quantity: safeQty,
      costPrice: cost,
      unitPrice: safePrice,
      discount: safeDiscount,
      total,
      profit,
    };

    setItems((prev) => [...prev, newItem]);

    // Reset item inputs
    setSelectedProduct(null);
    setProductSearch('');
    setQuantity(1);
    setUnitPrice(0);
    setDiscount(0);
  };

  const handleBarcodeScanned = (prod: Product, autoAdd: boolean) => {
    if (!autoAdd) {
      handleSelectProduct(prod);
      return;
    }

    setItems((prev) => {
      const existingIdx = prev.findIndex(
        (it) =>
          it.productId === prod.id &&
          it.unitPrice === prod.sellingPrice &&
          it.discount === 0
      );
      if (existingIdx !== -1) {
        return prev.map((it, idx) => {
          if (idx !== existingIdx) return it;
          const nextQty = it.quantity + 1;
          const { total, profit } = calculateSaleItemTotals(
            nextQty,
            it.costPrice,
            it.unitPrice,
            it.discount
          );
          return { ...it, quantity: nextQty, total, profit };
        });
      }
      const { total, profit } = calculateSaleItemTotals(
        1,
        prod.costPrice,
        prod.sellingPrice,
        0
      );
      return [
        ...prev,
        {
          productId: prod.id,
          productCode: prod.code,
          productName: prod.name,
          category: prod.category,
          unit: prod.unit,
          quantity: 1,
          costPrice: prod.costPrice,
          unitPrice: prod.sellingPrice,
          discount: 0,
          total,
          profit,
        },
      ];
    });
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Calculations
  const invoiceTotals = useMemo(() => {
    return calculateInvoiceTotals(items, invoiceDiscount, paidAmount, paymentMethod);
  }, [items, invoiceDiscount, paidAmount, paymentMethod]);

  // Adjust paid amount based on method
  useEffect(() => {
    if (paymentMethod === 'cash') {
      setPaidAmount(invoiceTotals.total);
    } else if (paymentMethod === 'debt') {
      setPaidAmount(0);
    }
  }, [paymentMethod, invoiceTotals.total]);

  // Selected customer object
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      alert('يرجى إضافة مادة واحدة على الأقل في الفاتورة.');
      return;
    }

    let customerId = selectedCustomerId;
    let customerName = currentCustomer?.name || 'زبون نقدي عام';
    let newCust: Customer | undefined;

    if (isNewCustomer && newCustomerName.trim()) {
      customerId = `cust-${Date.now()}`;
      customerName = newCustomerName.trim();
      newCust = {
        id: customerId,
        name: customerName,
        phone: newCustomerPhone.trim(),
        totalPurchases: 0,
        totalPaid: 0,
        totalDebt: 0,
        createdAt: getTodayDateString(),
      };
    } else if (!customerId) {
      customerId = 'cash_customer';
      customerName = 'زبون نقدي عام';
    }

    const invoiceNumber = `ف-${Date.now().toString().slice(-4)}`;
    const invoiceDate = getTodayDateString();
    const invoiceTime = getCurrentTimeString();

    const invoice: SaleInvoice = {
      id: `sale-${Date.now()}`,
      invoiceNumber,
      date: invoiceDate,
      time: invoiceTime,
      customerId,
      customerName,
      isCashCustomer: customerId === 'cash_customer',
      items,
      subtotal: invoiceTotals.subtotal,
      discount: invoiceTotals.discount,
      total: invoiceTotals.total,
      cogs: invoiceTotals.cogs,
      grossProfit: invoiceTotals.grossProfit,
      paymentMethod,
      paidAmount: paymentMethod === 'cash' ? invoiceTotals.total : paymentMethod === 'debt' ? 0 : paidAmount,
      remainingAmount:
        paymentMethod === 'cash' ? 0 : paymentMethod === 'debt' ? invoiceTotals.total : invoiceTotals.remainingAmount,
      status: 'completed',
      notes: notes.trim() || 'بيع مباشر للزبون',
      createdAt: `${invoiceDate} ${invoiceTime}`,
    };

    onSaveSale(invoice, newCust);

    if (shouldPrint && onPreviewInvoice) {
      onPreviewInvoice(invoice);
    }

    // Reset and close
    setItems([]);
    setInvoiceDiscount(0);
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto font-['Cairo',sans-serif]">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-amber-300">
                إدراج مبيع زبون مباشر (نظام البيع السريع)
              </h3>
              <p className="text-xs text-slate-300">
                تسجيل فاتورة فورية، خصم المخزون، وتحديث حساب الزبون والصندوق
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Customer Selection Banner */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <User className="w-4 h-4 text-amber-500" />
                تحديد الزبون المشتري:
              </span>
              <button
                type="button"
                onClick={() => setIsNewCustomer(!isNewCustomer)}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
              >
                {isNewCustomer ? '← العودة لاختيار زبون مسجل' : '+ تسجيل زبون جديد في هذه الفاتورة'}
              </button>
            </div>

            {isNewCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    اسم الزبون الجديد *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="مثال: أحمد نوار / ورشة البناء"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    رقم الهاتف (اختياري)
                  </label>
                  <input
                    type="text"
                    value={newCustomerPhone}
                    onChange={(e) => setNewCustomerPhone(e.target.value)}
                    placeholder="09xxxxxxxx"
                    className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full sm:flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-bold focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                >
                  <option value="cash_customer">زبون نقدي عام (بدون فتح حساب)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} — {c.totalDebt > 0 ? `[دين: ${formatCurrency(c.totalDebt, settings)}]` : '[خالص]'}
                    </option>
                  ))}
                </select>

                {currentCustomer && currentCustomer.totalDebt > 0 && (
                  <div className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 rounded-lg text-xs font-bold shrink-0">
                    رصيد الدين السابق: {formatCurrency(currentCustomer.totalDebt, settings)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Product Addition Row */}
          <div className="p-3.5 bg-amber-50/50 dark:bg-slate-800/40 border border-amber-200/80 dark:border-slate-700/60 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                إضافة مادة للفاتورة سريعاً:
              </span>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ScanBarcode className="w-3.5 h-3.5" />
                <span>مسح باركود</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 relative">
              {/* Product Search */}
              <div className="sm:col-span-5 relative">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    if (selectedProduct) setSelectedProduct(null);
                  }}
                  placeholder="ابحث عن مادة بالمستودع أو اكتب اسماً مباشراً..."
                  className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />

                {/* Dropdown Suggestions */}
                {filteredProducts.length > 0 && !selectedProduct && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredProducts.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-right p-2.5 hover:bg-amber-50 dark:hover:bg-slate-700/60 transition-colors flex items-center justify-between text-xs cursor-pointer"
                      >
                        <div>
                          <strong className="text-slate-900 dark:text-white block">{p.name}</strong>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            كود: {p.code} | رصيد: {p.currentStock} {p.unit}
                          </span>
                        </div>
                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">
                          {formatCurrency(p.sellingPrice, settings)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity */}
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  value={quantity || ''}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  placeholder="الكمية"
                  className="w-full px-3 py-2 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Price */}
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={unitPrice || ''}
                  onChange={(e) => setUnitPrice(Number(e.target.value))}
                  placeholder="سعر الوحدة"
                  className="w-full px-3 py-2 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Line Discount */}
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="خصم (ل.س)"
                  className="w-full px-3 py-2 text-xs text-center bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                />
              </div>

              {/* Add Button */}
              <div className="sm:col-span-1">
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full h-full min-h-[34px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-xs flex items-center justify-center transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">المادة</th>
                  <th className="p-2.5 text-center">الكمية</th>
                  <th className="p-2.5 text-center">السعر</th>
                  <th className="p-2.5 text-center">الخصم</th>
                  <th className="p-2.5 text-left">الإجمالي</th>
                  <th className="p-2.5 text-center w-10">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      لم يتم إدراج مواد بعد. استخدم شريط البحث أعلاه لإضافة المواد سريعاً.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {item.productName}
                      </td>
                      <td className="p-2.5 text-center font-bold font-mono">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="p-2.5 text-center font-mono">{formatNumber(item.unitPrice)}</td>
                      <td className="p-2.5 text-center font-mono text-amber-600">
                        {item.discount > 0 ? formatNumber(item.discount) : '-'}
                      </td>
                      <td className="p-2.5 text-left font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(item.total, settings)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Method & Totals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
            {/* Payment Choice */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                طريقة تحصيل المبيع:
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  💵 نقداً بالكامل
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('debt')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'debt'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  📝 آجل / دين
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('partial')}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                    paymentMethod === 'partial'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                  }`}
                >
                  ⚖️ دفعة جزئية
                </button>
              </div>

              {paymentMethod === 'partial' && (
                <div className="p-3 bg-amber-50 dark:bg-slate-800 rounded-xl space-y-2 border border-amber-200 dark:border-slate-700">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    المبلغ المقبوض نقداً الآن:
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={invoiceTotals.total}
                    value={paidAmount || ''}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-xs text-center font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 text-left">
                    المتبقي كدين: {formatCurrency(Math.max(0, invoiceTotals.total - paidAmount), settings)}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات على الفاتورة (اختياري)..."
                  className="w-full px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-hidden"
                />
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{formatCurrency(invoiceTotals.subtotal, settings)}</span>
              </div>
              <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                <span>خصم إضافي:</span>
                <input
                  type="number"
                  min="0"
                  value={invoiceDiscount || ''}
                  onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="w-24 px-2 py-0.5 text-left font-mono font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                <span>الصافي المطلوب:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 text-base">
                  {formatCurrency(invoiceTotals.total, settings)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>المقبوض نقداً:</span>
                <span className="font-mono font-bold text-teal-600">
                  {formatCurrency(paymentMethod === 'cash' ? invoiceTotals.total : paymentMethod === 'debt' ? 0 : paidAmount, settings)}
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>المسجل كدين:</span>
                <span className="font-mono font-bold text-rose-600">
                  {formatCurrency(paymentMethod === 'cash' ? 0 : paymentMethod === 'debt' ? invoiceTotals.total : invoiceTotals.remainingAmount, settings)}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={shouldPrint}
                onChange={(e) => setShouldPrint(e.target.checked)}
                className="w-4 h-4 text-amber-500 rounded border-slate-300"
              />
              <span>فتح نافذة الطباعة / المعاينة فور الحفظ</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={items.length === 0}
                className="px-5 py-2 text-xs font-black text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl transition-all shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>إصدار الفاتورة وحفظ المبيع</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        settings={settings}
        onProductScanned={handleBarcodeScanned}
        defaultAutoAdd={true}
      />
    </div>
  );
};
