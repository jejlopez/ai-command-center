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
      <div className="relative flex items-center gap-1 min-w-0 w-full overflow-x-auto no-scrollbar px-1">
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
                'group relative flex items-center gap-1.5 rounded-[1rem] px-2.5 py-2 text-[12px] font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40 xl:px-3.5 xl:text-[13px]',
                isActive ? 'text-text-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {isActive && (
                <Motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-[1rem] bg-panel-soft/65"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
              )}
              {isActive && (
                <>
                  <span className="pointer-events-none absolute inset-0 rounded-[1rem] opacity-45 [background:radial-gradient(circle_at_50%_0%,color-mix(in_srgb,var(--color-hairline-soft)_85%,transparent),transparent_56%)]" />
                  <span className="pointer-events-none absolute inset-x-[1px] inset-y-[1px] rounded-[calc(1rem-1px)] [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-hairline-soft)_45%,transparent),inset_0_-8px_14px_rgba(0,0,0,0.05)]" />
                  <span className="pointer-events-none absolute inset-x-3 bottom-[5px] h-px rounded-full bg-[color-mix(in_srgb,var(--color-aurora-teal)_62%,transparent)]" />
                </>
              )}

              <span className="relative z-10 flex items-center gap-2">
                <item.icon className={cn('w-3.5 h-3.5 transition-colors', isActive ? 'text-aurora-teal' : 'text-text-muted group-hover:text-text-primary')} />
                <span className={cn('tracking-[0.01em]', item.id === 'managedOps' && 'hidden lg:inline', isActive ? 'text-text' : 'text-text-muted')}>{item.label}</span>
                <span className={cn('tracking-[0.01em] lg:hidden', item.id === 'managedOps' ? 'inline' : 'hidden', isActive ? 'text-text' : 'text-text-muted')}>Managed</span>
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
