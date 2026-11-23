import { jsPDF } from 'jspdf';
import { SaleInvoice, StoreSettings } from '../types/accounting';
import { formatCurrency, formatNumber } from './accounting';

export type InvoicePdfLayout = 'thermal80' | 'standard';

export interface BuiltInvoicePdfResult {
  doc: jsPDF;
  fileName: string;
  layout: InvoicePdfLayout;
  pageCount: number;
}

function sanitizeFilePart(value: string): string {
  return (value || 'invoice')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_');
}

function getPaymentMethodArabic(method: SaleInvoice['paymentMethod']): string {
  if (method === 'cash') return 'نقداً بالكامل';
  if (method === 'debt') return 'آجل (ذمة / دين)';
  return 'دفعة جزئية';
}

/**
 * Generates deterministic pseudo-barcode widths matching InvoiceModal's ThermalBarcode
 */
function generateBarcodeBars(code: string): number[] {
  const bars: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push((charCode % 3) + 1, 1, ((charCode >> 1) % 2) + 1, 1, (charCode % 2) + 1);
  }
  return [2, 1, 1, ...bars, 1, 2, 1, 2];
}

/**
 * Word-wraps Arabic/Latin text inside a Canvas2D context for crisp multi-line rendering
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const clean = String(text || '').trim();
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      current = testLine;
    } else {
      if (current) lines.push(current);
      if (ctx.measureText(word).width > maxWidth) {
        // Hard-break very long tokens (e.g. serial codes)
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        current = chunk;
      } else {
        current = word;
      }
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawBarcodeOnCanvas(
  ctx: CanvasRenderingContext2D,
  code: string,
  centerX: number,
  topY: number,
  maxWidth: number,
  height: number
) {
  const allBars = generateBarcodeBars(code || 'INV');
  const totalUnits = allBars.reduce((sum, w) => sum + w * 2, 0) + 12;
  const scale = Math.min(2.2, maxWidth / Math.max(1, totalUnits));
  const drawnWidth = totalUnits * scale;
  let currentX = centerX - drawnWidth / 2 + 6 * scale;

  ctx.fillStyle = '#0f172a';
  allBars.forEach((barW, idx) => {
    const step = barW * 2 * scale;
    if (idx % 2 === 0) {
      ctx.fillRect(currentX, topY, Math.max(1, barW * 1.6 * scale), height);
    }
    currentX += step;
  });
}

/**
 * Renders 80mm thermal receipt on a crisp high-DPI Canvas2D and embeds it into jsPDF
 */
