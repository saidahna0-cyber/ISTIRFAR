import React, { useState } from 'react';
import { BookOpenCheck, Check, Copy, Share2 } from 'lucide-react';
import type { CampaignSettings, CampaignStats } from '../types/campaign';
import { formatArabicNumber } from '../utils/campaignLogic';

interface HeroStatsProps {
  stats: CampaignStats;
  statsLoading: boolean;
  settings: CampaignSettings;
  hasSession: boolean;
  onJumpToJoin: () => void;
}

export const HeroStats: React.FC<HeroStatsProps> = ({
  stats,
  statsLoading,
  settings,
  hasSession,
  onJumpToJoin,
}) => {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const goal = Math.max(1000, settings.campaignGoal || 1_000_000);
  const progressPct = Math.min(100, Math.round((stats.totalIstighfar / goal) * 100));

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback ignored
    }
  };

  const whatsappShareUrl = `https://wa.me/?text=${encodeURIComponent(
    `شاركنا الأجر في «حملة الاستغفار»\nأستغفر الله العظيم وأتوب إليه\nسجّل اسمك وابدأ استغفارك عبر الرابط:\n${window.location.origin}`
  )}`;

  return (
    <section id="stats" className="relative overflow-hidden border-b border-[#E4DFD3]">
      <div className="islamic-lattice-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 lg:pt-14 lg:pb-16">
          {/* Announcement banner from Admin if set */}
          {settings.announcement && (
            <div className="mb-8 rounded-xl border border-[#D4AF37]/45 bg-[#FFFDF7] px-4 py-3 text-center text-sm font-medium text-[#6B4E12]">
              {settings.announcement}
            </div>
          )}

          {/* Split Hero Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch mb-10">
            {/* Right column (RTL primary): Basmala, Dhikr Headline, CTA */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="font-display text-xl sm:text-2xl text-[#065F46] mb-3">
                بسم الله الرحمن الرحيم
              </p>

              <h1
                className="font-display font-bold text-[#1A2420] leading-[1.35] mb-5"
                style={{
                  fontSize: 'clamp(2.25rem, 4.2vw, 3.65rem)',
                  textWrap: 'balance',
                }}
              >
                أستغفر الله العظيم وأتوب إليه
              </h1>

              <p className="text-base sm:text-lg text-[#45544E] leading-relaxed max-w-2xl mb-8">
                شاركنا الأجر في حملة الاستغفار، وساهم في نشر ذكر الله. سجّل اسمك وابدأ استغفارك.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onJumpToJoin}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-[#065F46] text-white text-base font-semibold hover:bg-[#044734] transition-colors cursor-pointer whitespace-nowrap shrink-0 text-center"
                >
                  {hasSession ? 'الانتقال إلى عدّادي الشخصي' : 'انضم إلى حملة الاستغفار'}
                </button>

                <a
                  href={whatsappShareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white border border-[#D8D1C2] text-[#1A2420] text-sm font-medium hover:border-[#065F46] hover:text-[#065F46] transition-colors whitespace-nowrap shrink-0"
                >
                  <Share2 className="w-4 h-4 text-[#065F46]" />
                  <span>مشاركة عبر واتساب</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-white border border-[#D8D1C2] text-[#1A2420] text-sm font-medium hover:border-[#B48327] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-[#065F46]" />
                      <span>تم نسخ الرابط</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-[#B48327]" />
                      <span>نسخ رابط الموقع</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Left column (RTL): Architectural Hero Image + Message of the Day */}
            <div className="lg:col-span-5 flex flex-col">
              <div className="relative flex-1 min-h-[260px] sm:min-h-[300px] rounded-2xl overflow-hidden border border-[#DED7C8] bg-[#064E3B] flex flex-col justify-end">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_islamic_courtyard_1795525777532.jpg"
                    alt="فناء إسلامي هادئ بأقواس حجرية ونقوش هندسية"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 islamic-lattice-emerald bg-gradient-to-br from-[#064E3B] to-[#043225]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#03261C]/92 via-[#03261C]/45 to-transparent" />
                <div className="relative z-10 p-6 text-white">
                  <div className="flex items-center gap-2 text-xs font-medium text-[#E9C97B] mb-2">
                    <BookOpenCheck className="w-4 h-4" />
                    <span>رسالة اليوم</span>
                  </div>
                  <p className="text-sm sm:text-base leading-relaxed text-[#FAF8F3]">
                    {settings.dailyMessage}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Monumental Global Counter + 4-Column Live KPI Strip */}
          <div className="rounded-2xl bg-[#053F2F] text-white border border-[#B48327]/40 p-6 sm:p-8 islamic-lattice-emerald">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-7 border-b border-white/15">
              <div>
                <p className="text-sm text-[#E9C97B] font-medium mb-2">
                  العداد الجماعي المباشر للحملة
                </p>
                <div
                  data-testid="global-total-counter"
                  className="text-4xl sm:text-6xl font-bold tracking-tight tabular-nums text-white"
                >
                  {statsLoading ? '...' : formatArabicNumber(stats.totalIstighfar)}
                </div>
                <p className="text-sm text-white/80 mt-2">
                  استغفاراً مسجلاً من عموم المشاركين في قاعدة البيانات
                </p>
              </div>

              <div className="w-full lg:w-80">
                <div className="flex items-center justify-between text-xs text-white/80 mb-2">
                  <span>هدف المرحلة الحالية</span>
                  <span className="tabular-nums font-semibold text-[#E9C97B]">
                    {formatArabicNumber(stats.totalIstighfar)} / {formatArabicNumber(goal)} ({progressPct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-[#D4AF37] transition-[width] duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-6">
              <div>
                <p className="text-xs text-white/75 mb-1">إجمالي الاستغفارات</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums text-white">
                  {statsLoading ? '—' : formatArabicNumber(stats.totalIstighfar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">عدد المشاركين</p>
                <p
                  data-testid="global-participants-count"
                  className="text-2xl sm:text-3xl font-bold tabular-nums text-white"
                >
                  {statsLoading ? '—' : formatArabicNumber(stats.totalParticipants)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">استغفارات اليوم</p>
                <p
                  data-testid="global-today-count"
                  className="text-2xl sm:text-3xl font-bold tabular-nums text-[#E9C97B]"
                >
                  {statsLoading ? '—' : formatArabicNumber(stats.todayIstighfar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-white/75 mb-1">استغفارات هذا الأسبوع</p>
                <p
                  data-testid="global-weekly-count"
                  className="text-2xl sm:text-3xl font-bold tabular-nums text-[#E9C97B]"
                >
                  {statsLoading ? '—' : formatArabicNumber(stats.weeklyIstighfar)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
