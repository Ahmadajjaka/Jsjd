/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  Firestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  getDocs,
  collection,
  onSnapshot,
  writeBatch,
  getDocFromServer,
  query,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';

import firebaseConfig from '../../firebase-applet-config.json';
import {
  AppState,
  getInitialState,
} from '../utils/storage';
import {
  AppUser,
  AuditLog,
  CashTransaction,
  Customer,
  CustomerPayment,
  Expense,
  InventoryAdjustment,
  LoginAccessRequest,
  LoginAttempt,
  Product,
  PurchaseInvoice,
  SaleInvoice,
  StoreSettings,
  Supplier,
  SupplierPayment,
  UserAccessStatus,
  UserRole,
} from '../types/accounting';
import { ROLE_PRESET_PERMISSIONS } from '../utils/permissions';
import { getCurrentTimeString, getTodayDateString } from '../utils/accounting';
import {
  compressToBytes,
  decompressFromBytes,
  packDocumentForFirestore,
  unpackDocumentFromFirestore,
} from '../utils/compression';
import {
  mergeRemoteCollectionWithPending,
  mergeRemoteSettingsWithPending,
} from './syncLogic';
import { getOutboxSync, saveCachedSession } from './localDatabase';
import {
  isAndroidWebViewShell,
  isCapacitorNativeShell,
  isStandalonePwaShell,
} from '../utils/apkEnvironment';
import {
  classifyNativeGoogleError,
  isNativeGoogleAuthAvailable,
  resolveGoogleSignInStrategy,
  signInWithNativeGoogle,
  signOutNativeGoogle,
} from '../utils/nativeGoogleAuth';

const PENDING_OAUTH_ROLE_KEY = 'almamo_pending_oauth_context';

// Primary Admin Google Email
export const SUPER_ADMIN_EMAIL = 'mohammedmamo2003@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// 1. Initialize Firebase App
export const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Initialize Firestore with persistent IndexedDB local cache for multi-tab offline operation
const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';
let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firestoreDatabaseId
  );
} catch {
  firestoreInstance = getFirestore(app, firestoreDatabaseId);
}
export const db: Firestore = firestoreInstance;

// 3. Initialize Firebase Auth with durable IndexedDB persistence for APK & offline cold starts
export const auth: Auth = getAuth(app);
setPersistence(auth, indexedDBLocalPersistence).catch(() => {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
});
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Validate connection to Firestore as mandated by the Firebase skill
 */
export async function validateFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error: any) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (
      errorMsg.includes('the client is offline') ||
      errorMsg.includes('Could not reach Cloud Firestore backend') ||
      errorMsg.includes("didn't respond within 10 seconds") ||
      errorMsg.includes('Fetching auth token failed') ||
      errorMsg.includes('token-service') ||
      errorMsg.includes('network') ||
      errorMsg.includes('timeout')
    ) {
      console.warn('Firebase client operating in resilient offline/local mode:', errorMsg);
      return false;
    }
    // Any other response (including permission-denied or not-found) confirms backend server reachability
    return true;
  }
}

/**
 * Extracts human-readable device and browser info for security audit logs
 */
export function getDeviceInfo(): { userAgent: string; deviceLabel: string; platform: string } {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  let os = 'كمبيوتر';
  if (/windows/i.test(ua)) os = 'كمبيوتر (Windows)';
  else if (/macintosh|mac os x/i.test(ua)) os = 'كمبيوتر (Mac)';
  else if (/android/i.test(ua)) os = 'هاتف (Android)';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'جهاز محمول (iOS)';
  else if (/linux/i.test(ua)) os = 'نظام لينكس (Linux)';

  let browser = 'متصفح ويب';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return {
    userAgent: ua.slice(0, 250),
    deviceLabel: `${os} · ${browser}`,
    platform: typeof navigator !== 'undefined' ? navigator.platform || 'web' : 'web',
  };
}

/**
 * Record a login attempt into Firestore in real-time so the Admin can monitor all attempts
 */
export async function recordLoginAttempt(data: {
  id?: string;
  status: 'success' | 'failed' | 'cancelled' | 'blocked';
  statusArabic: string;
  email?: string;
  userName?: string;
  attemptedRole: 'admin' | 'salesperson' | 'unknown';
  actualRole?: UserRole;
  errorMessage?: string;
  details?: string;
  snapshotId?: string;
  snapshotStatus?: 'captured' | 'denied' | 'no_camera' | 'disabled' | 'error';
  entryMethod?: 'lock_screen' | 'password_login' | 'pin_confirm' | 'google_auth';
}): Promise<LoginAttempt> {
  const timestamp = Date.now();
  const date = getTodayDateString();
  const time = getCurrentTimeString();
  const id = data.id || `att-${timestamp}-${Math.floor(Math.random() * 1000)}`;
  const dev = getDeviceInfo();

  const attempt: LoginAttempt = {
    id,
    date,
    time,
    timestamp,
    email: data.email || 'غير محدد / مجهول',
    userName: data.userName || (data.email ? data.email.split('@')[0] : 'زائر المتجر'),
    attemptedRole: data.attemptedRole,
    actualRole: data.actualRole,
    status: data.status,
    statusArabic: data.statusArabic,
    deviceInfo: dev.deviceLabel,
    userAgent: dev.userAgent,
    errorMessage: data.errorMessage,
    snapshotId: data.snapshotId,
    snapshotStatus: data.snapshotStatus,
    entryMethod: data.entryMethod,
    details:
      data.details ||
      `محاولة تسجيل دخول ${data.statusArabic} بصفة ${
        data.attemptedRole === 'admin' ? 'المدير العام' : 'بائع المتجر'
      }`,
  };

  try {
    const packed = packDocumentForFirestore(id, attempt);
    await setDoc(doc(db, 'login_attempts', id), packed);
  } catch (err) {
    console.warn('Login attempt Firestore record note:', err);
  }

  // Also log into audit_logs collection for centralized security trail
  try {
    const auditId = `log-sec-${timestamp}`;
    const auditRecord: AuditLog = {
      id: auditId,
      date,
      time,
      action: data.status === 'success' ? 'تسجيل دخول ناجح' : `محاولة دخول (${data.statusArabic})`,
      entityType: 'security',
      entityId: id,
      details: `${attempt.details} [${attempt.userName} - ${attempt.email}] عبر جهاز ${attempt.deviceInfo}`,
      userId: attempt.email,
      userName: attempt.userName,
    };
    const packedAudit = packDocumentForFirestore(auditId, auditRecord);
    await setDoc(doc(db, 'audit_logs', auditId), packedAudit).catch(() => {});
  } catch {}

  return attempt;
}

/**
 * Clear all login attempts from Firestore (admin only tool)
 */
export async function clearAllLoginAttemptsFromFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, 'login_attempts'));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Error clearing login attempts:', e);
  }
}

