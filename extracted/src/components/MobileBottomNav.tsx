import React from 'react';
import {
  BookOpen,
  Boxes,
  LayoutDashboard,
  Menu,
  ShoppingCart,
} from 'lucide-react';
import { AppUser } from '../types/accounting';
import { hasPermission } from '../utils/permissions';

interface MobileBottomNavProps {
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenSidebar: () => void;
  lowStockCount: number;
  currentUser: AppUser | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  onOpenSidebar,
  lowStockCount,
  currentUser,
}) => {
  const canSales = hasPermission(currentUser, 'sales_view');
  const canInventory = hasPermission(currentUser, 'inventory_view');

  return (
    <nav
      aria-label="شريط التنقل السريع للهاتف"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-pb print:hidden"
    >
      <div className="grid grid-cols-5 items-center max-w-lg mx-auto px-1 pt-1">
        {/* 1. Dashboard */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
            activeTab === 'dashboard'
              ? 'text-amber-600 dark:text-amber-400 font-black'
              : 'text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">الرئيسية</span>
        </button>

        {/* 2. Ledger Book */}
        {canSales ? (
          <button
            type="button"
            onClick={() => onNavigate('ledger')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'ledger'
                ? 'text-amber-600 dark:text-amber-400 font-black'
                : 'text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الدفتر</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'ai'
                ? 'text-amber-600 dark:text-amber-400 font-black'
                : 'text-slate-500 dark:text-slate-400 font-semibold'
            }`}
          >
            <BookOpen className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">المستشار</span>
          </button>
        )}

        {/* 3. Center Primary POS / Quick Sale Button */}
        <button
          type="button"
          onClick={() => onNavigate(canSales ? 'sales' : 'dashboard')}
          aria-label="بيع جديد F2"
          className="flex flex-col items-center justify-center -mt-3 cursor-pointer"
        >
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border-2 transition-transform active:scale-95 ${
              activeTab === 'sales'
                ? 'bg-amber-500 text-slate-950 border-amber-300'
                : 'bg-teal-700 dark:bg-amber-500 text-amber-300 dark:text-slate-950 border-white dark:border-slate-800'
            }`}
          >
            <ShoppingCart className="w-5 h-5" />
          </div>
          <span
            className={`text-[10px] mt-0.5 font-black ${
              activeTab === 'sales'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            بيع جديد
          </span>
        </button>

        {/* 4. Inventory */}
        {canInventory ? (
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'inventory'
                ? 'text-amber-600 dark:text-amber-400 font-black'
                : 'text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Boxes className="w-5 h-5" />
            {lowStockCount > 0 && (
              <span className="absolute top-1 left-1/2 translate-x-1.5 px-1 min-w-[16px] h-4 rounded-full bg-rose-600 text-white text-[9px] font-mono font-black flex items-center justify-center">
                {lowStockCount}
              </span>
            )}
            <span className="text-[10px] mt-0.5">المخزون</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-500 dark:text-slate-400 font-semibold cursor-pointer"
          >
            <Boxes className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">الأقسام</span>
          </button>
        )}

        {/* 5. More / Full Menu Drawer */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label="فتح القائمة الكاملة"
          className="flex flex-col items-center justify-center py-1.5 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:text-slate-900 dark:hover:text-white cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">المزيد</span>
        </button>
      </div>
    </nav>
  );
};
