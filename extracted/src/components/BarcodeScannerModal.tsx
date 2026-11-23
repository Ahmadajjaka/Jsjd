import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  CheckCircle2,
  AlertTriangle,
  ScanBarcode,
  Keyboard,
  SwitchCamera,
} from 'lucide-react';
import {
  BrowserMultiFormatReader,
  IScannerControls,
} from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Product } from '../types/accounting';
import { findProductByBarcode, playScanBeep } from '../utils/barcodeMatch';
import { formatCurrency } from '../utils/accounting';
import { StoreSettings } from '../types/accounting';

export interface BarcodeScanOutcome {
  status: 'added' | 'selected' | 'not_found';
  code: string;
  product?: Product;
  message: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  onProductScanned: (product: Product, autoAdd: boolean) => void;
  defaultAutoAdd?: boolean;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  settings,
  onProductScanned,
  defaultAutoAdd = true,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const productsRef = useRef<Product[]>(products);
  productsRef.current = products;

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'error'>('starting');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const [continuousMode, setContinuousMode] = useState(true);
  const [autoAddMode, setAutoAddMode] = useState(defaultAutoAdd);
  const [manualCode, setManualCode] = useState('');
  const [lastOutcome, setLastOutcome] = useState<BarcodeScanOutcome | null>(null);

