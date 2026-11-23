import React, { useState } from 'react';
import {
  Printer,
  X,
  Store,
  Phone,
  MapPin,
  Calendar,
  Clock,
  Receipt,
  FileText,
  Sparkles,
  Barcode as BarcodeIcon,
  Download,
} from 'lucide-react';
import { SaleInvoice, StoreSettings } from '../types/accounting';
import { formatCurrency, formatNumber } from '../utils/accounting';
import { exportInvoicePdf } from '../utils/pdfExport';

interface InvoiceModalProps {
  invoice: SaleInvoice | null;
  settings: StoreSettings;
  onClose: () => void;
}

/**
 * Simple SVG Barcode generator for POS thermal receipts
 */
const ThermalBarcode: React.FC<{ code: string }> = ({ code }) => {
  // Generate consistent pseudo bar widths from code string
  const bars: number[] = [];
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push((charCode % 3) + 1, 1, ((charCode >> 1) % 2) + 1, 1, (charCode % 2) + 1);
  }
  // Add guard patterns
  const allBars = [2, 1, 1, ...bars, 1, 2, 1, 2];

  let currentX = 10;
  return (
    <div className="flex flex-col items-center justify-center my-2 text-black">
      <svg
        viewBox="0 0 240 38"
        className="w-44 h-8 max-w-full"
        preserveAspectRatio="none"
      >
        {allBars.map((width, idx) => {
          const x = currentX;
          currentX += width * 2;
          // Alternate black bar and white gap
          if (idx % 2 === 0) {
            return (
              <rect
                key={idx}
                x={x}
                y={0}
                width={width * 1.6}
                height={38}
                fill="#000000"
              />
            );
          }
          return null;
        })}
      </svg>
      <span className="text-[10px] font-mono tracking-widest mt-0.5 font-bold">
        *{code}*
      </span>
    </div>
  );
};

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  settings,
  onClose,
}) => {
  const [layoutMode, setLayoutMode] = useState<'thermal80' | 'standard'>(() => {
    return settings.invoicePrintLayout || 'thermal80';
  });
  const [pdfFeedback, setPdfFeedback] = useState<string | null>(null);

  if (!invoice) return null;

  const showFeedback = (msg: string) => {
    setPdfFeedback(msg);
    setTimeout(() => setPdfFeedback(null), 3500);
  };

  const handlePrint = () => {
    try {
      const res = exportInvoicePdf(invoice, settings, layoutMode, false);
      showFeedback(`تم تجهيز الفاتورة (${res.fileName}) للطباعة عبر jsPDF`);
    } catch (e) {
      console.warn('Fallback to standard window.print:', e);
      window.print();
    }
  };

  const handleDownload = () => {
    const res = exportInvoicePdf(invoice, settings, layoutMode, true);
    showFeedback(`تم تنزيل ملف PDF: ${res.fileName}`);
  };

  const isThermal = layoutMode === 'thermal80';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      {/* Dynamic Print CSS for Thermal 80mm vs Standard A4 */}
      <style
        dangerouslySetInnerHTML={{
          __html: isThermal
            ? `
            @media print {
              @page {
                size: 80mm auto;
                margin: 0;
              }
              html, body {
                width: 80mm !important;
                max-width: 80mm !important;
                margin: 0 auto !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              header, aside, .print\\:hidden {
                display: none !important;
              }
              #printable-invoice {
                width: 76mm !important;
                max-width: 76mm !important;
                margin: 0 auto !important;
                padding: 2.5mm 1mm !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                font-family: 'Cairo', monospace, sans-serif !important;
                font-size: 11px !important;
                line-height: 1.25 !important;
              }
              .thermal-dotted {
                border-top: 1px dashed #000000 !important;
              }
              .thermal-double {
                border-top: 2px dashed #000000 !important;
              }
            }
          `
            : `
            @media print {
              @page {
                size: A4 portrait;
                margin: 8mm;
              }
              html, body {
                width: 100% !important;
                background: #ffffff !important;
                color: #0f172a !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              header, aside, .print\\:hidden {
                display: none !important;
              }
              #printable-invoice {
                width: 100% !important;
                max-width: 100% !important;
                padding: 0 !important;
                box-shadow: none !important;
                border: none !important;
                border-radius: 0 !important;
                background: #ffffff !important;
              }
            }
          `,
        }}
      />

      <div
        className={`relative w-full ${
          isThermal ? 'max-w-md' : 'max-w-3xl'
        } bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-4 transition-all duration-200`}
      >
        {/* Header Actions (hidden in print) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white print:hidden space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Store className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="truncate">
                <span className="font-bold text-sm block truncate">
                  معاينة الفاتورة - {invoice.invoiceNumber}
                </span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {invoice.customerName} · {invoice.date}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">طباعة / PDF</span>
                <span className="sm:hidden">طباعة</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="إغلاق الفاتورة"
                className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Format Selector Bar */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">
              تنسيق الورقة:
            </span>
            <div className="flex items-center gap-1 bg-slate-850 p-1 rounded-xl border border-slate-700/60">
              <button
                type="button"
                onClick={() => setLayoutMode('thermal80')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isThermal
                    ? 'bg-amber-500 text-slate-950 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>حراري (80 مم)</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                    isThermal
                      ? 'bg-amber-600 text-white'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  موفر للورق
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLayoutMode('standard')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  !isThermal
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>عادي (A4)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Printable Invoice Container */}
        <div className="p-4 sm:p-6 max-h-[75vh] overflow-y-auto bg-slate-50/50">
          <div
            id="printable-invoice"
            className={`bg-white transition-all ${
              isThermal
                ? 'w-full max-w-[340px] mx-auto p-4 sm:p-5 border border-slate-200 shadow-sm rounded-xl text-slate-950 font-mono text-[11px] leading-snug'
                : 'w-full p-6 sm:p-8 border border-slate-200 shadow-sm rounded-2xl text-slate-900 space-y-6 text-xs'
            }`}
          >
            {/* ============================================================== */}
            {/* THERMAL 80MM COMPACT LAYOUT (PAPER-SAVING & CONDENSED)         */}
            {/* ============================================================== */}
            {isThermal ? (
              <div className="space-y-2.5 thermal-receipt">
                {/* Store Header */}
                <div className="text-center space-y-1">
                  <h2 className="text-lg font-black tracking-tight text-slate-950 font-sans">
                    {settings.storeName}
                  </h2>
                  <p className="text-[10px] text-slate-600 font-sans font-medium">
                    {settings.storeTagline}
                  </p>
                  <div className="text-[10px] text-slate-700 flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
                    <span>هاتف: {settings.phone}</span>
                    {settings.address && <span>· {settings.address}</span>}
                    {settings.taxNumber && (
                      <span>· ض. {settings.taxNumber}</span>
                    )}
                  </div>
                  {settings.invoiceHeaderNote && (
                    <p className="text-[10px] text-slate-800 font-sans italic pt-0.5">
                      {settings.invoiceHeaderNote}
                    </p>
                  )}
                </div>

                {/* Dashed separator */}
                <div className="border-t border-dashed border-slate-400 thermal-dotted my-2"></div>

                {/* Metadata Row */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between items-center font-bold">
                    <span>فاتورة مبيعات:</span>
                    <span className="font-mono text-xs">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-700 text-[10px]">
                    <span>التاريخ والوقت:</span>
                    <span className="font-mono">
                      {invoice.date} {invoice.time}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">الزبون:</span>
                    <span className="font-bold text-slate-900">
                      {invoice.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">طريقة الدفع:</span>
                    <span className="font-semibold text-slate-900">
                      {invoice.paymentMethod === 'cash'
                        ? 'نقداً'
                        : invoice.paymentMethod === 'debt'
                        ? 'آجل (ذمة)'
                        : 'دفعة جزئية'}
                    </span>
                  </div>
                </div>

                {/* Return/Cancel Alert */}
                {invoice.status !== 'completed' && (
                  <div className="p-1.5 bg-rose-50 border border-rose-300 rounded text-rose-800 text-[10px] font-bold text-center">
                    حالة الفاتورة: {invoice.status === 'returned' ? 'مرتجعة' : 'ملغاة'}
                    {invoice.returnReason ? ` (${invoice.returnReason})` : ''}
                  </div>
                )}

                {/* Dashed separator */}
                <div className="border-t border-dashed border-slate-400 thermal-dotted my-2"></div>

                {/* Condensed Items Table (No wasted space) */}
                <div>
                  <div className="flex justify-between items-center text-[10px] font-bold pb-1 text-slate-800 border-b border-slate-300">
                    <span className="w-1/2 text-right">المادة</span>
                    <span className="w-1/4 text-center">الكمية</span>
                    <span className="w-1/4 text-left">الإجمالي</span>
                  </div>

                  <div className="divide-y divide-dashed divide-slate-200 py-1 space-y-1">
                    {invoice.items.map((item, index) => {
                      const hasDiscount = item.discount > 0;
                      return (
                        <div key={index} className="pt-1 text-[11px]">
                          <div className="flex justify-between items-baseline font-bold text-slate-950">
                            <span className="truncate pr-1">
                              {index + 1}. {item.productName}
                            </span>
                            <span className="font-mono tabular-nums text-left shrink-0">
                              {formatCurrency(item.total, settings)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px] text-slate-600 font-mono">
                            <span>
                              {formatNumber(item.quantity)} {item.unit} × {formatCurrency(item.unitPrice, settings)}
                            </span>
                            {hasDiscount && (
                              <span className="text-rose-700">
                                خصم: -{formatCurrency(item.discount, settings)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Dashed separator */}
                <div className="border-t border-dashed border-slate-400 thermal-dotted my-2"></div>

                {/* Condensed Financial Totals */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between items-center text-slate-700 text-[10px]">
                    <span>عدد الأصناف:</span>
                    <span className="font-mono font-bold">
                      {invoice.items.length} صنف (
                      {invoice.items.reduce((s, i) => s + i.quantity, 0)} قطعة)
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-slate-700">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(invoice.subtotal, settings)}
                    </span>
                  </div>

                  {invoice.discount > 0 && (
                    <div className="flex justify-between items-center text-rose-700 font-semibold">
                      <span>خصم الفاتورة:</span>
                      <span className="font-mono tabular-nums">
                        - {formatCurrency(invoice.discount, settings)}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center font-black text-xs text-slate-950 py-1 px-1.5 bg-slate-100 rounded border border-slate-200">
                    <span>الصافي الإجمالي:</span>
                    <span className="font-mono text-sm tabular-nums">
                      {formatCurrency(invoice.total, settings)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-800 font-bold pt-0.5">
                    <span>المسدد (المقبوض):</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrency(invoice.paidAmount, settings)}
                    </span>
                  </div>

                  {invoice.remainingAmount > 0 && (
                    <div className="flex justify-between items-center text-rose-800 font-black py-0.5 border-t border-dotted border-rose-200">
                      <span>المتبقي في الذمة:</span>
                      <span className="font-mono text-xs tabular-nums">
                        {formatCurrency(invoice.remainingAmount, settings)}
                      </span>
                    </div>
                  )}

                  {invoice.notes && (
                    <div className="pt-1 text-[10px] text-slate-600 font-sans border-t border-dotted border-slate-300">
                      <span className="font-bold">ملاحظة: </span>
                      <span>{invoice.notes}</span>
                    </div>
                  )}
                </div>

                {/* Double line before footer */}
                <div className="border-t-2 border-dashed border-slate-500 thermal-double my-2.5"></div>

                {/* Thermal Footer */}
                <div className="text-center space-y-1 font-sans">
                  <p className="text-[11px] font-bold text-slate-900">
                    شكراً لزيارتكم وتعاملكم معنا
                  </p>
                  <p className="text-[9px] text-slate-600 leading-tight">
                    {settings.invoiceFooterNote}
                  </p>

                  {/* Clean simulated Barcode for 80mm thermal paper */}
                  <ThermalBarcode code={invoice.invoiceNumber} />

                  <p className="text-[8px] text-slate-400 font-mono">
                    طُبعت: {new Date().toLocaleDateString('ar-SA')} · خردوات المامو
                  </p>
                </div>
              </div>
            ) : (
              /* ============================================================== */
              /* STANDARD A4 FULL LAYOUT                                        */
              /* ============================================================== */
              <div className="space-y-6">
                {/* Store Header */}
                <div className="text-center border-b border-slate-200 pb-5">
                  <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    {settings.storeName}
                  </h2>
                  <p className="text-xs md:text-sm font-semibold text-slate-600 mt-1">
                    {settings.storeTagline}
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {settings.phone}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {settings.address}
                    </span>
                    {settings.taxNumber && (
                      <>
                        <span>·</span>
                        <span>الرقم الضريبي: {settings.taxNumber}</span>
                      </>
                    )}
                  </div>
                  {settings.invoiceHeaderNote && (
                    <p className="text-xs text-amber-700 font-medium mt-2">
                      {settings.invoiceHeaderNote}
                    </p>
                  )}
                </div>

                {/* Invoice Metadata Row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">رقم الفاتورة:</span>
                    <span className="font-bold font-mono text-slate-900 text-sm">
                      {invoice.invoiceNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">التاريخ والوقت:</span>
                    <span className="font-semibold text-slate-800 font-mono">
                      {invoice.date} · {invoice.time}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">اسم الزبون:</span>
                    <span className="font-bold text-slate-900">
                      {invoice.customerName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">طريقة الدفع:</span>
                    <span className="font-bold text-slate-900">
                      {invoice.paymentMethod === 'cash'
                        ? 'نقداً بالكامل'
                        : invoice.paymentMethod === 'debt'
                        ? 'آجل (دين بالكامل)'
                        : 'دفعة جزئية'}
                    </span>
                  </div>
                </div>

                {/* Status Alert if Cancelled/Returned */}
                {invoice.status !== 'completed' && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-xs font-bold text-center">
                    حالة الفاتورة: {invoice.status === 'returned' ? 'مرتجعة' : 'ملغاة'}
                    {invoice.returnReason ? ` - السبب: ${invoice.returnReason}` : ''}
                  </div>
                )}

                {/* Items Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">المادة المباعة</th>
                        <th className="py-2.5 px-3">التصنيف</th>
                        <th className="py-2.5 px-3 text-center">الكمية</th>
                        <th className="py-2.5 px-3 text-center">الوحدة</th>
                        <th className="py-2.5 px-3 text-left">السعر الإفرادي</th>
                        <th className="py-2.5 px-3 text-left">الخصم</th>
                        <th className="py-2.5 px-3 text-left">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoice.items.map((item, index) => (
                        <tr key={index} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-slate-400">
                            {index + 1}
                          </td>
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {item.productName}
                          </td>
                          <td className="py-2 px-3 text-slate-500">
                            {item.category}
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold">
                            {formatNumber(item.quantity)}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-600">
                            {item.unit}
                          </td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums">
                            {formatCurrency(item.unitPrice, settings)}
                          </td>
                          <td className="py-2 px-3 text-left font-mono tabular-nums text-rose-600">
                            {item.discount > 0
                              ? formatCurrency(item.discount, settings)
                              : '-'}
                          </td>
                          <td className="py-2 px-3 text-left font-mono font-bold text-slate-900 tabular-nums">
                            {formatCurrency(item.total, settings)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Totals Calculation Box */}
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="w-full md:w-1/2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                    <span className="font-bold text-slate-700 block">
                      ملاحظات الفاتورة:
                    </span>
                    <p className="text-slate-600">
                      {invoice.notes || 'لا توجد ملاحظات إضافية.'}
                    </p>
                  </div>

                  <div className="w-full md:w-1/2 p-4 bg-slate-100/70 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>المجموع الفرعي:</span>
                      <span className="font-mono tabular-nums font-semibold">
                        {formatCurrency(invoice.subtotal, settings)}
                      </span>
                    </div>

                    {invoice.discount > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>خصم إضافي:</span>
                        <span className="font-mono tabular-nums font-semibold">
                          - {formatCurrency(invoice.discount, settings)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-300 pt-2">
                      <span>إجمالي الفاتورة:</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(invoice.total, settings)}
                      </span>
                    </div>

                    <div className="flex justify-between text-emerald-800 font-bold border-t border-slate-200 pt-1.5">
                      <span>المبلغ المدفوع (المقبوض):</span>
                      <span className="font-mono tabular-nums">
                        {formatCurrency(invoice.paidAmount, settings)}
                      </span>
                    </div>

                    {invoice.remainingAmount > 0 && (
                      <div className="flex justify-between text-rose-700 font-bold">
                        <span>المبلغ المتبقي دين:</span>
                        <span className="font-mono tabular-nums">
                          {formatCurrency(invoice.remainingAmount, settings)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Note and Thank you */}
                <div className="text-center border-t border-slate-200 pt-4 space-y-1">
                  <p className="text-sm font-bold text-slate-800">
                    شكراً لتعاملكم مع خردوات المامو
                  </p>
                  <p className="text-xs text-slate-500">
                    {settings.invoiceFooterNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-100 border-t border-slate-200 print:hidden text-xs">
          <div className="flex items-center gap-2 text-slate-600 min-w-0">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            {pdfFeedback ? (
              <span className="font-bold text-emerald-700 truncate">{pdfFeedback}</span>
            ) : (
              <span className="truncate">
                {isThermal
                  ? 'تنسيق jsPDF: إيصال حراري (80 مم) موفر للورق وسريع الطباعة'
                  : 'تنسيق jsPDF: فاتورة عادية (A4) كاملة للطابعات المكتبية'}
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 rounded-xl transition-colors shadow-xs cursor-pointer"
              title="تنزيل نسخة أصلية من الفاتورة بصيغة PDF عبر مكتبة jsPDF"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تنزيل PDF</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>
                {isThermal ? 'طباعة PDF (80 مم)' : 'طباعة PDF (A4)'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
