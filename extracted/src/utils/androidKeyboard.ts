/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capacitor Android IME bridge + pure text-editing utilities for reliable
 * soft-keyboard typing inside Android APK WebViews and touch POS screens.
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { isAndroidWebViewShell, isCapacitorNativeShell } from './apkEnvironment';

export interface NativeKeyboardStatus {
  isVisible: boolean;
  heightPx: number;
  nativeAndroid: boolean;
}

export interface NativeKeyboardPluginInterface {
  show(): Promise<{ shown: boolean; nativeAndroid?: boolean }>;
  hide(): Promise<{ hidden: boolean }>;
  getStatus(): Promise<NativeKeyboardStatus>;
}

const NativeKeyboard = registerPlugin<NativeKeyboardPluginInterface>('NativeKeyboard');

export const TOGGLE_ANDROID_KEYBOARD_EVENT = 'almamo:toggle-android-keyboard';
export const OPEN_ANDROID_KEYBOARD_EVENT = 'almamo:open-android-keyboard';

export type EditableElement = HTMLInputElement | HTMLTextAreaElement;

export const ARABIC_KEYBOARD_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['ض', 'ص', 'ث', 'ق', 'ف', 'غ', 'ع', 'ه', 'خ', 'ح', 'ج', 'د'],
  ['ش', 'س', 'ي', 'ب', 'ل', 'ا', 'ت', 'ن', 'م', 'ك', 'ط'],
  ['أ', 'ئ', 'ء', 'ؤ', 'ر', 'لا', 'ى', 'ة', 'و', 'ز', 'ظ', 'ذ'],
];

export const ENGLISH_KEYBOARD_ROWS: string[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '_', '-', '.'],
];

export const NUMERIC_SYMBOL_ROWS: string[][] = [
  ['1', '2', '3', '+'],
  ['4', '5', '6', '-'],
  ['7', '8', '9', '@'],
  ['.', '0', '_', '/'],
];

export type KeyEditAction =
  | { type: 'insert'; text: string }
  | { type: 'space' }
  | { type: 'backspace' }
  | { type: 'clear' };

export function applyKeyToInputValue(
  currentValue: string,
  selectionStart: number | null | undefined,
  selectionEnd: number | null | undefined,
  action: KeyEditAction
): { value: string; cursor: number } {
  const safeVal = typeof currentValue === 'string' ? currentValue : String(currentValue ?? '');
  const len = safeVal.length;
  const start =
    typeof selectionStart === 'number' && !Number.isNaN(selectionStart)
      ? Math.max(0, Math.min(len, selectionStart))
      : len;
  const end =
    typeof selectionEnd === 'number' && !Number.isNaN(selectionEnd)
      ? Math.max(start, Math.min(len, selectionEnd))
      : start;

  if (action.type === 'clear') {
    return { value: '', cursor: 0 };
  }

  if (action.type === 'backspace') {
    if (end > start) {
      const value = safeVal.slice(0, start) + safeVal.slice(end);
      return { value, cursor: start };
    }
    if (start === 0) {
      return { value: safeVal, cursor: 0 };
    }
    const value = safeVal.slice(0, start - 1) + safeVal.slice(end);
    return { value, cursor: start - 1 };
  }

  const textToInsert = action.type === 'space' ? ' ' : action.text;
  const value = safeVal.slice(0, start) + textToInsert + safeVal.slice(end);
  const cursor = start + textToInsert.length;
  return { value, cursor };
}

export function isEditableInputElement(el: unknown): el is EditableElement {
  if (!el || typeof el !== 'object') return false;
  const node = el as HTMLElement;
  if (node.tagName === 'TEXTAREA') {
    return !(node as HTMLTextAreaElement).readOnly && !(node as HTMLTextAreaElement).disabled;
  }
  if (node.tagName === 'INPUT') {
    const input = node as HTMLInputElement;
    const nonTextTypes = new Set([
      'checkbox',
      'radio',
      'file',
      'button',
      'submit',
      'reset',
      'range',
      'color',
      'hidden',
      'image',
    ]);
    return !nonTextTypes.has(input.type) && !input.readOnly && !input.disabled;
  }
  return false;
}

export function isNativeKeyboardPluginAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      Capacitor.isNativePlatform() &&
      Capacitor.getPlatform() === 'android' &&
      (typeof Capacitor.isPluginAvailable !== 'function' ||
        Capacitor.isPluginAvailable('NativeKeyboard'))
    );
  } catch {
    return false;
  }
}

