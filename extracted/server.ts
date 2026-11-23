import express from 'express';
import { Groq } from 'groq-sdk';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);

// Parse CLI flags or environment variables
const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : undefined;
}
const PORT = parseInt(getArg('--port') || process.env.PORT || '3000', 10);
const HOST = getArg('--host') || process.env.HOST || '0.0.0.0';

app.use(express.json({ limit: '10mb' }));

// Security headers for production hosting (Render / reverse proxies) + Capacitor APK CORS on /api/*
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.path.startsWith('/api/')) {
    const origin = req.headers.origin || '';
    const isApkOrLocalOrigin =
      origin === 'https://first-hook-1w2pc.web.app' ||
      origin === 'https://first-hook-1w2pc.firebaseapp.com' ||
      origin === 'https://localhost' ||
      origin === 'http://localhost' ||
      origin === 'capacitor://localhost' ||
      origin.startsWith('http://localhost:') ||
      origin.startsWith('https://localhost:') ||
      (process.env.APP_URL && origin === process.env.APP_URL);
    if (isApkOrLocalOrigin || origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
  }
  next();
});

// Android Digital Asset Links endpoint (prevents SHA-256 verification errors for TWA / App Links)
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const pkg = (process.env.ANDROID_PACKAGE_NAME || 'com.almamo.hardware').trim();
  const rawPrints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (rawPrints.length > 0) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: pkg,
          sha256_cert_fingerprints: rawPrints,
        },
      },
    ]);
    return;
  }

  const staticCandidates = [
    path.resolve(__dirname, 'dist', '.well-known', 'assetlinks.json'),
    path.resolve(__dirname, 'public', '.well-known', 'assetlinks.json'),
  ];
  for (const candidate of staticCandidates) {
    if (fs.existsSync(candidate)) {
      res.setHeader('Content-Type', 'application/json');
      res.sendFile(candidate);
      return;
    }
  }

  res.setHeader('Content-Type', 'application/json');
  res.status(200).json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: pkg,
        sha256_cert_fingerprints: [],
      },
    },
  ]);
});

// Dedicated health check endpoint (used by Render healthCheckPath)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
    uptime: Math.floor(process.uptime()),
    time: new Date().toISOString(),
  });
});

// Initialize AI clients
const groqApiKey = process.env.GROQ_API_KEY;
const groq = groqApiKey ? new Groq({ apiKey: groqApiKey }) : null;

