import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSuggestedSellingPrices,
  evaluateSellingPrice,
  getCategoryDefaultMarginPercent,
  roundSuggestedPrice,
} from './priceSuggestion';

test('getCategoryDefaultMarginPercent returns hardware-specific category margins', () => {
  assert.equal(getCategoryDefaultMarginPercent('كهربائية'), 28);
  assert.equal(getCategoryDefaultMarginPercent('صحية'), 32);
  assert.equal(getCategoryDefaultMarginPercent('بناء'), 22);
  assert.equal(getCategoryDefaultMarginPercent('عامة'), 35);
});

test('roundSuggestedPrice rounds cash-friendly prices for SYP and decimal currencies', () => {
  assert.equal(roundSuggestedPrice(13240, 'SYP'), 13000);
  assert.equal(roundSuggestedPrice(13400, 'SYP'), 13500);
  assert.equal(roundSuggestedPrice(1280, 'SYP'), 1300);
  assert.equal(roundSuggestedPrice(12.34, 'USD'), 12.5);
  assert.equal(roundSuggestedPrice(0, 'SYP'), 0);
});

test('computeSuggestedSellingPrices generates economy, recommended, and premium tiers above cost', () => {
  const result = computeSuggestedSellingPrices({
    costPrice: 10000,
    category: 'عامة',
    currency: 'SYP',
    currentSellingPrice: 13500,
  });

  assert.equal(result.recommendedMarginPercent, 35);
  assert.equal(result.recommendedPrice, 13500);
  assert.ok(result.economyPrice > 10000 && result.economyPrice < result.recommendedPrice);
  assert.ok(result.premiumPrice > result.recommendedPrice);
  assert.equal(result.tiers.length, 3);
  assert.equal(result.currentEvaluation?.profitPerUnit, 3500);
  assert.equal(result.currentEvaluation?.status, 'healthy');
});

test('computeSuggestedSellingPrices blends store category margin and extracts last sold price', () => {
  const result = computeSuggestedSellingPrices({
    costPrice: 5000,
    category: 'كهربائية',
    currency: 'SYP',
    productId: 'p-1',
    storeProducts: [
      { category: 'كهربائية', costPrice: 1000, sellingPrice: 1400 }, // 40%
      { category: 'كهربائية', costPrice: 2000, sellingPrice: 2800 }, // 40%
    ],
    historicalSales: [
      { status: 'completed', items: [{ productId: 'p-1', unitPrice: 6600 }] },
      { status: 'returned', items: [{ productId: 'p-1', unitPrice: 9900 }] }, // ignored
      { status: 'completed', items: [{ productId: 'p-1', unitPrice: 6800 }] },
    ],
  });

  assert.equal(result.storeCategoryAvgMargin, 40);
  assert.equal(result.recommendedMarginPercent, 35); // 40*0.6 + 28*0.4 = 35.2 -> 35
  assert.equal(result.lastSoldPrice, 6800);
  assert.equal(result.averageSoldPrice, 6700);
});

test('evaluateSellingPrice warns when selling below cost or at breakeven', () => {
  const loss = evaluateSellingPrice(1000, 800);
  assert.equal(loss?.status, 'loss');
  assert.equal(loss?.profitPerUnit, -200);

  const even = evaluateSellingPrice(1000, 1000);
  assert.equal(even?.status, 'breakeven');

  const thin = evaluateSellingPrice(1000, 1050);
  assert.equal(thin?.status, 'thin');
});
