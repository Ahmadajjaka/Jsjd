export interface PriceTierSuggestion {
  id: 'economy' | 'recommended' | 'premium';
  labelArabic: string;
  price: number;
  marginPercent: number;
  profitPerUnit: number;
}

export interface SellingPriceEvaluation {
  profitPerUnit: number;
  markupPercent: number;
  marginOnSalePercent: number;
  status: 'loss' | 'breakeven' | 'thin' | 'healthy' | 'high';
  statusArabic: string;
}

export interface PriceSuggestionResult {
  costPrice: number;
  recommendedMarginPercent: number;
  recommendedPrice: number;
  economyPrice: number;
  economyMarginPercent: number;
  premiumPrice: number;
  premiumMarginPercent: number;
  tiers: PriceTierSuggestion[];
  storeCategoryAvgMargin: number | null;
  lastSoldPrice: number | null;
  averageSoldPrice: number | null;
  currentEvaluation: SellingPriceEvaluation | null;
}

const DECIMAL_CURRENCIES = new Set([
  'USD',
  'SAR',
  'AED',
  'JOD',
  'EGP',
  'KWD',
  'QAR',
  'TRY',
]);

/**
 * Returns default hardware-store target markup (%) tailored to product category.
 */
export function getCategoryDefaultMarginPercent(category?: string): number {
  const cat = (category || '').trim();
  if (cat.includes('كهربائ')) return 28;
  if (cat.includes('صحي')) return 32;
  if (cat.includes('بناء')) return 22;
  if (cat.includes('عام')) return 35;
  return 30;
}

/**
 * Rounds raw calculated selling price cleanly according to currency denomination
 * so cashiers work with practical cash-drawer figures (e.g. nearest 500 or 100 in SYP).
 */
export function roundSuggestedPrice(rawPrice: number, currency: string = 'SYP'): number {
  const safe = Number(rawPrice);
  if (!Number.isFinite(safe) || safe <= 0) return 0;

  const isDecimalCurrency = DECIMAL_CURRENCIES.has(currency.toUpperCase());

  if (isDecimalCurrency && safe < 500) {
    if (safe >= 100) return Math.round(safe);
    if (safe >= 10) return Math.round(safe * 2) / 2;
    return Math.round(safe * 100) / 100;
  }

  if (safe >= 100000) return Math.round(safe / 1000) * 1000;
  if (safe >= 10000) return Math.round(safe / 500) * 500;
  if (safe >= 1000) return Math.round(safe / 100) * 100;
  if (safe >= 200) return Math.round(safe / 25) * 25;
  if (safe >= 20) return Math.round(safe / 5) * 5;
  return Math.round(safe);
}

/**
 * Computes store-wide average markup percentage from existing profitable items in the same category.
 */
export function computeStoreCategoryAvgMargin(
  category: string | undefined,
  storeProducts?: Array<{ category?: string; costPrice: number; sellingPrice: number }>
): number | null {
  if (!storeProducts || storeProducts.length === 0) return null;
  const targetCat = (category || '').trim();

  const matching = storeProducts.filter((p) => {
    if (!(p.costPrice > 0 && p.sellingPrice > p.costPrice)) return false;
    if (!targetCat) return true;
    const pCat = (p.category || '').trim();
    return pCat === targetCat || (targetCat.length >= 3 && pCat.includes(targetCat.slice(0, 3)));
  });

  if (matching.length < 2) return null;

  const margins = matching.map((p) => ((p.sellingPrice - p.costPrice) / p.costPrice) * 100);
  const avg = margins.reduce((s, m) => s + m, 0) / margins.length;
  return Math.round(Math.max(12, Math.min(65, avg)));
}

/**
 * Extracts latest and average actual selling prices for a specific product from past invoices.
 */
export function extractHistoricalProductPrices(
  productId: string | undefined,
  sales?: Array<{
    status?: string;
    items: Array<{ productId?: string; unitPrice: number }>;
  }>
): { lastSoldPrice: number | null; averageSoldPrice: number | null } {
  if (!productId || !sales || sales.length === 0) {
    return { lastSoldPrice: null, averageSoldPrice: null };
  }

  const prices: number[] = [];
  for (const inv of sales) {
    if (inv.status === 'returned' || inv.status === 'cancelled') continue;
    for (const item of inv.items || []) {
      if (item.productId === productId && Number(item.unitPrice) > 0) {
        prices.push(Number(item.unitPrice));
      }
    }
  }

  if (prices.length === 0) {
    return { lastSoldPrice: null, averageSoldPrice: null };
  }

  const sum = prices.reduce((a, b) => a + b, 0);
  return {
    lastSoldPrice: prices[prices.length - 1],
    averageSoldPrice: Math.round((sum / prices.length) * 100) / 100,
  };
}

/**
 * Evaluates a candidate selling price against unit cost for real-time cashier feedback.
 */
