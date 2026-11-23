import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  ClipboardList,
  Filter,
  DollarSign,
  Calendar,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Zap,
  Droplets,
  Hammer,
  Package,
} from 'lucide-react';
import {
  InventoryAdjustment,
  Product,
  StoreSettings,
  Supplier,
} from '../types/accounting';
import {
  calculateInventoryValuation,
  downloadCSV,
  formatCurrency,
  formatNumber,
  getCurrentTimeString,
  getTodayDateString,
} from '../utils/accounting';

export interface CoreCategoryDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  prefix: string;
  colorText: string;
  colorBg: string;
  colorBorder: string;
  activeBg: string;
  badge: string;
  desc: string;
}

export const CORE_CATEGORIES: CoreCategoryDef[] = [
  {
    id: 'كهربائية',
    label: 'كهربائية',
    icon: Zap,
    prefix: 'ELE',
    colorText: 'text-amber-800',
    colorBg: 'bg-amber-50',
    colorBorder: 'border-amber-300',
    activeBg: 'bg-amber-600 text-white border-amber-700',
    badge: 'bg-amber-100 text-amber-900 border-amber-300',
    desc: 'إنارة، قواطع شنايدر، كابلات، أسلاك، أفياش، تيب عازل',
  },
  {
    id: 'صحية',
    label: 'صحية',
    icon: Droplets,
    prefix: 'SAN',
    colorText: 'text-sky-800',
    colorBg: 'bg-sky-50',
    colorBorder: 'border-sky-300',
    activeBg: 'bg-sky-600 text-white border-sky-700',
    badge: 'bg-sky-100 text-sky-900 border-sky-300',
    desc: 'حنفيات، خلاطات، أنابيب PPR، وصلات، محابس، تصريف وعوازل',
  },
  {
    id: 'بناء',
    label: 'بناء',
    icon: Hammer,
    prefix: 'BLD',
    colorText: 'text-orange-800',
    colorBg: 'bg-orange-50',
    colorBorder: 'border-orange-300',
    activeBg: 'bg-orange-600 text-white border-orange-700',
    badge: 'bg-orange-100 text-orange-900 border-orange-300',
    desc: 'إسمنت، رمل، لواصق سيراميك وبورسلان، دهانات، جبس ومسامير',
  },
  {
    id: 'عامة',
    label: 'عامة',
    icon: Package,
    prefix: 'GEN',
    colorText: 'text-indigo-800',
    colorBg: 'bg-indigo-50',
    colorBorder: 'border-indigo-300',
    activeBg: 'bg-indigo-600 text-white border-indigo-700',
    badge: 'bg-indigo-100 text-indigo-900 border-indigo-300',
    desc: 'عدد يدوية، أقفال، مقابض، مفصلات، براغي، حبال، شواكيش، لوازم عامة',
  },
];

export function getPrefixForCategory(cat: string): string {
  if (cat.includes('كهربائ')) return 'ELE';
  if (cat.includes('صحي')) return 'SAN';
  if (cat.includes('بناء')) return 'BLD';
  return 'GEN';
}

export function getCategoryBadge(catName: string) {
  if (catName.includes('كهربائ')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
        <Zap className="w-3 h-3 text-amber-600" />
        <span>كهربائية</span>
      </span>
    );
  }
  if (catName.includes('صحي')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900 border border-sky-300">
        <Droplets className="w-3 h-3 text-sky-600" />
        <span>صحية</span>
      </span>
    );
  }
  if (catName.includes('بناء')) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-900 border border-orange-300">
        <Hammer className="w-3 h-3 text-orange-600" />
        <span>بناء</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-300">
      <Package className="w-3 h-3 text-indigo-600" />
      <span>{catName || 'عامة'}</span>
    </span>
  );
}

