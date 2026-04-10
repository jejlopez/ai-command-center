import { useState, useEffect, lazy, Suspense, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { NavRail } from './components/NavRail';
import { CommandPalette } from './components/CommandPalette';
import { DetailPanel } from './components/DetailPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import { AppErrorBoundary } from './components/AppErrorBoundary';
const OverviewView = lazy(() => import('./views/OverviewView').then(mod => ({ default: mod.OverviewView })));
const ReviewRoomView = lazy(() => import('./views/ReviewRoomView').then(mod => ({ default: mod.ReviewRoomView })));
const ReportsView = lazy(() => import('./views/ReportsView').then(mod => ({ default: mod.ReportsView })));
const IntelligenceView = lazy(() => import('./views/IntelligenceView').then(mod => ({ default: mod.IntelligenceView })));
const ManagedOpsView = lazy(() => import('./views/ManagedOpsView').then(mod => ({ default: mod.ManagedOpsView })));
import { LoginView } from './views/LoginView';
const MissionControlView = lazy(() => import('./views/MissionControlView').then(mod => ({ default: mod.MissionControlView })));
import { TimeRangeProvider } from './utils/useTimeRange';
import { useSystemState } from './context/SystemStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { useAgents, usePendingReviews, useTasks } from './utils/useSupabase';
import { useDerivedAlerts } from './utils/useDerivedAlerts';
import { useCommandCenterTruth } from './utils/useCommandCenterTruth';
import { runCommanderHeartbeat } from './lib/api';
import { Bell, Settings, User, Loader2, Search } from 'lucide-react';
import { cn } from './utils/cn';
import { ProjectSwitcher } from './components/ProjectSwitcher';

function TacticalTopbarButton({ active, onClick, children, tone = 'teal', pulse = false, ariaLabel }) {
  const toneMap = {
    teal: active ? 'border-aurora-teal/35 text-aurora-teal bg-aurora-teal/10' : 'text-text-muted hover:text-text-primary hover:border-aurora-teal/20',
    amber: active ? 'border-aurora-amber/35 text-aurora-amber bg-aurora-amber/10' : 'text-text-muted hover:text-text-primary hover:border-aurora-amber/20',
  };

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        toneMap[tone] || toneMap.teal
      )}
    >
      <span className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.18)_0px,rgba(255,255,255,0.18)_1px,transparent_1px,transparent_12px)]" />
      <span className={cn('pointer-events-none absolute inset-0 rounded-2xl border', active ? 'border-current/20' : 'border-transparent')} />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.08),transparent_38%)]" />
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      {pulse && (
        <>
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-aurora-rose ring-2 ring-canvas" />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 animate-ping rounded-full bg-aurora-rose/80" />
        </>
      )}
      {children}
    </button>
  );
}

function CommandReadinessChip({ truth, onClick }) {
  const tone = truth.readinessState === 'ready'
    ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
    : truth.readinessState === 'blocked'
      ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
      : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'hidden xl:inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors',
        tone
      )}
    >
      <span className="h-2 w-2 rounded-full bg-current" />
      {truth.readinessLabel}
    </button>
  );
}

