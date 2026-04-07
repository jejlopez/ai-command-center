import React from 'react';
import { LayoutGrid, Network, BrainCircuit, BarChart3, GitBranch, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

const items = [
  { id: 'overview', icon: LayoutGrid, label: 'Overview' },
  { id: 'pipeline', icon: GitBranch, label: 'Pipeline' },
  { id: 'fleet', icon: Network, label: 'Agent Fleet' },
  { id: 'reports', icon: FileText, label: 'Monthly Reports' },
  { id: 'memory', icon: BrainCircuit, label: 'Memory Core' },
  { id: 'intelligence', icon: BarChart3, label: 'Intelligence' },
];

export function NavRail({ activeId, onNavigate }) {
  return (
    <nav className="w-16 fixed left-0 top-0 bottom-0 bg-canvas/80 backdrop-blur border-r border-border flex flex-col justify-between py-6 z-50">
      <div className="flex flex-col gap-4 items-center w-full">
        <div className="w-8 h-8 flex items-center justify-center font-bold text-lg text-white mb-4">
          N
        </div>
        
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="group relative w-12 h-12 flex flex-col items-center justify-center rounded-xl hover:bg-white/[0.04] transition-colors"
          >
            {activeId === item.id && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute left-0 w-[3px] h-6 bg-aurora-teal rounded-r-full"
                initial={false}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <item.icon
              className={`w-5 h-5 transition-colors ${
                activeId === item.id ? 'text-aurora-teal' : 'text-text-muted group-hover:text-text-primary'
              }`}
            />
            
            <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-surface text-text-primary text-xs font-medium rounded-md whitespace-nowrap opacity-0 -translate-x-4 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 border border-border">
              {item.label}
            </div>
          </button>
        ))}
      </div>
      
      <div className="flex items-center justify-center mb-4">
        <div className="relative flex items-center justify-center group cursor-pointer w-10 h-10">
          <div className="absolute w-4 h-4 bg-aurora-teal rounded-full opacity-20" />
          <div className="absolute w-4 h-4 bg-aurora-teal rounded-full animate-ping opacity-40" />
          <div className="w-2 h-2 bg-aurora-teal rounded-full z-10" />
          
          <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-surface text-text-primary text-xs font-medium rounded-md whitespace-nowrap opacity-0 -translate-x-4 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 border border-border">
            System Online
          </div>
        </div>
      </div>
    </nav>
  );
}
