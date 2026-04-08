import { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { NavRail } from './components/NavRail';
import { CommandPalette } from './components/CommandPalette';
import { TimeRangePicker } from './components/TimeRangePicker';
import { DetailPanel } from './components/DetailPanel';
import { DoctorModePanel } from './components/DoctorModePanel';
import { NotificationsPanel } from './components/NotificationsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { UserProfilePanel } from './components/UserProfilePanel';
import { OverviewView } from './views/OverviewView';
// FleetOperationsView merged into OverviewView
import { ReviewRoomView } from './views/ReviewRoomView';
import { ReportsView } from './views/ReportsView';
import { IntelligenceView } from './views/IntelligenceView';
import { LoginView } from './views/LoginView';
import { TimeRangeProvider } from './utils/useTimeRange';
import { useSystemState } from './context/SystemStateContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useAgents, useTasks, useActivityLog } from './utils/useSupabase';
import { Bell, Settings, User, Loader2 } from 'lucide-react';
import { cn } from './utils/cn';

function Dashboard() {
  const [activeRoute, setActiveRoute] = useState('overview');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detailState, setDetailState] = useState(null);
  const { notificationsOpen, setNotificationsOpen, settingsOpen, setSettingsOpen, profileOpen, setProfileOpen, setDoctorModeOpen } = useSystemState();
  const { agents, loading: loadingAgents, usingMock, addOptimistic } = useAgents();
  const { tasks, loading: loadingTasks } = useTasks();
  const { logs, loading: loadingLogs } = useActivityLog();

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
    if (type === 'navigate') setActiveRoute(route);
    if (type === 'agent') openAgentWorkspace(agentId);
    if (type === 'panel') {
      if (panel === 'notifications') setNotificationsOpen(true);
      if (panel === 'settings') setSettingsOpen(true);
      if (panel === 'doctor') setDoctorModeOpen(true);
      if (panel === 'profile') setProfileOpen(true);
    }
  }

  const selectedAgent = detailState?.agentId
    ? agents.find((agent) => agent.id === detailState.agentId) ?? null
    : null;
  const selectedAgentTasks = selectedAgent
    ? tasks.filter((task) => task.agentId === selectedAgent.id)
    : [];
  const selectedAgentLogs = selectedAgent
    ? logs.filter((entry) => entry.agentId === selectedAgent.id)
    : [];

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas text-text-primary relative">
      <NavRail activeId={activeRoute} onNavigate={setActiveRoute} />

      <main className="flex-1 ml-16 flex flex-col relative">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-8 shrink-0 z-10 w-full relative">
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-medium">Nexus</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-primary font-semibold capitalize font-mono">
              {activeRoute.replace('review', 'review room')}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 spatial-panel hover:bg-white/[0.05] transition-colors text-xs text-text-muted"
            >
              Search... <kbd className="font-mono bg-white/[0.05] px-1 rounded">⌘K</kbd>
            </button>
            <TimeRangePicker />

            <div className="w-px h-6 bg-border mx-1" />

            {/* Notifications */}
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className={cn(
                "p-2 rounded-lg transition-all duration-200 relative",
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
                "p-2 rounded-lg transition-all duration-200",
                settingsOpen ? "bg-aurora-teal/20 text-aurora-teal" : "text-text-muted hover:text-text-primary hover:bg-white/[0.05]"
              )}
            >
              <Settings className="w-4.5 h-4.5" />
            </button>

            {/* User Avatar */}
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center transition-colors",
                profileOpen ? "bg-aurora-teal/20 border-aurora-teal/50" : "bg-surface-raised border-border hover:border-aurora-teal/50"
              )}
            >
              <User className="w-4 h-4 text-aurora-teal" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 relative no-scrollbar pb-8">
          {activeRoute === 'overview' && (
            <OverviewView
              agents={agents}
              tasks={tasks}
              logData={logs}
              loading={loadingAgents || loadingTasks || loadingLogs}
              usingMock={usingMock}
              addOptimistic={addOptimistic}
              onOpenDetail={openAgentWorkspace}
              onQuickDispatch={(agentId) => openAgentWorkspace(agentId, { mode: 'dispatch' })}
            />
          )}
          {activeRoute === 'review' && <ReviewRoomView />}
          {activeRoute === 'reports' && <ReportsView />}
          {activeRoute === 'intelligence' && <IntelligenceView />}
        </div>
      </main>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} onExecute={(item) => handleAction(item?.action)} />
      
      <NotificationsPanel notificationsOpen={notificationsOpen} setNotificationsOpen={setNotificationsOpen} onNavigate={handleAction} />
      <SettingsPanel settingsOpen={settingsOpen} setSettingsOpen={setSettingsOpen} />
      <UserProfilePanel profileOpen={profileOpen} setProfileOpen={setProfileOpen} onAction={handleAction} />

      <AnimatePresence>
        {/* <DoctorModePanel /> */}
        {selectedAgent && (
          <DetailPanel
            agent={selectedAgent}
            tasks={selectedAgentTasks}
            logs={selectedAgentLogs}
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
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

export default App;