function buildThermal80CanvasJsPdf(
  invoice: SaleInvoice,
  settings: StoreSettings
): jsPDF {
  const widthPx = 640; // 80mm at ~203 DPI scaled cleanly
  const padX = 28;
  const contentW = widthPx - padX * 2;
  const fontStack = "'Cairo', 'Segoe UI', 'Tahoma', sans-serif";
  const monoStack = "'Cairo', monospace";

  // Pre-measure height cleanly using a scratch context
  const scratch = document.createElement('canvas').getContext('2d');
  let estimatedHeight = 460;
  if (scratch) {
    scratch.font = `700 18px ${fontStack}`;
    const itemsHeight = invoice.items.reduce((sum, item) => {
      const nameLines = wrapCanvasText(
        scratch,
        `${item.productName}`,
        contentW - 140
      ).length;
      return sum + Math.max(1, nameLines) * 24 + 34;
    }, 0);
    const notesLines = invoice.notes
      ? wrapCanvasText(scratch, invoice.notes, contentW - 20).length * 20 + 24
      : 0;
    const headerNoteExtra = settings.invoiceHeaderNote ? 26 : 0;
    const statusExtra = invoice.status !== 'completed' ? 54 : 0;
    const discountExtra = invoice.discount > 0 ? 28 : 0;
    const debtExtra = invoice.remainingAmount > 0 ? 34 : 0;
    estimatedHeight =
      350 +
      headerNoteExtra +
      statusExtra +
      itemsHeight +
      discountExtra +
      debtExtra +
      notesLines +
      195;
  }

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = Math.max(540, estimatedHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('تعذر تهيئة محرك الرسم لإنشاء فاتورة PDF.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'top';

  let y = 26;

  // Store Header
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = `900 30px ${fontStack}`;
  ctx.fillText(settings.storeName || 'خردوات المامو', widthPx / 2, y);
  y += 38;

  if (settings.storeTagline) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 16px ${fontStack}`;
    ctx.fillText(settings.storeTagline, widthPx / 2, y);
    y += 24;
  }

  const contactParts = [
    settings.phone ? `هاتف: ${settings.phone}` : '',
    settings.address || '',
    settings.taxNumber ? `ض: ${settings.taxNumber}` : '',
  ].filter(Boolean);
  if (contactParts.length > 0) {
    ctx.fillStyle = '#334155';
    ctx.font = `500 15px ${fontStack}`;
    const contactLines = wrapCanvasText(ctx, contactParts.join(' · '), contentW);
    for (const line of contactLines) {
      ctx.fillText(line, widthPx / 2, y);
      y += 20;
    }
  }

  if (settings.invoiceHeaderNote) {
    ctx.fillStyle = '#1e293b';
    ctx.font = `600 15px ${fontStack}`;
    ctx.fillText(settings.invoiceHeaderNote, widthPx / 2, y);
    y += 24;
  }

  y += 8;
  // Dashed divider
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(widthPx - padX, y);
  ctx.stroke();
  ctx.restore();
  y += 14;

  // Helper for two-column RTL key/value row
  const drawRow = (
    label: string,
    val: string,
    opts?: {
      bold?: boolean;
      labelColor?: string;
      valColor?: string;
      fontSize?: number;
      bg?: string;
    }
  ) => {
    const size = opts?.fontSize || 17;
    const rowH = size + 10;
    if (opts?.bg) {
      ctx.fillStyle = opts.bg;
      drawRoundedRect(ctx, padX, y - 4, contentW, rowH + 4, 8);
      ctx.fill();
    }
    ctx.font = `${opts?.bold ? '800' : '600'} ${size}px ${fontStack}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = opts?.labelColor || '#334155';
    ctx.fillText(label, widthPx - padX - (opts?.bg ? 10 : 0), y);

    ctx.textAlign = 'left';
    ctx.fillStyle = opts?.valColor || '#0f172a';
    ctx.font = `${opts?.bold ? '900' : '700'} ${size}px ${monoStack}`;
    ctx.fillText(val, padX + (opts?.bg ? 10 : 0), y);
    y += rowH + 4;
  };

  drawRow('فاتورة مبيعات:', invoice.invoiceNumber, { bold: true, fontSize: 18 });
  drawRow('التاريخ والوقت:', `${invoice.date} ${invoice.time}`, { fontSize: 15 });
  drawRow('الزبون:', invoice.customerName || 'زبون نقدي', { bold: true, fontSize: 17 });
  drawRow('طريقة الدفع:', getPaymentMethodArabic(invoice.paymentMethod), { fontSize: 16 });

  if (invoice.status !== 'completed') {
    y += 4;
    ctx.fillStyle = '#fff1f2';
    drawRoundedRect(ctx, padX, y, contentW, 38, 8);
    ctx.fill();
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#9f1239';
    ctx.textAlign = 'center';
    ctx.font = `800 16px ${fontStack}`;
    const statusText = `حالة الفاتورة: ${
      invoice.status === 'returned' ? 'مرتجعة' : 'ملغاة'
    }${invoice.returnReason ? ` (${invoice.returnReason})` : ''}`;
    ctx.fillText(statusText, widthPx / 2, y + 10);
    y += 48;
  }

  y += 6;
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(widthPx - padX, y);
  ctx.stroke();
  ctx.restore();
  y += 12;

  // Table Header
  ctx.fillStyle = '#1e293b';
  ctx.font = `800 16px ${fontStack}`;
  ctx.textAlign = 'right';
  ctx.fillText('المادة', widthPx - padX, y);
  ctx.textAlign = 'center';
  ctx.fillText('الكمية', widthPx * 0.36, y);
  ctx.textAlign = 'left';
  ctx.fillText('الإجمالي', padX, y);
  y += 26;

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(widthPx - padX, y);
  ctx.stroke();
  y += 10;

  // Items list
  invoice.items.forEach((item, idx) => {
    ctx.font = `800 17px ${fontStack}`;
    const nameLines = wrapCanvasText(
      ctx,
      `${idx + 1}. ${item.productName}`,
      contentW - 150
    );

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'left';
    ctx.font = `800 17px ${monoStack}`;
    ctx.fillText(formatCurrency(item.total, settings), padX, y);

    ctx.textAlign = 'right';
    ctx.font = `800 17px ${fontStack}`;
    for (const line of nameLines) {
      ctx.fillText(line, widthPx - padX, y);
      y += 23;
    }

    ctx.fillStyle = '#475569';
    ctx.font = `600 14px ${monoStack}`;
    ctx.textAlign = 'right';
    ctx.fillText(
      `${formatNumber(item.quantity)} ${item.unit} × ${formatCurrency(
        item.unitPrice,
        settings
      )}`,
      widthPx - padX - 8,
      y
    );
    if (item.discount > 0) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#be123c';
      ctx.fillText(`خصم: -${formatCurrency(item.discount, settings)}`, padX, y);
    }
    y += 24;

    if (idx < invoice.items.length - 1) {
      ctx.save();
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padX, y);
      ctx.lineTo(widthPx - padX, y);
      ctx.stroke();
      ctx.restore();
      y += 8;
    }
  });

  y += 6;
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(widthPx - padX, y);
  ctx.stroke();
  ctx.restore();
  y += 14;

  const totalPieces = invoice.items.reduce((s, i) => s + i.quantity, 0);
  drawRow(
    'عدد الأصناف:',
    `${invoice.items.length} صنف (${formatNumber(totalPieces)})`,
    { fontSize: 15, labelColor: '#475569', valColor: '#334155' }
  );
  drawRow('المجموع الفرعي:', formatCurrency(invoice.subtotal, settings), {
    fontSize: 16,
  });

  if (invoice.discount > 0) {
    drawRow('خصم الفاتورة:', `-${formatCurrency(invoice.discount, settings)}`, {
      fontSize: 16,
      labelColor: '#be123c',
      valColor: '#be123c',
      bold: true,
    });
  }

  y += 4;
  drawRow('الصافي الإجمالي:', formatCurrency(invoice.total, settings), {
    bold: true,
    fontSize: 20,
    bg: '#f1f5f9',
    labelColor: '#0f172a',
    valColor: '#0f172a',
  });
  y += 4;

  drawRow('المسدد (المقبوض):', formatCurrency(invoice.paidAmount, settings), {
    bold: true,
    fontSize: 17,
    labelColor: '#065f46',
    valColor: '#065f46',
  });

  if (invoice.remainingAmount > 0) {
    drawRow('المتبقي ذمة (دين):', formatCurrency(invoice.remainingAmount, settings), {
      bold: true,
      fontSize: 17,
      labelColor: '#9f1239',
      valColor: '#9f1239',
    });
  }

  if (invoice.notes) {
    y += 4;
    ctx.fillStyle = '#475569';
    ctx.textAlign = 'right';
    ctx.font = `600 14px ${fontStack}`;
    const noteLines = wrapCanvasText(ctx, `ملاحظة: ${invoice.notes}`, contentW);
    for (const line of noteLines) {
      ctx.fillText(line, widthPx - padX, y);
      y += 20;
    }
  }

  y += 8;
  ctx.save();
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, y);
  ctx.lineTo(widthPx - padX, y);
  ctx.stroke();
  ctx.restore();
  y += 16;

  // Footer + Barcode
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 17px ${fontStack}`;
  ctx.fillText('شكراً لزيارتكم وتعاملكم معنا', widthPx / 2, y);
  y += 24;

  if (settings.invoiceFooterNote) {
    ctx.fillStyle = '#475569';
    ctx.font = `500 14px ${fontStack}`;
    const footLines = wrapCanvasText(ctx, settings.invoiceFooterNote, contentW);
    for (const line of footLines) {
      ctx.fillText(line, widthPx / 2, y);
      y += 19;
    }
  }

  y += 6;
  drawBarcodeOnCanvas(ctx, invoice.invoiceNumber, widthPx / 2, y, 260, 44);
  y += 50;

  ctx.fillStyle = '#0f172a';
  ctx.font = `700 14px ${monoStack}`;
  ctx.fillText(`*${invoice.invoiceNumber}*`, widthPx / 2, y);
  y += 22;

  ctx.fillStyle = '#64748b';
  ctx.font = `500 12px ${fontStack}`;
  ctx.fillText(
    `PDF · ${settings.storeName || 'خردوات المامو'} · ${new Date().toLocaleDateString('ar-SA')}`,
    widthPx / 2,
    y
  );
  y += 26;

  // Trim canvas to exact content height
  const finalHeightPx = Math.max(400, y);
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = widthPx;
  trimmedCanvas.height = finalHeightPx;
  const trimCtx = trimmedCanvas.getContext('2d');
  if (trimCtx) {
    trimCtx.fillStyle = '#ffffff';
    trimCtx.fillRect(0, 0, widthPx, finalHeightPx);
    trimCtx.drawImage(canvas, 0, 0, widthPx, finalHeightPx, 0, 0, widthPx, finalHeightPx);
  }

  const mmWidth = 80;
  const mmHeight = Math.max(95, (finalHeightPx / widthPx) * mmWidth);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [mmWidth, mmHeight],
    compress: true,
  });

  const imgData = trimmedCanvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST');
  return doc;
}

/**
 * Renders full A4 Arabic RTL invoice with multi-page table pagination on jsPDF
 */
function buildStandardA4CanvasJsPdf(
  invoice: SaleInvoice,
  settings: StoreSettings
): jsPDF {
  const pageWidthPx = 1240; // ~150 DPI A4
  const pageHeightPx = 1754;
  const marginX = 64;
  const marginTop = 58;
  const marginBottom = 70;
  const contentW = pageWidthPx - marginX * 2;
  const fontStack = "'Cairo', 'Segoe UI', 'Tahoma', sans-serif";
  const monoStack = "'Cairo', monospace";

  const pages: HTMLCanvasElement[] = [];

  const createPageCanvas = (): {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
  } => {
    const canvas = document.createElement('canvas');
    canvas.width = pageWidthPx;
    canvas.height = pageHeightPx;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('تعذر تهيئة سياق الرسم لصفحة A4.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageWidthPx, pageHeightPx);
    ctx.direction = 'rtl';
    ctx.textBaseline = 'top';
    pages.push(canvas);
    return { canvas, ctx };
  };

  let { ctx } = createPageCanvas();
  let y = marginTop;

  // Store Header Banner
  ctx.fillStyle = '#0f172a';
  drawRoundedRect(ctx, marginX, y, contentW, 134, 16);
  ctx.fill();

  // Accent bar at bottom of banner
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(marginX + 16, y + 128, contentW - 32, 6);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 34px ${fontStack}`;
  ctx.fillText(settings.storeName || 'خردوات المامو', pageWidthPx - marginX - 28, y + 22);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `600 18px ${fontStack}`;
  ctx.fillText(
    settings.storeTagline || 'خردوات ومواد بناء وأدوات صحية وكهربائية',
    pageWidthPx - marginX - 28,
    y + 68
  );

  const subMeta = [
    settings.phone ? `هاتف: ${settings.phone}` : '',
    settings.address || '',
    settings.taxNumber ? `الرقم الضريبي: ${settings.taxNumber}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  ctx.fillStyle = '#94a3b8';
  ctx.font = `500 15px ${fontStack}`;
  ctx.fillText(subMeta, pageWidthPx - marginX - 28, y + 98);

  // Invoice Title on left side of banner
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fbbf24';
  ctx.font = `900 26px ${fontStack}`;
  ctx.fillText('فاتورة مبيعات ضريبية / تجارية', marginX + 28, y + 26);

  ctx.fillStyle = '#f8fafc';
  ctx.font = `800 22px ${monoStack}`;
  ctx.fillText(invoice.invoiceNumber, marginX + 28, y + 66);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = `500 15px ${monoStack}`;
  ctx.fillText(`${invoice.date} · ${invoice.time}`, marginX + 28, y + 98);

  y += 156;

  if (settings.invoiceHeaderNote) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b45309';
    ctx.font = `700 16px ${fontStack}`;
    ctx.fillText(settings.invoiceHeaderNote, pageWidthPx / 2, y);
    y += 30;
  }

  // 4-Card Metadata Strip
  const cardGap = 14;
  const cardW = (contentW - cardGap * 3) / 4;
  const cards = [
    { label: 'رقم الفاتورة', val: invoice.invoiceNumber, accent: '#b45309', bg: '#fffbeb', border: '#fcd34d' },
    { label: 'اسم الزبون', val: invoice.customerName || 'زبون نقدي', accent: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
    { label: 'طريقة السداد', val: getPaymentMethodArabic(invoice.paymentMethod), accent: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' },
    { label: 'صافي الفاتورة', val: formatCurrency(invoice.total, settings), accent: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  ];

  cards.forEach((c, idx) => {
    const cx = pageWidthPx - marginX - (idx + 1) * cardW - idx * cardGap;
    ctx.fillStyle = c.bg;
    drawRoundedRect(ctx, cx, y, cardW, 78, 12);
    ctx.fill();
    ctx.strokeStyle = c.border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = `700 14px ${fontStack}`;
    ctx.fillText(c.label, cx + cardW - 14, y + 14);

    ctx.fillStyle = c.accent;
    ctx.font = `900 19px ${fontStack}`;
    const trimmedVal =
      ctx.measureText(c.val).width > cardW - 24
        ? `${c.val.slice(0, 18)}…`
        : c.val;
    ctx.fillText(trimmedVal, cx + cardW - 14, y + 40);
  });
  y += 98;

  // Status banner if returned/cancelled
  if (invoice.status !== 'completed') {
    ctx.fillStyle = '#fff1f2';
    drawRoundedRect(ctx, marginX, y, contentW, 44, 10);
    ctx.fill();
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#9f1239';
    ctx.font = `800 17px ${fontStack}`;
    ctx.fillText(
      `تنبيه: الفاتورة ${invoice.status === 'returned' ? 'مرتجعة' : 'ملغاة'}${
        invoice.returnReason ? ` — السبب: ${invoice.returnReason}` : ''
      }`,
      pageWidthPx / 2,
      y + 12
    );
    y += 60;
  }

  // Table Columns (RTL right-to-left geometry)
  const colWidths = [55, 130, 330, 125, 120, 135, 100, 117]; // sums to 1112 = contentW (1240 - 128)
  const colHeaders = ['#', 'الكود', 'اسم المادة والتفصيل', 'التصنيف', 'الكمية', 'سعر الوحدة', 'الخصم', 'الإجمالي'];

  const drawTableHeader = () => {
    ctx.fillStyle = '#0f172a';
    drawRoundedRect(ctx, marginX, y, contentW, 42, 8);
    ctx.fill();

    let rx = pageWidthPx - marginX;
    ctx.fillStyle = '#f8fafc';
    ctx.font = `800 15px ${fontStack}`;
    colHeaders.forEach((h, i) => {
      const w = colWidths[i];
      ctx.textAlign = i === 0 || i === 4 ? 'center' : i >= 5 ? 'left' : 'right';
      const tx =
        i === 0 || i === 4 ? rx - w / 2 : i >= 5 ? rx - w + 10 : rx - 10;
      ctx.fillText(h, tx, y + 12);
      rx -= w;
    });
    y += 46;
  };

  drawTableHeader();

  // Table Rows with clean page breaks
  invoice.items.forEach((item, idx) => {
    ctx.font = `700 16px ${fontStack}`;
    const nameLines = wrapCanvasText(ctx, item.productName, colWidths[2] - 20);
    const rowH = Math.max(42, nameLines.length * 24 + 18);

    if (y + rowH > pageHeightPx - marginBottom - 160 && idx < invoice.items.length) {
      // Footer page number on current page
      ctx.textAlign = 'center';
      ctx.fillStyle = '#94a3b8';
      ctx.font = `600 13px ${fontStack}`;
      ctx.fillText(
        `صفحة ${pages.length} — ${settings.storeName || 'خردوات المامو'}`,
        pageWidthPx / 2,
        pageHeightPx - 40
      );

      ({ ctx } = createPageCanvas());
      y = marginTop;
      drawTableHeader();
    }

    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(marginX, y, contentW, rowH);
    }

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginX, y + rowH);
    ctx.lineTo(pageWidthPx - marginX, y + rowH);
    ctx.stroke();

    let rx = pageWidthPx - marginX;
    const textY = y + 12;

    // #
    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = `700 15px ${monoStack}`;
    ctx.fillText(String(idx + 1), rx - colWidths[0] / 2, textY);
    rx -= colWidths[0];

    // Code
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `600 14px ${monoStack}`;
    ctx.fillText(item.productCode || '-', rx - 10, textY);
    rx -= colWidths[1];

    // Name (wrapped)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 16px ${fontStack}`;
    let lineY = y + 10;
    for (const line of nameLines) {
      ctx.fillText(line, rx - 10, lineY);
      lineY += 23;
    }
    rx -= colWidths[2];

    // Category
    ctx.fillStyle = '#475569';
    ctx.font = `600 14px ${fontStack}`;
    ctx.fillText(item.category || '-', rx - 10, textY);
    rx -= colWidths[3];

    // Quantity
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0f172a';
    ctx.font = `800 15px ${monoStack}`;
    ctx.fillText(`${formatNumber(item.quantity)} ${item.unit}`, rx - colWidths[4] / 2, textY);
    rx -= colWidths[4];

    // Unit Price
    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = `600 15px ${monoStack}`;
    ctx.fillText(formatCurrency(item.unitPrice, settings), rx - colWidths[5] + 10, textY);
    rx -= colWidths[5];

    // Discount
    ctx.fillStyle = item.discount > 0 ? '#be123c' : '#94a3b8';
    ctx.fillText(
      item.discount > 0 ? `-${formatCurrency(item.discount, settings)}` : '-',
      rx - colWidths[6] + 10,
      textY
    );
    rx -= colWidths[6];

    // Total
    ctx.fillStyle = '#047857';
    ctx.font = `900 16px ${monoStack}`;
    ctx.fillText(formatCurrency(item.total, settings), rx - colWidths[7] + 10, textY);

    y += rowH;
  });

  y += 24;

  // Ensure totals + footer fit on current page
  if (y + 280 > pageHeightPx - marginBottom) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = `600 13px ${fontStack}`;
    ctx.fillText(
      `صفحة ${pages.length} — ${settings.storeName || 'خردوات المامو'}`,
      pageWidthPx / 2,
      pageHeightPx - 40
    );
    ({ ctx } = createPageCanvas());
    y = marginTop;
  }

  // Notes (Right Box) & Totals Summary (Left Box)
  const boxGap = 20;
  const halfW = (contentW - boxGap) / 2;
  const rightBoxX = pageWidthPx - marginX - halfW;
  const leftBoxX = marginX;

  const totalsBoxH =
    168 + (invoice.discount > 0 ? 30 : 0) + (invoice.remainingAmount > 0 ? 32 : 0);

  // Notes Box
  ctx.fillStyle = '#f8fafc';
  drawRoundedRect(ctx, rightBoxX, y, halfW, totalsBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 16px ${fontStack}`;
  ctx.fillText('ملاحظات الفاتورة والتسليم:', rightBoxX + halfW - 18, y + 16);

  ctx.fillStyle = '#475569';
  ctx.font = `500 15px ${fontStack}`;
  const noteLines = wrapCanvasText(
    ctx,
    invoice.notes || 'لا توجد ملاحظات إضافية. البضاعة مستلمة بحالة سليمة.',
    halfW - 36
  );
  let ny = y + 46;
  for (const line of noteLines.slice(0, 4)) {
    ctx.fillText(line, rightBoxX + halfW - 18, ny);
    ny += 24;
  }

  // Barcode inside notes box bottom
  drawBarcodeOnCanvas(ctx, invoice.invoiceNumber, rightBoxX + halfW / 2, y + totalsBoxH - 64, 220, 34);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#475569';
  ctx.font = `700 13px ${monoStack}`;
  ctx.fillText(`*${invoice.invoiceNumber}*`, rightBoxX + halfW / 2, y + totalsBoxH - 25);

  // Totals Summary Box
  ctx.fillStyle = '#f1f5f9';
  drawRoundedRect(ctx, leftBoxX, y, halfW, totalsBoxH, 12);
  ctx.fill();
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  let ty = y + 18;
  const drawSummaryRow = (
    label: string,
    val: string,
    color: string,
    bold = false,
    size = 16
  ) => {
    ctx.textAlign = 'right';
    ctx.fillStyle = color;
    ctx.font = `${bold ? '900' : '600'} ${size}px ${fontStack}`;
    ctx.fillText(label, leftBoxX + halfW - 18, ty);

    ctx.textAlign = 'left';
    ctx.font = `${bold ? '900' : '700'} ${size}px ${monoStack}`;
    ctx.fillText(val, leftBoxX + 18, ty);
    ty += size + 14;
  };

  drawSummaryRow('المجموع الفرعي:', formatCurrency(invoice.subtotal, settings), '#334155');
  if (invoice.discount > 0) {
    drawSummaryRow('خصم إضافي:', `-${formatCurrency(invoice.discount, settings)}`, '#be123c', true);
  }

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftBoxX + 16, ty - 4);
  ctx.lineTo(leftBoxX + halfW - 16, ty - 4);
  ctx.stroke();
  ty += 8;

  drawSummaryRow('المبلغ النهائي الصافي:', formatCurrency(invoice.total, settings), '#0f172a', true, 20);
  drawSummaryRow('المقبوض نقداً:', formatCurrency(invoice.paidAmount, settings), '#047857', true, 16);
  if (invoice.remainingAmount > 0) {
    drawSummaryRow('المتبقي ذمة (دين):', formatCurrency(invoice.remainingAmount, settings), '#be123c', true, 16);
  }

  y += totalsBoxH + 34;

  // Footer
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(marginX, y);
  ctx.lineTo(pageWidthPx - marginX, y);
  ctx.stroke();
  y += 18;

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0f172a';
  ctx.font = `800 18px ${fontStack}`;
  ctx.fillText(
    `شكراً لتعاملكم مع ${settings.storeName || 'خردوات المامو'}`,
    pageWidthPx / 2,
    y
  );
  y += 28;

  if (settings.invoiceFooterNote) {
    ctx.fillStyle = '#475569';
    ctx.font = `500 15px ${fontStack}`;
    ctx.fillText(settings.invoiceFooterNote, pageWidthPx / 2, y);
    y += 24;
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = `600 13px ${fontStack}`;
  ctx.fillText(
    `صفحة ${pages.length} من ${pages.length} · صادرة إلكترونياً عبر نظام خردوات المامو`,
    pageWidthPx / 2,
    pageHeightPx - 40
  );

  // Assemble jsPDF A4 document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pages.forEach((pageCanvas, idx) => {
    if (idx > 0) doc.addPage('a4', 'portrait');
    const imgData = pageCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
  });

  return doc;
}

/**
 * Pure vector fallback for headless Node/unit-test environments without HTML5 Canvas
 */
function buildFallbackJsPdfForNode(
  invoice: SaleInvoice,
  settings: StoreSettings,
  layout: InvoicePdfLayout
): jsPDF {
  const isThermal = layout === 'thermal80';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: isThermal ? [80, 140 + invoice.items.length * 8] : 'a4',
    compress: true,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isThermal ? 11 : 16);
  doc.text(`Invoice ${invoice.invoiceNumber}`, 10, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(isThermal ? 8 : 10);
  doc.text(`Store: ${settings.storeName || 'Al-Mamo'}`, 10, 22);
  doc.text(`Date: ${invoice.date} ${invoice.time}`, 10, 28);
  doc.text(`Customer: ${invoice.customerName}`, 10, 34);

  let y = 44;
  invoice.items.forEach((item, idx) => {
    doc.text(
      `${idx + 1}. Qty ${item.quantity} x ${item.unitPrice} = ${item.total}`,
      10,
      y
    );
    y += 7;
  });

  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${invoice.total} | Paid: ${invoice.paidAmount}`, 10, y + 6);
  return doc;
}

