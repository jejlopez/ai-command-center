import React from 'react';
import { LayoutGrid, BrainCircuit, FileText, Stethoscope, CheckSquare, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils/cn';
import { useSystemState } from '../context/SystemStateContext';
import { ProjectSwitcher } from './ProjectSwitcher';

const items = [
  { id: 'overview', icon: LayoutGrid, label: 'Overview' },
  { id: 'operations', icon: Activity, label: 'Fleet Operations' },
  { id: 'review', icon: CheckSquare, label: 'Review Room' },
  { id: 'reports', icon: FileText, label: 'Monthly Reports' },
  { id: 'intelligence', icon: BrainCircuit, label: 'Intelligence' },
];

export function NavRail({ activeId, onNavigate }) {
  const { doctorModeOpen, setDoctorModeOpen } = useSystemState();

  return (
    <nav className="w-16 fixed left-0 top-0 bottom-0 bg-canvas/80 backdrop-blur border-r border-border flex flex-col justify-between py-6 z-50">
      <div className="flex flex-col gap-4 items-center w-full">
        <ProjectSwitcher />
        
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
      
      <div className="mt-auto flex flex-col gap-2 items-center">
        {/* Medic (Doctor Mode) — sole bottom nav item */}
        <button
          onClick={() => setDoctorModeOpen(!doctorModeOpen)}
          className={cn(
            "p-3 rounded-xl transition-all duration-300 relative group cursor-pointer",
            doctorModeOpen ? "bg-aurora-teal/20 text-[#00FF41] shadow-glow" : "text-text-muted hover:bg-white/5"
          )}
        >
          <Stethoscope className="w-5 h-5 pointer-events-none" />
          <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-surface text-text-primary text-xs font-medium rounded-md whitespace-nowrap opacity-0 -translate-x-4 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 border border-border">
            Medic
          </div>
        </button>
      </div>
    </nav>
  );
}
