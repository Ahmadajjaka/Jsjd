import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Send,
  Square,
  Copy,
  Check,
  RotateCcw,
  Bot,
  User,
  Cpu,
  TrendingUp,
  AlertTriangle,
  Coins,
  Boxes,
  Users,
  Wallet,
  ArrowUpRight,
  HelpCircle,
  Info,
  Zap,
  Droplets,
  Hammer,
  Package,
  CheckCircle2,
  XCircle,
  Play,
  Calculator,
  PlayCircle,
  Settings,
  Receipt,
} from 'lucide-react';
import { AppState } from '../utils/storage';
import { formatCurrency } from '../utils/accounting';
import {
  parseAiActions,
  executeAiAction,
  AiActionPayload,
  AiActionHandlers,
} from '../utils/aiActionEngine';
import { resolveApiUrl } from '../utils/apkEnvironment';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: string;
  actions?: AiActionPayload[];
}

export interface AiAssistantViewProps {
  state: AppState;
  cashBalance?: number;
  onNavigate: (tab: string, extra?: any) => void;
  onSaveProduct?: (product: any) => void;
  onDeleteProduct?: (productId: string) => void;
  onSaveSale?: (invoice: any, newCustomer?: any) => void;
  onReturnSale?: (invoiceId: string, reason: string) => void;
  onDeleteSale?: (invoiceId: string) => void;
  onSavePurchase?: (invoice: any, newSupplier?: any) => void;
  onDeletePurchase?: (purchaseId: string) => void;
  onSaveExpense?: (expense: any) => void;
  onDeleteExpense?: (expenseId: string) => void;
  onSaveCustomer?: (customer: any) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onSaveSupplier?: (supplier: any) => void;
  onDeleteSupplier?: (supplierId: string) => void;
  onRecordCustomerPayment?: (payment: any) => void;
  onRecordSupplierPayment?: (payment: any) => void;
  onAdjustStock?: (adjustment: any) => void;
  onAddCashTransaction?: (tx: any) => void;
  onDeleteCashTransaction?: (txId: string) => void;
  onUpdateSettings?: (settings: any) => void;
  onPreviewInvoice?: (invoice: any) => void;
  onCompressCloudData?: () => Promise<{
    success: boolean;
    message: string;
    savedBytes?: number;
    documentsCompressed?: number;
  }>;
  todaySummary?: any;
  monthSummary?: any;
  storageInfo?: any;
}

interface PromptCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  prompts: { label: string; text: string }[];
}