/**
 * Builds a genuine jsPDF document for a sales invoice in either 80mm thermal or A4 format
 */
export function buildInvoicePdfDocument(
  invoice: SaleInvoice,
  settings: StoreSettings,
  layout: InvoicePdfLayout = 'thermal80'
): BuiltInvoicePdfResult {
  const safeNum = sanitizeFilePart(invoice.invoiceNumber || 'invoice');
  const fileName = `فاتورة_${safeNum}_${layout === 'thermal80' ? '80mm' : 'A4'}.pdf`;

  let doc: jsPDF;
  if (typeof document !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
    try {
      doc =
        layout === 'thermal80'
          ? buildThermal80CanvasJsPdf(invoice, settings)
          : buildStandardA4CanvasJsPdf(invoice, settings);
    } catch (err) {
      console.warn('Canvas jsPDF render fallback triggered:', err);
      doc = buildFallbackJsPdfForNode(invoice, settings, layout);
    }
  } else {
    doc = buildFallbackJsPdfForNode(invoice, settings, layout);
  }

  doc.setProperties({
    title: `فاتورة مبيعات ${invoice.invoiceNumber}`,
    subject: `فاتورة الزبون ${invoice.customerName}`,
    creator: settings.storeName || 'خردوات المامو',
  });

  return {
    doc,
    fileName,
    layout,
    pageCount: doc.getNumberOfPages(),
  };
}

