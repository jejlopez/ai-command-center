import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Sparkles } from 'lucide-react';
import { createAgent, createModelBankEntry, useModelBank } from '../utils/useSupabase';
import { cn } from '../utils/cn';

// ── Roles (Commander excluded — auto-seeded, one per workspace) ──
const ROLE_OPTIONS = [
  {
    id: 'researcher',
    label: 'Researcher',
    defaultDesc: 'Deep analysis, knowledge synthesis & autonomous data gathering across structured and unstructured sources',
  },
  {
    id: 'ui-agent',
    label: 'UI Agent',
    defaultDesc: 'Frontend implementation, design system enforcement & pixel-perfect component authoring',
  },
  {
    id: 'qa',
    label: 'QA',
    defaultDesc: 'Automated code review, regression testing & validation of agent outputs before approval',
  },
  {
    id: 'ops',
    label: 'Ops',
    defaultDesc: 'Infrastructure provisioning, deployment pipelines & runtime environment management',
  },
];

const COLOR_OPTIONS = ['#00D9C8', '#60a5fa', '#a78bfa', '#fb7185', '#fbbf24', '#34d399', '#f97316', '#ec4899'];

export function CreateAgentModal({ isOpen, onClose, onCreated }) {
  const { models, refetch: refetchModels } = useModelBank();
  const defaultRole = ROLE_OPTIONS[0];
  const [form, setForm] = useState({
    name: '',
    model: '',
    role: defaultRole.id,
    roleDescription: defaultRole.defaultDesc,
    color: '#60a5fa',
    temperature: 0.7,
    responseLength: 'medium',
    systemPrompt: '',
    canSpawn: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newModel, setNewModel] = useState({ label: '', provider: '', costPer1k: '' });
  const [addingModel, setAddingModel] = useState(false);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleRoleSelect = (role) => {
    update('role', role.id);
    // Only overwrite description if it's still the default for the previous role,
    // or if it's empty — preserve user edits
    const prevRole = ROLE_OPTIONS.find(r => r.id === form.role);
    if (!form.roleDescription || form.roleDescription === prevRole?.defaultDesc) {
      update('roleDescription', role.defaultDesc);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.model.trim()) return;

    setSaving(true);
    setError(null);

    try {
      // Fire optimistic callback immediately so card appears in the grid
      onCreated?.(form);

      // Then persist to Supabase
      await createAgent(form);
      onClose();
      // Reset form
      setForm({
        name: '', model: '', role: defaultRole.id,
        roleDescription: defaultRole.defaultDesc, color: '#60a5fa',
        temperature: 0.7, responseLength: 'medium',
        systemPrompt: '', canSpawn: false,
      });
    } catch (err) {
      setError(err.message || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  const handleAddModel = async () => {
    if (!newModel.label.trim()) return;
    setAddingModel(true);
    setError(null);

    try {
      const saved = await createModelBankEntry({
        label: newModel.label,
        modelKey: newModel.label,
        provider: newModel.provider,
        costPer1k: newModel.costPer1k || 0,
      });
      await refetchModels();
      update('model', saved.modelKey);
      setNewModel({ label: '', provider: '', costPer1k: '' });
    } catch (err) {
      setError(err.message || 'Failed to save model');
    } finally {
      setAddingModel(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Panel — slides from right */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[480px] bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-white/[0.06] z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-aurora-teal/10 flex items-center justify-center border border-aurora-teal/20">
                  <Plus className="w-5 h-5 text-aurora-teal" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Deploy Agent</h2>
                  <p className="text-[11px] text-text-muted">Add a new agent to the fleet</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 no-scrollbar">
              {/* Agent Name */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">Agent Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. Helios, Phantom, Aegis..."
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/50 transition-colors font-mono"
                  autoFocus
                />
              </div>

              {/* Model Selection — unified from modelRegistry */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">Model</label>
                {models.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-[9px] uppercase tracking-widest text-text-disabled mb-1.5 font-bold">Your Model Bank</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {models.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => update('model', m.modelKey)}
                          className={cn(
                            'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all text-left',
                            form.model === m.modelKey
                              ? 'bg-white/[0.06] border-white/[0.15] shadow-lg'
                              : 'bg-white/[0.015] border-white/[0.04] opacity-60 hover:opacity-100'
                          )}
                        >
                          <span className="truncate text-text-primary">{m.label}</span>
                          <span className="text-[9px] text-text-disabled shrink-0">{m.provider}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-text-muted">
                    No models in your bank yet. Add one below to make it available here.
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                  <div className="text-[9px] uppercase tracking-widest text-text-disabled font-bold">Add To Model Bank</div>
                  <input
                    type="text"
                    value={newModel.label}
                    onChange={(e) => setNewModel((prev) => ({ ...prev, label: e.target.value }))}
                    placeholder="Model ID or name"
                    className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-aurora-teal/40"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={newModel.provider}
                      onChange={(e) => setNewModel((prev) => ({ ...prev, provider: e.target.value }))}
                      placeholder="Provider"
                      className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-text-primary outline-none focus:border-aurora-teal/40"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newModel.costPer1k}
                      onChange={(e) => setNewModel((prev) => ({ ...prev, costPer1k: e.target.value }))}
                      placeholder="Cost / 1k"
                      className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-text-primary outline-none focus:border-aurora-teal/40"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddModel}
                    disabled={addingModel || !newModel.label.trim()}
                    className="rounded-lg bg-aurora-teal px-3 py-2 text-[10px] font-bold text-black disabled:opacity-50"
                  >
                    {addingModel ? 'Saving…' : 'Save Model'}
                  </button>
                </div>
              </div>

              {/* Role — with editable description */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">Role</label>
                <div className="space-y-1.5">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRoleSelect(r)}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl border text-left transition-all',
                        form.role === r.id
                          ? 'bg-aurora-teal/10 border-aurora-teal/30'
                          : 'bg-white/[0.015] border-white/[0.04] opacity-70 hover:opacity-100'
                      )}
                    >
                      <div className={cn(
                        'text-xs font-semibold',
                        form.role === r.id ? 'text-aurora-teal' : 'text-text-primary'
                      )}>
                        {r.label}
                      </div>
                      <div className="text-[10px] text-text-muted mt-0.5 leading-relaxed">{r.defaultDesc}</div>
                    </button>
                  ))}
                </div>

                {/* Editable role description */}
                <div className="mt-3">
                  <label className="text-[9px] uppercase tracking-widest text-text-disabled block mb-1">Role Description (editable)</label>
                  <textarea
                    value={form.roleDescription}
                    onChange={(e) => update('roleDescription', e.target.value)}
                    rows={2}
                    className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[11px] text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/50 transition-colors resize-none leading-relaxed"
                    placeholder="Customize what this agent specializes in..."
                  />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">Accent Color</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => update('color', c)}
                      className={cn(
                        'w-8 h-8 rounded-full border-2 transition-all',
                        form.color === c ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Temperature Slider */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[10px] uppercase tracking-widest text-text-muted">Temperature</label>
                  <span className="text-xs font-mono text-aurora-teal">{form.temperature.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  className="w-full accent-aurora-teal"
                />
                <div className="flex justify-between text-[9px] text-text-disabled mt-1">
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>

              {/* Response Length */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">Response Length</label>
                <div className="flex gap-2">
                  {['short', 'medium', 'long'].map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => update('responseLength', len)}
                      className={cn(
                        'flex-1 py-2 rounded-xl border text-xs capitalize transition-all',
                        form.responseLength === len
                          ? 'bg-white/[0.06] border-white/[0.12] text-text-primary'
                          : 'bg-white/[0.015] border-white/[0.04] text-text-muted'
                      )}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <label className="text-[10px] uppercase tracking-widest text-text-muted block mb-2">System Prompt</label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => update('systemPrompt', e.target.value)}
                  placeholder="You are an agent that..."
                  rows={4}
                  className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/50 transition-colors font-mono resize-none"
                />
              </div>

              {/* Can Spawn toggle */}
              <div className="flex items-center justify-between bg-white/[0.02] rounded-xl border border-white/[0.04] px-4 py-3">
                <div>
                  <span className="text-xs text-text-primary font-medium">Can Spawn Sub-agents</span>
                  <p className="text-[10px] text-text-muted mt-0.5">Allow this agent to create child agents</p>
                </div>
                <button
                  type="button"
                  onClick={() => update('canSpawn', !form.canSpawn)}
                  className={cn(
                    'w-10 h-5 rounded-full transition-all relative',
                    form.canSpawn ? 'bg-aurora-teal' : 'bg-white/[0.1]'
                  )}
                >
                  <motion.div
                    animate={{ x: form.canSpawn ? 20 : 2 }}
                    className="w-4 h-4 rounded-full bg-white absolute top-0.5"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </button>
              </div>

              {/* Error display */}
              {error && (
                <div className="bg-aurora-rose/10 border border-aurora-rose/20 rounded-xl px-4 py-3 text-xs text-aurora-rose">
                  {error}
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-white/[0.08] text-xs text-text-muted hover:text-text-primary hover:bg-white/[0.03] transition-all font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.name.trim() || saving}
                className={cn(
                  'flex-1 py-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2',
                  form.name.trim() && !saving
                    ? 'bg-aurora-teal text-black hover:bg-aurora-teal/90 active:scale-[0.98]'
                    : 'bg-white/[0.05] text-text-disabled cursor-not-allowed'
                )}
              >
                {saving ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full"
                    />
                    Deploying…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    Deploy Agent
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
