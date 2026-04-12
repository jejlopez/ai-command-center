import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Cpu, LayoutGrid, Plug } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAgents, useConnectedSystems } from '../utils/useSupabase';
import { cn } from '../utils/cn';

export function ProjectSwitcher({ compact = false }) {
  const { user } = useAuth();
  const { agents } = useAgents();
  const { connectedSystems } = useConnectedSystems();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const workspace = useMemo(() => {
    const name = user?.user_metadata?.full_name?.trim()
      ? `${user.user_metadata.full_name.trim()} Command`
      : 'Jarvis Command';

    return {
      id: 'command-center',
      name,
      subtitle: `${agents.length} agents • ${connectedSystems.length} systems`,
      color: 'bg-aurora-teal',
    };
  }, [agents.length, connectedSystems.length, user]);

  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (!open) return undefined;
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          compact
            ? 'relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-200 text-white hover:bg-white/[0.05] overflow-hidden'
            : 'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-200 border min-w-[120px] max-w-[120px]',
          compact
            ? open && 'bg-white/[0.05]'
            : open
              ? 'bg-aurora-teal/10 border-aurora-teal/30 text-white'
              : 'bg-white/[0.03] border-white/6 text-white hover:bg-white/[0.06] hover:border-aurora-teal/16'
        )}
      >
        {compact && (
          <Motion.div
            initial={{ opacity: 0.12, x: '-40%' }}
            animate={{ opacity: 0.24, x: '130%' }}
            transition={{ duration: 5.4, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute top-0 h-full w-10 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-md"
          />
        )}
        {compact ? (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue shadow-[0_0_24px_rgba(96,165,250,0.12)]">
            <LayoutGrid className="h-3.5 w-3.5" />
          </div>
        ) : (
          <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', workspace.color)} />
        )}
        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-text-primary">Jarvis</span>
            </div>
          ) : (
            <p className="text-[11px] font-medium truncate leading-tight text-text-primary">
              {workspace.name.replace(' Command', '')}
            </p>
          )}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform', open && 'rotate-180 text-aurora-teal')} />
      </button>

      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-full mt-2 w-[280px] rounded-2xl border border-border bg-surface shadow-lg z-[60] overflow-hidden"
          >
            <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Workspace</span>
              <p className="text-sm font-semibold text-text-primary mt-1">{workspace.name}</p>
              <p className="mt-1 text-[11px] text-text-muted">Single source of truth for this command center.</p>
            </div>

            <div className="px-2 py-2">
              <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-3 py-3">
                <div className={cn('w-2 h-2 rounded-full shrink-0', workspace.color)} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary">{workspace.name}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{workspace.subtitle}</div>
                </div>
                <Check className="w-4 h-4 text-aurora-teal shrink-0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <Cpu className="h-3.5 w-3.5 text-aurora-blue" />
                  Agents
                </div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{agents.length}</div>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-3">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                  <Plug className="h-3.5 w-3.5 text-aurora-teal" />
                  Systems
                </div>
                <div className="mt-2 text-lg font-semibold text-text-primary">{connectedSystems.length}</div>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
