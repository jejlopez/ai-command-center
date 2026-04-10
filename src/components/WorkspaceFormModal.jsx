import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Plus, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { useWorkspaces } from '../context/WorkspaceContext';

const PRESET_COLORS = [
  { value: '#00D9C8', label: 'Teal', className: 'bg-aurora-teal' },
  { value: '#a78bfa', label: 'Violet', className: 'bg-aurora-violet' },
  { value: '#f43f5e', label: 'Rose', className: 'bg-aurora-rose' },
  { value: '#fbbf24', label: 'Amber', className: 'bg-aurora-amber' },
  { value: '#60a5fa', label: 'Blue', className: 'bg-aurora-blue' },
  { value: '#34d399', label: 'Green', className: 'bg-emerald-400' },
];

export function WorkspaceFormModal({ open, onClose, mode = 'create', workspace = null, onCreated }) {
  const { workspaces, createWorkspace, updateWorkspace, deleteWorkspace, cloneWorkspaceData } = useWorkspaces();
  const [name, setName] = useState('');
  const [color, setColor] = useState('#00D9C8');
  const [description, setDescription] = useState('');
  const [cloneFromId, setCloneFromId] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (mode === 'edit' && workspace) {
      setName(workspace.name);
      setColor(workspace.color);
      setDescription(workspace.description || '');
    } else {
      setName('');
      setColor('#00D9C8');
      setDescription('');
      setCloneFromId('');
    }
    setConfirmDelete(false);
    setError(null);
  }, [mode, workspace, open]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      if (mode === 'edit' && workspace) {
        await updateWorkspace(workspace.id, { name, color, description });
        onClose();
      } else {
        const newWs = await createWorkspace({ name, color, description });
        if (cloneFromId) {
          await cloneWorkspaceData(cloneFromId, newWs.id);
        }
        onCreated?.(newWs);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await deleteWorkspace(workspace.id);
      onClose();
    } catch (err) {
      setError(err.message || 'Cannot delete workspace');
    } finally {
      setSaving(false);
    }
  }

  const cloneableWorkspaces = workspaces.filter(w => mode === 'create' || w.id !== workspace?.id);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/25 backdrop-blur-sm"
            onClick={onClose}
          />
          <Motion.div
            initial={{ opacity: 0, x: 320 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 320 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed right-0 top-0 bottom-0 z-[71] flex w-[400px] max-w-[96vw] flex-col border-l border-hairline bg-canvas shadow-[-18px_0_60px_rgba(0,0,0,0.1)]"
          >
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between px-6 py-5 border-b border-hairline">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-xl border',
                  mode === 'create'
                    ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                    : 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet'
                )}>
                  {mode === 'create' ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                </div>
                <h2 className="text-sm font-semibold text-text-primary">
                  {mode === 'create' ? 'New Workspace' : 'Edit Workspace'}
                </h2>
              </div>
              <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-panel-soft transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="shrink-0 border-b border-hairline px-6 py-3 text-[11px] text-text-muted">
              Scroll to edit colors, description, and delete options.
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {mode === 'edit' && workspace?.isDefault && (
                <div className="rounded-2xl border border-aurora-blue/15 bg-aurora-blue/[0.05] p-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-aurora-blue">Default Workspace</div>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    This workspace can be renamed and recolored, but it cannot be deleted.
                  </p>
                </div>
              )}

              {/* Name */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-medium">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, 40))}
                  placeholder="e.g. Production Ops"
                  className="w-full rounded-xl border border-hairline-strong ui-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 outline-none focus:border-aurora-teal/30 focus:ring-1 focus:ring-aurora-teal/20 transition-all"
                  autoFocus
                  required
                />
                <p className="text-[10px] text-text-muted">{name.length}/40</p>
              </div>

              {/* Color */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-medium">Color</label>
                <div className="flex gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setColor(preset.value)}
                      className={cn(
                        'h-8 w-8 rounded-full transition-all duration-200 flex items-center justify-center',
                        preset.className,
                        color === preset.value
                          ? 'ring-2 ring-offset-2 ring-offset-canvas ring-white scale-110'
                          : 'opacity-60 hover:opacity-100 hover:scale-105'
                      )}
                      title={preset.label}
                    >
                      {color === preset.value && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 200))}
                  placeholder="What is this workspace for?"
                  rows={3}
                  className="w-full rounded-xl border border-hairline-strong ui-well px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted/50 outline-none focus:border-aurora-teal/30 focus:ring-1 focus:ring-aurora-teal/20 transition-all resize-none"
                />
                <p className="text-[10px] text-text-muted">{description.length}/200</p>
              </div>

              {/* Clone from (create mode only) */}
              {mode === 'create' && cloneableWorkspaces.length > 0 && (
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.16em] text-text-muted font-medium flex items-center gap-1.5">
                    <Copy className="h-3 w-3" />
                    Clone from
                  </label>
                  <select
                    value={cloneFromId}
                    onChange={(e) => setCloneFromId(e.target.value)}
                    className="w-full rounded-xl border border-hairline-strong ui-well px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-aurora-teal/30 transition-all"
                  >
                    <option value="">Start fresh (no clone)</option>
                    {cloneableWorkspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted">Copies MCP servers, directives, and knowledge namespaces</p>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-3.5 py-2.5 text-xs text-aurora-rose">
                  {error}
                </div>
              )}

              {mode === 'edit' && workspace && !workspace.isDefault && (
                <div className="rounded-2xl border border-aurora-rose/15 bg-aurora-rose/[0.05] p-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-aurora-rose">Danger Zone</div>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    Deleting this workspace removes its agents, tasks, systems, directives, and knowledge for this workspace.
                  </p>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className={cn(
                      'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all',
                      confirmDelete
                        ? 'border-aurora-rose/30 bg-aurora-rose/20 text-aurora-rose'
                        : 'border-aurora-rose/20 text-aurora-rose hover:bg-aurora-rose/10'
                    )}
                  >
                    <Trash2 className="h-4 w-4" />
                    {confirmDelete ? 'Click Again to Delete Workspace' : 'Delete Workspace'}
                  </button>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className={cn(
                    'flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                    'bg-aurora-teal/20 text-aurora-teal border border-aurora-teal/30',
                    'hover:bg-aurora-teal/30',
                    'disabled:opacity-40 disabled:cursor-not-allowed'
                  )}
                >
                  {saving ? 'Saving...' : mode === 'create' ? 'Create Workspace' : 'Save Changes'}
                </button>
              </div>
            </form>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
    ,
    document.body
  );
}
