import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  Boxes,
  Building2,
  DollarSign,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  Product,
  PurchaseInvoice,
  PurchaseItem,
  StoreSettings,
  Supplier,
} from '../types/accounting';
import {
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';

interface PurchasesViewProps {
  products: Product[];
  suppliers: Supplier[];
  purchases: PurchaseInvoice[];
  settings: StoreSettings;
  onSavePurchase: (invoice: PurchaseInvoice, newSupplier?: Supplier) => void;
  onDeletePurchase?: (purchaseId: string) => void;
}

export const PurchasesView: React.FC<PurchasesViewProps> = ({
  products,
  suppliers,
  purchases,
  settings,
  onSavePurchase,
  onDeletePurchase,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [purchaseDate, setPurchaseDate] = useState(getTodayDateString());
  const [purchaseTime, setPurchaseTime] = useState(getCurrentTimeString());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');
  const [customSupplierPhone, setCustomSupplierPhone] = useState<string>('');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState<string>('');
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(false);

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([]);

  // Item form
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemCostPrice, setItemCostPrice] = useState<number>(0);
  const [itemUnit, setItemUnit] = useState<string>('قطعة');
  const [itemCategory, setItemCategory] = useState<string>('');

  // Invoice level additions
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [purchaseDiscount, setPurchaseDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'debt' | 'partial'>('cash');
  const [paidAmountInput, setPaidAmountInput] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  // Search in purchases
  const [searchQuery, setSearchQuery] = useState('');

  // Next purchase invoice number
  const nextInvoiceNumber = useMemo(() => {
    return `ش-${1000 + purchases.length + 1}`;
  }, [purchases.length]);

  // Handle select product
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setItemCostPrice(prod.costPrice);
      setItemUnit(prod.unit);
      setItemCategory(prod.category);
    }
  };

  // Add Item to table
  const handleAddItem = () => {
    if (!selectedProductId) return;
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    if (itemQuantity <= 0) {
      alert('يرجى إدخال كمية صحيحة');
      return;
    }

    const newItem: PurchaseItem = {
      productId: prod.id,
      productCode: prod.code,
      productName: prod.name,
      category: itemCategory || prod.category,
      unit: itemUnit || prod.unit,
      quantity: Number(itemQuantity),
      costPrice: Number(itemCostPrice),
      total: Number(itemQuantity) * Number(itemCostPrice),
    };

    setItems([...items, newItem]);

    // Reset item input
    setSelectedProductId('');
    setItemQuantity(1);
    setItemCostPrice(0);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Totals
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => sum + it.total, 0);
  }, [items]);

  const grandTotal = useMemo(() => {
    const raw = subtotal + Number(shippingCost) - Number(purchaseDiscount);
    return Math.max(0, raw);
  }, [subtotal, shippingCost, purchaseDiscount]);

  const actualPaidAmount = useMemo(() => {
    if (paymentMethod === 'cash') return grandTotal;
    if (paymentMethod === 'debt') return 0;
    return Math.min(grandTotal, Math.max(0, Number(paidAmountInput) || 0));
  }, [paymentMethod, grandTotal, paidAmountInput]);

  const remainingDebt = useMemo(() => {
    return Math.max(0, grandTotal - actualPaidAmount);
  }, [grandTotal, actualPaidAmount]);

  // Save Purchase Invoice
  const handleCompletePurchase = () => {
    if (items.length === 0) {
      alert('يرجى إضافة مادة مشتراة واحدة على الأقل');
      return;
    }

    let supplierName = '';
    let supplierId = '';
    let newSupplierObj: Supplier | undefined;

    if (isAddingNewSupplier) {
      if (!customSupplierName.trim()) {
        alert('يرجى إدخال اسم المورد الجديد');
        return;
      }
      supplierId = `supp-${Date.now()}`;
      supplierName = customSupplierName.trim();
      newSupplierObj = {
        id: supplierId,
        name: supplierName,
        phone: customSupplierPhone.trim(),
        totalPurchases: grandTotal,
        totalPaid: actualPaidAmount,
        totalDebt: remainingDebt,
        createdAt: purchaseDate,
      };
    } else {
      if (!selectedSupplierId) {
        alert('يرجى اختيار المورد من القائمة أو إضافة مورد جديد');
        return;
      }
      const existing = suppliers.find((s) => s.id === selectedSupplierId);
      if (!existing) return;
      supplierId = existing.id;
      supplierName = existing.name;
    }

    const newPurchase: PurchaseInvoice = {
      id: `purch-${Date.now()}`,
      invoiceNumber: nextInvoiceNumber,
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      date: purchaseDate,
      time: purchaseTime,
      supplierId,
      supplierName,
      items: [...items],
      subtotal,
      shippingCost: Number(shippingCost),
      discount: Number(purchaseDiscount),
      total: grandTotal,
      paidAmount: actualPaidAmount,
      remainingAmount: remainingDebt,
      paymentMethod,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
    };

    onSavePurchase(newPurchase, newSupplierObj);

    // Reset Form
    setItems([]);
    setShippingCost(0);
    setPurchaseDiscount(0);
    setPaymentMethod('cash');
    setPaidAmountInput(0);
    setNotes('');
    setSupplierInvoiceNumber('');
    setIsAddingNewSupplier(false);
    setCustomSupplierName('');
    setSelectedSupplierId('');
    setActiveTab('list');
  };

  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.invoiceNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.supplierInvoiceNumber && p.supplierInvoiceNumber.toLowerCase().includes(q)) ||
          p.date.includes(q)
        );
      })
      .reverse();
  }, [purchases, searchQuery]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            دفتر المشتريات والتوريد للبضائع
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تسجيل فواتير الشراء من الموردين، زيادة المخزون، وتوثيق المدفوعات والديون
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'create'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + تسجيل فاتورة مشتريات جديدة
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            سجل المشتريات السابقة ({purchases.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Supplier & Date Card */}
            <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  بيانات المورد وتاريخ الشراء
                </span>
                <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-800 rounded-md">
                  رقم المستند الداخلي: <span className="font-mono">{nextInvoiceNumber}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    تاريخ الشراء
                  </label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    رقم فاتورة المورد الأصلية
                  </label>
                  <input
                    type="text"
                    placeholder="رقم الفاتورة الورقية..."
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      اسم المورد
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
                      className="text-[11px] font-bold text-amber-600 hover:text-amber-700"
                    >
                      {isAddingNewSupplier ? 'اختيار من المسجلين' : '+ مورد جديد'}
                    </button>
                  </div>

                  {!isAddingNewSupplier ? (
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
                    >
                      <option value="">-- اختر المورد --</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.totalDebt > 0 ? `(له دين: ${formatCurrency(s.totalDebt, settings)})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="اسم شركة أو شخص المورد..."
                        value={customSupplierName}
                        onChange={(e) => setCustomSupplierName(e.target.value)}
                        className="w-full text-xs p-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                      <input
                        type="text"
                        placeholder="رقم الهاتف (اختياري)..."
                        value={customSupplierPhone}
                        onChange={(e) => setCustomSupplierPhone(e.target.value)}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Input Card */}
            <div className="p-4 md:p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
              <span className="text-xs font-bold text-slate-500 uppercase block border-b border-slate-100 pb-2">
                إضافة المواد المشتراة لتحديث المخزون
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    المادة المراد توريدها
                  </label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
                  >
                    <option value="">-- اختر مادة من المخزون --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (المتوفر حالياً: {p.currentStock} {p.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    الكمية المشتراة
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
                    سعر تكلفة الشراء للوحدة
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={itemCostPrice}
                    onChange={(e) => setItemCostPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              {selectedProductId && (
                <div className="flex items-center justify-between text-xs p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-slate-600">
                    إجمالي تكلفة هذا البند:{' '}
                    <strong className="font-mono text-slate-900">
                      {formatCurrency(itemQuantity * itemCostPrice, settings)}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-400" />
                    <span>إدراج في الفاتورة</span>
                  </button>
                </div>
              )}

              {/* Items Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">#</th>
                      <th className="py-2 px-3">المادة</th>
                      <th className="py-2 px-3">التصنيف</th>
                      <th className="py-2 px-3 text-center">الكمية المشتراة</th>
                      <th className="py-2 px-3 text-center">الوحدة</th>
                      <th className="py-2 px-3 text-left">تكلفة الوحدة</th>
                      <th className="py-2 px-3 text-left">الإجمالي</th>
                      <th className="py-2 px-3 text-center">حذف</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          لم يتم إدراج مواد بعد. اختر مادة من القائمة أعلاه لإدراجها.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{it.productName}</td>
                          <td className="py-2 px-3 text-slate-500">{it.category}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-purple-700">+{it.quantity}</td>
                          <td className="py-2 px-3 text-center text-slate-600">{it.unit}</td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums">{formatCurrency(it.costPrice, settings)}</td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">{formatCurrency(it.total, settings)}</td>
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

          {/* Payment & Summary Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4 sticky top-20">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
                ملخص تكاليف الشراء والدفع للمورد
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>مجموع البضائع:</span>
                  <span className="font-mono tabular-nums font-semibold">
                    {formatCurrency(subtotal, settings)}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    تكاليف نقل وشحن إضافية (تضاف للتكلفة)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                    خصم ممنوح من المورد
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={purchaseDiscount}
                    onChange={(e) => setPurchaseDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>

                <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>إجمالي فاتورة الشراء:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(grandTotal, settings)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-700 block">
                  طريقة السداد للمورد
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMethod('cash');
                      setPaidAmountInput(grandTotal);
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نقداً بالكامل
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
                    آجل (دين علينا)
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

              {paymentMethod === 'partial' && (
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    المبلغ المدفوع للمورد نقداً الآن
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    value={paidAmountInput}
                    onChange={(e) => setPaidAmountInput(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
                  />
                </div>
              )}

              {/* Cash vs Debt Notice */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-rose-800">
                  <span>يخصم من الصندوق نقداً:</span>
                  <span className="font-mono tabular-nums">
                    - {formatCurrency(actualPaidAmount, settings)}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-amber-800">
                  <span>المبلغ المتبقي دين للمورد:</span>
                  <span className="font-mono tabular-nums">
                    {formatCurrency(remainingDebt, settings)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 pt-1">
                  * تنبيه: المشتريات الآجلة لا تخصم من الصندوق النقدي حتى يتم دفعها فعلياً.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  ملاحظات الشراء
                </label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات التسليم، الشاحنة، مكان التخزين..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <button
                type="button"
                onClick={handleCompletePurchase}
                disabled={items.length === 0}
                className={`w-full py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  items.length === 0
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 text-amber-400" />
                <span>حفظ فاتورة الشراء وتحديث المخزون</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Saved Purchases List */
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="بحث برقم الشراء، المورد، رقم فاتورة المورد، أو التاريخ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pr-9 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">رقم الشراء</th>
                    <th className="py-3 px-4">التاريخ</th>
                    <th className="py-3 px-4">المورد</th>
                    <th className="py-3 px-4">فاتورة المورد</th>
                    <th className="py-3 px-4 text-center">المواد</th>
                    <th className="py-3 px-4 text-left">إجمالي الفاتورة</th>
                    <th className="py-3 px-4 text-left">المدفوع نقداً</th>
                    <th className="py-3 px-4 text-left">المتبقي دين للمورد</th>
                    <th className="py-3 px-4 text-center">طريقة الدفع</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-slate-400">
                        لا توجد فواتير مشتريات مسجلة بعد.
                      </td>
                    </tr>
                  ) : (
                    filteredPurchases.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-bold font-mono text-slate-900">
                          {p.invoiceNumber}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {p.date} · {p.time}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {p.supplierName}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">
                          {p.supplierInvoiceNumber || '-'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          {p.items.length}
                        </td>
                        <td className="py-3 px-4 text-left font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrency(p.total, settings)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-rose-700 tabular-nums font-semibold">
                          {formatCurrency(p.paidAmount, settings)}
                        </td>
                        <td className="py-3 px-4 text-left font-mono text-amber-700 tabular-nums font-semibold">
                          {p.remainingAmount > 0
                            ? formatCurrency(p.remainingAmount, settings)
                            : '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                            {p.paymentMethod === 'cash'
                              ? 'نقدي'
                              : p.paymentMethod === 'debt'
                              ? 'آجل'
                              : 'جزئي'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {onDeletePurchase && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(p.id)}
                              title="حذف فاتورة المشتريات من قاعدة البيانات (Firebase)"
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
        </div>
      )}

      {/* Delete Purchase Invoice Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600">
              <Trash2 className="w-5 h-5 shrink-0" />
              <h3 className="text-base font-bold text-slate-900">
                حذف فاتورة المشتريات نهائياً من قاعدة البيانات (Firebase)
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              تحذير: هل أنت متأكد من رغبتك في حذف فاتورة الشراء هذه تماماً من قاعدة بيانات Firebase السحابية؟
              سيتم تفريغ المساحة المخزنة وتحديث سجل التخزين السحابي.
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
                  if (onDeletePurchase && deleteConfirmId) {
                    onDeletePurchase(deleteConfirmId);
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
    </div>
  );
};
