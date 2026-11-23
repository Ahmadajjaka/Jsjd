import React, { useState, useMemo } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Search,
  X,
  ShieldCheck,
  AlertTriangle,
  Ban,
  UserCheck,
  UserX,
  SlidersHorizontal,
  ShieldAlert,
  Clock,
  Lock,
} from 'lucide-react';
import {
  AppUser,
  LoginAccessRequest,
  PermissionKey,
  UserAccessStatus,
  UserRole,
} from '../types/accounting';
import {
  ALL_PERMISSIONS,
  ROLE_NAMES_ARABIC,
  ROLE_PRESET_PERMISSIONS,
} from '../utils/permissions';
import { getTodayDateString } from '../utils/accounting';

interface UsersManagementViewProps {
  users: AppUser[];
  currentUser: AppUser | null;
  accessRequests?: LoginAccessRequest[];
  onSaveUser: (user: AppUser) => void;
  onDeleteUser: (userId: string) => void;
  onApproveAccessRequest?: (
    requestId: string,
    assignedRole?: UserRole,
    assignedPermissions?: PermissionKey[]
  ) => void;
  onRejectAccessRequest?: (requestId: string, reason?: string) => void;
  onBanAccessRequest?: (requestId: string, reason?: string) => void;
  onRestrictAccessRequest?: (
    requestId: string,
    permissions: PermissionKey[],
    isReadOnly: boolean,
    restrictionNote: string
  ) => void;
  onDeleteAccessRequest?: (requestId: string) => void;
  onBanUser?: (userId: string, reason?: string) => void;
  onUnbanUser?: (userId: string) => void;
  onRestrictUser?: (
    userId: string,
    permissions: PermissionKey[],
    isReadOnly: boolean,
    restrictionNote: string
  ) => void;
}

