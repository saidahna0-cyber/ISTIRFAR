import type {
  CampaignStats,
  IstighfarLog,
  Participant,
  SortMode,
} from '../types/campaign';

// Blueprint-synchronized validation constants (matches firebase-blueprint.json & firestore.rules)
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 50;
export const CITY_MAX = 50;
export const ALLOWED_INCREMENT_DELTAS = [1, 10, 33, 100] as const;
export const ALLOWED_ANY_DELTAS = [1, 10, 33, 100, -1, -10, -33, -100] as const;
export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const MIN_ACTION_INTERVAL_MS = 320;
export const MAX_ACTIONS_PER_MINUTE = 120;

export interface ValidationResult {
  valid: boolean;
  displayName: string;
  city: string;
  error?: string;
}

export function sanitizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function validateParticipantInput(
  rawName: string,
  rawCity: string
): ValidationResult {
  const displayName = sanitizeText(rawName);
  const city = sanitizeText(rawCity);

  if (!displayName) {
    return {
      valid: false,
      displayName,
      city,
      error: 'يرجى إدخال الاسم أو الاسم المستعار للمشاركة في الحملة.',
    };
  }

  if (displayName.length < DISPLAY_NAME_MIN) {
    return {
      valid: false,
      displayName,
      city,
      error: `يجب أن يتكون الاسم من حرفين على الأقل.`,
    };
  }

  if (displayName.length > DISPLAY_NAME_MAX) {
    return {
      valid: false,
      displayName,
      city,
      error: `يجب ألا يتجاوز الاسم ${DISPLAY_NAME_MAX} حرفاً.`,
    };
  }

  if (/[<>]/.test(displayName) || /[<>]/.test(city)) {
    return {
      valid: false,
      displayName,
      city,
      error: 'يرجى تجنب الرموز غير المسموح بها في الحقول.',
    };
  }

  if (city.length > CITY_MAX) {
    return {
      valid: false,
      displayName,
      city,
      error: `يجب ألا يتجاوز اسم المدينة ${CITY_MAX} حرفاً.`,
    };
  }

  return { valid: true, displayName, city };
}

export function validateIstighfarDelta(
  delta: number,
  currentTotal: number,
  lastLogDelta: number,
  lastLogId: string
): { valid: boolean; error?: string } {
  if (!Number.isInteger(delta)) {
    return { valid: false, error: 'قيمة غير صالحة للاستغفار.' };
  }

  if (delta > 0) {
    if (!(ALLOWED_INCREMENT_DELTAS as readonly number[]).includes(delta)) {
      return { valid: false, error: 'مقدار الزيادة غير مسموح به.' };
    }
    if (currentTotal + delta > 1_000_000_000) {
      return { valid: false, error: 'تم بلوغ الحد الأقصى للعداد.' };
    }
    return { valid: true };
  }

  if (delta < 0) {
    if (lastLogDelta <= 0 || lastLogId === 'none' || lastLogId === 'undone') {
      return { valid: false, error: 'لا توجد ضغطة أخيرة متاحة للتراجع.' };
    }
    if (delta !== -lastLogDelta) {
      return { valid: false, error: 'قيمة التراجع لا تطابق آخر عملية مسجلة.' };
    }
    if (currentTotal + delta < 0) {
      return { valid: false, error: 'لا يمكن أن يكون رصيد الاستغفار أقل من الصفر.' };
    }
    return { valid: true };
  }

  return { valid: false, error: 'قيمة الصفر غير صالحة.' };
}

export interface DateKeys {
  todayDate: string; // YYYY-MM-DD
  weekKey: string;   // YYYY-Www
  monthKey: string;  // YYYY-MM
}

/**
 * Computes canonical YYYY-MM-DD, ISO YYYY-Www, and YYYY-MM keys in UTC+3 (Asia/Riyadh)
 * so all participants share consistent day/week/month rollover boundaries.
 */