const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey
  ? new GoogleGenAI({
      apiKey: geminiApiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Health / Status endpoint
app.get('/api/ai/status', (_req, res) => {
  res.json({
    groqAvailable: !!groq,
    groqModel: 'qwen/qwen3.8-27b',
    geminiAvailable: !!gemini,
    geminiModel: 'gemini-4-hydrogen',
    primaryProvider: groq ? 'groq' : gemini ? 'gemini' : 'none',
  });
});

// AI Chat Endpoint with real-time SSE streaming
app.post('/api/ai/chat', async (req, res) => {
  const { messages = [], storeContext = null } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Messages array is required.' });
    return;
  }

  // System instruction with full-store control actions and calculator capabilities
  const systemInstruction = `أنت «المستشار الذكي والمدير التنفيذي الآلي لخردوات المامو» — تتحكم بكامل المتجر والعمليات الحسابية والمالية وإصدار فواتير PDF مباشرة بناءً على طلب المستخدم.

صلاحياتك التنفيذية الكاملة (يمكنك تنفيذ إجراء واحد أو سلسلة إجراءات معاً):
1. المواد والمخزون:
   - "add_product": { name, category ("كهربائية"|"صحية"|"بناء"|"عامة"), unit, costPrice, sellingPrice, currentStock, minStock, code?, barcode? }
   - "update_product": { id?, code?, name?, newName?, category?, unit?, costPrice?, sellingPrice?, currentStock?, minStock? }
   - "delete_product": { id?, code?, name? }
   - "adjust_stock": { productId?, code?, name?, newStock, reason?, notes? }
2. المبيعات وفواتير PDF:
   - "create_sale": { customerName?, customerId?, paymentMethod ("cash"|"debt"|"partial"), paidAmount?, discount?, printPdf?, layout? ("thermal80"|"standard"), downloadDirect?, items: [{ productId?, code?, productName?, quantity, unitPrice?, discount? }] }
   - "return_sale": { invoiceId?, invoiceNumber?, reason }
   - "delete_sale": { invoiceId?, invoiceNumber? }
   - "export_invoice_pdf": { invoiceId?, invoiceNumber?, layout ("thermal80"|"standard"), downloadDirect (true|false) }
   - "aggregate_sales": {}
3. المشتريات والتوريد:
   - "create_purchase": { supplierName?, supplierId?, paymentMethod ("cash"|"debt"|"partial"), paidAmount?, discount?, items: [{ productId?, code?, productName?, quantity, costPrice? }] }
   - "delete_purchase": { purchaseId?, invoiceNumber? }
4. المصروفات والزبائن والموردين والصندوق:
   - "add_expense": { description, amount, category, notes? }
   - "delete_expense": { expenseId?, description? }
   - "add_customer": { name, phone?, address?, initialDebt? }
   - "delete_customer": { customerId?, name? }
   - "record_customer_payment": { customerId?, customerName?, amount, paymentMethod? ("cash"|"transfer"), notes? }
   - "add_supplier": { name, phone?, company?, initialDebt? }
   - "delete_supplier": { supplierId?, name? }
   - "record_supplier_payment": { supplierId?, supplierName?, amount, paymentMethod?, notes? }
   - "add_cash_transaction": { flow ("in"|"out"), amount, description }
   - "delete_cash_transaction": { txId? }
5. الحسابات والإعدادات والتقارير والنظام:
   - "calculate": { expression?, explanation?, metric? ("cash_balance"|"profits"|"debts"|"sales"|"full_kpis") } — استخدمها لأي حساب رياضي أو هوامش ربح أو خصومات أو نسب أو حساب مؤشرات المتجر الحية.
   - "update_settings": { storeName?, storeTagline?, phone?, address?, currencySymbol?, invoicePrintLayout? ("thermal80"|"standard"), invoiceHeaderNote?, invoiceFooterNote?, lowStockThresholdDefault? }
   - "navigate_tab": { tab ('dashboard'|'ledger'|'sales'|'purchases'|'inventory'|'expenses'|'customers'|'suppliers'|'cashbox'|'reports'|'archive'|'audit'|'settings') }
   - "export_pdf": { reportType ('master'|'sales'|'purchases'|'expenses'|'profit'|'cashbox'|'inventory'|'customer_debts'|'supplier_debts'|'invoice'), invoiceNumber?, layout? }
   - "monitor_store": {}
   - "compress_database": {}

قواعد التنسيق الصارمة:
- اكتب ملخصاً عربياً واضحاً ومختصراً للنتيجة أو الإجراء.
- لإجراء واحد ضمّن كتلة \`\`\`json:action { "action": "...", "title": "...", "data": {...} } \`\`\`.
- ولعدة إجراءات متتالية (مثل إضافة عدة مواد أو إنشاء فاتورة ثم طباعة PDF) يمكنك استخدام \`\`\`json:action { "actions": [ { "action": "...", "title": "...", "data": {...} }, ... ] } \`\`\`.
- ممنوع منعاً باتاً الادعاء بأنك أضفت مادة أو أنشأت فاتورة أو عدلت المخزون أو الإعدادات بنص عادي فقط؛ التطبيق ينفّذ الإجراءات فعلياً من كتلة json:action فقط، لذا أرفق كتلة json:action دائماً مع كل أمر تنفيذي أو حسابي!
- في "export_invoice_pdf": لتصدير أو طباعة آخر فاتورة اترك "invoiceNumber" محذوفاً أو فارغاً (ولا تكتب "LAST" أبداً).

${
  storeContext
    ? `بيانات المتجر اللحظية الكاملة:
${JSON.stringify(storeContext, null, 2)}`
    : 'لا توجد بيانات متجر مرفقة حالياً.'
}`;

  // Set SSE response headers (disable proxy buffering on Render)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Try Groq with Qwen 3.8 27B first (if GROQ_API_KEY is configured)
  if (groq) {
    try {
      const groqMessages = [
        { role: 'system' as const, content: systemInstruction },
        ...messages.map((m: any) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
          content: String(m.content || ''),
        })),
      ];

      const completion = await groq.chat.completions.create({
        model: 'qwen/qwen3.8-27b',
        messages: groqMessages,
        temperature: 0.6,
        max_completion_tokens: 2048,
        top_p: 0.95,
        stream: true,
      });

      for await (const chunk of completion) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          res.write(
            `data: ${JSON.stringify({
              content: text,
              model: 'Qwen 3.8 27B (Groq LPU)',
              provider: 'groq',
            })}\n\n`
          );
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    } catch (groqError: any) {
      console.warn('Groq Qwen call note:', groqError?.message || groqError);
      // If Groq fails and Gemini is available, continue to fallback below
      if (!gemini) {
        res.write(
          `data: ${JSON.stringify({
            error: `تعذر الاتصال بـ Groq: ${groqError?.message || 'خطأ غير متوقع'}.`,
          })}\n\n`
        );
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }
    }
  }

  // Graceful fallback to Gemini API (already active in AI Studio environment)
  if (gemini) {
    try {
      // Build contents for Gemini generateContentStream
      const geminiContents = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '') }],
      }));

      const responseStream = await gemini.models.generateContentStream({
        model: 'gemini-4-hydrogen',
        contents: geminiContents,
        config: {
          systemInstruction,
        },
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || '';
        if (text) {
          res.write(
            `data: ${JSON.stringify({
              content: text,
              model: 'Gemini 4 Hydrogen (الذكاء الاصطناعي السحابي)',
              provider: 'gemini',
            })}\n\n`
          );
        }
      }

      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    } catch (geminiError: any) {
      console.error('Gemini fallback failed:', geminiError);
      res.write(
        `data: ${JSON.stringify({
          error: `تعذر إكمال الاستجابة الذكية: ${geminiError?.message || 'خطأ'}.`,
        })}\n\n`
      );
      res.write(`data: [DONE]\n\n`);
      res.end();
      return;
    }
  }

  // Neither Groq nor Gemini configured
  res.write(
    `data: ${JSON.stringify({
      error: 'يرجى ضبط مفتاح GROQ_API_KEY أو GEMINI_API_KEY في ملف .env لاستخدام الذكاء الاصطناعي.',
    })}\n\n`
  );
  res.write(`data: [DONE]\n\n`);
  res.end();
});