/**
 * Direct Secure Login for Super Admin via Master PIN
 * Useful when network or iframe blocks Google Auth popup
 */
export function createStoreOwnerUser(): AppUser {
  const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
  return {
    id: 'owner-ahmad-mamo',
    username: 'ahmad_mamo',
    password: '',
    fullName: 'أحمد نوار المامو (المدير العام والمالك)',
    role: 'admin',
    roleNameArabic: 'المدير العام (مالك النظام)',
    permissions: ROLE_PRESET_PERMISSIONS.admin,
    isActive: true,
    avatarColor: 'bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 font-black',
    createdAt: getTodayDateString(),
    lastLogin: nowStr,
  };
}

export function createSellerUser(sellerName = 'بائع المتجر (كاشير ومبيعات)'): AppUser {
  const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
  return {
    id: 'seller-pos-user',
    username: 'salesperson',
    password: '',
    fullName: sellerName,
    role: 'salesperson',
    roleNameArabic: 'بائع وكاشير',
    permissions: ROLE_PRESET_PERMISSIONS.salesperson,
    isActive: true,
    avatarColor: 'bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-bold',
    createdAt: getTodayDateString(),
    lastLogin: nowStr,
  };
}

export function loginAsAdminWithMasterPin(
  enteredPin: string,
  configuredPin: string = '1234'
): AppUser {
  const cleanEntered = enteredPin.trim();
  const targetPin = (configuredPin || '1234').trim();

  if (!cleanEntered || cleanEntered !== targetPin) {
    throw new Error('رمز أمان المالك غير صحيح. يرجى إدخال الرمز المعتمد لمتجر خردوات المامو.');
  }

  return createStoreOwnerUser();
}

/**
 * Sign in with Google Popup - Allows Manager or Seller to authenticate and identify themselves
 */
export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase();
}

/**
 * Submit a LoginAccessRequest document directly to Firestore (uncompressed so rules validate fields)
 */
