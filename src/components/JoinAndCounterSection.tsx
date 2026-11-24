import React, { useState } from 'react';
import {
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Undo2,
  UserPlus,
} from 'lucide-react';
import type { Participant, ParticipantSession } from '../types/campaign';
import {
  formatArabicNumber,
  MAX_ACTIONS_PER_MINUTE,
  MIN_ACTION_INTERVAL_MS,
  validateParticipantInput,
} from '../utils/campaignLogic';

interface JoinAndCounterSectionProps {
  session: ParticipantSession | null;
  participant: Participant | null;
  participantRank: number | null;
  registrationOpen: boolean;
  isOffline: boolean;
  onJoin: (data: {
    displayName: string;
    city: string;
    isPublic: boolean;
  }) => Promise<void>;
  onIncrement: (delta: 1 | 10 | 33 | 100) => Promise<void>;
  onUndo: () => Promise<void>;
  onResetSessionCount: () => void;
  onRateLimitBlocked: (attemptedDelta: number, reason: string) => void;
  onSwitchAccount: () => void;
}

interface FloatingPulse {
  id: number;
  label: string;
}

export const JoinAndCounterSection: React.FC<JoinAndCounterSectionProps> = ({
  session,
  participant,
  participantRank,
  registrationOpen,
  isOffline,
  onJoin,
  onIncrement,
  onUndo,
  onResetSessionCount,
  onRateLimitBlocked,
  onSwitchAccount,
}) => {
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [joining, setJoining] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [joinSuccessMsg, setJoinSuccessMsg] = useState<string | null>(null);

  const [busyAction, setBusyAction] = useState(false);
  const [counterFeedback, setCounterFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pulses, setPulses] = useState<FloatingPulse[]>([]);
  const [recentActionTimestamps, setRecentActionTimestamps] = useState<number[]>([]);
  const [lastClickMs, setLastClickMs] = useState(0);
  const [confirmSwitch, setConfirmSwitch] = useState(false);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setJoinSuccessMsg(null);

    if (isOffline) {
      setFormError('لا يوجد اتصال بالإنترنت حالياً. يرجى التحقق من الشبكة والمحاولة مجدداً.');
      return;
    }

    if (!registrationOpen) {
      setFormError('التسجيل متوقف مؤقتاً من قبل إدارة الحملة.');
      return;
    }

    const validation = validateParticipantInput(displayName, city);
    if (!validation.valid) {
      setFormError(validation.error ?? 'بيانات غير صحيحة.');
      return;
    }

    setJoining(true);
    try {
      await onJoin({
        displayName: validation.displayName,
        city: validation.city,
        isPublic,
      });
      setJoinSuccessMsg('تم تسجيلك في حملة الاستغفار بنجاح، تقبّل الله منك.');
      setDisplayName('');
      setCity('');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'تعذر إتمام التسجيل، يرجى المحاولة لاحقاً.'
      );
    } finally {
      setJoining(false);
    }
  };

  const triggerPulse = (label: string) => {
    const id = Date.now() + Math.random();
    setPulses((prev) => [...prev.slice(-4), { id, label }]);
    setTimeout(() => {
      setPulses((prev) => prev.filter((p) => p.id !== id));
    }, 700);
  };

  const handleIncrementClick = async (delta: 1 | 10 | 33 | 100) => {
    if (busyAction) return;
    setCounterFeedback(null);
    setJoinSuccessMsg(null);

    if (isOffline) {
      setCounterFeedback({
        type: 'error',
        text: 'انقطع الاتصال بالإنترنت. يرجى إعادة الاتصال لحفظ استغفارك بأمان.',
      });
      return;
    }

    const now = Date.now();
    if (now - lastClickMs < MIN_ACTION_INTERVAL_MS) {
      setCounterFeedback({
        type: 'error',
        text: 'تمهل قليلاً في الذكر لحماية العداد من الضغطات المتسارعة.',
      });
      onRateLimitBlocked(delta, 'ضغطات متسارعة أقل من الحد الزمني المسموح');
      return;
    }

    const oneMinuteAgo = now - 60_000;
    const recentInMinute = recentActionTimestamps.filter((ts) => ts >= oneMinuteAgo);
    if (recentInMinute.length >= MAX_ACTIONS_PER_MINUTE) {
      setCounterFeedback({
        type: 'error',
        text: 'تم بلوغ الحد الأقصى للطلبات في الدقيقة الواحدة. يرجى الانتظار لحظات.',
      });
      onRateLimitBlocked(delta, 'تجاوز الحد الأقصى للطلبات في الدقيقة');
      return;
    }

    setLastClickMs(now);
    setRecentActionTimestamps([...recentInMinute, now]);
    setBusyAction(true);
    triggerPulse(`+${delta}`);

    try {
      await onIncrement(delta);
    } catch (err) {
      setCounterFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'تعذر حفظ الاستغفار في قاعدة البيانات.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const handleUndoClick = async () => {
    if (busyAction) return;
    setCounterFeedback(null);
    setJoinSuccessMsg(null);

    if (isOffline) {
      setCounterFeedback({
        type: 'error',
        text: 'لا يمكن التراجع أثناء انقطاع الإنترنت.',
      });
      return;
    }

    setBusyAction(true);
    try {
      await onUndo();
      setCounterFeedback({
        type: 'success',
        text: 'تم التراجع عن آخر ضغطة وتحديث الإحصائيات.',
      });
    } catch (err) {
      setCounterFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'لا توجد عملية أخيرة متاحة للتراجع.',
      });
    } finally {
      setBusyAction(false);
    }
  };

  const canUndo = Boolean(
    participant &&
      participant.lastLogDelta > 0 &&
      participant.lastLogId !== 'none' &&
      participant.lastLogId !== 'undone' &&
      participant.totalIstighfar >= participant.lastLogDelta
  );

  return (
    <section id="counter-workspace" className="py-14 sm:py-16 border-b border-[#E4DFD3]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {!session ? (
          <div className="bg-white border border-[#DED7C8] rounded-2xl p-6 sm:p-10">
            <div className="max-w-xl mx-auto">
              <div className="flex items-center gap-2 text-xs font-medium text-[#065F46] mb-2">
                <UserPlus className="w-4 h-4" />
                <span>تسجيل مشارك جديد</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1A2420] mb-2">
                سجّل اسمك وابدأ استغفارك
              </h2>
              <p className="text-sm sm:text-base text-[#53615B] mb-7 leading-relaxed">
                يتم إنشاء معرف رقمي فريد لحفظ عدد استغفاراتك في قاعدة البيانات بشكل دائم وآمن دون فقدانه عند تحديث الصفحة.
              </p>

              {!registrationOpen && (
                <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  التسجيل الجديد مغلق مؤقتاً من قبل المشرف، يمكنك متابعة إحصائيات الحملة المباشرة.
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleJoinSubmit} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="participant-name"
                    className="block text-sm font-semibold text-[#1A2420] mb-2"
                  >
                    الاسم أو الاسم المستعار <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="participant-name"
                    type="text"
                    required
                    maxLength={50}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="مثال: أبو عبدالله، أو سارة الحربي"
                    className="w-full px-4 py-3 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-[#1A2420] placeholder-[#8A948F] focus:outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="participant-city"
                    className="block text-sm font-semibold text-[#1A2420] mb-2"
                  >
                    المدينة <span className="text-xs font-normal text-[#6C7772]">(اختياري)</span>
                  </label>
                  <input
                    id="participant-city"
                    type="text"
                    maxLength={50}
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="مثال: مكة المكرمة، القاهرة، عمّان"
                    className="w-full px-4 py-3 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-[#1A2420] placeholder-[#8A948F] focus:outline-none focus:border-[#065F46] focus:ring-2 focus:ring-[#065F46]/15"
                  />
                </div>

                <div className="flex items-start gap-3 pt-1">
                  <input
                    id="participant-public"
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-[#C8BFB0] text-[#065F46] focus:ring-[#065F46]"
                  />
                  <label htmlFor="participant-public" className="text-sm text-[#45544E] cursor-pointer">
                    أوافق على عرض اسمي وإجمالي استغفاراتي في قائمة «المشاركون في حملة الاستغفار»
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={joining || !registrationOpen}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#065F46] text-white text-base font-semibold hover:bg-[#044734] disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {joining ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جارٍ تسجيل المشاركة...</span>
                    </>
                  ) : (
                    <span>انضم إلى حملة الاستغفار</span>
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#DED7C8] rounded-2xl overflow-hidden">
            {/* Participant Header Strip */}
            <div className="px-6 py-5 sm:px-8 border-b border-[#E8E2D6] bg-[#FAF8F3] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#065F46] mb-1">لوحة عداد الاستغفار الشخصي</p>
                <div className="flex flex-wrap items-center gap-2 text-lg font-bold text-[#1A2420]">
                  <span>{participant?.displayName ?? session.displayName}</span>
                  {(participant?.city || session.city) && (
                    <>
                      <span aria-hidden="true" className="text-[#B48327]">·</span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-[#53615B]">
                        <MapPin className="w-3.5 h-3.5 text-[#B48327]" />
                        {participant?.city || session.city}
                      </span>
                    </>
                  )}
                  {participantRank && (
                    <>
                      <span aria-hidden="true" className="text-[#B48327]">·</span>
                      <span className="text-sm font-semibold text-[#065F46] tabular-nums">
                        الترتيب #{participantRank}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!confirmSwitch ? (
                  <button
                    type="button"
                    onClick={() => setConfirmSwitch(true)}
                    className="px-3.5 py-2 rounded-lg border border-[#D8D1C2] text-xs font-medium text-[#45544E] hover:bg-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    تسجيل مشارك آخر
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmSwitch(false);
                        onSwitchAccount();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 cursor-pointer"
                    >
                      تأكيد الخروج
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSwitch(false)}
                      className="px-3 py-1.5 rounded-lg border border-[#D8D1C2] text-xs font-medium text-[#45544E] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 sm:p-10 text-center">
              {joinSuccessMsg && (
                <div
                  role="status"
                  className="mb-6 max-w-lg mx-auto rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{joinSuccessMsg}</span>
                </div>
              )}

              <p className="font-display text-3xl sm:text-4xl font-bold text-[#064E3B] mb-6">
                أستغفر الله العظيم وأتوب إليه
              </p>

              {/* Personal Stats Summary */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8 pb-6 border-b border-[#EFEAE0]">
                <div>
                  <p className="text-xs text-[#6C7772] mb-1">إجمالي استغفاراتك المحفوظة</p>
                  <p
                    data-testid="personal-total-count"
                    className="text-3xl sm:text-4xl font-bold tabular-nums text-[#1A2420]"
                  >
                    {formatArabicNumber(participant?.totalIstighfar ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#6C7772] mb-1">عداد الجلسة الحالية</p>
                  <p
                    data-testid="personal-session-count"
                    className="text-3xl sm:text-4xl font-bold tabular-nums text-[#065F46]"
                  >
                    {formatArabicNumber(session.sessionCount)}
                  </p>
                </div>
              </div>

              {/* Primary +1 Button with floating pulse */}
              <div className="relative inline-flex flex-col items-center mb-6">
                <div className="pointer-events-none absolute -top-6 inset-x-0 flex justify-center">
                  {pulses.map((p) => (
                    <span
                      key={p.id}
                      dir="ltr"
                      className="animate-float-dhikr font-bold text-lg text-[#B48327] tabular-nums"
                    >
                      {p.label}
                    </span>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => void handleIncrementClick(1)}
                  className="w-56 h-56 sm:w-64 sm:h-64 rounded-full bg-gradient-to-b from-[#066B4E] to-[#044734] text-white border-4 border-[#D4AF37]/70 shadow-sm hover:from-[#077A59] hover:to-[#05523C] active:scale-[0.97] transition-[transform,background-color] duration-150 flex flex-col items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
                >
                  <span className="font-display text-3xl sm:text-4xl font-bold">
                    + استغفر الله
                  </span>
                  <span className="text-xs text-[#E9C97B] font-medium">
                    اضغط لاحتساب استغفار
                  </span>
                </button>
              </div>

              {/* Quick Increment Options */}
              <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
                {([10, 33, 100] as const).map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    dir="ltr"
                    disabled={busyAction}
                    onClick={() => void handleIncrementClick(amount)}
                    className="min-w-[84px] px-5 py-3 rounded-xl border border-[#D4CCC0] bg-[#FAF8F3] text-[#1A2420] font-bold text-base tabular-nums hover:border-[#065F46] hover:bg-[#065F46] hover:text-white active:scale-[0.97] transition-all duration-150 cursor-pointer disabled:opacity-60"
                  >
                    +{amount}
                  </button>
                ))}
              </div>

              {/* Undo & Reset Session Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={busyAction || !canUndo}
                  onClick={() => void handleUndoClick()}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DED7C8] bg-white text-sm font-medium text-[#3A4943] hover:border-[#B48327] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Undo2 className="w-4 h-4 text-[#B48327]" />
                  <span>
                    تراجع عن آخر ضغطة
                    {canUndo && participant ? ` (-${participant.lastLogDelta})` : ''}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={session.sessionCount === 0}
                  onClick={onResetSessionCount}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DED7C8] bg-white text-sm font-medium text-[#3A4943] hover:border-[#065F46] disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4 text-[#065F46]" />
                  <span>تصفير عداد الجلسة</span>
                </button>
              </div>

              {counterFeedback && (
                <div
                  role={counterFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`mt-5 max-w-md mx-auto rounded-xl px-4 py-2.5 text-xs sm:text-sm ${
                    counterFeedback.type === 'error'
                      ? 'bg-red-50 border border-red-200 text-red-800'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                  }`}
                >
                  {counterFeedback.text}
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#6C7772]">
                <ShieldCheck className="w-4 h-4 text-[#065F46]" />
                <span>تُحفظ كل زيادة ذرياً ومباشرة في قاعدة البيانات مع حماية ضد الضغطات الآلية</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
