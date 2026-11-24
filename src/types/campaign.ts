export interface Participant {
  id: string;
  displayName: string;
  city: string;
  totalIstighfar: number;
  lastLogId: string;
  lastLogDelta: number;
  isPublic: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface CampaignStats {
  totalIstighfar: number;
  totalParticipants: number;
  todayIstighfar: number;
  todayDate: string;
  weeklyIstighfar: number;
  weekKey: string;
  monthlyIstighfar: number;
  monthKey: string;
  lastLogId: string;
  lastUpdatedMs: number;
}

export interface IstighfarLog {
  id: string;
  participantId: string;
  count: number;
  actionType: 'increment' | 'undo';
  date: string;
  weekKey: string;
  monthKey: string;
  createdAtMs: number;
}

export interface CampaignSettings {
  dailyMessage: string;
  campaignGoal: number;
  isRegistrationOpen: boolean;
  announcement: string;
  updatedAtMs: number;
  updatedBy: string;
}

export interface SuspiciousEvent {
  id: string;
  participantId: string;
  reason: string;
  attemptedDelta: number;
  createdAtMs: number;
}

export interface ParticipantSession {
  participantId: string;
  secretToken: string;
  displayName: string;
  city: string;
  sessionCount: number;
  lastActionTimeMs: number;
}

export type SortMode = 'most' | 'newest';
