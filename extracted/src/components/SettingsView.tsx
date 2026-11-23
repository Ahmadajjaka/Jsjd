import React, { useState, useEffect } from 'react';
import {
  Settings,
  Store,
  DollarSign,
  Shield,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  FileSpreadsheet,
  Database,
  Zap,
  HardDrive,
  Clock,
  Camera,
  Smartphone,
  Copy,
  Check,
  KeyRound,
} from 'lucide-react';
import { AppState, DEFAULT_SETTINGS, exportJSONBackup } from '../utils/storage';
import { StoreSettings } from '../types/accounting';
import { downloadCSV, getTodayDateString } from '../utils/accounting';
import { calculateStorageUsage } from '../services/firebaseSync';
import { SecurityPermissionsBanner } from './SecurityPermissionsBanner';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ANDROID_APP_PACKAGE_ID,
  ANDROID_SHA256_STORAGE_KEY,
  buildAssetLinksPayload,
  getConfiguredBackendUrl,
  getRuntimeShellLabelArabic,
  normalizeShaFingerprint,
  setConfiguredBackendUrl,
} from '../utils/apkEnvironment';

interface SettingsViewProps {
  state: AppState;
  onUpdateSettings: (newSettings: StoreSettings) => void;
  onRestoreBackup: (restoredState: AppState) => void;
  onResetDemoData: () => void;
  onClearCleanSlate: () => void;
  onClearCloudDatabase?: () => void;
  onCompressCloudDatabase?: () => Promise<{
    success: boolean;
    message: string;
    savedBytes?: number;
    documentsCompressed?: number;
  }>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  state,
  onUpdateSettings,
  onRestoreBackup,
  onResetDemoData,
  onClearCleanSlate,
  onClearCloudDatabase,
  onCompressCloudDatabase,
}) => {
  const [formData, setFormData] = useState<StoreSettings>({
    ...state.settings,
    customerDebtDueDays: state.settings.customerDebtDueDays ?? 30,
    supplierDebtDueDays: state.settings.supplierDebtDueDays ?? 30,
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressStatusMsg, setCompressStatusMsg] = useState('');
  const [apkBackendUrl, setApkBackendUrl] = useState(() => getConfiguredBackendUrl());
  const [apkBackendSaved, setApkBackendSaved] = useState(false);
  const [shaInput, setShaInput] = useState(() => {
    try {
      return localStorage.getItem(ANDROID_SHA256_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [copiedApkField, setCopiedApkField] = useState<string | null>(null);

  const normalizedSha = normalizeShaFingerprint(shaInput);
  const assetLinksPreview = JSON.stringify(
    buildAssetLinksPayload(
      ANDROID_APP_PACKAGE_ID,
      normalizedSha.valid && normalizedSha.kind === 'SHA-256' ? [normalizedSha.formatted] : []
    ),
    null,
    2
  );

  const handleCopyApkText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedApkField(key);
      setTimeout(() => setCopiedApkField(null), 2000);
    } catch {}
  };

  const handleSaveApkBackend = () => {
    const clean = setConfiguredBackendUrl(apkBackendUrl);
    setApkBackendUrl(clean);
    try {
      if (shaInput.trim()) {
        localStorage.setItem(ANDROID_SHA256_STORAGE_KEY, shaInput.trim());
      } else {
        localStorage.removeItem(ANDROID_SHA256_STORAGE_KEY);
      }
    } catch {}
    setApkBackendSaved(true);
    setTimeout(() => setApkBackendSaved(false), 2500);
  };

  useEffect(() => {
    setFormData({
      ...state.settings,
      customerDebtDueDays: state.settings.customerDebtDueDays ?? 30,
      supplierDebtDueDays: state.settings.supplierDebtDueDays ?? 30,
    });
  }, [state.settings]);

  const storageUsage = calculateStorageUsage(state);

  const handleCompressCloud = async () => {
    if (!onCompressCloudDatabase) return;
    setIsCompressing(true);
    setCompressStatusMsg('');
    try {
      const res = await onCompressCloudDatabase();
      setCompressStatusMsg(res.message);
    } catch (err) {
      setCompressStatusMsg('حدث خطأ أثناء تنفيذ عملية الضغط');
    } finally {
      setIsCompressing(false);
    }
  };

  // Handle Form Submit
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // Handle Restore file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.settings || !json.products || !json.sales) {
          alert('ملف النسخة الاحتياطية غير صالح أو تالف.');
          return;
        }
        if (confirm('هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟ سيتم استبدال البيانات الحالية ببيانات الملف.')) {
          onRestoreBackup(json);
          alert('تم استعادة البيانات بنجاح!');
        }
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية.');
      }
    };
    reader.readAsText(file);
  };

  // Add category
  const handleAddCategory = () => {
    if (!newCategory.trim()) return;
    if (formData.categories.includes(newCategory.trim())) return;
    setFormData({
      ...formData,
      categories: [...formData.categories, newCategory.trim()],
    });
    setNewCategory('');
  };

  const handleRemoveCategory = (cat: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter((c) => c !== cat),
    });
  };

  // Add expense category
  const handleAddExpenseCategory = () => {
    if (!newExpenseCat.trim()) return;
    if (formData.expenseCategories.includes(newExpenseCat.trim())) return;
    setFormData({
      ...formData,
      expenseCategories: [...formData.expenseCategories, newExpenseCat.trim()],
    });
    setNewExpenseCat('');
  };

  const handleRemoveExpenseCategory = (cat: string) => {
    setFormData({
      ...formData,
      expenseCategories: formData.expenseCategories.filter((c) => c !== cat),
    });
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            إعدادات المتجر وحماية البيانات
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تخصيص اسم المتجر، العملة الأساسية، تذييل الفاتورة، والنسخ الاحتياطي الدائم
          </p>
        </div>

        {saveSuccess && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            تم حفظ الإعدادات بنجاح
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Store Profile Card */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Store className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              بيانات وهوية المتجر
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                اسم المتجر الرسمي *
              </label>
              <input
                type="text"
                required
                value={formData.storeName}
                onChange={(e) =>
                  setFormData({ ...formData, storeName: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                وصف النشاط التجاري (يظهر أسفل الاسم)
              </label>
              <input
                type="text"
                value={formData.storeTagline}
                onChange={(e) =>
                  setFormData({ ...formData, storeTagline: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                رقم الهاتف والتواصل
              </label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                العنوان والموقع
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                الرقم الضريبي أو السجل التجاري (إن وجد)
              </label>
              <input
                type="text"
                value={formData.taxNumber || ''}
                onChange={(e) =>
                  setFormData({ ...formData, taxNumber: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                الرصيد الافتتاحي الأولي للصندوق
              </label>
              <input
                type="number"
                min="0"
                value={formData.initialCash}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    initialCash: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono"
              />
            </div>
          </div>
        </div>

        {/* Currency & Financial Formatting */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <DollarSign className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              إعدادات العملة الأساسية وطريقة العرض
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                العملة المعتمدة
              </label>
              <select
                value={formData.currency}
                onChange={(e) => {
                  const curr = e.target.value;
                  let sym = 'ل.س';
                  if (curr === 'SAR') sym = 'ر.س';
                  if (curr === 'USD') sym = '$';
                  if (curr === 'AED') sym = 'د.إ';
                  if (curr === 'JOD') sym = 'د.أ';
                  if (curr === 'EGP') sym = 'ج.م';
                  if (curr === 'IQD') sym = 'د.ع';
                  setFormData({ ...formData, currency: curr, currencySymbol: sym });
                }}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
              >
                <option value="SYP">ليرة سورية (SYP)</option>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="USD">دولار أمريكي (USD)</option>
                <option value="AED">درهم إماراتي (AED)</option>
                <option value="JOD">دينار أردني (JOD)</option>
                <option value="EGP">جنيه مصري (EGP)</option>
                <option value="IQD">دينار عراقي (IQD)</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                رمز العملة المطبوع
              </label>
              <input
                type="text"
                value={formData.currencySymbol}
                onChange={(e) =>
                  setFormData({ ...formData, currencySymbol: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                موضع رمز العملة
              </label>
              <select
                value={formData.currencyPosition}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    currencyPosition: e.target.value as any,
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
              >
                <option value="after">بعد الرقم (مثال: 5,000 ل.س)</option>
                <option value="before">قبل الرقم (مثال: $ 5,000)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Debt Repayment Period & Overdue Alerts */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  إعدادات فترات سداد الديون والتنبيهات
                </h3>
                <p className="text-[11px] text-slate-500">
                  تحديد عدد الأيام المسموح بها قبل ظهور تنبيه تجاوز فترة السداد في لوحة التحكم
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label
                htmlFor="customerDebtDueDays"
                className="font-semibold text-slate-700 block mb-1"
              >
                مهلة سداد ديون الزبائن المسموحة (بالأيام)
              </label>
              <input
                id="customerDebtDueDays"
                type="number"
                min="0"
                max="3650"
                value={formData.customerDebtDueDays ?? 30}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    customerDebtDueDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono font-bold"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                ينبّهك النظام تلقائياً عندما تتجاوز فاتورة أو دين الزبون هذه المدة دون سداد كامل.
              </span>
            </div>

            <div>
              <label
                htmlFor="supplierDebtDueDays"
                className="font-semibold text-slate-700 block mb-1"
              >
                مهلة سداد مستحقات الموردين المسموحة (بالأيام)
              </label>
              <input
                id="supplierDebtDueDays"
                type="number"
                min="0"
                max="3650"
                value={formData.supplierDebtDueDays ?? 30}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    supplierDebtDueDays: Math.max(0, parseInt(e.target.value, 10) || 0),
                  })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-mono font-bold"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                يعرض لوحة تنبيه بالذمم الدائنة للموردين التي حان أو تأخر موعد سدادها.
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Header/Footer Notes */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">
              نصوص الفاتورة الرسمية والمطبوعات
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                ترويسة الفاتورة (أعلى الفاتورة)
              </label>
              <input
                type="text"
                value={formData.invoiceHeaderNote}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceHeaderNote: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                تنسيق الطباعة الافتراضي للفواتير
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    (formData.invoicePrintLayout || 'thermal80') === 'thermal80'
                      ? 'bg-amber-50/70 border-amber-400 text-amber-950 font-bold shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="invoicePrintLayout"
                    value="thermal80"
                    checked={(formData.invoicePrintLayout || 'thermal80') === 'thermal80'}
                    onChange={() =>
                      setFormData({ ...formData, invoicePrintLayout: 'thermal80' })
                    }
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block text-xs font-bold">طابعة حرارية صغيرة (عرض 80 مم)</span>
                    <span className="block text-[11px] text-slate-500 font-normal">
                      إيصال POS موفر للورق، مختصر ومنسق للطابعات الإيصالية
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    formData.invoicePrintLayout === 'standard'
                      ? 'bg-amber-50/70 border-amber-400 text-amber-950 font-bold shadow-xs'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="invoicePrintLayout"
                    value="standard"
                    checked={formData.invoicePrintLayout === 'standard'}
                    onChange={() =>
                      setFormData({ ...formData, invoicePrintLayout: 'standard' })
                    }
                    className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="block text-xs font-bold">فاتورة قياسية كاملة (A4)</span>
                    <span className="block text-[11px] text-slate-500 font-normal">
                      جدول واسع مفصل لجميع الأعمدة والبيانات للطابعات المكتبية
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                تذييل الفاتورة وشروط الإرجاع (أسفل الفاتورة)
              </label>
              <textarea
                rows={2}
                value={formData.invoiceFooterNote}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceFooterNote: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden resize-none"
              />
            </div>
          </div>
        </div>

        {/* Categories Manager */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              تصنيفات المواد ومصروفات المتجر
            </h3>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1.5">
                تصنيفات مواد الخردوات والمستودع:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.categories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-medium"
                  >
                    <span>{c}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(c)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="إضافة تصنيف مادة جديد..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800"
                >
                  إضافة
                </button>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="font-semibold text-slate-700 block mb-1.5">
                تصنيفات المصروفات التشغيلية:
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {formData.expenseCategories.map((ec) => (
                  <span
                    key={ec}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-800 rounded-lg font-medium"
                  >
                    <span>{ec}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExpenseCategory(ec)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="إضافة تصنيف مصروف جديد..."
                  value={newExpenseCat}
                  onChange={(e) => setNewExpenseCat(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddExpenseCategory}
                  className="px-4 py-2 bg-slate-900 text-white font-bold rounded-lg hover:bg-slate-800"
                >
                  إضافة
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Security & PIN Lock */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              حماية التطبيق وقفل الشاشة بكلمة مرور (PIN) والتصوير الأمني
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isPinLocked}
                onChange={(e) =>
                  setFormData({ ...formData, isPinLocked: e.target.checked })
                }
                className="w-4 h-4 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="font-bold text-slate-800">
                تفعيل قفل الشاشة برمز سري (لحماية الأرباح والحسابات من الزبائن أو الفضوليين)
              </span>
            </label>

            {formData.isPinLocked && (
              <div className="max-w-xs">
                <label className="font-semibold text-slate-700 block mb-1">
                  الرمز السري (4 إلى 6 أرقام)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={formData.pinCode || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, pinCode: e.target.value })
                  }
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono tracking-widest text-center text-base focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                />
              </div>
            )}

            <label className="flex items-center gap-2 cursor-pointer pt-2 border-t border-slate-100">
              <input
                id="enableSecurityCameraCapture"
                type="checkbox"
                checked={formData.enableSecurityCameraCapture ?? true}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    enableSecurityCameraCapture: e.target.checked,
                  })
                }
                className="w-4 h-4 rounded-sm border-slate-300 text-slate-900 focus:ring-slate-900"
              />
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-amber-600" />
                <span>
                  التقاط لقطة أمان بالكاميرا الأمامية عند إدخال كلمة السر أو رمز PIN وحفظها في التخزين المحلي
                </span>
              </span>
            </label>

            <SecurityPermissionsBanner variant="settings" enabled={true} />
          </div>
        </div>

        {/* Save Settings CTA */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-2.5 font-bold text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-colors"
          >
            <CheckCircle2 className="w-4 h-4 text-amber-400" />
            <span>حفظ جميع الإعدادات</span>
          </button>
        </div>
      </form>

      {/* Backup, Restore & Reset Section (Requirement 12) */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-md space-y-5">
        <div>
          <h3 className="text-base font-black">
            إدارة النسخ الاحتياطي وحفظ البيانات
          </h3>
          <p className="text-xs text-slate-300 mt-0.5">
            بيانات متجر خردوات المامو محفوظة محلياً بشكل دائم وتلقائي. يمكنك تنزيل نسخة احتياطية أو استعادتها بأي وقت.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Export JSON */}
          <button
            type="button"
            onClick={() => exportJSONBackup(state)}
            className="flex flex-col items-center justify-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-center transition-all group"
          >
            <Download className="w-6 h-6 text-amber-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold block text-sm">تنزيل نسخة احتياطية</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              ملف JSON كامل ومختوم
            </span>
          </button>

          {/* Import JSON */}
          <label className="flex flex-col items-center justify-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-center cursor-pointer transition-all group">
            <Upload className="w-6 h-6 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold block text-sm">استعادة نسخة احتياطية</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              رفع ملف JSON محفوظ سابقاً
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Reset Demo Data */}
          <button
            type="button"
            onClick={() => {
              if (confirm('هل تريد إعادة تعيين البيانات التجريبية للمتجر للتجربة والاختبار؟')) {
                onResetDemoData();
              }
            }}
            className="flex flex-col items-center justify-center p-4 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-center transition-all group"
          >
            <RefreshCw className="w-6 h-6 text-blue-400 mb-2 group-hover:rotate-180 transition-transform" />
            <span className="font-bold block text-sm">إعادة تحميل التجريبي</span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              استرجاع أمثلة المواد والفواتير
            </span>
          </button>

          {/* Clean Slate */}
          <button
            type="button"
            onClick={() => {
              if (confirm('تحذير: هل أنت متأكد من مسح كافة البيانات التجريبية وبدء دفتر حسابات ومستودع نظيف تماماً من الصفر للمتجر الحقيقي؟')) {
                onClearCleanSlate();
              }
            }}
            className="flex flex-col items-center justify-center p-4 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 rounded-xl text-center transition-all group"
          >
            <Trash2 className="w-6 h-6 text-rose-400 mb-2 group-hover:scale-110 transition-transform" />
            <span className="font-bold block text-sm text-rose-200">
              مسح وبدء من الصفر
            </span>
            <span className="text-[10px] text-rose-300 mt-0.5">
              دفتر حسابات نظيف للمحل الحقيقي
            </span>
          </button>

          {/* Clear Cloud Firebase Database */}
          {onClearCloudDatabase && (
            <button
              type="button"
              onClick={() => {
                if (confirm('تحذير نهائي: هل تريد حذف كافة السجلات والبيانات المخزنة في قاعدة بيانات Firebase السحابية وتفريغها بالكامل؟ هذا الإجراء لا يمكن التراجع عنه.')) {
                  onClearCloudDatabase();
                }
              }}
              className="flex flex-col items-center justify-center p-4 bg-indigo-950/40 hover:bg-indigo-900/60 border border-indigo-700/60 rounded-xl text-center transition-all group cursor-pointer"
            >
              <Database className="w-6 h-6 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
              <span className="font-bold block text-sm text-indigo-200">
                تفريغ قاعدة Firebase السحابية
              </span>
              <span className="text-[10px] text-indigo-300 mt-0.5">
                حذف شامل من السيرفر السحابي
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Firebase Deflate L9 Compression Section */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-md space-y-4 border border-indigo-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
              <Zap className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black">
                  ضغط وترشيد قاعدة بيانات Firebase (Deflate Level 9)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30">
                  توفير {storageUsage.savingsPercentageFormatted}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                تطبيق أقصى خوارزمية ضغط ملفات ثنائية لا تفقيدية لتقليص استهلاك السيرفر وحصص التخزين المجانية في Firebase.
              </p>
            </div>
          </div>

          {onCompressCloudDatabase && (
            <button
              type="button"
              disabled={isCompressing}
              onClick={handleCompressCloud}
              className="flex items-center justify-center gap-2 px-4 py-2.5 font-bold text-xs text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 rounded-xl transition-all shadow-md cursor-pointer shrink-0"
            >
              <Zap className={`w-4 h-4 ${isCompressing ? 'animate-spin' : ''}`} />
              <span>{isCompressing ? 'جاري ضغط وترشيد السحابة...' : 'ضغط كافة بيانات السحابة الآن'}</span>
            </button>
          )}
        </div>

        {compressStatusMsg && (
          <div className="p-3 bg-indigo-950/60 border border-indigo-700/60 rounded-xl text-indigo-200 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{compressStatusMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-1">
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 block mb-1">الحجم الحالي المضغوط</span>
            <div className="text-base font-bold font-mono text-indigo-300">{storageUsage.usedFormatted}</div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 block mb-1">الحجم قبل الضغط</span>
            <div className="text-base font-bold font-mono text-slate-300">{storageUsage.uncompressedFormatted}</div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 block mb-1">المساحة الموفرة</span>
            <div className="text-base font-bold font-mono text-emerald-400">{storageUsage.savedFormatted}</div>
          </div>
          <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl">
            <span className="text-[10px] text-slate-400 block mb-1">نسبة التوفير</span>
            <div className="text-base font-bold font-mono text-amber-400">{storageUsage.savingsPercentageFormatted}</div>
          </div>
        </div>
      </div>

      {/* Android APK (GitHub Actions) & Firebase SHA-1 / SHA-256 Compatibility Card */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">
                تجهيز تطبيق الأندرويد (APK عبر GitHub) و Google Sign-In الأصلي
              </h3>
              <p className="text-xs text-slate-500">
                بيئة التشغيل الحالية: <strong className="text-slate-800">{getRuntimeShellLabelArabic()}</strong> — يدعم تسجيل الدخول الأصلي عبر Android Credential Manager؛ أضف بصمة SHA-1 من ملخص GitHub في Firebase Console لتفعيله بضغطة واحدة
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black self-start sm:self-auto">
            Native Google Sign-In + Capacitor
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">معرّف حزمة الأندرويد (Package ID)</span>
              <span className="font-mono font-bold text-slate-900 truncate block">{ANDROID_APP_PACKAGE_ID}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyApkText('pkg', ANDROID_APP_PACKAGE_ID)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              aria-label="نسخ معرف الحزمة"
            >
              {copiedApkField === 'pkg' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">مشروع Firebase</span>
              <span className="font-mono font-bold text-slate-900 truncate block">{firebaseConfig.projectId}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyApkText('proj', firebaseConfig.projectId)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              aria-label="نسخ معرف مشروع Firebase"
            >
              {copiedApkField === 'proj' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">نطاق المصادقة المعتمد</span>
              <span className="font-mono font-bold text-slate-900 truncate block">{firebaseConfig.authDomain}</span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyApkText('domain', firebaseConfig.authDomain)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              aria-label="نسخ نطاق Firebase"
            >
              {copiedApkField === 'domain' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-500 block">Web Client ID (Google OAuth)</span>
              <span className="font-mono font-bold text-slate-900 truncate block" dir="ltr">
                {firebaseConfig.oAuthClientId}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleCopyApkText('clientId', firebaseConfig.oAuthClientId)}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
              aria-label="نسخ Web Client ID"
            >
              {copiedApkField === 'clientId' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
          <div className="space-y-2">
            <label className="font-bold text-slate-800 block">
              رابط الخادم السحابي للذكاء الاصطناعي داخل APK (اختياري — مثال: Render URL)
            </label>
            <input
              type="url"
              dir="ltr"
              placeholder="https://your-store.onrender.com"
              value={apkBackendUrl}
              onChange={(e) => setApkBackendUrl(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
            <p className="text-[11px] text-slate-500 leading-relaxed">
              تعمل قاعدة بيانات Firebase مباشرة من داخل APK بدون خادم وسيط، ويُستخدم هذا الرابط فقط لربط المستشار الذكي عند تشغيل التطبيق كملف APK مستقل.
            </p>
          </div>

          <div className="space-y-2">
            <label className="font-bold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              <span>فاحص ومولّد بصمة SHA-256 (من ملخص بناء GitHub Actions)</span>
            </label>
            <input
              type="text"
              dir="ltr"
              placeholder="AA:BB:CC:... (SHA-1 أو SHA-256 من keytool)"
              value={shaInput}
              onChange={(e) => setShaInput(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
            />
            {shaInput.trim() && (
              <div
                className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  normalizedSha.valid
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {normalizedSha.valid
                  ? `بصمة ${normalizedSha.kind} صالحة ومهيأة: ${normalizedSha.formatted.slice(0, 29)}...`
                  : 'أدخل بصمة HEX كاملة (40 خانة لـ SHA-1 أو 64 خانة لـ SHA-256).'}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveApkBackend}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
            >
              حفظ إعدادات APK
            </button>
            {apkBackendSaved && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                تم الحفظ محلياً
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => handleCopyApkText('assetlinks', assetLinksPreview)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold cursor-pointer"
          >
            {copiedApkField === 'assetlinks' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>نسخ محتوى assetlinks.json</span>
          </button>
        </div>
      </div>
    </div>
  );
};
