import React, { useMemo, useRef, useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Cpu, LayoutGrid, Plug, Plus, Settings2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWorkspaces } from '../context/WorkspaceContext';
import { useAgents, useConnectedSystems } from '../utils/useSupabase';
import { cn } from '../utils/cn';
import { WorkspaceFormModal } from './WorkspaceFormModal';

export function ProjectSwitcher({ compact = false }) {
  const { user } = useAuth();
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const { agents } = useAgents();
  const { connectedSystems } = useConnectedSystems();
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingWorkspace, setEditingWorkspace] = useState(null);
  const ref = useRef(null);

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
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: activeWorkspace?.color || '#00D9C8' }}
          />
        )}
        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-text-primary">
                {activeWorkspace?.name.split(' ')[0] || 'Jarvis'}
              </span>
            </div>
          ) : (
            <p className="text-[11px] font-medium truncate leading-tight text-text-primary">
              {(activeWorkspace?.name || 'Jarvis').replace(' Command', '')}
            </p>
          )}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-text-muted transition-transform', open && 'rotate-180 text-aurora-teal')} />
      </button>

      <WorkspaceFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        mode={modalMode}
        workspace={editingWorkspace}
      />

      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute left-0 top-full mt-2 w-[280px] rounded-2xl border border-border bg-surface shadow-lg z-[60] overflow-hidden"
          >
            <div className="px-4 pt-3 pb-3 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Workspaces</span>
                <p className="text-sm font-semibold text-text-primary mt-1">Select Operations Center</p>
              </div>
              <button
                onClick={() => {
                  setModalMode('create');
                  setEditingWorkspace(null);
                  setShowModal(true);
                  setOpen(false);
                }}
                className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5 text-text-muted transition-all hover:bg-aurora-teal/10 hover:text-aurora-teal hover:border-aurora-teal/20"
                title="New Workspace"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[320px] overflow-y-auto py-2 px-2 space-y-1 custom-scrollbar">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspace?.id;
                return (
                  <div
                    key={ws.id}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all cursor-pointer",
                      isActive
                        ? "bg-aurora-teal/10 shadow-[inset_0_0_20px_rgba(0,217,200,0.05)]"
                        : "hover:bg-white/[0.04]"
                    )}
                    onClick={() => {
                      setActiveWorkspace(ws.id);
                      setOpen(false);
                    }}
                  >
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: ws.color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={cn(
                        "text-sm font-medium transition-colors",
                        isActive ? "text-aurora-teal" : "text-text-primary group-hover:text-text-primary"
                      )}>
                        {ws.name}
                      </div>
                      <div className="mt-0.5 text-[10px] text-text-muted">
                        {ws.isDefault ? 'Primary Hub' : 'Operational Node'}
                      </div>
                    </div>
                    {isActive ? (
                      <Check className="w-4 h-4 text-aurora-teal shrink-0" />
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalMode('edit');
                          setEditingWorkspace(ws);
                          setShowModal(true);
                          setOpen(false);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.08] transition-all"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-1 border-t border-white/[0.06] bg-black/10 px-3 py-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/[0.06] bg-white/5 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    <Cpu className="h-3.5 w-3.5 text-aurora-blue" />
                    Agents
                  </div>
                  <div className="mt-2 text-lg font-semibold text-text-primary font-mono">{agents.length}</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/5 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    <Plug className="h-3.5 w-3.5 text-aurora-teal" />
                    Systems
                  </div>
                  <div className="mt-2 text-lg font-semibold text-text-primary font-mono">{connectedSystems.length}</div>
                </div>
              </div>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
