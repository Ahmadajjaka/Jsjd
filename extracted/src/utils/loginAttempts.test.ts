import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeviceInfo } from '../services/firebaseSync';
import { LoginAttempt } from '../types/accounting';

test('getDeviceInfo extracts valid device and browser info', () => {
  const info = getDeviceInfo();
  assert.equal(typeof info.deviceLabel, 'string');
  assert.ok(info.deviceLabel.length > 0);
  assert.equal(typeof info.platform, 'string');
});

test('login attempts modeling and status categorization', () => {
  const successfulAttempt: LoginAttempt = {
    id: 'att-1',
    date: '2026-11-10',
    time: '10:30:00',
    timestamp: 1762770600000,
    email: 'seller@gmail.com',
    userName: 'سامر كاشير',
    attemptedRole: 'salesperson',
    actualRole: 'salesperson',
    status: 'success',
    statusArabic: 'ناجحة',
    deviceInfo: 'كمبيوتر (Windows) · Chrome',
    details: 'تسجيل دخول ناجح',
  };

  const failedAttempt: LoginAttempt = {
    id: 'att-2',
    date: '2026-11-10',
    time: '10:31:00',
    timestamp: 1762770660000,
    email: 'unknown@gmail.com',
    userName: 'مستخدم غير مصرح',
    attemptedRole: 'admin',
    status: 'failed',
    statusArabic: 'فاشلة',
    errorMessage: 'وصول مرفوض',
    deviceInfo: 'هاتف (Android) · Chrome',
    details: 'محاولة دخول غير مصرح بها',
  };

  const cancelledAttempt: LoginAttempt = {
    id: 'att-3',
    date: '2026-11-10',
    time: '10:32:00',
    timestamp: 1762770720000,
    email: 'visitor@gmail.com',
    userName: 'زائر',
    attemptedRole: 'salesperson',
    status: 'cancelled',
    statusArabic: 'ملغاة من المستخدم',
    deviceInfo: 'كمبيوتر (Mac) · Safari',
    details: 'إغلاق نافذة الدخول',
  };

  const attempts = [successfulAttempt, failedAttempt, cancelledAttempt];

  const successCount = attempts.filter((a) => a.status === 'success').length;
  const failedCount = attempts.filter((a) => a.status !== 'success').length;

  assert.equal(successCount, 1);
  assert.equal(failedCount, 2);
  assert.equal(attempts.length, 3);

  // Verify sorting by timestamp descending (newest first)
  const sorted = [...attempts].sort((a, b) => b.timestamp - a.timestamp);
  assert.equal(sorted[0].id, 'att-3');
  assert.equal(sorted[2].id, 'att-1');
});
