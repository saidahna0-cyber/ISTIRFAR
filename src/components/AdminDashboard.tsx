import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  LogOut,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import {
  checkIsAdminUser,
  deleteParticipantAdmin,
  subscribeAllParticipantsAdmin,
  subscribeIstighfarLogsAdmin,
  subscribeSuspiciousEventsAdmin,
  updateCampaignSettingsAdmin,
} from '../services/campaignService';
import type {
  CampaignSettings,
  CampaignStats,
  IstighfarLog,
  Participant,
  SuspiciousEvent,
} from '../types/campaign';
import {
  computeAdminAnalytics,
  formatArabicDate,
  formatArabicNumber,
  getRiyadhDateKeys,
  sanitizeText,
} from '../utils/campaignLogic';

interface AdminDashboardProps {
  stats: CampaignStats;
  settings: CampaignSettings;
  onExitAdmin: () => void;
}

type AdminTab = 'overview' | 'participants' | 'suspicious' | 'settings';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  stats,
  settings,
  onExitAdmin,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [logs, setLogs] = useState<IstighfarLog[]>([]);
  const [suspiciousEvents, setSuspiciousEvents] = useState<SuspiciousEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Settings form state
  const [dailyMessage, setDailyMessage] = useState(settings.dailyMessage);
  const [campaignGoal, setCampaignGoal] = useState(String(settings.campaignGoal));
  const [announcement, setAnnouncement] = useState(settings.announcement);
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(settings.isRegistrationOpen);
  const [savingSettings, setSavingSettings] = useState(false);
  const [adminFeedback, setAdminFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    setDailyMessage(settings.dailyMessage);
    setCampaignGoal(String(settings.campaignGoal));
    setAnnouncement(settings.announcement);
    setIsRegistrationOpen(settings.isRegistrationOpen);
  }, [settings]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }
      if (!firebaseUser.emailVerified) {
        setIsAdmin(false);
        setAuthLoading(false);
        return;
      }
      const allowed = await checkIsAdminUser(firebaseUser.uid, firebaseUser.email);
      setIsAdmin(allowed);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Attach admin-only Firestore listeners strictly after admin verification succeeds
  useEffect(() => {
    if (!isAdmin) return;
    const unsubParticipants = subscribeAllParticipantsAdmin(setParticipants);
    const unsubLogs = subscribeIstighfarLogsAdmin(setLogs);
    const unsubSuspicious = subscribeSuspiciousEventsAdmin(setSuspiciousEvents);
    return () => {
      unsubParticipants();
      unsubLogs();
      unsubSuspicious();
    };
  }, [isAdmin]);

  const handleLogin = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'تعذر تسجيل الدخول بحساب Google.'
      );
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const keys = useMemo(() => getRiyadhDateKeys(), []);
  const analytics = useMemo(() => computeAdminAnalytics(logs, keys), [logs, keys]);

  const filteredParticipants = useMemo(() => {
    const q = sanitizeText(searchQuery).toLowerCase();
    const list = q
      ? participants.filter(
          (p) =>
            p.displayName.toLowerCase().includes(q) ||
            (p.city && p.city.toLowerCase().includes(q)) ||
            p.id.toLowerCase().includes(q)
        )
      : participants;
    return [...list].sort((a, b) => b.totalIstighfar - a.totalIstighfar);
  }, [participants, searchQuery]);

  const handleDeleteParticipant = async (p: Participant) => {
    setDeletingId(p.id);
    setAdminFeedback(null);
    try {
      await deleteParticipantAdmin(p);
      setConfirmDeleteId(null);
      setAdminFeedback({
        type: 'success',
        text: `تم حذف المشارك «${p.displayName}» وتحديث الإحصائيات.`,
      });
    } catch (err) {
      setAdminFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حذف المشارك.',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFeedback(null);
    if (dailyMessage.trim().length < 3) {
      setAdminFeedback({
        type: 'error',
        text: 'يرجى كتابة رسالة الحملة (3 أحرف على الأقل).',
      });
      return;
    }

    setSavingSettings(true);
    try {
      await updateCampaignSettingsAdmin(
        {
          dailyMessage,
          campaignGoal: Number(campaignGoal) || 1_000_000,
          isRegistrationOpen,
          announcement,
        },
        user?.email ?? 'admin'
      );
      setAdminFeedback({
        type: 'success',
        text: 'تم حفظ إعدادات الحملة ورسالة اليوم بنجاح.',
      });
    } catch (err) {
      setAdminFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-[#065F46]">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">جارٍ التحقق من صلاحيات الإدارة...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#DED7C8] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-[#FAF8F3] border border-[#E4DFD3] flex items-center justify-center text-[#065F46]">
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A2420] mb-2">
            لوحة تحكم المسؤول
          </h1>
          <p className="text-sm text-[#53615B] leading-relaxed mb-6">
            هذه المنطقة محمية ومخصصة لمشرفي حملة الاستغفار فقط. يرجى تسجيل الدخول بحساب المسؤول المصرح له عبر Firebase Authentication.
          </p>

          {authError && (
            <div role="alert" className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
              {authError}
            </div>
          )}

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleLogin()}
              className="w-full py-3 px-5 rounded-xl bg-[#065F46] text-white text-sm font-semibold hover:bg-[#044734] transition-colors cursor-pointer"
            >
              تسجيل الدخول بحساب Google للمسؤول
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2.5 px-5 rounded-xl border border-[#D4CCC0] text-sm font-medium text-[#45544E] hover:bg-[#FAF8F3] transition-colors cursor-pointer"
            >
              العودة إلى صفحة الحملة
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-[#DED7C8] rounded-2xl p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center text-red-700">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A2420] mb-2">
            غير مصرح لك بالوصول
          </h1>
          <p className="text-sm text-[#53615B] leading-relaxed mb-6">
            الحساب المسجل ({user.email}) لا يملك صلاحيات إدارة حملة الاستغفار.
          </p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="w-full py-3 px-5 rounded-xl bg-[#065F46] text-white text-sm font-semibold hover:bg-[#044734] cursor-pointer"
            >
              تسجيل الخروج
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2.5 px-5 rounded-xl border border-[#D4CCC0] text-sm font-medium text-[#45544E] hover:bg-[#FAF8F3] cursor-pointer"
            >
              العودة إلى صفحة الحملة
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <section className="py-10 sm:py-12 min-h-[80vh]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Top Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 mb-6 border-b border-[#E4DFD3]">
          <div>
            <p className="text-xs font-semibold text-[#065F46] mb-1">
              الإدارة والإشراف · {user.email}
            </p>
            <h1 className="font-display text-3xl font-bold text-[#1A2420]">
              لوحة تحكم حملة الاستغفار
            </h1>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#D4CCC0] bg-white text-sm font-medium text-[#3A4943] hover:border-red-300 hover:text-red-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EFEAE0] rounded-xl mb-8 w-fit">
          {(
            [
              { id: 'overview', label: 'الإحصائيات العامة' },
              { id: 'participants', label: `المشاركون (${participants.length})` },
              {
                id: 'suspicious',
                label: `العمليات المشبوهة (${suspiciousEvents.length + analytics.rapidBursts.length})`,
              },
              { id: 'settings', label: 'الرسالة والإعدادات' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-[#064E3B] shadow-xs'
                  : 'text-[#53615B] hover:text-[#1A2420]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {adminFeedback && (
          <div
            role={adminFeedback.type === 'error' ? 'alert' : 'status'}
            className={`mb-6 rounded-xl px-4 py-3 text-sm flex items-center gap-2 ${
              adminFeedback.type === 'error'
                ? 'bg-red-50 border border-red-200 text-red-800'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{adminFeedback.text}</span>
          </div>
        )}

        {/* Tab 1: Overview & Daily/Weekly/Monthly Statistics */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-[#DED7C8] rounded-2xl p-5">
                <p className="text-xs text-[#6C7772] mb-1">إجمالي الاستغفارات</p>
                <p className="text-2xl font-bold text-[#064E3B] tabular-nums">
                  {formatArabicNumber(stats.totalIstighfar)}
                </p>
              </div>
              <div className="bg-white border border-[#DED7C8] rounded-2xl p-5">
                <p className="text-xs text-[#6C7772] mb-1">إجمالي المشاركين</p>
                <p className="text-2xl font-bold text-[#1A2420] tabular-nums">
                  {formatArabicNumber(stats.totalParticipants)}
                </p>
              </div>
              <div className="bg-white border border-[#DED7C8] rounded-2xl p-5">
                <p className="text-xs text-[#6C7772] mb-1">استغفارات اليوم</p>
                <p className="text-2xl font-bold text-[#065F46] tabular-nums">
                  {formatArabicNumber(Math.max(stats.todayIstighfar, analytics.todayFromLogs))}
                </p>
              </div>
              <div className="bg-white border border-[#DED7C8] rounded-2xl p-5">
                <p className="text-xs text-[#6C7772] mb-1">استغفارات الأسبوع</p>
                <p className="text-2xl font-bold text-[#065F46] tabular-nums">
                  {formatArabicNumber(Math.max(stats.weeklyIstighfar, analytics.weekFromLogs))}
                </p>
              </div>
              <div className="bg-white border border-[#DED7C8] rounded-2xl p-5">
                <p className="text-xs text-[#6C7772] mb-1">استغفارات الشهر</p>
                <p className="text-2xl font-bold text-[#B48327] tabular-nums">
                  {formatArabicNumber(Math.max(stats.monthlyIstighfar, analytics.monthFromLogs))}
                </p>
              </div>
            </div>

            {/* Recent Activity Logs */}
            <div className="bg-white border border-[#DED7C8] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#EFEAE0] flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1A2420]">أحدث العمليات المسجلة في السجل</h2>
                <span className="text-xs text-[#6C7772] tabular-nums">
                  آخر {Math.min(logs.length, 20)} عملية · عمليات التراجع: {analytics.undoCount}
                </span>
              </div>
              {logs.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#6C7772]">
                  لا توجد عمليات مسجلة في السجل بعد.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-right">
                    <thead className="bg-[#FAF8F3] text-xs text-[#6C7772] border-b border-[#EFEAE0]">
                      <tr>
                        <th className="py-3 px-4 font-semibold">معرف المشارك</th>
                        <th className="py-3 px-4 font-semibold">نوع العملية</th>
                        <th className="py-3 px-4 font-semibold">العدد</th>
                        <th className="py-3 px-4 font-semibold">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F2EDE4]">
                      {logs.slice(0, 20).map((log) => (
                        <tr key={log.id} className="hover:bg-[#FAF8F3]/60">
                          <td className="py-3 px-4 font-mono text-xs text-[#45544E]">
                            {log.participantId}
                          </td>
                          <td className="py-3 px-4">
                            {log.actionType === 'undo' ? (
                              <span className="text-amber-700 font-medium">تراجع</span>
                            ) : (
                              <span className="text-[#065F46] font-medium">إضافة استغفار</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold tabular-nums">
                            {log.count > 0 ? `+${log.count}` : log.count}
                          </td>
                          <td className="py-3 px-4 text-xs text-[#6C7772] tabular-nums">
                            {log.date}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Manage All Participants */}
        {activeTab === 'participants' && (
          <div className="bg-white border border-[#DED7C8] rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#FAF8F3]/60">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1A2420]">
                <Users className="w-4 h-4 text-[#065F46]" />
                <span>جميع المشاركين ({participants.length})</span>
              </div>
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-[#7D8782] absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث بالاسم، المدينة، أو المعرف..."
                  className="w-full pr-9 pl-4 py-2 rounded-xl border border-[#D4CCC0] bg-white text-sm text-[#1A2420]"
                />
              </div>
            </div>

            {filteredParticipants.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#6C7772]">
                لا يوجد مشاركون مطابقون لنتائج البحث.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-right">
                  <thead className="bg-[#FAF8F3] text-xs text-[#6C7772] border-b border-[#EFEAE0]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">الاسم</th>
                      <th className="py-3 px-4 font-semibold">المدينة</th>
                      <th className="py-3 px-4 font-semibold">الاستغفارات</th>
                      <th className="py-3 px-4 font-semibold">الظهور</th>
                      <th className="py-3 px-4 font-semibold">تاريخ الانضمام</th>
                      <th className="py-3 px-4 font-semibold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F2EDE4]">
                    {filteredParticipants.map((p) => (
                      <tr key={p.id} className="hover:bg-[#FAF8F3]/60">
                        <td className="py-3 px-4 font-semibold text-[#1A2420]">
                          {p.displayName}
                        </td>
                        <td className="py-3 px-4 text-[#53615B]">{p.city || '—'}</td>
                        <td className="py-3 px-4 font-bold text-[#065F46] tabular-nums">
                          {formatArabicNumber(p.totalIstighfar)}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#6C7772]">
                          {p.isPublic ? 'عام' : 'مخفي'}
                        </td>
                        <td className="py-3 px-4 text-xs text-[#6C7772]">
                          {formatArabicDate(p.createdAtMs)}
                        </td>
                        <td className="py-3 px-4">
                          {confirmDeleteId === p.id ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={deletingId === p.id}
                                onClick={() => void handleDeleteParticipant(p)}
                                className="px-2.5 py-1 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                              >
                                {deletingId === p.id ? '...' : 'تأكيد الحذف'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1 rounded-lg border border-[#D4CCC0] text-xs cursor-pointer"
                              >
                                إلغاء
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              aria-label={`حذف المشارك ${p.displayName}`}
                              onClick={() => setConfirmDeleteId(p.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Suspicious Activity Review */}
        {activeTab === 'suspicious' && (
          <div className="space-y-6">
            {analytics.rapidBursts.length > 0 && (
              <div className="bg-white border border-amber-300 rounded-2xl p-6">
                <h2 className="text-base font-bold text-amber-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  <span>تنبيهات النشاط المتسارع (تحليل السجلات)</span>
                </h2>
                <div className="divide-y divide-[#F2EDE4]">
                  {analytics.rapidBursts.map((b) => (
                    <div key={b.participantId} className="py-3 flex items-center justify-between text-sm">
                      <span className="font-mono text-xs text-[#1A2420]">{b.participantId}</span>
                      <span className="text-amber-800 font-medium tabular-nums">
                        {b.countInWindow} عملية خلال 10 ثوانٍ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white border border-[#DED7C8] rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-[#EFEAE0]">
                <h2 className="text-base font-bold text-[#1A2420]">
                  سجل المحاولات المرفوضة والمشبوهة ({suspiciousEvents.length})
                </h2>
              </div>
              {suspiciousEvents.length === 0 ? (
                <div className="p-10 text-center text-sm text-[#6C7772]">
                  لا توجد محاولات مشبوهة مسجلة حالياً.
                </div>
              ) : (
                <div className="divide-y divide-[#F2EDE4]">
                  {suspiciousEvents.map((ev) => (
                    <div key={ev.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                      <div>
                        <p className="font-semibold text-[#1A2420]">{ev.reason}</p>
                        <p className="text-xs text-[#6C7772] mt-0.5">
                          المعرف: <span className="font-mono">{ev.participantId}</span> · القيمة المحاولة: {ev.attemptedDelta}
                        </p>
                      </div>
                      <span className="text-xs text-[#6C7772]">
                        {formatArabicDate(ev.createdAtMs)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Campaign Settings & Message */}
        {activeTab === 'settings' && (
          <div className="bg-white border border-[#DED7C8] rounded-2xl p-6 sm:p-8 max-w-2xl">
            <div className="flex items-center gap-2 text-base font-bold text-[#1A2420] mb-6 pb-3 border-b border-[#EFEAE0]">
              <Settings className="w-4 h-4 text-[#065F46]" />
              <span>تعديل رسالة الحملة وإعدادات الموقع</span>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label htmlFor="admin-daily-msg" className="block text-sm font-semibold text-[#1A2420] mb-2">
                  رسالة اليوم
                </label>
                <textarea
                  id="admin-daily-msg"
                  rows={3}
                  maxLength={500}
                  value={dailyMessage}
                  onChange={(e) => setDailyMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-sm text-[#1A2420]"
                />
              </div>

              <div>
                <label htmlFor="admin-announcement" className="block text-sm font-semibold text-[#1A2420] mb-2">
                  شريط التنبيه العلوي (اختياري)
                </label>
                <input
                  id="admin-announcement"
                  type="text"
                  maxLength={300}
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="اتركه فارغاً لإخفاء الشريط العلوي"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-sm text-[#1A2420]"
                />
              </div>

              <div>
                <label htmlFor="admin-goal" className="block text-sm font-semibold text-[#1A2420] mb-2">
                  الهدف الإجمالي للمرحلة الحالية
                </label>
                <input
                  id="admin-goal"
                  type="number"
                  min={1000}
                  max={1000000000}
                  value={campaignGoal}
                  onChange={(e) => setCampaignGoal(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-sm text-[#1A2420] tabular-nums"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <input
                  id="admin-reg-open"
                  type="checkbox"
                  checked={isRegistrationOpen}
                  onChange={(e) => setIsRegistrationOpen(e.target.checked)}
                  className="h-4 w-4 rounded border-[#C8BFB0] text-[#065F46]"
                />
                <label htmlFor="admin-reg-open" className="text-sm font-medium text-[#1A2420] cursor-pointer">
                  السماح بتسجيل مشاركين جدد في الحملة
                </label>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-3 rounded-xl bg-[#065F46] text-white text-sm font-semibold hover:bg-[#044734] disabled:opacity-60 transition-colors cursor-pointer"
              >
                {savingSettings ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
};
