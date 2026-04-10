import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Cpu, Plus, Sparkles, X } from 'lucide-react';
import { createAgent, createModelBankEntry, useModelBank } from '../utils/useSupabase';
import { getTemplateForRole } from '../utils/agentInstructions';
import { cn } from '../utils/cn';

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
const TEMPERATURE_OPTIONS = [
  { value: 0.1, label: 'Precise' },
  { value: 0.7, label: 'Balanced' },
  { value: 1.2, label: 'Creative' },
];
const RESPONSE_OPTIONS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

function SectionShell({ eyebrow, title, description, children }) {
  return (
    <section className="jarvis-column overflow-hidden rounded-[1.35rem] px-5 py-5">
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{eyebrow}</div>
        <h3 className="mt-2 text-base font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-1 text-sm leading-6 text-text-body">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SummaryChip({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="min-w-0 rounded-[1.15rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.012))] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{label}</div>
      <div className={cn('mt-2 truncate text-lg font-semibold tracking-[-0.02em]', tone)}>{value}</div>
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors',
            value === option.value
              ? 'border-aurora-teal/30 bg-aurora-teal/10 text-aurora-teal'
              : 'border-white/[0.08] bg-white/[0.03] text-text-body hover:bg-white/[0.05] hover:text-text-primary'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CapabilityBadge({ children }) {
  return (
    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-text-body">
      {children}
    </span>
  );
}

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
    systemPrompt: getTemplateForRole(defaultRole.id),
    canSpawn: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [newModel, setNewModel] = useState({ label: '', provider: '', costPer1k: '' });
  const [addingModel, setAddingModel] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('All');

  const providerGroups = useMemo(() => {
    const groups = models.reduce((acc, model) => {
      const provider = model.provider || 'Custom';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  const visibleModels = useMemo(() => {
    if (selectedProvider === 'All') return models;
    return models.filter((model) => (model.provider || 'Custom') === selectedProvider);
  }, [models, selectedProvider]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleRoleSelect = (role) => {
    update('role', role.id);
    const prevRole = ROLE_OPTIONS.find((r) => r.id === form.role);
    if (!form.roleDescription || form.roleDescription === prevRole?.defaultDesc) {
      update('roleDescription', role.defaultDesc);
    }
    const prevTemplate = getTemplateForRole(form.role);
    if (!form.systemPrompt || form.systemPrompt === prevTemplate) {
      update('systemPrompt', getTemplateForRole(role.id));
    }
  };

  const resetForm = () => {
    setForm({
      name: '',
      model: '',
      role: defaultRole.id,
      roleDescription: defaultRole.defaultDesc,
      color: '#60a5fa',
      temperature: 0.7,
      responseLength: 'medium',
      systemPrompt: getTemplateForRole(defaultRole.id),
      canSpawn: false,
    });
    setSelectedProvider('All');
    setNewModel({ label: '', provider: '', costPer1k: '' });
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.model.trim()) return;

    setSaving(true);
    setError(null);

    try {
      onCreated?.(form);
      await createAgent(form);
      onClose();
      resetForm();
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
      setSelectedProvider(saved.provider || 'Custom');
      setNewModel({ label: '', provider: '', costPer1k: '' });
    } catch (err) {
      setError(err.message || 'Failed to save model');
    } finally {
      setAddingModel(false);
    }
  };

  const promptMode = form.systemPrompt === getTemplateForRole(form.role) ? 'Role template' : 'Custom';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-50 flex h-full w-[560px] flex-col border-l border-white/[0.06] bg-[#0a0a0a]/95 backdrop-blur-xl"
          >
            <div className="border-b border-white/[0.06] px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-aurora-teal/20 bg-aurora-teal/10">
                    <Plus className="h-5 w-5 text-aurora-teal" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Add Operator</h2>
                    <p className="text-[11px] text-text-body">Creation now follows the same setup language as configuration.</p>
                  </div>
                </div>
                <button onClick={onClose} className="rounded-lg p-2 text-text-body transition-colors hover:bg-white/[0.05] hover:text-text-primary">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-6 no-scrollbar">
              <div className="rounded-[1.4rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-aurora-teal">
                    <Sparkles className="h-3.5 w-3.5" />
                    New Operator
                  </div>
                  <CapabilityBadge>{ROLE_OPTIONS.find((r) => r.id === form.role)?.label || 'Role'}</CapabilityBadge>
                  <CapabilityBadge>{form.canSpawn ? 'Can delegate' : 'Solo by default'}</CapabilityBadge>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
                  <SummaryChip label="Identity" value={form.name || 'Unnamed'} tone={form.name ? 'text-text-primary' : 'text-text-body'} />
                  <SummaryChip label="Runtime" value={form.model || 'Needs model'} tone={form.model ? 'text-text-primary' : 'text-aurora-amber'} />
                  <SummaryChip label="Behavior" value={`${form.temperature.toFixed(1)} · ${form.responseLength}`} tone="text-aurora-teal" />
                  <SummaryChip label="Prompt" value={promptMode} tone={promptMode === 'Role template' ? 'text-aurora-blue' : 'text-aurora-violet'} />
                </div>
              </div>

              <SectionShell
                eyebrow="Identity"
                title="Define the operator"
                description="Name the operator, choose its role, and set the accent that will identify it across the workspace."
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Agent name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder="e.g. Helios, Phantom, Aegis..."
                      className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm font-mono text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-aurora-teal/40"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Role</label>
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => handleRoleSelect(role)}
                          className={cn(
                            'w-full rounded-2xl border px-4 py-3 text-left transition-all',
                            form.role === role.id
                              ? 'border-aurora-teal/30 bg-aurora-teal/10'
                              : 'border-white/[0.06] bg-black/10 hover:border-white/[0.12]'
                          )}
                        >
                          <div className={cn('text-sm font-semibold', form.role === role.id ? 'text-aurora-teal' : 'text-text-primary')}>
                            {role.label}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-text-body">{role.defaultDesc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Role description</label>
                    <textarea
                      value={form.roleDescription}
                      onChange={(e) => update('roleDescription', e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-aurora-teal/40"
                      placeholder="Customize what this agent specializes in..."
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Accent color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => update('color', color)}
                          className={cn(
                            'h-9 w-9 rounded-full border-2 transition-all',
                            form.color === color ? 'scale-110 border-white' : 'border-transparent opacity-70 hover:opacity-100'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                eyebrow="Runtime"
                title="Choose the execution model"
                description="Use the same model-bank patterns as the setup screen so creation and tuning feel like one workflow."
              >
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Selected runtime</div>
                    <div className="mt-2 text-base font-semibold text-text-primary">{form.model || 'No model selected yet'}</div>
                  </div>

                  <SegmentedControl
                    options={[{ value: 'All', label: 'All' }, ...providerGroups.map(([provider]) => ({ value: provider, label: provider }))]}
                    value={selectedProvider}
                    onChange={setSelectedProvider}
                  />

                  {models.length > 0 ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {visibleModels.map((model) => (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => {
                              update('model', model.modelKey);
                              setSelectedProvider(model.provider || 'Custom');
                            }}
                            className={cn(
                              'flex items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left text-xs font-mono transition-all',
                              form.model === model.modelKey
                                ? 'border-aurora-teal/30 bg-aurora-teal/10 shadow-[0_0_18px_rgba(0,217,200,0.08)]'
                                : 'border-white/[0.06] bg-black/10 hover:border-white/[0.12]'
                            )}
                          >
                            <span className="truncate text-text-primary">{model.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-[9px] text-text-muted">{model.provider}</span>
                              <Cpu className={cn('h-3.5 w-3.5', form.model === model.modelKey ? 'text-aurora-teal' : 'text-text-disabled')} />
                            </div>
                          </button>
                        ))}
                      </div>
                      {visibleModels.length === 0 && (
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-xs text-text-body">
                          No models saved for this provider yet.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs text-text-body">
                      No models in your bank yet. Add one below to make it available here.
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Add to model bank</div>
                    <input
                      type="text"
                      value={newModel.label}
                      onChange={(e) => setNewModel((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="Model ID or name"
                      className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-aurora-teal/40"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newModel.provider}
                        onChange={(e) => setNewModel((prev) => ({ ...prev, provider: e.target.value }))}
                        placeholder="Provider"
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-text-primary outline-none focus:border-aurora-teal/40"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={newModel.costPer1k}
                        onChange={(e) => setNewModel((prev) => ({ ...prev, costPer1k: e.target.value }))}
                        placeholder="Cost / 1k"
                        className="w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-text-primary outline-none focus:border-aurora-teal/40"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddModel}
                      disabled={addingModel || !newModel.label.trim()}
                      className="rounded-xl bg-aurora-teal px-3 py-2 text-[10px] font-bold text-black disabled:opacity-50"
                    >
                      {addingModel ? 'Saving…' : 'Save Model'}
                    </button>
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                eyebrow="Behavior"
                title="Tune response and orchestration defaults"
                description="These defaults mirror the same setup patterns you use when editing an existing operator."
              >
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Temperature</label>
                    <div className="flex items-center justify-between gap-3">
                      <SegmentedControl
                        options={TEMPERATURE_OPTIONS}
                        value={form.temperature}
                        onChange={(value) => update('temperature', value)}
                      />
                      <span className="text-sm font-mono text-aurora-teal">{form.temperature.toFixed(1)}</span>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-text-muted">Response length</label>
                    <SegmentedControl
                      options={RESPONSE_OPTIONS}
                      value={form.responseLength}
                      onChange={(value) => update('responseLength', value)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">Can spawn sub-agents</div>
                      <div className="mt-1 text-xs text-text-body">Allow this operator to create child agents for follow-on work.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => update('canSpawn', !form.canSpawn)}
                      className={cn(
                        'relative h-5 w-10 rounded-full transition-all',
                        form.canSpawn ? 'bg-aurora-teal' : 'bg-white/[0.1]'
                      )}
                    >
                      <motion.div
                        animate={{ x: form.canSpawn ? 20 : 2 }}
                        className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                </div>
              </SectionShell>

              <SectionShell
                eyebrow="Instructions"
                title="Start from the role template"
                description="Creation now begins from the same instruction model you can later refine in the setup tab."
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                    <ArrowUpRight className="h-3.5 w-3.5 text-aurora-blue" />
                    {promptMode === 'Role template' ? 'Using the role template' : 'Using a customized prompt'}
                  </div>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => update('systemPrompt', e.target.value)}
                    placeholder="You are an agent that..."
                    rows={5}
                    className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 text-text-primary placeholder:text-text-disabled outline-none transition-colors focus:border-aurora-teal/40"
                  />
                </div>
              </SectionShell>

              {error && (
                <div className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-4 py-3 text-xs text-aurora-rose">
                  {error}
                </div>
              )}
            </form>

            <div className="border-t border-white/[0.06] px-6 py-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-xl border border-white/[0.08] py-3 text-xs font-medium text-text-body transition-all hover:bg-white/[0.03] hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!form.name.trim() || !form.model.trim() || saving}
                  className={cn(
                    'flex-1 rounded-xl py-3 text-xs font-semibold transition-all flex items-center justify-center gap-2',
                    form.name.trim() && form.model.trim() && !saving
                      ? 'bg-aurora-teal text-black hover:bg-aurora-teal/90 active:scale-[0.98]'
                      : 'bg-white/[0.05] text-text-disabled cursor-not-allowed'
                  )}
                >
                  {saving ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
                      />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      Add Operator
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
