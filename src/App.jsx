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
import { useAgents, usePendingReviews, useTasks } from './utils/useSupabase';
import { useDerivedAlerts } from './utils/useDerivedAlerts';
import { useCommandCenterTruth } from './utils/useCommandCenterTruth';
import { runCommanderHeartbeat } from './lib/api';
import { Bell, Settings, User, Loader2, Search } from 'lucide-react';
import { cn } from './utils/cn';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { WorkspaceProvider, useWorkspaces } from './context/WorkspaceContext';
import { ensureCommanderAgent } from './utils/useSupabase';

function TacticalTopbarButton({ active, onClick, children, tone = 'teal', pulse = false, ariaLabel }) {
  const toneMap = {
    teal: active ? 'border-aurora-teal/30 text-aurora-teal bg-aurora-teal/[0.08]' : 'text-text-muted hover:text-text-primary hover:border-white/[0.1]',
    amber: active ? 'border-aurora-amber/30 text-aurora-amber bg-aurora-amber/[0.08]' : 'text-text-muted hover:text-text-primary hover:border-white/[0.1]',
  };

  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.05] bg-black/20 transition-all duration-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]',
        toneMap[tone] || toneMap.teal
      )}
    >
      <span className={cn('pointer-events-none absolute inset-0 rounded-2xl border', active ? 'border-current/20' : 'border-transparent')} />
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.05),transparent_42%)]" />
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
  const [managedOpsTab, setManagedOpsTab] = useState('quickstart');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const { notificationsOpen, setNotificationsOpen, settingsOpen, setSettingsOpen, profileOpen, setProfileOpen, setPendingCount } = useSystemState();
  const { activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const { user } = useAuth();
  const { agents, loading: loadingAgents } = useAgents(activeWorkspace?.id);
  const { tasks, loading: loadingTasks } = useTasks(activeWorkspace?.id);
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

  async function openAgentWorkspace(agentId, options = {}) {
    if (!agentId) return;
    let resolvedAgentId = agentId;
    if (agentId === 'synthetic-commander' && user) {
      try {
        const commander = await ensureCommanderAgent(user, activeWorkspace?.id || null);
        if (commander?.id) resolvedAgentId = commander.id;
      } catch (err) {
        console.error('[Dashboard] Failed to resolve synthetic commander:', err);
      }
    }
    setDetailState({
      agentId: resolvedAgentId,
      mode: options.mode ?? 'setup',
    });
  }

  async function handleWorkspaceCreated(newWs) {
    setActiveWorkspace(newWs.id);
    // Create Commander for the new workspace, then open its setup panel
    try {
      const commander = await ensureCommanderAgent(user, newWs.id);
      if (commander?.id) {
        // Small delay to let useAgents refetch with the new workspace
        setTimeout(() => openAgentWorkspace(commander.id, { mode: 'setup' }), 400);
      }
    } catch (err) {
      console.error('[Dashboard] Commander onboarding failed:', err);
    }
  }

  function handleNavigate(route, options = {}) {
    if (!route) return;
    setActiveRoute(route);
    if (route === 'managedOps') {
      setManagedOpsTab(options.tab || 'quickstart');
    }
  }

  function handleAction(action) {
    if (!action) return;
    const { type, route, agentId, panel } = action;
    if (type === 'navigate') {
      if (route === 'review') handleNavigate('missions');
      else if (route === 'operations') handleNavigate('overview');
      else handleNavigate(route, action);
    }
    if (type === 'agent') openAgentWorkspace(agentId);
    if (type === 'panel') {
      if (panel === 'notifications') setNotificationsOpen(true);
      if (panel === 'settings') setSettingsOpen(true);
      if (panel === 'profile') setProfileOpen(true);
    }
  }

  const selectedAgent = detailState?.agentId
    ? agents.find((agent) => agent.id === detailState.agentId)
      ?? (detailState.agentId === 'synthetic-commander'
        ? agents.find((agent) => agent.role === 'commander') ?? null
        : null)
    : null;

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas text-text-primary relative">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-8%] h-[380px] w-[380px] rounded-full bg-aurora-teal/7 blur-[150px]" />
        <div className="absolute right-[-12%] top-[12%] h-[420px] w-[420px] rounded-full bg-aurora-blue/7 blur-[170px]" />
      </div>
      <main className="flex-1 flex flex-col relative">
        {/* Topbar */}
        <header className="px-8 py-4 shrink-0 z-10 w-full relative">
          <div className="relative flex items-center gap-3 rounded-[28px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(12,14,18,0.92),rgba(10,12,15,0.82))] px-3 py-3 shadow-[0_24px_80px_rgba(0,0,0,0.22)] backdrop-blur-sm xl:gap-4 xl:px-4 before:pointer-events-none before:absolute before:inset-x-10 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/12 before:to-transparent">
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-[radial-gradient(circle_at_12%_0%,rgba(45,212,191,0.05),transparent_24%),radial-gradient(circle_at_88%_0%,rgba(96,165,250,0.05),transparent_22%)]" />
            <div className="shrink-0 min-w-0">
              <ProjectSwitcher compact onWorkspaceCreated={handleWorkspaceCreated} />
            </div>

            <div className="flex-1 min-w-0 flex justify-center px-1">
              <NavRail activeId={activeRoute} onNavigate={handleNavigate} />
            </div>

            <div className="flex items-center justify-end gap-1 shrink-0 xl:gap-1.5">
              <CommandReadinessChip
                truth={truth}
                onClick={() => setActiveRoute('overview')}
              />
              <button
                onClick={() => setCmdOpen(true)}
                className="flex items-center justify-center w-10 h-10 rounded-2xl border border-white/[0.05] bg-black/20 hover:bg-white/[0.05] transition-colors text-text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
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
                <Bell className="relative z-10 h-4.5 w-4.5" />
              </TacticalTopbarButton>

              {/* Settings */}
              <TacticalTopbarButton
                onClick={() => setSettingsOpen(!settingsOpen)}
                active={settingsOpen}
                tone="teal"
                ariaLabel="Open systems control"
              >
                <Settings className="relative z-10 h-4.5 w-4.5" />
              </TacticalTopbarButton>

              {/* User Avatar */}
              <TacticalTopbarButton
                onClick={() => setProfileOpen(!profileOpen)}
                active={profileOpen}
                tone="teal"
                ariaLabel="Open commander identity"
              >
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
                onNavigate={handleNavigate}
                onOpenDetail={openAgentWorkspace}
                onQuickDispatch={(agentId) => openAgentWorkspace(agentId, { mode: 'dispatch' })}
              />
            )}
            {activeRoute === 'missions' && <MissionControlView />}
            {activeRoute === 'managedOps' && <ManagedOpsView initialTab={managedOpsTab} />}
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
    <TimeRangeProvider>
      <WorkspaceProvider>
        <Dashboard />
      </WorkspaceProvider>
    </TimeRangeProvider>
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
