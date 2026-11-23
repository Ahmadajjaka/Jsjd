import React, { useState, useEffect, useCallback } from 'react';
import { Camera, HardDrive, ShieldCheck, CheckCircle2, AlertTriangle, X, RefreshCw } from 'lucide-react';
import {
  captureFrontCameraSnapshot,
  checkDevicePermissionsStatus,
  DevicePermissionsStatus,
  formatPermissionStatusArabic,
  getPermissionsPromptDismissed,
  requestStorageAndCameraPermissions,
  setPermissionsPromptDismissed,
} from '../utils/securityCapture';
import { saveSecuritySnapshot } from '../services/localDatabase';

interface SecurityPermissionsBannerProps {
  variant?: 'banner' | 'compact' | 'settings';
  enabled?: boolean;
  onPermissionsChanged?: (status: DevicePermissionsStatus) => void;
}

export const SecurityPermissionsBanner: React.FC<SecurityPermissionsBannerProps> = ({
  variant = 'banner',
  enabled = true,
  onPermissionsChanged,
}) => {
  const [status, setStatus] = useState<DevicePermissionsStatus | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isTestingCamera, setIsTestingCamera] = useState(false);
  const [testSnapshotUrl, setTestSnapshotUrl] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => getPermissionsPromptDismissed());
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    const res = await checkDevicePermissionsStatus();
    setStatus(res);
    onPermissionsChanged?.(res);
  }, [onPermissionsChanged]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleRequestAll = async () => {
    setIsRequesting(true);
    setFeedback(null);
    try {
      const updated = await requestStorageAndCameraPermissions();
      setStatus(updated);
      onPermissionsChanged?.(updated);

      if (updated.storage === 'granted' && updated.camera === 'granted') {
        setFeedback('تم تفعيل إذن التخزين الدائم والكاميرا الأمامية بنجاح!');
      } else if (updated.camera === 'denied') {
        setFeedback(
          'تم رفض إذن الكاميرا من المتصفح. يمكنك السماح به من أيقونة القفل بجانب رابط الموقع.'
        );
      } else if (updated.camera === 'unsupported' || updated.storage !== 'granted') {
        setFeedback(
          'بعض الأذونات غير متاحة على هذا المتصفح أو الجهاز، وسيستمر النظام بتوثيق الدخول وحفظ البيانات احتياطياً.'
        );
      } else {
        setFeedback('تم تحديث حالة الأذونات بنجاح.');
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestSnapshot = async () => {
    if (isTestingCamera || isRequesting) return;
    setIsTestingCamera(true);
    setFeedback(null);
    setTestSnapshotUrl(null);
    try {
      const res = await captureFrontCameraSnapshot({ enabled: true, timeoutMs: 12000 });
      await refreshStatus();
      if (res.status === 'captured' && res.imageDataUrl && res.snapshotId) {
        await saveSecuritySnapshot({
          id: res.snapshotId,
          imageDataUrl: res.imageDataUrl,
          createdAt: Date.now(),
          userName: 'اختبار الكاميرا الأمني',
          entryMethod: 'pin_confirm',
          status: 'success',
        });
        setTestSnapshotUrl(res.imageDataUrl);
        setFeedback('نجح التصوير! تم التقاط لقطة تجريبية وحفظها في التخزين المحلي.');
      } else {
        setFeedback(res.errorReason || 'تعذر التقاط صورة من الكاميرا.');
      }
    } finally {
      setIsTestingCamera(false);
    }
  };

  const handleDismiss = () => {
    setPermissionsPromptDismissed(true);
    setDismissed(true);
  };

  if (!enabled && variant !== 'settings') return null;

  const bothGranted = status?.storage === 'granted' && status?.camera === 'granted';

  if (variant !== 'settings') {
    if (dismissed || (bothGranted && !testSnapshotUrl)) return null;
  }

  const badgeClass = (state?: string) => {
    if (state === 'granted') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (state === 'denied') {
      return 'bg-rose-100 text-rose-800 border-rose-200';
    }
    return 'bg-amber-100 text-amber-800 border-amber-200';
  };

  if (variant === 'compact') {
    return (
      <div
        id="security-permissions-prompt"
        className="p-3 rounded-2xl bg-slate-900/95 border border-amber-500/35 text-slate-100 space-y-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Camera className="w-4 h-4" />
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-white">
                أذونات الأمان: التخزين الدائم والكاميرا
              </div>
              <div className="text-[10px] text-slate-400">
                يُستخدم للتصوير الأمني الفوري وحفظ اللقطات محلياً عند إدخال كلمة السر
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleRequestAll}
              disabled={isRequesting || isTestingCamera}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-black transition-colors cursor-pointer disabled:opacity-60"
            >
              {isRequesting ? 'جارٍ الطلب...' : 'منح إذن التخزين والكاميرا'}
            </button>
            <button
              type="button"
              onClick={handleTestSnapshot}
              disabled={isTestingCamera || isRequesting}
              className="px-2.5 py-1.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-200 text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {isTestingCamera ? 'جارٍ التصوير...' : 'تجربة التقاط لقطة'}
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="تخطي تنبيه الأذونات"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${badgeClass(
              status?.storage
            )}`}
          >
            <HardDrive className="w-3 h-3" />
            التخزين: {formatPermissionStatusArabic(status?.storage || 'prompt')}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-bold ${badgeClass(
              status?.camera
            )}`}
          >
            <Camera className="w-3 h-3" />
            الكاميرا: {formatPermissionStatusArabic(status?.camera || 'prompt')}
          </span>
        </div>

        {feedback && (
          <p className="text-[11px] text-amber-300 font-semibold">{feedback}</p>
        )}

        {testSnapshotUrl && (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-950/90 border border-emerald-500/40">
            <img
              src={testSnapshotUrl}
              alt="لقطة تجريبية للكاميرا"
              className="w-16 h-12 object-cover rounded-lg border border-emerald-400/60 shrink-0"
            />
            <div className="text-[10px] space-y-0.5">
              <div className="font-black text-emerald-300">
                تم التقاط الصورة التجريبية بنجاح
              </div>
              <div className="text-slate-300">
                الكاميرا والتخزين جاهزان للالتقاط عند إدخال كلمة السر.
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      id="security-permissions-prompt"
      className={`p-4 rounded-2xl border space-y-3 ${
        variant === 'settings'
          ? 'bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100'
          : 'bg-gradient-to-l from-amber-50 via-white to-amber-50/80 border-amber-300/80 text-slate-900 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 dark:border-amber-500/40 dark:text-white shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              variant === 'settings'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                : 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-400 dark:border-amber-500/30'
            }`}
          >
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black">
              تفعيل أذونات التخزين الدائم والكاميرا للأمان
            </h4>
            <p
              className={`text-xs mt-0.5 ${
                variant === 'settings' ? 'text-slate-600 dark:text-slate-300' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              عند تفعيل هذه الأذونات، يقوم النظام بالتقاط صورة أمنية بالكاميرا الأمامية وحفظها محلياً في التخزين الدائم فور إدخال كلمة المرور أو الرمز السري (PIN).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleRequestAll}
            disabled={isRequesting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-colors shadow-xs cursor-pointer disabled:opacity-60"
          >
            {isRequesting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Camera className="w-3.5 h-3.5" />
            )}
            <span>{isRequesting ? 'جاري طلب الأذونات...' : 'طلب إذن التخزين والكاميرا'}</span>
          </button>

          <button
            type="button"
            onClick={handleTestSnapshot}
            disabled={isTestingCamera || isRequesting}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-60 ${
              variant === 'settings'
                ? 'bg-slate-800 hover:bg-slate-700 text-white'
                : 'bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 dark:bg-sky-500/20 dark:hover:bg-sky-500/30 dark:text-sky-200 dark:border-sky-400/40'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>{isTestingCamera ? 'جارٍ التصوير...' : 'تجربة التقاط لقطة'}</span>
          </button>

          {variant !== 'settings' && (
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-slate-200 text-xs font-bold cursor-pointer"
            >
              لاحقاً
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
            variant === 'settings'
              ? 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              : 'bg-white/90 border-amber-200/80 dark:bg-slate-950/60 dark:border-slate-700/70'
          }`}
        >
          <span className="flex items-center gap-1.5 font-bold">
            <HardDrive className="w-4 h-4 text-sky-600 dark:text-sky-500" />
            <span>صلاحية التخزين الدائم (Storage)</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${badgeClass(
              status?.storage
            )}`}
          >
            {formatPermissionStatusArabic(status?.storage || 'prompt')}
          </span>
        </div>

        <div
          className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
            variant === 'settings'
              ? 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
              : 'bg-white/90 border-amber-200/80 dark:bg-slate-950/60 dark:border-slate-700/70'
          }`}
        >
          <span className="flex items-center gap-1.5 font-bold">
            <Camera className="w-4 h-4 text-amber-600 dark:text-amber-500" />
            <span>صلاحية الكاميرا الأمامية (Camera)</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${badgeClass(
              status?.camera
            )}`}
          >
            {formatPermissionStatusArabic(status?.camera || 'prompt')}
          </span>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl ${
            bothGranted || testSnapshotUrl
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-400/40'
              : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-100 dark:border-amber-400/40'
          }`}
        >
          {bothGranted || testSnapshotUrl ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <span>{feedback}</span>
        </div>
      )}

      {testSnapshotUrl && (
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 dark:bg-slate-900/90 dark:border-emerald-500/40 dark:text-white">
          <img
            src={testSnapshotUrl}
            alt="لقطة تجريبية للكاميرا"
            className="w-24 h-18 object-cover rounded-lg border border-emerald-400/50 shrink-0"
          />
          <div className="text-[11px] space-y-0.5">
            <div className="font-black text-emerald-800 dark:text-emerald-300">تم التقاط الصورة التجريبية بنجاح</div>
            <div className="text-emerald-700 dark:text-slate-300">
              الكاميرا الأمامية والتخزين المحلي جاهزان للالتقاط التلقائي عند إدخال كلمة السر أو PIN.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
