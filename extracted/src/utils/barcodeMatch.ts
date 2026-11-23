import { Product } from '../types/accounting';

/**
 * Normalize Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Eastern Arabic digits (۰۱۲۳۴۵۶۷۸۹)
 * to standard ASCII digits (0123456789) and trim whitespace.
 */
export function normalizeBarcodeInput(raw: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  let out = '';
  for (const ch of raw.trim()) {
    const idx1 = arabicIndic.indexOf(ch);
    if (idx1 !== -1) {
      out += String(idx1);
      continue;
    }
    const idx2 = easternArabic.indexOf(ch);
    if (idx2 !== -1) {
      out += String(idx2);
      continue;
    }
    out += ch;
  }
  return out.trim();
}

export interface BarcodeMatchResult {
  product: Product | null;
  matchedBy: 'barcode' | 'code' | 'id' | 'name' | null;
  normalizedQuery: string;
}

/**
 * Match a scanned barcode or typed product code against inventory products.
 * Priority:
 * 1. Exact match on `product.barcode`
 * 2. Exact match on `product.code`
 * 3. Exact match on `product.id`
 * 4. Unique prefix/substring match on `barcode` / `code` / `name` (only if query >= 3 chars)
 */
export function findProductByBarcode(
  products: Product[],
  rawCode: string
): BarcodeMatchResult {
  const normalized = normalizeBarcodeInput(rawCode);
  if (!normalized) {
    return { product: null, matchedBy: null, normalizedQuery: '' };
  }

  const q = normalized.toLowerCase();

  // 1. Exact barcode field match
  const exactBarcode = products.find(
    (p) => p.barcode && normalizeBarcodeInput(p.barcode).toLowerCase() === q
  );
  if (exactBarcode) {
    return { product: exactBarcode, matchedBy: 'barcode', normalizedQuery: normalized };
  }

  // 2. Exact product code match
  const exactCode = products.find(
    (p) => p.code && normalizeBarcodeInput(p.code).toLowerCase() === q
  );
  if (exactCode) {
    return { product: exactCode, matchedBy: 'code', normalizedQuery: normalized };
  }

  // 3. Exact product id match
  const exactId = products.find(
    (p) => p.id && p.id.trim().toLowerCase() === q
  );
  if (exactId) {
    return { product: exactId, matchedBy: 'id', normalizedQuery: normalized };
  }

  // 4. Unique fallback match when typing partial code or barcode
  if (q.length >= 3) {
    const codeMatches = products.filter(
      (p) =>
        (p.barcode && normalizeBarcodeInput(p.barcode).toLowerCase().includes(q)) ||
        (p.code && normalizeBarcodeInput(p.code).toLowerCase().includes(q))
    );
    if (codeMatches.length === 1) {
      return { product: codeMatches[0], matchedBy: 'code', normalizedQuery: normalized };
    }
  }

  return { product: null, matchedBy: null, normalizedQuery: normalized };
}

/**
 * Subtle offline-safe Web Audio API confirmation beep for barcode scans.
 */
export function playScanBeep(success: boolean = true): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = success ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(success ? 1320 : 320, ctx.currentTime);
    if (!success) {
      osc.frequency.setValueAtTime(240, ctx.currentTime + 0.09);
    }

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.11 : 0.2));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.12 : 0.21));
    osc.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch {
    // Ignore audio errors on restricted devices
  }
}