export async function showNativeAndroidKeyboard(): Promise<boolean> {
  if (!isNativeKeyboardPluginAvailable()) return false;
  try {
    const res = await NativeKeyboard.show();
    return !!res?.shown;
  } catch {
    return false;
  }
}

export async function hideNativeAndroidKeyboard(): Promise<boolean> {
  if (!isNativeKeyboardPluginAvailable()) return false;
  try {
    const res = await NativeKeyboard.hide();
    return !!res?.hidden;
  } catch {
    return false;
  }
}

export async function getNativeAndroidKeyboardStatus(): Promise<NativeKeyboardStatus> {
  if (!isNativeKeyboardPluginAvailable()) {
    return { isVisible: false, heightPx: 0, nativeAndroid: false };
  }
  try {
    return await NativeKeyboard.getStatus();
  } catch {
    return { isVisible: false, heightPx: 0, nativeAndroid: false };
  }
}

let lastTrackedEditable: EditableElement | null = null;

export function getLastEditableInput(): EditableElement | null {
  if (typeof document !== 'undefined' && isEditableInputElement(document.activeElement)) {
    lastTrackedEditable = document.activeElement;
    return lastTrackedEditable;
  }
  if (lastTrackedEditable && typeof document !== 'undefined' && document.contains(lastTrackedEditable)) {
    return lastTrackedEditable;
  }
  return null;
}

export function resolveEditableLabelArabic(el: EditableElement | null): string {
  if (!el) return 'اضغط على أي حقل للكتابة';
  const placeholder = el.getAttribute('placeholder')?.trim();
  const ariaLabel = el.getAttribute('aria-label')?.trim();
  if (ariaLabel) return ariaLabel;
  if (placeholder) return placeholder;
  if ((el as HTMLInputElement).type === 'password') return 'حقل كلمة المرور';
  return 'حقل النص النشط';
}

export function dispatchValueToEditable(
  el: EditableElement,
  newValue: string,
  nextCursor: number
): void {
  const proto =
    el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  if (nativeSetter) {
    nativeSetter.call(el, newValue);
  } else {
    el.value = newValue;
  }

  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));

  try {
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(nextCursor, nextCursor);
    }
  } catch {}
}

export function applyKeyActionToActiveInput(action: KeyEditAction): EditableElement | null {
  const target = getLastEditableInput();
  if (!target) return null;

  target.focus({ preventScroll: false });

  let selStart: number | null = null;
  let selEnd: number | null = null;
  try {
    selStart = target.selectionStart;
    selEnd = target.selectionEnd;
  } catch {}

  const { value, cursor } = applyKeyToInputValue(target.value, selStart, selEnd, action);
  dispatchValueToEditable(target, value, cursor);
  lastTrackedEditable = target;
  return target;
}

export function openAndroidKeyboardDrawer(): void {
  if (typeof window === 'undefined') return;
  const active = getLastEditableInput();
  if (active) {
    active.focus();
  }
  void showNativeAndroidKeyboard();
  window.dispatchEvent(new CustomEvent(OPEN_ANDROID_KEYBOARD_EVENT));
}

export function toggleAndroidKeyboardDrawer(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOGGLE_ANDROID_KEYBOARD_EVENT));
}

export function initAndroidKeyboardBridge(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  const handleFocusIn = (e: FocusEvent) => {
    const target = e.target;
    if (!isEditableInputElement(target)) return;
    lastTrackedEditable = target;

    if (isCapacitorNativeShell() || isAndroidWebViewShell()) {
      void showNativeAndroidKeyboard();
    }

    setTimeout(() => {
      try {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {}
    }, 240);
  };

  const handleVisualViewportResize = () => {
    const vv = window.visualViewport;
    if (!vv) return;
    const keyboardGap = Math.max(0, Math.round(window.innerHeight - vv.height));
    document.documentElement.style.setProperty(
      '--android-ime-height',
      keyboardGap > 80 ? `${keyboardGap}px` : '0px'
    );
    if (keyboardGap > 80 && isEditableInputElement(document.activeElement)) {
      try {
        document.activeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } catch {}
    }
  };

  document.addEventListener('focusin', handleFocusIn, true);
  window.visualViewport?.addEventListener('resize', handleVisualViewportResize);

  return () => {
    document.removeEventListener('focusin', handleFocusIn, true);
    window.visualViewport?.removeEventListener('resize', handleVisualViewportResize);
  };
}
