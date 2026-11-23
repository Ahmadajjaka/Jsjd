export type CurrencyCode = 'SYP' | 'SAR' | 'USD' | 'AED' | 'JOD' | 'EGP' | 'IQD' | 'KWD' | 'QAR' | 'TRY';

export type PermissionKey =
  | 'sales_view'
  | 'sales_create'
  | 'sales_return'
  | 'purchases_view'
  | 'purchases_create'
  | 'inventory_view'
  | 'inventory_manage'
  | 'expenses_view'
  | 'expenses_manage'
  | 'customers_view'
  | 'customers_manage'
  | 'suppliers_view'
  | 'suppliers_manage'
  | 'cashbox_view'
  | 'cashbox_manage'
  | 'reports_view'
  | 'archive_view'
  | 'audit_view'
  | 'settings_manage'
  | 'users_manage';

export type UserRole = 'admin' | 'accountant' | 'salesperson' | 'warehouse' | 'custom';

export type UserAccessStatus = 'approved' | 'pending' | 'rejected' | 'banned' | 'restricted';

export interface AppUser {
  id: string;
  username: string;
  password: string; // كلمة المرور
  fullName: string;
  email?: string;
  role: UserRole;
  roleNameArabic: string;
  permissions: PermissionKey[];
  isActive: boolean;
  accessStatus?: UserAccessStatus;
  restrictionNote?: string;
  isReadOnly?: boolean;
  restrictedBy?: string;
  restrictedAt?: string;
  avatarColor?: string;
  createdAt: string;
  lastLogin?: string;
}

export interface LoginAccessRequest {
  id: string;
  uid?: string;
  email: string;
  fullName: string;
  username?: string;
  requestedRole: 'salesperson' | 'accountant' | 'warehouse' | 'custom';
  requestedRoleArabic: string;
  reason?: string;
  status: UserAccessStatus;
  assignedRole?: UserRole;
  assignedPermissions?: PermissionKey[];
  restrictionNote?: string;
  isReadOnly?: boolean;
  decisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  deviceInfo?: string;
  date: string;
  time: string;
  timestamp: number;
}

export interface StoreSettings {
  storeName: string;
  storeTagline: string;
  phone: string;
  address: string;
  taxNumber?: string;
  currency: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  initialCash: number;
  initialStockValue: number;
  invoiceHeaderNote: string;
  invoiceFooterNote: string;
  invoicePrintLayout?: 'standard' | 'thermal80';
  categories: string[];
  units: string[];
  expenseCategories: string[];
  isPinLocked: boolean;
  pinCode?: string;
  enableSecurityCameraCapture?: boolean;
  dateFormat: 'ar-SA' | 'en-GB' | 'iso';
  adminEmail?: string;
  customerDebtDueDays?: number;
  supplierDebtDueDays?: number;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  costPrice: number; // تكلفة الشراء
  sellingPrice: number; // سعر البيع
  minStock: number; // الحد الأدنى للتنبيه
  supplierId?: string;
  supplierName?: string;
  lastPurchaseDate?: string;
  lastSaleDate?: string;
  notes?: string;
  createdAt: string;
  barcode?: string;
  location?: string;
  updatedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  totalPurchases: number;
  totalPaid: number;
  totalDebt: number; // المتبقي عليه
  notes?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  address?: string;
  totalPurchases: number;
  totalPaid: number;
  totalDebt: number; // المتبقي له
  notes?: string;
  createdAt: string;
}

export interface SaleItem {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  quantity: number;
  costPrice: number; // للتكلفة وحساب الربح
  unitPrice: number; // سعر البيع
  discount: number; // خصم على السطر
  total: number; // (quantity * unitPrice) - discount
  profit: number; // total - (quantity * costPrice)
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string; // ف-1001
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  customerId: string; // 'cash_customer' أو معرف الزبون
  customerName: string;
  isCashCustomer: boolean;
  items: SaleItem[];
  subtotal: number;
  discount: number; // خصم إضافي على الفاتورة
  total: number; // صافي الفاتورة
  cogs: number; // تكلفة البضاعة المباعة
  grossProfit: number; // مجمل ربح الفاتورة
  paymentMethod: 'cash' | 'debt' | 'partial';
  paidAmount: number; // المقبوض فعلياً
  remainingAmount: number; // المتبقي كدين
  status: 'completed' | 'returned' | 'cancelled';
  notes?: string;
  returnReason?: string;
  returnedAt?: string;
  createdAt: string;
}

