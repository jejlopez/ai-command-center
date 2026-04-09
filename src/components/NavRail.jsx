import React from 'react';
import { LayoutGrid, BrainCircuit, FileText, Target } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
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
      <div className="relative flex items-center gap-1 px-1.5 py-1.5 rounded-[1.35rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_60px_rgba(0,0,0,0.25)] min-w-0 overflow-x-auto no-scrollbar before:pointer-events-none before:absolute before:inset-x-6 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent">
        <div className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(circle_at_50%_0%,rgba(45,212,191,0.08),transparent_35%)]" />
        <Motion.div
          initial={{ opacity: 0.15, x: '-30%' }}
          animate={{ opacity: 0.28, x: '130%' }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'linear' }}
          className="pointer-events-none absolute top-0 h-full w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-lg"
        />
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
                <Motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-[0.95rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] ring-1 ring-aurora-teal/18 shadow-[0_0_24px_rgba(45,212,191,0.08)]"
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
