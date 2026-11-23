import { AppUser, LoginAccessRequest, PermissionKey, UserRole } from '../types/accounting';

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  group: string;
  description: string;
}

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // Sales
  {
    key: 'sales_view',
    label: 'عرض فواتير وسجل المبيعات',
    group: 'المبيعات ونقطة البيع',
    description: 'الاطلاع على فواتير المبيعات السابقة وتفاصيلها',
  },
  {
    key: 'sales_create',
    label: 'تسجيل وإصدار فواتير بيع جديدة',
    group: 'المبيعات ونقطة البيع',
    description: 'استخدام نقطة البيع لبيع المواد للزبائن',
  },
  {
    key: 'sales_return',
    label: 'إرجاع وإلغاء فواتير المبيعات',
    group: 'المبيعات ونقطة البيع',
    description: 'إجراء حركات إرجاع البضاعة وعكس الحسابات',
  },

  // Purchases
  {
    key: 'purchases_view',
    label: 'عرض فواتير المشتريات',
    group: 'المشتريات والتوريد',
    description: 'الاطلاع على فواتير الموردين ومشتريات البضاعة',
  },
  {
    key: 'purchases_create',
    label: 'تسجيل فواتير شراء وتوريد جديدة',
    group: 'المشتريات والتوريد',
    description: 'إدخال بضائع مشتراة من الموردين وتحديث المخزون',
  },

  // Inventory
  {
    key: 'inventory_view',
    label: 'عرض المستودع وأسعار المواد',
    group: 'المستودع والمخزون',
    description: 'الاطلاع على كميات المواد وأسعار البيع',
  },
  {
    key: 'inventory_manage',
    label: 'إدارة المواد وتعديل رصيد الجرد',
    group: 'المستودع والمخزون',
    description: 'إضافة مواد جديدة، تعديل الأسعار، وإجراء تسويات الجرد',
  },

  // Expenses
  {
    key: 'expenses_view',
    label: 'عرض سجل المصروفات',
    group: 'المصروفات التشغيلية',
    description: 'الاطلاع على نفقات وأجور المتجر',
  },
  {
    key: 'expenses_manage',
    label: 'تسجيل وحذف المصروفات',
    group: 'المصروفات التشغيلية',
    description: 'صرف نفقات يومية من الصندوق',
  },

  // Customers & Debts
  {
    key: 'customers_view',
    label: 'عرض حسابات الزبائن والديون',
    group: 'الزبائن والديون',
    description: 'الاطلاع على أسماء الزبائن وكشوفات حساباتهم',
  },
  {
    key: 'customers_manage',
    label: 'إضافة زبائن وقبض دفعات ديون',
    group: 'الزبائن والديون',
    description: 'تسجيل زبون جديد وإصدار سندات قبض دفعات الديون',
  },

  // Suppliers
  {
    key: 'suppliers_view',
    label: 'عرض حسابات الموردين',
    group: 'الموردون والحسابات',
    description: 'الاطلاع على كشوفات حسابات الموردين والديون المستحقة لهم',
  },
  {
    key: 'suppliers_manage',
    label: 'إضافة موردين وسداد دفعات',
    group: 'الموردون والحسابات',
    description: 'تسجيل مورد جديد وإصدار سندات صرف للدفعات',
  },

  // Cash Treasury
  {
    key: 'cashbox_view',
    label: 'عرض رصيد وحركات الصندوق',
    group: 'الصندوق والخزينة',
    description: 'الاطلاع على رصيد النقد بالدرج والحركات المسجلة',
  },
  {
    key: 'cashbox_manage',
    label: 'مطابقة الصندوق والحركات المباشرة',
    group: 'الصندوق والخزينة',
    description: 'إجراء تسويات الجرد النقدي، إيداع رأس مال، ومسحوبات',
  },

  // Reports
  {
    key: 'reports_view',
    label: 'الاطلاع على التقارير المالية وصافي الأرباح',
    group: 'التقارير والأرباح',
    description: 'الاطلاع على الأرباح التشغيلية، هوامش الربح، وتصدير التقارير',
  },

  // Archive & Audit
  {
    key: 'archive_view',
    label: 'عرض الأرشيف الشهري والسنوي',
    group: 'الأرشيف والتدقيق',
    description: 'تصفح سجلات وفواتير الأشهر السابقة',
  },
  {
    key: 'audit_view',
    label: 'الاطلاع على سجل التدقيق والحركات',
    group: 'الأرشيف والتدقيق',
    description: 'مراجعة من قام بكل تعديل أو عملية مالية',
  },

  // System Settings & Users
  {
    key: 'settings_manage',
    label: 'إدارة إعدادات المتجر والنسخ الاحتياطي',
    group: 'النظام والإعدادات',
    description: 'تعديل بيانات المتجر، العملة، التصدير، واستعادة النسخ',
  },
  {
    key: 'users_manage',
    label: 'إدارة المستخدمين والأدوار والصلاحيات',
    group: 'النظام والإعدادات',
    description: 'إنشاء وتعديل مستخدمين وتحديد صلاحيات كل موظف',
  },
];

