import {
  AppUser,
  AuditLog,
  CashTransaction,
  Customer,
  CustomerPayment,
  Expense,
  InventoryAdjustment,
  LoginAccessRequest,
  LoginAttempt,
  Product,
  PurchaseInvoice,
  SaleInvoice,
  StoreSettings,
  Supplier,
  SupplierPayment,
} from '../types/accounting';
import { getTodayDateString, getCurrentTimeString } from './accounting';
import { ROLE_PRESET_PERMISSIONS } from './permissions';
import { compressForLocalStorage, decompressFromLocalStorage } from './compression';

export interface AppState {
  settings: StoreSettings;
  users: AppUser[];
  currentUser: AppUser | null;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  sales: SaleInvoice[];
  purchases: PurchaseInvoice[];
  expenses: Expense[];
  cashTransactions: CashTransaction[];
  customerPayments: CustomerPayment[];
  supplierPayments: SupplierPayment[];
  inventoryAdjustments: InventoryAdjustment[];
  auditLogs: AuditLog[];
  loginAttempts: LoginAttempt[];
  accessRequests: LoginAccessRequest[];
  isLocked: boolean;
}

export const INITIAL_USERS: AppUser[] = [
  {
    id: 'user-admin',
    username: 'mohammedmamo2003',
    password: 'admin123',
    fullName: 'محمد المامو (المدير العام والمالك)',
    role: 'admin',
    roleNameArabic: 'المدير العام (مالك النظام)',
    permissions: ROLE_PRESET_PERMISSIONS.admin,
    isActive: true,
    avatarColor: 'bg-amber-500 text-slate-950 font-black',
    createdAt: '2026-10-01',
    lastLogin: '2026-10-24 13:00',
  },
  {
    id: 'user-accountant',
    username: 'accountant',
    password: 'acc123',
    fullName: 'سامر الحلبي (المحاسب المالي)',
    role: 'accountant',
    roleNameArabic: 'محاسب المتجر',
    permissions: ROLE_PRESET_PERMISSIONS.accountant,
    isActive: true,
    avatarColor: 'bg-emerald-700 text-white',
    createdAt: '2026-10-02',
    lastLogin: '2026-10-24 09:30',
  },
  {
    id: 'user-sales',
    username: 'sales',
    password: 'sale123',
    fullName: 'عمر الكاشير (مسؤول المبيعات)',
    role: 'salesperson',
    roleNameArabic: 'كاشير وبائع',
    permissions: ROLE_PRESET_PERMISSIONS.salesperson,
    isActive: true,
    avatarColor: 'bg-blue-700 text-white',
    createdAt: '2026-10-03',
    lastLogin: '2026-10-24 10:15',
  },
  {
    id: 'user-warehouse',
    username: 'warehouse',
    password: 'store123',
    fullName: 'خالد المستودع (أمين المخازن)',
    role: 'warehouse',
    roleNameArabic: 'أمين المستودع',
    permissions: ROLE_PRESET_PERMISSIONS.warehouse,
    isActive: true,
    avatarColor: 'bg-purple-700 text-white',
    createdAt: '2026-10-04',
    lastLogin: '2026-10-23 16:00',
  },
];

const STORAGE_KEY = 'almamo_hardware_accounting_v1';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'خردوات المامو',
  storeTagline: 'أدوات صحية - كهربائيات - عدد يدوية - مواد بناء ودهانات',
  phone: '0944123456',
  address: 'شارع السوق الرئيسي - مقابل ساحة البلدة',
  taxNumber: 'TX-89021',
  currency: 'SYP',
  currencySymbol: 'ل.س',
  currencyPosition: 'after',
  initialCash: 0,
  initialStockValue: 0,
  invoiceHeaderNote: 'أهلاً بكم في خردوات المامو - جودة معتمدة وأفضل الأسعار',
  invoiceFooterNote: 'شكراً لتعاملكم مع خردوات المامو. البضاعة المباعة ترد وتبدل خلال 3 أيام بموجب الفاتورة.',
  invoicePrintLayout: 'thermal80',
  categories: ['كهربائية', 'صحية', 'بناء', 'عامة'],
  units: ['قطعة', 'متر', 'كيلوغرام', 'كيس', 'صندوق', 'سطل', 'علبة', 'طقم', 'لفة'],
  expenseCategories: [
    'أجور عمال',
    'إيجار المحل',
    'كهرباء وماء وإنترنت',
    'نقل وشحن بضائع',
    'صيانة المحل ومعداته',
    'ضيافة ومستلزمات نظافة',
    'مصروفات تشغيلية أخرى',
  ],
  isPinLocked: false,
  pinCode: '1234',
  enableSecurityCameraCapture: true,
  dateFormat: 'ar-SA',
  adminEmail: 'mohammedmamo2003@gmail.com',
  customerDebtDueDays: 30,
  supplierDebtDueDays: 30,
};

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_SUPPLIERS: Supplier[] = [];

