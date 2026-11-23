import React, { useState, useEffect } from 'react';
import {
  Menu,
  Calculator,
  Lock,
  PlusCircle,
  Coins,
  Store,
  User,
  LogOut,
  ChevronDown,
  Shield,
  ShieldAlert,
  Database,
  Sparkles,
  Sun,
  Moon,
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Laptop,
  Trash2,
  BookOpen,
  Wifi,
  WifiOff,
  RefreshCw,
  HardDrive,
  CloudUpload,
  Camera,
  Keyboard,
} from 'lucide-react';
import { AppUser, LoginAttempt, StoreSettings } from '../types/accounting';
import { formatCurrency } from '../utils/accounting';
import { SyncStatusSnapshot } from '../services/syncEngine';
import { toggleAndroidKeyboardDrawer } from '../utils/androidKeyboard';
import { getAllSecuritySnapshots, SecuritySnapshotRecord } from '../services/localDatabase';
import { getSnapshotStatusArabic } from '../utils/securityCapture';

interface NavbarProps {
  settings: StoreSettings;
  cashBalance: number;
  currentUser: AppUser | null;
  users: AppUser[];
  loginAttempts?: LoginAttempt[];
  onClearLoginAttempts?: () => Promise<void>;
  onOpenCalculator: () => void;
  onQuickSale: () => void;
  onLockScreen: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  onSwitchUser: (user: AppUser) => void;
  activeTab: string;
  onNavigate?: (tab: string) => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
  syncStatus?: SyncStatusSnapshot;
  onManualSync?: () => Promise<void>;
  onConnectGoogleForSync?: () => Promise<void>;
}

