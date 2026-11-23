import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANDROID_APP_PACKAGE_ID,
  buildAssetLinksPayload,
  formatFirebaseAuthErrorArabic,
  isAndroidWebViewShell,
  normalizeShaFingerprint,
  resolveApiUrl,
  sanitizeBaseUrl,
} from './apkEnvironment';

test('normalizeShaFingerprint validates and formats SHA-1 and SHA-256 properly', () => {
  const sha1 = normalizeShaFingerprint(
    'sha1: abcd1234ef567890abcd1234ef567890abcd1234'
  );
  assert.equal(sha1.valid, true);
  assert.equal(sha1.kind, 'SHA-1');
  assert.equal(
    sha1.formatted,
    'AB:CD:12:34:EF:56:78:90:AB:CD:12:34:EF:56:78:90:AB:CD:12:34'
  );

  const sha256 = normalizeShaFingerprint(
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff'
  );
  assert.equal(sha256.valid, true);
  assert.equal(sha256.kind, 'SHA-256');
  assert.equal(sha256.formatted.split(':').length, 32);

  const bad = normalizeShaFingerprint('not-a-sha');
  assert.equal(bad.valid, false);
  assert.equal(bad.kind, 'unknown');
});

test('buildAssetLinksPayload outputs valid Digital Asset Links JSON keeping only valid SHA-256', () => {
  const payload = buildAssetLinksPayload(ANDROID_APP_PACKAGE_ID, [
    '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
    'abcd1234ef567890abcd1234ef567890abcd1234', // SHA-1 should be excluded from sha256_cert_fingerprints
  ]);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].target.package_name, 'com.almamo.hardware');
  assert.equal(payload[0].target.sha256_cert_fingerprints.length, 1);
  assert.equal(
    payload[0].target.sha256_cert_fingerprints[0],
    '00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF'
  );
});

test('resolveApiUrl and sanitizeBaseUrl work cleanly for web and standalone APK backends', () => {
  assert.equal(resolveApiUrl('/api/ai/chat', ''), '/api/ai/chat');
  assert.equal(
    resolveApiUrl('/api/ai/chat', 'almamo.onrender.com/'),
    'https://almamo.onrender.com/api/ai/chat'
  );
  assert.equal(sanitizeBaseUrl('https://my-app.onrender.com///'), 'https://my-app.onrender.com');
});

test('isAndroidWebViewShell detects Android WebView user agents', () => {
  assert.equal(
    isAndroidWebViewShell(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    ),
    true
  );
  assert.equal(
    isAndroidWebViewShell(
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    ),
    false
  );
});

test('formatFirebaseAuthErrorArabic handles unauthorized-domain and native SHA-1 errors gracefully', () => {
  const err1 = formatFirebaseAuthErrorArabic({
    code: 'auth/unauthorized-domain',
    message: 'Domain not authorized',
  });
  assert.equal(err1.isApkOrShaIssue, true);
  assert.match(err1.message, /كلمة المرور/);

  const err2 = formatFirebaseAuthErrorArabic({
    code: 'DEVELOPER_ERROR',
    message: 'com.google.android.gms.common.api.ApiException: 10: DEVELOPER_ERROR SHA-1',
  });
  assert.equal(err2.isApkOrShaIssue, true);
  assert.match(err2.message, /SHA-1/);
  assert.match(err2.message, /com\.almamo\.hardware/);
  assert.match(err2.message, /كلمة المرور/);

  const err3 = formatFirebaseAuthErrorArabic({
    code: 'NO_GOOGLE_ACCOUNT',
    message: 'No signed-in Google account found on Android device',
  });
  assert.equal(err3.isApkOrShaIssue, true);
  assert.match(err3.message, /جهاز الأندرويد/);
  assert.match(err3.message, /كلمة المرور/);
});
