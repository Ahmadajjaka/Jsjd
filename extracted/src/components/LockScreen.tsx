import React, { useState } from 'react';
import { Lock, Camera, ShieldAlert } from 'lucide-react';
import { LoginAttempt } from '../types/accounting';
import {
  buildSecurityAttemptPayload,
  captureFrontCameraSnapshot,
} from '../utils/securityCapture';
import { saveSecuritySnapshot } from '../services/localDatabase';
import { getDeviceInfo, recordLoginAttempt } from '../services/firebaseSync';

interface LockScreenProps {
  isLocked: boolean;
  pinCode?: string;
  storeName: string;
  enableSecurityCameraCapture?: boolean;
  onUnlock: () => void;
  onPinAttempt?: (attempt: LoginAttempt) => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  isLocked,
  pinCode = '1234',
  storeName,
  enableSecurityCameraCapture = true,
  onUnlock,
  onPinAttempt,
}) => {
  const [inputPin, setInputPin] = useState('');
  const [errorMsg, setErrorMsg] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);

  if (!isLocked) return null;

  const verifyPinWithCapture = async (candidatePin: string) => {
    if (!candidatePin || isVerifying) return;
    setIsVerifying(true);
    const isSuccess = candidatePin === pinCode;

    try {
      const snapshotResult = await captureFrontCameraSnapshot({
        enabled: enableSecurityCameraCapture,
        timeoutMs: 10000,
      });

      if (snapshotResult.status === 'captured' && snapshotResult.snapshotId && snapshotResult.imageDataUrl) {
        await saveSecuritySnapshot({
          id: snapshotResult.snapshotId,
          imageDataUrl: snapshotResult.imageDataUrl,
          createdAt: Date.now(),
          userName: isSuccess ? 'فتح قفل الشاشة' : 'محاولة فتح قفل الشاشة',
          entryMethod: 'lock_screen',
          status: isSuccess ? 'success' : 'failed',
        });
      }

      const dev = getDeviceInfo();
      const localAttempt = buildSecurityAttemptPayload({
        userName: isSuccess ? 'فتح قفل الشاشة بنجاح' : 'محاولة إدخال رمز قفل خاطئ',
        email: 'قفل الشاشة (PIN)',
        attemptedRole: 'admin',
        isSuccess,
        entryMethod: 'lock_screen',
        snapshotResult,
        deviceInfo: dev.deviceLabel,
        errorMessage: isSuccess ? undefined : 'تم إدخال رمز سري خاطئ عند قفل الشاشة',
      });

      onPinAttempt?.(localAttempt);

      recordLoginAttempt({
        id: localAttempt.id,
        status: localAttempt.status,
        statusArabic: localAttempt.statusArabic,
        email: localAttempt.email,
        userName: localAttempt.userName,
        attemptedRole: 'admin',
        errorMessage: localAttempt.errorMessage,
        details: localAttempt.details,
        snapshotId: localAttempt.snapshotId,
        snapshotStatus: localAttempt.snapshotStatus,
        entryMethod: 'lock_screen',
      }).catch(() => {});

      if (isSuccess) {
        setInputPin('');
        setErrorMsg(false);
        setSecurityNotice(null);
        onUnlock();
      } else {
        setErrorMsg(true);
        setSecurityNotice(
          snapshotResult.status === 'captured'
            ? 'تم التقاط صورة أمنية وتسجيل محاولة الدخول في السجل.'
            : snapshotResult.errorReason
            ? `تم تسجيل المحاولة (${snapshotResult.errorReason})`
            : 'تم تسجيل المحاولة الخاطئة في سجل الأمان.'
        );
        setTimeout(() => {
          setInputPin('');
          setErrorMsg(false);
        }, 900);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (isVerifying) return;
    if (inputPin.length < 6) {
      const next = inputPin + digit;
      setInputPin(next);
      setErrorMsg(false);
      if (next === pinCode || next.length === pinCode.length) {
        void verifyPinWithCapture(next);
      }
    }
  };

  const handleClear = () => {
    if (isVerifying) return;
    setInputPin('');
    setErrorMsg(false);
  };

  return (
    <div
      id="app-lock-screen"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950 text-white"
    >
      <div className="w-full max-w-xs space-y-5 text-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-amber-400 mb-3 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-black">{storeName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            النظام مقفل لحماية بيانات الحسابات
          </p>
          {enableSecurityCameraCapture && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300">
              <Camera className="w-3 h-3" />
              <span>التصوير الأمني مفعّل عند إدخال الرمز</span>
            </div>
          )}
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-3 py-2">
          {Array.from({ length: pinCode.length || 4 }).map((_, i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                errorMsg
                  ? 'bg-rose-500 border-rose-500 animate-shake'
                  : i < inputPin.length
                  ? 'bg-amber-400 border-amber-400 scale-110'
                  : 'border-slate-700 bg-slate-900'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs font-bold text-rose-400">
            الرمز السري غير صحيح، حاول ثانية
          </p>
        )}

        {securityNotice && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{securityNotice}</span>
          </div>
        )}

        {/* Keypad */}
        <div dir="ltr" className="grid grid-cols-3 gap-2 p-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={isVerifying}
              onClick={() => handleDigit(digit)}
              className="py-3 text-lg font-bold font-mono bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={isVerifying}
            onClick={handleClear}
            className="py-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/50 rounded-xl cursor-pointer"
          >
            مسح
          </button>
          <button
            type="button"
            disabled={isVerifying}
            onClick={() => handleDigit('0')}
            className="py-3 text-lg font-bold font-mono bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
          >
            0
          </button>
          <button
            type="button"
            disabled={isVerifying || inputPin.length === 0}
            onClick={() => void verifyPinWithCapture(inputPin)}
            className="py-3 text-xs font-bold text-amber-400 hover:bg-slate-800 bg-slate-900/50 rounded-xl disabled:opacity-50 cursor-pointer"
          >
            {isVerifying ? '...' : 'فتح'}
          </button>
        </div>
      </div>
    </div>
  );
};
