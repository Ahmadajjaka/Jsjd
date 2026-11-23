import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSecurityAttemptPayload,
  formatPermissionStatusArabic,
  getSnapshotStatusArabic,
} from './securityCapture';

test('buildSecurityAttemptPayload captures snapshotId and Arabic labels on failed PIN entry', () => {
  const attempt = buildSecurityAttemptPayload({
    id: 'att-test-1',
    timestamp: 1700000000000,
    date: '2026-11-19',
    time: '12:00:00',
    userName: 'مستخدم قفل الشاشة',
    attemptedRole: 'admin',
    isSuccess: false,
    entryMethod: 'lock_screen',
    snapshotResult: {
      status: 'captured',
      snapshotId: 'snap-123',
      imageDataUrl: 'data:image/jpeg;base64,abc',
    },
  });

  assert.equal(attempt.id, 'att-test-1');
  assert.equal(attempt.status, 'failed');
  assert.equal(attempt.snapshotId, 'snap-123');
  assert.equal(attempt.snapshotStatus, 'captured');
  assert.equal(attempt.entryMethod, 'lock_screen');
  assert.ok(attempt.statusArabic.includes('خاطئة'));
  assert.ok(attempt.details?.includes('تم التقاط صورة أمنية بالكاميرا'));
});

test('buildSecurityAttemptPayload handles camera denied gracefully on password login success', () => {
  const attempt = buildSecurityAttemptPayload({
    userName: 'أحمد المامو',
    email: 'admin',
    attemptedRole: 'admin',
    actualRole: 'admin',
    isSuccess: true,
    entryMethod: 'password_login',
    snapshotResult: {
      status: 'denied',
      errorReason: 'تم رفض إذن الكاميرا.',
    },
  });

  assert.equal(attempt.status, 'success');
  assert.equal(attempt.snapshotId, undefined);
  assert.equal(attempt.snapshotStatus, 'denied');
  assert.equal(attempt.entryMethod, 'password_login');
  assert.ok(attempt.statusArabic.includes('دخول ناجح'));
  assert.ok(attempt.details?.includes('إذن الكاميرا غير ممنوح'));
});

test('formatPermissionStatusArabic maps all permission states accurately', () => {
  assert.equal(formatPermissionStatusArabic('granted'), 'ممنوح ومفعّل');
  assert.equal(formatPermissionStatusArabic('denied'), 'مرفوض من المتصفح');
  assert.equal(formatPermissionStatusArabic('prompt'), 'بانتظار الموافقة');
  assert.equal(formatPermissionStatusArabic('unsupported'), 'غير مدعوم على هذا الجهاز');
});

test('getSnapshotStatusArabic maps snapshot states clearly', () => {
  assert.equal(getSnapshotStatusArabic('captured'), 'تم التقاط الصورة');
  assert.equal(getSnapshotStatusArabic('denied'), 'إذن الكاميرا مرفوض');
  assert.equal(getSnapshotStatusArabic('no_camera'), 'بدون كاميرا');
  assert.equal(getSnapshotStatusArabic('disabled'), 'معطّل');
  assert.equal(getSnapshotStatusArabic('error'), 'تعذر الالتقاط');
});