export const INITIAL_SALES: SaleInvoice[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_CASH_TRANSACTIONS: CashTransaction[] = [];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-clean-init',
    date: getTodayDateString(),
    time: getCurrentTimeString(),
    action: 'تهيئة النظام',
    entityType: 'settings',
    entityId: 'system',
    details: 'بدء استخدام نظام محاسب خردوات المامو بأرقام حقيقية ونظيفة من الصفر.',
  },
];

export function getInitialState(): AppState {
  return {
    settings: DEFAULT_SETTINGS,
    users: INITIAL_USERS,
    currentUser: null,
    products: INITIAL_PRODUCTS,
    customers: INITIAL_CUSTOMERS,
    suppliers: INITIAL_SUPPLIERS,
    sales: INITIAL_SALES,
    purchases: [],
    expenses: INITIAL_EXPENSES,
    cashTransactions: INITIAL_CASH_TRANSACTIONS,
    customerPayments: [],
    supplierPayments: [],
    inventoryAdjustments: [],
    auditLogs: INITIAL_AUDIT_LOGS,
    loginAttempts: [],
    accessRequests: [],
    isLocked: false,
  };
}

export function loadAppState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = getInitialState();
      saveAppState(init);
      return init;
    }
    const parsed = decompressFromLocalStorage<AppState>(raw);
    if (!parsed) {
      const init = getInitialState();
      saveAppState(init);
      return init;
    }

    // Detect lingering mock numbers/data from earlier testing
    const hasMockData =
      parsed.products?.some((p: any) => p.id === 'prod-01' || p.code === 'SAN-001') ||
      parsed.customers?.some((c: any) => c.id === 'cust-01') ||
      parsed.suppliers?.some((s: any) => s.id === 'supp-01') ||
      parsed.sales?.some((s: any) => s.id === 'inv-1001') ||
      parsed.cashTransactions?.some((t: any) => t.id === 'ctx-00') ||
      parsed.settings?.initialCash === 250000;

    if (hasMockData) {
      const cleanInit = getInitialState();
      saveAppState(cleanInit);
      return cleanInit;
    }

    const initState = getInitialState();
    return {
      ...initState,
      ...parsed,
      users: parsed.users && parsed.users.length > 0 ? parsed.users : initState.users,
      currentUser: null,
      loginAttempts: parsed.loginAttempts || [],
      accessRequests: parsed.accessRequests || [],
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings || {}),
        initialCash: parsed.settings?.initialCash ?? 0,
        customerDebtDueDays: parsed.settings?.customerDebtDueDays ?? 30,
        supplierDebtDueDays: parsed.settings?.supplierDebtDueDays ?? 30,
        enableSecurityCameraCapture: parsed.settings?.enableSecurityCameraCapture ?? true,
        categories:
          parsed.settings?.categories && parsed.settings.categories.includes('كهربائية')
            ? parsed.settings.categories
            : ['كهربائية', 'صحية', 'بناء', 'عامة'],
      },
    };
  } catch (err) {
    console.error('Failed to parse stored accounting state:', err);
    return getInitialState();
  }
}

export function saveAppState(state: AppState): void {
  try {
    const compressed = compressForLocalStorage(state);
    localStorage.setItem(STORAGE_KEY, compressed);
  } catch (err) {
    console.error('Failed to save accounting state to localStorage:', err);
  }
}

export function resetToDemoData(): AppState {
  const init = getInitialState();
  saveAppState(init);
  return init;
}

export function clearToCleanSlate(keepSettings: boolean = true): AppState {
  const current = loadAppState();
  const cleanSettings = keepSettings
    ? { ...current.settings, initialCash: 0, initialStockValue: 0 }
    : DEFAULT_SETTINGS;
  const cleanState: AppState = {
    settings: cleanSettings,
    users: current.users,
    currentUser: current.currentUser,
    products: [],
    customers: [],
    suppliers: [],
    sales: [],
    purchases: [],
    expenses: [],
    cashTransactions: [],
    customerPayments: [],
    supplierPayments: [],
    inventoryAdjustments: [],
    auditLogs: [
      {
        id: `log-${Date.now()}`,
        date: getTodayDateString(),
        time: getCurrentTimeString(),
        action: 'تصفير البيانات',
        entityType: 'settings',
        entityId: 'clean-slate',
        details: 'تم مسح وتصفير كافة البيانات الوهمية وبدء دفتر حسابات جديد ونظيف بالكامل.',
      },
    ],
    loginAttempts: current.loginAttempts || [],
    accessRequests: current.accessRequests || [],
    isLocked: false,
  };
  saveAppState(cleanState);
  return cleanState;
}

export function exportJSONBackup(state: AppState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = getTodayDateString();
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `نسخة_احتياطية_خردوات_المامو_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}
