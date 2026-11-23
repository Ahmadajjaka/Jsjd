import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
} from 'lucide-react';
import { AppState } from '../utils/storage';
import { formatCurrency } from '../utils/accounting';
import { resolveApiUrl } from '../utils/apkEnvironment';

interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: string;
}

interface AiDashboardAdvisorProps {
  state: AppState;
  onOpenFullAiView?: () => void;
}

const PRESET_PROMPTS = [
  {
    label: 'تحليل الأرباح والوضع المالي',
    icon: TrendingUp,
    prompt:
      'حلل لي أداء المتجر والمبيعات وصافي الأرباح الحالية، وقدم لي 3 نصائح عملية لرفع العائد المالي وتقليل المصروفات.',
  },
  {
    label: 'نواقص المستودع وإعادة الطلب',
    icon: AlertTriangle,
    prompt:
      'ما هي أبرز المواد الناقصة أو التي قاربت على النفاد في المستودع؟ وما خطة إعادة الطلب المقترحة حسب التصنيفات؟',
  },
  {
    label: 'خطة تحصيل ديون الزبائن',
    icon: Coins,
    prompt:
      'لخص لي وضع الديون والزبائن المدينين للمتجر، واكتب لي صيغة رسالة واتساب مهذبة ولبقة لتذكير الزبون بتسديد حسابه.',
  },
  {
    label: 'تنشيط مبيعات المواد',
    icon: Sparkles,
    prompt:
      'اقترح أفكاراً تسويقية وعروضاً تجارية لتنشيط مبيعات المواد الكهربائية والصحية ومواد البناء لخردوات المامو.',
  },
];

