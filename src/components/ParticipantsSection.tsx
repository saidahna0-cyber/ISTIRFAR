import React, { useMemo, useState } from 'react';
import { Award, ChevronLeft, ChevronRight, Clock, MapPin, Search, Users } from 'lucide-react';
import type { Participant, SortMode } from '../types/campaign';
import {
  assignParticipantRanks,
  filterSortPaginateParticipants,
  formatArabicDate,
  formatArabicNumber,
} from '../utils/campaignLogic';

interface ParticipantsSectionProps {
  participants: Participant[];
  loading: boolean;
  currentParticipantId?: string;
}

const PAGE_SIZE = 10;

export const ParticipantsSection: React.FC<ParticipantsSectionProps> = ({
  participants,
  loading,
  currentParticipantId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('most');
  const [page, setPage] = useState(1);

  const rankedAll = useMemo(() => assignParticipantRanks(participants), [participants]);
  const topThree = useMemo(() => rankedAll.slice(0, 3), [rankedAll]);
  const latestThree = useMemo(
    () => [...rankedAll].sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, 3),
    [rankedAll]
  );

  const paginated = useMemo(
    () =>
      filterSortPaginateParticipants(participants, {
        searchQuery,
        sortMode,
        page,
        pageSize: PAGE_SIZE,
      }),
    [participants, searchQuery, sortMode, page]
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setPage(1);
  };

  const handleSortChange = (mode: SortMode) => {
    setSortMode(mode);
    setPage(1);
  };

  return (
    <section id="participants" className="py-14 sm:py-16 border-b border-[#E4DFD3]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold text-[#065F46] mb-1.5">السجل الجماعي المباشر</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#1A2420]">
              المشاركون في حملة الاستغفار
            </h2>
          </div>
          <p className="text-sm text-[#53615B] max-w-md">
            تُحدَّث القائمة والأرقام تلقائياً وفورياً مع كل استغفار يضيفه المشاركون دون الحاجة لإعادة تحميل الصفحة.
          </p>
        </div>

        {/* Top Contributors & Latest Joiners highlights */}
        {!loading && participants.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Top Contributors */}
            <div className="bg-white border border-[#DED7C8] rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1A2420] mb-4 pb-3 border-b border-[#EFEAE0]">
                <Award className="w-4 h-4 text-[#B48327]" />
                <span>أكثر المشاركين مساهمة</span>
              </div>
              <div className="divide-y divide-[#F2EDE4]">
                {topThree.map((p) => (
                  <div
                    key={p.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-7 h-7 rounded-lg bg-[#FAF8F3] border border-[#E4DFD3] text-xs font-bold text-[#065F46] flex items-center justify-center tabular-nums shrink-0">
                        {p.rank}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[#1A2420] truncate">
                          {p.displayName}
                        </p>
                        {p.city && (
                          <p className="text-xs text-[#6C7772] truncate">{p.city}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-base font-bold text-[#065F46] tabular-nums shrink-0">
                      {formatArabicNumber(p.totalIstighfar)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Joiners */}
            <div className="bg-white border border-[#DED7C8] rounded-2xl p-6">
              <div className="flex items-center gap-2 text-sm font-bold text-[#1A2420] mb-4 pb-3 border-b border-[#EFEAE0]">
                <Clock className="w-4 h-4 text-[#065F46]" />
                <span>آخر المشاركين انضماماً</span>
              </div>
              <div className="divide-y divide-[#F2EDE4]">
                {latestThree.map((p) => (
                  <div
                    key={p.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#1A2420] truncate">
                        {p.displayName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[#6C7772]">
                        {p.city && <span>{p.city}</span>}
                        {p.city && <span aria-hidden="true">·</span>}
                        <span>{formatArabicDate(p.createdAtMs)}</span>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-[#3A4943] tabular-nums shrink-0">
                      {formatArabicNumber(p.totalIstighfar)} استغفار
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search & Sort Controls */}
        <div className="bg-white border border-[#DED7C8] rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-[#FAF8F3]/60">
            <div className="relative flex-1 max-w-md">
              <label htmlFor="participant-search" className="sr-only">
                البحث عن اسم مشارك أو مدينة
              </label>
              <Search className="w-4 h-4 text-[#7D8782] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="participant-search"
                type="search"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="ابحث باسم المشارك أو المدينة..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-[#D4CCC0] bg-white text-sm text-[#1A2420] placeholder-[#8A948F] focus:outline-none focus:border-[#065F46]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#EFEAE0] rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => handleSortChange('most')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  sortMode === 'most'
                    ? 'bg-white text-[#064E3B] shadow-xs'
                    : 'text-[#53615B] hover:text-[#1A2420]'
                }`}
              >
                الأكثر استغفاراً
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('newest')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  sortMode === 'newest'
                    ? 'bg-white text-[#064E3B] shadow-xs'
                    : 'text-[#53615B] hover:text-[#1A2420]'
                }`}
              >
                الأحدث انضماماً
              </button>
            </div>
          </div>

          {/* Participants List */}
          {loading ? (
            <div className="divide-y divide-[#F2EDE4]">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#EFEAE0]" />
                    <div className="space-y-2">
                      <div className="w-36 h-3.5 rounded bg-[#EFEAE0]" />
                      <div className="w-24 h-2.5 rounded bg-[#F5F1E9]" />
                    </div>
                  </div>
                  <div className="w-20 h-4 rounded bg-[#EFEAE0]" />
                </div>
              ))}
            </div>
          ) : paginated.items.length === 0 ? (
            <div className="py-14 px-6 text-center">
              <Users className="w-8 h-8 text-[#9AA39E] mx-auto mb-3" />
              <p className="text-base font-semibold text-[#1A2420] mb-1">
                {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'كن أول المنضمين إلى حملة الاستغفار'}
              </p>
              <p className="text-sm text-[#6C7772]">
                {searchQuery
                  ? 'جرّب البحث باسم مختلف أو امسح مربع البحث.'
                  : 'سجّل اسمك في النموذج أعلاه ليظهر اسمك وإحصائياتك هنا مباشرة.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F2EDE4]">
              {paginated.items.map((p) => {
                const isMe = currentParticipantId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors ${
                      isMe ? 'bg-[#F3FAF6]' : 'hover:bg-[#FAF8F3]/70'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold tabular-nums shrink-0 border ${
                          p.rank <= 3
                            ? 'bg-[#FFF9EB] border-[#D4AF37]/60 text-[#8B6215]'
                            : 'bg-[#FAF8F3] border-[#E4DFD3] text-[#45544E]'
                        }`}
                      >
                        #{p.rank}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-base text-[#1A2420] truncate">
                            {p.displayName}
                          </h3>
                          {isMe && (
                            <span className="text-xs font-semibold text-[#065F46]">
                              (أنت)
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#6C7772] mt-0.5">
                          {p.city && (
                            <>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#B48327]" />
                                {p.city}
                              </span>
                              <span aria-hidden="true">·</span>
                            </>
                          )}
                          <span>تاريخ الانضمام: {formatArabicDate(p.createdAtMs)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-baseline gap-1.5 sm:text-left pr-13 sm:pr-0 shrink-0">
                      <span className="text-xl font-bold text-[#065F46] tabular-nums">
                        {formatArabicNumber(p.totalIstighfar)}
                      </span>
                      <span className="text-xs text-[#6C7772]">استغفار</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {paginated.totalPages > 1 && (
            <div className="px-5 py-4 border-t border-[#EFEAE0] bg-[#FAF8F3]/60 flex items-center justify-between gap-4">
              <p className="text-xs text-[#53615B] tabular-nums">
                صفحة {paginated.currentPage} من {paginated.totalPages} · إجمالي {paginated.totalFiltered} مشارك
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={paginated.currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="الصفحة السابقة"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D4CCC0] bg-white text-xs font-medium text-[#1A2420] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span>السابق</span>
                </button>
                <button
                  type="button"
                  disabled={paginated.currentPage >= paginated.totalPages}
                  onClick={() => setPage((p) => Math.min(paginated.totalPages, p + 1))}
                  aria-label="الصفحة التالية"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D4CCC0] bg-white text-xs font-medium text-[#1A2420] disabled:opacity-45 cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
