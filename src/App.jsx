import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { LayoutDashboard, Users, Activity, ListTodo, Database, Bell } from 'lucide-react';

import { OverviewView } from './views/OverviewView';
import { FleetView } from './views/FleetView';
import { AnalyticsView } from './views/AnalyticsView';
import { TasksView } from './views/TasksView';
import { HiveMemoryView } from './views/HiveMemoryView';
import { AgentLogDrawer } from './components/AgentLogDrawer';
import { ProjectSwitcher } from './components/ProjectSwitcher';
import { MOCK_PROJECT_DATA } from './utils/mockData';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [activeProject, setActiveProject] = useState('alpha');
  const [selectedAgentForLog, setSelectedAgentForLog] = useState(null);

  // Dynamic context loading across project
  const currentContext = MOCK_PROJECT_DATA[activeProject];

  const handleNewTask = (text) => {
    console.log("New Task via Relay: ", text);
  };

  const navItems = [
    { id: 'overview', icon: LayoutDashboard, label: 'Bento Command' },
    { id: 'fleet', icon: Users, label: 'Fleet Graph' },
    { id: 'hive', icon: Database, label: 'Memory Core' },
    { id: 'analytics', icon: Activity, label: 'Intelligence' },
    { id: 'tasks', icon: ListTodo, label: 'Pipeline' },
  ];

  return (
    <div className="flex h-screen w-screen bg-modern-bg text-modern-primary font-sans overflow-hidden">
      
      {/* Sleek Spatial Nav Rail */}
      <nav className="w-16 h-full border-r border-modern-border bg-modern-bg/50 backdrop-blur z-30 flex flex-col items-center py-6 gap-8 relative">
        <div className="w-10 h-10 rounded-xl bg-modern-panel flex justify-center items-center border border-white/5 shadow-sm">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </div>
        
        <div className="flex flex-col gap-4 w-full">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`relative w-full flex justify-center py-3 group transition-colors ${isActive ? 'text-white' : 'text-modern-muted hover:text-modern-accent'}`}
                title={item.label}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r"></div>}
                <Icon className="w-5 h-5" />
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col z-20 relative min-w-0 bg-mesh">
        {/* Spatial Top Bar */}
        <header className="h-20 px-8 flex justify-between items-center z-40">
          <div>
            {/* Title / Breadcrumb context */}
            <h1 className="font-sans text-xl text-white font-medium flex items-center gap-2">
              <span className="text-modern-muted">{activeProject} /</span>
              {navItems.find(n => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
             <ProjectSwitcher activeProject={activeProject} onChange={setActiveProject} />
          </div>

          <div className="flex items-center gap-4">
            <button className="relative p-2 text-modern-muted hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <div className="absolute top-2 right-2 w-2 h-2 bg-modern-accent rounded-full border-2 border-modern-bg"></div>
            </button>
            <div className="h-8 w-px bg-modern-border"></div>
            <div className="flex items-center gap-2 text-xs font-mono bg-modern-panel px-3 py-1.5 rounded-lg border border-modern-border text-modern-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-modern-success shadow-[0_0_8px_#10B981]"></div>
              System Ready
            </div>
          </div>
        </header>

        {/* Dynamic View Engine */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 min-h-0">
          <div className="max-w-7xl mx-auto h-full">
            {activeTab === 'overview' && <OverviewView context={currentContext} onAgentClick={setSelectedAgentForLog} />}
            {activeTab === 'fleet' && <FleetView context={currentContext} />}
            {activeTab === 'hive' && <HiveMemoryView context={currentContext} />}
            {activeTab === 'analytics' && <AnalyticsView context={currentContext} />}
            {activeTab === 'tasks' && <TasksView context={currentContext} />}
          </div>
        </div>
      </main>

      {/* Slide-out Terminal Logs */}
      <AgentLogDrawer agentName={selectedAgentForLog} onClose={() => setSelectedAgentForLog(null)} />
    </div>
  );
}

export default App;
