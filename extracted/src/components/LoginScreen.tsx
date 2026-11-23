import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Store,
  ShieldCheck,
  AlertOctagon,
  Database,
  CheckCircle2,
  RefreshCw,
  WifiOff,
  ArrowRight,
  Sparkles,
  Wrench,
  Boxes,
  Zap,
  Eye,
  EyeOff,
  BadgeCheck,
  ShoppingCart,
  User,
  ShieldAlert,
  HardDrive,
  Send,
  Clock,
  Ban,
  Lock,
  Keyboard,
  Smartphone,
} from 'lucide-react';
import {
  AppUser,
  LoginAccessRequest,
  LoginAttempt,
  StoreSettings,
  UserRole,
} from '../types/accounting';
import {
  signInWithGoogleAccount,
  processPendingGoogleRedirectSignIn,
  recordLoginAttempt,
  createStoreOwnerUser,
  createSellerUser,
  subscribeToSingleAccessRequest,
  submitLoginAccessRequestToFirestore,
  isFirebaseAuthActive,
  getDeviceInfo,
} from '../services/firebaseSync';
import {
  saveCachedSession,
  getOutboxSync,
  saveSecuritySnapshot,
} from '../services/localDatabase';
import {
  authenticateUser,
  ROLE_NAMES_ARABIC,
  ROLE_PRESET_PERMISSIONS,
  resolveUserModerationStatus,
} from '../utils/permissions';
import { getCurrentTimeString, getTodayDateString } from '../utils/accounting';
import {
  buildSecurityAttemptPayload,
  captureFrontCameraSnapshot,
} from '../utils/securityCapture';
import {
  formatFirebaseAuthErrorArabic,
  isAndroidWebViewShell,
  isCapacitorNativeShell,
} from '../utils/apkEnvironment';
import { toggleAndroidKeyboardDrawer } from '../utils/androidKeyboard';
import { ThreeHardwareScene } from './ThreeHardwareScene';
import { SecurityPermissionsBanner } from './SecurityPermissionsBanner';
import { formatWelcome3DTitle } from '../utils/welcome3d';

interface LoginScreenProps {
  settings: StoreSettings;
  users?: AppUser[];
  accessRequests?: LoginAccessRequest[];
  externalError?: string;
  onSubmitAccessRequest?: (req: LoginAccessRequest) => void;
  onRecordSecurityAttempt?: (attempt: LoginAttempt) => void;
  onLoginSuccess: (user: AppUser) => void;
}

const LAST_REQUEST_STORAGE_KEY = 'almamo_last_access_request_id';