export interface PurchaseItem {
  productId: string;
  productCode: string;
  productName: string;
  category: string;
  unit: string;
  quantity: number;
  costPrice: number;
  total: number;
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string; // ش-1001
  supplierInvoiceNumber?: string;
  date: string;
  time: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  shippingCost: number; // مصاريف نقل إضافية
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'cash' | 'debt' | 'partial';
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  date: string;
  time: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'cash' | 'bank';
  notes?: string;
  createdAt: string;
}

export type CashTransactionType =
  | 'sale_receipt' // مقبوضات من مبيعات
  | 'customer_payment' // تحصيل دين زبون
  | 'supplier_payment' // سداد لمورد
  | 'expense' // مصروف تشغيلي
  | 'capital_deposit' // رأس مال مضاف
  | 'personal_withdrawal' // مسحوبات شخصية
  | 'sale_return_refund' // إرجاع مبيعات نقداً
  | 'inventory_adjustment_cash' // تسوية
  | 'initial_balance'; // رصيد افتتاحي

export interface CashTransaction {
  id: string;
  date: string;
  time: string;
  type: CashTransactionType;
  description: string;
  flow: 'in' | 'out';
  amount: number;
  runningBalance: number;
  referenceId?: string; // رقم الفاتورة أو معرف الزبون/المورد
  referenceNumber?: string;
}

export interface CustomerPayment {
  id: string;
  paymentNumber: string; // ق-1001
  date: string;
  time: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  remainingDebtAfter?: number;
  notes?: string;
  receiptPrinted?: boolean;
}

export interface SupplierPayment {
  id: string;
  paymentNumber: string; // ص-1001
  date: string;
  time: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  remainingDebtAfter?: number;
  notes?: string;
}

export interface InventoryAdjustment {
  id: string;
  date: string;
  time: string;
  productId: string;
  productCode: string;
  productName: string;
  oldStock: number;
  newStock: number;
  difference: number;
  costPrice: number;
  totalCostDifference: number;
  reason: 'damaged' | 'count_deficit' | 'count_surplus' | 'correction' | 'expired';
  notes: string;
}

export interface LoginAttempt {
  id: string;
  date: string;
  time: string;
  timestamp: number;
  email: string;
  userName: string;
  attemptedRole: 'admin' | 'salesperson' | 'unknown';
  actualRole?: UserRole;
  status: 'success' | 'failed' | 'cancelled' | 'blocked';
  statusArabic: string;
  deviceInfo?: string;
  userAgent?: string;
  errorMessage?: string;
  details?: string;
  snapshotId?: string;
  snapshotStatus?: 'captured' | 'denied' | 'no_camera' | 'disabled' | 'error';
  entryMethod?: 'lock_screen' | 'password_login' | 'pin_confirm' | 'google_auth';
}

export interface AuditLog {
  id: string;
  date: string;
  time: string;
  action: string;
  entityType: 'sale' | 'purchase' | 'expense' | 'customer' | 'supplier' | 'product' | 'cash' | 'settings' | 'user' | 'security';
  entityId: string;
  details: string;
  userId?: string;
  userName?: string;
}

export interface FinancialSummary {
  periodLabel: string;
  startDate: string;
  endDate: string;
  grossSales: number;
  salesReturns: number;
  netSales: number;
  cogs: number; // تكلفة البضاعة المباعة
  grossProfit: number; // مجمل الربح
  grossProfitMargin: number; // نسبة مجمل الربح
  operatingExpenses: number; // المصروفات التشغيلية
  netOperatingProfit: number; // صافي الربح التشغيلي
  netProfitMargin: number; // نسبة صافي الربح
  performanceStatus: 'profitable' | 'loss' | 'breakeven';
  totalPurchases: number;
  cashReceivedSales: number;
  cashReceivedDebts: number;
  cashPaidSuppliers: number;
  cashPaidExpenses: number;
  creditSalesNew: number;
  creditPurchasesNew: number;
  currentInventoryValue: number;
  totalCustomerReceivables: number;
  totalSupplierPayables: number;
  cashBalance: number;
}
