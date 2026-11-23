import React, { useState } from 'react';
import { Calculator, X, Delete, Copy, Check } from 'lucide-react';

interface QuickCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickCalculator: React.FC<QuickCalculatorProps> = ({
  isOpen,
  onClose,
}) => {
  const [display, setDisplay] = useState('0');
  const [prevVal, setPrevVal] = useState<number | null>(null);
  const [operation, setOperation] = useState<string | null>(null);
  const [clearOnNext, setClearOnNext] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (display === '0' || clearOnNext) {
      setDisplay(digit);
      setClearOnNext(false);
    } else {
      setDisplay(display + digit);
    }
  };

  const handleDecimal = () => {
    if (clearOnNext) {
      setDisplay('0.');
      setClearOnNext(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const handleOp = (op: string) => {
    const current = parseFloat(display);
    if (prevVal === null) {
      setPrevVal(current);
    } else if (operation) {
      const result = evaluate(prevVal, current, operation);
      setPrevVal(result);
      setDisplay(String(result));
    }
    setOperation(op);
    setClearOnNext(true);
  };

  const evaluate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
        return a * b;
      case '÷':
        return b !== 0 ? a / b : 0;
      default:
        return b;
    }
  };

  const handleEquals = () => {
    if (operation && prevVal !== null) {
      const current = parseFloat(display);
      const result = evaluate(prevVal, current, operation);
      setDisplay(String(result));
      setPrevVal(null);
      setOperation(null);
      setClearOnNext(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevVal(null);
    setOperation(null);
    setClearOnNext(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 w-72 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Calculator Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold">الحاسبة السريعة</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق الحاسبة"
          className="text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Screen Display */}
      <div className="p-4 bg-slate-950 text-right">
        <div className="text-[11px] font-mono text-slate-400 h-4">
          {prevVal !== null && `${prevVal} ${operation || ''}`}
        </div>
        <div className="text-2xl font-black font-mono tracking-wider truncate text-emerald-400">
          {display}
        </div>
      </div>

      {/* Action Strip */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-850 border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'تم النسخ' : 'نسخ الناتج'}</span>
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          aria-label="مسح رقم"
          className="p-1 text-slate-300 hover:text-white"
        >
          <Delete className="w-4 h-4" />
        </button>
      </div>

      {/* Calculator Keypad */}
      <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900 text-sm font-bold font-mono">
        <button
          type="button"
          onClick={handleClear}
          className="p-2.5 rounded-lg bg-rose-900/60 text-rose-300 hover:bg-rose-900"
        >
          C
        </button>
        <button
          type="button"
          onClick={() => handleOp('÷')}
          className="p-2.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
        >
          ÷
        </button>
        <button
          type="button"
          onClick={() => handleOp('×')}
          className="p-2.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
        >
          ×
        </button>
        <button
          type="button"
          onClick={() => handleOp('-')}
          className="p-2.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
        >
          -
        </button>

        <button
          type="button"
          onClick={() => handleDigit('7')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleDigit('8')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleDigit('9')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleOp('+')}
          className="p-2.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-slate-700"
        >
          +
        </button>

        <button
          type="button"
          onClick={() => handleDigit('4')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleDigit('5')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleDigit('6')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          6
        </button>
        <button
          type="button"
          onClick={handleEquals}
          className="row-span-2 p-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center justify-center text-base"
        >
          =
        </button>

        <button
          type="button"
          onClick={() => handleDigit('1')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleDigit('2')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleDigit('3')}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          3
        </button>

        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="col-span-2 p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDecimal}
          className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800"
        >
          .
        </button>
      </div>
    </div>
  );
};