export const AiDashboardAdvisor: React.FC<AiDashboardAdvisorProps> = ({
  state,
  onOpenFullAiView,
}) => {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'مرحباً بك في «مستشار المامو الذكي» مدعوماً بنموذج Qwen 3.8 27B عبر Groq. أنا هنا لتحليل أرقام متجرك، ومساعدتك في قرارات التسعير، ومتابعة النواقص والديون بدقة. كيف يمكنني مساعدتك اليوم؟',
      model: 'Qwen 3.8 27B (Groq)',
      timestamp: 'الآن',
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeModel, setActiveModel] = useState<string>('Qwen 3.8 27B (Groq)');

  const abortControllerRef = useRef<AbortController | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll strictly inside the chat panel only after the user sends a message (never hijack page scroll on mount)
  useEffect(() => {
    if (isExpanded && messages.length > 1 && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isExpanded]);

  // Build store context snapshot for the AI
  const buildStoreContext = () => {
    const totalStockValuation = state.products.reduce(
      (sum, p) => sum + p.currentStock * p.costPrice,
      0
    );
    const lowStockItems = state.products.filter((p) => p.currentStock <= p.minStock);

    const totalDebts = state.customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);
    const debtors = state.customers
      .filter((c) => (c.totalDebt || 0) > 0)
      .map((c) => ({ name: c.name, debt: c.totalDebt, phone: c.phone }));

    const totalSales = state.sales.reduce((sum, s) => sum + s.total, 0);
    const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);

    return {
      storeName: state.settings.storeName,
      currency: state.settings.currencySymbol,
      initialCash: state.settings.initialCash,
      totalSalesCount: state.sales.length,
      totalSalesAmount: totalSales,
      totalExpensesAmount: totalExpenses,
      inventorySummary: {
        totalProductsCount: state.products.length,
        totalStockValuation,
        lowStockCount: lowStockItems.length,
        lowStockItemsSample: lowStockItems.slice(0, 8).map((p) => ({
          code: p.code,
          name: p.name,
          category: p.category,
          stock: p.currentStock,
          minStock: p.minStock,
        })),
      },
      customerDebtsSummary: {
        totalDebtsAmount: totalDebts,
        debtorsCount: debtors.length,
        topDebtors: debtors.slice(0, 5),
      },
      categories: state.settings.categories,
    };
  };

  const handleSend = async (customPrompt?: string) => {
    const query = (customPrompt || inputValue).trim();
    if (!query || isStreaming) return;

    const userMsg: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    const assistantMsgId = `assistant-${Date.now()}`;
    const initialAssistantMsg: AiMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      model: activeModel,
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, initialAssistantMsg]);
    setInputValue('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(resolveApiUrl('/api/ai/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({
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
        throw new Error('لم يتم استلام تدفق بيانات.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedContent = '';

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
          if (dataPayload === '[DONE]') {
            break;
          }

          try {
            const parsed = JSON.parse(dataPayload);
            if (parsed.error) {
              accumulatedContent += `\n[تنبيه: ${parsed.error}]`;
            } else if (parsed.content) {
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
            // Ignore malformed partial chunks
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? { ...msg, content: msg.content + ' [تم إيقاف التوليد بطلب منك]' }
              : msg
          )
        );
      } else {
        console.error('AI Stream Error:', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content:
                    msg.content ||
                    'عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. يرجى التأكد من اتصال الإنترنت والمحاولة مجدداً.',
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearHistory = () => {
    if (confirm('هل تريد تفريغ محادثة المستشار الذكي وبدء جلسة جديدة؟')) {
      setMessages([
        {
          id: `welcome-${Date.now()}`,
          role: 'assistant',
          content: 'أهلاً بك مجدداً. محادثة جديدة مفتوحة الآن. بماذا تحب أن نبدأ؟',
          model: activeModel,
          timestamp: 'الآن',
        },
      ]);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="bg-white dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/40 border border-slate-200 dark:border-amber-500/30 rounded-2xl shadow-xs dark:shadow-xl overflow-hidden text-slate-800 dark:text-slate-100 font-sans">
      {/* Header */}
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 bg-amber-50/50 dark:bg-slate-950/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-slate-950 shadow-sm">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                المستشار الذكي للوحة التحكم
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                <Cpu className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>Qwen 3.8 27B / Groq</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              تحليل مالي ومخزوني لحظي، نصائح تسعير، وإدارة ذكية لخردوات المامو
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="تفريغ المحادثة"
              className="p-1.5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {onOpenFullAiView && (
            <button
              type="button"
              onClick={onOpenFullAiView}
              title="فتح الواجهة الكاملة المستقلة لمستشار الذكاء الاصطناعي"
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold text-amber-900 hover:text-slate-950 bg-amber-100 hover:bg-amber-300 border border-amber-300 dark:text-amber-300 dark:bg-amber-500/15 dark:hover:bg-amber-400 dark:border-amber-500/30 rounded-lg transition-all cursor-pointer"
            >
              <span>الواجهة الكاملة</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200 dark:text-slate-300 dark:hover:text-white dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:border-slate-700/60 rounded-lg transition-colors cursor-pointer"
          >
            <span>{isExpanded ? 'طي النافذة' : 'فتح المساعد'}</span>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          {/* Preset Prompts Strip */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2">
              استفسارات وتحليلات سريعة بنقرة واحدة:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {PRESET_PROMPTS.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => handleSend(item.prompt)}
                    className="flex items-center gap-2 p-2.5 rounded-xl text-right bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 text-xs text-slate-700 hover:text-slate-900 dark:bg-slate-900/80 dark:hover:bg-slate-800/90 dark:border-slate-800 dark:hover:border-amber-500/40 dark:text-slate-200 transition-all group disabled:opacity-50 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 group-hover:bg-amber-500 group-hover:text-slate-950 dark:bg-amber-500/10 dark:text-amber-400 transition-colors shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-semibold truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversation Chat Messages */}
          <div
            ref={chatScrollRef}
            className="space-y-3 max-h-[360px] overflow-y-auto pr-1 pl-1 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700"
          >
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${
                    isAssistant ? 'justify-start' : 'justify-end'
                  }`}
                >
                  {isAssistant && (
                    <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 dark:bg-amber-500/20 dark:border-amber-500/30 dark:text-amber-400 flex items-center justify-center shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-xs ${
                      isAssistant
                        ? 'bg-slate-50 border border-slate-200 text-slate-800 dark:bg-slate-900/90 dark:border-slate-800 dark:text-slate-100 shadow-2xs leading-relaxed'
                        : 'bg-amber-50 border border-amber-300 text-amber-950 dark:bg-amber-500/20 dark:border-amber-500/40 dark:text-amber-50 self-end shadow-2xs'
                    }`}
                  >
                    {/* Header info for assistant */}
                    {isAssistant && (
                      <div className="flex items-center justify-between gap-3 text-[10px] text-slate-500 dark:text-slate-400 mb-1.5 pb-1 border-b border-slate-200 dark:border-slate-800/80 font-mono">
                        <span className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          <span>{msg.model || activeModel}</span>
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>
                    )}

                    {/* Content */}
                    <div className="whitespace-pre-wrap leading-relaxed font-sans">
                      {msg.content || (
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 italic">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                          جاري التفكير والتوليد عبر Groq LPU...
                        </span>
                      )}
                    </div>

                    {/* Action footer for assistant responses */}
                    {isAssistant && msg.content && (
                      <div className="flex items-center justify-end gap-1.5 mt-2 pt-1 border-t border-slate-200 dark:border-slate-800/60 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white px-2 py-0.5 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span className="text-emerald-700 dark:text-emerald-400">تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>نسخ الإجابة</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="pt-2"
          >
            <div className="relative flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 rounded-xl p-1.5 transition-all">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="اسأل المستشار الذكي عن أي تحليل أو نصيحة مالية أو إدارة المستودع..."
                disabled={isStreaming}
                className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStopStream}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>إيقاف</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-600 text-slate-950 rounded-lg text-xs font-black transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>إرسال</span>
                  <Send className="w-3.5 h-3.5 rotate-180" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 px-1 font-sans">
              <span>
                يتم إرسال لقطة لحظية من بيانات وأرصدة المتجر لتحليل استفسارك بدقة.
              </span>
              <span className="font-mono text-amber-700 dark:text-amber-400/80">Groq • Qwen 3.8 27B</span>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