export async function submitLoginAccessRequestToFirestore(req: LoginAccessRequest): Promise<void> {
  const path = `access_requests/${req.id}`;
  try {
    await setDoc(doc(db, 'access_requests', req.id), req, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Update a LoginAccessRequest moderation decision in Firestore
 */
export async function updateAccessRequestInFirestore(req: LoginAccessRequest): Promise<void> {
  const path = `access_requests/${req.id}`;
  try {
    await setDoc(doc(db, 'access_requests', req.id), req, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

/**
 * Subscribe to a single access request document while applicant waits on LoginScreen
 */
export function subscribeToSingleAccessRequest(
  requestId: string,
  onUpdate: (req: LoginAccessRequest | null) => void
): Unsubscribe {
  const path = `access_requests/${requestId}`;
  return onSnapshot(
    doc(db, 'access_requests', requestId),
    (snap) => {
      if (snap.exists()) {
        onUpdate(unpackDocumentFromFirestore<LoginAccessRequest>(snap.data()));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

/**
 * Sign in with Google Popup - Allows Manager or Seller/Staff to authenticate.
 * Enforces Admin moderation (approved / pending / rejected / banned / restricted).
 */
export async function signInWithGoogleAccount(
  rolePreference: 'admin' | 'salesperson' = 'salesperson',
  customSellerName?: string,
  requestedStaffRole: 'salesperson' | 'accountant' | 'warehouse' | 'custom' = 'salesperson',
  requestNote?: string
): Promise<{
  firebaseUser: FirebaseUser;
  appUser: AppUser;
  isSuperAdmin: boolean;
  pendingRequest?: LoginAccessRequest;
}> {
  const strategy = resolveGoogleSignInStrategy({
    isAndroidApk: isCapacitorNativeShell(),
    isNativePluginAvailable: isNativeGoogleAuthAvailable(),
  });

  let result: { user: FirebaseUser } | null = null;

  // 1. Native Android Device Sign-In ONLY inside Android APK (never opens external or WebView browser)
  if (strategy.mode === 'native-android-only') {
    try {
      const nativeRes = await signInWithNativeGoogle(firebaseConfig.oAuthClientId);
      const credential = GoogleAuthProvider.credential(nativeRes.idToken);
      result = await signInWithCredential(auth, credential);
    } catch (nativeErr: any) {
      const classified = classifyNativeGoogleError(nativeErr);
      if (classified.kind === 'cancelled') {
        throw Object.assign(new Error('تم إلغاء تسجيل الدخول بحساب Google على جهاز الأندرويد.'), {
          code: 'auth/popup-closed-by-user',
        });
      }
      if (classified.kind === 'network') {
        throw Object.assign(new Error('Network error during Google Sign-In'), {
          code: 'auth/network-request-failed',
        });
      }
      throw nativeErr;
    }
  } else {
    // 2. Standard Web Browser OAuth Popup (+ PWA Redirect Fallback)
    try {
      result = await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = String(err?.code || '');
      if (code === 'auth/network-request-failed') {
        console.warn('Network request failed on first attempt, retrying once...');
        await new Promise((r) => setTimeout(r, 600));
        result = await signInWithPopup(auth, googleProvider);
      } else if (
        code === 'auth/popup-blocked' ||
        code === 'auth/operation-not-supported-in-this-environment' ||
        (isStandalonePwaShell() &&
          !isAndroidWebViewShell() &&
          code !== 'auth/popup-closed-by-user' &&
          code !== 'auth/cancelled-popup-request' &&
          code !== 'auth/unauthorized-domain')
      ) {
        try {
          sessionStorage.setItem(
            PENDING_OAUTH_ROLE_KEY,
            JSON.stringify({
              rolePreference,
              customSellerName,
              requestedStaffRole,
              requestNote,
            })
          );
        } catch {}
        await signInWithRedirect(auth, googleProvider);
        throw Object.assign(new Error('REDIRECT_STARTED'), { code: 'auth/redirect-started' });
      } else {
        throw err;
      }
    }
  }

  return resolveAuthenticatedFirebaseUser(
    result.user,
    rolePreference,
    customSellerName,
    requestedStaffRole,
    requestNote
  );
}

/**
 * Completes a pending Google OAuth redirect sign-in (triggered inside APK/PWA fallback)
 */
export async function processPendingGoogleRedirectSignIn(): Promise<{
  firebaseUser: FirebaseUser;
  appUser: AppUser;
  isSuperAdmin: boolean;
  pendingRequest?: LoginAccessRequest;
} | null> {
  const res = await getRedirectResult(auth);
  if (!res || !res.user) return null;
  let ctx: any = {};
  try {
    const raw = sessionStorage.getItem(PENDING_OAUTH_ROLE_KEY);
    if (raw) ctx = JSON.parse(raw);
    sessionStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
  } catch {}
  return await resolveAuthenticatedFirebaseUser(
    res.user,
    ctx.rolePreference || 'salesperson',
    ctx.customSellerName,
    ctx.requestedStaffRole || 'salesperson',
    ctx.requestNote
  );
}

async function resolveAuthenticatedFirebaseUser(
  fbUser: FirebaseUser,
  rolePreference: 'admin' | 'salesperson' = 'salesperson',
  customSellerName?: string,
  requestedStaffRole: 'salesperson' | 'accountant' | 'warehouse' | 'custom' = 'salesperson',
  requestNote?: string
): Promise<{
  firebaseUser: FirebaseUser;
  appUser: AppUser;
  isSuperAdmin: boolean;
  pendingRequest?: LoginAccessRequest;
}> {
  const email = (fbUser.email || '').toLowerCase().trim();
  const isSuperAdmin = isSuperAdminEmail(email);
  const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
  const defaultDisplayName = fbUser.displayName || email.split('@')[0] || 'بائع المتجر';
  const fullName = customSellerName?.trim() || defaultDisplayName;

  // Super Admin always signs in directly with full authority
  if (isSuperAdmin) {
    const role: UserRole = rolePreference === 'admin' ? 'admin' : 'salesperson';
    try {
      localStorage.setItem(`user_role_${fbUser.uid}`, role);
      localStorage.setItem(`user_name_${fbUser.uid}`, fullName);
    } catch {}

    const adminAppUser: AppUser = {
      id: fbUser.uid,
      username: email.split('@')[0] || 'ahmad_mamo',
      password: '',
      email: fbUser.email || SUPER_ADMIN_EMAIL,
      fullName: role === 'admin' ? (fbUser.displayName || 'أحمد نوار المامو (المدير العام والمالك)') : fullName,
      role,
      roleNameArabic: role === 'admin' ? 'المدير العام (مالك النظام)' : 'بائع وكاشير',
      permissions: ROLE_PRESET_PERMISSIONS[role] || ROLE_PRESET_PERMISSIONS.admin,
      isActive: true,
      accessStatus: 'approved',
      avatarColor: 'bg-amber-500 text-slate-950 font-black',
      createdAt: getTodayDateString(),
      lastLogin: nowStr,
    };

    try {
      await setDoc(doc(db, 'users', fbUser.uid), adminAppUser, { merge: true });
      if (role === 'admin') {
        await setDoc(
          doc(db, 'admins', fbUser.uid),
          {
            email: fbUser.email,
            displayName: adminAppUser.fullName,
            createdAt: nowStr,
            isSuperAdmin: true,
          },
          { merge: true }
        );
      }
    } catch (e) {
      console.warn('Admin profile sync note:', e);
    }

    await recordLoginAttempt({
      status: 'success',
      statusArabic: 'ناجحة',
      email: fbUser.email || undefined,
      userName: adminAppUser.fullName,
      attemptedRole: rolePreference,
      actualRole: role,
      details: `تم تسجيل الدخول بنجاح بحساب المدير العام المعتمد (${fbUser.email}).`,
    }).catch(() => {});

    return { firebaseUser: fbUser, appUser: adminAppUser, isSuperAdmin: true };
  }

  // Non-admin user: check /users/{uid} and /access_requests in Firestore for Admin decision
  let existingUserDoc: AppUser | null = null;
  try {
    const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
    if (userSnap.exists()) {
      existingUserDoc = unpackDocumentFromFirestore<AppUser>(userSnap.data());
    }
  } catch (e) {
    console.warn('User profile lookup note:', e);
  }

  if (existingUserDoc) {
    const status: UserAccessStatus = existingUserDoc.accessStatus || (existingUserDoc.isActive ? 'approved' : 'banned');
    if (status === 'banned' || (!existingUserDoc.isActive && status !== 'pending' && status !== 'restricted')) {
      await recordLoginAttempt({
        status: 'blocked',
        statusArabic: 'محظور من الإدارة',
        email: fbUser.email || undefined,
        userName: existingUserDoc.fullName,
        attemptedRole: rolePreference,
        errorMessage: 'حساب محظور من المدير العام',
        details: `تم منع دخول الحساب المحظور (${fbUser.email}).`,
      }).catch(() => {});
      await signOut(auth).catch(() => {});
      throw new Error(
        existingUserDoc.restrictionNote ||
          'تم حظر حسابك من قبل المدير العام. لا يمكنك الدخول للنظام.'
      );
    }

    if (status === 'rejected') {
      await recordLoginAttempt({
        status: 'blocked',
        statusArabic: 'طلب مرفوض',
        email: fbUser.email || undefined,
        userName: existingUserDoc.fullName,
        attemptedRole: rolePreference,
        errorMessage: 'حساب مرفوض من المدير العام',
        details: `تم رفض دخول الحساب (${fbUser.email}).`,
      }).catch(() => {});
      await signOut(auth).catch(() => {});
      throw new Error(
        existingUserDoc.restrictionNote ||
          'تم رفض طلب دخولك من قبل المدير العام.'
      );
    }

    if (status === 'approved' || status === 'restricted') {
      const mergedUser: AppUser = {
        ...existingUserDoc,
        email: fbUser.email || existingUserDoc.email,
        lastLogin: nowStr,
      };
      try {
        await setDoc(
          doc(db, 'users', fbUser.uid),
          { lastLogin: nowStr, email: mergedUser.email },
          { merge: true }
        );
      } catch {}

      try {
        localStorage.setItem(`user_role_${fbUser.uid}`, mergedUser.role);
        localStorage.setItem(`user_name_${fbUser.uid}`, mergedUser.fullName);
      } catch {}

      await recordLoginAttempt({
        status: 'success',
        statusArabic: status === 'restricted' ? 'دخول مقيد الصلاحيات' : 'ناجحة',
        email: fbUser.email || undefined,
        userName: mergedUser.fullName,
        attemptedRole: rolePreference,
        actualRole: mergedUser.role,
        details: `تم تسجيل الدخول (${fbUser.email}) بحالة (${status === 'restricted' ? 'مقيد العمل' : 'معتمد'}).`,
      }).catch(() => {});

      return { firebaseUser: fbUser, appUser: mergedUser, isSuperAdmin: false };
    }
  }

  // Check existing access_requests for this Firebase UID
  let latestReq: LoginAccessRequest | null = null;
  try {
    const q = query(collection(db, 'access_requests'), where('uid', '==', fbUser.uid));
    const reqSnap = await getDocs(q);
    if (!reqSnap.empty) {
      const reqs = reqSnap.docs
        .map((d) => unpackDocumentFromFirestore<LoginAccessRequest>(d.data()))
        .sort((a, b) => b.timestamp - a.timestamp);
      latestReq = reqs[0] || null;
    }
  } catch (e) {
    console.warn('Access request query note:', e);
  }

  if (latestReq) {
    if (latestReq.status === 'banned') {
      await signOut(auth).catch(() => {});
      throw new Error(
        latestReq.decisionReason ||
          'تم حظر حسابك من قبل المدير العام. لا يمكنك الدخول للنظام.'
      );
    }
    if (latestReq.status === 'rejected') {
      await signOut(auth).catch(() => {});
      throw new Error(
        latestReq.decisionReason ||
          'تم رفض طلب تسجيل الدخول الخاص بك من قبل المدير العام.'
      );
    }
    if (latestReq.status === 'approved' || latestReq.status === 'restricted') {
      const assignedRole: UserRole = latestReq.assignedRole || latestReq.requestedRole || 'salesperson';
      const approvedUser: AppUser = {
        id: fbUser.uid,
        username: email.split('@')[0] || 'staff',
        password: '',
        email: fbUser.email || email,
        fullName: latestReq.fullName || fullName,
        role: assignedRole,
        roleNameArabic:
          latestReq.status === 'restricted'
            ? 'مستخدم مقيد الصلاحيات'
            : assignedRole === 'accountant'
            ? 'محاسب المتجر'
            : assignedRole === 'warehouse'
            ? 'أمين المستودع'
            : 'بائع وكاشير',
        permissions:
          latestReq.assignedPermissions && latestReq.assignedPermissions.length > 0
            ? latestReq.assignedPermissions
            : ROLE_PRESET_PERMISSIONS[assignedRole] || ROLE_PRESET_PERMISSIONS.salesperson,
        isActive: true,
        accessStatus: latestReq.status,
        restrictionNote: latestReq.restrictionNote,
        isReadOnly: latestReq.isReadOnly,
        avatarColor:
          latestReq.status === 'restricted'
            ? 'bg-amber-600 text-white font-bold'
            : 'bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-bold',
        createdAt: getTodayDateString(),
        lastLogin: nowStr,
      };
      try {
        await setDoc(doc(db, 'users', fbUser.uid), approvedUser, { merge: true });
      } catch {}
      return { firebaseUser: fbUser, appUser: approvedUser, isSuperAdmin: false };
    }
    // Still pending!
    const pendingPlaceholder: AppUser = {
      id: fbUser.uid,
      username: email.split('@')[0] || 'applicant',
      password: '',
      email: fbUser.email || email,
      fullName: latestReq.fullName || fullName,
      role: requestedStaffRole,
      roleNameArabic: 'طلب دخول قيد المراجعة',
      permissions: [],
      isActive: false,
      accessStatus: 'pending',
      createdAt: getTodayDateString(),
      lastLogin: nowStr,
    };
    return {
      firebaseUser: fbUser,
      appUser: pendingPlaceholder,
      isSuperAdmin: false,
      pendingRequest: latestReq,
    };
  }

  // Brand-new non-admin user -> submit a pending LoginAccessRequest for Admin approval
  const dev = getDeviceInfo();
  const roleArabicMap: Record<string, string> = {
    salesperson: 'كاشير وبائع',
    accountant: 'محاسب المتجر',
    warehouse: 'أمين المستودع',
    custom: 'مستخدم بصلاحيات مخصصة',
  };
  const newReqId = `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newRequest: LoginAccessRequest = {
    id: newReqId,
    uid: fbUser.uid,
    email: fbUser.email || email,
    fullName,
    username: email.split('@')[0] || 'user',
    requestedRole: requestedStaffRole,
    requestedRoleArabic: roleArabicMap[requestedStaffRole] || 'كاشير وبائع',
    reason: requestNote?.trim() || 'طلب تسجيل دخول عبر حساب Google للعمل على نظام المتجر',
    status: 'pending',
    deviceInfo: dev.deviceLabel,
    date: getTodayDateString(),
    time: getCurrentTimeString(),
    timestamp: Date.now(),
  };

  await submitLoginAccessRequestToFirestore(newRequest);

  await recordLoginAttempt({
    status: 'blocked',
    statusArabic: 'طلب دخول بانتظار الآدمن',
    email: fbUser.email || undefined,
    userName: fullName,
    attemptedRole: rolePreference,
    details: `تم إرسال طلب تسجيل دخول جديد من (${fullName} - ${fbUser.email}) بانتظار قرار الآدمن.`,
  }).catch(() => {});

  const pendingUser: AppUser = {
    id: fbUser.uid,
    username: newRequest.username || 'applicant',
    password: '',
    email: newRequest.email,
    fullName,
    role: requestedStaffRole,
    roleNameArabic: 'بانتظار موافقة الآدمن',
    permissions: [],
    isActive: false,
    accessStatus: 'pending',
    createdAt: getTodayDateString(),
    lastLogin: nowStr,
  };

  return {
    firebaseUser: fbUser,
    appUser: pendingUser,
    isSuperAdmin: false,
    pendingRequest: newRequest,
  };
}

/**
 * Checks whether an active, authenticated Firebase Auth session is present
 */
export function isFirebaseAuthActive(): boolean {
  return !!auth.currentUser;
}

/**
 * Listen to Firebase Auth state with automatic authorization & moderation verification
 */
export function onAuthUserChanged(
  callback: (user: AppUser | null, isAuthorized: boolean) => void
): Unsubscribe {
  return onAuthStateChanged(auth, async (fbUser) => {
    if (fbUser) {
      const isCurrentlyOnline =
        typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isCurrentlyOnline) {
        try {
          await fbUser.getIdToken();
        } catch (tokenErr: any) {
          const code = String(tokenErr?.code || '').toLowerCase();
          const msg = String(tokenErr?.message || '').toLowerCase();
          const isNetworkIssue =
            !navigator.onLine ||
            code.includes('network') ||
            msg.includes('network') ||
            msg.includes('offline') ||
            msg.includes('fetch') ||
            msg.includes('timeout');

          if (!isNetworkIssue) {
            console.warn('Firebase auth token revoked/invalid, signing out stale session:', tokenErr?.message);
            await signOut(auth).catch(() => {});
            await saveCachedSession(null, 'google').catch(() => {});
            callback(null, false);
            return;
          }
          console.warn('Offline/network note during token check, keeping local cached session:', tokenErr?.message);
        }
      }

      const email = (fbUser.email || '').toLowerCase().trim();
      const isSuperAdmin = isSuperAdminEmail(email);

      if (!isSuperAdmin && isCurrentlyOnline) {
        try {
          const userSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (userSnap.exists()) {
            const remoteUser = unpackDocumentFromFirestore<AppUser>(userSnap.data());
            const status = remoteUser.accessStatus || (remoteUser.isActive ? 'approved' : 'banned');
            if (!remoteUser.isActive || status === 'banned' || status === 'rejected' || status === 'pending') {
              await saveCachedSession(null, 'google').catch(() => {});
              callback(null, false);
              return;
            }
            await saveCachedSession(remoteUser, 'google').catch(() => {});
            callback(remoteUser, true);
            return;
          } else {
            // Check if their access request was approved or restricted
            const q = query(collection(db, 'access_requests'), where('uid', '==', fbUser.uid));
            const reqSnap = await getDocs(q);
            const latestReq = reqSnap.docs
              .map((d) => unpackDocumentFromFirestore<LoginAccessRequest>(d.data()))
              .sort((a, b) => b.timestamp - a.timestamp)[0];

            if (!latestReq || (latestReq.status !== 'approved' && latestReq.status !== 'restricted')) {
              callback(null, false);
              return;
            }
          }
        } catch (e) {
          console.warn('Auth moderation lookup fallback to local cache:', e);
        }
      }

      const savedRole = (typeof localStorage !== 'undefined' ? localStorage.getItem(`user_role_${fbUser.uid}`) : null) as UserRole | null;
      const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem(`user_name_${fbUser.uid}`) : null;

      const role: UserRole = savedRole || (isSuperAdmin ? 'admin' : 'salesperson');
      const fullName =
        savedName ||
        fbUser.displayName ||
        (role === 'admin' ? 'أحمد نوار المامو (المدير العام والمالك)' : 'بائع المتجر (كاشير ومبيعات)');

      const nowStr = `${getTodayDateString()} ${getCurrentTimeString()}`;
      const appUser: AppUser = {
        id: fbUser.uid,
        username: email.split('@')[0] || 'seller',
        password: '',
        email: fbUser.email || email,
        fullName,
        role,
        roleNameArabic: role === 'admin' ? 'المدير العام (مالك النظام)' : 'بائع وكاشير',
        permissions: ROLE_PRESET_PERMISSIONS[role] || ROLE_PRESET_PERMISSIONS.salesperson,
        isActive: true,
        accessStatus: 'approved',
        avatarColor:
          role === 'admin'
            ? 'bg-amber-500 text-slate-950 font-black'
            : 'bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-bold',
        createdAt: getTodayDateString(),
        lastLogin: nowStr,
      };

      await saveCachedSession(appUser, 'google').catch(() => {});
      callback(appUser, true);
    } else {
      callback(null, false);
    }
  });
}

/**
 * Sign out from Firebase
 */
export async function logoutFirebaseUser(): Promise<void> {
  await signOutNativeGoogle(firebaseConfig.oAuthClientId).catch(() => {});
  await signOut(auth);
}

/**
 * Purge all mock/dummy records from Firestore if present
 */
export async function purgeMockDataFromFirestore(): Promise<void> {
  const mockDocIds: Record<string, string[]> = {
    products: [
      'prod-01',
      'prod-02',
      'prod-03',
      'prod-04',
      'prod-05',
      'prod-06',
      'prod-07',
      'prod-08',
      'prod-09',
      'prod-10',
    ],
    customers: ['cust-01', 'cust-02', 'cust-03'],
    suppliers: ['supp-01', 'supp-02', 'supp-03', 'supp-04', 'supp-05'],
    sales: ['inv-1001', 'inv-1002'],
    expenses: ['exp-01', 'exp-02'],
    cash_transactions: ['ctx-00', 'ctx-01', 'ctx-02', 'ctx-03', 'ctx-04'],
    audit_logs: ['log-01', 'log-02', 'log-03'],
  };

  try {
    const batch = writeBatch(db);
    let count = 0;

    for (const [col, ids] of Object.entries(mockDocIds)) {
      for (const id of ids) {
        batch.delete(doc(db, col, id));
        count++;
      }
    }

    // Reset initialCash to 0 in store_settings
    batch.set(
      doc(db, 'store_settings', 'main'),
      {
        initialCash: 0,
        initialStockValue: 0,
      },
      { merge: true }
    );

    if (count > 0) {
      await batch.commit();
    }
  } catch (e) {
    console.warn('Purge mock data note:', e);
  }
}

/**
 * Seed initial hardware store data to Firestore if the database is brand new
 */
export async function seedFirestoreIfEmpty(): Promise<boolean> {
  try {
    const settingsDocRef = doc(db, 'store_settings', 'main');
    const snap = await getDoc(settingsDocRef);
    if (snap.exists()) {
      // Clean up any lingering mock numbers from prior tests
      await purgeMockDataFromFirestore();
      return false;
    }

    const initialState = getInitialState();
    const batch = writeBatch(db);

    // 1. Settings (zero initial cash and stock) with Deflate Level 9 compression
    const cleanSettings = {
      ...initialState.settings,
      initialCash: 0,
      initialStockValue: 0,
      adminEmail: SUPER_ADMIN_EMAIL,
    };
    batch.set(settingsDocRef, packDocumentForFirestore('main', cleanSettings));

    // 2. Clean audit log with Deflate Level 9 compression
    const initLog = {
      id: 'log-clean-init',
      date: getTodayDateString(),
      time: getCurrentTimeString(),
      action: 'تهيئة النظام',
      entityType: 'settings',
      entityId: 'system',
      details: 'بدء استخدام نظام محاسب خردوات المامو بأرقام حقيقية ونظيفة مع تفعيل الضغط الأقصى Deflate L9.',
    };
    batch.set(doc(db, 'audit_logs', initLog.id), packDocumentForFirestore(initLog.id, initLog));

    await batch.commit();
    return true;
  } catch (err) {
    console.warn('Seeding check note:', err);
    return false;
  }
}

/**
 * Real-time synchronization subscription for all store collections.
 * Merges incoming Firestore snapshots while protecting local outbox mutations.
 */
export function subscribeToFirestoreStore(
  onMergeUpdate: (applyRemote: (prev: AppState) => Partial<AppState>) => void,
  options?: { isAdmin?: boolean; currentUid?: string }
): () => void {
  const unsubscribers: Unsubscribe[] = [];
  const isAdmin =
    options?.isAdmin ?? isSuperAdminEmail(auth.currentUser?.email);
  const currentUid = options?.currentUid ?? auth.currentUser?.uid;

  // 1. Settings
  unsubscribers.push(
    onSnapshot(
      doc(db, 'store_settings', 'main'),
      (snap) => {
        if (snap.exists()) {
          const remoteSettings = unpackDocumentFromFirestore<StoreSettings>(snap.data());
          const outbox = getOutboxSync();
          onMergeUpdate((prev) => ({
            settings: mergeRemoteSettingsWithPending(prev.settings, remoteSettings, outbox),
          }));
        }
      },
      (err) => console.warn('Settings sync:', err.message)
    )
  );

  // 2. Products
  unsubscribers.push(
    onSnapshot(
      collection(db, 'products'),
      (snap) => {
        const prods = snap.docs.map((d) => unpackDocumentFromFirestore<Product>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          products: mergeRemoteCollectionWithPending(prev.products, prods, outbox, 'products'),
        }));
      },
      (err) => console.warn('Products sync:', err.message)
    )
  );

  // 3. Customers
  unsubscribers.push(
    onSnapshot(
      collection(db, 'customers'),
      (snap) => {
        const custs = snap.docs.map((d) => unpackDocumentFromFirestore<Customer>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          customers: mergeRemoteCollectionWithPending(prev.customers, custs, outbox, 'customers'),
        }));
      },
      (err) => console.warn('Customers sync:', err.message)
    )
  );

  // 4. Suppliers
  unsubscribers.push(
    onSnapshot(
      collection(db, 'suppliers'),
      (snap) => {
        const supps = snap.docs.map((d) => unpackDocumentFromFirestore<Supplier>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          suppliers: mergeRemoteCollectionWithPending(prev.suppliers, supps, outbox, 'suppliers'),
        }));
      },
      (err) => console.warn('Suppliers sync:', err.message)
    )
  );

  // 5. Sales
  unsubscribers.push(
    onSnapshot(
      collection(db, 'sales'),
      (snap) => {
        const remoteSales = snap.docs.map((d) => unpackDocumentFromFirestore<SaleInvoice>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          sales: mergeRemoteCollectionWithPending(
            prev.sales,
            remoteSales,
            outbox,
            'sales',
            (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
          ),
        }));
      },
      (err) => console.warn('Sales sync:', err.message)
    )
  );

  // 6. Purchases
  unsubscribers.push(
    onSnapshot(
      collection(db, 'purchases'),
      (snap) => {
        const remotePurchases = snap.docs.map((d) => unpackDocumentFromFirestore<PurchaseInvoice>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          purchases: mergeRemoteCollectionWithPending(
            prev.purchases,
            remotePurchases,
            outbox,
            'purchases',
            (a, b) => b.date.localeCompare(a.date)
          ),
        }));
      },
      (err) => console.warn('Purchases sync:', err.message)
    )
  );

  // 7. Expenses
  unsubscribers.push(
    onSnapshot(
      collection(db, 'expenses'),
      (snap) => {
        const remoteExpenses = snap.docs.map((d) => unpackDocumentFromFirestore<Expense>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          expenses: mergeRemoteCollectionWithPending(
            prev.expenses,
            remoteExpenses,
            outbox,
            'expenses',
            (a, b) => b.date.localeCompare(a.date)
          ),
        }));
      },
      (err) => console.warn('Expenses sync:', err.message)
    )
  );

  // 8. Cash Transactions
  unsubscribers.push(
    onSnapshot(
      collection(db, 'cash_transactions'),
      (snap) => {
        const remoteCash = snap.docs.map((d) => unpackDocumentFromFirestore<CashTransaction>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          cashTransactions: mergeRemoteCollectionWithPending(
            prev.cashTransactions,
            remoteCash,
            outbox,
            'cash_transactions',
            (a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)
          ),
        }));
      },
      (err) => console.warn('Cashbox sync:', err.message)
    )
  );

  // 9. Customer Payments
  unsubscribers.push(
    onSnapshot(
      collection(db, 'customer_payments'),
      (snap) => {
        const remotePayments = snap.docs.map((d) => unpackDocumentFromFirestore<CustomerPayment>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          customerPayments: mergeRemoteCollectionWithPending(
            prev.customerPayments,
            remotePayments,
            outbox,
            'customer_payments'
          ),
        }));
      },
      (err) => console.warn('Customer payments sync:', err.message)
    )
  );

  // 10. Supplier Payments
  unsubscribers.push(
    onSnapshot(
      collection(db, 'supplier_payments'),
      (snap) => {
        const remotePayments = snap.docs.map((d) => unpackDocumentFromFirestore<SupplierPayment>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          supplierPayments: mergeRemoteCollectionWithPending(
            prev.supplierPayments,
            remotePayments,
            outbox,
            'supplier_payments'
          ),
        }));
      },
      (err) => console.warn('Supplier payments sync:', err.message)
    )
  );

  // 11. Inventory Adjustments
  unsubscribers.push(
    onSnapshot(
      collection(db, 'inventory_adjustments'),
      (snap) => {
        const remoteAdj = snap.docs.map((d) => unpackDocumentFromFirestore<InventoryAdjustment>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          inventoryAdjustments: mergeRemoteCollectionWithPending(
            prev.inventoryAdjustments,
            remoteAdj,
            outbox,
            'inventory_adjustments'
          ),
        }));
      },
      (err) => console.warn('Adjustments sync:', err.message)
    )
  );

  // 12. Audit Logs
  unsubscribers.push(
    onSnapshot(
      collection(db, 'audit_logs'),
      (snap) => {
        const remoteLogs = snap.docs.map((d) => unpackDocumentFromFirestore<AuditLog>(d.data()));
        const outbox = getOutboxSync();
        onMergeUpdate((prev) => ({
          auditLogs: mergeRemoteCollectionWithPending(
            prev.auditLogs,
            remoteLogs,
            outbox,
            'audit_logs',
            (a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
          ),
        }));
      },
      (err) => console.warn('Audit logs sync:', err.message)
    )
  );

  // 13. Users (Admin subscribes to all users; non-admin listens to own profile doc for live ban/restriction enforcement)
  if (isAdmin) {
    unsubscribers.push(
      onSnapshot(
        collection(db, 'users'),
        (snap) => {
          const remoteUsers = snap.docs.map((d) => unpackDocumentFromFirestore<AppUser>(d.data()));
          if (remoteUsers.length > 0) {
            const outbox = getOutboxSync();
            onMergeUpdate((prev) => ({
              users: mergeRemoteCollectionWithPending(prev.users, remoteUsers, outbox, 'users'),
            }));
          }
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'users')
      )
    );
  } else if (currentUid) {
    unsubscribers.push(
      onSnapshot(
        doc(db, 'users', currentUid),
        (snap) => {
          if (snap.exists()) {
            const selfUser = unpackDocumentFromFirestore<AppUser>(snap.data());
            onMergeUpdate((prev) => {
              const exists = prev.users.some((u) => u.id === selfUser.id);
              return {
                users: exists
                  ? prev.users.map((u) => (u.id === selfUser.id ? selfUser : u))
                  : [...prev.users, selfUser],
              };
            });
          }
        },
        (err) => console.warn('Self user sync:', err.message)
      )
    );
  }

  // 14. Real-time Login Attempts & Access Requests for Admin Monitoring
  if (isAdmin) {
    unsubscribers.push(
      onSnapshot(
        collection(db, 'login_attempts'),
        (snap) => {
          const remoteAttempts = snap.docs.map((d) => unpackDocumentFromFirestore<LoginAttempt>(d.data()));
          const outbox = getOutboxSync();
          onMergeUpdate((prev) => ({
            loginAttempts: mergeRemoteCollectionWithPending(
              prev.loginAttempts,
              remoteAttempts,
              outbox,
              'login_attempts',
              (a, b) => b.timestamp - a.timestamp
            ),
          }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'login_attempts')
      )
    );

    unsubscribers.push(
      onSnapshot(
        collection(db, 'access_requests'),
        (snap) => {
          const remoteReqs = snap.docs.map((d) =>
            unpackDocumentFromFirestore<LoginAccessRequest>(d.data())
          );
          const outbox = getOutboxSync();
          onMergeUpdate((prev) => ({
            accessRequests: mergeRemoteCollectionWithPending(
              prev.accessRequests || [],
              remoteReqs,
              outbox,
              'access_requests',
              (a, b) => b.timestamp - a.timestamp
            ),
          }));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'access_requests')
      )
    );
  } else if (currentUid) {
    unsubscribers.push(
      onSnapshot(
        query(collection(db, 'access_requests'), where('uid', '==', currentUid)),
        (snap) => {
          const remoteReqs = snap.docs.map((d) =>
            unpackDocumentFromFirestore<LoginAccessRequest>(d.data())
          );
          const outbox = getOutboxSync();
          onMergeUpdate((prev) => ({
            accessRequests: mergeRemoteCollectionWithPending(
              prev.accessRequests || [],
              remoteReqs,
              outbox,
              'access_requests',
              (a, b) => b.timestamp - a.timestamp
            ),
          }));
        },
        (err) => console.warn('Own access requests sync:', err.message)
      )
    );
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

const UNCOMPRESSED_SECURITY_COLLECTIONS = new Set(['users', 'access_requests']);

/**
 * Strict push used by the offline-first Sync Engine.
 * Throws if browser is offline or Firebase Auth is inactive so the outbox keeps the item queued.
 */
export async function pushDocToFirestoreStrict(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('client is offline');
  }
  if (!auth.currentUser) {
    throw new Error('unauthenticated: sign in with Google to sync to Firestore');
  }
  const payload = UNCOMPRESSED_SECURITY_COLLECTIONS.has(collectionName)
    ? data
    : packDocumentForFirestore(docId, data);
  try {
    await setDoc(doc(db, collectionName, docId), payload, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${collectionName}/${docId}`);
  }
}

/**
 * Strict delete used by the offline-first Sync Engine.
 */
export async function removeDocFromFirestoreStrict(
  collectionName: string,
  docId: string
): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('client is offline');
  }
  if (!auth.currentUser) {
    throw new Error('unauthenticated: sign in with Google to sync to Firestore');
  }
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${docId}`);
  }
}

/**
 * Save single document to Firestore with Maximum Deflate Level 9 compression
 */
export async function syncDocToFirestore(
  collectionName: string,
  docId: string,
  data: any
): Promise<void> {
  try {
    await pushDocToFirestoreStrict(collectionName, docId, data);
  } catch (err) {
    console.warn(`Deferred cloud write for ${collectionName}/${docId}:`, err);
  }
}

/**
 * Delete single document from Firestore
 */
export async function deleteDocFromFirestore(
  collectionName: string,
  docId: string
): Promise<void> {
  try {
    await removeDocFromFirestoreStrict(collectionName, docId);
  } catch (err) {
    console.warn(`Deferred cloud delete for ${collectionName}/${docId}:`, err);
  }
}

/**
 * Wipe all data documents in all collections in Firestore
 */
export async function clearAllFirestoreData(): Promise<void> {
  const collections = [
    'products',
    'sales',
    'purchases',
    'expenses',
    'customers',
    'suppliers',
    'cash_transactions',
    'customer_payments',
    'supplier_payments',
    'inventory_adjustments',
    'audit_logs',
    'login_attempts',
  ];
  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (e) {
      console.warn(`Error clearing collection ${colName}:`, e);
    }
  }
}

/**
 * Format bytes into readable Arabic unit
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب (كيلوبايت)`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} م.ب (ميغابايت)`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(3)} ج.ب (جيجابايت)`;
}

export interface CollectionStorageInfo {
  name: string;
  label: string;
  count: number;
  bytes: number;
  uncompressedBytes: number;
  savedBytes: number;
  savingsPercentage: number;
  formatted: string;
  uncompressedFormatted: string;
}

export interface StorageUsageSummary {
  usedBytes: number;
  usedFormatted: string;
  uncompressedBytes: number;
  uncompressedFormatted: string;
  savedBytes: number;
  savedFormatted: string;
  savingsPercentage: number;
  savingsPercentageFormatted: string;
  compressionAlgorithm: string;
  totalBytes: number;
  totalFormatted: string;
  remainingBytes: number;
  remainingFormatted: string;
  remainingMB: string;
  percentage: number;
  percentageFormatted: string;
  totalDocCount: number;
  breakdown: CollectionStorageInfo[];
}

/**
 * Calculate total data storage used and remaining in Firestore Free Spark Tier (1 GB limit)
 * Calculates real-time Deflate Level 9 compressed storage vs raw uncompressed storage.
 */
export function calculateStorageUsage(state: AppState): StorageUsageSummary {
  const FIRESTORE_FREE_LIMIT_BYTES = 1024 * 1024 * 1024; // 1 GB (1,073,741,824 bytes)

  const collections = [
    { name: 'products', label: 'المواد والمخزون', items: state.products || [] },
    { name: 'sales', label: 'فواتير المبيعات', items: state.sales || [] },
    { name: 'purchases', label: 'فواتير المشتريات', items: state.purchases || [] },
    { name: 'expenses', label: 'المصروفات التشغيلية', items: state.expenses || [] },
    { name: 'customers', label: 'حسابات الزبائن والديون', items: state.customers || [] },
    { name: 'suppliers', label: 'حسابات الموردين والذمم', items: state.suppliers || [] },
    { name: 'cash_transactions', label: 'حركات الصندوق النقدي', items: state.cashTransactions || [] },
    { name: 'customer_payments', label: 'سندات قبض ديون الزبائن', items: state.customerPayments || [] },
    { name: 'supplier_payments', label: 'سندات صرف دفعات الموردين', items: state.supplierPayments || [] },
    { name: 'inventory_adjustments', label: 'تسويات الجرد المخزني', items: state.inventoryAdjustments || [] },
    { name: 'audit_logs', label: 'سجل العمليات والتدقيق', items: state.auditLogs || [] },
    { name: 'login_attempts', label: 'محاولات وسجلات الدخول للأمان', items: state.loginAttempts || [] },
    { name: 'access_requests', label: 'طلبات تسجيل الدخول والموافقات', items: state.accessRequests || [] },
    { name: 'store_settings', label: 'إعدادات المتجر والنظام', items: [state.settings] },
  ];

  let totalCompressedBytes = 0;
  let totalUncompressedBytes = 0;
  let totalDocCount = 0;

  const breakdown: CollectionStorageInfo[] = collections.map((col) => {
    let colCompressedBytes = 0;
    let colUncompressedBytes = 0;

    col.items.forEach((item) => {
      const { originalSize, compressedSize } = compressToBytes(item);
      const numFields = typeof item === 'object' && item !== null ? Object.keys(item).length : 8;
      // In Google Cloud Firestore documentation (https://firebase.google.com/docs/firestore/storage-size),
      // standard uncompressed documents incur:
      // 1. Raw UTF-8 payload (originalSize)
      // 2. 32 bytes document metadata
      // 3. Document resource path + ID overhead (~48 bytes)
      // 4. Two single-field indexes (ascending and descending) for each field:
      //    Each indexed field consumes ~115 bytes of B-Tree index space.
      // Deflate Level 9 + native Protocol Buffer raw Bytes 'd' eliminates all internal single-field indexes,
      // compressing data into a single binary field and reducing cloud consumption by over 80%!
      const firestoreUncompressedDocBytes = originalSize + 32 + 48 + (numFields * 115);
      const firestoreCompressedDocBytes = compressedSize + 48;

      colUncompressedBytes += firestoreUncompressedDocBytes;
      colCompressedBytes += firestoreCompressedDocBytes;
    });

    totalCompressedBytes += colCompressedBytes;
    totalUncompressedBytes += colUncompressedBytes;
    totalDocCount += col.items.length;

    const colSaved = Math.max(0, colUncompressedBytes - colCompressedBytes);
    const colSavingsPercent = colUncompressedBytes > 0 ? (colSaved / colUncompressedBytes) * 100 : 0;

    return {
      name: col.name,
      label: col.label,
      count: col.items.length,
      bytes: colCompressedBytes,
      uncompressedBytes: colUncompressedBytes,
      savedBytes: colSaved,
      savingsPercentage: Math.round(colSavingsPercent * 10) / 10,
      formatted: formatByteSize(colCompressedBytes),
      uncompressedFormatted: formatByteSize(colUncompressedBytes),
    };
  });

  const savedBytes = Math.max(0, totalUncompressedBytes - totalCompressedBytes);
  const savingsPercentage = totalUncompressedBytes > 0 ? (savedBytes / totalUncompressedBytes) * 100 : 0;
  const remainingBytes = Math.max(0, FIRESTORE_FREE_LIMIT_BYTES - totalCompressedBytes);
  const percentage = (totalCompressedBytes / FIRESTORE_FREE_LIMIT_BYTES) * 100;

  return {
    usedBytes: totalCompressedBytes,
    usedFormatted: formatByteSize(totalCompressedBytes),
    uncompressedBytes: totalUncompressedBytes,
    uncompressedFormatted: formatByteSize(totalUncompressedBytes),
    savedBytes,
    savedFormatted: formatByteSize(savedBytes),
    savingsPercentage: Math.round(savingsPercentage * 10) / 10,
    savingsPercentageFormatted: `${savingsPercentage.toFixed(1)}%`,
    compressionAlgorithm: 'Deflate L9 + Raw Protocol Buffer Bytes (أعلى ضغط ممكن)',
    totalBytes: FIRESTORE_FREE_LIMIT_BYTES,
    totalFormatted: '1.00 جيجابايت (1024 ميغابايت)',
    remainingBytes,
    remainingFormatted: formatByteSize(remainingBytes),
    remainingMB: (remainingBytes / (1024 * 1024)).toFixed(2),
    percentage: Math.min(100, Math.max(0.0001, percentage)),
    percentageFormatted: percentage < 0.01 ? '< 0.01%' : `${percentage.toFixed(2)}%`,
    totalDocCount,
    breakdown,
  };
}

/**
 * Scans all collections in Firestore and compresses any legacy uncompressed documents
 * using Maximum Deflate Level 9 into binary Firestore Bytes.
 */
export async function compressExistingCloudDatabase(): Promise<{
  success: boolean;
  compressedDocsCount: number;
  totalOriginalBytes: number;
  totalCompressedBytes: number;
  savedBytes: number;
  savingsPercentage: number;
  message: string;
}> {
  const collections = [
    'products',
    'sales',
    'purchases',
    'expenses',
    'customers',
    'suppliers',
    'cash_transactions',
    'customer_payments',
    'supplier_payments',
    'inventory_adjustments',
    'audit_logs',
  ];

  let compressedDocsCount = 0;
  let totalOriginalBytes = 0;
  let totalCompressedBytes = 0;

  for (const colName of collections) {
    try {
      const snap = await getDocs(collection(db, colName));
      if (!snap.empty) {
        const batch = writeBatch(db);
        let batchPending = 0;

        for (const docSnap of snap.docs) {
          const raw = docSnap.data();
          if (raw._c !== true) {
            // Document is not yet compressed! Compress it
            const packed = packDocumentForFirestore(docSnap.id, raw);
            batch.set(doc(db, colName, docSnap.id), packed, { merge: false });
            batchPending++;
            compressedDocsCount++;
            totalOriginalBytes += packed._origBytes || 0;
            totalCompressedBytes += packed._compBytes || 0;
          } else {
            totalOriginalBytes += raw._origBytes || 0;
            totalCompressedBytes += raw._compBytes || 0;
          }
        }

        if (batchPending > 0) {
          await batch.commit();
        }
      }
    } catch (err) {
      console.warn(`Error compressing collection ${colName}:`, err);
    }
  }

  // Also compress store_settings/main if uncompressed
  try {
    const sDoc = await getDoc(doc(db, 'store_settings', 'main'));
    if (sDoc.exists()) {
      const sRaw = sDoc.data();
      if (sRaw._c !== true) {
        const packed = packDocumentForFirestore('main', sRaw);
        await setDoc(doc(db, 'store_settings', 'main'), packed, { merge: false });
        compressedDocsCount++;
        totalOriginalBytes += packed._origBytes || 0;
        totalCompressedBytes += packed._compBytes || 0;
      }
    }
  } catch (err) {
    console.warn('Error compressing settings doc:', err);
  }

  const savedBytes = Math.max(0, totalOriginalBytes - totalCompressedBytes);
  const savingsPercentage = totalOriginalBytes > 0 ? (savedBytes / totalOriginalBytes) * 100 : 0;

  return {
    success: true,
    compressedDocsCount,
    totalOriginalBytes,
    totalCompressedBytes,
    savedBytes,
    savingsPercentage: Math.round(savingsPercentage * 10) / 10,
    message:
      compressedDocsCount > 0
        ? `تم بنجاح ضغط وترشيد ${compressedDocsCount} مستنداً بأقوى خوارزمية Deflate L9 وتوفير ${formatByteSize(savedBytes)} (${savingsPercentage.toFixed(1)}%) من مساحة التخزين على Firebase!`
        : `كافة المستندات في قاعدة بيانات Firebase مضغوطة مسبقاً بأعلى كفاءة (Deflate L9) ومساحتها مرشّدة بالكامل.`,
  };
}
