/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  WifiOff,
  CloudUpload,
  Lock,
  UserCheck,
  Ban,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { SalesView } from './components/SalesView';
import { PurchasesView } from './components/PurchasesView';
import { InventoryView } from './components/InventoryView';
import { ExpensesView } from './components/ExpensesView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { CashBoxView } from './components/CashBoxView';
import { ReportsView } from './components/ReportsView';
import { ArchiveView } from './components/ArchiveView';
import { AuditView } from './components/AuditView';
import { SettingsView } from './components/SettingsView';
import { UsersManagementView } from './components/UsersManagementView';
import { AiAssistantView } from './components/AiAssistantView';
import { LedgerBookView } from './components/LedgerBookView';
import { LoginScreen } from './components/LoginScreen';
import { InvoiceModal } from './components/InvoiceModal';
import { QuickCalculator } from './components/QuickCalculator';
import { LockScreen } from './components/LockScreen';
import { MobileBottomNav } from './components/MobileBottomNav';
import { SecurityPermissionsBanner } from './components/SecurityPermissionsBanner';
import { AndroidSoftKeyboardBar } from './components/AndroidSoftKeyboardBar';
import { initAndroidKeyboardBridge } from './utils/androidKeyboard';

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
  PermissionKey,
  Product,
  PurchaseInvoice,
  SaleInvoice,
  StoreSettings,
  Supplier,
  SupplierPayment,
  UserRole,
} from './types/accounting';
import {
  AppState,
  clearToCleanSlate,
  loadAppState,
  resetToDemoData,
  saveAppState,
} from './utils/storage';
import {
  getCurrentTimeString,
  getTodayDateString,
  computeFinancialSummary,
} from './utils/accounting';
import { resolveInitialTheme } from './utils/welcome3d';
import {
  hasPermission,
  ROLE_NAMES_ARABIC,
  ROLE_PRESET_PERMISSIONS,
  WRITE_PERMISSION_KEYS,
} from './utils/permissions';
import {
  validateFirestoreConnection,
  seedFirestoreIfEmpty,
  subscribeToFirestoreStore,
  clearAllFirestoreData,
  clearAllLoginAttemptsFromFirestore,
  purgeMockDataFromFirestore,
  onAuthUserChanged,
  logoutFirebaseUser,
  signInWithGoogleAccount,
  SUPER_ADMIN_EMAIL,
  isFirebaseAuthActive,
  calculateStorageUsage,
  compressExistingCloudDatabase,
} from './services/firebaseSync';
import {
  clearAllSecuritySnapshots,
  getOutbox,
  getSecuritySnapshot,
  loadCachedSessionSync,
  loadStateFromLocalDB,
  replaceOutbox,
  saveCachedSession,
  saveStateToLocalDB,
} from './services/localDatabase';
import {
  flushOutboxToCloud,
  getSyncStatusSnapshot,
  queueAndSyncDelete,
  queueAndSyncUpsert,
  queueFullStateSync,
  subscribeToSyncStatus,
  SyncStatusSnapshot,
} from './services/syncEngine';