export const Navbar: React.FC<NavbarProps> = ({
  settings,
  cashBalance,
  currentUser,
  users,
  loginAttempts = [],
  onClearLoginAttempts,
  onOpenCalculator,
  onQuickSale,
  onLockScreen,
  onToggleSidebar,
  onLogout,
  onSwitchUser,
  activeTab,
  onNavigate,
  theme = 'light',
  onToggleTheme,
  syncStatus,
  onManualSync,
  onConnectGoogleForSync,
}) => {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [securityDropdownOpen, setSecurityDropdownOpen] = useState(false);
  const [syncDropdownOpen, setSyncDropdownOpen] = useState(false);
  const [securityFilter, setSecurityFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [isClearingAttempts, setIsClearingAttempts] = useState(false);
  const [confirmClearAttempts, setConfirmClearAttempts] = useState(false);
  const [snapshotsMap, setSnapshotsMap] = useState<Record<string, SecuritySnapshotRecord>>({});

  useEffect(() => {
    if (!securityDropdownOpen && loginAttempts.length === 0) return;
    let active = true;
    getAllSecuritySnapshots()
      .then((map) => {
        if (active) setSnapshotsMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [securityDropdownOpen, loginAttempts]);

  const failedCount = loginAttempts.filter((a) => a.status !== 'success').length;
  const successCount = loginAttempts.filter((a) => a.status === 'success').length;

  const filteredAttempts = loginAttempts.filter((a) => {
    if (securityFilter === 'success') return a.status === 'success';
    if (securityFilter === 'failed') return a.status !== 'success';
    return true;
  });

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-1.5 sm:gap-3 h-16 px-2.5 sm:px-5 bg-white border-b border-slate-200 shadow-xs w-full max-w-full">
      {/* Zone 1: Brand & Toggle (Right side in RTL) */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="تبديل القائمة الجانبية"
          className="p-1.5 sm:p-2 text-slate-600 rounded-lg lg:hidden hover:bg-slate-100 focus:outline-hidden focus:ring-2 focus:ring-slate-400 shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 dark:from-slate-800 dark:to-slate-900 text-slate-950 dark:text-amber-400 font-bold text-base shadow-xs shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm lg:text-base font-bold text-slate-900 leading-tight truncate">
              {settings.storeName}
            </h1>
            <p className="text-[11px] text-slate-500 font-medium hidden 2xl:block truncate max-w-[240px]">
              {settings.storeTagline}
            </p>
          </div>
        </div>

        {/* Dynamic Offline-First / Cloud Sync Status Button & Popover */}
        {syncStatus && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setSyncDropdownOpen(!syncDropdownOpen)}
              aria-label="حالة قاعدة البيانات المحلية والمزامنة"
              title="حالة قاعدة البيانات المحلية والمزامنة السحابية"
              className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                syncStatus.status === 'offline'
                  ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-700 dark:text-amber-200'
                  : syncStatus.status === 'syncing'
                  ? 'bg-sky-50 border-sky-300 text-sky-900 dark:bg-sky-950/60 dark:border-sky-700 dark:text-sky-200'
                  : syncStatus.status === 'needs_auth' || syncStatus.status === 'pending' || syncStatus.status === 'error'
                  ? 'bg-orange-50 border-orange-300 text-orange-900 dark:bg-orange-950/60 dark:border-orange-700 dark:text-orange-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200'
              }`}
            >
              {syncStatus.status === 'offline' ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              ) : syncStatus.status === 'syncing' ? (
                <RefreshCw className="w-3.5 h-3.5 text-sky-600 animate-spin shrink-0" />
              ) : syncStatus.status === 'needs_auth' || syncStatus.status === 'pending' || syncStatus.status === 'error' ? (
                <CloudUpload className="w-3.5 h-3.5 text-orange-600 shrink-0" />
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                  <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0 hidden sm:inline" />
                </>
              )}

              <span className="hidden xl:inline whitespace-nowrap">
                {syncStatus.status === 'offline'
                  ? 'بلا إنترنت · محلي'
                  : syncStatus.status === 'syncing'
                  ? `جاري المزامنة (${syncStatus.pendingCount})`
                  : syncStatus.status === 'needs_auth'
                  ? `محلي (${syncStatus.pendingCount}) · يتطلب ربط Google`
                  : syncStatus.status === 'pending' || syncStatus.status === 'error'
                  ? `بانتظار المزامنة (${syncStatus.pendingCount})`
                  : 'متصل · متزامن'}
              </span>

              {syncStatus.pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-600 dark:bg-slate-900 text-white dark:text-amber-300 text-[10px] font-mono font-black">
                  {syncStatus.pendingCount}
                </span>
              )}
            </button>

            {syncDropdownOpen && (
              <>
                <div
                  role="presentation"
                  onClick={() => setSyncDropdownOpen(false)}
                  className="fixed inset-0 z-40"
                />
                <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden text-right">
                  <div className="p-3 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold">القاعدة المحلية والمزامنة السحابية</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        syncStatus.isOnline
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {syncStatus.isOnline ? (
                        <>
                          <Wifi className="w-3 h-3" /> متصل بالنت
                        </>
                      ) : (
                        <>
                          <WifiOff className="w-3 h-3" /> بلا إنترنت
                        </>
                      )}
                    </span>
                  </div>

                  <div className="p-3.5 space-y-2.5 text-xs text-slate-700 dark:text-slate-300">
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                      <span className="font-semibold">قاعدة البيانات المحلية (IndexedDB)</span>
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 font-bold text-[10px]">
                        نشطة ومحفوظة 100%
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">عمليات بانتظار المزامنة:</span>
                      <strong className="font-mono text-sm text-slate-900 dark:text-white">
                        {syncStatus.pendingCount}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 dark:text-slate-400">آخر مزامنة ناجحة:</span>
                      <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        {syncStatus.lastSyncedAt
                          ? new Date(syncStatus.lastSyncedAt).toLocaleTimeString('ar-SA')
                          : 'لم تتم بعد'}
                      </span>
                    </div>

                    {syncStatus.lastSyncError && (
                      <p className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-snug">
                        {syncStatus.lastSyncError}
                      </p>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                      {syncStatus.isOnline && syncStatus.isFirebaseAuthenticated && onManualSync && (
                        <button
                          type="button"
                          disabled={syncStatus.isSyncing}
                          onClick={async () => {
                            await onManualSync();
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
                          <span>
                            {syncStatus.isSyncing
                              ? 'جاري مزامنة البيانات...'
                              : 'مزامنة القاعدة المحلية مع السحابة الآن'}
                          </span>
                        </button>
                      )}

                      {syncStatus.isOnline && !syncStatus.isFirebaseAuthenticated && onConnectGoogleForSync && (
                        <button
                          type="button"
                          onClick={async () => {
                            setSyncDropdownOpen(false);
                            await onConnectGoogleForSync();
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>ربط حساب Google لمزامنة العمليات المحلية</span>
                        </button>
                      )}

                      {!syncStatus.isOnline && (
                        <p className="text-[11px] text-center text-amber-700 dark:text-amber-300 font-semibold">
                          تُحفظ كافة بياناتك محلياً بأمان وستتم مزامنتها تلقائياً عند عودة الإنترنت.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Zone 2: Cashbox & User Session & Quick Tools (Left side in RTL) */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="hidden min-[460px]:flex items-center gap-1 sm:gap-2 px-1.5 sm:px-2.5 py-1 sm:py-1.5 bg-emerald-50/80 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-900 dark:text-emerald-200 shrink-0 max-w-[140px] md:max-w-none">
          <Coins className="hidden sm:block w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <div className="text-right min-w-0">
            <span className="text-[9px] sm:text-[10px] text-emerald-700 dark:text-emerald-300 block leading-none font-semibold">
              الصندوق
            </span>
            <span className="text-[11px] sm:text-sm font-bold font-mono tabular-nums leading-tight block truncate">
              {formatCurrency(cashBalance, settings)}
            </span>
          </div>
        </div>

        {/* Quick Tools */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Day / Night Theme Switcher */}
          {onToggleTheme && (
            <button
              type="button"
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'التحويل إلى الوضع النهاري' : 'التحويل إلى الوضع الليلي'}
              aria-label="تبديل الثيم نهاري/ليلي"
              className="hidden md:flex p-1.5 sm:px-2 sm:py-1.5 text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-all items-center gap-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer shrink-0"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden 2xl:inline text-amber-400 font-bold">نهاري</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-teal-700" />
                  <span className="hidden 2xl:inline text-slate-700 font-bold">ليلي</span>
                </>
              )}
            </button>
          )}

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('ai')}
              title="مستشار الذكاء الاصطناعي والمنفّذ الآلي (Qwen 3.8 27B عبر Groq)"
              className={`hidden md:flex p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg transition-all items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'ai'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 dark:bg-gradient-to-r dark:from-slate-900 dark:to-amber-950 dark:text-white dark:border-amber-500/30'
              }`}
            >
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="hidden xl:inline">المستشار الذكي</span>
            </button>
          )}

          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('ledger')}
              title="فتح دفتر الحسابات واليومية الورقي التقليدي"
              className={`hidden md:flex p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-bold rounded-lg transition-all items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'ledger'
                  ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-400'
                  : 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/60'
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-800 dark:text-amber-300 shrink-0" />
              <span className="hidden xl:inline font-bold">الدفتر 📖</span>
            </button>
          )}

          {/* Admin Security & Login Attempts Monitor Button and Dropdown */}
          {currentUser?.role === 'admin' && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSecurityDropdownOpen(!securityDropdownOpen)}
                title="مراقبة محاولات تسجيل الدخول والأمان السحابي"
                aria-label="محاولات تسجيل الدخول"
                className={`p-1.5 sm:px-2 sm:py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 relative cursor-pointer border whitespace-nowrap ${
                  failedCount > 0
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
              >
                <ShieldAlert className={`w-4 h-4 shrink-0 ${failedCount > 0 ? 'text-rose-600 animate-pulse' : 'text-amber-500'}`} />
                <span className="hidden 2xl:inline">محاولات الدخول</span>
                {loginAttempts.length > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black ${
                      failedCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-900 text-amber-300'
                    }`}
                  >
                    {loginAttempts.length}
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                  </span>
                )}
              </button>

              {/* Security Attempts Dropdown Modal */}
              {securityDropdownOpen && (
                <>
                  <div
                    role="presentation"
                    onClick={() => setSecurityDropdownOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:left-0 sm:mt-2 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 z-50 text-xs space-y-3 animate-in fade-in zoom-in-95 duration-150">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 border border-amber-200 dark:border-amber-700">
                          <ShieldAlert className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                            محاولات تسجيل الدخول للأمان
                          </h4>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            مراقبة حية لمحاولات الدخول (كلمة السر وGoogle) ولقطات الكاميرا
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold">
                        تحديث سحابي فوري
                      </span>
                    </div>

                    {/* Quick Stats Pill */}
                    <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 dark:bg-slate-850 rounded-xl text-center text-[10px]">
                      <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-2xs">
                        <span className="block text-slate-400">الإجمالي</span>
                        <span className="font-bold font-mono text-slate-800 dark:text-slate-100 text-xs">
                          {loginAttempts.length}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-2xs">
                        <span className="block text-emerald-600 dark:text-emerald-400 font-medium">ناجحة</span>
                        <span className="font-bold font-mono text-emerald-700 dark:text-emerald-300 text-xs">
                          {successCount}
                        </span>
                      </div>
                      <div className="p-1 rounded-lg bg-white dark:bg-slate-800 shadow-2xs">
                        <span className="block text-rose-600 dark:text-rose-400 font-medium">فاشلة/ملغاة</span>
                        <span className="font-bold font-mono text-rose-700 dark:text-rose-300 text-xs">
                          {failedCount}
                        </span>
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSecurityFilter('all')}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          securityFilter === 'all'
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        الكل ({loginAttempts.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSecurityFilter('success')}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          securityFilter === 'success'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-emerald-600'
                        }`}
                      >
                        الناجحة ({successCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSecurityFilter('failed')}
                        className={`flex-1 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                          securityFilter === 'failed'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'text-slate-500 hover:text-rose-600'
                        }`}
                      >
                        المحاولات ({failedCount})
                      </button>
                    </div>

                    {/* Attempts List */}
                    <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5">
                      {filteredAttempts.length === 0 ? (
                        <div className="py-8 text-center text-slate-400">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-1.5 opacity-80" />
                          <p className="text-xs font-semibold">لا توجد محاولات تسجيل دخول مسجلة حالياً.</p>
                        </div>
                      ) : (
                        filteredAttempts.map((att) => {
                          const isSuccess = att.status === 'success';
                          const isCancelled = att.status === 'cancelled';
                          const isBlocked = att.status === 'blocked';

                          return (
                            <div
                              key={att.id}
                              className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 transition-all ${
                                isSuccess
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800'
                                  : isCancelled
                                  ? 'bg-amber-50/60 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  {isSuccess ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  ) : isCancelled ? (
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  ) : (
                                    <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                  )}
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {att.userName || att.email}
                                  </span>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                    isSuccess
                                      ? 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200'
                                      : isCancelled
                                      ? 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                                      : 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200'
                                  }`}
                                >
                                  {att.statusArabic}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 gap-1">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  الدور المطلوب: {att.attemptedRole === 'admin' ? 'المدير العام' : 'بائع المتجر'}
                                </span>
                                <span className="font-mono text-slate-500">
                                  {att.date} · {att.time}
                                </span>
                              </div>

                              {att.email && att.email !== 'غير محدد / مجهول' && (
                                <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate">
                                  📧 {att.email}
                                </div>
                              )}

                              {att.deviceInfo && (
                                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                  <Laptop className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{att.deviceInfo}</span>
                                </div>
                              )}

                              {(() => {
                                const snapshot = att.snapshotId
                                  ? snapshotsMap[att.snapshotId]
                                  : undefined;
                                if (snapshot?.imageDataUrl) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSecurityDropdownOpen(false);
                                        onNavigate?.('audit');
                                      }}
                                      className="w-full flex items-center gap-2.5 p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
                                    >
                                      <img
                                        src={snapshot.imageDataUrl}
                                        alt={`لقطة ${att.userName}`}
                                        className="w-12 h-9 rounded-md object-cover border border-amber-400/70 shrink-0"
                                      />
                                      <div className="text-right">
                                        <span className="block font-bold text-amber-300 text-[10px]">
                                          📷 تم التقاط لقطة أمان بالكاميرا
                                        </span>
                                        <span className="block text-[9px] text-slate-300">
                                          اضغط لفتح المعاينة في السجل الأمني
                                        </span>
                                      </div>
                                    </button>
                                  );
                                }
                                return (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-[10px]">
                                    <Camera className="w-3 h-3 shrink-0" />
                                    <span>{getSnapshotStatusArabic(att.snapshotStatus)}</span>
                                  </div>
                                );
                              })()}

                              {att.errorMessage && (
                                <div className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-900/40 p-1.5 rounded-lg">
                                  السبب: {att.errorMessage}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      {onClearLoginAttempts && loginAttempts.length > 0 && (
                        confirmClearAttempts ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isClearingAttempts}
                              onClick={async () => {
                                setIsClearingAttempts(true);
                                await onClearLoginAttempts().catch(console.warn);
                                setIsClearingAttempts(false);
                                setConfirmClearAttempts(false);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-bold cursor-pointer"
                            >
                              تأكيد المسح
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmClearAttempts(false)}
                              className="px-2 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isClearingAttempts}
                            onClick={() => setConfirmClearAttempts(true)}
                            className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>مسح السجل</span>
                          </button>
                        )
                      )}

                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => {
                            setSecurityDropdownOpen(false);
                            onNavigate('audit');
                          }}
                          className="mr-auto px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          عرض سجل العمليات الكامل
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => toggleAndroidKeyboardDrawer()}
            title="لوحة مفاتيح أندرويد المدمجة للكتابة السريعة"
            aria-label="فتح لوحة مفاتيح أندرويد"
            className="p-1.5 sm:p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
          >
            <Keyboard className="w-4 h-4 text-amber-600" />
            <span className="hidden 2xl:inline">كيبورد</span>
          </button>

          <button
            type="button"
            onClick={onOpenCalculator}
            title="الآلة الحاسبة السريعة"
            aria-label="فتح الآلة الحاسبة"
            className="hidden md:flex p-1.5 sm:p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors items-center gap-1.5 text-xs font-semibold cursor-pointer shrink-0"
          >
            <Calculator className="w-4 h-4 text-slate-600" />
            <span className="hidden 2xl:inline">الحاسبة</span>
          </button>

          {(settings.isPinLocked || !!settings.pinCode) && (
            <button
              type="button"
              onClick={onLockScreen}
              title="قفل الشاشة برمز الأمان"
              aria-label="قفل الشاشة"
              className="p-1.5 sm:p-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <Lock className="w-4 h-4 text-slate-600" />
            </button>
          )}

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={onQuickSale}
            className="hidden sm:flex items-center gap-1 sm:gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white bg-teal-700 hover:bg-teal-800 dark:text-slate-950 dark:bg-amber-500 dark:hover:bg-amber-400 rounded-lg transition-colors shadow-xs whitespace-nowrap shrink-0 cursor-pointer"
          >
            <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 dark:text-slate-950" />
            <span>
              بيع جديد <span className="hidden xl:inline">(F2)</span>
            </span>
          </button>

          {/* Current User Profile Dropdown */}
          {currentUser && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-label="قائمة الحساب الشخصي"
                className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 cursor-pointer"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                    currentUser.avatarColor || 'bg-slate-800 text-white'
                  }`}
                >
                  {currentUser.fullName.charAt(0)}
                </div>
                <div className="text-right hidden xl:block leading-tight pr-0.5">
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[110px]">
                    {currentUser.fullName.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    {currentUser.roleNameArabic}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {/* Dropdown Menu */}
              {userDropdownOpen && (
                <>
                  <div
                    role="presentation"
                    onClick={() => setUserDropdownOpen(false)}
                    className="fixed inset-0 z-40"
                  />
                  <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:left-0 sm:mt-2 sm:w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-xs space-y-3">
                    <div className="border-b border-slate-100 pb-2.5">
                      <span className="font-bold text-slate-900 block text-sm">
                        {currentUser.fullName}
                      </span>
                      <div className={`mt-1 flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg font-bold border ${
                        currentUser.role === 'admin'
                          ? 'text-amber-900 bg-amber-50 border-amber-200/90'
                          : currentUser.role === 'salesperson'
                          ? 'text-sky-900 bg-sky-50 border-sky-200/90'
                          : 'text-emerald-900 bg-emerald-50 border-emerald-200/90'
                      }`}>
                        <Shield className={`w-3.5 h-3.5 shrink-0 ${
                          currentUser.role === 'admin' ? 'text-amber-600' : currentUser.role === 'salesperson' ? 'text-sky-600' : 'text-emerald-600'
                        }`} />
                        <span>{currentUser.role === 'admin' ? 'المدير العام والمالك (كامل الصلاحيات)' : currentUser.roleNameArabic}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[11px] text-slate-600">
                      <div className="flex items-center justify-between font-medium">
                        <span>نوع النظام:</span>
                        <span className="font-bold text-slate-900">محاسبي خاص ومغلق</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>قاعدة البيانات:</span>
                        <span className="font-bold text-emerald-700">Firestore سحابية</span>
                      </div>
                      <div className="flex items-center justify-between font-medium">
                        <span>حالة المزامنة:</span>
                        <span className="font-bold text-emerald-600">متصل ولحظي</span>
                      </div>
                    </div>

                    {/* Logout button */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center justify-center gap-2 p-2 rounded-xl text-rose-700 hover:bg-rose-50 font-bold transition-colors cursor-pointer"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>تسجيل الخروج السحابي</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
