import React from 'react';
import { LayoutGrid, BrainCircuit, FileText, Target, Workflow } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { useSystemState } from '../context/SystemStateContext';

const items = [
  { id: 'overview', icon: LayoutGrid, label: 'Command Center' },
  { id: 'missions', icon: Target, label: 'Mission Control' },
  { id: 'managedOps', icon: Workflow, label: 'Managed Ops' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'intelligence', icon: BrainCircuit, label: 'Intelligence' },
];

export function NavRail({ activeId, onNavigate }) {
  const { pendingCount } = useSystemState();

  return (
    <nav className="flex items-center justify-center min-w-0 w-full max-w-full">
      <div className="relative flex items-center gap-1 min-w-0 w-full overflow-x-auto no-scrollbar rounded-[1.2rem] border border-white/[0.05] bg-black/20 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        {items.map((item) => {
          const showBadge = item.id === 'missions' && pendingCount > 0;
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-label={item.label}
              className={cn(
                'group relative flex items-center gap-1.5 rounded-[0.95rem] px-2.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40 xl:px-3.5 xl:text-[13px]',
                isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {isActive && (
                <Motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-[0.95rem] bg-white/[0.06] ring-1 ring-white/[0.06]"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}

              <span className="relative z-10 flex items-center gap-2">
                <item.icon className={cn('w-3.5 h-3.5 transition-colors', isActive ? 'text-aurora-teal' : 'text-text-muted/55 group-hover:text-text-primary')} />
                <span className={cn('tracking-[0.01em]', item.id === 'managedOps' && 'hidden lg:inline', isActive && 'text-white')}>{item.label}</span>
                <span className={cn('tracking-[0.01em] lg:hidden', item.id === 'managedOps' ? 'inline' : 'hidden', isActive && 'text-white')}>Managed</span>
              </span>

              <AnimatePresence>
                {showBadge && (
                  <Motion.span
                    key={`${item.id}-badge`}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="relative z-10 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-aurora-amber text-black text-[10px] font-mono font-bold leading-none shadow-[0_0_16px_rgba(251,191,36,0.28)]"
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </Motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
