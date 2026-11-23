/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pure utilities for Android APK / Capacitor / TWA detection,
 * SHA-1 / SHA-256 Digital Asset Links formatting,
 * cloud backend URL resolution inside standalone APKs,
 * and Firebase Auth error normalization in Arabic.
 */

export const ANDROID_APP_PACKAGE_ID = 'com.almamo.hardware';
export const BACKEND_URL_STORAGE_KEY = 'almamo_backend_api_url';
export const ANDROID_SHA256_STORAGE_KEY = 'almamo_android_sha256_fingerprint';

export type RuntimeShellKind = 'apk' | 'webview' | 'pwa' | 'web';

export function isCapacitorNativeShell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return true;
    }
    if (window.location?.protocol === 'capacitor:' || window.location?.protocol === 'ionic:') {
      return true;
    }
  } catch {}
  return false;
}

export function isAndroidWebViewShell(uaOverride?: string): boolean {
  if (isCapacitorNativeShell()) return true;
  const ua =
    typeof uaOverride === 'string'
      ? uaOverride
      : typeof navigator !== 'undefined'
      ? navigator.userAgent || ''
      : '';
  return /android/i.test(ua) && (/;\s*wv\)/i.test(ua) || /\bwv\b/i.test(ua));
}

export function isStandalonePwaShell(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
    if ((window.navigator as any)?.standalone === true) return true;
  } catch {}
  return false;
}

export function getRuntimeShellKind(): RuntimeShellKind {
  if (isCapacitorNativeShell()) return 'apk';
  if (isAndroidWebViewShell()) return 'webview';
  if (isStandalonePwaShell()) return 'pwa';
  return 'web';
}

export function getRuntimeShellLabelArabic(kind: RuntimeShellKind = getRuntimeShellKind()): string {
  switch (kind) {
    case 'apk':
      return 'تطبيق أندرويد مثبت (APK / Capacitor)';
    case 'webview':
      return 'متصفح داخل تطبيق أندرويد (WebView)';
    case 'pwa':
      return 'تطبيق ويب مثبت (WebAPK / PWA)';
    default:
      return 'متصفح ويب قياسي';
  }
}

export function sanitizeBaseUrl(rawUrl?: string | null): string {
  const clean = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!clean) return '';
  if (!/^https?:\/\//i.test(clean)) {
    return `https://${clean}`;
  }
  return clean;
}

export function getConfiguredBackendUrl(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
      if (saved && saved.trim()) {
        return sanitizeBaseUrl(saved);
      }
    }
  } catch {}

  try {
    const envUrl = (import.meta as any)?.env?.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      return sanitizeBaseUrl(envUrl);
    }
  } catch {}

  return '';
}

export function setConfiguredBackendUrl(url: string): string {
  const normalized = sanitizeBaseUrl(url);
  try {
    if (typeof localStorage !== 'undefined') {
      if (normalized) {
        localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);
      } else {
        localStorage.removeItem(BACKEND_URL_STORAGE_KEY);
      }
    }
  } catch {}
  return normalized;
}

export function resolveApiUrl(
  endpointPath: string,
  overrideBaseUrl?: string
): string {
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const base =
    overrideBaseUrl !== undefined
      ? sanitizeBaseUrl(overrideBaseUrl)
      : getConfiguredBackendUrl();

  if (base) {
    return `${base}${cleanPath}`;
  }

  return cleanPath;
}

export interface NormalizedShaResult {
  valid: boolean;
  kind: 'SHA-1' | 'SHA-256' | 'unknown';
  formatted: string;
}

export function normalizeShaFingerprint(raw: string): NormalizedShaResult {
  const hex = (raw || '')
    .replace(/sha-?(1|256)\s*:/gi, '')
    .replace(/[^a-fA-F0-9]/g, '')
    .toUpperCase();

  if (hex.length === 40) {
    const formatted = hex.match(/.{2}/g)?.join(':') || hex;
    return { valid: true, kind: 'SHA-1', formatted };
  }
  if (hex.length === 64) {
    const formatted = hex.match(/.{2}/g)?.join(':') || hex;
    return { valid: true, kind: 'SHA-256', formatted };
  }
  return { valid: false, kind: 'unknown', formatted: raw.trim().toUpperCase() };
}

