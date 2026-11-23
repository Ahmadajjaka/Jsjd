import React, { useEffect, useState } from 'react';
import {
  Keyboard,
  Delete,
  CornerDownLeft,
  X,
  Space,
  Smartphone,
  RotateCcw,
} from 'lucide-react';
import {
  applyKeyActionToActiveInput,
  ARABIC_KEYBOARD_ROWS,
  ENGLISH_KEYBOARD_ROWS,
  getLastEditableInput,
  hideNativeAndroidKeyboard,
  isEditableInputElement,
  NUMERIC_SYMBOL_ROWS,
  OPEN_ANDROID_KEYBOARD_EVENT,
  resolveEditableLabelArabic,
  showNativeAndroidKeyboard,
  TOGGLE_ANDROID_KEYBOARD_EVENT,
} from '../utils/androidKeyboard';
import { isCapacitorNativeShell } from '../utils/apkEnvironment';

type KeyboardLayoutMode = 'ar' | 'en' | 'num';

export const AndroidSoftKeyboardBar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<KeyboardLayoutMode>('ar');
  const [isUppercase, setIsUppercase] = useState(false);
  const [targetLabel, setTargetLabel] = useState('اضغط على أي حقل للكتابة');
  const isAndroidApk = isCapacitorNativeShell();

  useEffect(() => {
    const syncLabel = () => {
      setTargetLabel(resolveEditableLabelArabic(getLastEditableInput()));
    };

    const handleToggle = () => {
      syncLabel();
      setIsOpen((prev) => !prev);
    };

    const handleOpen = () => {
      syncLabel();
      setIsOpen(true);
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditableInputElement(e.target)) {
        setTargetLabel(resolveEditableLabelArabic(e.target));
      }
    };

    window.addEventListener(TOGGLE_ANDROID_KEYBOARD_EVENT, handleToggle);
    window.addEventListener(OPEN_ANDROID_KEYBOARD_EVENT, handleOpen);
    document.addEventListener('focusin', handleFocusIn, true);
    return () => {
      window.removeEventListener(TOGGLE_ANDROID_KEYBOARD_EVENT, handleToggle);
      window.removeEventListener(OPEN_ANDROID_KEYBOARD_EVENT, handleOpen);
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, []);

  if (!isOpen) {
    return null;
  }

  const rows =
    mode === 'ar'
      ? ARABIC_KEYBOARD_ROWS
      : mode === 'en'
      ? ENGLISH_KEYBOARD_ROWS
      : NUMERIC_SYMBOL_ROWS;

  const preventBlur = (e: React.PointerEvent | React.MouseEvent) => {
    e.preventDefault();
  };

  const handleKeyPress = (char: string) => {
    const outputChar = mode === 'en' && isUppercase ? char.toUpperCase() : char;
    const updated = applyKeyActionToActiveInput({ type: 'insert', text: outputChar });
    setTargetLabel(resolveEditableLabelArabic(updated || getLastEditableInput()));
  };

  const handleTriggerSystemAndroidIme = async () => {
    const active = getLastEditableInput();
    if (active) {
      active.focus();
    }
    await showNativeAndroidKeyboard();
  };

  const handleDoneAndClose = async () => {
    await hideNativeAndroidKeyboard();
    setIsOpen(false);
  };

  return (
    <div
      id="android-soft-keyboard-drawer"
      dir="ltr"
      role="region"
      aria-label="لوحة مفاتيح أندرويد المدمجة"
      className="fixed bottom-0 inset-x-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t-2 border-amber-500/60 shadow-[0_-12px_40px_rgba(0,0,0,0.65)] px-2 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom))] select-none"
    >
      <div className="max-w-2xl mx-auto space-y-1.5">
        {/* Top Toolbar */}
        <div
          dir="rtl"
          className="flex flex-wrap items-center justify-between gap-1.5 pb-1.5 border-b border-slate-800"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Keyboard className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-black text-white flex items-center gap-1.5">
                <span>لوحة مفاتيح أندرويد</span>
                {isAndroidApk && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold inline-flex items-center gap-0.5">
                    <Smartphone className="w-2.5 h-2.5" />
                    APK
                  </span>
                )}
              </div>
              <p className="text-[10px] text-amber-300 truncate max-w-[190px] sm:max-w-[260px]">
                الكتابة في: {targetLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={() => setMode('ar')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                mode === 'ar'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              عربي
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={() => setMode('en')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                mode === 'en'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={() => setMode('num')}
              className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                mode === 'num'
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              123
            </button>

            {isAndroidApk && (
              <button
                type="button"
                onMouseDown={preventBlur}
                onPointerDown={preventBlur}
                onClick={handleTriggerSystemAndroidIme}
                title="استدعاء لوحة مفاتيح نظام أندرويد"
                className="px-2 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold cursor-pointer"
              >
                كيبورد النظام
              </button>
            )}

            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={handleDoneAndClose}
              aria-label="إغلاق لوحة مفاتيح أندرويد"
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Keys Grid */}
        <div className="space-y-1">
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              className="grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))`,
              }}
            >
              {row.map((keyChar) => {
                const display =
                  mode === 'en' && isUppercase ? keyChar.toUpperCase() : keyChar;
                return (
                  <button
                    key={keyChar}
                    type="button"
                    onMouseDown={preventBlur}
                    onPointerDown={preventBlur}
                    onClick={() => handleKeyPress(keyChar)}
                    className="h-9 sm:h-10 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-white font-bold text-sm border border-slate-700/80 shadow-xs flex items-center justify-center cursor-pointer transition-colors"
                  >
                    {display}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Action Row */}
        <div className="grid grid-cols-12 gap-1 pt-0.5">
          {mode === 'en' ? (
            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={() => setIsUppercase((p) => !p)}
              className={`col-span-2 h-9 rounded-lg font-black text-xs border flex items-center justify-center cursor-pointer ${
                isUppercase
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700'
              }`}
            >
              SHIFT
            </button>
          ) : (
            <button
              type="button"
              onMouseDown={preventBlur}
              onPointerDown={preventBlur}
              onClick={() => applyKeyActionToActiveInput({ type: 'clear' })}
              aria-label="مسح الكل"
              className="col-span-2 h-9 rounded-lg bg-slate-800 hover:bg-rose-900/70 text-rose-300 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">تفريغ</span>
            </button>
          )}

          <button
            type="button"
            onMouseDown={preventBlur}
            onPointerDown={preventBlur}
            onClick={() => applyKeyActionToActiveInput({ type: 'space' })}
            className="col-span-6 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-amber-500 active:text-slate-950 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Space className="w-4 h-4" />
            <span>مسافة</span>
          </button>

          <button
            type="button"
            onMouseDown={preventBlur}
            onPointerDown={preventBlur}
            onClick={() => applyKeyActionToActiveInput({ type: 'backspace' })}
            aria-label="مسح حرف"
            className="col-span-2 h-9 rounded-lg bg-rose-950/70 hover:bg-rose-900 active:bg-rose-600 text-rose-200 border border-rose-700/60 font-bold text-xs flex items-center justify-center cursor-pointer"
          >
            <Delete className="w-4 h-4" />
          </button>

          <button
            type="button"
            onMouseDown={preventBlur}
            onPointerDown={preventBlur}
            onClick={handleDoneAndClose}
            className="col-span-2 h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-1 cursor-pointer"
          >
            <CornerDownLeft className="w-3.5 h-3.5" />
            <span>تم</span>
          </button>
        </div>
      </div>
    </div>
  );
};
