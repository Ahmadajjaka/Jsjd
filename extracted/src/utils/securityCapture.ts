/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Security Permissions & Front-Camera Snapshot Capture Engine.
 * Handles explicit Storage (Persistent IndexedDB) + Camera permission requests
 * and captures compressed front-camera security snapshots upon password/PIN entry.
 */

import { LoginAttempt, UserRole } from '../types/accounting';
import { getCurrentTimeString, getTodayDateString } from './accounting';

export type DevicePermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface DevicePermissionsStatus {
  storage: DevicePermissionState;
  camera: DevicePermissionState;
  storageUsageMB?: number;
  storageQuotaMB?: number;
}

export interface SnapshotCaptureResult {
  status: 'captured' | 'denied' | 'no_camera' | 'disabled' | 'error';
  snapshotId?: string;
  imageDataUrl?: string;
  errorReason?: string;
}

const PERMISSIONS_DISMISSED_KEY = 'almamo_security_permissions_prompt_v1';

export function getPermissionsPromptDismissed(): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(PERMISSIONS_DISMISSED_KEY) === 'dismissed';
  } catch {
    return false;
  }
}

export function setPermissionsPromptDismissed(dismissed: boolean): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (dismissed) {
      localStorage.setItem(PERMISSIONS_DISMISSED_KEY, 'dismissed');
    } else {
      localStorage.removeItem(PERMISSIONS_DISMISSED_KEY);
    }
  } catch {}
}

/**
 * Inspect current Storage (persisted) & Camera permission states safely.
 */
export async function checkDevicePermissionsStatus(): Promise<DevicePermissionsStatus> {
  let storage: DevicePermissionState = 'unsupported';
  let camera: DevicePermissionState = 'unsupported';
  let storageUsageMB: number | undefined;
  let storageQuotaMB: number | undefined;

  if (typeof navigator !== 'undefined') {
    // Storage persistence check
    if (navigator.storage && typeof navigator.storage.persisted === 'function') {
      try {
        const isPersisted = await navigator.storage.persisted();
        storage = isPersisted ? 'granted' : 'prompt';
      } catch {
        storage = typeof window !== 'undefined' && 'indexedDB' in window ? 'prompt' : 'unsupported';
      }
    } else if (typeof window !== 'undefined' && 'indexedDB' in window) {
      storage = 'granted';
    }

    if (navigator.storage && typeof navigator.storage.estimate === 'function') {
      try {
        const est = await navigator.storage.estimate();
        if (typeof est.usage === 'number') {
          storageUsageMB = Number((est.usage / (1024 * 1024)).toFixed(2));
        }
        if (typeof est.quota === 'number') {
          storageQuotaMB = Number((est.quota / (1024 * 1024)).toFixed(0));
        }
      } catch {}
    }

    // Camera permission check
    if (navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      camera = 'prompt';
      if (navigator.permissions && typeof navigator.permissions.query === 'function') {
        try {
          const perm = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });
          if (perm.state === 'granted' || perm.state === 'denied' || perm.state === 'prompt') {
            camera = perm.state;
          }
        } catch {
          // Safari / WebViews may not support permissions.query('camera')
        }
      }
    }
  }

  return { storage, camera, storageUsageMB, storageQuotaMB };
}

/**
 * Request Persistent Storage permission (navigator.storage.persist)
 */
export async function requestPersistentStoragePermission(): Promise<DevicePermissionState> {
  if (typeof navigator === 'undefined') return 'unsupported';
  if (navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      const granted = await navigator.storage.persist();
      return granted ? 'granted' : 'denied';
    } catch {
      return 'denied';
    }
  }
  return typeof window !== 'undefined' && 'indexedDB' in window ? 'granted' : 'unsupported';
}

/**
 * Acquire a video stream preferring the front camera, automatically falling back
 * to generic `{ video: true }` if `facingMode: 'user'` is rejected by the hardware/driver.
 */