export const UsersManagementView: React.FC<UsersManagementViewProps> = ({
  users,
  currentUser,
  accessRequests = [],
  onSaveUser,
  onDeleteUser,
  onApproveAccessRequest,
  onRejectAccessRequest,
  onBanAccessRequest,
  onRestrictAccessRequest,
  onDeleteAccessRequest,
  onBanUser,
  onUnbanUser,
  onRestrictUser,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    'pending' | 'all' | UserAccessStatus
  >('pending');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formError, setFormError] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<AppUser | null>(null);

  // Reason Prompt State for Reject / Ban
  const [moderationDialog, setModerationDialog] = useState<{
    action: 'reject_request' | 'ban_request' | 'ban_user';
    targetId: string;
    targetName: string;
    reason: string;
  } | null>(null);

  // Restriction Modal State (works for both AccessRequest and AppUser)
  const [restrictModal, setRestrictModal] = useState<{
    mode: 'request' | 'user';
    targetId: string;
    targetName: string;
    permissions: PermissionKey[];
    isReadOnly: boolean;
    note: string;
  } | null>(null);

  // User Add/Edit Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('salesperson');
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    ROLE_PRESET_PERMISSIONS.salesperson
  );
  const [isActive, setIsActive] = useState(true);
  const [accessStatus, setAccessStatus] = useState<UserAccessStatus>('approved');
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [restrictionNote, setRestrictionNote] = useState('');

  const permissionGroups = useMemo(() => {
    const groups: { [group: string]: typeof ALL_PERMISSIONS } = {};
    ALL_PERMISSIONS.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.roleNameArabic.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery]);

  const sortedRequests = useMemo(() => {
    return [...accessRequests].sort((a, b) => b.timestamp - a.timestamp);
  }, [accessRequests]);

  const filteredRequests = useMemo(() => {
    return sortedRequests.filter((req) => {
      if (requestStatusFilter !== 'all' && req.status !== requestStatusFilter) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        req.fullName.toLowerCase().includes(q) ||
        req.email.toLowerCase().includes(q) ||
        (req.username && req.username.toLowerCase().includes(q)) ||
        req.requestedRoleArabic.toLowerCase().includes(q)
      );
    });
  }, [sortedRequests, requestStatusFilter, searchQuery]);

  const pendingCount = useMemo(
    () => accessRequests.filter((r) => r.status === 'pending').length,
    [accessRequests]
  );

  const handleOpenAdd = () => {
    setFormError('');
    setEditingUser(null);
    setFullName('');
    setUsername('');
    setEmail('');
    setPassword('123456');
    setRole('salesperson');
    setPermissions(ROLE_PRESET_PERMISSIONS.salesperson);
    setIsActive(true);
    setAccessStatus('approved');
    setIsReadOnly(false);
    setRestrictionNote('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: AppUser) => {
    setFormError('');
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username);
    setEmail(user.email || '');
    setPassword(user.password);
    setRole(user.role);
    setPermissions(user.permissions);
    setIsActive(user.isActive);
    setAccessStatus(user.accessStatus || (user.isActive ? 'approved' : 'banned'));
    setIsReadOnly(Boolean(user.isReadOnly));
    setRestrictionNote(user.restrictionNote || '');
    setIsModalOpen(true);
  };

  const handleRoleChange = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole !== 'custom') {
      setPermissions(ROLE_PRESET_PERMISSIONS[newRole]);
    }
  };

  const handleTogglePermission = (key: PermissionKey) => {
    if (role === 'admin') return;
    if (permissions.includes(key)) {
      setPermissions(permissions.filter((p) => p !== key));
    } else {
      setPermissions([...permissions, key]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!fullName.trim() || !username.trim()) {
      setFormError('يرجى إدخال الاسم الكامل واسم المستخدم على الأقل.');
      return;
    }

    if (!editingUser && !password.trim()) {
      setFormError('يرجى إدخال كلمة مرور للمستخدم الجديد.');
      return;
    }

    const duplicate = users.find(
      (u) =>
        u.username.toLowerCase() === username.trim().toLowerCase() &&
        u.id !== editingUser?.id
    );
    if (duplicate) {
      setFormError('اسم المستخدم هذا مستخدم بالفعل، يرجى اختيار اسم مستخدم آخر.');
      return;
    }

    const finalAccessStatus: UserAccessStatus =
      role === 'admin' ? 'approved' : isActive ? accessStatus : 'banned';

    const userData: AppUser = {
      id: editingUser ? editingUser.id : `user-${Date.now()}`,
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      email: email.trim() || undefined,
      password: password.trim(),
      role,
      roleNameArabic:
        finalAccessStatus === 'restricted'
          ? 'مستخدم مقيد الصلاحيات'
          : ROLE_NAMES_ARABIC[role] || 'مستخدم',
      permissions: role === 'admin' ? ROLE_PRESET_PERMISSIONS.admin : permissions,
      isActive: finalAccessStatus === 'approved' || finalAccessStatus === 'restricted',
      accessStatus: finalAccessStatus,
      isReadOnly: finalAccessStatus === 'restricted' ? isReadOnly : false,
      restrictionNote: restrictionNote.trim() || undefined,
      avatarColor: editingUser?.avatarColor || 'bg-slate-800 text-amber-300',
      createdAt: editingUser ? editingUser.createdAt : getTodayDateString(),
      lastLogin: editingUser?.lastLogin,
    };

    onSaveUser(userData);
    setIsModalOpen(false);
  };

  const renderStatusBadge = (u: AppUser) => {
    const status: UserAccessStatus =
      u.accessStatus || (u.isActive ? 'approved' : 'banned');
    if (status === 'banned') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
          <Ban className="w-3 h-3" /> محظور
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
          <UserX className="w-3 h-3" /> مرفوض
        </span>
      );
    }
    if (status === 'restricted') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
          <Lock className="w-3 h-3" /> مقيد العمل {u.isReadOnly ? '(قراءة فقط)' : ''}
        </span>
      );
    }
    if (!u.isActive) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700">
          <XCircle className="w-3 h-3" /> معطل
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" /> نشط ومعتمد
      </span>
    );
  };

  const renderRequestStatusBadge = (status: UserAccessStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900">
            <Clock className="w-3 h-3" /> قيد الانتظار
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> مقبول ومفعل
          </span>
        );
      case 'restricted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
            <Lock className="w-3 h-3" /> مقيد العمل
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">
            <UserX className="w-3 h-3" /> مرفوض
          </span>
        );
      case 'banned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
            <Ban className="w-3 h-3" /> محظور
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            إدارة المستخدمين وطلبات تسجيل الدخول (RBAC)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            قبول أو رفض طلبات الدخول الواردة، حظر المستخدمين المخالفين، وتقييد الصلاحيات ووضع القراءة فقط
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors shadow-xs cursor-pointer"
        >
          <UserPlus className="w-4 h-4 text-amber-400" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Cloud Admin Banner */}
      <div className="p-4 bg-gradient-to-l from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span>المدير العام والمالك المعتمد للنظام</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-slate-950 font-black">
                Admin Guard
              </span>
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">
              أي مستخدم جديد يطلب تسجيل الدخول يتم إيقافه بانتظار موافقتك (قبول، تقييد العمل، رفض، أو حظر).
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-xl text-xs font-semibold text-slate-200 border border-white/10 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>بانتظار القرار: {pendingCount} طلب</span>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">إجمالي حسابات الموظفين</span>
          <span className="text-xl font-bold font-mono text-slate-900">{users.length}</span>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl shadow-xs">
          <span className="text-xs text-amber-800 block mb-1">طلبات دخول قيد الانتظار</span>
          <span className="text-xl font-black font-mono text-amber-900">{pendingCount}</span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">حسابات مقيدة أو محظورة</span>
          <span className="text-xl font-bold font-mono text-rose-700">
            {
              users.filter(
                (u) =>
                  u.accessStatus === 'restricted' ||
                  u.accessStatus === 'banned' ||
                  !u.isActive
              ).length
            }
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <span className="text-xs text-slate-500 block mb-1">المستخدم الحالي المسجل</span>
          <span className="text-sm font-bold text-slate-900 block truncate">
            {currentUser?.fullName} ({currentUser?.roleNameArabic})
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
        <input
          type="text"
          placeholder="بحث في طلبات الدخول أو قائمة المستخدمين..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-xs pr-9 pl-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
        />
      </div>

      {/* Incoming Access Requests Moderation Queue */}
      <section
        id="access-requests-moderation-section"
        className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden"
      >
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="text-sm font-black text-slate-900">
                طلبات تسجيل الدخول الواردة والرقابة على الدخول
              </h3>
              <p className="text-[11px] text-slate-500">
                إدارة قبول الطلبات، رفضها، حظر الحساب، أو فرض قيود على صلاحيات العمل
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
            {(
              [
                ['pending', `قيد الانتظار (${pendingCount})`],
                ['all', `الكل (${accessRequests.length})`],
                ['approved', 'مقبول'],
                ['restricted', 'مقيد العمل'],
                ['rejected', 'مرفوض'],
                ['banned', 'محظور'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setRequestStatusFilter(key)}
                className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                  requestStatusFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredRequests.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              لا توجد طلبات تسجيل دخول مطابقة للتصنيف المحدد حالياً.
            </div>
          ) : (
            filteredRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{req.fullName}</span>
                    {renderRequestStatusBadge(req.status)}
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                      الدور المطلوب: {req.requestedRoleArabic}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <span className="font-mono text-slate-700">{req.email || req.username}</span>
                    <span>
                      {req.date} · {req.time}
                    </span>
                    {req.reason && <span>السبب: {req.reason}</span>}
                    {req.deviceInfo && <span className="text-slate-400">{req.deviceInfo}</span>}
                  </div>

                  {(req.restrictionNote || req.decisionReason) && (
                    <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg inline-block">
                      قرار الإدارة: {req.restrictionNote || req.decisionReason}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs shrink-0">
                  {req.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() => onApproveAccessRequest?.(req.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>قبول</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setRestrictModal({
                        mode: 'request',
                        targetId: req.id,
                        targetName: req.fullName,
                        permissions:
                          req.assignedPermissions && req.assignedPermissions.length > 0
                            ? req.assignedPermissions
                            : ['sales_view', 'inventory_view', 'customers_view'],
                        isReadOnly: req.isReadOnly ?? true,
                        note: req.restrictionNote || 'حساب مقيد العمل من المدير العام',
                      })
                    }
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>تقييد العمل</span>
                  </button>

                  {req.status !== 'rejected' && (
                    <button
                      type="button"
                      onClick={() =>
                        setModerationDialog({
                          action: 'reject_request',
                          targetId: req.id,
                          targetName: req.fullName,
                          reason: 'تم رفض طلب الدخول لعدم التصريح حالياً.',
                        })
                      }
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>رفض</span>
                    </button>
                  )}

                  {req.status !== 'banned' && (
                    <button
                      type="button"
                      onClick={() =>
                        setModerationDialog({
                          action: 'ban_request',
                          targetId: req.id,
                          targetName: req.fullName,
                          reason: 'تم حظر هذا الحساب نهائياً من الدخول إلى النظام.',
                        })
                      }
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>حظر</span>
                    </button>
                  )}

                  {onDeleteAccessRequest && (
                    <button
                      type="button"
                      onClick={() => onDeleteAccessRequest(req.id)}
                      title="حذف سجل الطلب"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-black text-slate-900">حسابات المستخدمين المسجلة</h3>
          </div>
          <span className="text-[11px] text-slate-500 font-semibold">
            {filteredUsers.length} حساب
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">اسم الموظف الكامل</th>
                <th className="py-3 px-4">المعرف / البريد</th>
                <th className="py-3 px-4">الدور الوظيفي</th>
                <th className="py-3 px-4 text-center">الصلاحيات</th>
                <th className="py-3 px-4 text-center">حالة الدخول والرقابة</th>
                <th className="py-3 px-4">آخر تسجيل دخول</th>
                <th className="py-3 px-4 text-center">إجراءات الإدارة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => {
                const isBanned = u.accessStatus === 'banned' || !u.isActive;
                return (
                  <tr key={u.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            u.avatarColor || 'bg-slate-800 text-white'
                          }`}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span>{u.fullName}</span>
                            {u.id === currentUser?.id && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                                أنت
                              </span>
                            )}
                          </div>
                          {u.restrictionNote && (
                            <span className="text-[10px] text-amber-700 block font-normal">
                              {u.restrictionNote}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-700">
                      <div>{u.username}</div>
                      {u.email && (
                        <div className="text-[10px] text-slate-400 font-normal">{u.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-purple-100 text-purple-900'
                            : u.role === 'accountant'
                            ? 'bg-emerald-100 text-emerald-900'
                            : u.role === 'salesperson'
                            ? 'bg-blue-100 text-blue-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {u.roleNameArabic}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono">
                      {u.role === 'admin' ? 'كاملة (20)' : `${u.permissions.length} من 20`}
                    </td>
                    <td className="py-3 px-4 text-center">{renderStatusBadge(u)}</td>
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">
                      {u.lastLogin || 'لم يسجل بعد'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {u.role !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setRestrictModal({
                                  mode: 'user',
                                  targetId: u.id,
                                  targetName: u.fullName,
                                  permissions: u.permissions,
                                  isReadOnly: Boolean(u.isReadOnly),
                                  note: u.restrictionNote || 'تم تقييد صلاحيات الحساب من المدير',
                                })
                              }
                              title="تقييد عمل المستخدم"
                              className="px-2 py-1 rounded-md bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] cursor-pointer"
                            >
                              تقييد
                            </button>

                            {isBanned ? (
                              <button
                                type="button"
                                onClick={() => onUnbanUser?.(u.id)}
                                title="رفع الحظر وتفعيل الحساب"
                                className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] cursor-pointer"
                              >
                                رفع الحظر
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setModerationDialog({
                                    action: 'ban_user',
                                    targetId: u.id,
                                    targetName: u.fullName,
                                    reason: 'تم حظر المستخدم ومنعه من الدخول للنظام.',
                                  })
                                }
                                title="حظر المستخدم"
                                className="px-2 py-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] cursor-pointer"
                              >
                                حظر
                              </button>
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenEdit(u)}
                          title="تعديل المستخدم والصلاحيات"
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>

                        {u.role !== 'admin' && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteUser(u)}
                            title="حذف المستخدم"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Delete User Confirmation Modal */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-right">
            <div className="flex items-center gap-2.5 text-rose-700">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h4 className="text-sm font-black">تأكيد حذف حساب المستخدم</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من حذف حساب <strong>«{confirmDeleteUser.fullName}»</strong> نهائياً؟
            </p>
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteUser(confirmDeleteUser.id);
                  setConfirmDeleteUser(null);
                }}
                className="px-4 py-2 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Ban Reason Modal */}
      {moderationDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-right">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-rose-600" />
                <h4 className="text-sm font-black text-slate-900">
                  {moderationDialog.action === 'reject_request'
                    ? `رفض طلب دخول: ${moderationDialog.targetName}`
                    : `حظر المستخدم: ${moderationDialog.targetName}`}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setModerationDialog(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs space-y-1.5">
              <label className="font-bold text-slate-700 block">
                سبب القرار (يظهر للمستخدم عند محاولة الدخول):
              </label>
              <textarea
                rows={3}
                value={moderationDialog.reason}
                onChange={(e) =>
                  setModerationDialog({ ...moderationDialog, reason: e.target.value })
                }
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setModerationDialog(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  const r = moderationDialog.reason.trim();
                  if (moderationDialog.action === 'reject_request') {
                    onRejectAccessRequest?.(moderationDialog.targetId, r);
                  } else if (moderationDialog.action === 'ban_request') {
                    onBanAccessRequest?.(moderationDialog.targetId, r);
                  } else {
                    onBanUser?.(moderationDialog.targetId, r);
                  }
                  setModerationDialog(null);
                }}
                className="px-4 py-2 font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl cursor-pointer"
              >
                {moderationDialog.action === 'reject_request' ? 'تأكيد الرفض' : 'تأكيد الحظر الفوري'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restrict Permissions Modal */}
      {restrictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl border border-slate-200 space-y-4 text-right my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-amber-600" />
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    تقييد عمل المستخدم: {restrictModal.targetName}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    حدد الصلاحيات المسموحة فقط أو فعّل وضع القراءة والعرض فقط
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestrictModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs max-h-[70vh] overflow-y-auto pr-1">
              <label className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 cursor-pointer font-bold text-amber-950">
                <input
                  type="checkbox"
                  checked={restrictModal.isReadOnly}
                  onChange={(e) =>
                    setRestrictModal({ ...restrictModal, isReadOnly: e.target.checked })
                  }
                  className="w-4 h-4 rounded-sm"
                />
                <span>وضع القراءة فقط (يمنع الإضافة والحذف والتعديل والترجيع تلقائياً)</span>
              </label>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ملاحظة التقييد للمستخدم:
                </label>
                <input
                  type="text"
                  value={restrictModal.note}
                  onChange={(e) => setRestrictModal({ ...restrictModal, note: e.target.value })}
                  className="w-full p-2.5 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="space-y-3">
                {Object.entries(permissionGroups).map(([groupName, groupPerms]) => (
                  <div
                    key={groupName}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2"
                  >
                    <span className="font-bold text-slate-900 block border-b border-slate-200 pb-1">
                      {groupName}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {groupPerms.map((perm) => {
                        const checked = restrictModal.permissions.includes(perm.key);
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer ${
                              checked
                                ? 'bg-white border-slate-300'
                                : 'bg-slate-100/60 border-transparent opacity-65'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setRestrictModal({
                                  ...restrictModal,
                                  permissions: checked
                                    ? restrictModal.permissions.filter((p) => p !== perm.key)
                                    : [...restrictModal.permissions, perm.key],
                                })
                              }
                              className="w-4 h-4 mt-0.5"
                            />
                            <div>
                              <span className="font-bold text-slate-900 block">{perm.label}</span>
                              <span className="text-[10px] text-slate-500 block">
                                {perm.description}
                              </span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={() => setRestrictModal(null)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  if (restrictModal.mode === 'request') {
                    onRestrictAccessRequest?.(
                      restrictModal.targetId,
                      restrictModal.permissions,
                      restrictModal.isReadOnly,
                      restrictModal.note.trim() || 'حساب مقيد العمل من المدير العام'
                    );
                  } else {
                    onRestrictUser?.(
                      restrictModal.targetId,
                      restrictModal.permissions,
                      restrictModal.isReadOnly,
                      restrictModal.note.trim() || 'حساب مقيد العمل من المدير العام'
                    );
                  }
                  setRestrictModal(null);
                }}
                className="px-5 py-2 font-black text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl cursor-pointer"
              >
                اعتماد التقييد وحفظ الصلاحيات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold">
                  {editingUser
                    ? `تعديل المستخدم: ${editingUser.fullName}`
                    : 'إضافة مستخدم وتعيين الصلاحيات'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-5 text-xs max-h-[80vh] overflow-y-auto"
            >
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    الاسم الكامل للموظف *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أحمد عبد الله..."
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    اسم المستخدم للدخول (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ahmed..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    البريد الإلكتروني (اختياري)
                  </label>
                  <input
                    type="email"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    كلمة المرور {editingUser ? '(اختياري عند التعديل)' : '*'}
                  </label>
                  <input
                    type="text"
                    required={!editingUser}
                    placeholder="كلمة مرور الدخول..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-mono focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    الدور الوظيفي (نموذج مسبق للصلاحيات)
                  </label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  >
                    <option value="admin">مدير النظام (كامل الصلاحيات)</option>
                    <option value="accountant">محاسب المتجر</option>
                    <option value="salesperson">كاشير وبائع</option>
                    <option value="warehouse">أمين المستودع</option>
                    <option value="custom">تحديد مخصص</option>
                  </select>
                </div>

                {role !== 'admin' && (
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      حالة الحساب والرقابة
                    </label>
                    <select
                      value={accessStatus}
                      onChange={(e) => {
                        const val = e.target.value as UserAccessStatus;
                        setAccessStatus(val);
                        setIsActive(val === 'approved' || val === 'restricted');
                      }}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                    >
                      <option value="approved">معتمد ونشط</option>
                      <option value="restricted">مقيد العمل (صلاحيات محدودة)</option>
                      <option value="banned">محظور نهائياً</option>
                    </select>
                  </div>
                )}
              </div>

              {role !== 'admin' && accessStatus === 'restricted' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={isReadOnly}
                      onChange={(e) => setIsReadOnly(e.target.checked)}
                      className="w-4 h-4 rounded-sm"
                    />
                    <span>تقييد الحساب في وضع القراءة والعرض فقط</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ملاحظة أو سبب التقييد..."
                    value={restrictionNote}
                    onChange={(e) => setRestrictionNote(e.target.value)}
                    className="w-full p-2 bg-white border border-amber-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setIsActive(next);
                      if (!next) setAccessStatus('banned');
                      else if (accessStatus === 'banned') setAccessStatus('approved');
                    }}
                    className="w-4 h-4 rounded-sm text-slate-900 focus:ring-slate-900"
                  />
                  <span>الحساب نشط ومسموح له بتسجيل الدخول</span>
                </label>
              </div>

              {/* Granular Permissions Matrix */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-black text-slate-900 text-xs block">
                    مصفوفة الصلاحيات الممنوحة للمستخدم
                  </span>
                  {role === 'admin' && (
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      مدير النظام يمتلك كافة الصلاحيات تلقائياً
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {Object.entries(permissionGroups).map(([groupName, groupPerms]) => (
                    <div
                      key={groupName}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2"
                    >
                      <span className="font-bold text-slate-900 block text-xs border-b border-slate-200/80 pb-1.5">
                        {groupName}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {groupPerms.map((perm) => {
                          const isGranted =
                            role === 'admin' || permissions.includes(perm.key);
                          return (
                            <label
                              key={perm.key}
                              className={`flex items-start gap-2 p-2 rounded-xl border transition-colors cursor-pointer ${
                                isGranted
                                  ? 'bg-white border-slate-300'
                                  : 'bg-slate-100/60 border-transparent opacity-60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                disabled={role === 'admin'}
                                checked={isGranted}
                                onChange={() => handleTogglePermission(perm.key)}
                                className="w-4 h-4 mt-0.5 rounded-sm text-slate-900 focus:ring-slate-900"
                              />
                              <div>
                                <span className="font-bold text-slate-900 block">
                                  {perm.label}
                                </span>
                                <span className="text-[10px] text-slate-500 block leading-tight">
                                  {perm.description}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-700 hover:bg-slate-100 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
                >
                  حفظ بيانات المستخدم
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
