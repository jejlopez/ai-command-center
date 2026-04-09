import React from 'react';
import { LayoutGrid, BrainCircuit, FileText, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { useSystemState } from '../context/SystemStateContext';

const items = [
  { id: 'overview', icon: LayoutGrid, label: 'Overview' },
  { id: 'missions', icon: Target, label: 'Mission Control' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'intelligence', icon: BrainCircuit, label: 'Intelligence' },
];

export function NavRail({ activeId, onNavigate }) {
  const { pendingCount } = useSystemState();

  return (
    <nav className="flex items-center justify-center min-w-0">
      <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-[1.35rem] border border-white/[0.05] bg-white/[0.018] shadow-[inset_0_1px_0_rgba(255,255,255,0.02)] min-w-0 overflow-x-auto no-scrollbar">
        {items.map((item) => {
          const showBadge = item.id === 'missions' && pendingCount > 0;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group relative flex items-center gap-2 rounded-[0.95rem] px-3.5 py-2 text-[13px] font-medium whitespace-nowrap transition-colors',
                isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-[0.95rem] bg-white/[0.05] ring-1 ring-white/[0.07]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <item.icon className={cn('w-3.5 h-3.5 transition-colors', isActive ? 'text-aurora-teal' : 'text-text-muted/55 group-hover:text-text-primary')} />
                <span className={cn('tracking-[0.01em]', isActive && 'text-white')}>{item.label}</span>
              </span>

              <AnimatePresence>
                {showBadge && (
                  <motion.span
                    key={`${item.id}-badge`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="relative z-10 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-aurora-amber text-black text-[10px] font-mono font-bold leading-none"
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