export const ROLE_NAMES_ARABIC: Record<UserRole, string> = {
  admin: 'مدير النظام (كامل الصلاحيات)',
  accountant: 'محاسب المتجر',
  salesperson: 'كاشير وبائع',
  warehouse: 'أمين المستودع',
  custom: 'دور مخصص',
};

export const ROLE_PRESET_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.key),

  accountant: [
    'sales_view',
    'sales_create',
    'purchases_view',
    'purchases_create',
    'inventory_view',
    'expenses_view',
    'expenses_manage',
    'customers_view',
    'customers_manage',
    'suppliers_view',
    'suppliers_manage',
    'cashbox_view',
    'cashbox_manage',
    'reports_view',
    'archive_view',
    'audit_view',
  ],

  salesperson: [
    'sales_view',
    'sales_create',
    'inventory_view',
    'customers_view',
    'customers_manage',
    'cashbox_view',
  ],

  warehouse: [
    'purchases_view',
    'purchases_create',
    'inventory_view',
    'inventory_manage',
    'suppliers_view',
  ],

  custom: ['sales_view', 'sales_create', 'inventory_view'],
};

export const WRITE_PERMISSION_KEYS: PermissionKey[] = [
  'sales_create',
  'sales_return',
  'purchases_create',
  'inventory_manage',
  'expenses_manage',
  'customers_manage',
  'suppliers_manage',
  'cashbox_manage',
  'settings_manage',
  'users_manage',
];

export function isUserBlocked(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  if (!user.isActive) return true;
  return user.accessStatus === 'banned' || user.accessStatus === 'rejected' || user.accessStatus === 'pending';
}

export function isUserRestricted(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return user.accessStatus === 'restricted';
}

export function canUserMutate(user: AppUser | null | undefined): boolean {
  if (!user || isUserBlocked(user)) return false;
  if (user.accessStatus === 'restricted' && user.isReadOnly) return false;
  return true;
}

/**
 * Checks whether a user possesses a specific permission
 */
export function hasPermission(
  user: AppUser | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user || !user.isActive) return false;
  if (
    user.accessStatus === 'banned' ||
    user.accessStatus === 'rejected' ||
    user.accessStatus === 'pending'
  ) {
    return false;
  }
  if (user.accessStatus === 'restricted') {
    if (user.isReadOnly && WRITE_PERMISSION_KEYS.includes(permission)) {
      return false;
    }
    return user.permissions.includes(permission);
  }
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
}

/**
 * Authenticate user credentials
 */
export function authenticateUser(
  users: AppUser[],
  usernameOrPhone: string,
  passwordAttempt: string
): AppUser | null {
  const cleanUsername = usernameOrPhone.trim().toLowerCase();
  const user = users.find(
    (u) =>
      (u.username.toLowerCase() === cleanUsername ||
        (u.email && u.email.toLowerCase() === cleanUsername)) &&
      u.password === passwordAttempt.trim()
  );

  if (!user || isUserBlocked(user)) return null;
  return user;
}

