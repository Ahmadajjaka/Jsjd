import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMathExpression, extractAndComputeMath } from './aiCalculator';
import { parseAiActions, executeAiAction, AiActionHandlers } from './aiActionEngine';
import { AppState, DEFAULT_SETTINGS } from './storage';
import { Product, SaleInvoice, StoreSettings } from '../types/accounting';

const BASE_SETTINGS: StoreSettings = {
  ...DEFAULT_SETTINGS,
  initialCash: 50000,
};

function makeState(): AppState {
  const prod: Product = {
    id: 'prod-1',
    code: 'EL-100',
    name: 'سلك كهربائي 4 مم',
    category: 'كهربائية',
    unit: 'متر',
    costPrice: 2000,
    sellingPrice: 3000,
    currentStock: 100,
    minStock: 10,
    barcode: '628100001',
    createdAt: '2026-11-18',
    updatedAt: '2026-11-18',
  };
  return {
    settings: { ...BASE_SETTINGS },
    products: [prod],
    customers: [
      {
        id: 'cust-1',
        name: 'أحمد العلي',
        phone: '0944556677',
        totalPurchases: 0,
        totalPaid: 0,
        totalDebt: 0,
        createdAt: '2026-11-18',
      },
    ],
    suppliers: [],
    sales: [],
    purchases: [],
    expenses: [],
    customerPayments: [],
    supplierPayments: [],
    cashTransactions: [],
    inventoryAdjustments: [],
    auditLogs: [],
    loginAttempts: [],
    accessRequests: [],
    users: [],
    currentUser: null,
    isLocked: false,
  };
}

test('evaluateMathExpression safely computes arithmetic, parentheses, percentages, and Arabic digits', () => {
  assert.equal(evaluateMathExpression('(15000 * 4) + 5000').value, 65000);
  assert.equal(evaluateMathExpression('1000 + 15%').value, 1150);
  assert.equal(evaluateMathExpression('200 - 10%').value, 180);
  assert.equal(evaluateMathExpression('١٥٠٠ * ٢ + ٥٠٠').value, 3500);
  assert.throws(() => evaluateMathExpression('100 / 0'));
});

test('extractAndComputeMath computes margin and percentage discounts from Arabic text', () => {
  const margin = extractAndComputeMath('احسب هامش الربح تكلفة 18000 بيع 24000');
  assert.ok(margin);
  assert.equal(margin.value, 6000);
  assert.match(margin.explanation || '', /25%/);

  const discount = extractAndComputeMath('احسب خصم 15% على 200000');
  assert.ok(discount);
  assert.equal(discount.value, 170000);
});

test('parseAiActions parses multi-action JSON block and strips raw code fence', () => {
  const raw = `تم تجهيز الإجراءات:
\`\`\`json:action
{
  "actions": [
    { "action": "add_product", "title": "إضافة قاطع", "data": { "name": "قاطع 16A", "costPrice": 10000, "sellingPrice": 14000, "currentStock": 10 } },
    { "action": "calculate", "title": "حساب", "data": { "expression": "14000 * 10" } }
  ]
}
\`\`\``;
  const parsed = parseAiActions(raw, '');
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[0].action, 'add_product');
  assert.equal(parsed.actions[1].action, 'calculate');
  assert.equal(parsed.cleanText, 'تم تجهيز الإجراءات:');
});