// Mount Vite or serve static dist
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    // When HMR is disabled in middleware mode, serve a clean no-WebSocket /@vite/client shim
    // so CSS/HMR module imports still work without failing WebSocket handshakes.
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript');
      res.send(`
const sheetsMap = new Map();
const linkSheetsMap = new Map();
if (typeof document !== 'undefined') {
  document.querySelectorAll('style[data-vite-dev-id]').forEach((el) => {
    sheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
  document.querySelectorAll('link[rel="stylesheet"][data-vite-dev-id]').forEach((el) => {
    linkSheetsMap.set(el.getAttribute('data-vite-dev-id'), el);
  });
}
export function updateStyle(id, content) {
  if (linkSheetsMap.has(id)) return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (linkSheetsMap.has(id)) {
    document.querySelectorAll(\`link[rel="stylesheet"][data-vite-dev-id="\${CSS.escape(id)}"]\`).forEach((el) => el.remove());
    linkSheetsMap.delete(id);
  }
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  const noop = () => {};
  return {
    data: {},
    accept: noop,
    acceptExports: noop,
    dispose: noop,
    prune: noop,
    decline: noop,
    invalidate: noop,
    on: noop,
    off: noop,
    send: noop,
  };
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== '.' && url[0] !== '/') return url;
  const pathname = url.replace(/[?#].*$/, '');
  const { search, hash } = new URL(url, 'http://vite.dev');
  return \`\${pathname}?\${queryToInject}\${search ? '&' + search.slice(1) : ''}\${hash || ''}\`;
}
const BaseElement = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};
export class ErrorOverlay extends BaseElement {
  constructor(err) {
    super();
    if (err) console.error('[vite]', err);
  }
}
`);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: __dirname,
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.join(distDir, 'index.html');

    if (!fs.existsSync(indexHtmlPath)) {
      console.warn('Warning: dist/index.html not found. Run "npm run build" before starting production server.');
    }

    // Explicit JSON 404 for unknown /api/* endpoints in production
    app.all('/api/*', (_req, res) => {
      res.status(404).json({ error: 'API endpoint not found.' });
    });

    // Long-term immutable cache for hashed Vite build assets
    app.use(
      '/assets',
      express.static(path.join(distDir, 'assets'), {
        maxAge: '1y',
        immutable: true,
      })
    );

    // Serve root public/PWA files cleanly; prevent stale caching on service worker & manifest
    app.use(
      express.static(distDir, {
        index: false,
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.webmanifest') ||
            filePath.endsWith('index.html')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        },
      })
    );

    // SPA catch-all route
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(indexHtmlPath);
    });
  }

  const server = app.listen(PORT, HOST, () => {
    const publicUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL || `http://${HOST}:${PORT}`;
    console.log(
      `Server listening on http://${HOST}:${PORT} | mode=${isProd ? 'production' : 'development'} | url=${publicUrl} (Groq: ${!!groq}, Gemini: ${!!gemini})`
    );
  });

  server.on('error', (err: any) => {
    console.error(`Server listen error on ${HOST}:${PORT}:`, err);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