function Dashboard() {
  const [activeRoute, setActiveRoute] = useState('overview');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const { notificationsOpen, setNotificationsOpen, settingsOpen, setSettingsOpen, profileOpen, setProfileOpen, setPendingCount } = useSystemState();
  const { agents, loading: loadingAgents, addOptimistic } = useAgents();
  const { tasks, loading: loadingTasks } = useTasks();
  const { reviews } = usePendingReviews();
  const { unreadCount, criticalCount } = useDerivedAlerts();
  const truth = useCommandCenterTruth();
  const heartbeatInFlight = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setPendingCount(reviews.length);
  }, [reviews.length, setPendingCount]);

  useEffect(() => {
    if (loadingAgents || loadingTasks) return undefined;
    if (!agents.some((agent) => agent.role === 'commander' && !agent.isSyntheticCommander)) return undefined;

    let cancelled = false;

    const tick = async () => {
      if (cancelled || heartbeatInFlight.current) return;
      heartbeatInFlight.current = true;
      try {
        await runCommanderHeartbeat(agents, tasks, reviews);
      } finally {
        heartbeatInFlight.current = false;
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 20000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [agents, tasks, reviews, loadingAgents, loadingTasks]);

  function openAgentWorkspace(agentId, options = {}) {
    if (!agentId) return;
    setDetailState({
      agentId,
      mode: options.mode ?? 'config',
    });
  }

  function handleAction(action) {
    if (!action) return;
    const { type, route, agentId, panel } = action;
    if (type === 'navigate') {
      if (route === 'review') setActiveRoute('missions');
      else if (route === 'operations') setActiveRoute('overview');
      else setActiveRoute(route);
    }
    if (type === 'agent') openAgentWorkspace(agentId);
    if (type === 'panel') {
      if (panel === 'notifications') setNotificationsOpen(true);
      if (panel === 'settings') setSettingsOpen(true);
      if (panel === 'profile') setProfileOpen(true);
    }
  }

  const selectedAgent = detailState?.agentId
    ? agents.find((agent) => agent.id === detailState.agentId) ?? null
    : null;

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas text-text-primary relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-[380px] w-[380px] rounded-full bg-aurora-teal/10 blur-[140px]" />
        <div className="absolute right-[-12%] top-[12%] h-[420px] w-[420px] rounded-full bg-aurora-violet/10 blur-[160px]" />
        <div className="absolute bottom-[-18%] left-[28%] h-[460px] w-[460px] rounded-full bg-aurora-blue/10 blur-[180px]" />
      </div>
      <main className="flex-1 flex flex-col relative">
        {/* Topbar */}
        <header className="px-8 py-4 shrink-0 z-10 w-full relative">
          <div className="relative flex items-center gap-4 rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-4 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.24)] backdrop-blur-sm before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent">
            <div className="pointer-events-none absolute inset-0 rounded-[28px] opacity-[0.06] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.18)_0px,rgba(255,255,255,0.18)_1px,transparent_1px,transparent_12px)]" />
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.08),transparent_24%),radial-gradient(circle_at_88%_0%,rgba(167,139,250,0.08),transparent_22%)]" />
            <div className="shrink-0 min-w-0">
              <ProjectSwitcher compact />
            </div>

            <div className="flex-1 min-w-0 flex justify-center">
              <NavRail activeId={activeRoute} onNavigate={setActiveRoute} />
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <CommandReadinessChip
                truth={truth}
                onClick={() => setActiveRoute('overview')}
              />
              <button
                onClick={() => setCmdOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-2xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.055] transition-colors text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                aria-label="Open search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-border mx-1" />

              {/* Notifications */}
              <TacticalTopbarButton
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                active={notificationsOpen}
                tone="amber"
                pulse={criticalCount > 0 || unreadCount > 0}
                ariaLabel="Open command alerts"
              >
                <span className="pointer-events-none absolute inset-0 rounded-2xl">
                  <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-amber/20" />
                  <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-amber/10" />
                </span>
                <Bell className="relative z-10 h-4.5 w-4.5" />
              </TacticalTopbarButton>

              {/* Settings */}
              <TacticalTopbarButton
                onClick={() => setSettingsOpen(!settingsOpen)}
                active={settingsOpen}
                tone="teal"
                ariaLabel="Open systems control"
              >
                <span className="pointer-events-none absolute inset-0 rounded-2xl">
                  <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-teal/20" />
                  <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-teal/10" />
                </span>
                <Settings className="relative z-10 h-4.5 w-4.5" />
              </TacticalTopbarButton>

              {/* User Avatar */}
              <TacticalTopbarButton
                onClick={() => setProfileOpen(!profileOpen)}
                active={profileOpen}
                tone="teal"
                ariaLabel="Open commander identity"
              >
                <span className="pointer-events-none absolute inset-0 rounded-2xl">
                  <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-teal/20" />
                  <span className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border border-aurora-blue/10" />
                </span>
                <User className="w-4 h-4 text-aurora-teal" />
              </TacticalTopbarButton>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 relative no-scrollbar pb-8">
          <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 text-aurora-teal animate-spin" /></div>}>
            {activeRoute === 'overview' && (
              <OverviewView
                agents={agents}
                tasks={tasks}
                loading={loadingAgents || loadingTasks}
                addOptimistic={addOptimistic}
                onNavigate={setActiveRoute}
                onOpenDetail={openAgentWorkspace}
                onQuickDispatch={(agentId) => openAgentWorkspace(agentId, { mode: 'dispatch' })}
              />
            )}
            {activeRoute === 'missions' && <MissionControlView />}
            {activeRoute === 'managedOps' && <ManagedOpsView />}
            {activeRoute === 'reports' && <ReportsView />}
            {activeRoute === 'intelligence' && <IntelligenceView />}
            {activeRoute === 'review' && <ReviewRoomView />}
          </Suspense>
        </div>
      </main>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} onExecute={(item) => handleAction(item?.action)} />
      
      <NotificationsPanel notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} onNavigate={handleAction} />
      <SettingsPanel settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
      <UserProfilePanel profileOpen={profileOpen} setProfileOpen={setProfileOpen} onAction={handleAction} />

      <AnimatePresence>
        {selectedAgent && (
          <DetailPanel
            agent={selectedAgent}
            initialMode={detailState?.mode}
            onClose={() => setDetailState(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-aurora-teal animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <WorkspaceProvider>
      <TimeRangeProvider>
        <Dashboard />
      </TimeRangeProvider>
    </WorkspaceProvider>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </AppErrorBoundary>
  );
}

export default App;