export function evaluateSellingPrice(
  costPrice: number,
  sellingPrice: number
): SellingPriceEvaluation | null {
  const safeCost = Math.max(0, Number(costPrice) || 0);
  const safePrice = Number(sellingPrice);
  if (!Number.isFinite(safePrice) || safePrice < 0) return null;
  if (safeCost <= 0 && safePrice <= 0) return null;

  const profitPerUnit = Math.round((safePrice - safeCost) * 100) / 100;
  const markupPercent =
    safeCost > 0 ? Math.round(((safePrice - safeCost) / safeCost) * 1000) / 10 : 0;
  const marginOnSalePercent =
    safePrice > 0 ? Math.round(((safePrice - safeCost) / safePrice) * 1000) / 10 : 0;

  let status: SellingPriceEvaluation['status'] = 'healthy';
  let statusArabic = 'ربح متوازن';

  if (safePrice < safeCost) {
    status = 'loss';
    statusArabic = 'خسارة! أقل من التكلفة';
  } else if (safePrice === safeCost && safeCost > 0) {
    status = 'breakeven';
    statusArabic = 'رأس برأس (بدون ربح)';
  } else if (safeCost > 0 && markupPercent < 12) {
    status = 'thin';
    statusArabic = 'هامش ربح منخفض';
  } else if (safeCost > 0 && markupPercent >= 42) {
    status = 'high';
    statusArabic = 'ربح مرتفع';
  }

  return {
    profitPerUnit,
    markupPercent,
    marginOnSalePercent,
    status,
    statusArabic,
  };
}

/**
 * Main smart selling price suggestion entry point.
 * Blends category standards, existing store catalog margins, and past sale history.
 */
export function computeSuggestedSellingPrices(params: {
  costPrice: number;
  category?: string;
  currency?: string;
  productId?: string;
  storeProducts?: Array<{ category?: string; costPrice: number; sellingPrice: number }>;
  historicalSales?: Array<{
    status?: string;
    items: Array<{ productId?: string; unitPrice: number }>;
  }>;
  currentSellingPrice?: number;
}): PriceSuggestionResult {
  const safeCost = Math.max(0, Number(params.costPrice) || 0);
  const currency = params.currency || 'SYP';
  const baseMargin = getCategoryDefaultMarginPercent(params.category);
  const storeCategoryAvgMargin = computeStoreCategoryAvgMargin(
    params.category,
    params.storeProducts
  );

  // Blend store's actual category margin (60% weight) with hardware category baseline (40% weight)
  const recommendedMarginPercent =
    storeCategoryAvgMargin !== null
      ? Math.round(storeCategoryAvgMargin * 0.6 + baseMargin * 0.4)
      : baseMargin;

  const economyMarginPercent = Math.max(10, Math.round(recommendedMarginPercent * 0.55));
  const premiumMarginPercent = Math.min(75, Math.round(recommendedMarginPercent * 1.45));

  const calcTierPrice = (marginPct: number): number => {
    if (safeCost <= 0) return 0;
    const raw = safeCost * (1 + marginPct / 100);
    const rounded = roundSuggestedPrice(raw, currency);
    // Ensure rounded price never accidentally dips below cost due to rounding down
    if (rounded < safeCost) {
      return roundSuggestedPrice(Math.ceil(raw), currency) || Math.ceil(raw);
    }
    return rounded;
  };

  const economyPrice = calcTierPrice(economyMarginPercent);
  const recommendedPrice = calcTierPrice(recommendedMarginPercent);
  const premiumPrice = calcTierPrice(premiumMarginPercent);

  const { lastSoldPrice, averageSoldPrice } = extractHistoricalProductPrices(
    params.productId,
    params.historicalSales
  );

  const tiers: PriceTierSuggestion[] = [
    {
      id: 'economy',
      labelArabic: `جملة / سريع (+${economyMarginPercent}%)`,
      price: economyPrice,
      marginPercent:
        safeCost > 0
          ? Math.round(((economyPrice - safeCost) / safeCost) * 100)
          : economyMarginPercent,
      profitPerUnit: Math.round((economyPrice - safeCost) * 100) / 100,
    },
    {
      id: 'recommended',
      labelArabic: `المقترح (+${recommendedMarginPercent}%)`,
      price: recommendedPrice,
      marginPercent:
        safeCost > 0
          ? Math.round(((recommendedPrice - safeCost) / safeCost) * 100)
          : recommendedMarginPercent,
      profitPerUnit: Math.round((recommendedPrice - safeCost) * 100) / 100,
    },
    {
      id: 'premium',
      labelArabic: `قطاعي ممتاز (+${premiumMarginPercent}%)`,
      price: premiumPrice,
      marginPercent:
        safeCost > 0
          ? Math.round(((premiumPrice - safeCost) / safeCost) * 100)
          : premiumMarginPercent,
      profitPerUnit: Math.round((premiumPrice - safeCost) * 100) / 100,
    },
  ];

  const currentEvaluation =
    params.currentSellingPrice !== undefined
      ? evaluateSellingPrice(safeCost, params.currentSellingPrice)
      : null;

  return {
    costPrice: safeCost,
    recommendedMarginPercent,
    recommendedPrice,
    economyPrice,
    economyMarginPercent,
    premiumPrice,
    premiumMarginPercent,
    tiers,
    storeCategoryAvgMargin,
    lastSoldPrice,
    averageSoldPrice,
    currentEvaluation,
  };
}
