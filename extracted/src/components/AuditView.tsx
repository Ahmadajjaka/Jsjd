import React, { useState, useMemo, useEffect } from 'react';
import {
  FileClock,
  Search,
  Filter,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Laptop,
  Lock,
  User,
  Camera,
  Download,
  X,
} from 'lucide-react';
import { AuditLog, LoginAttempt } from '../types/accounting';
import {
  getAllSecuritySnapshots,
  SecuritySnapshotRecord,
} from '../services/localDatabase';

interface AuditViewProps {
  auditLogs: AuditLog[];
  loginAttempts?: LoginAttempt[];
}

export const AuditView: React.FC<AuditViewProps> = ({ auditLogs, loginAttempts = [] }) => {
  const [activeMode, setActiveMode] = useState<'financial' | 'security'>('security');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [securityStatusFilter, setSecurityStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [snapshotsMap, setSnapshotsMap] = useState<Record<string, SecuritySnapshotRecord>>({});
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    attempt: LoginAttempt;
    imageDataUrl: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    getAllSecuritySnapshots()
      .then((map) => {
        if (active) setSnapshotsMap(map);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [loginAttempts]);

  const handleDownloadSnapshot = (imageDataUrl: string, attempt: LoginAttempt) => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = `security_snapshot_${attempt.date}_${attempt.time.replace(/:/g, '-')}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Filtered Financial Logs
  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((log) => {
        if (entityFilter !== 'all' && log.entityType !== entityFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            log.action.toLowerCase().includes(q) ||
            log.details.toLowerCase().includes(q) ||
            log.date.includes(q) ||
            log.entityId.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .reverse();
  }, [auditLogs, entityFilter, searchQuery]);

  // Filtered Security / Login Attempts
  const filteredAttempts = useMemo(() => {
    return loginAttempts
      .filter((att) => {
        if (securityStatusFilter === 'success' && att.status !== 'success') return false;
        if (securityStatusFilter === 'failed' && att.status === 'success') return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            (att.userName || '').toLowerCase().includes(q) ||
            (att.email || '').toLowerCase().includes(q) ||
            (att.details || '').toLowerCase().includes(q) ||
            (att.deviceInfo || '').toLowerCase().includes(q) ||
            (att.errorMessage || '').toLowerCase().includes(q) ||
            att.date.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [loginAttempts, securityStatusFilter, searchQuery]);

  const securityStats = useMemo(() => {
    const total = loginAttempts.length;
    const success = loginAttempts.filter((a) => a.status === 'success').length;
    const failed = total - success;
    return { total, success, failed };
  }, [loginAttempts]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Mode Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900">
            {activeMode === 'security'
              ? 'مراقبة محاولات تسجيل الدخول والأمان (Login Monitor)'
              : 'سجل الحركات والتدقيق المالي (Audit Log)'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeMode === 'security'
              ? 'توثيق فوري ومباشر لكافة محاولات الدخول (كلمة المرور، قفل الشاشة PIN، وGoogle) مع لقطات الكاميرا الأمنية'
              : 'توثيق كامل لكافة التعديلات، الإلغاءات، تسويات الجرد، والحركات المالية الحساسة'}
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveMode('security')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'security'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>محاولات تسجيل الدخول</span>
            {loginAttempts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-400 text-slate-950 font-black">
                {loginAttempts.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMode('financial')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeMode === 'financial'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-700 hover:text-slate-900'
            }`}
          >
            <FileClock className="w-3.5 h-3.5 text-sky-400" />
            <span>سجل الحركات المالية</span>
          </button>
        </div>
      </div>

      {activeMode === 'security' ? (
        <>
          {/* Security Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-500 block">إجمالي محاولات الدخول</span>
                <span className="text-2xl font-black font-mono text-slate-900">{securityStats.total}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                <Lock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-emerald-700 block">المحاولات الناجحة</span>
                <span className="text-2xl font-black font-mono text-emerald-800">{securityStats.success}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-rose-700 block">فاشلة / ملغاة / محظورة</span>
                <span className="text-2xl font-black font-mono text-rose-800">{securityStats.failed}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث بالاسم، البريد الإلكتروني، الجهاز، أو التاريخ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={securityStatusFilter}
                onChange={(e: any) => setSecurityStatusFilter(e.target.value)}
                className="text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
              >
                <option value="all">كافة النتائج ({securityStats.total})</option>
                <option value="success">الناجحة فقط ({securityStats.success})</option>
                <option value="failed">الفاشلة والملغاة ({securityStats.failed})</option>
              </select>
            </div>
          </div>

          {/* Login Attempts Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">الحالة والنتيجة</th>
                    <th className="py-3 px-4">لقطة الأمان</th>
                    <th className="py-3 px-4">المستخدم والبريد</th>
                    <th className="py-3 px-4">الصفة المطلوبة</th>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">الجهاز والمتصفح</th>
                    <th className="py-3 px-4">التفاصيل وملاحظات الخطأ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttempts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        لا توجد محاولات تسجيل دخول مسجلة حالياً.
                      </td>
                    </tr>
                  ) : (
                    filteredAttempts.map((att) => {
                      const snapshot = att.snapshotId ? snapshotsMap[att.snapshotId] : undefined;
                      const isSuccess = att.status === 'success';
                      const isCancelled = att.status === 'cancelled';
                      const isBlocked = att.status === 'blocked';

                      return (
                        <tr key={att.id} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                isSuccess
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isCancelled
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isSuccess ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : isCancelled ? (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              )}
                              <span>{att.statusArabic}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {snapshot?.imageDataUrl ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewSnapshot({
                                    attempt: att,
                                    imageDataUrl: snapshot.imageDataUrl,
                                  })
                                }
                                title="اضغط لتكبير وتنزيل لقطة الأمان"
                                className="group relative inline-flex items-center gap-1.5 p-1 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                              >
                                <img
                                  src={snapshot.imageDataUrl}
                                  alt={`لقطة ${att.userName}`}
                                  className="w-12 h-9 object-cover rounded-lg border border-slate-300"
                                />
                                <span className="text-[10px] font-bold text-amber-900 px-1">
                                  معاينة
                                </span>
                              </button>
                            ) : att.snapshotStatus ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[10px] font-semibold">
                                <Camera className="w-3 h-3" />
                                <span>
                                  {att.snapshotStatus === 'denied'
                                    ? 'إذن الكاميرا مرفوض'
                                    : att.snapshotStatus === 'no_camera'
                                    ? 'بدون كاميرا'
                                    : att.snapshotStatus === 'captured'
                                    ? 'محفوظة محلياً'
                                    : 'لم تُلتقط'}
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{att.userName}</div>
                            {att.email && att.email !== 'غير محدد / مجهول' && (
                              <div className="text-[10px] text-slate-500 font-mono">{att.email}</div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold">
                              {att.attemptedRole === 'admin' ? 'المدير العام' : 'بائع المتجر'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                            {att.date} · {att.time}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Laptop className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{att.deviceInfo || 'غير محدد'}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-700 min-w-[190px]">
                            {att.errorMessage ? (
                              <span className="inline-block font-semibold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-md leading-relaxed whitespace-normal">
                                {att.errorMessage}
                              </span>
                            ) : (
                              <span className="leading-relaxed whitespace-normal">{att.details}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Financial Filter and Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              <input
                type="text"
                placeholder="بحث بالإجراء، التفاصيل، أو التاريخ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pr-9 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-slate-900 focus:outline-hidden font-medium"
              >
                <option value="all">جميع السجلات</option>
                <option value="sale">فواتير ومبيعات</option>
                <option value="purchase">مشتريات وتوريد</option>
                <option value="product">مخزون وبضائع</option>
                <option value="cash">صندوق وحركات مالية</option>
                <option value="customer">زبائن وديون</option>
                <option value="supplier">موردون ودفعات</option>
                <option value="security">أمان وتسجيل دخول</option>
                <option value="settings">إعدادات النظام</option>
              </select>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">التاريخ والوقت</th>
                    <th className="py-3 px-4">الإجراء والعملية</th>
                    <th className="py-3 px-4">القسم</th>
                    <th className="py-3 px-4">التفاصيل الكاملة للحركة</th>
                    <th className="py-3 px-4 font-mono">المرجع</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        لا توجد سجلات تدقيق مطابقة.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">
                          {log.date} · {log.time}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.entityType === 'security'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {log.entityType === 'security' ? 'أمان ودخول' : log.entityType}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">
                          {log.details}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                          {log.entityId}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Snapshot Full Preview Modal */}
      {previewSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-black">لقطة الأمان عند إدخال كلمة السر</span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSnapshot(null)}
                aria-label="إغلاق المعاينة"
                className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <img
                src={previewSnapshot.imageDataUrl}
                alt={`لقطة الأمان - ${previewSnapshot.attempt.userName}`}
                className="w-full rounded-xl border border-slate-200 bg-slate-950 object-contain max-h-72"
              />
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="font-bold text-slate-900">
                  {previewSnapshot.attempt.userName} — {previewSnapshot.attempt.statusArabic}
                </div>
                <div className="text-slate-500 font-mono">
                  {previewSnapshot.attempt.date} · {previewSnapshot.attempt.time}
                </div>
                <div className="text-slate-600">{previewSnapshot.attempt.details}</div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleDownloadSnapshot(
                      previewSnapshot.imageDataUrl,
                      previewSnapshot.attempt
                    )
                  }
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل اللقطة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewSnapshot(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
