import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check } from 'lucide-react';
import { cn } from '../utils/cn';

const projects = [
  { id: 'jarvis', name: 'Jarvis Command', agents: 7, color: 'bg-aurora-teal' },
  { id: 'atlas', name: 'Project Atlas', agents: 3, color: 'bg-aurora-violet' },
  { id: 'sentinel', name: 'Sentinel Ops', agents: 12, color: 'bg-aurora-amber' },
  { id: 'research', name: 'Research Lab', agents: 2, color: 'bg-aurora-green' },
];

export function ProjectSwitcher() {
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
    <div ref={ref} className="relative mb-4">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm transition-all duration-200 border',
          open
            ? 'bg-aurora-teal/20 border-aurora-teal/50 text-white'
            : 'bg-white/[0.04] border-transparent text-white hover:bg-white/[0.08] hover:border-aurora-teal/30'
        )}
      >
        {current?.name.charAt(0) || 'N'}
      </button>

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-full top-0 ml-3 w-[260px] bg-surface border border-border rounded-xl shadow-lg z-[60] overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2">
              <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">
                Workspaces
              </span>
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
