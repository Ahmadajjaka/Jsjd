import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyNativeGoogleError,
  resolveGoogleSignInStrategy,
} from './nativeGoogleAuth';

test('resolveGoogleSignInStrategy strictly locks Android APK to native-android-only without browser fallback', () => {
  const apkStrategy = resolveGoogleSignInStrategy({
    isAndroidApk: true,
    isNativePluginAvailable: true,
  });
  assert.equal(apkStrategy.mode, 'native-android-only');
  assert.equal(apkStrategy.allowBrowserFallback, false);

  const webStrategy = resolveGoogleSignInStrategy({
    isAndroidApk: false,
    isNativePluginAvailable: false,
  });
  assert.equal(webStrategy.mode, 'web-popup-redirect');
  assert.equal(webStrategy.allowBrowserFallback, true);
});

test('classifyNativeGoogleError detects user cancellation across CredentialManager and GMS codes', () => {
  assert.equal(
    classifyNativeGoogleError({ code: 'USER_CANCELED', message: 'User cancelled Google Sign-In' }).kind,
    'cancelled'
  );
  assert.equal(
    classifyNativeGoogleError({ code: 'GMS_12501', message: '12501: SIGN_IN_CANCELLED' }).kind,
    'cancelled'
  );
});

test('classifyNativeGoogleError detects SHA-1 / DEVELOPER_ERROR / GMS_12500 / missing idToken configuration issues', () => {
  assert.equal(
    classifyNativeGoogleError({
      code: 'DEVELOPER_ERROR',
      message: 'ApiException: 10 (DEVELOPER_ERROR) SHA-1',
    }).kind,
    'sha_or_config'
  );
  assert.equal(
    classifyNativeGoogleError({ code: 'GMS_12500', message: 'GoogleSignIn ApiException: 12500' }).kind,
    'sha_or_config'
  );
  assert.equal(
    classifyNativeGoogleError({ code: 'MISSING_ID_TOKEN', message: 'Missing Google ID Token' }).kind,
    'sha_or_config'
  );
});

test('classifyNativeGoogleError detects missing Google account on Android device and network issues cleanly', () => {
  assert.equal(
    classifyNativeGoogleError({ code: 'NO_GOOGLE_ACCOUNT', message: 'No signed-in Google account found' }).kind,
    'no_account'
  );
  assert.equal(
    classifyNativeGoogleError({ code: 'NETWORK_ERROR', message: 'Network error during Google Sign-In' }).kind,
    'network'
  );
});