interface InventoryViewProps {
  products: Product[];
  suppliers: Supplier[];
  settings: StoreSettings;
  inventoryAdjustments: InventoryAdjustment[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onAdjustStock: (adjustment: InventoryAdjustment) => void;
  initialFilter?: string;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  suppliers,
  settings,
  inventoryAdjustments,
  onSaveProduct,
  onDeleteProduct,
  onAdjustStock,
  initialFilter,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(
    initialFilter === 'low_stock'
  );

  // Modals
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Product Form State
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(settings.categories[0] || 'أدوات عامة');
  const [unit, setUnit] = useState(settings.units[0] || 'قطعة');
  const [currentStock, setCurrentStock] = useState<number>(0);
  const [costPrice, setCostPrice] = useState<number>(0);
  const [sellingPrice, setSellingPrice] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(5);
  const [supplierId, setSupplierId] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Stock Adjustment Modal State
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [newStockCount, setNewStockCount] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<
    'damaged' | 'count_deficit' | 'count_surplus' | 'correction' | 'expired'
  >('count_deficit');
  const [adjustmentNotes, setAdjustmentNotes] = useState('');

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (filterLowStockOnly && p.currentStock > p.minStock) return false;
      if (selectedCategory !== 'all') {
        const matchesExact = p.category === selectedCategory;
        const matchesRoot =
          (selectedCategory === 'كهربائية' && p.category.includes('كهربائ')) ||
          (selectedCategory === 'صحية' && p.category.includes('صحي')) ||
          (selectedCategory === 'بناء' && p.category.includes('بناء')) ||
          (selectedCategory === 'عامة' && (p.category === 'عامة' || !p.category));
        if (!matchesExact && !matchesRoot) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q) ||
          (p.supplierName && p.supplierName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [products, filterLowStockOnly, selectedCategory, searchQuery]);

  const totalValuation = useMemo(() => {
    return calculateInventoryValuation(products);
  }, [products]);

  const lowStockCount = useMemo(() => {
    return products.filter((p) => p.currentStock <= p.minStock).length;
  }, [products]);

  // Aggregate counts and values for the 4 core classifications
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number; totalValue: number }> = {
      'كهربائية': { count: 0, totalStock: 0, totalValue: 0 },
      'صحية': { count: 0, totalStock: 0, totalValue: 0 },
      'بناء': { count: 0, totalStock: 0, totalValue: 0 },
      'عامة': { count: 0, totalStock: 0, totalValue: 0 },
    };

    products.forEach((p) => {
      let key = 'عامة';
      if (p.category.includes('كهربائ')) key = 'كهربائية';
      else if (p.category.includes('صحي')) key = 'صحية';
      else if (p.category.includes('بناء')) key = 'بناء';

      if (!stats[key]) {
        stats[key] = { count: 0, totalStock: 0, totalValue: 0 };
      }
      stats[key].count += 1;
      stats[key].totalStock += p.currentStock;
      stats[key].totalValue += p.currentStock * p.costPrice;
    });

