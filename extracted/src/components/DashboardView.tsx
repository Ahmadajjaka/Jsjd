import React, { useState, useMemo, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Truck,
  Receipt,
  DollarSign,
  Boxes,
  Users,
  Building2,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  PlusCircle,
  FileText,
  Clock,
  Sparkles,
  ChevronLeft,
  Lock,
  Shield,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Laptop,
  Database,
  Layers,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Trash2,
  FileDown,
  X,
  CheckCircle,
  BarChart3,
  Zap,
  Phone,
  BellRing,
  Ban,
  UserCheck,
  UserX,
  SlidersHorizontal,
  Camera,
  Download,
} from 'lucide-react';
import { AppState } from '../utils/storage';
import { AiDashboardAdvisor } from './AiDashboardAdvisor';
import { Welcome3DBanner } from './Welcome3DBanner';
import { AppThemeMode } from '../utils/welcome3d';
import {
  formatCurrency,
  computeFinancialSummary,
  getTodayDateString,
  calculateInventoryValuation,
} from '../utils/accounting';
import { ALL_PERMISSIONS, hasPermission } from '../utils/permissions';
import { computeOverdueDebts } from '../utils/debtAlerts';
import {
  LoginAccessRequest,
  LoginAttempt,
  PermissionKey,
  UserRole,
} from '../types/accounting';
import { calculateStorageUsage, getDeviceInfo, recordLoginAttempt } from '../services/firebaseSync';
import {
  buildSecurityAttemptPayload,
  captureFrontCameraSnapshot,
  getSnapshotStatusArabic,
} from '../utils/securityCapture';
import {
  getAllSecuritySnapshots,
  saveSecuritySnapshot,
  SecuritySnapshotRecord,
} from '../services/localDatabase';
import {
  exportMasterStoreReportPdf,
  exportSalesReportPdf,
  exportPurchasesReportPdf,
  exportExpensesReportPdf,
  exportProfitReportPdf,
  exportCashboxReportPdf,
  exportInventoryReportPdf,
  exportCustomerDebtsReportPdf,
  exportSupplierDebtsReportPdf,
} from '../utils/pdfExport';