export interface AssetLinksEntry {
  relation: string[];
  target: {
    namespace: 'android_app';
    package_name: string;
    sha256_cert_fingerprints: string[];
  };
}

export function buildAssetLinksPayload(
  packageName: string = ANDROID_APP_PACKAGE_ID,
  sha256Fingerprints: string[] = []
): AssetLinksEntry[] {
  const validSha256 = sha256Fingerprints
    .map((fp) => normalizeShaFingerprint(fp))
    .filter((res) => res.valid && res.kind === 'SHA-256')
    .map((res) => res.formatted);

  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName.trim() || ANDROID_APP_PACKAGE_ID,
        sha256_cert_fingerprints: Array.from(new Set(validSha256)),
      },
    },
  ];
}

export function formatFirebaseAuthErrorArabic(err: any): {
  code: string;
  isNetwork: boolean;
  isApkOrShaIssue: boolean;
  message: string;
} {
  const code = String(err?.code || '');
  const raw = String(err?.message || err || '');
  const lower = `${code} ${raw}`.toLowerCase();

  if (code === 'auth/popup-blocked') {
    return {
      code,
      isNetwork: false,
      isApkOrShaIssue: false,
      message:
        'حظر المتصفح نافذة تسجيل الدخول المنبثقة. سيتم التحويل تلقائياً لصفحة المصادقة أو يمكنك استخدام الدخول بكلمة المرور.',
    };
  }

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      code,
      isNetwork: false,
      isApkOrShaIssue: false,
      message:
        'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل استكمال العملية. يمكنك إعادة المحاولة في أي وقت.',
    };
  }

  if (
    code === 'auth/network-request-failed' ||
    lower.includes('network-request-failed')
  ) {
    return {
      code,
      isNetwork: true,
      isApkOrShaIssue: false,
      message:
        'تعذر الاتصال بخوادم Google (خطأ شبكة). تأكد من اتصال الإنترنت أو ادخل فوراً عبر وضع العمل المحلي بكلمة المرور.',
    };
  }

  if (
    code === 'NO_GOOGLE_ACCOUNT' ||
    lower.includes('no_google_account') ||
    lower.includes('no_credential')
  ) {
    return {
      code,
      isNetwork: false,
      isApkOrShaIssue: true,
      message:
        'لا يوجد حساب Google مسجل أو نشط حالياً على جهاز الأندرويد. أضف حساب Google في إعدادات الهاتف (الحسابات ← Google)، أو ادخل مباشرة عبر اسم المستخدم وكلمة المرور دون متصفح.',
    };
  }

  if (
    code === 'DEVELOPER_ERROR' ||
    code === 'MISSING_ID_TOKEN' ||
    code === 'MISSING_CLIENT_ID' ||
    code === 'GMS_12500' ||
    lower.includes('developer_error') ||
    lower.includes('missing_id_token') ||
    lower.includes('12500') ||
    lower.includes('sha-1') ||
    lower.includes('sha1') ||
    lower.includes('10:')
  ) {
    return {
      code,
      isNetwork: false,
      isApkOrShaIssue: true,
      message:
        'تعذر إتمام Google Sign-In الأصلي لأندرويد لأن بصمة SHA-1 لشهادة التوقيع غير مضافة بعد في Firebase Console (مشروع first-hook-1w2pc ← تطبيق Android: com.almamo.hardware). انسخ بصمة SHA-1 من ملخص بناء GitHub Actions وأضفها في Firebase، أو ادخل فوراً بكلمة المرور.',
    };
  }

  if (
    code === 'auth/unauthorized-domain' ||
    code === 'auth/app-not-authorized' ||
    code === 'auth/operation-not-supported-in-this-environment' ||
    lower.includes('disallowed_useragent')
  ) {
    return {
      code,
      isNetwork: false,
      isApkOrShaIssue: true,
      message:
        'تم تشغيل التطبيق من داخل حزمة Android WebView أو نطاق لم يُضف بعد في مصادقة Google. قاعدة البيانات Firestore تعمل، ويمكنك الدخول فوراً باسم المستخدم وكلمة المرور أو ربط النطاق/البصمة SHA من إعدادات المتجر.',
    };
  }

  return {
    code,
    isNetwork: false,
    isApkOrShaIssue: false,
    message: raw || 'تعذر إتمام تسجيل الدخول. يرجى إعادة المحاولة.',
  };
}
