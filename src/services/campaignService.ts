import {
  collection,
  doc,
  getDoc,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  CampaignSettings,
  CampaignStats,
  IstighfarLog,
  Participant,
  ParticipantSession,
  SuspiciousEvent,
} from '../types/campaign';
import {
  computeStatsRollover,
  generateSafeId,
  generateSecretToken,
  getRiyadhDateKeys,
  validateIstighfarDelta,
  validateParticipantInput,
} from '../utils/campaignLogic';

const SESSION_STORAGE_KEY = 'istighfar_campaign_session_v1';

export const DEFAULT_SETTINGS: CampaignSettings = {
  dailyMessage:
    'اجعل لسانك رطباً بذكر الله، ففي الاستغفار طمأنينة للقلب، ومغفرة للذنوب، وبركة في الرزق والأهل.',
  campaignGoal: 1_000_000,
  isRegistrationOpen: true,
  announcement: '',
  updatedAtMs: 0,
  updatedBy: 'system',
};

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function loadStoredSession(): ParticipantSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParticipantSession;
    if (!parsed.participantId || !parsed.secretToken) return null;
    return {
      ...parsed,
      sessionCount: typeof parsed.sessionCount === 'number' ? parsed.sessionCount : 0,
      lastActionTimeMs: typeof parsed.lastActionTimeMs === 'number' ? parsed.lastActionTimeMs : 0,
    };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: ParticipantSession): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export async function ensureGlobalStatsInitialized(): Promise<void> {
  const statsRef = doc(db, 'campaignStats', 'global');
  try {
    const snap = await getDoc(statsRef);
    if (!snap.exists()) {
      const keys = getRiyadhDateKeys();
      await setDoc(statsRef, {
        totalIstighfar: 0,
        totalParticipants: 0,
        todayIstighfar: 0,
        todayDate: keys.todayDate,
        weeklyIstighfar: 0,
        weekKey: keys.weekKey,
        monthlyIstighfar: 0,
        monthKey: keys.monthKey,
        lastLogId: 'init',
        lastUpdated: serverTimestamp(),
      });
    }
  } catch (error) {
    // Non-fatal if already initialized concurrently or offline
    if (error instanceof Error && !error.message.includes('permission')) {
      console.warn('Stats init notice:', error.message);
    }
  }
}

export function subscribeCampaignStats(
  onUpdate: (stats: CampaignStats) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const statsRef = doc(db, 'campaignStats', 'global');
  const keys = getRiyadhDateKeys();
  return onSnapshot(
    statsRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate({
          totalIstighfar: 0,
          totalParticipants: 0,
          todayIstighfar: 0,
          todayDate: keys.todayDate,
          weeklyIstighfar: 0,
          weekKey: keys.weekKey,
          monthlyIstighfar: 0,
          monthKey: keys.monthKey,
          lastLogId: 'init',
          lastUpdatedMs: 0,
        });
        return;
      }
      const d = snap.data();
      const rawTodayDate = String(d.todayDate ?? keys.todayDate);
      const rawWeekKey = String(d.weekKey ?? keys.weekKey);
      const rawMonthKey = String(d.monthKey ?? keys.monthKey);

      onUpdate({
        totalIstighfar: Number(d.totalIstighfar ?? 0),
        totalParticipants: Number(d.totalParticipants ?? 0),
        todayIstighfar: rawTodayDate === keys.todayDate ? Number(d.todayIstighfar ?? 0) : 0,
        todayDate: rawTodayDate,
        weeklyIstighfar: rawWeekKey === keys.weekKey ? Number(d.weeklyIstighfar ?? 0) : 0,
        weekKey: rawWeekKey,
        monthlyIstighfar: rawMonthKey === keys.monthKey ? Number(d.monthlyIstighfar ?? 0) : 0,
        monthKey: rawMonthKey,
        lastLogId: String(d.lastLogId ?? 'init'),
        lastUpdatedMs: toMillis(d.lastUpdated),
      });
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, 'campaignStats/global');
    }
  );
}

export function subscribeCampaignSettings(
  onUpdate: (settings: CampaignSettings) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const settingsRef = doc(db, 'campaignSettings', 'public');
  return onSnapshot(
    settingsRef,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(DEFAULT_SETTINGS);
        return;
      }
      const d = snap.data();
      onUpdate({
        dailyMessage: String(d.dailyMessage ?? DEFAULT_SETTINGS.dailyMessage),
        campaignGoal: Number(d.campaignGoal ?? DEFAULT_SETTINGS.campaignGoal),
        isRegistrationOpen: d.isRegistrationOpen !== false,
        announcement: String(d.announcement ?? ''),
        updatedAtMs: toMillis(d.updatedAt),
        updatedBy: String(d.updatedBy ?? ''),
      });
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, 'campaignSettings/public');
    }
  );
}

