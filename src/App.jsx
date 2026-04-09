import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { NavRail } from './components/NavRail';
import { CommandPalette } from './components/CommandPalette';
import { DetailPanel } from './components/DetailPanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { OverviewView } from './views/OverviewView';
import { ReportsView } from './views/ReportsView';
import { IntelligenceView } from './views/IntelligenceView';
import { LoginView } from './views/LoginView';
import { MissionControlView } from './views/MissionControlView';
import { TimeRangeProvider } from './utils/useTimeRange';
import { useSystemState } from './context/SystemStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAgents, usePendingReviews, useTasks } from './utils/useSupabase';
import { Bell, Settings, User, Loader2, Search } from 'lucide-react';
import { cn } from './utils/cn';
import { ProjectSwitcher } from './components/ProjectSwitcher';

function Dashboard() {
  const [activeRoute, setActiveRoute] = useState('overview');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const { notificationsOpen, setNotificationsOpen, settingsOpen, setSettingsOpen, profileOpen, setProfileOpen, setPendingCount } = useSystemState();
  const { agents, loading: loadingAgents, addOptimistic } = useAgents();
  const { tasks, loading: loadingTasks } = useTasks();
  const { reviews } = usePendingReviews();

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
      <main className="flex-1 flex flex-col relative">
        {/* Topbar */}
        <header className="px-8 py-4 shrink-0 z-10 w-full relative">
          <div className="flex items-center gap-4">
            <div className="shrink-0 min-w-0">
              <ProjectSwitcher compact />
            </div>

            <div className="flex-1 min-w-0 flex justify-center">
              <NavRail activeId={activeRoute} onNavigate={setActiveRoute} />
            </div>

            <div className="flex items-center justify-end gap-1.5 shrink-0">
              <button
                onClick={() => setCmdOpen(true)}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.055] transition-colors text-text-muted"
                aria-label="Open search"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-border mx-1" />

              {/* Notifications */}
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all duration-200 relative",
                  notificationsOpen ? "bg-aurora-teal/20 text-aurora-teal" : "text-text-muted hover:text-text-primary hover:bg-white/[0.05]"
                )}
              >
                <Bell className="w-4.5 h-4.5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-aurora-rose rounded-full ring-2 ring-canvas" />
              </button>

              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={cn(
                  "p-2 rounded-xl transition-all duration-200",
                  settingsOpen ? "bg-aurora-teal/20 text-aurora-teal" : "text-text-muted hover:text-text-primary hover:bg-white/[0.05]"
                )}
              >
                <Settings className="w-4.5 h-4.5" />
              </button>

              {/* User Avatar */}
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className={cn(
                  "w-9 h-9 rounded-xl border flex items-center justify-center transition-colors",
                  profileOpen ? "bg-aurora-teal/20 border-aurora-teal/50" : "bg-surface-raised border-border hover:border-aurora-teal/50"
                )}
              >
                <User className="w-4 h-4 text-aurora-teal" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 relative no-scrollbar pb-8">
          {activeRoute === 'overview' && (
            <OverviewView
              agents={agents}
              tasks={tasks}
              loading={loadingAgents || loadingTasks}
              addOptimistic={addOptimistic}
              onNavigate={setActiveRoute}
              onOpenDetail={openAgentWorkspace}
            />
          )}
          {activeRoute === 'missions' && <MissionControlView />}
          {activeRoute === 'reports' && <ReportsView />}
          {activeRoute === 'intelligence' && <IntelligenceView />}
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
      <Dashboard />
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