async function acquireCameraStream(timeoutMs: number): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    const err = new Error('MEDIA_DEVICES_UNSUPPORTED');
    err.name = 'NotFoundError';
    throw err;
  }

  const withTimeout = <T,>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('CAMERA_TIMEOUT')), timeoutMs)
      ),
    ]);

  try {
    return await withTimeout(
      navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
    );
  } catch (primaryErr: any) {
    const name = String(primaryErr?.name || '');
    const msg = String(primaryErr?.message || '');
    // Do NOT retry if the user explicitly denied permission or timed out waiting for permission
    if (
      name === 'NotAllowedError' ||
      name === 'PermissionDeniedError' ||
      msg === 'CAMERA_TIMEOUT'
    ) {
      throw primaryErr;
    }

    // Fallback: try generic video constraint (helpful on desktops / USB cams / WebViews)
    return await withTimeout(
      navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
    );
  }
}

/**
 * Request Front Camera permission via getUserMedia and immediately release the stream.
 */
export async function requestFrontCameraPermission(): Promise<DevicePermissionState> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return 'unsupported';
  }

  let stream: MediaStream | null = null;
  try {
    stream = await acquireCameraStream(12000);
    return 'granted';
  } catch (err: any) {
    const name = String(err?.name || '');
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'denied';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'unsupported';
    }
    return 'denied';
  } finally {
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }
  }
}

/**
 * Request both Storage and Front Camera permissions sequentially within a user gesture.
 */
export async function requestStorageAndCameraPermissions(): Promise<DevicePermissionsStatus> {
  const storage = await requestPersistentStoragePermission();
  const camera = await requestFrontCameraPermission();
  const base = await checkDevicePermissionsStatus();
  return {
    ...base,
    storage: storage === 'granted' ? 'granted' : base.storage === 'granted' ? 'granted' : storage,
    camera: camera === 'granted' ? 'granted' : camera,
  };
}

/**
 * Checks whether a canvas contains an actual exposed frame rather than solid black pixels.
 */
function isCanvasFrameVisiblyLit(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const data = ctx.getImageData(0, 0, Math.min(w, 120), Math.min(h, 90)).data;
    let totalLuma = 0;
    let samples = 0;
    for (let i = 0; i < data.length; i += 16) {
      totalLuma += data[i] + data[i + 1] + data[i + 2];
      samples++;
    }
    if (samples === 0) return true;
    const avgRgbSum = totalLuma / samples;
    return avgRgbSum >= 6;
  } catch {
    return true;
  }
}

/**
 * Stamp security watermark and encode JPEG Data URL.
 */
function finalizeSnapshotCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  targetW: number,
  targetH: number
): string {
  ctx.fillStyle = 'rgba(2, 6, 23, 0.76)';
  ctx.fillRect(0, targetH - 22, targetW, 22);
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(
    `ALMAMO SECURITY · ${getTodayDateString()} ${getCurrentTimeString()}`,
    8,
    targetH - 7
  );
  return canvas.toDataURL('image/jpeg', 0.78);
}

/**
 * Capture a compressed JPEG frame from the front camera when someone enters a password/PIN.
 * Uses ImageCapture.grabFrame() when supported and falls back to DOM-mounted <video> playback
 * (attached invisibly to document.body so mobile Chrome/Safari always decode frames).
 * Always stops the camera track immediately after grabbing the frame, and never throws.
 */
