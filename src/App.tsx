import { useEffect, useMemo, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HeroStats } from './components/HeroStats';
import { JoinAndCounterSection } from './components/JoinAndCounterSection';
import { Navbar } from './components/Navbar';
import { ParticipantsSection } from './components/ParticipantsSection';
import { VirtuesAndAboutSection } from './components/VirtuesAndAboutSection';
import {
  clearStoredSession,
  DEFAULT_SETTINGS,
  joinCampaign,
  loadStoredSession,
  logSuspiciousAttempt,
  recordIstighfar,
  saveStoredSession,
  subscribeCampaignSettings,
  subscribeCampaignStats,
  subscribeParticipantById,
  subscribePublicParticipants,
  undoLastIstighfar,
} from './services/campaignService';
import type {
  CampaignSettings,
  CampaignStats,
  Participant,
  ParticipantSession,
} from './types/campaign';
import { assignParticipantRanks, getRiyadhDateKeys } from './utils/campaignLogic';

function CampaignApp() {
  const [activeView, setActiveView] = useState<'campaign' | 'admin'>(() =>
    window.location.hash === '#/admin' ? 'admin' : 'campaign'
  );
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);

  const initialKeys = getRiyadhDateKeys();
  const [stats, setStats] = useState<CampaignStats>({
    totalIstighfar: 0,
    totalParticipants: 0,
    todayIstighfar: 0,
    todayDate: initialKeys.todayDate,
    weeklyIstighfar: 0,
    weekKey: initialKeys.weekKey,
    monthlyIstighfar: 0,
    monthKey: initialKeys.monthKey,
    lastLogId: 'init',
    lastUpdatedMs: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);

  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);

  const [session, setSession] = useState<ParticipantSession | null>(() => loadStoredSession());
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveView(window.location.hash === '#/admin' ? 'admin' : 'campaign');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateView = (view: 'campaign' | 'admin') => {
    setActiveView(view);
    window.location.hash = view === 'admin' ? '#/admin' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Live Firestore subscriptions
  useEffect(() => {
    const unsubStats = subscribeCampaignStats(
      (nextStats) => {
        setStats(nextStats);
        setStatsLoading(false);
        setConnectionError(null);
      },
      () => {
        setStatsLoading(false);
        setConnectionError('تعذر الاتصال المباشر بقاعدة البيانات.');
      }
    );

    const unsubSettings = subscribeCampaignSettings(setSettings, () => {
      // Keep default settings silently if unreachable
    });

    const unsubParticipants = subscribePublicParticipants(
      (list) => {
        setParticipants(list);
        setParticipantsLoading(false);
      },
      () => {
        setParticipantsLoading(false);
      }
    );

    return () => {
      unsubStats();
      unsubSettings();
      unsubParticipants();
    };
  }, []);

  // Subscribe to current participant's own record if joined
  useEffect(() => {
    if (!session?.participantId) {
      setActiveParticipant(null);
      return;
    }

    const unsub = subscribeParticipantById(
      session.participantId,
      (p) => {
        if (!p) {
          // Participant was deleted by admin or missing
          clearStoredSession();
          setSession(null);
          setActiveParticipant(null);
          return;
        }
        setActiveParticipant(p);
      },
      () => {
        // Handled by offline state
      }
    );

    return () => unsub();
  }, [session?.participantId]);

  const participantRank = useMemo(() => {
    if (!session?.participantId || participants.length === 0) return null;
    const ranked = assignParticipantRanks(participants);
    const found = ranked.find((p) => p.id === session.participantId);
    return found ? found.rank : null;
  }, [participants, session?.participantId]);

  const jumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleJoin = async (data: {
    displayName: string;
    city: string;
    isPublic: boolean;
  }) => {
    const createdSession = await joinCampaign(data);
    setSession(createdSession);
  };

  const handleIncrement = async (delta: 1 | 10 | 33 | 100) => {
    if (!session) return;
    await recordIstighfar(session, delta);
    const updatedSession: ParticipantSession = {
      ...session,
      sessionCount: session.sessionCount + delta,
      lastActionTimeMs: Date.now(),
    };
    setSession(updatedSession);
    saveStoredSession(updatedSession);
  };

  const handleUndo = async () => {
    if (!session) return;
    const undone = await undoLastIstighfar(session);
    const updatedSession: ParticipantSession = {
      ...session,
      sessionCount: Math.max(0, session.sessionCount - undone),
      lastActionTimeMs: Date.now(),
    };
    setSession(updatedSession);
    saveStoredSession(updatedSession);
  };

  const handleResetSessionCount = () => {
    if (!session) return;
    const updatedSession: ParticipantSession = {
      ...session,
      sessionCount: 0,
    };
    setSession(updatedSession);
    saveStoredSession(updatedSession);
  };

  const handleSwitchAccount = () => {
    clearStoredSession();
    setSession(null);
    setActiveParticipant(null);
  };

  const handleRateLimitBlocked = (attemptedDelta: number, reason: string) => {
    if (!session) return;
    void logSuspiciousAttempt(session.participantId, reason, attemptedDelta);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#FAF8F3] text-[#1A2420]">
      <Navbar
        hasSession={Boolean(session)}
        activeView={activeView}
        onNavigateView={navigateView}
        onJumpToSection={jumpToSection}
      />

      {isOffline && (
        <div
          role="status"
          className="bg-amber-900 text-amber-50 px-4 py-2 text-center text-xs sm:text-sm flex items-center justify-center gap-2"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>لا يوجد اتصال بالإنترنت حالياً. ستعود التحديثات المباشرة تلقائياً عند استعادة الشبكة.</span>
        </div>
      )}

      {connectionError && !isOffline && (
        <div
          role="alert"
          className="bg-red-50 border-b border-red-200 text-red-800 px-4 py-2 text-center text-xs sm:text-sm"
        >
          {connectionError}
        </div>
      )}

      <main className="flex-1">
        {activeView === 'admin' ? (
          <AdminDashboard
            stats={stats}
            settings={settings}
            onExitAdmin={() => navigateView('campaign')}
          />
        ) : (
          <>
            <HeroStats
              stats={stats}
              statsLoading={statsLoading}
              settings={settings}
              hasSession={Boolean(session)}
              onJumpToJoin={() => jumpToSection('counter-workspace')}
            />

            <JoinAndCounterSection
              session={session}
              participant={activeParticipant}
              participantRank={participantRank}
              registrationOpen={settings.isRegistrationOpen}
              isOffline={isOffline}
              onJoin={handleJoin}
              onIncrement={handleIncrement}
              onUndo={handleUndo}
              onResetSessionCount={handleResetSessionCount}
              onRateLimitBlocked={handleRateLimitBlocked}
              onSwitchAccount={handleSwitchAccount}
            />

            <ParticipantsSection
              participants={participants}
              loading={participantsLoading}
              currentParticipantId={session?.participantId}
            />

            <VirtuesAndAboutSection onOpenAdmin={() => navigateView('admin')} />
          </>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CampaignApp />
    </ErrorBoundary>
  );
}
