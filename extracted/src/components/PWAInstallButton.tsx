import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Smartphone,
  WifiOff,
  X,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'login' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } =
    usePWAInstall();
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // Hide install CTA when already running inside installed Android WebAPK / PWA standalone window
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      setIsInstalling(true);
      try {
        const accepted = await install();
        if (!accepted) {
          setShowInstallGuide(true);
        }
      } finally {
        setIsInstalling(false);
      }
      return;
    }
    setShowInstallGuide(true);
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2500);
    } catch {
      setCopiedUrl(false);
    }
  };

  const buttonClasses =
    variant === 'login'
      ? 'px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-lime-600 hover:from-emerald-500 hover:to-lime-500 text-white border border-emerald-300/50 text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer shrink-0 whitespace-nowrap'
      : variant === 'sidebar'
      ? 'w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-500 hover:to-lime-500 text-white text-xs font-black flex items-center justify-between shadow-md transition-all cursor-pointer'
      : 'px-1.5 sm:px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-lime-600 hover:from-emerald-500 hover:to-lime-500 text-white border border-emerald-400/50 text-[11px] sm:text-xs font-black flex items-center gap-1 sm:gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap';

  const modalNode =
    showInstallGuide && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="تثبيت تطبيق أندرويد APK"
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 font-['Cairo',sans-serif]"
            dir="rtl"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-2xl border border-emerald-500/30 space-y-4 text-right">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        تثبيت تطبيق خردوات المامو
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 text-[10px] font-mono font-black">
                        Android APK
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      تثبيت مباشر على الهاتف (WebAPK) للعمل السريع بلا إنترنت
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  aria-label="إغلاق نافذة التثبيت"
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Platform Instructions */}
              {isIOS ? (
                <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <p className="font-bold text-slate-900 dark:text-white">
                    خطوات التثبيت على هواتف الآيفون والآيباد (iOS):
                  </p>
                  <ol className="space-y-2 list-decimal list-inside bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                    <li>
                      اضغط على زر <strong>المشاركة (Share)</strong> في شريط متصفح Safari.
                    </li>
                    <li>
                      مرر للأسفل واختر{' '}
                      <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      سيظهر التطبيق بأيقونته المستقلة ويعمل بكامل طاقته حتى بدون إنترنت.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-start gap-2">
                    <WifiOff className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-semibold leading-snug">
                      يقوم متصفح أندرويد (Chrome / Edge / Samsung) بتثبيت التطبيق كحزمة{' '}
                      <strong>WebAPK أصلية</strong> مباشرة في قائمة تطبيقاتك مع قاعدة بيانات IndexedDB محلية ومزامنة تلقائية.
                    </p>
                  </div>

                  <ol className="space-y-2 list-decimal list-inside bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
                    <li>
                      افتح رابط التطبيق مباشرة عبر متصفح{' '}
                      <strong>Google Chrome</strong> على جهاز الأندرويد{isAndroid ? ' (أنت تستخدم أندرويد الآن)' : ''}.
                    </li>
                    <li>
                      اضغط على زر القائمة <strong>(⋮ النقاط الثلاث)</strong> في الزاوية العلوية للمتصفح.
                    </li>
                    <li>
                      اختر <strong>«تثبيت التطبيق» (Install app)</strong> أو{' '}
                      <strong>«إضافة إلى الشاشة الرئيسية»</strong> ثم أكّد التثبيت.
                    </li>
                  </ol>

                  <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/35 border border-indigo-200 dark:border-indigo-800/70 text-[11px] text-indigo-900 dark:text-indigo-200 font-semibold leading-snug">
                    📦 <strong>ملف APK جاهز عبر GitHub:</strong> يمكنك أيضاً توليد وتنزيل ملف{' '}
                    <span className="font-mono font-black">almamo-hardware-store.apk</span>{' '}
                    تلقائياً من تبويب <strong>Actions</strong> في GitHub مع تهيئة الكاميرا و{' '}
                    <span className="font-mono">Firebase</span> بدون أخطاء بصمة SHA.
                  </div>
                </div>
              )}

              {/* Quick Copy Link & Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>تم نسخ رابط التثبيت!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ رابط التطبيق لفتحه في Chrome</span>
                    </>
                  )}
                </button>

                {typeof window !== 'undefined' && window.self !== window.top && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح بمتصفح كامل</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setShowInstallGuide(false)}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        type="button"
        disabled={isInstalling}
        onClick={handleInstallClick}
        title="تثبيت تطبيق خردوات المامو على أندرويد بصيغة APK للعمل بلا إنترنت"
        aria-label="تثبيت تطبيق APK"
        className={buttonClasses}
      >
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span className="font-mono font-black tracking-wide bg-slate-950/30 px-1.5 py-0.5 rounded text-[10px] leading-none">
            APK
          </span>
          <span className={variant === 'sidebar' ? '' : 'hidden xl:inline'}>
            {variant === 'sidebar' ? 'تثبيت تطبيق أندرويد (APK)' : 'تثبيت التطبيق'}
          </span>
          {variant !== 'sidebar' && (
            <span className="hidden sm:inline xl:hidden">تثبيت</span>
          )}
        </div>
        <Download
          className={`w-3.5 h-3.5 shrink-0 ${
            variant === 'navbar' ? 'hidden sm:block' : ''
          }`}
        />
      </button>

      {modalNode}
    </>
  );
};