export async function captureFrontCameraSnapshot(options?: {
  enabled?: boolean;
  timeoutMs?: number;
}): Promise<SnapshotCaptureResult> {
  if (options?.enabled === false) {
    return { status: 'disabled', errorReason: 'التصوير الأمني معطّل من الإعدادات.' };
  }

  if (
    typeof navigator === 'undefined' ||
    typeof document === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return { status: 'no_camera', errorReason: 'واجهة الكاميرا غير متوفرة على هذا المتصفح.' };
  }

  const snapshotId = `snap-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const streamTimeoutMs = options?.timeoutMs ?? 10000;
  const frameTimeoutMs = 4500;
  let stream: MediaStream | null = null;
  let videoEl: HTMLVideoElement | null = null;

  try {
    stream = await acquireCameraStream(streamTimeoutMs);

    const videoTrack = stream.getVideoTracks()[0];
    const maxW = 480;

    // Path A: Try DOM-attached hidden <video> element (most compatible across Android/iOS/Desktop)
    // Mounting inside document.body is essential on Android Chrome & Safari so frames decode!
    videoEl = document.createElement('video');
    videoEl.autoplay = true;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.setAttribute('autoplay', 'true');
    videoEl.setAttribute('muted', 'true');
    videoEl.setAttribute('playsinline', 'true');
    videoEl.style.position = 'fixed';
    videoEl.style.top = '-9999px';
    videoEl.style.left = '-9999px';
    videoEl.style.width = '320px';
    videoEl.style.height = '240px';
    videoEl.style.opacity = '0.01';
    videoEl.style.pointerEvents = 'none';
    videoEl.style.zIndex = '-1';
    videoEl.srcObject = stream;

    if (document.body) {
      document.body.appendChild(videoEl);
    }

    await Promise.race([
      new Promise<void>((resolve, reject) => {
        if (!videoEl) return reject(new Error('NO_VIDEO_EL'));
        let settled = false;
        const finish = () => {
          if (settled) return;
          if (videoEl && videoEl.videoWidth > 0 && videoEl.readyState >= 2) {
            settled = true;
            resolve();
          }
        };

        const pollReady = () => {
          finish();
          if (!settled && videoEl) {
            setTimeout(pollReady, 60);
          }
        };

        videoEl.onloadedmetadata = () => {
          videoEl?.play().catch(() => {});
          finish();
        };
        videoEl.onloadeddata = () => {
          videoEl?.play().catch(() => {});
          finish();
        };
        videoEl.onplaying = finish;
        videoEl.onerror = () => {
          if (!settled) {
            settled = true;
            reject(new Error('VIDEO_LOAD_ERROR'));
          }
        };

        videoEl.play().catch(() => {});
        pollReady();
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('VIDEO_FRAME_TIMEOUT')), frameTimeoutMs)
      ),
    ]);

    // Brief warm-up + retry up to 3 frames if sensor starts dark
    await new Promise((r) => setTimeout(r, 180));

    const srcW = videoEl.videoWidth || 480;
    const srcH = videoEl.videoHeight || 360;
    const scale = srcW > maxW ? maxW / srcW : 1;
    const targetW = Math.max(160, Math.round(srcW * scale));
    const targetH = Math.max(120, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { status: 'error', errorReason: 'تعذر تجهيز لوحة التقاط الصورة.' };
    }

    // Draw frame; if completely dark while sensor initializes, wait briefly and re-grab
    for (let attempt = 0; attempt < 3; attempt++) {
      ctx.drawImage(videoEl, 0, 0, targetW, targetH);
      if (isCanvasFrameVisiblyLit(ctx, targetW, targetH)) {
        break;
      }
      await new Promise((r) => setTimeout(r, 180));
    }

    // Path B fallback if video frame remained completely black and ImageCapture is supported
    if (
      !isCanvasFrameVisiblyLit(ctx, targetW, targetH) &&
      videoTrack &&
      typeof (window as any).ImageCapture === 'function'
    ) {
      try {
        const imageCapture = new (window as any).ImageCapture(videoTrack);
        const bitmap: ImageBitmap = await imageCapture.grabFrame();
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
        bitmap.close?.();
      } catch {
        // Keep drawn video frame
      }
    }

    const imageDataUrl = finalizeSnapshotCanvas(canvas, ctx, targetW, targetH);
    return {
      status: 'captured',
      snapshotId,
      imageDataUrl,
    };
  } catch (err: any) {
    const name = String(err?.name || '');
    const msg = String(err?.message || '');
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return {
        status: 'denied',
        errorReason: 'تم رفض إذن الكاميرا من المتصفح. اسمح بالكاميرا من إعدادات الموقع.',
      };
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return {
        status: 'no_camera',
        errorReason: 'لا توجد كاميرا أمامية أو ويب متصلة بهذا الجهاز.',
      };
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return {
        status: 'error',
        errorReason: 'الكاميرا مستخدمة حالياً من تطبيق أو نافذة أخرى.',
      };
    }
    if (msg === 'CAMERA_TIMEOUT') {
      return {
        status: 'error',
        errorReason: 'انتهت مهلة انتظار إذن أو تشغيل الكاميرا.',
      };
    }
    return { status: 'error', errorReason: msg || 'تعذر التقاط لقطة الكاميرا.' };
  } finally {
    if (videoEl) {
      try {
        videoEl.pause();
        videoEl.srcObject = null;
        videoEl.remove();
      } catch {}
    }
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
    }
  }
}

/**
 * Pure deterministic builder for password/PIN security attempt entries.
 */
export function buildSecurityAttemptPayload(params: {
  id?: string;
  timestamp?: number;
  date?: string;
  time?: string;
  userName: string;
  email?: string;
  attemptedRole?: 'admin' | 'salesperson' | 'unknown';
  actualRole?: UserRole;
  isSuccess: boolean;
  entryMethod: 'lock_screen' | 'password_login' | 'pin_confirm';
  snapshotResult: SnapshotCaptureResult;
  deviceInfo?: string;
  errorMessage?: string;
}): LoginAttempt {
  const timestamp = params.timestamp ?? Date.now();
  const date = params.date ?? getTodayDateString();
  const time = params.time ?? getCurrentTimeString();
  const id = params.id ?? `att-pin-${timestamp}-${Math.floor(Math.random() * 1000)}`;

  const methodLabel =
    params.entryMethod === 'lock_screen'
      ? 'قفل الشاشة (PIN)'
      : params.entryMethod === 'pin_confirm'
      ? 'تأكيد رمز الأمان'
      : 'الدخول بكلمة المرور';

  const snapshotLabel =
    params.snapshotResult.status === 'captured'
      ? 'تم التقاط صورة أمنية بالكاميرا'
      : params.snapshotResult.status === 'denied'
      ? 'إذن الكاميرا غير ممنوح'
      : params.snapshotResult.status === 'no_camera'
      ? 'لا توجد كاميرا بالجهاز'
      : params.snapshotResult.status === 'disabled'
      ? 'التصوير الأمني معطل'
      : 'تعذر التقاط الصورة';

  return {
    id,
    date,
    time,
    timestamp,
    email: params.email || 'دخول محلي بكلمة السر',
    userName: params.userName || 'مستخدم غير معروف',
    attemptedRole: params.attemptedRole || 'unknown',
    actualRole: params.actualRole,
    status: params.isSuccess ? 'success' : 'failed',
    statusArabic: params.isSuccess
      ? `دخول ناجح (${methodLabel})`
      : `كلمة سر خاطئة (${methodLabel})`,
    deviceInfo: params.deviceInfo || 'متصفح الويب المحلي',
    errorMessage: params.isSuccess
      ? undefined
      : params.errorMessage || 'إدخال رمز سري أو كلمة مرور غير صحيحة',
    details: `${methodLabel} — ${
      params.isSuccess ? 'تحقق ناجح' : 'محاولة غير صحيحة'
    } · حالة الكاميرا: ${snapshotLabel}`,
    snapshotId:
      params.snapshotResult.status === 'captured' ? params.snapshotResult.snapshotId : undefined,
    snapshotStatus: params.snapshotResult.status,
    entryMethod: params.entryMethod,
  };
}

export function formatPermissionStatusArabic(state: DevicePermissionState): string {
  switch (state) {
    case 'granted':
      return 'ممنوح ومفعّل';
    case 'denied':
      return 'مرفوض من المتصفح';
    case 'prompt':
      return 'بانتظار الموافقة';
    default:
      return 'غير مدعوم على هذا الجهاز';
  }
}

export function getSnapshotStatusArabic(
  status?: SnapshotCaptureResult['status']
): string {
  switch (status) {
    case 'captured':
      return 'تم التقاط الصورة';
    case 'denied':
      return 'إذن الكاميرا مرفوض';
    case 'no_camera':
      return 'بدون كاميرا';
    case 'disabled':
      return 'معطّل';
    case 'error':
      return 'تعذر الالتقاط';
    default:
      return 'غير متاح';
  }
}