const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'actions',
    title: 'تحكم كامل بالمتجر',
    icon: Zap,
    prompts: [
      {
        label: 'إضافة مادة جديدة للمخزون',
        text: 'أضف مادة جديدة باسم قاطع 16 أمبير شنايدر، قسم كهربائية، سعر التكلفة 18000، سعر البيع 24000، كمية 30 قطعة وحد أدنى 5.',
      },
      {
        label: 'إنشاء فاتورة بيع فورية + PDF',
        text: 'أصدر فاتورة بيع لقطعتين من أول مادة متوفرة نقداً مع تجهيز ملف PDF حراري 80 مم.',
      },
      {
        label: 'طباعة آخر فاتورة مبيعات PDF',
        text: 'نزل آخر فاتورة مبيعات بصيغة PDF.',
      },
      {
        label: 'تسجيل مصروف تشغيلي فوري',
        text: 'سجل مصروف اشتراك كهرباء للمحل بقيمة 45000 ل.س.',
      },
      {
        label: 'إضافة زبون جديد للذمم',
        text: 'أضف زبون جديد باسم «ورشة السلام للمقاولات»، هاتف «0944112233».',
      },
      {
        label: 'مراقبة وتدقيق شامل للمتجر',
        text: 'راقب وضع المتجر والمستودع والصندوق والديون الآن.',
      },
      {
        label: 'تعديل إعدادات الطباعة إلى A4',
        text: 'اجعل تخطيط طباعة الفاتورة عادي A4.',
      },
      {
        label: 'ضغط سحابة Firebase (Deflate L9)',
        text: 'اضغط قاعدة بيانات Firebase لتوفير المساحة.',
      },
    ],
  },
  {
    id: 'calculator',
    title: 'حاسبة ذكية ورياضيات',
    icon: Calculator,
    prompts: [
      {
        label: 'حساب عملية مركبة أو خصم',
        text: 'احسب (18500 * 12) + (4200 * 5) - 10%',
      },
      {
        label: 'حساب هامش ونسبة الربح',
        text: 'احسب هامش الربح: سعر التكلفة 18000 وسعر البيع 24000.',
      },
      {
        label: 'حساب رصيد الصندوق والأرباح الآن',
        text: 'كم رصيد الصندوق الحالي وما صافي أرباح اليوم والشهر؟',
      },
      {
        label: 'حساب نسبة مئوية وخصم تجاري',
        text: 'احسب خصم 15% على مبلغ 250000.',
      },
    ],
  },
  {
    id: 'finance',
    title: 'تحليل الأرباح والمالية',
    icon: TrendingUp,
    prompts: [
      {
        label: 'تشخيص الأرباح اليومية والشهرية',
        text: 'حلل لي أداء المبيعات والأرباح الحالية للمتجر، وقدم لي 3 مقترحات فورية لرفع صافي الربح.',
      },
      {
        label: 'تقييم رصيد الصندوق والسيولة',
        text: 'بناءً على رصيد الصندوق الحالي والمبيعات، ما هي نصيحتك لإدارة التدفق النقدي للأيام القادمة؟',
      },
      {
        label: 'تصدير التقرير المالي الشامل PDF',
        text: 'صدر التقرير الشامل للمتجر بصيغة PDF.',
      },
    ],
  },
  {
    id: 'inventory',
    title: 'المستودع والنواقص',
    icon: Boxes,
    prompts: [
      {
        label: 'تقرير المواد التي قاربت على النفاد',
        text: 'ما هي المواد التي وصلت للحد الأدنى في المستودع وما التوصيات للشراء؟',
      },
      {
        label: 'تحليل توزيع التصنيفات الأربعة',
        text: 'حلل لي توزيع المخزون بين التصنيفات الأربعة (كهربائية، صحية، بناء، عامة).',
      },
      {
        label: 'تصدير جرد المستودع PDF',
        text: 'صدر تقرير جرد المخزون بصيغة PDF.',
      },
    ],
  },
  {
    id: 'debts',
    title: 'الديون والعملاء',
    icon: Users,
    prompts: [
      {
        label: 'تحليل ديون الزبائن وأولويات التحصيل',
        text: 'لخص لي وضع ديون الزبائن الحالية ومن يجب التواصل معهم أولاً.',
      },
      {
        label: 'صياغة رسالة تذكير مهذبة بالدين',
        text: 'اكتب لي رسالة واتساب مهذبة لتذكير الزبون بتسديد الرصيد المتبقي.',
      },
    ],
  },
];