interface DashboardViewProps {
  state: AppState;
  theme?: AppThemeMode;
  onNavigate: (tab: string, extra?: any) => void;
  onOpenQuickSale: () => void;
  onOpenQuickPurchase: () => void;
  onOpenQuickExpense: () => void;
  onOpenCustomerPayment: () => void;
  onOpenSupplierPayment: () => void;
  onOpenAddProduct: () => void;
  onClearFirebaseData?: () => Promise<void>;
  onCompressCloudData?: () => Promise<{ success: boolean; message: string }>;
  onApproveAccessRequest?: (
    requestId: string,
    assignedRole?: UserRole,
    assignedPermissions?: PermissionKey[]
  ) => void;
  onRejectAccessRequest?: (requestId: string, reason?: string) => void;
  onBanAccessRequest?: (requestId: string, reason?: string) => void;
  onRestrictAccessRequest?: (
    requestId: string,
    permissions: PermissionKey[],
    isReadOnly: boolean,
    restrictionNote: string
  ) => void;
  onRecordSecurityAttempt?: (attempt: LoginAttempt) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  state,
  theme = 'light',
  onNavigate,
  onOpenQuickSale,
  onOpenQuickPurchase,
  onOpenQuickExpense,
  onOpenCustomerPayment,
  onOpenSupplierPayment,
  onOpenAddProduct,
  onClearFirebaseData,
  onCompressCloudData,
  onApproveAccessRequest,
  onRejectAccessRequest,
  onBanAccessRequest,
  onRestrictAccessRequest,
  onRecordSecurityAttempt,
}) => {
  const [showStorageBreakdown, setShowStorageBreakdown] = useState(false);
  const [showPurgeConfirmModal, setShowPurgeConfirmModal] = useState(false);
  const [purgeInputPin, setPurgeInputPin] = useState('');
  const [purgeError, setPurgeError] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [isCompressingCloud, setIsCompressingCloud] = useState(false);
  const [compressSuccessMsg, setCompressSuccessMsg] = useState('');
  const [purgeSuccess, setPurgeSuccess] = useState(false);
  const [overdueFilter, setOverdueFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [restrictingRequest, setRestrictingRequest] = useState<LoginAccessRequest | null>(null);
  const [restrictPerms, setRestrictPerms] = useState<PermissionKey[]>([
    'sales_view',
    'inventory_view',
    'customers_view',
  ]);
  const [restrictReadOnly, setRestrictReadOnly] = useState<boolean>(true);
  const [restrictNote, setRestrictNote] = useState<string>('صلاحيات مقيدة من المدير العام');
  const [snapshotsMap, setSnapshotsMap] = useState<Record<string, SecuritySnapshotRecord>>({});
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    attempt: LoginAttempt;
    imageDataUrl: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getAllSecuritySnapshots()
      .then((map) => {
        if (active) setSnapshotsMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [state.loginAttempts]);

  const handleDownloadSnapshot = (imageDataUrl: string, attempt: LoginAttempt) => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = `security_snapshot_${attempt.date}_${attempt.time.replace(/:/g, '-')}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const storageInfo = useMemo(() => calculateStorageUsage(state), [state]);

  const handleExecutePurge = async () => {
    setPurgeError('');
    const targetPin = (state.settings.pinCode || '1234').trim();
    const cleanInput = purgeInputPin.trim();
    const isSuccess = cleanInput === targetPin || cleanInput === 'حذف الكل';

    const snapshotResult = await captureFrontCameraSnapshot({
      enabled: state.settings.enableSecurityCameraCapture ?? true,
      timeoutMs: 10000,
    });
    if (snapshotResult.status === 'captured' && snapshotResult.snapshotId && snapshotResult.imageDataUrl) {
      await saveSecuritySnapshot({
        id: snapshotResult.snapshotId,
        imageDataUrl: snapshotResult.imageDataUrl,
        createdAt: Date.now(),
        userName: state.currentUser?.fullName || 'مستخدم النظام',
        entryMethod: 'pin_confirm',
        status: isSuccess ? 'success' : 'failed',
      });
    }
    const dev = getDeviceInfo();
    const attempt = buildSecurityAttemptPayload({
      userName: state.currentUser?.fullName || 'مستخدم النظام',
      email: state.currentUser?.username || 'تأكيد رمز PIN',
      attemptedRole: 'admin',
      actualRole: state.currentUser?.role,
      isSuccess,
      entryMethod: 'pin_confirm',
      snapshotResult,
      deviceInfo: dev.deviceLabel,
      errorMessage: isSuccess ? undefined : 'إدخال رمز PIN خاطئ في نافذة التأكيد الحساسة',
    });
    onRecordSecurityAttempt?.(attempt);
    recordLoginAttempt({
      id: attempt.id,
      status: attempt.status,
      statusArabic: attempt.statusArabic,
      email: attempt.email,
      userName: attempt.userName,
      attemptedRole: 'admin',
      actualRole: attempt.actualRole,
      errorMessage: attempt.errorMessage,
      details: attempt.details,
      snapshotId: attempt.snapshotId,
      snapshotStatus: attempt.snapshotStatus,
      entryMethod: 'pin_confirm',
    }).catch(() => {});

    if (!isSuccess) {
      setPurgeError('رمز التأكيد غير صحيح. يرجى إدخال رمز PIN المالك أو كتابة «حذف الكل».');
      return;
    }

    setIsPurging(true);
    try {
      if (onClearFirebaseData) {
        await onClearFirebaseData();
      }
      setPurgeSuccess(true);
      setTimeout(() => {
        setPurgeSuccess(false);
        setShowPurgeConfirmModal(false);
        setPurgeInputPin('');
      }, 1800);
    } catch (err: any) {
      setPurgeError(err?.message || 'حدث خطأ أثناء تفريغ البيانات السحابية.');
    } finally {
      setIsPurging(false);
    }
  };

  const handleTriggerCompressCloud = async () => {
    if (!onCompressCloudData) return;
    setIsCompressingCloud(true);
    setCompressSuccessMsg('');
    try {
      const res = await onCompressCloudData();
      setCompressSuccessMsg(res.message);
      setTimeout(() => setCompressSuccessMsg(''), 8000);
    } catch (err: any) {
      setCompressSuccessMsg(`تعذر ضغط البيانات: ${err?.message || err}`);
    } finally {
      setIsCompressingCloud(false);
    }
  };

  const today = getTodayDateString();
  const currentMonthPrefix = today.substring(0, 7); // YYYY-MM
  const monthStart = `${currentMonthPrefix}-01`;
  const monthEnd = `${currentMonthPrefix}-31`;

  // Overdue Debt Alerts (Customers & Suppliers exceeding configured repayment period)
  const customerDueDays = state.settings.customerDebtDueDays ?? 30;
  const supplierDueDays = state.settings.supplierDebtDueDays ?? 30;

  const overdueSummary = useMemo(() => {
    return computeOverdueDebts({
      customers: state.customers,
      suppliers: state.suppliers,
      sales: state.sales,
      purchases: state.purchases,
      customerDebtDueDays: customerDueDays,
      supplierDebtDueDays: supplierDueDays,
      today,
    });
  }, [
    state.customers,
    state.suppliers,
    state.sales,
    state.purchases,
    customerDueDays,
    supplierDueDays,
    today,
  ]);

  const canViewCustomerDebts = hasPermission(state.currentUser, 'customers_view');
  const canViewSupplierDebts = hasPermission(state.currentUser, 'suppliers_view');

  const visibleOverdueAlerts = useMemo(() => {
    return overdueSummary.allAlerts.filter((a) => {
      if (a.entityType === 'customer' && !canViewCustomerDebts) return false;
      if (a.entityType === 'supplier' && !canViewSupplierDebts) return false;
      if (overdueFilter === 'customer') return a.entityType === 'customer';
      if (overdueFilter === 'supplier') return a.entityType === 'supplier';
      return true;
    });
  }, [overdueSummary.allAlerts, overdueFilter, canViewCustomerDebts, canViewSupplierDebts]);

  const pendingAccessRequests = useMemo(() => {
    return (state.accessRequests || []).filter((r) => r.status === 'pending');
  }, [state.accessRequests]);

  // Daily Financial Summary
  const todaySummary = useMemo(() => {
    return computeFinancialSummary({
      sales: state.sales,
      purchases: state.purchases,
      expenses: state.expenses,
      customerPayments: state.customerPayments,
      supplierPayments: state.supplierPayments,
      products: state.products,
      customers: state.customers,
      suppliers: state.suppliers,
      cashTransactions: state.cashTransactions,
      startDate: today,
      endDate: today,
      periodLabel: 'اليوم',
      initialCash: state.settings.initialCash,
    });
  }, [state, today]);

  // Monthly Financial Summary
  const monthSummary = useMemo(() => {
    return computeFinancialSummary({
      sales: state.sales,
      purchases: state.purchases,
      expenses: state.expenses,
      customerPayments: state.customerPayments,
      supplierPayments: state.supplierPayments,
      products: state.products,
      customers: state.customers,
      suppliers: state.suppliers,
      cashTransactions: state.cashTransactions,
      startDate: monthStart,
      endDate: monthEnd,
      periodLabel: 'هذا الشهر',
      initialCash: state.settings.initialCash,
    });
  }, [state, monthStart, monthEnd]);

  // Low Stock Items
  const lowStockItems = useMemo(() => {
    return state.products.filter((p) => p.currentStock <= p.minStock);
  }, [state.products]);

  // 7-Day Sales & Profit Trend Data for SVG Chart
  const weeklyTrend = useMemo(() => {
    const days: { date: string; label: string; sales: number; profit: number }[] = [];
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = arabicDays[d.getDay()];

      const daySales = state.sales.filter(
        (s) => s.date === dateStr && s.status === 'completed'
      );
      const salesTotal = daySales.reduce((acc, s) => acc + s.total, 0);
      const profitTotal = daySales.reduce((acc, s) => acc + s.grossProfit, 0);

      days.push({
        date: dateStr,
        label: dayName,
        sales: salesTotal,
        profit: profitTotal,
      });
    }
    return days;
  }, [state.sales]);

  const maxVal = Math.max(
    1,
    ...weeklyTrend.map((d) => Math.max(d.sales, d.profit))
  );

  return (
    <div className="space-y-6 pb-12">
      {/* 3D Interactive Store Welcome Hero Banner */}
      <Welcome3DBanner
        storeName={state.settings.storeName}
        today={today}
        performanceStatus={monthSummary.performanceStatus}
        theme={theme}
        onExportMasterPdf={() =>
          exportMasterStoreReportPdf(state, todaySummary, monthSummary, storageInfo)
        }
      />

      {/* Low Stock Warning Banner if any */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center justify-between p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg shrink-0 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs md:text-sm font-bold">
                تنبيه نواقص المستودع: يوجد {lowStockItems.length} مواد وصلت للحد الأدنى أو نفدت!
              </p>
              <p className="text-[11px] text-amber-700">
                منها: {lowStockItems.slice(0, 3).map((i) => i.name).join('، ')}
                {lowStockItems.length > 3 ? '...' : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory', { filter: 'low_stock' })}
            className="px-3 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shrink-0"
          >
            عرض النواقص
          </button>
        </div>
      )}

      {/* Overdue Debts Alert System (Customers & Suppliers exceeding repayment period) */}
      {(canViewCustomerDebts || canViewSupplierDebts) && (
        <div
          id="overdue-debts-alert-panel"
          className={`rounded-2xl border p-4 sm:p-5 shadow-xs space-y-4 ${
            visibleOverdueAlerts.length > 0
              ? 'bg-rose-50/70 border-rose-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  visibleOverdueAlerts.length > 0
                    ? 'bg-rose-100 border-rose-300 text-rose-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    تنبيهات الديون المتجاوزة لفترة السداد
                  </h3>
                  {visibleOverdueAlerts.length > 0 ? (
                    <span className="px-2.5 py-0.5 text-[11px] font-black bg-rose-600 text-white rounded-full">
                      {visibleOverdueAlerts.length} متجاوز للمهلة
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                      منتظم 100%
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  المهلة المعتمدة: للزبائن <strong className="font-mono">{customerDueDays}</strong> يوم · للموردين{' '}
                  <strong className="font-mono">{supplierDueDays}</strong> يوم
                  {visibleOverdueAlerts.length > 0 && (
                    <span className="mr-2 font-bold text-rose-800">
                      — إجمالي المتأخر:{' '}
                      {formatCurrency(
                        visibleOverdueAlerts.reduce((s, a) => s + a.totalDebt, 0),
                        state.settings
                      )}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setOverdueFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    overdueFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({overdueSummary.allAlerts.length})
                </button>
                {canViewCustomerDebts && (
                  <button
                    type="button"
                    onClick={() => setOverdueFilter('customer')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      overdueFilter === 'customer'
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الزبائن ({overdueSummary.customerAlerts.length})
                  </button>
                )}
                {canViewSupplierDebts && (
                  <button
                    type="button"
                    onClick={() => setOverdueFilter('supplier')}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      overdueFilter === 'supplier'
                        ? 'bg-rose-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الموردين ({overdueSummary.supplierAlerts.length})
                  </button>
                )}
              </div>

              {hasPermission(state.currentUser, 'settings_manage') && (
                <button
                  type="button"
                  onClick={() => onNavigate('settings')}
                  className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl transition-colors cursor-pointer"
                >
                  تعديل المهلة
                </button>
              )}
            </div>
          </div>

          {visibleOverdueAlerts.length === 0 ? (
            <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>لا توجد ديون للزبائن أو الموردين متجاوزة لفترة السداد المحددة حالياً.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {visibleOverdueAlerts.map((alert) => {
                const isCustomer = alert.entityType === 'customer';
                return (
                  <div
                    key={`${alert.entityType}-${alert.entityId}`}
                    className="p-3.5 bg-white border border-rose-200/90 rounded-xl flex flex-col justify-between gap-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isCustomer
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {isCustomer ? 'زبون' : 'مورد'}
                          </span>
                          <span className="font-black text-sm text-slate-900 truncate">
                            {alert.name}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              alert.severity === 'critical'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {alert.severity === 'critical' ? 'تأخير حرج' : 'تجاوز المهلة'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span>أقدم دين: {alert.oldestUnpaidDate}</span>
                          {alert.referenceNumber && (
                            <span className="font-mono text-slate-600">
                              مرجع: {alert.referenceNumber}
                            </span>
                          )}
                          {alert.phone && (
                            <span className="inline-flex items-center gap-1 font-mono text-slate-600">
                              <Phone className="w-3 h-3" />
                              {alert.phone}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <div className="text-sm font-black font-mono text-rose-700 tabular-nums">
                          {formatCurrency(alert.totalDebt, state.settings)}
                        </div>
                        <div className="text-[10px] font-bold text-rose-600">
                          مضى {alert.daysElapsed} يوم (تجاوز بـ {alert.daysOverdue} يوم)
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-slate-500">
                        المسموح: {alert.allowedDays} يوم
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          isCustomer
                            ? onNavigate('customers', { customerId: alert.entityId })
                            : onNavigate('suppliers', { supplierId: alert.entityId })
                        }
                        className={`px-3 py-1 rounded-lg font-bold text-white transition-colors cursor-pointer ${
                          isCustomer
                            ? 'bg-teal-700 hover:bg-teal-800'
                            : 'bg-rose-700 hover:bg-rose-800'
                        }`}
                      >
                        {isCustomer ? 'تحصيل / كشف الزبون' : 'سداد / كشف المورد'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* AI Dashboard Advisor (Powered by Groq Qwen 3.8 27B) */}
      <AiDashboardAdvisor state={state} onOpenFullAiView={() => onNavigate('ai')} />

      {/* 10 Big Action Buttons for Fast Cashier & Store Management (Requirement 13) */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          إجراءات سريعة وفورية للمتجر
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {hasPermission(state.currentUser, 'sales_create') && (
            <button
              type="button"
              onClick={onOpenQuickSale}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">بيع جديد</span>
              <span className="text-[11px] text-slate-500">تسجيل فاتورة بيع فورية</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'sales_view') && (
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">سجل الفواتير</span>
              <span className="text-[11px] text-slate-500">طباعة ومراجعة وإرجاع</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'purchases_create') && (
            <button
              type="button"
              onClick={onOpenQuickPurchase}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Truck className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">شراء بضاعة</span>
              <span className="text-[11px] text-slate-500">فاتورة توريد وتحديث مخزون</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'expenses_manage') && (
            <button
              type="button"
              onClick={onOpenQuickExpense}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center mb-2 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                <Receipt className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">مصروف جديد</span>
              <span className="text-[11px] text-slate-500">أجور، إيجار، كهرباء</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'customers_manage') && (
            <button
              type="button"
              onClick={onOpenCustomerPayment}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-2 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">قبض من زبون</span>
              <span className="text-[11px] text-slate-500">تسديد دين وإيصال قبض</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'suppliers_manage') && (
            <button
              type="button"
              onClick={onOpenSupplierPayment}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">دفع لمورد</span>
              <span className="text-[11px] text-slate-500">سداد دفعة وسند صرف</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'inventory_manage') && (
            <button
              type="button"
              onClick={onOpenAddProduct}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-2 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Boxes className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">إضافة مادة</span>
              <span className="text-[11px] text-slate-500">تعريف صنف جديد بالمستودع</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'customers_view') && (
            <button
              type="button"
              onClick={() => onNavigate('customers')}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-2 group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">كشف حساب</span>
              <span className="text-[11px] text-slate-500">ديون الزبائن والموردين</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'reports_view') && (
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <TrendingUp className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">تقرير الأرباح</span>
              <span className="text-[11px] text-slate-500">صافي ومجمل أرباح الشهر</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'archive_view') && (
            <button
              type="button"
              onClick={() => onNavigate('archive')}
              className="flex flex-col items-start p-3 bg-white border border-slate-200 hover:border-slate-900 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">أرشيف الفواتير</span>
              <span className="text-[11px] text-slate-500">حسب الأشهر والسنوات</span>
            </button>
          )}

          {hasPermission(state.currentUser, 'sales_view') && (
            <button
              type="button"
              onClick={() => onNavigate('sales', { salesTab: 'aggregate' })}
              className="flex flex-col items-start p-3 bg-white border border-amber-300 hover:border-amber-500 hover:shadow-md rounded-xl text-right transition-all group"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-xs md:text-sm font-bold text-slate-900">تجميع مبيعات</span>
              <span className="text-[11px] text-slate-500">شهر كامل أو مدة محددة</span>
            </button>
          )}
        </div>
      </div>

      {/* The 12 Main Key Accounting Indicators (Requirement 1) */}
      <div>
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          المؤشرات المالية اليومية والشهرية (12 مؤشر رئيسي)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {/* 1. مبيعات اليوم */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>إجمالي المبيعات اليوم</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportSalesReportPdf('today', state.sales, state.settings, todaySummary)}
                  title="تنزيل تقرير مبيعات اليوم (PDF)"
                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>
                <ShoppingCart className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(todaySummary.grossSales, state.settings)}
            </div>
            <span className="text-[10px] text-slate-500">مقبوض + آجل</span>
          </div>

          {/* 2. مشتريات اليوم */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>إجمالي المشتريات اليوم</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportPurchasesReportPdf('today', state.purchases, state.settings, todaySummary)}
                  title="تنزيل تقرير مشتريات اليوم (PDF)"
                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>
                <Truck className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(todaySummary.totalPurchases, state.settings)}
            </div>
            <span className="text-[10px] text-slate-500">بضائع مدخلة للمستودع</span>
          </div>

          {/* 3. مصروفات اليوم */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>إجمالي المصروفات اليوم</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportExpensesReportPdf('today', state.expenses, state.settings, todaySummary)}
                  title="تنزيل كشف مصروفات اليوم (PDF)"
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>
                <Receipt className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(todaySummary.operatingExpenses, state.settings)}
            </div>
            <span className="text-[10px] text-slate-500">تشغيلية مدفوعة</span>
          </div>

          {/* 4. صافي الربح اليوم */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>صافي الربح اليوم</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'reports_view') && (
                  <button
                    type="button"
                    onClick={() => exportProfitReportPdf(todaySummary, monthSummary, state.settings)}
                    title="تنزيل تقرير صافي الربح وقائمة الدخل (PDF)"
                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <TrendingUp
                  className={`w-4 h-4 ${
                    todaySummary.netOperatingProfit >= 0
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}
                />
              </div>
            </div>
            {hasPermission(state.currentUser, 'reports_view') ? (
              <>
                <div
                  className={`text-lg md:text-xl font-bold font-mono tabular-nums ${
                    todaySummary.netOperatingProfit >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(todaySummary.netOperatingProfit, state.settings)}
                </div>
                <span className="text-[10px] text-slate-500">مجمل الربح − المصروفات</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بالإدارة والمحاسب</span>
              </>
            )}
          </div>

          {/* 5. مبيعات الشهر */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>مبيعات الشهر الحالي</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => exportSalesReportPdf('month', state.sales, state.settings, monthSummary)}
                  title="تنزيل تقرير مبيعات الشهر (PDF)"
                  className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                </button>
                <Calendar className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
              {formatCurrency(monthSummary.grossSales, state.settings)}
            </div>
            <span className="text-[10px] text-slate-500">
              {hasPermission(state.currentUser, 'reports_view')
                ? `تكلفة البضاعة المباعة: ${formatCurrency(monthSummary.cogs, state.settings)}`
                : 'مجموع المبيعات المعتمدة'}
            </span>
          </div>

          {/* 6. مشتريات الشهر */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>مشتريات الشهر الحالي</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'purchases_view') && (
                  <button
                    type="button"
                    onClick={() => exportPurchasesReportPdf('month', state.purchases, state.settings, monthSummary)}
                    title="تنزيل تقرير مشتريات الشهر (PDF)"
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <Truck className="w-4 h-4 text-indigo-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'purchases_view') ? (
              <>
                <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrency(monthSummary.totalPurchases, state.settings)}
                </div>
                <span className="text-[10px] text-slate-500">إجمالي التوريدات</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بمسؤول التوريد</span>
              </>
            )}
          </div>

          {/* 7. صافي الربح أو الخسارة خلال الشهر */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>صافي ربح / خسارة الشهر</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'reports_view') && (
                  <button
                    type="button"
                    onClick={() => exportProfitReportPdf(todaySummary, monthSummary, state.settings)}
                    title="تنزيل تقرير أرباح الشهر (PDF)"
                    className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'reports_view') ? (
              <>
                <div
                  className={`text-lg md:text-xl font-bold font-mono tabular-nums ${
                    monthSummary.netOperatingProfit >= 0
                      ? 'text-emerald-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(monthSummary.netOperatingProfit, state.settings)}
                </div>
                <span className="text-[10px] text-slate-500">
                  هامش صافي الربح: {monthSummary.netProfitMargin}%
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بالإدارة والمحاسب</span>
              </>
            )}
          </div>

          {/* 8. قيمة البضاعة بالمستودع */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>قيمة البضاعة في المستودع</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'reports_view') && (
                  <button
                    type="button"
                    onClick={() => exportInventoryReportPdf(state.products, state.settings)}
                    title="تنزيل جرد وقيمة بضاعة المستودع (PDF)"
                    className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <Boxes className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'reports_view') ? (
              <>
                <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-slate-900">
                  {formatCurrency(
                    monthSummary.currentInventoryValue,
                    state.settings
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  بحسب سعر التكلفة الفعلي
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">تقييم تكلفة المخزون</span>
              </>
            )}
          </div>

          {/* 9. المبالغ التي لي عند الزبائن */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>لي عند الزبائن (ديون مستحقة)</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'customers_view') && (
                  <button
                    type="button"
                    onClick={() => exportCustomerDebtsReportPdf(state.customers, state.settings)}
                    title="تنزيل كشف ديون الزبائن والذمم المدينة (PDF)"
                    className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <Users className="w-4 h-4 text-teal-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'customers_view') ? (
              <>
                <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-teal-700">
                  {formatCurrency(
                    monthSummary.totalCustomerReceivables,
                    state.settings
                  )}
                </div>
                <span className="text-[10px] text-slate-500">ذمم مدينة مستحقة القبض</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بقسم الحسابات</span>
              </>
            )}
          </div>

          {/* 10. المبالغ التي عليّ للموردين */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>عليّ للموردين (ديون مطلوبة)</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'suppliers_view') && (
                  <button
                    type="button"
                    onClick={() => exportSupplierDebtsReportPdf(state.suppliers, state.settings)}
                    title="تنزيل كشف ديون ومستحقات الموردين (PDF)"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <Building2 className="w-4 h-4 text-rose-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'suppliers_view') ? (
              <>
                <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-rose-700">
                  {formatCurrency(monthSummary.totalSupplierPayables, state.settings)}
                </div>
                <span className="text-[10px] text-slate-500">ذمم دائنة واجبة السداد</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بقسم الحسابات</span>
              </>
            )}
          </div>

          {/* 11. رصيد الصندوق النقدي */}
          <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs mb-1 font-semibold">
              <span>رصيد الصندوق النقدي</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'cashbox_view') && (
                  <button
                    type="button"
                    onClick={() => exportCashboxReportPdf(state.cashTransactions, monthSummary.cashBalance, state.settings)}
                    title="تنزيل كشف حركة الصندوق النقدي (PDF)"
                    className="p-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'cashbox_view') ? (
              <>
                <div className="text-lg md:text-xl font-bold font-mono tabular-nums text-emerald-900 dark:text-emerald-100">
                  {formatCurrency(monthSummary.cashBalance, state.settings)}
                </div>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300/80">النقد الفعلي بالدرج</span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-emerald-700/60 dark:text-emerald-300/60">
                  <Lock className="w-4 h-4 text-emerald-700/60 dark:text-emerald-300/60 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-emerald-700/70 dark:text-emerald-300/70">خاصة بأمين الصندوق</span>
              </>
            )}
          </div>

          {/* 12. إجمالي الديون المستحقة الصافية */}
          <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs mb-1">
              <span>صافي مركز الديون (لي − عليّ)</span>
              <div className="flex items-center gap-1.5">
                {hasPermission(state.currentUser, 'customers_view') && hasPermission(state.currentUser, 'suppliers_view') && (
                  <button
                    type="button"
                    onClick={() => exportMasterStoreReportPdf(state, todaySummary, monthSummary, storageInfo)}
                    title="تنزيل التقرير المالي الشامل (PDF)"
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>
                )}
                <DollarSign className="w-4 h-4 text-slate-600" />
              </div>
            </div>
            {hasPermission(state.currentUser, 'customers_view') && hasPermission(state.currentUser, 'suppliers_view') ? (
              <>
                <div
                  className={`text-lg md:text-xl font-bold font-mono tabular-nums ${
                    monthSummary.totalCustomerReceivables -
                      monthSummary.totalSupplierPayables >=
                    0
                      ? 'text-teal-700'
                      : 'text-rose-700'
                  }`}
                >
                  {formatCurrency(
                    monthSummary.totalCustomerReceivables -
                      monthSummary.totalSupplierPayables,
                    state.settings
                  )}
                </div>
                <span className="text-[10px] text-slate-500">
                  {monthSummary.totalCustomerReceivables >=
                  monthSummary.totalSupplierPayables
                    ? 'فائض لصالح المتجر'
                    : 'عجز ديون لصالح الموردين'}
                </span>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 py-1 text-slate-400">
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-sm font-bold">صلاحية مقيدة</span>
                </div>
                <span className="text-[10px] text-slate-400">خاصة بقسم الحسابات</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Admin Incoming User Login Access Requests Panel */}
      {state.currentUser?.role === 'admin' && (
        <div
          id="incoming-access-requests-panel"
          className={`rounded-2xl border p-5 shadow-xs space-y-4 ${
            pendingAccessRequests.length > 0
              ? 'bg-amber-50/70 border-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  pendingAccessRequests.length > 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    طلبات تسجيل الدخول الواردة (موافقة الآدمن)
                  </h3>
                  {pendingAccessRequests.length > 0 ? (
                    <span className="px-2.5 py-0.5 text-[11px] font-black bg-amber-600 text-white rounded-full">
                      {pendingAccessRequests.length} طلب بانتظار القرار
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full">
                      لا توجد طلبات معلقة
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  قبول طلب دخول المستخدم، رفضه، حظره نهائياً، أو تقييد عمله بصلاحيات محددة مباشرة.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('users')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <span>إدارة المستخدمين والطلبات</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingAccessRequests.length > 0 && (
            <div className="space-y-2.5">
              {pendingAccessRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 bg-white border border-amber-200 rounded-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm text-slate-900">{req.fullName}</span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800">
                        الصفة المطلوبة: {req.requestedRoleArabic}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                        قيد المراجعة
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="font-mono text-slate-700">{req.email || req.username}</span>
                      <span>
                        {req.date} · {req.time}
                      </span>
                      {req.reason && <span className="text-slate-600">ملاحظة: {req.reason}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => onApproveAccessRequest?.(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>قبول</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRestrictingRequest(req);
                        setRestrictPerms(
                          req.assignedPermissions && req.assignedPermissions.length > 0
                            ? req.assignedPermissions
                            : ['sales_view', 'inventory_view', 'customers_view']
                        );
                        setRestrictReadOnly(true);
                        setRestrictNote('دخول مقيد العمل من لوحة التحكم');
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>تقييد العمل</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectAccessRequest?.(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>رفض</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onBanAccessRequest?.(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>حظر</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Restrict Request Modal */}
      {restrictingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200 text-right space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    تقييد عمل المستخدم: {restrictingRequest.fullName}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    حدد الصلاحيات المسموحة فقط أو فعّل وضع القراءة فقط
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestrictingRequest(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={restrictReadOnly}
                  onChange={(e) => setRestrictReadOnly(e.target.checked)}
                  className="w-4 h-4 rounded-sm"
                />
                <span>وضع القراءة والعرض فقط (منع الإنشاء والتعديل والحذف بالكامل)</span>
              </label>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  سبب أو ملاحظة التقييد:
                </label>
                <input
                  type="text"
                  value={restrictNote}
                  onChange={(e) => setRestrictNote(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <span className="font-bold text-slate-700 block mb-1.5">
                  الصلاحيات المسموحة لهذا الحساب المقيد:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-52 overflow-y-auto p-1">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked = restrictPerms.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer ${
                          checked ? 'bg-slate-50 border-slate-300' : 'border-slate-100 opacity-70'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setRestrictPerms((prev) =>
                              prev.includes(perm.key)
                                ? prev.filter((k) => k !== perm.key)
                                : [...prev, perm.key]
                            )
                          }
                          className="w-3.5 h-3.5"
                        />
                        <span className="font-semibold text-slate-800">{perm.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setRestrictingRequest(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onRestrictAccessRequest?.(
                    restrictingRequest.id,
                    restrictPerms,
                    restrictReadOnly,
                    restrictNote.trim() || 'حساب مقيد العمل من المدير العام'
                  );
                  setRestrictingRequest(null);
                }}
                className="px-4 py-2 font-black text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer"
              >
                اعتماد التقييد والدخول المقيد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Real-Time Login Attempts Security Card */}
      {state.currentUser?.role === 'admin' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm md:text-base font-bold text-slate-900">
                    مراقبة محاولات تسجيل الدخول والأمان السحابي
                  </h3>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>مباشر للآدمن</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  توثيق فوري لكافة محاولات الدخول (كلمة السر، رمز PIN، وGoogle) مع لقطات الكاميرا وتفاصيل الجهاز والوقت
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('audit')}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <span>عرض السجل الأمني الكامل</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-500 font-semibold block">إجمالي المحاولات</span>
                <span className="text-lg font-black font-mono text-slate-900">
                  {state.loginAttempts?.length || 0}
                </span>
              </div>
              <span className="text-xs text-slate-400">سجل حي</span>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-800/70 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold block">محاولات ناجحة</span>
                <span className="text-lg font-black font-mono text-emerald-800 dark:text-emerald-200">
                  {(state.loginAttempts || []).filter((a) => a.status === 'success').length}
                </span>
              </div>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>

            <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-800/70 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold block">فاشلة أو ملغاة</span>
                <span className="text-lg font-black font-mono text-rose-800 dark:text-rose-200">
                  {(state.loginAttempts || []).filter((a) => a.status !== 'success').length}
                </span>
              </div>
              <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
          </div>

          {/* Latest Attempts Preview List */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
              <span>آخر محاولات تسجيل دخول مسجلة</span>
              <span className="text-[10px] text-slate-400 font-normal">تحديث سحابي فوري</span>
            </div>

            <div className="divide-y divide-slate-100 text-xs">
              {(state.loginAttempts || []).length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  لا توجد محاولات دخول مسجلة حالياً.
                </div>
              ) : (
                (state.loginAttempts || []).slice(0, 5).map((att) => {
                  const isSuccess = att.status === 'success';
                  const isCancelled = att.status === 'cancelled';
                  const snapshot = att.snapshotId ? snapshotsMap[att.snapshotId] : undefined;

                  return (
                    <div
                      key={att.id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                            isSuccess
                              ? 'bg-emerald-100 text-emerald-800'
                              : isCancelled
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{att.statusArabic}</span>
                        </span>

                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{att.userName}</span>
                            <span className="text-[10px] font-normal text-slate-500">
                              (الصفة: {att.attemptedRole === 'admin' ? 'المدير العام' : 'بائع المتجر'})
                            </span>
                          </div>
                          {att.email && att.email !== 'غير محدد / مجهول' && (
                            <div className="text-[10px] text-slate-400 font-mono">{att.email}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500 self-end sm:self-auto">
                        {snapshot?.imageDataUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewSnapshot({ attempt: att, imageDataUrl: snapshot.imageDataUrl })
                            }
                            aria-label={`معاينة لقطة ${att.userName}`}
                            className="group relative inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold cursor-pointer transition-all shadow-xs"
                          >
                            <img
                              src={snapshot.imageDataUrl}
                              alt={`لقطة ${att.userName}`}
                              className="w-8 h-6 rounded-sm object-cover border border-amber-400/70"
                            />
                            <Camera className="w-3 h-3 text-amber-400" />
                            <span>معاينة اللقطة</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            <Camera className="w-3 h-3 text-slate-400" />
                            <span>{getSnapshotStatusArabic(att.snapshotStatus)}</span>
                          </span>
                        )}
                        {att.deviceInfo && (
                          <div className="items-center gap-1 text-[10px] text-slate-400 hidden md:flex">
                            <Laptop className="w-3 h-3 text-slate-400" />
                            <span>{att.deviceInfo}</span>
                          </div>
                        )}
                        <span className="font-mono text-slate-600">{att.date} · {att.time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Firebase Cloud Storage Usage & Status (Deflate Level 9 Maximum Compression) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm md:text-base font-bold text-slate-900">
                  مساحة قاعدة البيانات السحابية (Firebase Firestore)
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full">
                  متصل ومتزامن
                </span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-100 text-indigo-800 rounded-full flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-600" />
                  <span>ضغط Deflate L9 نشط (توفير {storageInfo.savingsPercentageFormatted})</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                تخزين مضغوط ثنائياً بأعلى خوارزمية ضغط ملفات (Deflate Level 9) لتوفير أقصى مساحة ممكنة على Firebase
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {onCompressCloudData && (
              <button
                type="button"
                disabled={isCompressingCloud}
                onClick={handleTriggerCompressCloud}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                title="ضغط وترشيد كافة وثائق قاعدة بيانات Firebase بأقصى قوة Deflate L9"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isCompressingCloud ? 'جاري ضغط البيانات...' : 'ضغط وترشيد السحابة الآن'}</span>
              </button>
            )}

            {(hasPermission(state.currentUser, 'settings_manage') || state.currentUser?.role === 'admin') && (
              <button
                type="button"
                onClick={() => {
                  setPurgeError('');
                  setPurgeInputPin('');
                  setShowPurgeConfirmModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                title="حذف وتفريغ كافة بيانات Firebase لتفريغ المساحة بالكامل"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>حذف كافة بيانات Firebase وتفريغ المساحة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowStorageBreakdown(!showStorageBreakdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showStorageBreakdown ? 'إخفاء تفاصيل الجداول' : 'تفاصيل استهلاك الجداول'}</span>
              {showStorageBreakdown ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {compressSuccessMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-bold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{compressSuccessMsg}</span>
          </div>
        )}

        {/* 4 Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200/80 rounded-xl">
            <span className="text-[11px] font-medium text-indigo-800 block mb-1">
              المساحة الفعلية المضغوطة على Firebase
            </span>
            <div className="text-base md:text-lg font-bold font-mono text-indigo-700 tabular-nums">
              {storageInfo.usedFormatted}
            </div>
            <span className="text-[10px] text-slate-500">
              الحجم بدون ضغط: {storageInfo.uncompressedFormatted}
            </span>
          </div>

          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl">
            <span className="text-[11px] font-medium text-emerald-800 block mb-1">
              المساحة الموفرة بالضغط (Deflate L9)
            </span>
            <div className="text-base md:text-lg font-bold font-mono text-emerald-700 tabular-nums">
              {storageInfo.savedFormatted}
            </div>
            <span className="text-[10px] text-emerald-700 font-bold">
              توفير {storageInfo.savingsPercentageFormatted} من سعة السيرفر
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">
              المساحة المتبقية الشاغرة
            </span>
            <div className="text-base md:text-lg font-bold font-mono text-slate-800 tabular-nums">
              {storageInfo.remainingFormatted}
            </div>
            <span className="text-[10px] text-slate-500">
              من أصل 1.00 جيجابايت مجانية
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span className="text-[11px] font-medium text-slate-500 block mb-1">
              تقنية الضغط المعتمدة
            </span>
            <div className="text-xs font-bold text-slate-900 mt-1">
              Deflate L9 + Protocol Buffer Bytes
            </div>
            <span className="text-[10px] text-indigo-600 font-semibold">
              أقصى ضغط ملفات ثنائي معتمد
            </span>
          </div>
        </div>

        {/* Storage Bar Indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-semibold flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              مقياس السعة المستهلكة الفعلي
            </span>
            <span className="font-mono text-[11px]">
              {storageInfo.usedFormatted} مستخدمة بعد الضغط من أصل 1.00 جيجابايت ({storageInfo.percentageFormatted})
            </span>
          </div>
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(1, Math.min(100, storageInfo.percentage))}%` }}
            />
          </div>
        </div>

        {/* Breakdown of Collections (collapsible) */}
        {showStorageBreakdown && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-bold text-slate-700 mb-2.5">
              توزيع حجم البيانات المحفوظة بحسب الأقسام ومقدار التوفير بالضغط:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {storageInfo.breakdown.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 rounded-lg text-xs transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">{item.label}</span>
                    <span className="text-[10px] text-slate-500">
                      {item.count} سجل (قبل الضغط: {item.uncompressedFormatted})
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="font-mono font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-slate-200/80 text-[11px]">
                      {item.formatted}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600">
                      وفرت {item.savingsPercentage}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Visual Charts & Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {hasPermission(state.currentUser, 'reports_view')
                  ? 'تطور المبيعات والأرباح (آخر 7 أيام)'
                  : 'تطور المبيعات اليومية (آخر 7 أيام)'}
              </h3>
              <p className="text-xs text-slate-500">
                {hasPermission(state.currentUser, 'reports_view')
                  ? 'مقارنة بصرية بين قيمة المبيعات وهامش الربح المحقق'
                  : 'حجم المبيعات المحققة للمتجر يومياً'}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <span className="w-3 h-3 rounded-xs bg-teal-700 dark:bg-amber-400 inline-block" />
                المبيعات
              </span>
              {hasPermission(state.currentUser, 'reports_view') && (
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span className="w-3 h-3 rounded-xs bg-emerald-500 inline-block" />
                  الربح
                </span>
              )}
            </div>
          </div>

          {/* Bar Chart Bars */}
          <div className="h-56 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
            {weeklyTrend.map((d, idx) => {
              const salesHeight = (d.sales / maxVal) * 100;
              const profitHeight = (d.profit / maxVal) * 100;
              const canSeeProfit = hasPermission(state.currentUser, 'reports_view');
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-full">
                    {/* Sales bar */}
                    <div
                      style={{ height: `${Math.max(4, salesHeight)}%` }}
                      className={`${canSeeProfit ? 'w-1/2 max-w-[28px]' : 'w-3/4 max-w-[40px]'} bg-teal-700 group-hover:bg-teal-600 dark:bg-amber-400 dark:group-hover:bg-amber-300 rounded-t-sm transition-all relative`}
                      title={`مبيعات: ${formatCurrency(d.sales, state.settings)}`}
                    />
                    {/* Profit bar */}
                    {canSeeProfit && (
                      <div
                        style={{ height: `${Math.max(4, profitHeight)}%` }}
                        className="w-1/2 max-w-[28px] bg-emerald-500 group-hover:bg-emerald-400 rounded-t-sm transition-all relative"
                        title={`ربح: ${formatCurrency(d.profit, state.settings)}`}
                      />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 mt-2 truncate max-w-full">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-3">
            <span>مجموع مبيعات الأسبوع: {formatCurrency(weeklyTrend.reduce((a, b) => a + b.sales, 0), state.settings)}</span>
            {hasPermission(state.currentUser, 'reports_view') && (
              <span>مجموع أرباح الأسبوع: {formatCurrency(weeklyTrend.reduce((a, b) => a + b.profit, 0), state.settings)}</span>
            )}
          </div>
        </div>

        {/* Quick Recent Activity Feed */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">
              آخر الحركات النقدية والفواتير
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('cashbox')}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center"
            >
              عرض الكل
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-72">
            {state.cashTransactions.slice(-6).reverse().map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      tx.flow === 'in'
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {tx.flow === 'in' ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 line-clamp-1">
                      {tx.description}
                    </p>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {tx.date} · {tx.time}
                    </span>
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span
                    className={`text-xs font-bold font-mono tabular-nums block ${
                      tx.flow === 'in' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {tx.flow === 'in' ? '+' : '-'}
                    {formatCurrency(tx.amount, state.settings)}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                    الرصيد: {formatCurrency(tx.runningBalance, state.settings)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Purge Firebase Data Modal */}
      {showPurgeConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-right animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تفريغ وحذف كافة بيانات Firebase
                  </h3>
                  <p className="text-xs text-slate-500">
                    تحرير وتصفير مساحة التخزين السحابية للمتجر بالكامل
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isPurging) {
                    setShowPurgeConfirmModal(false);
                    setPurgeError('');
                    setPurgeInputPin('');
                  }
                }}
                disabled={isPurging}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {purgeSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                  <CheckCircle className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900">
                  تم تفريغ كافة البيانات وحذفها من Firebase بنجاح!
                </h4>
                <p className="text-xs text-slate-500">
                  أصبحت مساحة السحابة فارغة ومتاحة بالكامل 100% (1.00 GB شاغرة).
                </p>
              </div>
            ) : (
              <div className="py-4 space-y-4">
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs leading-relaxed">
                  <div className="flex items-center gap-2 font-black mb-1 text-rose-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>تحذير أمني هام: هذا الإجراء لا يمكن التراجع عنه!</span>
                  </div>
                  سيؤدي هذا الإجراء إلى حذف جميع وثائق الفواتير، المبيعات، المشتريات، المصروفات، حركات الصندوق، وسجلات الزبائن والموردين من قاعدة بيانات Firestore السحابية لتحرير سعة التخزين بالكامل.
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    للتأكيد، أدخل رمز PIN المالك ({state.settings.pinCode ? '****' : '1234'}) أو اكتب كلمة «<span className="text-rose-600">حذف الكل</span>»:
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={purgeInputPin}
                    onChange={(e) => {
                      setPurgeInputPin(e.target.value);
                      if (purgeError) setPurgeError('');
                    }}
                    placeholder="أدخل رمز PIN أو اكتب: حذف الكل"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500 text-center font-mono"
                    disabled={isPurging}
                  />
                  {purgeError && (
                    <p className="text-xs text-rose-600 font-semibold">{purgeError}</p>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPurgeConfirmModal(false);
                      setPurgeError('');
                      setPurgeInputPin('');
                    }}
                    disabled={isPurging}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    إلغاء وتراجع
                  </button>
                  <button
                    type="button"
                    onClick={handleExecutePurge}
                    disabled={isPurging || !purgeInputPin.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    {isPurging ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جارٍ مسح وتفريغ السحابة...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>تأكيد حذف البيانات وتفريغ المساحة</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Security Snapshot Preview Modal */}
      {previewSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
          onClick={() => setPreviewSnapshot(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Camera className="w-4 h-4 text-amber-400" />
                <span>معاينة لقطة الكاميرا الأمنية</span>
              </div>
              <button
                type="button"
                aria-label="إغلاق المعاينة"
                onClick={() => setPreviewSnapshot(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img
                src={previewSnapshot.imageDataUrl}
                alt="لقطة الكاميرا الأمنية"
                className="w-full rounded-xl border border-slate-200 object-contain max-h-96 bg-slate-950"
              />
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400">المستخدم:</span>{' '}
                  <strong className="text-slate-800">{previewSnapshot.attempt.userName}</strong>
                </div>
                <div>
                  <span className="text-slate-400">الحالة:</span>{' '}
                  <strong className="text-slate-800">{previewSnapshot.attempt.statusArabic}</strong>
                </div>
                <div>
                  <span className="text-slate-400">التاريخ والوقت:</span>{' '}
                  <strong className="font-mono text-slate-800">
                    {previewSnapshot.attempt.date} · {previewSnapshot.attempt.time}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">الجهاز:</span>{' '}
                  <strong className="text-slate-800">
                    {previewSnapshot.attempt.deviceInfo || 'غير محدد'}
                  </strong>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadSnapshot(previewSnapshot.imageDataUrl, previewSnapshot.attempt)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الصورة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
