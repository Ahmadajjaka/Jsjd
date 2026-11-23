export interface MathEvalResult {
  value: number;
  expression: string;
  explanation?: string;
}

const ARABIC_INDIC_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function normalizeArabicDigits(input: string): string {
  return String(input || '')
    .replace(/[٠-٩۰-۹]/g, (d) => ARABIC_INDIC_MAP[d] ?? d)
    .replace(/[٫]/g, '.')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/−|–/g, '-')
    .replace(/٪/g, '%');
}

type Token =
  | { type: 'number'; value: number }
  | { type: 'op'; value: string }
  | { type: 'paren'; value: '(' | ')' }
  | { type: 'percent' };

function tokenizeMath(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        if (expr[i] === '.') {
          dotCount++;
          if (dotCount > 1) break;
        }
        numStr += expr[i];
        i++;
      }
      const val = Number(numStr);
      if (Number.isNaN(val)) {
        throw new Error(`رقم غير صالح في التعبير الحسابي: ${numStr}`);
      }
      tokens.push({ type: 'number', value: val });
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch });
      i++;
      continue;
    }

    if (ch === '%') {
      tokens.push({ type: 'percent' });
      i++;
      continue;
    }

    throw new Error(`رمز غير مدعوم في العملية الحسابية: "${ch}"`);
  }

  return tokens;
}

/**
 * Pure recursive-descent mathematical expression evaluator (no eval/Function).
 * Supports +, -, *, /, ^, parentheses, and percentages (e.g. 1000 + 15% = 1150, 20% * 500 = 100).
 */
export function evaluateMathExpression(rawExpression: string): MathEvalResult {
  const cleaned = normalizeArabicDigits(rawExpression)
    .replace(/,/g, '')
    .trim();

  if (!cleaned) {
    throw new Error('التعبير الحسابي فارغ.');
  }

  const tokens = tokenizeMath(cleaned);
  if (tokens.length === 0) {
    throw new Error('لا توجد أرقام صالحة للحساب.');
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];

  const parseExpression = (): number => parseAddSub();

  const parseAddSub = (): number => {
    let left = parseMulDiv();
    while (peek()?.type === 'op' && (peek() as any).value in { '+': 1, '-': 1 }) {
      const op = (consume() as any).value;
      // Check if right-hand side is a standalone percent e.g. 1000 + 15%
      const rightStart = pos;
      let right = parseMulDiv();
      if (
        pos > rightStart &&
        tokens[pos - 1]?.type === 'percent' &&
        (tokens[rightStart]?.type === 'number')
      ) {
        // right already converted to decimal fraction (e.g. 0.15)
        right = left * right;
      }
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };

  const parseMulDiv = (): number => {
    let left = parsePower();
    while (peek()?.type === 'op' && (peek() as any).value in { '*': 1, '/': 1 }) {
      const op = (consume() as any).value;
      const right = parsePower();
      if (op === '/') {
        if (right === 0) throw new Error('لا يمكن القسمة على صفر.');
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  };

  const parsePower = (): number => {
    let base = parseUnary();
    if (peek()?.type === 'op' && (peek() as any).value === '^') {
      consume();
      const exp = parsePower();
      base = Math.pow(base, exp);
    }
    return base;
  };

  const parseUnary = (): number => {
    if (peek()?.type === 'op' && ((peek() as any).value === '-' || (peek() as any).value === '+')) {
      const op = (consume() as any).value;
      const val = parseUnary();
      return op === '-' ? -val : val;
    }
    return parsePostfix();
  };

  const parsePostfix = (): number => {
    let val = parsePrimary();
    while (peek()?.type === 'percent') {
      consume();
      val = val / 100;
    }
    return val;
  };

  const parsePrimary = (): number => {
    const tok = peek();
    if (!tok) {
      throw new Error('صيغة حسابية غير مكتملة.');
    }
    if (tok.type === 'number') {
      consume();
      return tok.value;
    }
    if (tok.type === 'paren' && tok.value === '(') {
      consume();
      const inner = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'paren' || closing.value !== ')') {
        throw new Error('يوجد قوس مفتوح غير مغلق في المعادلة.');
      }
      consume();
      return inner;
    }
    throw new Error('تركيب رياضي غير صالح.');
  };

  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error('رموز إضافية غير مفهومة في نهاية المعادلة.');
  }
  if (!Number.isFinite(result)) {
    throw new Error('النتيجة الحسابية غير محدودة.');
  }

  return {
    value: Math.round(result * 10000) / 10000,
    expression: cleaned,
  };
}

/**
 * Extracts and computes Arabic natural-language or symbolic math calculations.
 */
export function extractAndComputeMath(userQuery: string): MathEvalResult | null {
  const normalized = normalizeArabicDigits(userQuery).trim();

  // 1. Margin / Profit helper: "تكلفة 18000 ... بيع 24000"
  const costMatch = normalized.match(/(?:تكلفة|شراء)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  const sellMatch = normalized.match(/(?:بيع|مبيع)\s*[:=]?\s*(\d+(?:\.\d+)?)/i);
  if (
    costMatch &&
    sellMatch &&
    (normalized.includes('ربح') || normalized.includes('هامش') || normalized.includes('نسبة') || normalized.includes('احسب'))
  ) {
    const cost = Number(costMatch[1]);
    const sell = Number(sellMatch[1]);
    if (cost > 0 && sell > 0) {
      const profit = sell - cost;
      const marginPct = Math.round(((profit / sell) * 100) * 100) / 100;
      const markupPct = Math.round(((profit / cost) * 100) * 100) / 100;
      return {
        value: profit,
        expression: `${sell} - ${cost}`,
        explanation: `صافي الربح للقطعة: ${profit.toLocaleString('en-US')} | هامش الربح من سعر البيع: ${marginPct}% | نسبة الزيادة على التكلفة: ${markupPct}%`,
      };
    }
  }

  // 2. Percentage of amount: "25% من 80000" or "خصم 15% على 120000"
  const pctOfMatch = normalized.match(/(\d+(?:\.\d+)?)\s*%\s*(?:من|على|لـ)\s*(\d+(?:\.\d+)?)/);
  if (pctOfMatch) {
    const pct = Number(pctOfMatch[1]);
    const base = Number(pctOfMatch[2]);
    const part = Math.round(((pct / 100) * base) * 100) / 100;
    if (normalized.includes('خصم')) {
      const net = Math.round((base - part) * 100) / 100;
      return {
        value: net,
        expression: `${base} - ${pct}%`,
        explanation: `قيمة الخصم (${pct}%): ${part.toLocaleString('en-US')} | الصافي بعد الخصم: ${net.toLocaleString('en-US')}`,
      };
    }
    return {
      value: part,
      expression: `${base} * ${pct}%`,
      explanation: `${pct}% من ${base.toLocaleString('en-US')} = ${part.toLocaleString('en-US')}`,
    };
  }

  // 3. Extract explicit arithmetic expression (e.g. "احسب 1500 * 12 + 3000" or "25000 / 5")
  const exprCandidateMatch = normalized.match(
    /(\(?\s*-?\d+(?:\.\d+)?\s*%?(?:\s*[+\-*/^]\s*\(?\s*-?\d+(?:\.\d+)?\s*%?\)?)+\s*\)?)/
  );
  if (exprCandidateMatch) {
    try {
      const res = evaluateMathExpression(exprCandidateMatch[1]);
      return {
        ...res,
        explanation: `ناتج (${res.expression}) = ${res.value.toLocaleString('en-US')}`,
      };
    } catch {
      return null;
    }
  }

  return null;
}