const QUICK_CONTROL_CHIPS: { label: string; prompt: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { label: 'حساب سريع', prompt: 'احسب (25000 * 4) - 10%', icon: Calculator },
  { label: 'إضافة مادة', prompt: 'أضف مادة جديدة باسم سلك نحاس 4 مم، قسم كهربائية، تكلفة 35000، بيع 45000، كمية 20 متر', icon: Package },
  { label: 'آخر فاتورة PDF', prompt: 'نزل آخر فاتورة مبيعات بصيغة PDF', icon: Receipt },
  { label: 'رصيد الصندوق والربح', prompt: 'كم رصيد الصندوق الحالي وما صافي الأرباح؟', icon: Wallet },
  { label: 'فحص شامل للمتجر', prompt: 'راقب وضع المتجر والمستودع والديون الآن', icon: Zap },
  { label: 'إعدادات المتجر', prompt: 'افتح الإعدادات', icon: Settings },
];

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  state,
  cashBalance,
  onNavigate,
  onSaveProduct,
  onDeleteProduct,
  onSaveSale,
  onReturnSale,
  onDeleteSale,
  onSavePurchase,
  onDeletePurchase,
  onSaveExpense,
  onDeleteExpense,
  onSaveCustomer,
  onDeleteCustomer,
  onSaveSupplier,
  onDeleteSupplier,
  onRecordCustomerPayment,
  onRecordSupplierPayment,
  onAdjustStock,
  onAddCashTransaction,
  onDeleteCashTransaction,
  onUpdateSettings,
  onPreviewInvoice,
  onCompressCloudData,
  todaySummary,
  monthSummary,
  storageInfo,
}) => {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'welcome-init',
      role: 'assistant',
      content: `أهلاً بك في **المساعد الذكي للتحكم الكامل بمتجر ${state.settings.storeName || 'خردوات المامو'}**!

تستطيع عبر هذه الواجهة التحكم بكل أجزاء المتجر وإجراء أي حساب فوري سواءً أونلاين أو أوفلاين:
- **إدارة المواد والمستودع**: إضافة، تعديل أسعار، تسوية جرد، أو حذف مواد.
- **المبيعات وفواتير PDF**: إنشاء فواتير بيع حقيقية، إرجاع فواتير، وتصدير/طباعة فواتير المبيعات بصيغة PDF (حراري 80 مم أو A4).
- **الحاسبة الذكية والرياضيات**: حساب أي معادلة رياضية، نسب مئوية، هوامش ربح، خصومات، أو أرصدة المتجر الحية.
- **المصروفات والذمم والصندوق والإعدادات**: تسجيل مصروفات، إضافات زبائن وموردين وسندات قبض/صرف، وتحديث إعدادات المتجر.

اكتب طلبك بحرية (مثال: «أضف مادة مسمار صلب 500 750 100» أو «احسب 15000 * 6 - 10%» أو «نزل آخر فاتورة PDF»).`,
      model: 'وحدة التحكم الذكية الشاملة',
      timestamp: 'الآن',
    },
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedFullToast, setCopiedFullToast] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionExecutingId, setActionExecutingId] = useState<string | null>(null);
  const [activeModel, setActiveModel] = useState<string>('نظام التحكم الذكي');
  const [selectedPromptCategory, setSelectedPromptCategory] = useState<string>('actions');

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const liveCashBalance = useMemo(() => {
    if (cashBalance !== undefined) return cashBalance;
    if (state.cashTransactions.length > 0) {
      return state.cashTransactions[state.cashTransactions.length - 1].runningBalance;
    }
    return state.settings.initialCash || 0;
  }, [cashBalance, state.cashTransactions, state.settings.initialCash]);

  const actionHandlers: AiActionHandlers = useMemo(
    () => ({
      onSaveProduct: onSaveProduct || (() => {}),
      onDeleteProduct,
      onSaveSale,
      onReturnSale,
      onDeleteSale,
      onSavePurchase,
      onDeletePurchase,
      onSaveExpense: onSaveExpense || (() => {}),
      onDeleteExpense,
      onSaveCustomer: onSaveCustomer || (() => {}),
      onDeleteCustomer,
      onSaveSupplier: onSaveSupplier || (() => {}),
      onDeleteSupplier,
      onRecordCustomerPayment: onRecordCustomerPayment || (() => {}),
      onRecordSupplierPayment: onRecordSupplierPayment || (() => {}),
      onAdjustStock: onAdjustStock || (() => {}),
      onAddCashTransaction: onAddCashTransaction || (() => {}),
      onDeleteCashTransaction,
      onUpdateSettings,
      onPreviewInvoice,
      onNavigate,
      onCompressCloudData,
      todaySummary,
      monthSummary,
      storageInfo,
      cashBalance: liveCashBalance,
    }),
    [
      onSaveProduct,
      onDeleteProduct,
      onSaveSale,
      onReturnSale,
      onDeleteSale,
      onSavePurchase,
      onDeletePurchase,
      onSaveExpense,
      onDeleteExpense,
      onSaveCustomer,
      onDeleteCustomer,
      onSaveSupplier,
      onDeleteSupplier,
      onRecordCustomerPayment,
      onRecordSupplierPayment,
      onAdjustStock,
      onAddCashTransaction,
      onDeleteCashTransaction,
      onUpdateSettings,
      onPreviewInvoice,
      onNavigate,
      onCompressCloudData,
      todaySummary,
      monthSummary,
      storageInfo,
      liveCashBalance,
    ]
  );

  const handleExecuteAction = async (msgId: string, actionId: string) => {
    const msg = messages.find((m) => m.id === msgId);
    const action = msg?.actions?.find((a) => a.id === actionId);
    if (!action) return;

    setActionExecutingId(actionId);
    try {
      const res = await executeAiAction(action, actionHandlers, state);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            actions: m.actions?.map((a) =>
              a.id === actionId
                ? {
                    ...a,
                    status: res.success ? 'executed' : 'failed',
                    resultMessage: res.message,
                  }
                : a
            ),
          };
        })
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            actions: m.actions?.map((a) =>
              a.id === actionId
                ? {
                    ...a,
                    status: 'failed',
                    resultMessage: err?.message || 'فشل تنفيذ الإجراء',
                  }
                : a
            ),
          };
        })
      );
    } finally {
      setActionExecutingId(null);
    }
  };

  const executeActionsBatch = async (
    msgId: string,
    actionsList: AiActionPayload[]
  ): Promise<{ id: string; status: 'executed' | 'failed'; message: string }[]> => {
    const outcomes: { id: string; status: 'executed' | 'failed'; message: string }[] = [];
    for (const act of actionsList) {
      try {
        const res = await executeAiAction(act, actionHandlers, state);
        outcomes.push({
          id: act.id,
          status: res.success ? 'executed' : 'failed',
          message: res.message,
        });
      } catch (err: any) {
        outcomes.push({
          id: act.id,
          status: 'failed',
          message: err?.message || 'تعذر تنفيذ الإجراء',
        });
      }
    }

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== msgId) return msg;
        return {
          ...msg,
          actions: msg.actions?.map((a) => {
            const match = outcomes.find((o) => o.id === a.id);
            return match
              ? { ...a, status: match.status, resultMessage: match.message }
              : a;
          }),
        };
      })
    );
    return outcomes;
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const storeMetrics = useMemo(() => {
    const totalStockValue = state.products.reduce(
      (sum, p) => sum + p.currentStock * p.costPrice,
      0
    );
    const lowStock = state.products.filter((p) => p.currentStock <= p.minStock);
    const totalSales = state.sales
      .filter((s) => s.status === 'completed')
      .reduce((sum, s) => sum + s.total, 0);
    const totalDebts = state.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
    const totalPayables = state.suppliers.reduce((sum, s) => sum + (s.totalDebt || 0), 0);
    const debtors = state.customers.filter((c) => (c.totalDebt || 0) > 0);

    const catCounts: Record<string, number> = {
      كهربائية: 0,
      صحية: 0,
      بناء: 0,
      عامة: 0,
    };
    state.products.forEach((p) => {
      if (p.category.includes('كهربائ')) catCounts['كهربائية']++;
      else if (p.category.includes('صحي')) catCounts['صحية']++;
      else if (p.category.includes('بناء')) catCounts['بناء']++;
      else catCounts['عامة']++;
    });

    return {
      totalStockValue,
      lowStockCount: lowStock.length,
      lowStockList: lowStock,
      totalSales,
      totalDebts,
      totalPayables,
      debtorsCount: debtors.length,
      topDebtors: debtors.sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5),
      catCounts,
    };
  }, [state]);

  const buildStoreContext = () => {
    return {
      settings: {
        storeName: state.settings.storeName,
        currency: state.settings.currencySymbol,
        invoicePrintLayout: state.settings.invoicePrintLayout || 'thermal80',
        phone: state.settings.phone,
        address: state.settings.address,
      },
      cashBalance: liveCashBalance,
      todaySummary: todaySummary
        ? {
            grossSales: todaySummary.grossSales,
            operatingExpenses: todaySummary.operatingExpenses,
            netOperatingProfit: todaySummary.netOperatingProfit,
          }
        : undefined,
      monthSummary: monthSummary
        ? {
            grossSales: monthSummary.grossSales,
            totalPurchases: monthSummary.totalPurchases,
            operatingExpenses: monthSummary.operatingExpenses,
            netOperatingProfit: monthSummary.netOperatingProfit,
          }
        : undefined,
      totalProductsCount: state.products.length,
      inventoryValuation: storeMetrics.totalStockValue,
      lowStockItemsCount: storeMetrics.lowStockCount,
      productsCatalog: state.products.slice(0, 60).map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        unit: p.unit,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        stock: p.currentStock,
        minStock: p.minStock,
      })),
      customersCount: state.customers.length,
      totalDebtsAmount: storeMetrics.totalDebts,
      customersList: state.customers.slice(0, 35).map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        debt: c.totalDebt,
      })),
      suppliersCount: state.suppliers.length,
      totalPayablesAmount: storeMetrics.totalPayables,
      suppliersList: state.suppliers.slice(0, 25).map((s) => ({
        id: s.id,
        name: s.name,
        company: s.company,
        debt: s.totalDebt,
      })),
      recentSales: state.sales.slice(-15).map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        date: s.date,
        customerName: s.customerName,
        total: s.total,
        paidAmount: s.paidAmount,
        remainingAmount: s.remainingAmount,
        status: s.status,
      })),
      recentExpenses: state.expenses.slice(-10).map((e) => ({
        id: e.id,
        description: e.description,
        category: e.category,
        amount: e.amount,
        date: e.date,
      })),
      categoriesBreakdown: storeMetrics.catCounts,
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputValue).trim();
    if (!query || isStreaming) return;

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMessage: AiMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: activeModel,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMessage];
    setMessages([...nextMessages, initialAssistantMessage]);
    setInputValue('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(resolveApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          storeContext: buildStoreContext(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`خطأ في استجابة الخادم: ${response.status}`);
      }
      if (!response.body) {
        throw new Error('لم يتم استلام تدفق بيانات من الخادم.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';
      let streamErrorOnly = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const dataPayload = trimmed.replace(/^data: /, '').trim();
          if (dataPayload === '[DONE]') break;

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.error) {
              if (!accumulatedContent.trim()) {
                streamErrorOnly = true;
              }
              accumulatedContent += `\n[تنبيه: ${parsed.error}]`;
            } else if (parsed.content) {
              streamErrorOnly = false;
              accumulatedContent += parsed.content;
            }
            if (parsed.model) {
              setActiveModel(parsed.model);
            }

            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: accumulatedContent,
                      model: parsed.model || msg.model,
                    }
                  : msg
              )
            );
          } catch {
            // partial JSON chunk
          }
        }
      }

      const { cleanText, actions } = parseAiActions(accumulatedContent, query, state);

      if (actions.length > 0) {
        // Attach actions and auto-execute all explicit commands & calculations
        const shouldAutoExecute =
          streamErrorOnly ||
          actions.some((a) => a.action === 'calculate' || a.action === 'monitor_store') ||
          /(?:أدرج|ادرج|سجل|أضف|اضف|عدل|حدث|غير|احذف|امسح|صدر|اطبع|نزل|حمل|احسب|كم|راقب|بع|بيع|اصدر|أصدر|انشئ|أنشئ|اعمل|نفذ|ارجع|أرجع|افتح|اجمع|اضغط|اجعل)/i.test(
            query
          );

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    streamErrorOnly
                      ? 'تم تحليل طلبك محلياً وتنفيذه مباشرة في نظام المتجر:'
                      : cleanText || 'تم تجهيز الإجراء التنفيذي بنجاح:',
                  actions,
                }
              : msg
          )
        );

        if (shouldAutoExecute) {
          const outcomes = await executeActionsBatch(assistantMsgId, actions);
          if (streamErrorOnly && outcomes.length > 0) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      content: outcomes.map((o) => o.message).join('\n'),
                    }
                  : msg
              )
            );
          }
        }
      } else if (streamErrorOnly) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    'المحرك المحلي جاهز للتحكم الكامل والحسابات بدون اتصال سحابي. جرّب أوامر مثل: «أضف مادة جديدة باسم مفتاح 10 امبير»، «احسب 15000 * 8 - 10%»، «أصدر فاتورة بيع»، «نزل آخر فاتورة PDF»، أو «كم رصيد الصندوق؟».',
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: cleanText || msg.content }
              : msg
          )
        );
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + '\n\n*(تم إيقاف التوليد)*' }
              : msg
          )
        );
      } else {
        console.warn('AI Stream fallback to local engine:', err);
        const { actions } = parseAiActions('', query, state);
        if (actions.length > 0) {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? { ...msg, actions }
                : msg
            )
          );
          const outcomes = await executeActionsBatch(assistantMsgId, actions);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content: outcomes.map((o) => o.message).join('\n'),
                  }
                : msg
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    content:
                      'المساعد المحلي نشط الآن. يمكنك كتابة أي عملية حسابية (مثل: احسب 25000 * 4) أو أمر متجر (مثل: أضف مادة جديدة، أصدر فاتورة بيع، نزل آخر فاتورة PDF، سجل مصروف، عدل إعدادات المتجر) لتنفيذه فوراً.',
                  }
                : msg
            )
          );
        }
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleConfirmReset = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'أهلاً بك مجدداً. تم فتح جلسة تحكم جديدة. بماذا تأمر في المتجر الآن؟',
        model: activeModel,
        timestamp: 'الآن',
      },
    ]);
    setShowResetConfirm(false);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyFullChat = () => {
    const fullText = messages
      .map(
        (m) =>
          `[${m.role === 'user' ? 'التاجر' : 'المساعد الذكي'}] (${m.timestamp}):\n${m.content}\n`
      )
      .join('\n----------------------------------------\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedFullToast(true);
    setTimeout(() => setCopiedFullToast(false), 2500);
  };

  return (
    <div className="space-y-4 pb-8 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-white rounded-2xl p-5 border border-amber-500/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
                غرفة التحكم الذكية بالمتجر
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                <Cpu className="w-3.5 h-3.5 text-amber-400" />
                <span>تحكم شامل + حاسبة فورية</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>متصل بقاعدة المتجر الحية</span>
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-1">
              أضف مواد، أنشئ فواتير، صدّر PDF، احسب أرباحاً أو معادلات، وعدّل الإعدادات بأمر واحد
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyFullChat}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            {copiedFullToast ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">تم النسخ</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span className="hidden sm:inline">نسخ المحادثة</span>
              </>
            )}
          </button>

          {showResetConfirm ? (
            <div className="flex items-center gap-1.5 bg-slate-800 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs">
              <span className="text-amber-200 font-bold">تأكيد المسح؟</span>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-md font-bold cursor-pointer"
              >
                نعم
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md cursor-pointer"
              >
                تراجع
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/40 rounded-xl transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>جلسة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Live Store Snapshot & Command Library */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                  لقطة المتجر الحية للذكاء الاصطناعي
                </h3>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                مزامنة حية
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">
                  قيمة المخزون:
                </span>
                <span className="font-bold font-mono tabular-nums text-slate-900 dark:text-white text-sm">
                  {formatCurrency(storeMetrics.totalStockValue, state.settings)}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {state.products.length} صنف مسجل
                </span>
              </div>

              <div
                onClick={() => onNavigate('inventory', { filter: 'low_stock' })}
                className="p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl cursor-pointer hover:bg-amber-100/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-amber-800 dark:text-amber-300 block mb-0.5">
                    مواد ناقصة:
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="font-bold font-mono tabular-nums text-amber-900 dark:text-amber-200 text-sm">
                  {storeMetrics.lowStockCount} مواد
                </span>
                <span className="text-[9px] text-amber-700 dark:text-amber-400 block mt-0.5">
                  انقر للمعاينة ↗
                </span>
              </div>

              <div
                onClick={() => onNavigate('customers')}
                className="p-2.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 rounded-xl cursor-pointer hover:bg-rose-100/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-rose-800 dark:text-rose-300 block mb-0.5">
                    ديون الزبائن:
                  </span>
                  <Coins className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <span className="font-bold font-mono tabular-nums text-rose-900 dark:text-rose-200 text-sm">
                  {formatCurrency(storeMetrics.totalDebts, state.settings)}
                </span>
                <span className="text-[9px] text-rose-700 dark:text-rose-400 block mt-0.5">
                  {storeMetrics.debtorsCount} زبون مدين ↗
                </span>
              </div>

              <div
                onClick={() => onNavigate('cashbox')}
                className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl cursor-pointer hover:bg-emerald-100/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 block mb-0.5">
                    رصيد الصندوق:
                  </span>
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <span className="font-bold font-mono tabular-nums text-emerald-900 dark:text-emerald-200 text-sm">
                  {formatCurrency(liveCashBalance, state.settings)}
                </span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block mt-0.5">
                  دفتر الصندوق ↗
                </span>
              </div>
            </div>

            {/* Core 4 Categories Micro-Breakdown */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">
                توزيع أصناف المستودع حسب التصنيفات:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
                  <span className="flex items-center gap-1 font-semibold">
                    <Zap className="w-3 h-3 text-amber-600" /> كهربائية
                  </span>
                  <span className="font-mono font-bold">{storeMetrics.catCounts['كهربائية']}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800/60">
                  <span className="flex items-center gap-1 font-semibold">
                    <Droplets className="w-3 h-3 text-sky-600" /> صحية
                  </span>
                  <span className="font-mono font-bold">{storeMetrics.catCounts['صحية']}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-800/60">
                  <span className="flex items-center gap-1 font-semibold">
                    <Hammer className="w-3 h-3 text-orange-600" /> بناء
                  </span>
                  <span className="font-mono font-bold">{storeMetrics.catCounts['بناء']}</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800/60">
                  <span className="flex items-center gap-1 font-semibold">
                    <Package className="w-3 h-3 text-indigo-600" /> عامة
                  </span>
                  <span className="font-mono font-bold">{storeMetrics.catCounts['عامة']}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Prompt & Command Library */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                مكتبة الأوامر والحسابات الفورية
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {PROMPT_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedPromptCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedPromptCategory(cat.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-bold text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{cat.title}</span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-1 max-h-80 overflow-y-auto">
              {PROMPT_CATEGORIES.find((c) => c.id === selectedPromptCategory)?.prompts.map(
                (p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => handleSendMessage(p.text)}
                    className="w-full text-right p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/30 text-xs transition-all group disabled:opacity-50 cursor-pointer"
                  >
                    <div className="flex items-center justify-between font-bold text-slate-900 dark:text-white group-hover:text-amber-900 dark:group-hover:text-amber-300 mb-1">
                      <span>{p.label}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 shrink-0" />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {p.text}
                    </p>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Full AI Conversation & Control Workspace */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[750px] overflow-hidden">
          {/* Chat Workspace Header */}
          <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="truncate">
                <span className="text-sm font-bold block text-white truncate">
                  منفّذ الأوامر والحسابات الذكي الشامل
                </span>
                <span className="text-[11px] text-slate-400 block font-mono truncate">
                  إضافة مواد · مبيعات وفواتير PDF · مشتريات · مصروفات · حسابات · إعدادات
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-amber-300 font-mono font-semibold border border-slate-700">
                {activeModel}
              </span>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40 dark:bg-slate-950/40">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              const pendingActions =
                msg.actions?.filter((a) => a.status === 'pending') || [];

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}
                >
                  {isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-xs mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[88%] rounded-2xl p-4 text-xs ${
                      isAssistant
                        ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xs leading-relaxed space-y-2'
                        : 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md self-end font-semibold'
                    }`}
                  >
                    {isAssistant && (
                      <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400 pb-1.5 border-b border-slate-100 dark:border-slate-800 font-mono">
                        <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          <span>{msg.model || activeModel}</span>
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>
                    )}

                    <div
                      className={`whitespace-pre-wrap leading-relaxed font-sans text-[12px] sm:text-xs ${
                        isAssistant
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-white dark:text-slate-950'
                      }`}
                    >
                      {msg.content || (
                        <span className="inline-flex items-center gap-1.5 text-slate-400 italic">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                          جاري تنفيذ الطلب ومعالجة البيانات...
                        </span>
                      )}
                    </div>

                    {/* Executable Action Cards */}
                    {isAssistant && msg.actions && msg.actions.length > 0 && (
                      <div className="space-y-2 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                            <Zap className="w-3.5 h-3.5 text-amber-600" />
                            <span>إجراءات المتجر التنفيذية ({msg.actions.length}):</span>
                          </div>
                          {pendingActions.length > 1 && (
                            <button
                              type="button"
                              onClick={() => executeActionsBatch(msg.id, pendingActions)}
                              className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] rounded-lg cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>تنفيذ الكل ({pendingActions.length})</span>
                            </button>
                          )}
                        </div>

                        {msg.actions.map((act) => {
                          const isExecuting = actionExecutingId === act.id;
                          const isExecuted = act.status === 'executed';
                          const isFailed = act.status === 'failed';
                          return (
                            <div
                              key={act.id}
                              className={`p-3 rounded-xl border transition-all text-xs ${
                                isExecuted
                                  ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                                  : isFailed
                                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
                                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-slate-900 dark:text-slate-100 shadow-xs'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-xs">{act.title}</span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                                      {act.action}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-3 gap-y-1">
                                    {act.data?.name && (
                                      <span>
                                        الصنف: <strong>{act.data.name}</strong>
                                      </span>
                                    )}
                                    {act.data?.category && <span>القسم: {act.data.category}</span>}
                                    {act.data?.sellingPrice !== undefined && (
                                      <span>
                                        سعر البيع: {formatCurrency(act.data.sellingPrice, state.settings)}
                                      </span>
                                    )}
                                    {act.data?.currentStock !== undefined && (
                                      <span>
                                        الكمية: {act.data.currentStock} {act.data.unit || 'قطعة'}
                                      </span>
                                    )}
                                    {act.data?.expression && (
                                      <span className="font-mono">
                                        المعادلة: {act.data.expression}
                                      </span>
                                    )}
                                    {act.data?.amount && (
                                      <span>
                                        المبلغ: {formatCurrency(act.data.amount, state.settings)}
                                      </span>
                                    )}
                                    {act.data?.customerName && (
                                      <span>الزبون: {act.data.customerName}</span>
                                    )}
                                    {act.data?.invoiceNumber && (
                                      <span className="font-mono">
                                        فاتورة: {act.data.invoiceNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="shrink-0 flex items-center gap-2">
                                  {isExecuted ? (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                      <span>تم التنفيذ بنجاح</span>
                                    </div>
                                  ) : isFailed ? (
                                    <button
                                      type="button"
                                      onClick={() => handleExecuteAction(msg.id, act.id)}
                                      className="flex items-center gap-1.5 text-[11px] font-bold text-rose-800 dark:text-rose-200 bg-rose-100 dark:bg-rose-900/50 px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 cursor-pointer"
                                    >
                                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                      <span>إعادة المحاولة</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isExecuting}
                                      onClick={() => handleExecuteAction(msg.id, act.id)}
                                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                      <Play className="w-3.5 h-3.5 fill-current" />
                                      <span>{isExecuting ? 'جاري التنفيذ...' : 'تنفيذ الآن'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {act.resultMessage && (
                                <div className="mt-2 text-[11px] font-semibold pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200">
                                  {act.resultMessage}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Copy action footer */}
                    {isAssistant && msg.content && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                                تم النسخ
                              </span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>نسخ</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Full-Store Command Chips */}
          <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto text-[11px]">
            <span className="text-slate-500 dark:text-slate-400 shrink-0 font-bold">
              أوامر سريعة:
            </span>
            {QUICK_CONTROL_CHIPS.map((chip, idx) => {
              const Icon = chip.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isStreaming}
                  onClick={() => handleSendMessage(chip.prompt)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 whitespace-nowrap transition-colors disabled:opacity-50 cursor-pointer font-semibold"
                >
                  <Icon className="w-3 h-3 text-amber-500" />
                  <span>{chip.label}</span>
                </button>
              );
            })}
          </div>

          {/* Input Dock */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2"
          >
            <div className="relative flex items-center gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus-within:border-slate-900 dark:focus-within:border-amber-500 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:ring-2 focus-within:ring-slate-900/10 rounded-2xl p-1.5 transition-all">
              <textarea
                rows={2}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="اكتب أي أمر للمتجر أو عملية حسابية (مثال: أضف مادة جديدة باسم قفل باب 5000 7500 20 · أو: احسب 15000 * 6 - 10% · أو: نزل آخر فاتورة PDF)..."
                disabled={isStreaming}
                className="flex-1 bg-transparent px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden resize-none leading-relaxed"
              />

              <div className="flex flex-col justify-end gap-1 shrink-0">
                {isStreaming ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5" />
                    <span>إيقاف</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-400 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white dark:text-slate-950 rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    <span>تنفيذ</span>
                    <Send className="w-3.5 h-3.5 rotate-180 text-amber-400 dark:text-slate-950" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
              <span>اضغط Enter للتنفيذ المباشر، و Shift + Enter لسطر جديد.</span>
              <span className="font-mono font-medium text-slate-500 dark:text-slate-400">
                تحكم كامل أونلاين + محرك تنفيذ وحساب محلي
              </span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