export const LoginScreen: React.FC<LoginScreenProps> = ({
  settings,
  users = [],
  accessRequests = [],
  externalError = '',
  onSubmitAccessRequest,
  onRecordSecurityAttempt,
  onLoginSuccess,
}) => {
  const [errorMsg, setErrorMsg] = useState(externalError);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isNetworkError, setIsNetworkError] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingOfflineCount] = useState(() => getOutboxSync().length);
  const [googleRolePreference, setGoogleRolePreference] = useState<'salesperson' | 'admin'>('salesperson');
  const [googleSellerCustomName, setGoogleSellerCustomName] = useState('');
  const [is3dActive, setIs3dActive] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isAndroidApk = isCapacitorNativeShell();
  const disableCardTilt = isAndroidApk || isAndroidWebViewShell() || isInputFocused;

  // Password Login with Front-Camera Security Snapshot
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isPasswordChecking, setIsPasswordChecking] = useState(false);
  const [passwordSecurityFeedback, setPasswordSecurityFeedback] = useState<string | null>(null);

  // Access Request Submission & Live Tracker State
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqFullName, setReqFullName] = useState('');
  const [reqEmail, setReqEmail] = useState('');
  const [reqRole, setReqRole] = useState<'salesperson' | 'accountant' | 'warehouse'>('salesperson');
  const [reqReason, setReqReason] = useState('');
  const [trackedRequestId, setTrackedRequestId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_REQUEST_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [cloudTrackedRequest, setCloudTrackedRequest] = useState<LoginAccessRequest | null>(null);

  useEffect(() => {
    if (externalError) {
      setErrorMsg(externalError);
    }
  }, [externalError]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      setIsNetworkError(false);
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Subscribe to tracked request in Firestore when Firebase Auth is active
  useEffect(() => {
    if (!trackedRequestId || !isFirebaseAuthActive()) return;
    const unsub = subscribeToSingleAccessRequest(trackedRequestId, (req) => {
      if (req) setCloudTrackedRequest(req);
    });
    return () => unsub();
  }, [trackedRequestId]);

  const activeTrackedRequest = useMemo(() => {
    if (!trackedRequestId) return null;
    const localMatch = accessRequests.find((r) => r.id === trackedRequestId);
    if (localMatch) return localMatch;
    if (cloudTrackedRequest && cloudTrackedRequest.id === trackedRequestId) {
      return cloudTrackedRequest;
    }
    return null;
  }, [trackedRequestId, accessRequests, cloudTrackedRequest]);

  // Complete pending OAuth redirect flow if returning inside APK / WebAPK / Mobile Chrome
  useEffect(() => {
    let active = true;
    processPendingGoogleRedirectSignIn()
      .then((res) => {
        if (!active || !res) return;
        if (res.pendingRequest) {
          try {
            localStorage.setItem(LAST_REQUEST_STORAGE_KEY, res.pendingRequest.id);
          } catch {}
          setTrackedRequestId(res.pendingRequest.id);
          setCloudTrackedRequest(res.pendingRequest);
          onSubmitAccessRequest?.(res.pendingRequest);
          return;
        }
        onLoginSuccess(res.appUser);
      })
      .catch((err) => {
        if (!active || !err) return;
        const translated = formatFirebaseAuthErrorArabic(err);
        setIsNetworkError(translated.isNetwork);
        setErrorMsg(translated.message);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleEnterWithApprovedRequest = async (req: LoginAccessRequest) => {
    const role: UserRole = req.assignedRole || req.requestedRole || 'salesperson';
    const matchingUser = users.find(
      (u) =>
        (req.uid && u.id === req.uid) ||
        (req.email && u.email && u.email.toLowerCase() === req.email.toLowerCase()) ||
        (req.username && u.username.toLowerCase() === req.username.toLowerCase())
    );

    const isRestricted = req.status === 'restricted' || matchingUser?.accessStatus === 'restricted';
    const finalPerms =
      matchingUser?.permissions ||
      req.assignedPermissions ||
      ROLE_PRESET_PERMISSIONS[role] ||
      ROLE_PRESET_PERMISSIONS.salesperson;

    const appUser: AppUser = matchingUser || {
      id: req.uid || `user-${req.id}`,
      username: req.username || req.email.split('@')[0] || 'staff',
      password: '',
      email: req.email,
      fullName: req.fullName,
      role,
      roleNameArabic: isRestricted
        ? 'مستخدم مقيد الصلاحيات'
        : ROLE_NAMES_ARABIC[role] || req.requestedRoleArabic,
      permissions: finalPerms,
      isActive: true,
      accessStatus: isRestricted ? 'restricted' : 'approved',
      isReadOnly: req.isReadOnly,
      restrictionNote: req.restrictionNote,
      avatarColor: isRestricted
        ? 'bg-amber-600 text-white font-bold'
        : 'bg-sky-600 text-white font-bold',
      createdAt: req.date,
      lastLogin: `${getTodayDateString()} ${getCurrentTimeString()}`,
    };

    await saveCachedSession(appUser, isFirebaseAuthActive() ? 'google' : 'offline');
    onLoginSuccess(appUser);
  };

  const handleOfflineLocalEnter = async () => {
    setErrorMsg('');
    const customName = googleSellerCustomName.trim();

    if (googleRolePreference === 'admin') {
      const offlineUser = createStoreOwnerUser();
      await saveCachedSession(offlineUser, 'offline');
      onLoginSuccess(offlineUser);
      return;
    }

    if (customName) {
      const moderation = resolveUserModerationStatus({
        users,
        accessRequests,
        identifier: customName,
      });
      if (moderation.outcome === 'banned' || moderation.outcome === 'rejected') {
        setErrorMsg(
          moderation.message ||
            'تم منع هذا الحساب من الدخول بناءً على قرار المدير العام (محظور أو مرفوض).'
        );
        return;
      }
      if (moderation.outcome === 'pending') {
        setErrorMsg('طلب دخولك ما زال قيد المراجعة بانتظار قبول المدير العام.');
        return;
      }
      if (moderation.matchedUser) {
        await saveCachedSession(moderation.matchedUser, 'offline');
        onLoginSuccess(moderation.matchedUser);
        return;
      }
      if (
        moderation.matchedRequest &&
        (moderation.outcome === 'approved' || moderation.outcome === 'restricted')
      ) {
        await handleEnterWithApprovedRequest(moderation.matchedRequest);
        return;
      }
    }

    const offlineUser = createSellerUser(customName || 'بائع المتجر (وضع أوفلاين)');
    await saveCachedSession(offlineUser, 'offline');
    onLoginSuccess(offlineUser);
  };

  const handlePasswordLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordChecking) return;
    const cleanUser = loginUsername.trim();
    const cleanPass = loginPassword.trim();
    if (!cleanUser || !cleanPass) {
      setErrorMsg('يرجى إدخال اسم المستخدم وكلمة المرور.');
      return;
    }

    setIsPasswordChecking(true);
    setErrorMsg('');
    setPasswordSecurityFeedback(null);

    try {
      const snapshotResult = await captureFrontCameraSnapshot({
        enabled: settings.enableSecurityCameraCapture ?? true,
        timeoutMs: 10000,
      });

      const moderation = resolveUserModerationStatus({
        users,
        accessRequests,
        identifier: cleanUser,
      });

      const matchedByPassword = authenticateUser(users, cleanUser, cleanPass);
      const isPinOwnerBypass =
        cleanUser.toLowerCase() === 'admin' &&
        !!settings.pinCode &&
        cleanPass === settings.pinCode;
      const finalMatchedUser =
        matchedByPassword || (isPinOwnerBypass ? createStoreOwnerUser() : null);

      const isBlockedByModeration =
        moderation.outcome === 'banned' ||
        moderation.outcome === 'rejected' ||
        moderation.outcome === 'pending';

      const isSuccess = !!finalMatchedUser && !isBlockedByModeration;

      if (
        snapshotResult.status === 'captured' &&
        snapshotResult.snapshotId &&
        snapshotResult.imageDataUrl
      ) {
        await saveSecuritySnapshot({
          id: snapshotResult.snapshotId,
          imageDataUrl: snapshotResult.imageDataUrl,
          createdAt: Date.now(),
          userName: finalMatchedUser?.fullName || cleanUser,
          entryMethod: 'password_login',
          status: isSuccess ? 'success' : 'failed',
        });
      }

      const dev = getDeviceInfo();
      const attempt = buildSecurityAttemptPayload({
        userName: finalMatchedUser?.fullName || cleanUser,
        email: cleanUser,
        attemptedRole:
          finalMatchedUser?.role === 'admin' ? 'admin' : 'salesperson',
        actualRole: finalMatchedUser?.role,
        isSuccess,
        entryMethod: 'password_login',
        snapshotResult,
        deviceInfo: dev.deviceLabel,
        errorMessage: isSuccess
          ? undefined
          : isBlockedByModeration
          ? moderation.message
          : 'اسم المستخدم أو كلمة المرور غير صحيحة',
      });

      onRecordSecurityAttempt?.(attempt);
      recordLoginAttempt({
        id: attempt.id,
        status: attempt.status,
        statusArabic: attempt.statusArabic,
        email: attempt.email,
        userName: attempt.userName,
        attemptedRole: attempt.attemptedRole,
        actualRole: attempt.actualRole,
        errorMessage: attempt.errorMessage,
        details: attempt.details,
        snapshotId: attempt.snapshotId,
        snapshotStatus: attempt.snapshotStatus,
        entryMethod: 'password_login',
      }).catch(() => {});

      if (snapshotResult.status === 'captured') {
        setPasswordSecurityFeedback('تم توثيق المحاولة والتقاط لقطة أمان بالكاميرا وحفظها.');
      } else if (snapshotResult.status !== 'disabled') {
        setPasswordSecurityFeedback(
          snapshotResult.errorReason ||
            'لم يتم التقاط صورة أمنية — تأكد من السماح بإذن الكاميرا في المتصفح.'
        );
      }

      if (isBlockedByModeration) {
        setErrorMsg(
          moderation.message || 'هذا الحساب غير مصرح له بالدخول حالياً.'
        );
        return;
      }

      if (!finalMatchedUser) {
        setErrorMsg('اسم المستخدم أو كلمة المرور غير صحيحة.');
        return;
      }

      await saveCachedSession(finalMatchedUser, 'offline');
      onLoginSuccess(finalMatchedUser);
    } finally {
      setIsPasswordChecking(false);
    }
  };

  const handleSubmitDirectRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanName = reqFullName.trim();
    const cleanEmail = reqEmail.trim();
    if (!cleanName || !cleanEmail) {
      setErrorMsg('يرجى كتابة الاسم الكامل والبريد الإلكتروني أو اسم المستخدم لإرسال طلب الدخول.');
      return;
    }

    // Prevent banned users from re-entering silently
    const modCheck = resolveUserModerationStatus({
      users,
      accessRequests,
      identifier: cleanEmail,
    });
    if (modCheck.outcome === 'banned') {
      setErrorMsg(modCheck.message || 'هذا الحساب محظور نهائياً من الدخول إلى النظام.');
      return;
    }

    const nowDate = getTodayDateString();
    const nowTime = getCurrentTimeString();
    const newReq: LoginAccessRequest = {
      id: `req-${Date.now()}`,
      email: cleanEmail,
      username: cleanEmail.includes('@') ? cleanEmail.split('@')[0].toLowerCase() : cleanEmail.toLowerCase(),
      fullName: cleanName,
      requestedRole: reqRole,
      requestedRoleArabic: ROLE_NAMES_ARABIC[reqRole] || 'كاشير وبائع',
      reason: reqReason.trim() || 'طلب تصريح دخول للعمل على نظام المتجر',
      status: 'pending',
      deviceInfo: typeof navigator !== 'undefined' ? navigator.platform : 'Web',
      date: nowDate,
      time: nowTime,
      timestamp: Date.now(),
    };

    try {
      localStorage.setItem(LAST_REQUEST_STORAGE_KEY, newReq.id);
    } catch {}
    setTrackedRequestId(newReq.id);
    setCloudTrackedRequest(newReq);
    onSubmitAccessRequest?.(newReq);
    if (isFirebaseAuthActive()) {
      submitLoginAccessRequestToFirestore(newReq).catch(() => {});
    }
    setShowRequestForm(false);
    setReqReason('');
  };

  // Card 3D tilt tracking
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardTilt, setCardTilt] = useState({ rx: 0, ry: 0 });

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disableCardTilt || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCardTilt({ rx: -y * 8, ry: x * 8 });
  };

  const handleCardMouseLeave = () => {
    setCardTilt({ rx: 0, ry: 0 });
  };

  const handleGoogleSignIn = async (
    rolePref: 'salesperson' | 'admin' = googleRolePreference,
    customName?: string
  ) => {
    setIsGoogleLoading(true);
    setErrorMsg('');
    setIsNetworkError(false);
    const finalName =
      customName !== undefined ? customName : googleSellerCustomName.trim() || undefined;
    try {
      const { appUser, pendingRequest } = await signInWithGoogleAccount(
        rolePref,
        finalName,
        reqRole,
        reqReason || undefined
      );

      if (pendingRequest) {
        try {
          localStorage.setItem(LAST_REQUEST_STORAGE_KEY, pendingRequest.id);
        } catch {}
        setTrackedRequestId(pendingRequest.id);
        setCloudTrackedRequest(pendingRequest);
        onSubmitAccessRequest?.(pendingRequest);
        return;
      }

      onLoginSuccess(appUser);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/redirect-started') {
        return;
      }

      const translated = formatFirebaseAuthErrorArabic(err);

      if (code === 'auth/popup-blocked') {
        setIsNetworkError(false);
        setErrorMsg(translated.message);
        recordLoginAttempt({
          status: 'blocked',
          statusArabic: 'محظورة بالمتصفح',
          userName: finalName || 'مستخدم متجر',
          attemptedRole: rolePref,
          errorMessage: 'حظر النافذة المنبثقة (Popup Blocked)',
          details: 'قام المتصفح بحظر النافذة المنبثقة لتسجيل الدخول بحساب Google.',
        }).catch(() => {});
      } else if (code === 'auth/popup-closed-by-user') {
        setIsNetworkError(false);
        setErrorMsg(translated.message);
        recordLoginAttempt({
          status: 'cancelled',
          statusArabic: 'ملغاة من المستخدم',
          userName: finalName || 'مستخدم متجر',
          attemptedRole: rolePref,
          errorMessage: 'إغلاق نافذة تسجيل الدخول',
          details: 'قام المستخدم بإغلاق نافذة Google المنبثقة قبل استكمال توثيق الدخول.',
        }).catch(() => {});
      } else if (translated.isNetwork) {
        setIsNetworkError(true);
        setErrorMsg(translated.message);
        recordLoginAttempt({
          status: 'failed',
          statusArabic: 'فشل بالشبكة',
          userName: finalName || 'مستخدم متجر',
          attemptedRole: rolePref,
          errorMessage: 'خطأ اتصال بالشبكة (Network error)',
          details: 'فشل الاتصال بخوادم Google أثناء محاولة تسجيل الدخول.',
        }).catch(() => {});
      } else {
        setIsNetworkError(false);
        setErrorMsg(translated.message);
        recordLoginAttempt({
          status: 'failed',
          statusArabic: translated.isApkOrShaIssue ? 'تقييد نطاق / SHA' : 'مرفوضة / محظورة',
          userName: finalName || 'مستخدم متجر',
          attemptedRole: rolePref,
          errorMessage: err?.message || 'خطأ دخول',
          details: `تعذر إتمام الدخول: ${translated.message}`,
        }).catch(() => {});
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip bg-slate-950 text-slate-100 font-['Cairo',sans-serif] selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between">
      {/* 1. Real-time 3D Three.js Hardware Backdrop */}
      {is3dActive && (
        <ThreeHardwareScene
          interactive={true}
          speed={1.0}
          className="fixed inset-0 transition-opacity duration-700 opacity-95"
        />
      )}

      {/* 2. Cinematic Background Lighting & Vignette Overlays */}
      <div className="absolute inset-0 bg-radial from-transparent via-slate-950/40 to-slate-950/90 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-slate-950/90 via-slate-950/40 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-slate-950/95 via-slate-950/50 to-transparent pointer-events-none" />

      {/* Top Floating Header */}
      <header className="relative z-20 w-full px-5 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 shadow-lg shadow-amber-500/25 border border-amber-300/40">
            <Store className="w-5 h-5 text-slate-950" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          </div>
          <div>
            <span className="text-sm font-black tracking-wider text-white">
              {settings.storeName || 'متجر خردوات المامو'}
            </span>
            <span className="block text-[11px] font-medium text-amber-400/90">
              بإدارة أحمد المامو
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setIs3dActive((prev) => !prev)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            title="تبديل وضع الخلفية ثلاثية الأبعاد 3D"
          >
            {is3dActive ? (
              <Eye className="w-3.5 h-3.5 text-amber-400" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {is3dActive ? 'خلفية 3D تفاعلية نشطة' : 'إيقاف 3D'}
            </span>
          </button>

          {isOnline ? (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-bold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>متصل · Cloud Firestore جاهز</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[11px] sm:text-xs font-bold backdrop-blur-md">
              <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">بلا إنترنت · القاعدة المحلية جاهزة</span>
              <span className="sm:hidden">بلا نت · محلي</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Center Container */}
      <main className="relative z-20 flex-1 flex items-center justify-center px-4 py-2 sm:py-3">
        <div
          ref={cardRef}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          onFocusCapture={() => setIsInputFocused(true)}
          onBlurCapture={() => setIsInputFocused(false)}
          style={
            disableCardTilt || (cardTilt.rx === 0 && cardTilt.ry === 0)
              ? undefined
              : {
                  transform: `perspective(1200px) rotateX(${cardTilt.rx}deg) rotateY(${cardTilt.ry}deg)`,
                  transition: 'transform 0.15s ease-out',
                }
          }
          className="w-full max-w-xl bg-slate-900/90 backdrop-blur-2xl rounded-3xl border border-amber-500/30 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_40px_rgba(245,158,11,0.15)] overflow-hidden relative"
        >
          <div className="h-1 w-full bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 animate-pulse" />

          {/* Hero Header */}
          <div className="px-5 sm:px-6 pt-4 pb-3 text-center relative overflow-hidden">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-36 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="relative inline-flex items-center justify-center mb-2.5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-slate-950 via-slate-850 to-amber-950/80 border-2 border-amber-400/50 shadow-2xl flex items-center justify-center text-amber-400">
                <Store className="w-7 h-7" />
              </div>
              <div className="absolute -bottom-2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider shadow-md whitespace-nowrap">
                مراقب بصلاحيات الآدمن
              </div>
            </div>

            <div className="stage-3d-preserve" style={{ transform: 'translateZ(26px)' }}>
              <h1 className="text-xl sm:text-3xl font-black tracking-tight text-balance text-3d-hardware-night">
                {formatWelcome3DTitle(settings.storeName)}
              </h1>
            </div>

            <div className="inline-flex items-center gap-1.5 mt-1.5 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40">
              <BadgeCheck className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-bold text-amber-300">
                بإدارة أحمد المامو (أحمد نوار المامو)
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800/80 text-slate-300 rounded-full text-[11px] font-semibold border border-slate-700/60">
                <Wrench className="w-3 h-3 text-amber-400" />
                خردوات وعدد احترافية
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800/80 text-slate-300 rounded-full text-[11px] font-semibold border border-slate-700/60">
                <Database className="w-3 h-3 text-emerald-400" />
                قاعدة محلية ومزامنة سحابية
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-800/80 text-slate-300 rounded-full text-[11px] font-semibold border border-slate-700/60">
                <ShieldCheck className="w-3 h-3 text-amber-400" />
                موافقة ورقابة المدير العام
              </span>
              {isAndroidApk && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-950/90 text-emerald-300 rounded-full text-[11px] font-bold border border-emerald-500/40">
                  <Smartphone className="w-3 h-3 text-emerald-400" />
                  تطبيق أندرويد أصلي (دخول عبر الجهاز بدون متصفح)
                </span>
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 pb-4 pt-0 space-y-2.5">
            {/* Error Banner */}
            {errorMsg && (
              <div className="p-3 bg-rose-950/80 border-2 border-rose-500/60 text-rose-200 rounded-2xl text-xs font-bold space-y-2.5">
                <div className="flex items-start gap-2.5">
                  {isNetworkError ? (
                    <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-0.5">
                    <p className="text-white font-black text-xs">
                      {isNetworkError ? 'ملاحظة الاتصال بالخدمة' : 'تعذر تسجيل الدخول'}
                    </p>
                    <p className="font-normal text-rose-200 leading-snug text-[11px]">{errorMsg}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/30">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordLogin(true);
                      setErrorMsg('');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Lock className="w-3 h-3" />
                    <span>فتح الدخول بكلمة المرور</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOfflineLocalEnter}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <WifiOff className="w-3 h-3" />
                    <span>دخول محلي فوري</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tracked Live Access Request Status Card */}
            {activeTrackedRequest && (
              <div
                id="access-request-tracker-card"
                className={`p-3 rounded-2xl border space-y-2 text-xs ${
                  activeTrackedRequest.status === 'pending'
                    ? 'bg-amber-950/60 border-amber-400/60 text-amber-100'
                    : activeTrackedRequest.status === 'approved'
                    ? 'bg-emerald-950/70 border-emerald-400/60 text-emerald-100'
                    : activeTrackedRequest.status === 'restricted'
                    ? 'bg-amber-900/50 border-amber-400 text-amber-50'
                    : 'bg-rose-950/70 border-rose-500/60 text-rose-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    {activeTrackedRequest.status === 'pending' && (
                      <Clock className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
                    )}
                    {activeTrackedRequest.status === 'approved' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    {activeTrackedRequest.status === 'restricted' && (
                      <Lock className="w-4 h-4 text-amber-300 shrink-0" />
                    )}
                    {(activeTrackedRequest.status === 'rejected' ||
                      activeTrackedRequest.status === 'banned') && (
                      <Ban className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>
                      حالة طلب الدخول ({activeTrackedRequest.fullName}):
                    </span>
                  </div>

                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-950/60">
                    {activeTrackedRequest.status === 'pending'
                      ? 'بانتظار قرار الآدمن'
                      : activeTrackedRequest.status === 'approved'
                      ? 'تم القبول'
                      : activeTrackedRequest.status === 'restricted'
                      ? 'مقيد العمل'
                      : activeTrackedRequest.status === 'rejected'
                      ? 'مرفوض'
                      : 'محظور'}
                  </span>
                </div>

                {activeTrackedRequest.status === 'pending' && (
                  <p className="text-[11px] text-amber-200/90">
                    تم إرسال طلبك للمدير العام ({activeTrackedRequest.requestedRoleArabic}). سيظهر في لوحة المدير للقبول أو تحديد الصلاحيات.
                  </p>
                )}

                {(activeTrackedRequest.status === 'approved' ||
                  activeTrackedRequest.status === 'restricted') && (
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px]">
                      {activeTrackedRequest.status === 'restricted'
                        ? activeTrackedRequest.restrictionNote ||
                          'تمت الموافقة بوضع مقيد الصلاحيات.'
                        : 'وافق المدير العام على طلبك ويمكنك الدخول الآن.'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleEnterWithApprovedRequest(activeTrackedRequest)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shrink-0 cursor-pointer"
                    >
                      دخول بالصلاحيات المعتمدة
                    </button>
                  </div>
                )}

                {(activeTrackedRequest.status === 'rejected' ||
                  activeTrackedRequest.status === 'banned') && (
                  <p className="text-[11px] text-rose-200">
                    {activeTrackedRequest.decisionReason ||
                      activeTrackedRequest.restrictionNote ||
                      'تم رفض أو حظر هذا الطلب من قبل المدير العام.'}
                  </p>
                )}
              </div>
            )}

            {/* Google Role Selector */}
            <div className="p-3 sm:p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">حدد هويتك وصفة الدخول</h3>
                    <p className="text-[10px] text-slate-400">
                      تخضع حسابات الموظفين الجدد لموافقة وصلاحيات المدير العام
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-amber-300 text-[10px] font-black">
                  دخول محمي
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGoogleRolePreference('salesperson')}
                  className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    googleRolePreference === 'salesperson'
                      ? 'bg-sky-950/80 border-sky-400 text-white shadow-md ring-1 ring-sky-400/50'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-sky-300">
                    <ShoppingCart className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span>بائع المتجر (كاشير)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    فواتير البيع الفورية F2 وخدمة الزبائن
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGoogleRolePreference('admin')}
                  className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer ${
                    googleRolePreference === 'admin'
                      ? 'bg-amber-950/80 border-amber-400 text-white shadow-md ring-1 ring-amber-400/50'
                      : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>المدير العام (المالك)</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                    إدارة شاملة للمتجر والأرباح والمستخدمين
                  </p>
                </button>
              </div>

              {googleRolePreference === 'salesperson' && (
                <div className="space-y-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800/80">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px]">
                    <div className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1 text-slate-300">
                      <Zap className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>بيع فوري F2</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1 text-slate-300">
                      <Boxes className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>المخزون والأسعار</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1 text-slate-300">
                      <User className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>ديون الزبائن</span>
                    </div>
                    <div className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-1 text-slate-300">
                      <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                      <span>مراقب من الإدارة</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] text-sky-200 font-semibold">
                      اسم البائع أو المعرف (للتحقق من الصلاحيات والحظر):
                    </label>
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="done"
                      autoComplete="name"
                      value={googleSellerCustomName}
                      onChange={(e) => setGoogleSellerCustomName(e.target.value)}
                      placeholder="مثال: سامر كاشير / samer..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* GOOGLE SIGN-IN CTA */}
            <div>
              <button
                type="button"
                disabled={isGoogleLoading}
                onClick={() =>
                  handleGoogleSignIn(googleRolePreference, googleSellerCustomName || undefined)
                }
                className={`w-full relative group overflow-hidden rounded-2xl p-0.5 shadow-xl transition-all duration-300 active:scale-[0.99] cursor-pointer disabled:opacity-60 ${
                  googleRolePreference === 'salesperson'
                    ? 'bg-gradient-to-r from-sky-400 via-cyan-300 to-blue-500 shadow-[0_10px_30px_-5px_rgba(14,165,233,0.45)]'
                    : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 shadow-[0_10px_30px_-5px_rgba(245,158,11,0.45)]'
                }`}
              >
                <div
                  className={`relative py-2.5 px-4 sm:px-5 rounded-2xl flex items-center justify-between font-black ${
                    googleRolePreference === 'salesperson'
                      ? 'bg-gradient-to-r from-sky-600 via-sky-500 to-cyan-600 text-white'
                      : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 text-slate-950'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center p-2 shrink-0">
                      <svg className="w-full h-full" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>

                    <div className="text-right">
                      <div className="text-sm sm:text-base font-black tracking-wide flex items-center gap-1.5">
                        <span>
                          {isGoogleLoading
                            ? 'جاري التحقق عبر جهاز الأندرويد...'
                            : isAndroidApk
                            ? googleRolePreference === 'salesperson'
                              ? 'تسجيل عبر جهاز الأندرويد - Google (بائع / موظف)'
                              : 'تسجيل عبر جهاز الأندرويد - Google (المدير العام)'
                            : googleRolePreference === 'salesperson'
                            ? 'تسجيل الدخول عبر Google (بائع / موظف)'
                            : 'تسجيل الدخول بحساب Google (المدير العام)'}
                        </span>
                        <Sparkles className="w-4 h-4 shrink-0" />
                      </div>
                      <div className="text-[11px] font-semibold opacity-90">
                        {isAndroidApk
                          ? 'اختيار حساب Google من جهاز الأندرويد مباشرة — بدون فتح أي متصفح'
                          : googleRolePreference === 'salesperson'
                          ? 'تلقائياً يتحقق من موافقة وصلاحيات المدير العام'
                          : 'الدخول الآمن لحساب مالك المتجر المعتمد'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-950 text-white shadow-md shrink-0">
                    <ArrowRight className="w-4 h-4 rotate-180" />
                  </div>
                </div>
              </button>
            </div>

            {/* Direct Access Request Submission Box (For new staff requiring Admin decision) */}
            <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>موظف جديد؟ أرسل طلب تسجيل دخول لموافقة الآدمن</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRequestForm((p) => !p)}
                  className="px-3 py-1 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold cursor-pointer"
                >
                  {showRequestForm ? 'إغلاق النموذج' : 'إرسال طلب دخول'}
                </button>
              </div>

              {showRequestForm && (
                <form onSubmit={handleSubmitDirectRequest} className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="next"
                      autoComplete="name"
                      required
                      placeholder="الاسم الكامل للموظف *"
                      value={reqFullName}
                      onChange={(e) => setReqFullName(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500"
                    />
                    <input
                      type="text"
                      inputMode="email"
                      enterKeyHint="next"
                      autoCapitalize="none"
                      autoCorrect="off"
                      required
                      placeholder="البريد الإلكتروني أو اسم المستخدم *"
                      value={reqEmail}
                      onChange={(e) => setReqEmail(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={reqRole}
                      onChange={(e) =>
                        setReqRole(
                          e.target.value as 'salesperson' | 'accountant' | 'warehouse'
                        )
                      }
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                    >
                      <option value="salesperson">كاشير وبائع</option>
                      <option value="accountant">محاسب المتجر</option>
                      <option value="warehouse">أمين المستودع</option>
                    </select>
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="done"
                      placeholder="ملاحظة أو سبب الطلب (اختياري)..."
                      value={reqReason}
                      onChange={(e) => setReqReason(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer"
                  >
                    إرسال طلب تسجيل الدخول للمدير العام
                  </button>
                </form>
              )}
            </div>

            {/* Storage & Camera Security Permissions Prompt */}
            <SecurityPermissionsBanner
              variant="compact"
              enabled={settings.enableSecurityCameraCapture ?? true}
            />

            {/* Username & Password Login Box (captures camera snapshot on password submit) */}
            <div className="p-3 rounded-2xl bg-slate-950/75 border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-sky-400" />
                  <span>الدخول باسم المستخدم وكلمة المرور</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleAndroidKeyboardDrawer()}
                    className="px-2.5 py-1 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>لوحة مفاتيح أندرويد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextOpen = !showPasswordLogin;
                      setShowPasswordLogin(nextOpen);
                      if (nextOpen && (settings.enableSecurityCameraCapture ?? true)) {
                        void (async () => {
                          const { checkDevicePermissionsStatus, requestStorageAndCameraPermissions } =
                            await import('../utils/securityCapture');
                          const current = await checkDevicePermissionsStatus();
                          if (current.camera === 'prompt' || current.storage === 'prompt') {
                            await requestStorageAndCameraPermissions();
                          }
                        })();
                      }
                    }}
                    className="px-3 py-1 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-[11px] font-bold cursor-pointer"
                  >
                    {showPasswordLogin ? 'إغلاق' : 'دخول بكلمة سر'}
                  </button>
                </div>
              </div>

              {showPasswordLogin && (
                <form
                  onSubmit={handlePasswordLoginSubmit}
                  className="space-y-2 pt-2 border-t border-slate-800 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="text"
                      enterKeyHint="next"
                      autoCapitalize="none"
                      autoCorrect="off"
                      autoComplete="username"
                      required
                      placeholder="اسم المستخدم (مثال: admin / seller)"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono"
                    />
                    <div className="relative">
                      <input
                        type={showLoginPassword ? 'text' : 'password'}
                        inputMode="text"
                        enterKeyHint="go"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="current-password"
                        required
                        placeholder="كلمة المرور أو PIN..."
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3 py-2 pl-8 bg-slate-900 border border-slate-700 rounded-xl text-white placeholder-slate-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword((p) => !p)}
                        aria-label="إظهار أو إخفاء كلمة المرور"
                        className="absolute left-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showLoginPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {passwordSecurityFeedback && (
                    <div className="text-[11px] text-amber-300 font-bold">
                      {passwordSecurityFeedback}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPasswordChecking}
                    className="w-full py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-black cursor-pointer disabled:opacity-60"
                  >
                    {isPasswordChecking
                      ? 'جاري التحقق والتوثيق الأمني...'
                      : 'تحقق ودخول بكلمة المرور'}
                  </button>
                </form>
              )}
            </div>

            {/* OFFLINE LOCAL DATABASE ENTRY */}
            <div
              className={`p-3 rounded-2xl border transition-all ${
                !isOnline || isNetworkError
                  ? 'bg-amber-950/60 border-amber-400/70 shadow-lg shadow-amber-500/10'
                  : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 mt-0.5">
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <div className="text-right space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>العمل بلا إنترنت (قاعدة البيانات المحلية)</span>
                      {!isOnline && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black">
                          موصى به الآن
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 leading-snug">
                      احفظ المبيعات والفواتير والمخزون محلياً في IndexedDB وستتم المزامنة تلقائياً فور توفر الإنترنت.
                      {pendingOfflineCount > 0 && (
                        <span className="text-amber-300 font-bold block mt-0.5">
                          ({pendingOfflineCount} عملية محفوظة محلياً بانتظار المزامنة)
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOfflineLocalEnter}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap flex items-center justify-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                    !isOnline || isNetworkError
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>دخول محلي بلا إنترنت</span>
                </button>
              </div>
            </div>

            {/* Bottom Guarantee */}
            <div className="pt-2.5 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] text-slate-400">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>قاعدة IndexedDB محلية</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>مزامنة سحابية تلقائية</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>موافقة وحظر من الآدمن</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                <span>تشغيل كامل بلا إنترنت</span>
              </div>
            </div>
          </div>

          <div className="py-2 bg-slate-950/90 border-t border-slate-800/80 text-center text-[10px] text-slate-400 flex items-center justify-between px-5">
            <span>{settings.storeName || 'متجر خردوات المامو'} © {new Date().getFullYear()}</span>
            <span className="text-amber-400/90 font-medium">بإدارة أحمد المامو (أحمد نوار المامو)</span>
          </div>
        </div>
      </main>

      <footer className="relative z-20 text-center py-1.5 text-[10px] text-slate-400 pointer-events-none">
        منظومة إدارة الخردوات والعدد الصناعية المتطورة — عمل كامل بلا إنترنت مع المزامنة التلقائية
      </footer>
    </div>
  );
};