  const continuousModeRef = useRef(continuousMode);
  continuousModeRef.current = continuousMode;
  const autoAddModeRef = useRef(autoAddMode);
  autoAddModeRef.current = autoAddMode;
  const onProductScannedRef = useRef(onProductScanned);
  onProductScannedRef.current = onProductScanned;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      // ignore
    }
    controlsRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
      } catch {
        // ignore
      }
    }

    try {
      BrowserMultiFormatReader.releaseAllStreams();
    } catch {
      // ignore
    }

    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const handleDecodedCode = useCallback((rawCode: string, fromManual: boolean = false) => {
    const clean = rawCode.trim();
    if (!clean) return;

    const now = Date.now();
    if (
      !fromManual &&
      lastScanRef.current.code === clean &&
      now - lastScanRef.current.time < 1700
    ) {
      return;
    }
    lastScanRef.current = { code: clean, time: now };

    const match = findProductByBarcode(productsRef.current, clean);

    if (match.product) {
      playScanBeep(true);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(75);
        } catch {
          // ignore
        }
      }

      const willAutoAdd = autoAddModeRef.current;
      onProductScannedRef.current(match.product, willAutoAdd);

      setLastOutcome({
        status: willAutoAdd ? 'added' : 'selected',
        code: clean,
        product: match.product,
        message: willAutoAdd
          ? `تم مسح وإدراج «${match.product.name}» للفاتورة`
          : `تم اختيار «${match.product.name}» بنجاح`,
      });

      if (!continuousModeRef.current || !willAutoAdd) {
        setTimeout(() => {
          stopCamera();
          onCloseRef.current();
        }, 280);
      }
    } else {
      playScanBeep(false);
      setLastOutcome({
        status: 'not_found',
        code: clean,
        message: `لم يتم العثور على مادة مطابقة للرمز: ${clean}`,
      });
    }
  }, [stopCamera]);

  const startCamera = useCallback(async (preferredDeviceId?: string) => {
    stopCamera();
    setCameraState('starting');
    setErrorMessage('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage(
        'متصفحك الحالي لا يدعم تشغيل الكاميرا مباشرة. يمكنك إدخال الباركود أو الكود يدوياً أدناه.'
      );
      return;
    }

    try {
      const hints = new Map();
      hints.set(DecodeHintType.TRY_HARDER, true);
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);

      const reader = new BrowserMultiFormatReader(hints, {
        delayBetweenScanAttempts: 180,
        delayBetweenScanSuccess: 800,
      });

      const constraints: MediaStreamConstraints = preferredDeviceId
        ? {
            audio: false,
            video: {
              deviceId: { exact: preferredDeviceId },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          }
        : {
            audio: false,
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const videoEl = videoRef.current;
      if (!videoEl) {
        stopCamera();
        return;
      }

      // Check torch capability on active video track
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const caps = videoTrack.getCapabilities?.() as MediaTrackCapabilities & {
            torch?: boolean;
          };
          setTorchSupported(Boolean(caps && caps.torch));
        } catch {
          setTorchSupported(false);
        }
      }

      // List available video cameras after permission granted
      try {
        const list = await BrowserMultiFormatReader.listVideoInputDevices();
        setDevices(list);
        if (videoTrack) {
          const settingsId = videoTrack.getSettings?.().deviceId;
          if (settingsId) setSelectedDeviceId(settingsId);
        }
      } catch {
        // ignore device enumeration errors
      }

      const controls = await reader.decodeFromStream(stream, videoEl, (result) => {
        if (result) {
          handleDecodedCode(result.getText(), false);
        }
      });

      controlsRef.current = controls;
      setCameraState('active');
    } catch (err: unknown) {
      stopCamera();
      setCameraState('error');
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setErrorMessage(
          'تم رفض صلاحية الكاميرا. يرجى السماح بالوصول للكاميرا من إعدادات المتصفح أو استخدام الإدخال اليدوي بالأسفل.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setErrorMessage(
          'لم يتم اكتشاف كاميرا متصلة بهذا الجهاز. يمكنك كتابة رمز المادة أو الباركود يدوياً بالأسفل.'
        );
      } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
        setErrorMessage(
          'الكاميرا مستخدمة حالياً من تطبيق آخر. أغلق التطبيق الآخر ثم أعد المحاولة.'
        );
      } else {
        setErrorMessage(
          'تعذر تشغيل الكاميرا في هذا المتصفح. تأكد من فتح التطبيق عبر HTTPS أو استخدم البحث بالرمز أدناه.'
        );
      }
    }
  }, [handleDecodedCode, stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setLastOutcome(null);
      setManualCode('');
      return;
    }

    startCamera();
    return () => {
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  const handleSwitchCamera = () => {
    if (devices.length < 2) return;
    const currentIdx = devices.findIndex((d) => d.deviceId === selectedDeviceId);
    const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % devices.length;
    const nextId = devices[nextIdx].deviceId;
    setSelectedDeviceId(nextId);
    startCamera(nextId);
  };

  const handleToggleTorch = async () => {
    if (!streamRef.current || !torchSupported) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch {
      // ignore unsupported runtime torch error
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleDecodedCode(manualCode, true);
    setManualCode('');
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ماسح الباركود بالكاميرا"
      dir="rtl"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 font-['Cairo',sans-serif]"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0">
              <ScanBarcode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                مسح الباركود بكاميرا الجهاز
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                وجّه الكاميرا نحو باركود المنتج لاختياره وإدراجه فوراً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            aria-label="إغلاق الماسح"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto">
          {/* Mode Toggles */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setAutoAddMode((prev) => !prev)}
              className={`py-2 px-3 rounded-xl border font-bold text-right transition-colors cursor-pointer flex items-center justify-between ${
                autoAddMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-200'
                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <span>إدراج تلقائي للفاتورة</span>
              <span className="font-mono text-[10px] font-black">
                {autoAddMode ? 'مفعّل' : 'اختيار فقط'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setContinuousMode((prev) => !prev)}
              className={`py-2 px-3 rounded-xl border font-bold text-right transition-colors cursor-pointer flex items-center justify-between ${
                continuousMode
                  ? 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-200'
                  : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              <span>المسح المتواصل</span>
              <span className="font-mono text-[10px] font-black">
                {continuousMode ? 'متواصل' : 'مرة واحدة'}
              </span>
            </button>
          </div>

          {/* Camera Preview Box */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-[4/3] sm:aspect-video flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${
                cameraState === 'active' ? 'opacity-100' : 'opacity-25'
              }`}
            />

            {/* Viewfinder Frame Overlay */}
            {cameraState === 'active' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="relative w-full max-w-[260px] h-36 border border-white/25 rounded-xl bg-black/5">
                  <span className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-4 border-r-4 border-amber-400 rounded-tr-lg" />
                  <span className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-4 border-l-4 border-amber-400 rounded-tl-lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-4 border-r-4 border-amber-400 rounded-br-lg" />
                  <span className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-4 border-l-4 border-amber-400 rounded-bl-lg" />
                  <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.9)] animate-pulse" />
                </div>
              </div>
            )}

            {/* Top Camera Toolbar */}
            <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {devices.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSwitchCamera}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/15 cursor-pointer"
                  >
                    <SwitchCamera className="w-3.5 h-3.5 text-amber-400" />
                    <span>تبديل الكاميرا</span>
                  </button>
                )}

                {torchSupported && (
                  <button
                    type="button"
                    onClick={handleToggleTorch}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border cursor-pointer ${
                      torchOn
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-slate-900/80 hover:bg-slate-900 text-white border-white/15'
                    }`}
                  >
                    <Flashlight className="w-3.5 h-3.5" />
                    <span>{torchOn ? 'إطفاء الفلاش' : 'فلاش'}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => startCamera(selectedDeviceId || undefined)}
                title="إعادة تشغيل الكاميرا"
                className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white border border-white/15 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Starting State */}
            {cameraState === 'starting' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white p-4 text-center">
                <Camera className="w-9 h-9 text-amber-400 animate-pulse" />
                <p className="text-xs font-bold">جاري تشغيل الكاميرا...</p>
                <p className="text-[11px] text-slate-300">
                  يرجى السماح بصلاحية الكاميرا عند طلب المتصفح
                </p>
              </div>
            )}

            {/* Error State */}
            {cameraState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white p-5 text-center bg-slate-950/90">
                <AlertTriangle className="w-9 h-9 text-amber-400" />
                <p className="text-xs font-bold leading-relaxed text-slate-200 max-w-sm">
                  {errorMessage}
                </p>
                <button
                  type="button"
                  onClick={() => startCamera(selectedDeviceId || undefined)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>إعادة محاولة تشغيل الكاميرا</span>
                </button>
              </div>
            )}
          </div>

          {/* Scan Result Feedback Banner */}
          {lastOutcome && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                lastOutcome.status === 'not_found'
                  ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {lastOutcome.status === 'not_found' ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="font-bold truncate">{lastOutcome.message}</p>
                  {lastOutcome.product && (
                    <p className="text-[11px] opacity-80 font-mono">
                      كود: {lastOutcome.product.barcode || lastOutcome.product.code} · السعر:{' '}
                      {formatCurrency(lastOutcome.product.sellingPrice, settings)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Manual / Hardware Scanner Fallback Input */}
          <form onSubmit={handleManualSubmit} className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Keyboard className="w-3.5 h-3.5 text-slate-500" />
              <span>أو أدخل الباركود / كود المادة يدوياً (أو بجهاز المسح اليدوي):</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="مثال: ELE-001 أو 6221234567890..."
                className="flex-1 text-xs p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-amber-500 focus:outline-hidden bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer"
              >
                مطابقة
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            يدعم EAN-13 و Code-128 و QR وكود المادة الداخلي
          </span>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
          >
            تم / إغلاق
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
