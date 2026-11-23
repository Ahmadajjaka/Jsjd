
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Capacitor bridge + pure error classification helpers for
 * Android Native Google Sign-In (Credential Manager + GoogleSignInClient).
 */

import { Capacitor, registerPlugin } from '@capacitor/core';

export interface NativeGoogleSignInResult {
  idToken: string;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  provider?: string;
}

export interface NativeGoogleAuthPluginInterface {
  signIn(options?: { serverClientId?: string }): Promise<NativeGoogleSignInResult>;
  signOut(options?: { serverClientId?: string }): Promise<void>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPluginInterface>('NativeGoogleAuth');

export function isNativeGoogleAuthAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (!Capacitor.isNativePlatform()) return false;
    if (Capacitor.getPlatform() !== 'android') return false;

    if (typeof Capacitor.isPluginAvailable === 'function') {
      return Capacitor.isPluginAvailable('NativeGoogleAuth');
    }

    return true;
  } catch {
    return false;
  }
}

export type NativeGoogleErrorKind =
  | 'cancelled'
  | 'sha_or_config'
  | 'no_account'
  | 'network'
  | 'other';

export interface GoogleSignInStrategy {
  mode: 'native-android-only' | 'web-popup-redirect';
  allowBrowserFallback: boolean;
}

export function resolveGoogleSignInStrategy(options: {
  isAndroidApk: boolean;
  isNativePluginAvailable: boolean;
}): GoogleSignInStrategy {
  if (options.isAndroidApk || options.isNativePluginAvailable) {
    return {
      mode: 'native-android-only',
      allowBrowserFallback: false,
    };
  }

  return {
    mode: 'web-popup-redirect',
    allowBrowserFallback: true,
  };
}

export function classifyNativeGoogleError(err: any): {
  kind: NativeGoogleErrorKind;
  code: string;
  rawMessage: string;
} {
  const code = String(err?.code || '');
  const rawMessage = String(err?.message || err || '');
  const upper = `${code} ${rawMessage}`.toUpperCase();

  // Diagnostic errors must not be hidden as ordinary user cancellation.
  if (
    code === 'CM_CANCELLED' ||
    code === 'CREDENTIAL_PARSE_ERROR' ||
    code === 'EMPTY_ID_TOKEN'
  ) {
    return { kind: 'other', code, rawMessage };
  }

  if (
    code === 'USER_CANCELED' ||
    upper.includes('USER_CANCELED') ||
    upper.includes('SIGN_IN_CANCELLED') ||
    upper.includes('12501') ||
    upper.includes('CANCELLED') ||
    upper.includes('CANCELED')
  ) {
    return { kind: 'cancelled', code, rawMessage };
  }

  if (
    code === 'NETWORK_ERROR' ||
    upper.includes('NETWORK_ERROR') ||
    upper.includes('NETWORK') ||
    upper.includes('TIMEOUT')
  ) {
    return { kind: 'network', code, rawMessage };
  }

  if (
    code === 'NO_GOOGLE_ACCOUNT' ||
    upper.includes('NO_GOOGLE_ACCOUNT') ||
    upper.includes('NO_CREDENTIAL')
  ) {
    return { kind: 'no_account', code, rawMessage };
  }

  if (
    code === 'DEVELOPER_ERROR' ||
    code === 'MISSING_ID_TOKEN' ||
    code === 'MISSING_CLIENT_ID' ||
    code === 'GMS_12500' ||
    upper.includes('DEVELOPER_ERROR') ||
    upper.includes('12500') ||
    upper.includes('SHA-1') ||
    upper.includes('SHA1') ||
    upper.includes('APIEXCEPTION: 10') ||
    upper.includes('10:')
  ) {
    return { kind: 'sha_or_config', code, rawMessage };
  }

  return { kind: 'other', code, rawMessage };
}

export async function signInWithNativeGoogle(
  serverClientId?: string
): Promise<NativeGoogleSignInResult> {
  return NativeGoogleAuth.signIn(
    serverClientId ? { serverClientId } : {}
  );
}

export async function signOutNativeGoogle(
  serverClientId?: string
): Promise<void> {
  if (!isNativeGoogleAuthAvailable()) return;

  await NativeGoogleAuth.signOut(
    serverClientId ? { serverClientId } : {}
  );
}