export interface LoginModerationResolution {
  outcome: 'approved' | 'restricted' | 'pending' | 'rejected' | 'banned' | 'not_found';
  matchedUser?: AppUser;
  matchedRequest?: LoginAccessRequest;
  message?: string;
}

/**
 * Resolves moderation status for a candidate user identified by uid, email, or name/username
 */
export function resolveUserModerationStatus(params: {
  users: AppUser[];
  accessRequests: LoginAccessRequest[];
  uid?: string;
  email?: string;
  identifier?: string;
}): LoginModerationResolution {
  const cleanUid = params.uid?.trim();
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanIdent = params.identifier?.trim().toLowerCase();

  const matchedUser = (params.users || []).find((u) => {
    if (cleanUid && u.id === cleanUid) return true;
    if (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail) return true;
    if (cleanEmail && u.username.toLowerCase() === cleanEmail.split('@')[0]) return true;
    if (
      cleanIdent &&
      (u.username.toLowerCase() === cleanIdent ||
        u.fullName.toLowerCase() === cleanIdent ||
        (u.email && u.email.toLowerCase() === cleanIdent))
    ) {
      return true;
    }
    return false;
  });

  if (matchedUser) {
    if (matchedUser.accessStatus === 'banned') {
      return {
        outcome: 'banned',
        matchedUser,
        message:
          matchedUser.restrictionNote ||
          'تم حظر هذا الحساب من قبل المدير العام. لا يمكنك الدخول للنظام.',
      };
    }
    if (matchedUser.accessStatus === 'rejected') {
      return {
        outcome: 'rejected',
        matchedUser,
        message:
          matchedUser.restrictionNote ||
          'تم رفض طلب دخول هذا المستخدم من قبل المدير العام.',
      };
    }
    if (!matchedUser.isActive) {
      return {
        outcome: 'banned',
        matchedUser,
        message: 'هذا الحساب معطل أو محظور من قبل المدير العام.',
      };
    }
    if (matchedUser.accessStatus === 'restricted') {
      return {
        outcome: 'restricted',
        matchedUser,
        message:
          matchedUser.restrictionNote ||
          'حسابك يعمل ضمن صلاحيات مقيدة حددها المدير العام.',
      };
    }
    return {
      outcome: 'approved',
      matchedUser,
    };
  }

  const matchedReq = [...(params.accessRequests || [])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .find((r) => {
      if (cleanUid && r.uid === cleanUid) return true;
      if (cleanEmail && r.email.toLowerCase() === cleanEmail) return true;
      if (
        cleanIdent &&
        (r.email.toLowerCase() === cleanIdent ||
          (r.username && r.username.toLowerCase() === cleanIdent) ||
          r.fullName.toLowerCase() === cleanIdent)
      ) {
        return true;
      }
      return false;
    });

  if (matchedReq) {
    if (matchedReq.status === 'banned') {
      return {
        outcome: 'banned',
        matchedRequest: matchedReq,
        message:
          matchedReq.decisionReason ||
          'تم حظر هذا المستخدم من قبل المدير العام.',
      };
    }
    if (matchedReq.status === 'rejected') {
      return {
        outcome: 'rejected',
        matchedRequest: matchedReq,
        message:
          matchedReq.decisionReason ||
          'تم رفض طلب الدخول من قبل المدير العام.',
      };
    }
    if (matchedReq.status === 'pending') {
      return {
        outcome: 'pending',
        matchedRequest: matchedReq,
        message: 'طلب تسجيل الدخول الخاص بك قيد المراجعة لدى المدير العام.',
      };
    }
    if (matchedReq.status === 'restricted') {
      return {
        outcome: 'restricted',
        matchedRequest: matchedReq,
        message:
          matchedReq.restrictionNote ||
          'تمت الموافقة بصلاحيات مقيدة من قبل المدير العام.',
      };
    }
    return {
      outcome: 'approved',
      matchedRequest: matchedReq,
    };
  }

  return { outcome: 'not_found' };
}