function mapParticipantDoc(id: string, d: Record<string, unknown>): Participant {
  return {
    id: String(d.id ?? id),
    displayName: String(d.displayName ?? ''),
    city: String(d.city ?? ''),
    totalIstighfar: Number(d.totalIstighfar ?? 0),
    lastLogId: String(d.lastLogId ?? 'none'),
    lastLogDelta: Number(d.lastLogDelta ?? 0),
    isPublic: d.isPublic !== false,
    createdAtMs: toMillis(d.createdAt),
    updatedAtMs: toMillis(d.updatedAt),
  };
}

export function subscribePublicParticipants(
  onUpdate: (participants: Participant[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'participants'),
    where('isPublic', '==', true),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((docSnap) =>
        mapParticipantDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
      );
      onUpdate(list);
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'participants');
    }
  );
}

export function subscribeParticipantById(
  participantId: string,
  onUpdate: (participant: Participant | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const ref = doc(db, 'participants', participantId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(mapParticipantDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.GET, `participants/${participantId}`);
    }
  );
}

export async function joinCampaign(input: {
  displayName: string;
  city: string;
  isPublic: boolean;
}): Promise<ParticipantSession> {
  const validation = validateParticipantInput(input.displayName, input.city);
  if (!validation.valid) {
    throw new Error(validation.error || 'بيانات التسجيل غير صالحة.');
  }

  await ensureGlobalStatsInitialized();

  const participantId = generateSafeId('p');
  const secretToken = generateSecretToken();

  const participantRef = doc(db, 'participants', participantId);
  const secretRef = doc(db, 'participantSecrets', participantId);
  const statsRef = doc(db, 'campaignStats', 'global');

  const batch = writeBatch(db);
  batch.set(secretRef, {
    participantId,
    secretToken,
    lastLogId: 'none',
    lastDelta: 0,
    lastActionAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  batch.set(participantRef, {
    id: participantId,
    displayName: validation.displayName,
    city: validation.city,
    totalIstighfar: 0,
    lastLogId: 'none',
    lastLogDelta: 0,
    isPublic: input.isPublic,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(statsRef, {
    totalParticipants: increment(1),
    lastLogId: participantId,
    lastUpdated: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `participants/${participantId}`);
  }

  const session: ParticipantSession = {
    participantId,
    secretToken,
    displayName: validation.displayName,
    city: validation.city,
    sessionCount: 0,
    lastActionTimeMs: Date.now(),
  };
  saveStoredSession(session);
  return session;
}

export async function recordIstighfar(
  session: ParticipantSession,
  delta: 1 | 10 | 33 | 100
): Promise<void> {
  const participantRef = doc(db, 'participants', session.participantId);
  const secretRef = doc(db, 'participantSecrets', session.participantId);
  const statsRef = doc(db, 'campaignStats', 'global');
  const logId = generateSafeId('log');
  const logRef = doc(db, 'istighfarLogs', logId);
  const keys = getRiyadhDateKeys();

  try {
    await runTransaction(db, async (transaction) => {
      const [participantSnap, statsSnap] = await Promise.all([
        transaction.get(participantRef),
        transaction.get(statsRef),
      ]);

      if (!participantSnap.exists()) {
        throw new Error('لم يتم العثور على سجل المشارك. يرجى إعادة التسجيل.');
      }
      if (!statsSnap.exists()) {
        throw new Error('إحصائيات الحملة غير مهيأة حالياً.');
      }

      const pData = participantSnap.data();
      const sData = statsSnap.data();

      const check = validateIstighfarDelta(
        delta,
        Number(pData.totalIstighfar ?? 0),
        Number(pData.lastLogDelta ?? 0),
        String(pData.lastLogId ?? 'none')
      );
      if (!check.valid) {
        throw new Error(check.error || 'عملية غير صالحة.');
      }

      const currentStats: CampaignStats = {
        totalIstighfar: Number(sData.totalIstighfar ?? 0),
        totalParticipants: Number(sData.totalParticipants ?? 0),
        todayIstighfar: Number(sData.todayIstighfar ?? 0),
        todayDate: String(sData.todayDate ?? keys.todayDate),
        weeklyIstighfar: Number(sData.weeklyIstighfar ?? 0),
        weekKey: String(sData.weekKey ?? keys.weekKey),
        monthlyIstighfar: Number(sData.monthlyIstighfar ?? 0),
        monthKey: String(sData.monthKey ?? keys.monthKey),
        lastLogId: String(sData.lastLogId ?? 'init'),
        lastUpdatedMs: 0,
      };

      const nextStats = computeStatsRollover(currentStats, delta, keys);

      transaction.set(logRef, {
        id: logId,
        participantId: session.participantId,
        proofToken: session.secretToken,
        count: delta,
        actionType: 'increment',
        date: nextStats.todayDate,
        weekKey: nextStats.weekKey,
        monthKey: nextStats.monthKey,
        createdAt: serverTimestamp(),
      });

      transaction.update(secretRef, {
        lastLogId: logId,
        lastDelta: delta,
        lastActionAt: serverTimestamp(),
      });

      transaction.update(participantRef, {
        totalIstighfar: Number(pData.totalIstighfar ?? 0) + delta,
        lastLogId: logId,
        lastLogDelta: delta,
        updatedAt: serverTimestamp(),
      });

      transaction.update(statsRef, {
        totalIstighfar: nextStats.totalIstighfar,
        todayIstighfar: nextStats.todayIstighfar,
        todayDate: nextStats.todayDate,
        weeklyIstighfar: nextStats.weeklyIstighfar,
        weekKey: nextStats.weekKey,
        monthlyIstighfar: nextStats.monthlyIstighfar,
        monthKey: nextStats.monthKey,
        lastLogId: logId,
        lastUpdated: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('لم يتم العثور') || error.message.includes('غير صالحة'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `participants/${session.participantId}`);
  }
}

export async function undoLastIstighfar(
  session: ParticipantSession
): Promise<number> {
  const participantRef = doc(db, 'participants', session.participantId);
  const secretRef = doc(db, 'participantSecrets', session.participantId);
  const statsRef = doc(db, 'campaignStats', 'global');
  const logId = generateSafeId('undo');
  const logRef = doc(db, 'istighfarLogs', logId);
  const keys = getRiyadhDateKeys();

  let undoneAmount = 0;

  try {
    await runTransaction(db, async (transaction) => {
      const [participantSnap, statsSnap] = await Promise.all([
        transaction.get(participantRef),
        transaction.get(statsRef),
      ]);

      if (!participantSnap.exists() || !statsSnap.exists()) {
        throw new Error('تعذر تنفيذ التراجع في الوقت الحالي.');
      }

      const pData = participantSnap.data();
      const sData = statsSnap.data();
      const lastDelta = Number(pData.lastLogDelta ?? 0);
      const lastLogId = String(pData.lastLogId ?? 'none');
      const currentTotal = Number(pData.totalIstighfar ?? 0);

      const delta = -lastDelta;
      const check = validateIstighfarDelta(delta, currentTotal, lastDelta, lastLogId);
      if (!check.valid) {
        throw new Error(check.error || 'لا توجد ضغطة أخيرة متاحة للتراجع.');
      }

      undoneAmount = lastDelta;

      const currentStats: CampaignStats = {
        totalIstighfar: Number(sData.totalIstighfar ?? 0),
        totalParticipants: Number(sData.totalParticipants ?? 0),
        todayIstighfar: Number(sData.todayIstighfar ?? 0),
        todayDate: String(sData.todayDate ?? keys.todayDate),
        weeklyIstighfar: Number(sData.weeklyIstighfar ?? 0),
        weekKey: String(sData.weekKey ?? keys.weekKey),
        monthlyIstighfar: Number(sData.monthlyIstighfar ?? 0),
        monthKey: String(sData.monthKey ?? keys.monthKey),
        lastLogId: String(sData.lastLogId ?? 'init'),
        lastUpdatedMs: 0,
      };

      const nextStats = computeStatsRollover(currentStats, delta, keys);

      transaction.set(logRef, {
        id: logId,
        participantId: session.participantId,
        proofToken: session.secretToken,
        count: delta,
        actionType: 'undo',
        date: nextStats.todayDate,
        weekKey: nextStats.weekKey,
        monthKey: nextStats.monthKey,
        createdAt: serverTimestamp(),
      });

      transaction.update(secretRef, {
        lastLogId: logId,
        lastDelta: delta,
        lastActionAt: serverTimestamp(),
      });

      transaction.update(participantRef, {
        totalIstighfar: Math.max(0, currentTotal + delta),
        lastLogId: 'undone',
        lastLogDelta: 0,
        updatedAt: serverTimestamp(),
      });

      transaction.update(statsRef, {
        totalIstighfar: nextStats.totalIstighfar,
        todayIstighfar: nextStats.todayIstighfar,
        todayDate: nextStats.todayDate,
        weeklyIstighfar: nextStats.weeklyIstighfar,
        weekKey: nextStats.weekKey,
        monthlyIstighfar: nextStats.monthlyIstighfar,
        monthKey: nextStats.monthKey,
        lastLogId: logId,
        lastUpdated: serverTimestamp(),
      });
    });

    return undoneAmount;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('لا توجد') || error.message.includes('تعذر'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, `participants/${session.participantId}`);
  }
}

export async function logSuspiciousAttempt(
  participantId: string,
  reason: string,
  attemptedDelta: number
): Promise<void> {
  const eventId = generateSafeId('susp');
  try {
    await setDoc(doc(db, 'suspiciousEvents', eventId), {
      id: eventId,
      participantId: participantId.slice(0, 64) || 'unknown',
      reason: reason.slice(0, 200),
      attemptedDelta: Math.trunc(attemptedDelta),
      createdAt: serverTimestamp(),
    });
  } catch {
    // Fail silently if offline or rate-limited
  }
}

// ---- Admin Operations ----

export function subscribeAllParticipantsAdmin(
  onUpdate: (participants: Participant[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'participants'),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((d) => mapParticipantDoc(d.id, d.data() as Record<string, unknown>))
      );
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'participants');
    }
  );
}

export function subscribeIstighfarLogsAdmin(
  onUpdate: (logs: IstighfarLog[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'istighfarLogs'),
    orderBy('createdAt', 'desc'),
    limit(500)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            participantId: String(d.participantId ?? ''),
            count: Number(d.count ?? 0),
            actionType: d.actionType === 'undo' ? 'undo' : 'increment',
            date: String(d.date ?? ''),
            weekKey: String(d.weekKey ?? ''),
            monthKey: String(d.monthKey ?? ''),
            createdAtMs: toMillis(d.createdAt),
          };
        })
      );
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'istighfarLogs');
    }
  );
}