export default function App() {
  const [appState, setAppState] = useState<AppState>(() => {
    const base = loadAppState();
    const cachedSession = loadCachedSessionSync();
    return {
      ...base,
      currentUser: cachedSession.user || base.currentUser,
    };
  });
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return false;
    }
    if (loadCachedSessionSync().user) {
      return false;
    }
    return true;
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatusSnapshot>(() =>
    getSyncStatusSnapshot()
  );
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [previewingInvoice, setPreviewingInvoice] = useState<SaleInvoice | null>(null);
  const [inventoryInitialFilter, setInventoryInitialFilter] = useState<string | undefined>();
  const [salesInitialTab, setSalesInitialTab] = useState<'create' | 'list' | 'aggregate'>('create');
  const [customersInitialId, setCustomersInitialId] = useState<string | undefined>();
  const [suppliersInitialId, setSuppliersInitialId] = useState<string | undefined>();
  const [blockedLoginMessage, setBlockedLoginMessage] = useState<string>('');

  // Day / Night Theme State with LocalStorage persistence
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_theme');
      const prefersDark = Boolean(
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      );
      return resolveInitialTheme(saved, prefersDark);
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  useEffect(() => {
    return initAndroidKeyboardBridge();
  }, []);

  const handleToggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  // Real-time security alert notification for Admin
  const [activeSecurityAlert, setActiveSecurityAlert] = useState<LoginAttempt | null>(null);
  const [activeSecurityAlertPhoto, setActiveSecurityAlertPhoto] = useState<string | null>(null);
  const prevAttemptsCountRef = useRef(appState.loginAttempts?.length || 0);

  // Real-time incoming access request notification for Admin
  const [activeAccessRequestAlert, setActiveAccessRequestAlert] =
    useState<LoginAccessRequest | null>(null);
  const prevPendingReqCountRef = useRef(
    (appState.accessRequests || []).filter((r) => r.status === 'pending').length
  );

  useEffect(() => {
    const attempts = appState.loginAttempts || [];
    // If the current logged-in user is admin and a new login attempt just arrived
    if (appState.currentUser?.role === 'admin' && attempts.length > prevAttemptsCountRef.current) {
      const latest = attempts[0];
      // If it happened in the last 60 seconds
      if (latest && Date.now() - latest.timestamp < 60000) {
        setActiveSecurityAlert(latest);
        const timer = setTimeout(() => {
          setActiveSecurityAlert(null);
        }, 9000);
        prevAttemptsCountRef.current = attempts.length;
        return () => clearTimeout(timer);
      }
    }
    prevAttemptsCountRef.current = attempts.length;
  }, [appState.loginAttempts, appState.currentUser?.role]);

  useEffect(() => {
    if (!activeSecurityAlert?.snapshotId) {
      setActiveSecurityAlertPhoto(null);
      return;
    }
    let active = true;
    getSecuritySnapshot(activeSecurityAlert.snapshotId)
      .then((rec) => {
        if (active) setActiveSecurityAlertPhoto(rec?.imageDataUrl || null);
      })
      .catch(() => {
        if (active) setActiveSecurityAlertPhoto(null);
      });
    return () => {
      active = false;
    };
  }, [activeSecurityAlert?.snapshotId]);

  useEffect(() => {
    const pendingReqs = (appState.accessRequests || []).filter((r) => r.status === 'pending');
    if (
      appState.currentUser?.role === 'admin' &&
      pendingReqs.length > prevPendingReqCountRef.current
    ) {
      const latest = [...pendingReqs].sort((a, b) => b.timestamp - a.timestamp)[0];
      if (latest) {
        setActiveAccessRequestAlert(latest);
      }
    }
    prevPendingReqCountRef.current = pendingReqs.length;
  }, [appState.accessRequests, appState.currentUser?.role]);

  const pendingRequestsCount = useMemo(
    () => (appState.accessRequests || []).filter((r) => r.status === 'pending').length,
    [appState.accessRequests]
  );

  // Today & Month summaries for AI Assistant and Dashboards
  const todayStr = getTodayDateString();
  const firstDayOfMonth = todayStr.substring(0, 7) + '-01';

  const todaySummary = useMemo(() => {
    return computeFinancialSummary({
      startDate: todayStr,
      endDate: todayStr,
      sales: appState.sales,
      purchases: appState.purchases,
      expenses: appState.expenses,
      products: appState.products,
      customers: appState.customers,
      suppliers: appState.suppliers,
      cashTransactions: appState.cashTransactions,
      customerPayments: appState.customerPayments,
      supplierPayments: appState.supplierPayments,
      initialCash: appState.settings.initialCash || 0,
      periodLabel: 'ملخص اليوم',
    });
  }, [appState, todayStr]);

  const monthSummary = useMemo(() => {
    return computeFinancialSummary({
      startDate: firstDayOfMonth,
      endDate: todayStr,
      sales: appState.sales,
      purchases: appState.purchases,
      expenses: appState.expenses,
      products: appState.products,
      customers: appState.customers,
      suppliers: appState.suppliers,
      cashTransactions: appState.cashTransactions,
      customerPayments: appState.customerPayments,
      supplierPayments: appState.supplierPayments,
      initialCash: appState.settings.initialCash || 0,
      periodLabel: 'ملخص الشهر الحالي',
    });
  }, [appState, firstDayOfMonth, todayStr]);

  const storageInfo = useMemo(() => {
    return calculateStorageUsage(appState);
  }, [appState]);

  // Subscribe to offline-first Sync Engine status
  useEffect(() => {
    return subscribeToSyncStatus((snap) => {
      setSyncStatus(snap);
    });
  }, []);

  // Hydrate richer state from IndexedDB on initial boot if available
  useEffect(() => {
    loadStateFromLocalDB()
      .then((idbState) => {
        if (!idbState) return;
        setAppState((prev) => {
          const idbTotalDocs =
            (idbState.sales?.length || 0) +
            (idbState.products?.length || 0) +
            (idbState.customers?.length || 0) +
            (idbState.expenses?.length || 0);
          const prevTotalDocs =
            (prev.sales?.length || 0) +
            (prev.products?.length || 0) +
            (prev.customers?.length || 0) +
            (prev.expenses?.length || 0);

          if (idbTotalDocs > prevTotalDocs) {
            return {
              ...prev,
              ...idbState,
              currentUser: prev.currentUser,
            };
          }
          return prev;
        });
      })
      .catch(() => {});
  }, []);

  // Helper to queue mutation in IndexedDB outbox and sync to Firestore when online
  const syncToCloud = useCallback((collectionName: string, id: string, data: any) => {
    queueAndSyncUpsert(collectionName, id, data).catch((err) => {
      console.warn(`Local outbox queue note (${collectionName}):`, err);
    });
  }, []);

  // Helper to queue deletion in IndexedDB outbox and delete from Firestore when online
  const deleteFromCloud = useCallback((collectionName: string, id: string) => {
    queueAndSyncDelete(collectionName, id).catch((err) => {
      console.warn(`Local outbox delete note (${collectionName}):`, err);
    });
  }, []);

  // 1. Firebase Authentication state listener (with offline continuity & timeout safeguard)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setAuthLoading(false);
    }, 2000);

    const unsubAuth = onAuthUserChanged((user, isAuthorized) => {
      clearTimeout(safetyTimer);
      setAuthLoading(false);
      if (isAuthorized && user) {
        setAppState((prev) => ({
          ...prev,
          currentUser: user,
        }));
      } else {
        const cached = loadCachedSessionSync();
        if (cached.user && (cached.mode === 'offline' || (typeof navigator !== 'undefined' && !navigator.onLine))) {
          setAppState((prev) => ({
            ...prev,
            currentUser: prev.currentUser || cached.user,
          }));
        } else {
          setAppState((prev) => ({
            ...prev,
            currentUser: null,
          }));
        }
      }
    });

    return () => {
      clearTimeout(safetyTimer);
      unsubAuth();
    };
  }, []);

  // 2. Initialize Firestore connection, flush pending offline outbox, and subscribe to real-time cloud updates
  useEffect(() => {
    if (!appState.currentUser) return;

    // Only subscribe to Cloud Firestore if actively signed in via Firebase Auth
    if (!isFirebaseAuthActive()) {
      return;
    }

    // Flush any queued offline mutations before/alongside cloud subscription
    flushOutboxToCloud().catch(console.warn);

    validateFirestoreConnection()
      .then((ok) => {
        if (ok) {
          seedFirestoreIfEmpty()
            .then(() => purgeMockDataFromFirestore())
            .catch(console.warn);
        }
      })
      .catch(console.warn);

    const unsubscribe = subscribeToFirestoreStore((applyRemote) => {
      setAppState((prev) => ({
        ...prev,
        ...applyRemote(prev),
      }));
    });

    return () => unsubscribe();
  }, [appState.currentUser?.id, syncStatus.isFirebaseAuthenticated]);

  // Auto-persist on state change to both localStorage and IndexedDB local database
  useEffect(() => {
    saveAppState(appState);
    saveStateToLocalDB(appState).catch(() => {});
  }, [appState]);

  // Global hotkeys (e.g. F2 for quick sale)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('sales');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Current Cash Balance from latest cash transaction
  const cashBalance = useMemo(() => {
    if (appState.cashTransactions.length === 0) {
      return appState.settings.initialCash || 0;
    }
    return appState.cashTransactions[appState.cashTransactions.length - 1].runningBalance;
  }, [appState.cashTransactions, appState.settings.initialCash]);

  // Count low stock items for sidebar badge
  const lowStockCount = useMemo(() => {
    return appState.products.filter((p) => p.currentStock <= p.minStock).length;
  }, [appState.products]);

  // Helper to append an audit log
  const createAuditLog = useCallback(
    (action: string, entityType: AuditLog['entityType'], entityId: string, details: string): AuditLog => {
      return {
        id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date: getTodayDateString(),
        time: getCurrentTimeString(),
        action,
        entityType,
        entityId,
        details,
        userId: appState.currentUser?.id,
        userName: appState.currentUser?.fullName,
      };
    },
    [appState.currentUser]
  );

  // Helper to add a cash transaction with running balance calculation
  const appendCashTx = (
    currentTxList: CashTransaction[],
    tx: Omit<CashTransaction, 'id' | 'runningBalance'>
  ): CashTransaction[] => {
    const lastBalance =
      currentTxList.length > 0
        ? currentTxList[currentTxList.length - 1].runningBalance
        : appState.settings.initialCash || 0;

    const newRunningBalance =
      tx.flow === 'in' ? lastBalance + tx.amount : lastBalance - tx.amount;

    const newTx: CashTransaction = {
      ...tx,
      id: `ctx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      runningBalance: Math.round(newRunningBalance * 100) / 100,
    };

    return [...currentTxList, newTx];
  };

  // 1. Save Sale Invoice (POS / Sales desk)
  const handleSaveSale = (invoice: SaleInvoice, newCustomer?: Customer) => {
    setAppState((prev) => {
      // 1. Deduct products stock and update lastSaleDate
      const updatedProducts = prev.products.map((prod) => {
        const itemSold = invoice.items.find((it) => it.productId === prod.id);
        if (itemSold) {
          const updated = {
            ...prod,
            currentStock: Math.max(0, prod.currentStock - itemSold.quantity),
            lastSaleDate: invoice.date,
          };
          syncToCloud('products', updated.id, updated);
          return updated;
        }
        return prod;
      });

      // 2. Update Customers
      let updatedCustomers = [...prev.customers];
      if (newCustomer) {
        updatedCustomers.push(newCustomer);
        syncToCloud('customers', newCustomer.id, newCustomer);
      } else if (!invoice.isCashCustomer && invoice.customerId) {
        updatedCustomers = updatedCustomers.map((cust) => {
          if (cust.id === invoice.customerId) {
            const updated = {
              ...cust,
              totalPurchases: cust.totalPurchases + invoice.total,
              totalPaid: cust.totalPaid + invoice.paidAmount,
              totalDebt: cust.totalDebt + invoice.remainingAmount,
            };
            syncToCloud('customers', updated.id, updated);
            return updated;
          }
          return cust;
        });
      }

      // 3. Update CashBox ONLY with actual paid amount
      let updatedCashTx = prev.cashTransactions;
      if (invoice.paidAmount > 0) {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: invoice.date,
          time: invoice.time,
          type: 'sale_receipt',
          description: `مقبوضات مبيعات من فاتورة ${invoice.invoiceNumber} (${invoice.customerName})`,
          flow: 'in',
          amount: invoice.paidAmount,
          referenceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      // 4. Audit Log
      const log = createAuditLog(
        'إصدار فاتورة بيع',
        'sale',
        invoice.invoiceNumber,
        `بيع بقيمة ${invoice.total} للزبون ${invoice.customerName} (المقبوض: ${invoice.paidAmount}، المتبقي دين: ${invoice.remainingAmount}).`
      );
      syncToCloud('audit_logs', log.id, log);

      // 5. Cloud Sync Invoice
      syncToCloud('sales', invoice.id, invoice);

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        sales: [...prev.sales, invoice],
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 2. Return / Cancel Sale Invoice
  const handleReturnSale = (invoiceId: string, reason: string) => {
    setAppState((prev) => {
      const inv = prev.sales.find((s) => s.id === invoiceId);
      if (!inv || inv.status === 'returned') return prev;

      // Restore items to stock
      const updatedProducts = prev.products.map((prod) => {
        const itemSold = inv.items.find((it) => it.productId === prod.id);
        if (itemSold) {
          const updated = {
            ...prod,
            currentStock: prod.currentStock + itemSold.quantity,
          };
          syncToCloud('products', updated.id, updated);
          return updated;
        }
        return prod;
      });

      // Reverse customer debt if applicable
      const updatedCustomers = prev.customers.map((cust) => {
        if (cust.id === inv.customerId) {
          const updated = {
            ...cust,
            totalPurchases: Math.max(0, cust.totalPurchases - inv.total),
            totalPaid: Math.max(0, cust.totalPaid - inv.paidAmount),
            totalDebt: Math.max(0, cust.totalDebt - inv.remainingAmount),
          };
          syncToCloud('customers', updated.id, updated);
          return updated;
        }
        return cust;
      });

      // Refund paid cash from box
      let updatedCashTx = prev.cashTransactions;
      if (inv.paidAmount > 0) {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: getTodayDateString(),
          time: getCurrentTimeString(),
          type: 'sale_return_refund',
          description: `إرجاع مبيعات نقداً لفاتورة ${inv.invoiceNumber} (السبب: ${reason})`,
          flow: 'out',
          amount: inv.paidAmount,
          referenceId: inv.id,
          referenceNumber: inv.invoiceNumber,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      // Update invoice status
      const updatedSales = prev.sales.map((s) => {
        if (s.id === invoiceId) {
          const updated = {
            ...s,
            status: 'returned' as const,
            returnReason: reason,
            returnedAt: getTodayDateString(),
          };
          syncToCloud('sales', updated.id, updated);
          return updated;
        }
        return s;
      });

      const log = createAuditLog(
        'إرجاع فاتورة بيع',
        'sale',
        inv.invoiceNumber,
        `تم إرجاع الفاتورة ${inv.invoiceNumber} وإعادة البضاعة للمستودع وعكس المبالغ النقدية والديون. السبب: ${reason}`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        sales: updatedSales,
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 2b. Delete Sale Invoice permanently from Cloud and local state
  const handleDeleteSale = (invoiceId: string) => {
    setAppState((prev) => {
      const inv = prev.sales.find((s) => s.id === invoiceId);
      if (!inv) return prev;

      deleteFromCloud('sales', invoiceId);

      const log = createAuditLog(
        'حذف فاتورة مبيعات من قاعدة البيانات',
        'sale',
        inv.invoiceNumber,
        `تم مسح الفاتورة رقم ${inv.invoiceNumber} للعميل ${inv.customerName} بقيمة ${inv.total} نهائياً من قاعدة البيانات السحابية.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        sales: prev.sales.filter((s) => s.id !== invoiceId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 3. Save Purchase Invoice
  const handleSavePurchase = (invoice: PurchaseInvoice, newSupplier?: Supplier) => {
    setAppState((prev) => {
      // Increase product stock & update cost price
      const updatedProducts = prev.products.map((prod) => {
        const itemBought = invoice.items.find((it) => it.productId === prod.id);
        if (itemBought) {
          const updated = {
            ...prod,
            currentStock: prod.currentStock + itemBought.quantity,
            costPrice: itemBought.costPrice,
            lastPurchaseDate: invoice.date,
          };
          syncToCloud('products', updated.id, updated);
          return updated;
        }
        return prod;
      });

      // Update suppliers
      let updatedSuppliers = [...prev.suppliers];
      if (newSupplier) {
        updatedSuppliers.push(newSupplier);
        syncToCloud('suppliers', newSupplier.id, newSupplier);
      } else if (invoice.supplierId) {
        updatedSuppliers = updatedSuppliers.map((supp) => {
          if (supp.id === invoice.supplierId) {
            const updated = {
              ...supp,
              totalPurchases: supp.totalPurchases + invoice.total,
              totalPaid: supp.totalPaid + invoice.paidAmount,
              totalDebt: supp.totalDebt + invoice.remainingAmount,
            };
            syncToCloud('suppliers', updated.id, updated);
            return updated;
          }
          return supp;
        });
      }

      // Deduct ONLY paid cash from cashbox
      let updatedCashTx = prev.cashTransactions;
      if (invoice.paidAmount > 0) {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: invoice.date,
          time: invoice.time,
          type: 'supplier_payment',
          description: `مدفوعات مشتريات للمورد ${invoice.supplierName} (مستند ${invoice.invoiceNumber})`,
          flow: 'out',
          amount: invoice.paidAmount,
          referenceId: invoice.id,
          referenceNumber: invoice.invoiceNumber,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      const log = createAuditLog(
        'تسجيل فاتورة شراء بضاعة',
        'purchase',
        invoice.invoiceNumber,
        `شراء بضاعة بقيمة ${invoice.total} من المورد ${invoice.supplierName} (المدفوع: ${invoice.paidAmount}، المتبقي دين علينا: ${invoice.remainingAmount}).`
      );
      syncToCloud('audit_logs', log.id, log);

      // Cloud sync purchase invoice
      syncToCloud('purchases', invoice.id, invoice);

      return {
        ...prev,
        products: updatedProducts,
        suppliers: updatedSuppliers,
        purchases: [...prev.purchases, invoice],
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 3b. Delete Purchase Invoice permanently from Cloud and local state
  const handleDeletePurchase = (purchaseId: string) => {
    setAppState((prev) => {
      const inv = prev.purchases.find((p) => p.id === purchaseId);
      if (!inv) return prev;

      deleteFromCloud('purchases', purchaseId);

      const log = createAuditLog(
        'حذف فاتورة مشتريات من قاعدة البيانات',
        'purchase',
        inv.invoiceNumber,
        `تم مسح فاتورة المشتريات رقم ${inv.invoiceNumber} للمورد ${inv.supplierName} بقيمة ${inv.total} نهائياً من قاعدة البيانات السحابية.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        purchases: prev.purchases.filter((p) => p.id !== purchaseId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 4. Save Expense
  const handleSaveExpense = (expense: Expense) => {
    setAppState((prev) => {
      let updatedCashTx = prev.cashTransactions;
      if (expense.paymentMethod === 'cash') {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: expense.date,
          time: expense.time,
          type: 'expense',
          description: `مصروف تشغيلي: ${expense.category} - ${expense.description}`,
          flow: 'out',
          amount: expense.amount,
          referenceId: expense.id,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      const log = createAuditLog(
        'تسجيل مصروف تشغيلي',
        'expense',
        expense.id,
        `صرف ${expense.amount} لبند ${expense.category} (${expense.description}).`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('expenses', expense.id, expense);

      return {
        ...prev,
        expenses: [...prev.expenses, expense],
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 5. Delete Expense
  const handleDeleteExpense = (expenseId: string) => {
    setAppState((prev) => {
      const exp = prev.expenses.find((e) => e.id === expenseId);
      if (!exp) return prev;

      deleteFromCloud('expenses', expenseId);

      const log = createAuditLog(
        'حذف مصروف',
        'expense',
        expenseId,
        `تم حذف المصروف «${exp.description}» بقيمة ${exp.amount}.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 6. Record Customer Payment («قبض دفعة من زبون»)
  const handleRecordCustomerPayment = (payment: CustomerPayment) => {
    setAppState((prev) => {
      const updatedCustomers = prev.customers.map((c) => {
        if (c.id === payment.customerId) {
          const updated = {
            ...c,
            totalPaid: c.totalPaid + payment.amount,
            totalDebt: Math.max(0, c.totalDebt - payment.amount),
          };
          syncToCloud('customers', updated.id, updated);
          return updated;
        }
        return c;
      });

      let updatedCashTx = prev.cashTransactions;
      if (payment.paymentMethod === 'cash') {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: payment.date,
          time: payment.time,
          type: 'customer_payment',
          description: `سند قبض دين من الزبون ${payment.customerName} (${payment.paymentNumber})`,
          flow: 'in',
          amount: payment.amount,
          referenceId: payment.id,
          referenceNumber: payment.paymentNumber,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      const log = createAuditLog(
        'سند قبض دفعة زبون',
        'customer',
        payment.paymentNumber,
        `قبض مبلغ ${payment.amount} من الزبون ${payment.customerName} لتسديد دينه وتوريدها للصندوق.`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('customer_payments', payment.id, payment);

      return {
        ...prev,
        customers: updatedCustomers,
        customerPayments: [...prev.customerPayments, payment],
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 7. Record Supplier Payment («سداد دفعة لمورد»)
  const handleRecordSupplierPayment = (payment: SupplierPayment) => {
    setAppState((prev) => {
      const updatedSuppliers = prev.suppliers.map((s) => {
        if (s.id === payment.supplierId) {
          const updated = {
            ...s,
            totalPaid: s.totalPaid + payment.amount,
            totalDebt: Math.max(0, s.totalDebt - payment.amount),
          };
          syncToCloud('suppliers', updated.id, updated);
          return updated;
        }
        return s;
      });

      let updatedCashTx = prev.cashTransactions;
      if (payment.paymentMethod === 'cash') {
        updatedCashTx = appendCashTx(updatedCashTx, {
          date: payment.date,
          time: payment.time,
          type: 'supplier_payment',
          description: `سند صرف سداد دين للمورد ${payment.supplierName} (${payment.paymentNumber})`,
          flow: 'out',
          amount: payment.amount,
          referenceId: payment.id,
          referenceNumber: payment.paymentNumber,
        });
        const latestTx = updatedCashTx[updatedCashTx.length - 1];
        if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);
      }

      const log = createAuditLog(
        'سند صرف دفعة مورد',
        'supplier',
        payment.paymentNumber,
        `سداد مبلغ ${payment.amount} للمورد ${payment.supplierName} وخصمها من الصندوق.`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('supplier_payments', payment.id, payment);

      return {
        ...prev,
        suppliers: updatedSuppliers,
        supplierPayments: [...prev.supplierPayments, payment],
        cashTransactions: updatedCashTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 8. Adjust Stock (تعديل المخزون عند الجرد)
  const handleAdjustStock = (adjustment: InventoryAdjustment) => {
    setAppState((prev) => {
      const updatedProducts = prev.products.map((p) => {
        if (p.id === adjustment.productId) {
          const updated = {
            ...p,
            currentStock: adjustment.newStock,
          };
          syncToCloud('products', updated.id, updated);
          return updated;
        }
        return p;
      });

      const log = createAuditLog(
        'تسوية رصيد جرد مخزني',
        'product',
        adjustment.productCode,
        `تعديل رصيد المادة «${adjustment.productName}» من ${adjustment.oldStock} إلى ${adjustment.newStock} (فرق ${adjustment.difference}). السبب: ${adjustment.reason} - ${adjustment.notes}`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('inventory_adjustments', adjustment.id, adjustment);

      return {
        ...prev,
        products: updatedProducts,
        inventoryAdjustments: [...prev.inventoryAdjustments, adjustment],
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 9. Save Product
  const handleSaveProduct = (product: Product) => {
    setAppState((prev) => {
      const exists = prev.products.some((p) => p.id === product.id);
      const updatedProducts = exists
        ? prev.products.map((p) => (p.id === product.id ? product : p))
        : [...prev.products, product];

      const log = createAuditLog(
        exists ? 'تعديل بيانات مادة' : 'إضافة مادة جديدة',
        'product',
        product.code,
        `المادة: ${product.name} (التصنيف: ${product.category}، سعر البيع: ${product.sellingPrice})`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('products', product.id, product);

      return {
        ...prev,
        products: updatedProducts,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 10. Delete Product
  const handleDeleteProduct = (productId: string) => {
    setAppState((prev) => {
      const p = prev.products.find((prod) => prod.id === productId);
      if (!p) return prev;

      deleteFromCloud('products', productId);

      const log = createAuditLog(
        'حذف مادة من المستودع',
        'product',
        p.code,
        `تم حذف المادة «${p.name}» من المستودع.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        products: prev.products.filter((prod) => prod.id !== productId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 11. Save Customer
  const handleSaveCustomer = (customer: Customer) => {
    setAppState((prev) => {
      const log = createAuditLog(
        'إضافة زبون جديد',
        'customer',
        customer.id,
        `الزبون: ${customer.name} (دين افتتاحي: ${customer.totalDebt})`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('customers', customer.id, customer);

      return {
        ...prev,
        customers: [...prev.customers, customer],
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 11b. Delete Customer permanently from Cloud
  const handleDeleteCustomer = (customerId: string) => {
    setAppState((prev) => {
      const cust = prev.customers.find((c) => c.id === customerId);
      if (!cust) return prev;

      deleteFromCloud('customers', customerId);

      const log = createAuditLog(
        'حذف حساب زبون',
        'customer',
        customerId,
        `تم حذف حساب الزبون «${cust.name}» نهائياً من قاعدة البيانات.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        customers: prev.customers.filter((c) => c.id !== customerId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 12. Save Supplier
  const handleSaveSupplier = (supplier: Supplier) => {
    setAppState((prev) => {
      const log = createAuditLog(
        'إضافة مورد جديد',
        'supplier',
        supplier.id,
        `المورد: ${supplier.name} (${supplier.company || ''})`
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('suppliers', supplier.id, supplier);

      return {
        ...prev,
        suppliers: [...prev.suppliers, supplier],
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 12b. Delete Supplier permanently from Cloud
  const handleDeleteSupplier = (supplierId: string) => {
    setAppState((prev) => {
      const supp = prev.suppliers.find((s) => s.id === supplierId);
      if (!supp) return prev;

      deleteFromCloud('suppliers', supplierId);

      const log = createAuditLog(
        'حذف حساب مورد',
        'supplier',
        supplierId,
        `تم حذف حساب المورد «${supp.name}» نهائياً من قاعدة البيانات.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        suppliers: prev.suppliers.filter((s) => s.id !== supplierId),
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 13. Direct Cash Transaction (Capital / Withdrawal / Reconciliation)
  const handleAddDirectCashTransaction = (
    txData: Omit<CashTransaction, 'id' | 'runningBalance'>
  ) => {
    setAppState((prev) => {
      const updatedTx = appendCashTx(prev.cashTransactions, txData);
      const latestTx = updatedTx[updatedTx.length - 1];
      if (latestTx) syncToCloud('cash_transactions', latestTx.id, latestTx);

      const log = createAuditLog(
        'حركة نقدية بالصندوق',
        'cash',
        txData.type,
        `${txData.description} بمبلغ ${txData.amount} (${txData.flow === 'in' ? 'داخل' : 'خارج'}).`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        cashTransactions: updatedTx,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 13b. Delete Cash Transaction permanently from Cloud
  const handleDeleteCashTransaction = (txId: string) => {
    setAppState((prev) => {
      const tx = prev.cashTransactions.find((t) => t.id === txId);
      if (!tx) return prev;

      deleteFromCloud('cash_transactions', txId);

      // Filter and recalculate running balances
      const filtered = prev.cashTransactions.filter((t) => t.id !== txId);
      let running = prev.settings.initialCash || 0;
      const recalculated = filtered.map((t) => {
        running = t.flow === 'in' ? running + t.amount : running - t.amount;
        return {
          ...t,
          runningBalance: Math.round(running * 100) / 100,
        };
      });

      const log = createAuditLog(
        'حذف حركة نقدية من الصندوق',
        'cash',
        txId,
        `تم حذف الحركة النقدية «${tx.description}» بمبلغ ${tx.amount} نهائياً من قاعدة البيانات.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        cashTransactions: recalculated,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 14. Update Settings
  const handleUpdateSettings = (newSettings: StoreSettings) => {
    setAppState((prev) => {
      const log = createAuditLog(
        'تعديل إعدادات المتجر',
        'settings',
        'store',
        'تم حفظ التعديلات على إعدادات المتجر ونصوص الفواتير والعملة.'
      );
      syncToCloud('audit_logs', log.id, log);
      syncToCloud('store_settings', 'main', newSettings);

      return {
        ...prev,
        settings: newSettings,
        auditLogs: [...prev.auditLogs, log],
      };
    });
  };

  // 15. Restore Backup (and queue full cloud sync)
  const handleRestoreBackup = (restoredState: AppState) => {
    setAppState(restoredState);
    queueFullStateSync(restoredState).catch(console.warn);
  };

  // 16. Reset Demo Data
  const handleResetDemoData = () => {
    const d = resetToDemoData();
    setAppState(d);
  };

  // 17. Clear to clean slate
  const handleClearCleanSlate = () => {
    const c = clearToCleanSlate(true);
    setAppState(c);
  };

  // 17b. Completely Clear and Empty Firebase Cloud Firestore Database
  const handleClearCloudDatabase = async () => {
    try {
      await clearAllFirestoreData();
      const c = clearToCleanSlate(true);
      setAppState(c);
    } catch (err) {
      console.warn('Error clearing cloud database:', err);
      const c = clearToCleanSlate(true);
      setAppState(c);
    }
  };

  // 18. User Authentication and RBAC handlers
  const handleLogin = (user: AppUser) => {
    const updatedUser: AppUser = {
      ...user,
      lastLogin: `${getTodayDateString()} ${getCurrentTimeString()}`,
    };
    const isGoogleAuth = isFirebaseAuthActive();
    saveCachedSession(updatedUser, isGoogleAuth ? 'google' : 'offline').catch(() => {});

    setAppState((prev) => ({
      ...prev,
      currentUser: updatedUser,
      users: prev.users.map((u) => (u.id === user.id ? updatedUser : u)),
      auditLogs: [
        createAuditLog(
          'تسجيل دخول',
          'settings',
          user.id,
          `قام المستخدم «${user.fullName}» (${user.roleNameArabic}) بتسجيل الدخول للنظام (${
            isGoogleAuth ? 'متصل' : 'وضع أوفلاين محلي'
          }).`
        ),
        ...prev.auditLogs,
      ],
    }));
  };

  const handleLogout = async () => {
    const current = appState.currentUser;
    await saveCachedSession(null, 'google').catch(() => {});
    await logoutFirebaseUser().catch(console.warn);
    setAppState((prev) => ({
      ...prev,
      currentUser: null,
      auditLogs: current
        ? [
            createAuditLog(
              'تسجيل خروج',
              'settings',
              current.id,
              `قام المستخدم «${current.fullName}» بتسجيل الخروج من النظام.`
            ),
            ...prev.auditLogs,
          ]
        : prev.auditLogs,
    }));
  };

  const handleManualSync = async () => {
    await flushOutboxToCloud();
  };

  const handleConnectGoogleForSync = async () => {
    try {
      const rolePref = appState.currentUser?.role === 'admin' ? 'admin' : 'salesperson';
      const { appUser } = await signInWithGoogleAccount(
        rolePref,
        appState.currentUser?.fullName
      );
      await saveCachedSession(appUser, 'google');
      setAppState((prev) => ({
        ...prev,
        currentUser: appUser,
      }));
      await flushOutboxToCloud();
    } catch (err) {
      console.warn('Google connect for sync note:', err);
    }
  };

  const handleSwitchUser = (targetUser: AppUser) => {
    handleLogin(targetUser);
  };

  const handleSaveUser = (user: AppUser) => {
    syncToCloud('users', user.id, user);
    setAppState((prev) => {
      const exists = prev.users.some((u) => u.id === user.id);
      const updatedUsers = exists
        ? prev.users.map((u) => (u.id === user.id ? user : u))
        : [...prev.users, user];

      const isCurrent = prev.currentUser?.id === user.id;
      const log = createAuditLog(
        exists ? 'تعديل مستخدم وصلاحيات' : 'إضافة مستخدم جديد',
        'settings',
        user.id,
        exists
          ? `تم تحديث بيانات وصلاحيات المستخدم «${user.fullName}» (${user.roleNameArabic}).`
          : `تم إنشاء حساب مستخدم جديد «${user.fullName}» بدور (${user.roleNameArabic}).`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        users: updatedUsers,
        currentUser: isCurrent ? user : prev.currentUser,
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  };

  const handleDeleteUser = (userId: string) => {
    deleteFromCloud('users', userId);
    setAppState((prev) => {
      const userToDelete = prev.users.find((u) => u.id === userId);
      const log = createAuditLog(
        'حذف مستخدم',
        'settings',
        userId,
        `تم حذف حساب المستخدم «${userToDelete?.fullName || userId}» من النظام.`
      );
      syncToCloud('audit_logs', log.id, log);

      return {
        ...prev,
        users: prev.users.filter((u) => u.id !== userId),
        auditLogs: [log, ...prev.auditLogs],
      };
    });
  };

  // 18b. Incoming Access Request & Moderation Handlers (Approve / Reject / Ban / Restrict)
  const handleSubmitAccessRequest = useCallback(
    (req: LoginAccessRequest) => {
      syncToCloud('access_requests', req.id, req);
      setAppState((prev) => {
        const exists = (prev.accessRequests || []).some((r) => r.id === req.id);
        const updatedRequests = exists
          ? (prev.accessRequests || []).map((r) => (r.id === req.id ? req : r))
          : [req, ...(prev.accessRequests || [])];

        return {
          ...prev,
          accessRequests: updatedRequests,
        };
      });
    },
    [syncToCloud]
  );

  const handleApproveAccessRequest = useCallback(
    (requestId: string, assignedRole?: UserRole, assignedPermissions?: PermissionKey[]) => {
      setAppState((prev) => {
        const req = (prev.accessRequests || []).find((r) => r.id === requestId);
        if (!req) return prev;

        const role: UserRole = assignedRole || req.requestedRole || 'salesperson';
        const perms =
          assignedPermissions && assignedPermissions.length > 0
            ? assignedPermissions
            : ROLE_PRESET_PERMISSIONS[role] || ROLE_PRESET_PERMISSIONS.salesperson;
        const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;

        const updatedReq: LoginAccessRequest = {
          ...req,
          status: 'approved',
          assignedRole: role,
          assignedPermissions: perms,
          isReadOnly: false,
          restrictionNote: undefined,
          decisionReason: undefined,
          reviewedBy: prev.currentUser?.fullName || 'المدير العام',
          reviewedAt: nowStr,
        };
        syncToCloud('access_requests', updatedReq.id, updatedReq);

        const targetUserId = req.uid || `user-${req.id}`;
        const existingUser = prev.users.find(
          (u) =>
            u.id === targetUserId ||
            (req.email && u.email && u.email.toLowerCase() === req.email.toLowerCase()) ||
            (req.username && u.username.toLowerCase() === req.username.toLowerCase())
        );

        const approvedUser: AppUser = {
          ...(existingUser || {
            id: targetUserId,
            username: req.username || req.email.split('@')[0] || `staff_${Date.now()}`,
            password: '',
            createdAt: getTodayDateString(),
          }),
          email: req.email || existingUser?.email,
          fullName: req.fullName,
          role,
          roleNameArabic: ROLE_NAMES_ARABIC[role] || req.requestedRoleArabic,
          permissions: perms,
          isActive: true,
          accessStatus: 'approved',
          isReadOnly: false,
          restrictionNote: undefined,
          avatarColor: existingUser?.avatarColor || 'bg-sky-600 text-white font-bold',
        };
        syncToCloud('users', approvedUser.id, approvedUser);

        const updatedUsers = existingUser
          ? prev.users.map((u) => (u.id === existingUser.id ? approvedUser : u))
          : [...prev.users, approvedUser];

        const log = createAuditLog(
          'قبول طلب تسجيل دخول',
          'settings',
          req.id,
          `وافق المدير العام على دخول المستخدم «${req.fullName}» بصلاحية (${approvedUser.roleNameArabic}).`
        );
        syncToCloud('audit_logs', log.id, log);

        setActiveAccessRequestAlert((cur) => (cur?.id === requestId ? null : cur));

        return {
          ...prev,
          accessRequests: (prev.accessRequests || []).map((r) =>
            r.id === requestId ? updatedReq : r
          ),
          users: updatedUsers,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleRestrictAccessRequest = useCallback(
    (
      requestId: string,
      permissions: PermissionKey[],
      isReadOnly: boolean,
      restrictionNote: string
    ) => {
      setAppState((prev) => {
        const req = (prev.accessRequests || []).find((r) => r.id === requestId);
        if (!req) return prev;

        const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
        const effectivePerms = isReadOnly
          ? permissions.filter((p) => !WRITE_PERMISSION_KEYS.includes(p))
          : permissions;
        const safePerms: PermissionKey[] =
          effectivePerms.length > 0 ? effectivePerms : ['sales_view'];

        const updatedReq: LoginAccessRequest = {
          ...req,
          status: 'restricted',
          assignedRole: 'custom',
          assignedPermissions: safePerms,
          isReadOnly,
          restrictionNote: restrictionNote || 'حساب مقيد العمل من قبل الآدمن',
          reviewedBy: prev.currentUser?.fullName || 'المدير العام',
          reviewedAt: nowStr,
        };
        syncToCloud('access_requests', updatedReq.id, updatedReq);

        const targetUserId = req.uid || `user-${req.id}`;
        const existingUser = prev.users.find(
          (u) =>
            u.id === targetUserId ||
            (req.email && u.email && u.email.toLowerCase() === req.email.toLowerCase()) ||
            (req.username && u.username.toLowerCase() === req.username.toLowerCase())
        );

        const restrictedUser: AppUser = {
          ...(existingUser || {
            id: targetUserId,
            username: req.username || req.email.split('@')[0] || `staff_${Date.now()}`,
            password: '',
            createdAt: getTodayDateString(),
          }),
          email: req.email || existingUser?.email,
          fullName: req.fullName,
          role: 'custom',
          roleNameArabic: isReadOnly ? 'مستخدم مقيد (قراءة فقط)' : 'مستخدم مقيد الصلاحيات',
          permissions: safePerms,
          isActive: true,
          accessStatus: 'restricted',
          isReadOnly,
          restrictionNote: updatedReq.restrictionNote,
          restrictedBy: prev.currentUser?.fullName || 'المدير العام',
          restrictedAt: nowStr,
          avatarColor: 'bg-amber-600 text-white font-bold',
        };
        syncToCloud('users', restrictedUser.id, restrictedUser);

        const updatedUsers = existingUser
          ? prev.users.map((u) => (u.id === existingUser.id ? restrictedUser : u))
          : [...prev.users, restrictedUser];

        const log = createAuditLog(
          'تقييد عمل مستخدم',
          'settings',
          req.id,
          `تم تقييد صلاحيات «${req.fullName}» (${safePerms.length} صلاحيات${
            isReadOnly ? ' · وضع القراءة فقط' : ''
          }).`
        );
        syncToCloud('audit_logs', log.id, log);

        setActiveAccessRequestAlert((cur) => (cur?.id === requestId ? null : cur));

        return {
          ...prev,
          accessRequests: (prev.accessRequests || []).map((r) =>
            r.id === requestId ? updatedReq : r
          ),
          users: updatedUsers,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleRejectAccessRequest = useCallback(
    (requestId: string, reason?: string) => {
      setAppState((prev) => {
        const req = (prev.accessRequests || []).find((r) => r.id === requestId);
        if (!req) return prev;

        const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
        const decisionReason = reason || 'تم رفض طلب تسجيل الدخول من قبل المدير العام.';
        const updatedReq: LoginAccessRequest = {
          ...req,
          status: 'rejected',
          decisionReason,
          reviewedBy: prev.currentUser?.fullName || 'المدير العام',
          reviewedAt: nowStr,
        };
        syncToCloud('access_requests', updatedReq.id, updatedReq);

        const updatedUsers = prev.users.map((u) => {
          const match =
            (req.uid && u.id === req.uid) ||
            (req.email && u.email && u.email.toLowerCase() === req.email.toLowerCase()) ||
            (req.username && u.username.toLowerCase() === req.username.toLowerCase());
          if (match && u.role !== 'admin') {
            const rejectedUser: AppUser = {
              ...u,
              isActive: false,
              accessStatus: 'rejected',
              restrictionNote: decisionReason,
            };
            syncToCloud('users', rejectedUser.id, rejectedUser);
            return rejectedUser;
          }
          return u;
        });

        const log = createAuditLog(
          'رفض طلب تسجيل دخول',
          'settings',
          req.id,
          `تم رفض طلب دخول «${req.fullName}»: ${decisionReason}`
        );
        syncToCloud('audit_logs', log.id, log);

        setActiveAccessRequestAlert((cur) => (cur?.id === requestId ? null : cur));

        return {
          ...prev,
          accessRequests: (prev.accessRequests || []).map((r) =>
            r.id === requestId ? updatedReq : r
          ),
          users: updatedUsers,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleBanAccessRequest = useCallback(
    (requestId: string, reason?: string) => {
      setAppState((prev) => {
        const req = (prev.accessRequests || []).find((r) => r.id === requestId);
        if (!req) return prev;

        const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
        const decisionReason = reason || 'تم حظر هذا الحساب نهائياً من الدخول إلى النظام.';
        const updatedReq: LoginAccessRequest = {
          ...req,
          status: 'banned',
          decisionReason,
          restrictionNote: decisionReason,
          reviewedBy: prev.currentUser?.fullName || 'المدير العام',
          reviewedAt: nowStr,
        };
        syncToCloud('access_requests', updatedReq.id, updatedReq);

        const targetUserId = req.uid || `user-${req.id}`;
        const existingUser = prev.users.find(
          (u) =>
            u.id === targetUserId ||
            (req.email && u.email && u.email.toLowerCase() === req.email.toLowerCase()) ||
            (req.username && u.username.toLowerCase() === req.username.toLowerCase())
        );

        const bannedUser: AppUser = {
          ...(existingUser || {
            id: targetUserId,
            username: req.username || req.email.split('@')[0] || `banned_${Date.now()}`,
            password: '',
            role: req.requestedRole || 'salesperson',
            roleNameArabic: req.requestedRoleArabic,
            permissions: [],
            createdAt: getTodayDateString(),
          }),
          email: req.email || existingUser?.email,
          fullName: req.fullName,
          isActive: false,
          accessStatus: 'banned',
          restrictionNote: decisionReason,
        };
        syncToCloud('users', bannedUser.id, bannedUser);

        const updatedUsers = existingUser
          ? prev.users.map((u) => (u.id === existingUser.id ? bannedUser : u))
          : [...prev.users, bannedUser];

        const log = createAuditLog(
          'حظر مستخدم وطلب دخول',
          'settings',
          req.id,
          `تم حظر «${req.fullName}» ومنعه من الدخول: ${decisionReason}`
        );
        syncToCloud('audit_logs', log.id, log);

        setActiveAccessRequestAlert((cur) => (cur?.id === requestId ? null : cur));

        return {
          ...prev,
          accessRequests: (prev.accessRequests || []).map((r) =>
            r.id === requestId ? updatedReq : r
          ),
          users: updatedUsers,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleDeleteAccessRequest = useCallback(
    (requestId: string) => {
      deleteFromCloud('access_requests', requestId);
      setAppState((prev) => ({
        ...prev,
        accessRequests: (prev.accessRequests || []).filter((r) => r.id !== requestId),
      }));
    },
    [deleteFromCloud]
  );

  const handleBanUser = useCallback(
    (userId: string, reason?: string) => {
      setAppState((prev) => {
        const target = prev.users.find((u) => u.id === userId);
        if (!target || target.role === 'admin') return prev;
        const banReason = reason || 'تم حظر حسابك من قبل المدير العام.';

        const updatedUser: AppUser = {
          ...target,
          isActive: false,
          accessStatus: 'banned',
          restrictionNote: banReason,
        };
        syncToCloud('users', updatedUser.id, updatedUser);

        const updatedRequests = (prev.accessRequests || []).map((r) => {
          const match =
            r.uid === target.id ||
            (target.email && r.email.toLowerCase() === target.email.toLowerCase()) ||
            (r.username && r.username.toLowerCase() === target.username.toLowerCase());
          if (match) {
            const nextReq: LoginAccessRequest = {
              ...r,
              status: 'banned',
              decisionReason: banReason,
              restrictionNote: banReason,
            };
            syncToCloud('access_requests', nextReq.id, nextReq);
            return nextReq;
          }
          return r;
        });

        const log = createAuditLog(
          'حظر مستخدم',
          'settings',
          target.id,
          `تم حظر المستخدم «${target.fullName}»: ${banReason}`
        );
        syncToCloud('audit_logs', log.id, log);

        return {
          ...prev,
          users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
          accessRequests: updatedRequests,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleUnbanUser = useCallback(
    (userId: string) => {
      setAppState((prev) => {
        const target = prev.users.find((u) => u.id === userId);
        if (!target) return prev;

        const updatedUser: AppUser = {
          ...target,
          isActive: true,
          accessStatus: 'approved',
          isReadOnly: false,
          restrictionNote: undefined,
        };
        syncToCloud('users', updatedUser.id, updatedUser);

        const updatedRequests = (prev.accessRequests || []).map((r) => {
          const match =
            r.uid === target.id ||
            (target.email && r.email.toLowerCase() === target.email.toLowerCase()) ||
            (r.username && r.username.toLowerCase() === target.username.toLowerCase());
          if (match) {
            const nextReq: LoginAccessRequest = {
              ...r,
              status: 'approved',
              decisionReason: undefined,
              restrictionNote: undefined,
              isReadOnly: false,
            };
            syncToCloud('access_requests', nextReq.id, nextReq);
            return nextReq;
          }
          return r;
        });

        const log = createAuditLog(
          'رفع حظر مستخدم',
          'settings',
          target.id,
          `تم رفع الحظر وتفعيل حساب المستخدم «${target.fullName}».`
        );
        syncToCloud('audit_logs', log.id, log);

        return {
          ...prev,
          users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
          accessRequests: updatedRequests,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  const handleRestrictUser = useCallback(
    (
      userId: string,
      permissions: PermissionKey[],
      isReadOnly: boolean,
      restrictionNote: string
    ) => {
      setAppState((prev) => {
        const target = prev.users.find((u) => u.id === userId);
        if (!target || target.role === 'admin') return prev;
        const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;

        const effectivePerms = isReadOnly
          ? permissions.filter((p) => !WRITE_PERMISSION_KEYS.includes(p))
          : permissions;
        const safePerms: PermissionKey[] =
          effectivePerms.length > 0 ? effectivePerms : ['sales_view'];

        const updatedUser: AppUser = {
          ...target,
          role: 'custom',
          roleNameArabic: isReadOnly ? 'مستخدم مقيد (قراءة فقط)' : 'مستخدم مقيد الصلاحيات',
          permissions: safePerms,
          isActive: true,
          accessStatus: 'restricted',
          isReadOnly,
          restrictionNote: restrictionNote || 'حساب مقيد العمل من المدير العام',
          restrictedBy: prev.currentUser?.fullName || 'المدير العام',
          restrictedAt: nowStr,
        };
        syncToCloud('users', updatedUser.id, updatedUser);

        const updatedRequests = (prev.accessRequests || []).map((r) => {
          const match =
            r.uid === target.id ||
            (target.email && r.email.toLowerCase() === target.email.toLowerCase()) ||
            (r.username && r.username.toLowerCase() === target.username.toLowerCase());
          if (match) {
            const nextReq: LoginAccessRequest = {
              ...r,
              status: 'restricted',
              assignedRole: 'custom',
              assignedPermissions: safePerms,
              isReadOnly,
              restrictionNote: updatedUser.restrictionNote,
            };
            syncToCloud('access_requests', nextReq.id, nextReq);
            return nextReq;
          }
          return r;
        });

        const log = createAuditLog(
          'تقييد صلاحيات مستخدم',
          'settings',
          target.id,
          `تم تقييد صلاحيات «${target.fullName}» (${safePerms.length} صلاحيات${
            isReadOnly ? ' · قراءة فقط' : ''
          }).`
        );
        syncToCloud('audit_logs', log.id, log);

        return {
          ...prev,
          users: prev.users.map((u) => (u.id === userId ? updatedUser : u)),
          accessRequests: updatedRequests,
          auditLogs: [log, ...prev.auditLogs],
        };
      });
    },
    [createAuditLog, syncToCloud]
  );

  // Real-time session enforcement: revoke banned/rejected sessions & sync restricted changes live
  useEffect(() => {
    const active = appState.currentUser;
    if (!active || active.role === 'admin') return;

    const matchedUser = appState.users.find(
      (u) =>
        u.id === active.id ||
        (active.email && u.email && u.email.toLowerCase() === active.email.toLowerCase()) ||
        (active.username && u.username.toLowerCase() === active.username.toLowerCase())
    );
    const matchedReq = (appState.accessRequests || []).find(
      (r) =>
        (r.uid && r.uid === active.id) ||
        (active.email && r.email.toLowerCase() === active.email.toLowerCase()) ||
        (r.username && active.username && r.username.toLowerCase() === active.username.toLowerCase())
    );

    const userBlocked =
      matchedUser &&
      (matchedUser.accessStatus === 'banned' ||
        matchedUser.accessStatus === 'rejected' ||
        !matchedUser.isActive);
    const reqBlocked =
      matchedReq && (matchedReq.status === 'banned' || matchedReq.status === 'rejected');

    if (userBlocked || reqBlocked) {
      const msg =
        matchedUser?.restrictionNote ||
        matchedReq?.decisionReason ||
        matchedReq?.restrictionNote ||
        'تم إنهاء جلستك لأن حسابك محظور أو مرفوض من قبل المدير العام.';
      setBlockedLoginMessage(msg);
      saveCachedSession(null, 'google').catch(() => {});
      logoutFirebaseUser().catch(() => {});
      setAppState((prev) => ({
        ...prev,
        currentUser: null,
      }));
      return;
    }

    if (
      matchedUser &&
      (matchedUser.accessStatus !== active.accessStatus ||
        matchedUser.isReadOnly !== active.isReadOnly ||
        matchedUser.restrictionNote !== active.restrictionNote ||
        JSON.stringify(matchedUser.permissions) !== JSON.stringify(active.permissions))
    ) {
      setAppState((prev) => ({
        ...prev,
        currentUser: {
          ...active,
          ...matchedUser,
        },
      }));
    }
  }, [appState.currentUser, appState.users, appState.accessRequests]);

  // Redirect away from unauthorized tab if current user's role does not allow it
  useEffect(() => {
    if (!appState.currentUser) return;
    const tabPermissionMap: Record<string, string> = {
      ledger: 'sales_view',
      sales: 'sales_view',
      purchases: 'purchases_view',
      inventory: 'inventory_view',
      expenses: 'expenses_view',
      customers: 'customers_view',
      suppliers: 'suppliers_view',
      cashbox: 'cashbox_view',
      reports: 'reports_view',
      archive: 'archive_view',
      audit: 'audit_view',
      users: 'users_manage',
      settings: 'settings_manage',
    };
    const reqPerm = tabPermissionMap[activeTab];
    if (reqPerm && !hasPermission(appState.currentUser, reqPerm as any)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, appState.currentUser]);

  // Quick navigation helper
  const handleNavigate = (tab: string, extra?: any) => {
    setInventoryInitialFilter(extra?.filter);
    setCustomersInitialId(extra?.customerId);
    setSuppliersInitialId(extra?.supplierId);
    if (extra?.salesTab) {
      setSalesInitialTab(extra.salesTab);
    } else if (tab === 'sales') {
      setSalesInitialTab('create');
    }
    setActiveTab(tab);
  };

  // Clear all data from Firebase and reset state
  const handleClearAllFirebaseData = async () => {
    try {
      await clearAllFirestoreData();
      const cleanState = clearToCleanSlate();
      setAppState((prev) => ({
        ...cleanState,
        currentUser: prev.currentUser,
      }));
      saveAppState({
        ...cleanState,
        currentUser: null,
      });
    } catch (err: any) {
      console.error('Failed to clear Firebase data:', err);
      throw err;
    }
  };

  // Record security attempt (password/PIN entry + snapshot metadata) into appState immediately
  const handleRecordSecurityAttempt = useCallback(
    (attempt: LoginAttempt) => {
      syncToCloud('login_attempts', attempt.id, attempt);
      setAppState((prev) => {
        const nextAttempts = [
          attempt,
          ...(prev.loginAttempts || []).filter((a) => a.id !== attempt.id),
        ].slice(0, 100);
        return {
          ...prev,
          loginAttempts: nextAttempts,
        };
      });
    },
    [syncToCloud]
  );

  // Clear login attempts and local security snapshots
  const handleClearAllLoginAttempts = useCallback(async () => {
    await clearAllLoginAttemptsFromFirestore().catch(console.warn);
    await clearAllSecuritySnapshots().catch(console.warn);
    try {
      const currentOutbox = await getOutbox();
      const filtered = currentOutbox.filter(
        (item) => item.collectionName !== 'login_attempts'
      );
      if (filtered.length !== currentOutbox.length) {
        await replaceOutbox(filtered);
      }
    } catch {}
    setAppState((prev) => ({
      ...prev,
      loginAttempts: [],
    }));
  }, []);

  // 1. Loading screen while authenticating with Firebase
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-['Cairo',sans-serif]">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 mb-4 shadow-xl animate-pulse">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
            <path d="M17 18h1"/>
            <path d="M12 18h1"/>
            <path d="M7 18h1"/>
          </svg>
        </div>
        <h2 className="text-xl font-bold tracking-tight mb-2">خردوات المامو</h2>
        <p className="text-xs text-slate-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
          جاري التحقق من أمان النظام والاتصال بقاعدة بيانات Firestore...
        </p>
      </div>
    );
  }

  // 2. If no authorized user is logged in, show secure login screen
  if (!appState.currentUser) {
    return (
      <>
        <LoginScreen
          settings={appState.settings}
          users={appState.users}
          accessRequests={appState.accessRequests}
          externalError={blockedLoginMessage}
          onSubmitAccessRequest={handleSubmitAccessRequest}
          onRecordSecurityAttempt={handleRecordSecurityAttempt}
          onLoginSuccess={(user) => {
            setBlockedLoginMessage('');
            handleLogin(user);
          }}
        />
        <AndroidSoftKeyboardBar />
      </>
    );
  }

  return (
    <div className="min-h-dvh overflow-x-clip bg-[#f3f5f8] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-['Cairo',sans-serif] transition-colors duration-200">
      {/* Top Navigation */}
      <Navbar
        settings={appState.settings}
        cashBalance={cashBalance}
        currentUser={appState.currentUser}
        users={appState.users}
        loginAttempts={appState.loginAttempts}
        onClearLoginAttempts={handleClearAllLoginAttempts}
        onOpenCalculator={() => setCalculatorOpen(true)}
        onQuickSale={() => setActiveTab('sales')}
        onLockScreen={() =>
          setAppState((prev) => ({ ...prev, isLocked: true }))
        }
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        onNavigate={handleNavigate}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        syncStatus={syncStatus}
        onManualSync={handleManualSync}
        onConnectGoogleForSync={handleConnectGoogleForSync}
      />

      {/* Non-intrusive Floating Offline / Pending Sync Status Toast */}
      {(!syncStatus.isOnline || (syncStatus.pendingCount > 0 && !syncStatus.isFirebaseAuthenticated)) && (
        <div
          role="status"
          className={`fixed bottom-20 lg:bottom-4 left-3 right-3 sm:right-auto sm:left-4 z-40 flex items-center justify-between sm:justify-start gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold shadow-xl border backdrop-blur-md transition-all ${
            !syncStatus.isOnline
              ? 'bg-amber-500/95 text-slate-950 border-amber-300'
              : 'bg-slate-900/95 text-amber-200 border-amber-500/50'
          }`}
        >
          {!syncStatus.isOnline ? (
            <>
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                وضع بلا إنترنت — القاعدة المحلية نشطة
                {syncStatus.pendingCount > 0
                  ? ` (${syncStatus.pendingCount} عملية بانتظار المزامنة)`
                  : ''}
              </span>
            </>
          ) : (
            <>
              <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                توفر الإنترنت ({syncStatus.pendingCount} عملية محلية جاهزة للرفع)
              </span>
              <button
                type="button"
                onClick={handleConnectGoogleForSync}
                className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] cursor-pointer"
              >
                مزامنة الآن
              </button>
            </>
          )}
        </div>
      )}

      {/* Floating Real-Time Security Alert for Admin */}
      {activeSecurityAlert && appState.currentUser?.role === 'admin' && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm sm:max-w-md w-full p-4 bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-md text-white border-2 border-amber-400/80 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div
                className={`p-2 rounded-xl shrink-0 ${
                  activeSecurityAlert.status === 'success'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {activeSecurityAlert.status === 'success' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 animate-bounce" />
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm text-white">تنبيه أمني فوري للمدير</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      activeSecurityAlert.status === 'success'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
                    {activeSecurityAlert.statusArabic}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  محاولة دخول من:{' '}
                  <strong className="text-amber-300">{activeSecurityAlert.userName}</strong>
                  {activeSecurityAlert.email && activeSecurityAlert.email !== 'غير محدد / مجهول' && (
                    <span> ({activeSecurityAlert.email})</span>
                  )}
                </p>
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>
                    الصفة:{' '}
                    {activeSecurityAlert.attemptedRole === 'admin'
                      ? 'المدير العام'
                      : 'بائع المتجر'}
                  </span>
                  <span>·</span>
                  <span>{activeSecurityAlert.time}</span>
                </div>
                {activeSecurityAlert.deviceInfo && (
                  <p className="text-[10px] text-slate-400 truncate">
                    الجهاز: {activeSecurityAlert.deviceInfo}
                  </p>
                )}
                {activeSecurityAlert.snapshotStatus === 'captured' && (
                  <div className="mt-1.5 flex items-center gap-2">
                    {activeSecurityAlertPhoto && (
                      <img
                        src={activeSecurityAlertPhoto}
                        alt="لقطة أمان بالكاميرا"
                        className="w-12 h-9 rounded-md object-cover border border-amber-400/80 shrink-0"
                      />
                    )}
                    <p className="text-[11px] text-amber-300 font-bold">
                      📷 تم التقاط لقطة أمان بالكاميرا — اضغط للمعاينة
                    </p>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveSecurityAlert(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveSecurityAlert(null);
                handleNavigate('audit');
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              معاينة في سجل الأمان
            </button>
          </div>
        </div>
      )}

      {/* Floating Live Access Request Notification for Admin */}
      {activeAccessRequestAlert && appState.currentUser?.role === 'admin' && (
        <div className="fixed top-20 left-4 z-50 max-w-sm w-full p-4 bg-slate-900/95 backdrop-blur-md text-white border-2 border-amber-400 rounded-2xl shadow-2xl space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="space-y-0.5 text-xs">
                <p className="font-black text-amber-300">طلب تسجيل دخول جديد بانتظار قرارك</p>
                <p className="font-bold text-white">{activeAccessRequestAlert.fullName}</p>
                <p className="text-[11px] text-slate-300">
                  {activeAccessRequestAlert.requestedRoleArabic} ·{' '}
                  <span className="font-mono">{activeAccessRequestAlert.email}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveAccessRequestAlert(null)}
              className="text-slate-400 hover:text-white text-xs p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 pt-2 border-t border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => handleApproveAccessRequest(activeAccessRequestAlert.id)}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
            >
              قبول
            </button>
            <button
              type="button"
              onClick={() => handleBanAccessRequest(activeAccessRequestAlert.id)}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
            >
              <Ban className="w-3 h-3 inline ml-1" />
              حظر
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveAccessRequestAlert(null);
                handleNavigate('users');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
            >
              مراجعة وتقييد
            </button>
          </div>
        </div>
      )}

      {/* Restricted Account Mode Warning Banner */}
      {appState.currentUser?.accessStatus === 'restricted' && (
        <div
          id="restricted-mode-banner"
          className="bg-amber-100 border-b border-amber-300 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2"
        >
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            حسابك يعمل حالياً في وضع مقيد الصلاحيات من قبل المدير العام
            {appState.currentUser.isReadOnly ? ' (قراءة وعرض فقط)' : ''}
            {appState.currentUser.restrictionNote
              ? ` — ${appState.currentUser.restrictionNote}`
              : ''}
          </span>
        </div>
      )}

      <div className="flex-1 flex min-w-0">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setInventoryInitialFilter(undefined);
            setCustomersInitialId(undefined);
            setSuppliersInitialId(undefined);
            setActiveTab(tab);
          }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          lowStockCount={lowStockCount}
          pendingRequestsCount={pendingRequestsCount}
          currentUser={appState.currentUser}
          onOpenCalculator={() => setCalculatorOpen(true)}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Main View Area - Single unified document scroller for Android mobile & Desktop */}
        <main className="flex-1 min-w-0 p-3 sm:p-5 lg:p-6 pb-24 lg:pb-6 max-w-[1600px] w-full mx-auto space-y-4">
          <SecurityPermissionsBanner
            variant="banner"
            enabled={appState.settings.enableSecurityCameraCapture ?? true}
          />
          {activeTab === 'dashboard' && (
            <DashboardView
              state={appState}
              theme={theme}
              onNavigate={handleNavigate}
              onOpenQuickSale={() => setActiveTab('sales')}
              onOpenQuickPurchase={() => setActiveTab('purchases')}
              onOpenQuickExpense={() => setActiveTab('expenses')}
              onOpenCustomerPayment={() => setActiveTab('customers')}
              onOpenSupplierPayment={() => setActiveTab('suppliers')}
              onOpenAddProduct={() => setActiveTab('inventory')}
              onClearFirebaseData={handleClearAllFirebaseData}
              onCompressCloudData={compressExistingCloudDatabase}
              onApproveAccessRequest={handleApproveAccessRequest}
              onRejectAccessRequest={handleRejectAccessRequest}
              onBanAccessRequest={handleBanAccessRequest}
              onRestrictAccessRequest={handleRestrictAccessRequest}
              onRecordSecurityAttempt={handleRecordSecurityAttempt}
            />
          )}

          {activeTab === 'ai' && (
            <AiAssistantView
              state={appState}
              cashBalance={cashBalance}
              onNavigate={handleNavigate}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onSaveSale={handleSaveSale}
              onReturnSale={handleReturnSale}
              onDeleteSale={handleDeleteSale}
              onSavePurchase={handleSavePurchase}
              onDeletePurchase={handleDeletePurchase}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
              onSaveCustomer={handleSaveCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onSaveSupplier={handleSaveSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onRecordCustomerPayment={handleRecordCustomerPayment}
              onRecordSupplierPayment={handleRecordSupplierPayment}
              onAdjustStock={handleAdjustStock}
              onAddCashTransaction={handleAddDirectCashTransaction}
              onDeleteCashTransaction={handleDeleteCashTransaction}
              onUpdateSettings={handleUpdateSettings}
              onPreviewInvoice={(inv) => setPreviewingInvoice(inv)}
              onCompressCloudData={compressExistingCloudDatabase}
              todaySummary={todaySummary}
              monthSummary={monthSummary}
              storageInfo={storageInfo}
            />
          )}

          {activeTab === 'ledger' && (
            <LedgerBookView
              sales={appState.sales}
              expenses={appState.expenses}
              cashTransactions={appState.cashTransactions}
              customerPayments={appState.customerPayments}
              supplierPayments={appState.supplierPayments}
              purchases={appState.purchases}
              customers={appState.customers}
              suppliers={appState.suppliers}
              products={appState.products}
              settings={appState.settings}
              onSaveSale={handleSaveSale}
              onSaveExpense={handleSaveExpense}
              onRecordCustomerPayment={handleRecordCustomerPayment}
              onAddCashTransaction={handleAddDirectCashTransaction}
              onPreviewInvoice={(inv) => setPreviewingInvoice(inv)}
            />
          )}

          {activeTab === 'sales' && (
            <SalesView
              products={appState.products}
              customers={appState.customers}
              sales={appState.sales}
              settings={appState.settings}
              initialTab={salesInitialTab}
              onSaveSale={handleSaveSale}
              onReturnSale={handleReturnSale}
              onPreviewInvoice={(inv) => setPreviewingInvoice(inv)}
              onDeleteSale={handleDeleteSale}
              onNavigateToLedger={() => setActiveTab('ledger')}
            />
          )}

          {activeTab === 'purchases' && (
            <PurchasesView
              products={appState.products}
              suppliers={appState.suppliers}
              purchases={appState.purchases}
              settings={appState.settings}
              onSavePurchase={handleSavePurchase}
              onDeletePurchase={handleDeletePurchase}
            />
          )}

          {activeTab === 'inventory' && (
            <InventoryView
              products={appState.products}
              suppliers={appState.suppliers}
              settings={appState.settings}
              inventoryAdjustments={appState.inventoryAdjustments}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onAdjustStock={handleAdjustStock}
              initialFilter={inventoryInitialFilter}
            />
          )}

          {activeTab === 'expenses' && (
            <ExpensesView
              expenses={appState.expenses}
              settings={appState.settings}
              onSaveExpense={handleSaveExpense}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeTab === 'customers' && (
            <CustomersView
              customers={appState.customers}
              sales={appState.sales}
              customerPayments={appState.customerPayments}
              products={appState.products}
              settings={appState.settings}
              onSaveCustomer={handleSaveCustomer}
              onRecordCustomerPayment={handleRecordCustomerPayment}
              onPreviewInvoice={(inv) => setPreviewingInvoice(inv)}
              onSaveSale={handleSaveSale}
              onDeleteCustomer={handleDeleteCustomer}
              initialCustomerId={customersInitialId}
            />
          )}

          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={appState.suppliers}
              purchases={appState.purchases}
              supplierPayments={appState.supplierPayments}
              settings={appState.settings}
              onSaveSupplier={handleSaveSupplier}
              onRecordSupplierPayment={handleRecordSupplierPayment}
              onDeleteSupplier={handleDeleteSupplier}
              initialSupplierId={suppliersInitialId}
            />
          )}

          {activeTab === 'cashbox' && (
            <CashBoxView
              cashTransactions={appState.cashTransactions}
              settings={appState.settings}
              onAddTransaction={handleAddDirectCashTransaction}
              onDeleteTransaction={handleDeleteCashTransaction}
            />
          )}

          {activeTab === 'reports' && <ReportsView state={appState} />}

          {activeTab === 'archive' && (
            <ArchiveView
              state={appState}
              onPreviewInvoice={(inv) => setPreviewingInvoice(inv)}
            />
          )}

          {activeTab === 'audit' && (
            <AuditView
              auditLogs={appState.auditLogs}
              loginAttempts={appState.loginAttempts}
            />
          )}

          {activeTab === 'users' && (
            <UsersManagementView
              users={appState.users}
              currentUser={appState.currentUser}
              accessRequests={appState.accessRequests || []}
              onSaveUser={handleSaveUser}
              onDeleteUser={handleDeleteUser}
              onApproveAccessRequest={handleApproveAccessRequest}
              onRejectAccessRequest={handleRejectAccessRequest}
              onBanAccessRequest={handleBanAccessRequest}
              onRestrictAccessRequest={handleRestrictAccessRequest}
              onDeleteAccessRequest={handleDeleteAccessRequest}
              onBanUser={handleBanUser}
              onUnbanUser={handleUnbanUser}
              onRestrictUser={handleRestrictUser}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              state={appState}
              onUpdateSettings={handleUpdateSettings}
              onRestoreBackup={handleRestoreBackup}
              onResetDemoData={handleResetDemoData}
              onClearCleanSlate={handleClearCleanSlate}
              onClearCloudDatabase={handleClearCloudDatabase}
              onCompressCloudDatabase={compressExistingCloudDatabase}
            />
          )}
        </main>
      </div>

      {/* Floating Tools / Modals */}
      <QuickCalculator
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
      />

      <InvoiceModal
        invoice={previewingInvoice}
        settings={appState.settings}
        onClose={() => setPreviewingInvoice(null)}
      />

      <LockScreen
        isLocked={appState.isLocked}
        pinCode={appState.settings.pinCode}
        storeName={appState.settings.storeName}
        enableSecurityCameraCapture={appState.settings.enableSecurityCameraCapture ?? true}
        onUnlock={() =>
          setAppState((prev) => ({ ...prev, isLocked: false }))
        }
        onPinAttempt={handleRecordSecurityAttempt}
      />

      {/* Android Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenSidebar={() => setSidebarOpen(true)}
        lowStockCount={lowStockCount}
        currentUser={appState.currentUser}
      />

      {/* Android Built-In Soft Keyboard & System IME Trigger Drawer */}
      <AndroidSoftKeyboardBar />
    </div>
  );
}
