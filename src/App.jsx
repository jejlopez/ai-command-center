import React, { useState, useEffect } from 'react';
import { NavRail } from './components/NavRail';
import { CommandPalette } from './components/CommandPalette';
import { TimeRangePicker } from './components/TimeRangePicker';
import { DetailPanel } from './components/DetailPanel';
import { OverviewView } from './views/OverviewView';
import { TasksView } from './views/TasksView';
import { FleetView } from './views/FleetView';
import { ReportsView } from './views/ReportsView';
import { TimeRangeProvider } from './utils/useTimeRange';

function Dashboard() {
  const [activeRoute, setActiveRoute] = useState('overview');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [detailId, setDetailId] = useState(null);

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

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-canvas text-text-primary relative">
      <NavRail activeId={activeRoute} onNavigate={setActiveRoute} />
      
      <main className="flex-1 ml-16 flex flex-col relative overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-8 shrink-0 z-10 w-full relative">
          <div className="flex items-center gap-2">
            <span className="text-text-muted font-medium">Nexus</span>
            <span className="text-text-muted">/</span>
            <span className="text-text-primary font-semibold capitalize font-mono">
              {activeRoute.replace('pipeline', 'tasks')}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 spatial-panel hover:bg-white/[0.05] transition-colors text-xs text-text-muted"
            >
              Search... <kbd className="font-mono bg-white/[0.05] px-1 rounded">⌘K</kbd>
            </button>
            <TimeRangePicker />
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 relative no-scrollbar pb-8">
          {activeRoute === 'overview' && <OverviewView onOpenDetail={setDetailId} />}
          {activeRoute === 'pipeline' && <TasksView onOpenDetail={setDetailId} />}
          {activeRoute === 'fleet' && <FleetView onOpenDetail={setDetailId} />}
          {activeRoute === 'reports' && <ReportsView />}
          
          {/* Stubs for other routes */}
          {['memory', 'intelligence'].includes(activeRoute) && (
            <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
              <div className="text-4xl mb-4 opacity-20">⚙️</div>
              <div className="text-lg font-semibold">{activeRoute} under construction</div>
            </div>
          )}
        </div>
      </main>

      <CommandPalette isOpen={cmdOpen} onClose={() => setCmdOpen(false)} />
      
      <DetailPanel agentId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function App() {
  return (
    <TimeRangeProvider>
      <Dashboard />
    </TimeRangeProvider>
  );
}

export default App;