test('executeAiAction handles add_product, create_sale, return_sale, delete_product, update_settings, and calculate', async () => {
  const state = makeState();
  const savedProducts: Product[] = [];
  const deletedProducts: string[] = [];
  const savedSales: SaleInvoice[] = [];
  const returnedSales: { id: string; reason: string }[] = [];
  const updatedSettingsList: StoreSettings[] = [];

  const handlers: AiActionHandlers = {
    onSaveProduct: (p) => {
      savedProducts.push(p);
      state.products.push(p);
    },
    onDeleteProduct: (id) => deletedProducts.push(id),
    onSaveSale: (inv) => {
      savedSales.push(inv);
      state.sales.push(inv);
    },
    onReturnSale: (id, reason) => returnedSales.push({ id, reason }),
    onSaveExpense: () => {},
    onSaveCustomer: () => {},
    onSaveSupplier: () => {},
    onRecordCustomerPayment: () => {},
    onRecordSupplierPayment: () => {},
    onAdjustStock: () => {},
    onAddCashTransaction: () => {},
    onUpdateSettings: (s) => {
      updatedSettingsList.push(s);
      state.settings = s;
    },
    onNavigate: () => {},
    cashBalance: 75000,
  };

  // 1. Add product via Arabic command
  const addParsed = parseAiActions('', 'أضف مادة جديدة باسم مفتاح 16 امبير، تكلفة 5000، بيع 7000، كمية 25', state);
  assert.equal(addParsed.actions[0]?.action, 'add_product');
  const addRes = await executeAiAction(addParsed.actions[0], handlers, state);
  assert.equal(addRes.success, true);
  assert.equal(savedProducts.length, 1);

  // 2. Create real sale matching existing product
  const saleParsed = parseAiActions('', 'بع 5 متر من سلك كهربائي 4 مم للزبون أحمد العلي', state);
  assert.equal(saleParsed.actions[0]?.action, 'create_sale');
  const saleRes = await executeAiAction(saleParsed.actions[0], handlers, state);
  assert.equal(saleRes.success, true);
  assert.equal(savedSales.length, 1);
  assert.equal(savedSales[0].total, 15000);
  assert.equal(savedSales[0].grossProfit, 5000);

  // 3. Return sale
  const retParsed = parseAiActions('', `أرجع الفاتورة ${savedSales[0].invoiceNumber}`, state);
  assert.equal(retParsed.actions[0]?.action, 'return_sale');
  const retRes = await executeAiAction(retParsed.actions[0], handlers, state);
  assert.equal(retRes.success, true);
  assert.equal(returnedSales.length, 1);

  // 4. Update settings
  const setParsed = parseAiActions('', 'اجعل تخطيط طباعة الفاتورة عادي A4', state);
  assert.equal(setParsed.actions[0]?.action, 'update_settings');
  const setRes = await executeAiAction(setParsed.actions[0], handlers, state);
  assert.equal(setRes.success, true);
  assert.equal(updatedSettingsList[0]?.invoicePrintLayout, 'standard');

  // 5. Calculate expression & cash metric
  const calcParsed = parseAiActions('', 'احسب (12000 * 3) + 4000', state);
  assert.equal(calcParsed.actions[0]?.action, 'calculate');
  const calcRes = await executeAiAction(calcParsed.actions[0], handlers, state);
  assert.equal(calcRes.success, true);
  assert.match(calcRes.message, /40,000/);

  const cashParsed = parseAiActions('', 'كم رصيد الصندوق؟', state);
  const cashRes = await executeAiAction(cashParsed.actions[0], handlers, state);
  assert.equal(cashRes.success, true);
  assert.match(cashRes.message, /75,000/);

  // 6. Delete product
  const delParsed = parseAiActions('', 'احذف مادة مفتاح 16 امبير', state);
  assert.equal(delParsed.actions[0]?.action, 'delete_product');
  const delRes = await executeAiAction(delParsed.actions[0], handlers, state);
  assert.equal(delRes.success, true);
  assert.equal(deletedProducts.length, 1);

  // 7. Create sale via "اعمل فاتورة بيع..." phrasing + return_sale with "LAST" sentinel
  const sale2Parsed = parseAiActions('', 'اعمل فاتورة بيع للمادة سلك كهربائي 4 مم بكمية 2 لزبون نقدي', state);
  assert.equal(sale2Parsed.actions[0]?.action, 'create_sale');
  assert.equal(sale2Parsed.actions[0]?.data?.items?.[0]?.quantity, 2);
  const sale2Res = await executeAiAction(sale2Parsed.actions[0], handlers, state);
  assert.equal(sale2Res.success, true);

  const lastSentinelParsed = parseAiActions(
    '```json:action\n{"action":"return_sale","title":"test","data":{"invoiceNumber":"LAST","reason":"check"}}\n```',
    '',
    state
  );
  const lastSentinelRes = await executeAiAction(lastSentinelParsed.actions[0], handlers, state);
  assert.equal(lastSentinelRes.success, true);
});