export function getRiyadhDateKeys(now: Date = new Date()): DateKeys {
  const riyadhMs = now.getTime() + 3 * 60 * 60 * 1000;
  const riyadhDate = new Date(riyadhMs);

  const year = riyadhDate.getUTCFullYear();
  const month = String(riyadhDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(riyadhDate.getUTCDate()).padStart(2, '0');

  const todayDate = `${year}-${month}-${day}`;
  const monthKey = `${year}-${month}`;

  // ISO week calculation on UTC fields of Riyadh-shifted date
  const temp = new Date(Date.UTC(year, riyadhDate.getUTCMonth(), riyadhDate.getUTCDate()));
  const dayNum = temp.getUTCDay() || 7;
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum);
  const isoYear = temp.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNo = Math.ceil(((temp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekKey = `${isoYear}-W${String(weekNo).padStart(2, '0')}`;

  return { todayDate, weekKey, monthKey };
}

export function computeStatsRollover(
  current: CampaignStats,
  delta: number,
  keys: DateKeys
): Omit<CampaignStats, 'totalParticipants' | 'lastLogId' | 'lastUpdatedMs'> {
  const effectiveTodayDate = keys.todayDate >= current.todayDate ? keys.todayDate : current.todayDate;
  const effectiveWeekKey = keys.weekKey >= current.weekKey ? keys.weekKey : current.weekKey;
  const effectiveMonthKey = keys.monthKey >= current.monthKey ? keys.monthKey : current.monthKey;

  const totalIstighfar = Math.max(0, current.totalIstighfar + delta);

  const todayIstighfar =
    effectiveTodayDate === current.todayDate
      ? Math.max(0, current.todayIstighfar + delta)
      : delta > 0
        ? delta
        : 0;

  const weeklyIstighfar =
    effectiveWeekKey === current.weekKey
      ? Math.max(0, current.weeklyIstighfar + delta)
      : delta > 0
        ? delta
        : 0;

  const monthlyIstighfar =
    effectiveMonthKey === current.monthKey
      ? Math.max(0, current.monthlyIstighfar + delta)
      : delta > 0
        ? delta
        : 0;

  return {
    totalIstighfar,
    todayIstighfar,
    todayDate: effectiveTodayDate,
    weeklyIstighfar,
    weekKey: effectiveWeekKey,
    monthlyIstighfar,
    monthKey: effectiveMonthKey,
  };
}

export interface RankedParticipant extends Participant {
  rank: number;
}

export interface PaginatedParticipantsResult {
  items: RankedParticipant[];
  totalFiltered: number;
  totalPages: number;
  currentPage: number;
}

export function assignParticipantRanks(participants: Participant[]): RankedParticipant[] {
  const byRank = [...participants].sort((a, b) => {
    if (b.totalIstighfar !== a.totalIstighfar) {
      return b.totalIstighfar - a.totalIstighfar;
    }
    return a.createdAtMs - b.createdAtMs;
  });

  return byRank.map((p, idx) => ({
    ...p,
    rank: idx + 1,
  }));
}

export function filterSortPaginateParticipants(
  participants: Participant[],
  options: {
    searchQuery: string;
    sortMode: SortMode;
    page: number;
    pageSize: number;
  }
): PaginatedParticipantsResult {
  const ranked = assignParticipantRanks(participants);
  const query = sanitizeText(options.searchQuery).toLowerCase();

  const filtered = query
    ? ranked.filter(
        (p) =>
          p.displayName.toLowerCase().includes(query) ||
          (p.city && p.city.toLowerCase().includes(query))
      )
    : ranked;

  const sorted =
    options.sortMode === 'newest'
      ? [...filtered].sort((a, b) => b.createdAtMs - a.createdAtMs)
      : filtered;

  const totalFiltered = sorted.length;
  const pageSize = Math.max(1, options.pageSize);
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const currentPage = Math.min(Math.max(1, options.page), totalPages);
  const start = (currentPage - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize),
    totalFiltered,
    totalPages,
    currentPage,
  };
}

export interface AdminPeriodSummary {
  todayFromLogs: number;
  weekFromLogs: number;
  monthFromLogs: number;
  undoCount: number;
  rapidBursts: { participantId: string; countInWindow: number; latestMs: number }[];
}

export function computeAdminAnalytics(
  logs: IstighfarLog[],
  keys: DateKeys
): AdminPeriodSummary {
  let todayFromLogs = 0;
  let weekFromLogs = 0;
  let monthFromLogs = 0;
  let undoCount = 0;

  const byParticipant = new Map<string, number[]>();

  for (const log of logs) {
    if (log.date === keys.todayDate) todayFromLogs += log.count;
    if (log.weekKey === keys.weekKey) weekFromLogs += log.count;
    if (log.monthKey === keys.monthKey) monthFromLogs += log.count;
    if (log.actionType === 'undo') undoCount += 1;

    const list = byParticipant.get(log.participantId) ?? [];
    list.push(log.createdAtMs);
    byParticipant.set(log.participantId, list);
  }

  const rapidBursts: { participantId: string; countInWindow: number; latestMs: number }[] = [];
  for (const [participantId, timestamps] of byParticipant.entries()) {
    if (timestamps.length < 15) continue;
    const sortedTs = [...timestamps].sort((a, b) => a - b);
    let maxIn10s = 1;
    let left = 0;
    for (let right = 0; right < sortedTs.length; right++) {
      while (sortedTs[right] - sortedTs[left] > 10_000) {
        left++;
      }
      maxIn10s = Math.max(maxIn10s, right - left + 1);
    }
    if (maxIn10s >= 15) {
      rapidBursts.push({
        participantId,
        countInWindow: maxIn10s,
        latestMs: sortedTs[sortedTs.length - 1],
      });
    }
  }

  return {
    todayFromLogs: Math.max(0, todayFromLogs),
    weekFromLogs: Math.max(0, weekFromLogs),
    monthFromLogs: Math.max(0, monthFromLogs),
    undoCount,
    rapidBursts,
  };
}

export function formatArabicNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(Math.max(0, Math.floor(num)));
}

export function formatArabicDate(ms: number): string {
  if (!ms) return 'الآن';
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}

export function generateSafeId(prefix = 'id'): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let out = `${prefix}_`;
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

export function generateSecretToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}
