import React, { useState, useRef, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, ChevronDown } from 'lucide-react';
import { cn } from '../utils/cn';

const projects = [
  { id: 'jarvis', name: 'Jarvis Command', agents: 7, color: 'bg-aurora-teal' },
  { id: 'atlas', name: 'Project Atlas', agents: 3, color: 'bg-aurora-violet' },
  { id: 'sentinel', name: 'Sentinel Ops', agents: 12, color: 'bg-aurora-amber' },
  { id: 'research', name: 'Research Lab', agents: 2, color: 'bg-aurora-green' },
];

export function ProjectSwitcher({ compact = false }) {
  const [activeProject, setActiveProject] = useState('jarvis');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const current = projects.find((p) => p.id === activeProject);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          compact
            ? 'relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-200 text-white hover:bg-white/[0.05] overflow-hidden'
            : 'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-200 border min-w-[104px] max-w-[104px]',
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
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', current?.color || 'bg-aurora-teal')} />
        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.32em] text-text-muted">
                Jarvis
              </span>
            </div>
          ) : (
            <p className="text-[11px] font-medium truncate leading-tight text-text-primary">
              {current?.name?.replace(' Command', '') || 'Jarvis'}
            </p>
          )}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform', open && 'rotate-180 text-aurora-teal')} />
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-full mt-2 w-[260px] bg-surface border border-border rounded-2xl shadow-lg z-[60] overflow-hidden"
          >
            <div className="px-4 pt-3 pb-3 border-b border-white/[0.06]">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                Workspaces
              </span>
              <p className="text-sm font-semibold text-text-primary mt-1">
                {current?.name || 'Jarvis Command'}
              </p>
            </div>

            <div className="flex flex-col px-1.5 pb-1.5">
              {projects.map((project) => {
                const isActive = project.id === activeProject;
                return (
                  <button
                    key={project.id}
                    onClick={() => {
                      setActiveProject(project.id);
                      setOpen(false);
                    }}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors w-full',
                      isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full shrink-0', project.color)} />
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', isActive ? 'text-text-primary' : 'text-text-body')}>
                        {project.name}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        {project.agents} agents
                      </p>
                    </div>
                    {isActive && <Check className="w-4 h-4 text-aurora-teal shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="h-px bg-border mx-3" />

            <div className="px-1.5 py-1.5">
              <button className="flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors w-full hover:bg-white/[0.04] text-text-muted hover:text-text-primary">
                <Plus className="w-4 h-4" />
                <span className="text-sm">Create workspace</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