export function subscribeSuspiciousEventsAdmin(
  onUpdate: (events: SuspiciousEvent[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'suspiciousEvents'),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  return onSnapshot(
    q,
    (snap) => {
      onUpdate(
        snap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: String(d.id ?? docSnap.id),
            participantId: String(d.participantId ?? ''),
            reason: String(d.reason ?? ''),
            attemptedDelta: Number(d.attemptedDelta ?? 0),
            createdAtMs: toMillis(d.createdAt),
          };
        })
      );
    },
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, 'suspiciousEvents');
    }
  );
}

export async function updateCampaignSettingsAdmin(
  settings: Omit<CampaignSettings, 'updatedAtMs' | 'updatedBy'>,
  adminEmail: string
): Promise<void> {
  const ref = doc(db, 'campaignSettings', 'public');
  try {
    await setDoc(ref, {
      dailyMessage: settings.dailyMessage.trim().slice(0, 500),
      campaignGoal: Math.max(1000, Math.min(1_000_000_000, Math.round(settings.campaignGoal))),
      isRegistrationOpen: Boolean(settings.isRegistrationOpen),
      announcement: settings.announcement.trim().slice(0, 300),
      updatedAt: serverTimestamp(),
      updatedBy: adminEmail.slice(0, 128) || 'admin',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'campaignSettings/public');
  }
}

export async function deleteParticipantAdmin(participant: Participant): Promise<void> {
  const participantRef = doc(db, 'participants', participant.id);
  const secretRef = doc(db, 'participantSecrets', participant.id);
  const statsRef = doc(db, 'campaignStats', 'global');

  try {
    await runTransaction(db, async (transaction) => {
      const statsSnap = await transaction.get(statsRef);
      transaction.delete(participantRef);
      transaction.delete(secretRef);

      if (statsSnap.exists()) {
        const s = statsSnap.data();
        transaction.update(statsRef, {
          totalParticipants: Math.max(0, Number(s.totalParticipants ?? 0) - 1),
          totalIstighfar: Math.max(
            0,
            Number(s.totalIstighfar ?? 0) - participant.totalIstighfar
          ),
          lastUpdated: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `participants/${participant.id}`);
  }
}

export async function checkIsAdminUser(uid: string, email: string | null): Promise<boolean> {
  if (email === 'saidahnat6@gmail.com') return true;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}
