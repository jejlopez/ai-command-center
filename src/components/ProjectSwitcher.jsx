import { useRef, useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown, Cpu, LayoutGrid, Pencil, Plug, Plus } from 'lucide-react';
import { useWorkspaces } from '../context/WorkspaceContext';
import { useAgents, useConnectedSystems } from '../utils/useSupabase';
import { cn } from '../utils/cn';
import { WorkspaceFormModal } from './WorkspaceFormModal';

export function ProjectSwitcher({ compact = false, onWorkspaceCreated }) {
  const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspaces();
  const { agents } = useAgents(activeWorkspace?.id);
  const { connectedSystems } = useConnectedSystems(activeWorkspace?.id);
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
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

  function handleEdit(e, ws) {
    e.preventDefault();
    e.stopPropagation();
    setEditingWorkspace(ws);
    setFormMode('edit');
    setFormOpen(true);
    setOpen(false);
  }

  function handleCreate() {
    setEditingWorkspace(null);
    setFormMode('create');
    setFormOpen(true);
    setOpen(false);
  }

  function handleSwitch(ws) {
    setActiveWorkspace(ws.id);
    setOpen(false);
  }

  function handleCreated(newWs) {
    onWorkspaceCreated?.(newWs);
  }

  const displayName = activeWorkspace?.name || 'Jarvis Command';

  return (
    <>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-label="Open workspace switcher"
          className={cn(
            compact
              ? 'relative flex items-center gap-2 overflow-hidden rounded-xl px-2.5 py-2 text-left text-white transition-all duration-200 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40'
              : 'flex items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all duration-200 border min-w-[120px] max-w-[120px]',
            compact
              ? open && 'bg-white/[0.05]'
              : open
                ? 'bg-aurora-teal/10 border-aurora-teal/30 text-white'
                : 'bg-white/[0.03] border-white/6 text-white hover:bg-white/[0.06] hover:border-aurora-teal/16'
          )}
        >
          {compact ? (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-aurora-blue">
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
                  {displayName.replace(' Command', '').slice(0, 10)}
                </span>
              </div>
            ) : (
              <p className="text-[11px] font-medium truncate leading-tight text-text-primary">
                {displayName.replace(' Command', '')}
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
              className="absolute left-0 top-full z-[60] mt-2 w-[280px] overflow-hidden rounded-2xl border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,14,18,0.96),rgba(10,12,15,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.32)]"
            >
              <div className="px-4 pt-3 pb-2 border-b border-white/[0.06]">
                <span className="deck-kicker text-[10px] font-medium uppercase">Workspaces</span>
              </div>

              {/* Workspace list */}
              <div className="px-2 py-2 max-h-[240px] overflow-y-auto no-scrollbar space-y-1">
                {workspaces.map((ws) => {
                  const isActive = ws.id === activeWorkspace?.id;

                  return (
                    <div
                      key={ws.id}
                      className={cn(
                        'group flex items-center gap-2 rounded-xl transition-all duration-150',
                        isActive ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleSwitch(ws)}
                        className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                      >
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: ws.color || '#00D9C8' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-text-primary">{ws.name}</div>
                          <div className="mt-0.5 truncate text-[10px] text-text-muted">
                            {ws.description || (isActive ? 'Current workspace' : 'Switch to this workspace')}
                          </div>
                        </div>
                        {isActive && <Check className="h-4 w-4 shrink-0 text-aurora-teal" />}
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => handleEdit(e, ws)}
                        onClick={(e) => handleEdit(e, ws)}
                        className="mr-2 shrink-0 rounded-lg p-1.5 text-text-muted transition-all hover:bg-white/[0.08] hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                        aria-label={`Edit ${ws.name}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* New workspace button */}
              <div className="px-2 pb-2 border-t border-white/[0.06] pt-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-text-muted transition-all hover:bg-aurora-teal/[0.06] hover:text-aurora-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Workspace
                </button>
              </div>

              {/* Stats for active workspace */}
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <div className="deck-panel-soft px-3 py-3 ring-1 ring-white/[0.05]">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                    <Cpu className="h-3.5 w-3.5 text-aurora-blue" />
                    Agents
                  </div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{agents.length}</div>
                </div>
                <div className="deck-panel-soft px-3 py-3 ring-1 ring-white/[0.05]">
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

      <WorkspaceFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        workspace={editingWorkspace}
        onCreated={handleCreated}
      />
    </>
  );
}