    return stats;
  }, [products]);

  // Open modal for add with optional preferred category
  const handleOpenAdd = (preferredCat?: string) => {
    setEditingProduct(null);
    const chosenCat =
      preferredCat ||
      (selectedCategory !== 'all' ? selectedCategory : 'كهربائية');
    const prefix = getPrefixForCategory(chosenCat);
    const nextNum = products.filter((p) => p.category === chosenCat).length + 1;
    setCode(`${prefix}-${String(nextNum).padStart(3, '0')}`);
    setName('');
    setCategory(chosenCat);
    setUnit(settings.units[0] || 'قطعة');
    setCurrentStock(0);
    setCostPrice(0);
    setSellingPrice(0);
    setMinStock(5);
    setSupplierId('');
    setNotes('');
    setIsProductModalOpen(true);
  };

  // Switch category with smart code prefix adjustment
  const handleSelectCategory = (newCat: string) => {
    setCategory(newCat);
    if (!editingProduct) {
      const prefix = getPrefixForCategory(newCat);
      const nextNum = products.filter((p) => p.category === newCat).length + 1;
      setCode(`${prefix}-${String(nextNum).padStart(3, '0')}`);
    }
  };

  // Open modal for edit
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setCode(p.code);
    setName(p.name);
    setCategory(p.category);
    setUnit(p.unit);
    setCurrentStock(p.currentStock);
    setCostPrice(p.costPrice);
    setSellingPrice(p.sellingPrice);
    setMinStock(p.minStock);
    setSupplierId(p.supplierId || '');
    setNotes(p.notes || '');
    setIsProductModalOpen(true);
  };

  // Save product
  const handleSaveProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم المادة');
      return;
    }

    const supplier = suppliers.find((s) => s.id === supplierId);

    const productData: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      code: code.trim() || `ITM-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      category,
      unit,
      currentStock: Number(currentStock),
      costPrice: Number(costPrice),
      sellingPrice: Number(sellingPrice),
      minStock: Number(minStock),
      supplierId,
      supplierName: supplier ? supplier.name : undefined,
      notes: notes.trim(),
      createdAt: editingProduct ? editingProduct.createdAt : getTodayDateString(),
    };

    onSaveProduct(productData);
    setIsProductModalOpen(false);
  };

  // Open Stock Adjustment Modal
  const handleOpenAdjustment = (p: Product) => {
    setAdjustingProduct(p);
    setNewStockCount(p.currentStock);
    setAdjustmentReason('count_deficit');
    setAdjustmentNotes('');
    setIsAdjustmentModalOpen(true);
  };

  // Submit stock adjustment
  const handleSaveAdjustmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;

    const diff = Number(newStockCount) - adjustingProduct.currentStock;
    if (diff === 0) {
      alert('الكمية الجديدة مطابقة للكمية الحالية، لا يوجد فرق.');
      return;
    }

    if (!adjustmentNotes.trim()) {
      alert('يرجى كتابة سبب أو ملاحظات الجرد لتوثيق الحركة بدقة.');
      return;
    }

    const adj: InventoryAdjustment = {
      id: `adj-${Date.now()}`,
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      productId: adjustingProduct.id,
      productCode: adjustingProduct.code,
      productName: adjustingProduct.name,
      oldStock: adjustingProduct.currentStock,
      newStock: Number(newStockCount),
      difference: diff,
      costPrice: adjustingProduct.costPrice,
      totalCostDifference: diff * adjustingProduct.costPrice,
      reason: adjustmentReason,
      notes: adjustmentNotes.trim(),
    };

    onAdjustStock(adj);
    setIsAdjustmentModalOpen(false);
  };

  // Export inventory to CSV
  const handleExportCSV = () => {
    const headers = [
      'رمز المادة',
      'اسم المادة',
      'التصنيف',
      'الكمية الحالية',
      'وحدة القياس',
      'سعر التكلفة',
      'سعر البيع',
      'إجمالي القيمة بالتكلفة',
      'الحد الأدنى',
      'المورد الأساسي',
      'ملاحظات',
    ];

    const rows = products.map((p) => [
      p.code,
      p.name,
      p.category,
      p.currentStock,
      p.unit,
      p.costPrice,
      p.sellingPrice,
      p.currentStock * p.costPrice,
      p.minStock,
      p.supplierName || '',
      p.notes || '',
    ]);

    downloadCSV(`مخزون_خردوات_المامو_${getTodayDateString()}`, headers, rows);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            إدارة المخزون والمستودع والبضائع
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            متابعة دقيقة لكميات المواد، تكاليف الشراء، أسعار البيع، وتنبيهات النواقص وتعديلات الجرد
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>تصدير Excel/CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAdd()}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-400" />
            <span>إضافة مادة جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي عدد أصناف المواد
          </span>
          <span className="text-xl font-bold font-mono text-slate-900">
            {products.length} صنف
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            إجمالي قيمة البضاعة في المستودع
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrency(totalValuation, settings)}
          </span>
          <span className="text-[10px] text-slate-500 block">
            محسوبة بسعر التكلفة الفعلي
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">
            مواد قاربت على النفاد (دون الحد الأدنى)
          </span>
          <span
            className={`text-xl font-bold font-mono tabular-nums ${
              lowStockCount > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {lowStockCount} مواد
          </span>
        </div>
      </div>

      {/* Category Quick Filter & Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {CORE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const stat = categoryStats[cat.id] || { count: 0, totalStock: 0, totalValue: 0 };
          const isSelected = selectedCategory === cat.id;
          return (
            <div
              key={cat.id}
              onClick={() => setSelectedCategory(isSelected ? 'all' : cat.id)}
              className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900 ring-offset-2'
                  : 'bg-white hover:bg-slate-50/80 border-slate-200 text-slate-800 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded-lg ${
                      isSelected
                        ? 'bg-white/10 text-white'
                        : `${cat.colorBg} ${cat.colorText}`
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-sm block">مواد {cat.label}</span>
                    <span
                      className={`text-[10px] font-mono font-semibold ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      كود: {cat.prefix}-*
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenAdd(cat.id);
                  }}
                  title={`إضافة مادة ${cat.label} جديدة`}
                  className={`p-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
                    isSelected
                      ? 'bg-white/20 hover:bg-white/30 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة</span>
                </button>
              </div>

              <div className="flex items-baseline justify-between pt-1 border-t border-slate-100/30">
                <div className="text-[11px]">
                  <span
                    className={
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }
                  >
                    الأصناف:{' '}
                  </span>
                  <span className="font-bold font-mono tabular-nums">
                    {stat.count}
                  </span>
                </div>
                <div className="text-[11px]">
                  <span
                    className={
                      isSelected ? 'text-slate-300' : 'text-slate-500'
                    }
                  >
                    القيمة:{' '}
                  </span>
                  <span
                    className={`font-bold font-mono tabular-nums ${
                      isSelected ? 'text-emerald-300' : 'text-emerald-700'
                    }`}
                  >
                    {formatCurrency(stat.totalValue, settings)}
                  </span>
                </div>
              </div>

              <p
                className={`mt-1.5 text-[10px] truncate ${
                  isSelected ? 'text-slate-400' : 'text-slate-600'
                }`}
                title={cat.desc}
              >
                {cat.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث باسم المادة، الرمز، التصنيف، أو المورد..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
          >
            <option value="all">جميع التصنيفات</option>
            {settings.categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Low stock toggle */}
          <button
            type="button"
            onClick={() => setFilterLowStockOnly(!filterLowStockOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl transition-all ${
              filterLowStockOnly
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>النواقص فقط</span>
          </button>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">الرمز</th>
                <th className="py-3 px-3">اسم المادة</th>
                <th className="py-3 px-3">التصنيف</th>
                <th className="py-3 px-3 text-center">الكمية المتوفرة</th>
                <th className="py-3 px-3 text-center">الوحدة</th>
                <th className="py-3 px-3 text-left">سعر التكلفة</th>
                <th className="py-3 px-3 text-left">سعر البيع</th>
                <th className="py-3 px-3 text-left">قيمة المخزون</th>
                <th className="py-3 px-3 text-center">المورد</th>
                <th className="py-3 px-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    لا توجد مواد مطابقة في المستودع.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isLow = p.currentStock <= p.minStock;
                  const itemValue = p.currentStock * p.costPrice;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/60 ${
                        isLow ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                        {p.code}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {isLow && (
                            <span
                              title={`تحذير نقص: الرصيد ${p.currentStock} وهو دون الحد الأدنى ${p.minStock}`}
                              className="text-amber-600 inline-block"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                            </span>
                          )}
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">{getCategoryBadge(p.category)}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-black tabular-nums">
                        <span
                          className={
                            isLow
                              ? 'text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md'
                              : 'text-slate-900'
                          }
                        >
                          {formatNumber(p.currentStock)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-600">
                        {p.unit}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono tabular-nums text-slate-600">
                        {formatCurrency(p.costPrice, settings)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono tabular-nums font-bold text-slate-900">
                        {formatCurrency(p.sellingPrice, settings)}
                      </td>
                      <td className="py-2.5 px-3 text-left font-mono tabular-nums font-bold text-emerald-800">
                        {formatCurrency(itemValue, settings)}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 text-[11px]">
                        {p.supplierName || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjustment(p)}
                            title="تعديل المخزون عند الجرد"
                            className="p-1.5 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="تعديل المادة"
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من حذف المادة «${p.name}»؟`)) {
                                onDeleteProduct(p.id);
                              }
                            }}
                            title="حذف المادة"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Add / Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <h3 className="text-sm font-bold">
                {editingProduct ? 'تعديل بيانات مادة' : 'إضافة مادة جديدة للمستودع'}
              </h3>
              <button
                type="button"
                onClick={() => setIsProductModalOpen(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProductSubmit} className="p-6 space-y-4 text-xs">
              {/* Category Quick Selector */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">
                  التصنيف الرئيسي للمادة:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CORE_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isChosen = category === cat.id;
                    return (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-right transition-all flex flex-col justify-between ${
                          isChosen
                            ? `${cat.activeBg} shadow-sm ring-2 ring-slate-900`
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <Icon className={`w-4 h-4 ${isChosen ? 'text-white' : cat.colorText}`} />
                          <span
                            className={`text-[10px] font-mono px-1 rounded ${
                              isChosen
                                ? 'bg-white/20 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {cat.prefix}
                          </span>
                        </div>
                        <span className="font-bold text-xs">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    رمز المادة (الكود / الباركود)
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="مثال: ELE-001"
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    التصنيف المختار
                  </label>
                  <select
                    value={category}
                    onChange={(e) => handleSelectCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {settings.categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  اسم المادة الكامل ومواصفاتها *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: قاطع كهربائي شنايدر 32 أمبير..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    الكمية المتوفرة
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={currentStock}
                    onChange={(e) => setCurrentStock(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    وحدة القياس
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    {settings.units.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    حد التنبيه الأدنى
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={minStock}
                    onChange={(e) => setMinStock(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    سعر تكلفة الشراء
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    سعر البيع المقترح
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2.5 border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  المورد الأساسي (اختياري)
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="">-- بدون مورد محدد --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  ملاحظات
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات موقع الرف، الجودة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  حفظ المادة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal (Requirement 4) */}
      {isAdjustmentModalOpen && adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                تعديل رصيد المخزون عند الجرد
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block text-sm">
                {adjustingProduct.name}
              </span>
              <div className="flex justify-between text-slate-600">
                <span>الرصيد الدفتري الحالي:</span>
                <span className="font-mono font-bold text-slate-900">
                  {adjustingProduct.currentStock} {adjustingProduct.unit}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>سعر التكلفة:</span>
                <span className="font-mono">
                  {formatCurrency(adjustingProduct.costPrice, settings)}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveAdjustmentSubmit} className="space-y-3.5">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  الكمية الفعلية الموجودة بعد الجرد
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={newStockCount}
                  onChange={(e) => setNewStockCount(parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-sm focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <span className="text-[11px] text-slate-500 block mt-1">
                  الفرق: {Number(newStockCount) - adjustingProduct.currentStock}{' '}
                  {adjustingProduct.unit}
                </span>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  سبب التعديل (مطلوب لحماية الحسابات)
                </label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value as any)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-medium focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                >
                  <option value="count_deficit">عجز في الجرد الفعلي</option>
                  <option value="count_surplus">زيادة في الجرد الفعلي</option>
                  <option value="damaged">بضاعة تالفة أو مكسورة</option>
                  <option value="expired">منتهية الصلاحية</option>
                  <option value="correction">تصحيح خطأ إدخال سابق</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  بيان وتفاصيل سبب التعديل *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="مثال: كيس إسمنت تالف بسبب الرطوبة، أو حبة مكسورة أثناء النقل..."
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  اعتماد تسوية الجرد
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