/**
 * Generates and downloads or prints a sales invoice PDF using jsPDF.
 * Safe inside iframes (never uses window.alert or window.open).
 */
export function exportInvoicePdfWithJsPdf(
  invoice: SaleInvoice,
  settings: StoreSettings,
  layout: InvoicePdfLayout = 'thermal80',
  downloadDirect: boolean = false
): { success: boolean; fileName: string; mode: 'download' | 'print'; pageCount: number } {
  const built = buildInvoicePdfDocument(invoice, settings, layout);

  if (downloadDirect || typeof document === 'undefined') {
    built.doc.save(built.fileName);
    return {
      success: true,
      fileName: built.fileName,
      mode: 'download',
      pageCount: built.pageCount,
    };
  }

  try {
    built.doc.autoPrint({ variant: 'non-conform' });
    const blob = built.doc.output('blob');
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '1px';
    iframe.style.height = '1px';
    iframe.style.opacity = '0.01';
    iframe.style.border = '0';
    iframe.style.pointerEvents = 'none';
    iframe.src = url;

    let printed = false;
    const triggerPrint = () => {
      if (printed) return;
      printed = true;
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        built.doc.save(built.fileName);
      }
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
        URL.revokeObjectURL(url);
      }, 10000);
    };

    iframe.onload = () => {
      setTimeout(triggerPrint, 250);
    };

    document.body.appendChild(iframe);

    // Safety fallback if browser PDF viewer doesn't fire onload promptly
    setTimeout(() => {
      if (!printed) {
        triggerPrint();
      }
    }, 1500);

    return {
      success: true,
      fileName: built.fileName,
      mode: 'print',
      pageCount: built.pageCount,
    };
  } catch (err) {
    console.warn('PDF print fallback to direct save:', err);
    built.doc.save(built.fileName);
    return {
      success: true,
      fileName: built.fileName,
      mode: 'download',
      pageCount: built.pageCount,
    };
  }
}
