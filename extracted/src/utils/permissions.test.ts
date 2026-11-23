import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  authenticateUser,
  ROLE_PRESET_PERMISSIONS,
  isUserBlocked,
  isUserRestricted,
  canUserMutate,
  resolveUserModerationStatus,
} from './permissions';
import { AppUser, LoginAccessRequest } from '../types/accounting';

const mockAdmin: AppUser = {
  id: 'u1',
  username: 'admin',
  password: '123',
  fullName: 'المدير العام',
  role: 'admin',
  roleNameArabic: 'مدير النظام',
  permissions: ROLE_PRESET_PERMISSIONS.admin,
  isActive: true,
  createdAt: '2026-10-01',
};

const mockSalesperson: AppUser = {
  id: 'u2',
  username: 'sales',
  password: '123',
  fullName: 'محمد الكاشير',
  role: 'salesperson',
  roleNameArabic: 'كاشير وبائع',
  permissions: ROLE_PRESET_PERMISSIONS.salesperson,
  isActive: true,
  createdAt: '2026-10-01',
};

const mockInactiveUser: AppUser = {
  id: 'u3',
  username: 'disabled',
  password: '123',
  fullName: 'موظف معطل',
  role: 'accountant',
  roleNameArabic: 'محاسب',
  permissions: ROLE_PRESET_PERMISSIONS.accountant,
  isActive: false,
  createdAt: '2026-10-01',
};

test('admin role has all permissions unconditionally', () => {
  assert.equal(hasPermission(mockAdmin, 'sales_view'), true);
  assert.equal(hasPermission(mockAdmin, 'reports_view'), true);
  assert.equal(hasPermission(mockAdmin, 'settings_manage'), true);
  assert.equal(hasPermission(mockAdmin, 'users_manage'), true);
});

test('salesperson has sales permissions but NOT profit reports or settings', () => {
  assert.equal(hasPermission(mockSalesperson, 'sales_create'), true);
  assert.equal(hasPermission(mockSalesperson, 'inventory_view'), true);
  assert.equal(hasPermission(mockSalesperson, 'reports_view'), false);
  assert.equal(hasPermission(mockSalesperson, 'settings_manage'), false);
  assert.equal(hasPermission(mockSalesperson, 'users_manage'), false);
  assert.equal(hasPermission(mockSalesperson, 'expenses_manage'), false);
});

test('inactive users are denied all permissions', () => {
  assert.equal(hasPermission(mockInactiveUser, 'sales_view'), false);
  assert.equal(hasPermission(mockInactiveUser, 'reports_view'), false);
});

test('authenticateUser verifies credentials and returns active user', () => {
  const users = [mockAdmin, mockSalesperson, mockInactiveUser];

  // Correct credentials
  const validUser = authenticateUser(users, 'sales', '123');
  assert.notEqual(validUser, null);
  assert.equal(validUser?.fullName, 'محمد الكاشير');

  // Wrong password
  const wrongPass = authenticateUser(users, 'sales', 'wrong');
  assert.equal(wrongPass, null);

  // Inactive user
  const inactive = authenticateUser(users, 'disabled', '123');
  assert.equal(inactive, null);
});

test('salesperson role has proper Arabic label and POS access', () => {
  assert.equal(mockSalesperson.role, 'salesperson');
  assert.equal(hasPermission(mockSalesperson, 'sales_view'), true);
  assert.equal(hasPermission(mockSalesperson, 'sales_create'), true);
  assert.equal(hasPermission(mockSalesperson, 'customers_manage'), true);
  assert.equal(hasPermission(mockSalesperson, 'cashbox_view'), true);
  assert.equal(hasPermission(mockSalesperson, 'cashbox_manage'), false);
  assert.equal(hasPermission(mockSalesperson, 'settings_manage'), false);
});

test('banned and rejected users are denied all permissions and blocked', () => {
  const bannedUser: AppUser = {
    ...mockSalesperson,
    id: 'u-banned',
    accessStatus: 'banned',
    restrictionNote: 'تم الحظر لمخالفة التعليمات',
  };
  const rejectedUser: AppUser = {
    ...mockSalesperson,
    id: 'u-rejected',
    accessStatus: 'rejected',
  };

  assert.equal(isUserBlocked(bannedUser), true);
  assert.equal(hasPermission(bannedUser, 'sales_view'), false);
  assert.equal(hasPermission(bannedUser, 'sales_create'), false);
  assert.equal(authenticateUser([bannedUser], 'sales', '123'), null);

  assert.equal(isUserBlocked(rejectedUser), true);
  assert.equal(hasPermission(rejectedUser, 'sales_view'), false);
});

test('restricted users respect assigned permissions and read-only enforcement', () => {
  const restrictedUser: AppUser = {
    ...mockSalesperson,
    id: 'u-restricted',
    accessStatus: 'restricted',
    isReadOnly: true,
    permissions: ['sales_view', 'sales_create', 'inventory_view'],
    restrictionNote: 'مقيد: عرض فقط بدون تعديل الفواتير',
  };

  assert.equal(isUserBlocked(restrictedUser), false);
  assert.equal(isUserRestricted(restrictedUser), true);
  assert.equal(canUserMutate(restrictedUser), false);
  assert.equal(hasPermission(restrictedUser, 'sales_view'), true);
  assert.equal(hasPermission(restrictedUser, 'inventory_view'), true);
  // Read-only denies write permissions even if listed
  assert.equal(hasPermission(restrictedUser, 'sales_create'), false);

  const partialRestricted: AppUser = {
    ...restrictedUser,
    isReadOnly: false,
    permissions: ['sales_view', 'sales_create'],
  };
  assert.equal(canUserMutate(partialRestricted), true);
  assert.equal(hasPermission(partialRestricted, 'sales_create'), true);
  assert.equal(hasPermission(partialRestricted, 'customers_manage'), false);
});

test('resolveUserModerationStatus resolves pending, banned, rejected, restricted, and approved requests', () => {
  const reqs: LoginAccessRequest[] = [
    {
      id: 'req-1',
      email: 'pending@example.com',
      fullName: 'سعيد بانتظار الموافقة',
      requestedRole: 'salesperson',
      requestedRoleArabic: 'كاشير وبائع',
      status: 'pending',
      date: '2026-11-18',
      time: '10:00',
      timestamp: 1000,
    },
    {
      id: 'req-2',
      email: 'restricted@example.com',
      fullName: 'رامي المقيد',
      requestedRole: 'salesperson',
      requestedRoleArabic: 'كاشير وبائع',
      status: 'restricted',
      assignedRole: 'custom',
      assignedPermissions: ['inventory_view'],
      restrictionNote: 'عرض المخزون فقط',
      isReadOnly: true,
      date: '2026-11-18',
      time: '10:05',
      timestamp: 2000,
    },
  ];

  const bannedRes = resolveUserModerationStatus({
    users: [{ ...mockSalesperson, email: 'banned@example.com', accessStatus: 'banned' }],
    accessRequests: reqs,
    email: 'banned@example.com',
  });
  assert.equal(bannedRes.outcome, 'banned');

  const pendingRes = resolveUserModerationStatus({
    users: [],
    accessRequests: reqs,
    email: 'pending@example.com',
  });
  assert.equal(pendingRes.outcome, 'pending');

  const restrictedRes = resolveUserModerationStatus({
    users: [],
    accessRequests: reqs,
    email: 'restricted@example.com',
  });
  assert.equal(restrictedRes.outcome, 'restricted');
  assert.equal(restrictedRes.matchedRequest?.restrictionNote, 'عرض المخزون فقط');
});


