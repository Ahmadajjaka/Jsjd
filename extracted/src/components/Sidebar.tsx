import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Boxes,
  Receipt,
  Users,
  Building2,
  Wallet,
  BarChart3,
  CalendarDays,
  FileClock,
  Settings,
  Shield,
  X,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Calculator,
  Sun,
  Moon,
} from 'lucide-react';
import { AppUser, PermissionKey } from '../types/accounting';
import { hasPermission } from '../utils/permissions';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen: boolean;
  onClose: () => void;
  lowStockCount: number;
  pendingRequestsCount?: number;
  currentUser: AppUser | null;
  onOpenCalculator?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen,
  onClose,
  lowStockCount,
  pendingRequestsCount = 0,
  currentUser,
  onOpenCalculator,
  theme = 'light',
  onToggleTheme,
}) => {
  const allMenuItems: {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    permission?: PermissionKey;
    badge?: number;
    tag?: string;
  }[] = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
    {
      id: 'ai',
      label: 'مستشار الذكاء الاصطناعي',
      icon: Sparkles,
      tag: 'Qwen 3.8',
    },
    {
      id: 'ledger',
      label: 'دفتر الحسابات واليومية',
      icon: BookOpen,
      permission: 'sales_view',
      tag: 'الدفتر 📖',
    },
    { id: 'sales', label: 'دفتر المبيعات والفواتير', icon: ShoppingCart, permission: 'sales_view' },
    { id: 'purchases', label: 'دفتر المشتريات والتوريد', icon: Truck, permission: 'purchases_view' },
    {
      id: 'inventory',
      label: 'إدارة المخزون والمستودع',
      icon: Boxes,
      permission: 'inventory_view',
      badge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    { id: 'expenses', label: 'دفتر المصروفات اليومية', icon: Receipt, permission: 'expenses_view' },
    { id: 'customers', label: 'حسابات الزبائن والديون', icon: Users, permission: 'customers_view' },
    { id: 'suppliers', label: 'حسابات الموردين والدفعات', icon: Building2, permission: 'suppliers_view' },
    { id: 'cashbox', label: 'دفتر الصندوق والمالية', icon: Wallet, permission: 'cashbox_view' },
    { id: 'reports', label: 'التقارير المالية والأرباح', icon: BarChart3, permission: 'reports_view' },
    { id: 'archive', label: 'الأرشيف الشهري والسنوي', icon: CalendarDays, permission: 'archive_view' },
    { id: 'audit', label: 'سجل الحركات والتدقيق', icon: FileClock, permission: 'audit_view' },
    {
      id: 'users',
      label: 'إدارة المستخدمين والصلاحيات',
      icon: Shield,
      permission: 'users_manage',
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    { id: 'settings', label: 'إعدادات المتجر والنظام', icon: Settings, permission: 'settings_manage' },
  ];

  // Filter menu items by user permissions
  const menuItems = allMenuItems.filter((item) => {
    if (!item.permission) return true;
    return hasPermission(currentUser, item.permission);
  });

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          role="presentation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 right-0 z-50 w-64 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)] lg:shrink-0 lg:z-10 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Top Header in Sidebar */}
        <div className="flex items-center justify-between h-14 px-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-2 h-5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm font-black text-slate-900 dark:text-white tracking-wide">
              نظام خردوات المامو
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-amber-50 text-amber-950 border border-amber-300/90 dark:bg-amber-500 dark:text-slate-950 dark:border-amber-400 shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-amber-700 dark:text-slate-950' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {item.tag && (
                    <span
                      className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono font-bold ${
                        isActive
                          ? 'bg-amber-600 text-white dark:bg-slate-950 dark:text-amber-300'
                          : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30'
                      }`}
                    >
                      {item.tag}
                    </span>
                  )}
                  {item.badge !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
                        isActive
                          ? 'bg-amber-700 text-white dark:bg-slate-950 dark:text-amber-400'
                          : 'bg-rose-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </nav>

        {/* Mobile Android Quick Tools (Calculator, Theme) */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            {onOpenCalculator && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenCalculator();
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>الحاسبة</span>
              </button>
            )}
            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>نهاري</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-teal-700" />
                    <span>ليلي</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 text-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            دفتر حسابات إلكتروني دائم 2026
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            النسخة التجارية <span className="font-mono">1.0</span>
          </p>
        </div>
      </aside>
    </>
  );
};
