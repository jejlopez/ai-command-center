import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Cpu,
  Database,
  FolderOpen,
  Globe,
  Info,
  MessageSquare,
  Monitor,
  Plus,
  Search,
  Server,
  Sparkles,
  Terminal,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { getTemplateForRole } from '../../utils/agentInstructions';
import {
  createMcpServer,
  createModelBankEntry,
  createSkillBankEntry,
  deleteMcpServer,
  updateAgentConfig,
  updateAgentSkills,
  useMcpServers,
  useModelBank,
  useSkillBank,
} from '../../utils/useSupabase';

const iconMap = { Globe, Terminal, FolderOpen, Zap, Database, MessageSquare, Monitor };

function InfoBubble({ text }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-text-disabled transition-colors hover:text-text-muted"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-surface p-3 text-[11px] leading-relaxed text-text-body shadow-2xl pointer-events-none"
        >
          {text}
        </motion.div>
      )}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        'relative h-5 w-10 rounded-full transition-colors',
        value ? 'bg-aurora-teal' : 'bg-white/[0.08]'
      )}
    >
      <div
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-md transition-transform',
          value ? 'translate-x-[21px]' : 'translate-x-[2px]'
        )}
      />
    </button>
  );
}

function SectionShell({ eyebrow, title, description, children }) {
  return (
    <section className="jarvis-column overflow-hidden rounded-[1.4rem] px-5 py-5">
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{eyebrow}</div>
        <h3 className="mt-2 text-base font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-1 text-sm leading-6 text-text-body">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-text-primary">{label}</div>
        {description && <div className="mt-1 text-xs leading-5 text-text-body">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
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

const tempOptions = [
  { value: 0.1, label: 'Precise' },
  { value: 0.7, label: 'Balanced' },
  { value: 1.2, label: 'Creative' },
];

const responseOptions = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
  { value: 'unlimited', label: 'Unlimited' },
];

const spawnPatternOptions = [
  {
    id: 'fan-out',
    label: 'Fan-out / Fan-in',
    description: 'Run specialist work in parallel, then converge results back into one control path.',
  },
  {
    id: 'sequential',
    label: 'Sequential',
    description: 'Execute one specialist at a time for tighter handoff and lower coordination overhead.',
  },
  {
    id: 'persistent',
    label: 'Persistent',
    description: 'Keep helper agents alive between tasks when ongoing context matters more than cost.',
  },
];

export function SetupTab({ agent }) {
  const { models, loading: modelsLoading, refetch: refetchModels } = useModelBank();
  const { skills: skillBank, loading: skillsLoading, refetch: refetchSkills } = useSkillBank();
  const { servers: mcpServers, loading: mcpLoading, refetch: refetchMcpServers } = useMcpServers();

  const defaultState = useMemo(() => ({
    model: agent.model || '',
    temperature: agent.temperature ?? 0.7,
    responseLength: agent.responseLength ?? 'medium',
    systemPrompt: agent.systemPrompt ?? '',
    canSpawn: agent.canSpawn ?? false,
    spawnPattern: agent.spawnPattern ?? 'sequential',
  }), [agent]);

  const [form, setForm] = useState(defaultState);
  const [savedState, setSavedState] = useState(defaultState);
  const [agentSkillIds, setAgentSkillIds] = useState(agent.skills || []);
  const [selectedProvider, setSelectedProvider] = useState('All');
  const [newModelLabel, setNewModelLabel] = useState('');
  const [newModelProvider, setNewModelProvider] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [serverName, setServerName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [flash, setFlash] = useState('');
  const flashTimerRef = useRef(null);

  useEffect(() => {
    setForm(defaultState);
    setSavedState(defaultState);
    setAgentSkillIds(agent.skills || []);
    setSelectedProvider('All');
    setNewModelLabel('');
    setNewModelProvider('');
    setSearchInput('');
    setServerName('');
    setServerUrl('');
    setSaveError('');
    setFlash('');
  }, [defaultState, agent.skills]);

  useEffect(() => () => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
  }, []);

  const providerGroups = useMemo(() => {
    const groups = models.reduce((acc, modelItem) => {
      const provider = modelItem.provider || 'Custom';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(modelItem);
      return acc;
    }, {});
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [models]);

  const visibleModels = useMemo(() => {
    if (selectedProvider === 'All') return models;
    return models.filter((modelItem) => (modelItem.provider || 'Custom') === selectedProvider);
  }, [models, selectedProvider]);

  const attachedSkills = useMemo(
    () => skillBank.filter((skill) => agentSkillIds.includes(skill.id)),
    [skillBank, agentSkillIds]
  );
  const availableSkills = useMemo(
    () => skillBank.filter((skill) => !agentSkillIds.includes(skill.id)),
    [skillBank, agentSkillIds]
  );

  const normalizedSearch = searchInput.trim().toLowerCase();
  const isPath = searchInput.startsWith('/') || searchInput.startsWith('~');
  const isGithub = searchInput.includes('github.com');
  const filteredSkills = normalizedSearch && !isPath && !isGithub
    ? availableSkills.filter((skill) =>
        skill.name.toLowerCase().includes(normalizedSearch) ||
        skill.description.toLowerCase().includes(normalizedSearch)
      )
    : availableSkills.slice(0, 6);

  const defaultsApplied =
    form.model === savedState.model &&
    form.temperature === savedState.temperature &&
    form.responseLength === savedState.responseLength &&
    form.systemPrompt === savedState.systemPrompt &&
    form.canSpawn === savedState.canSpawn &&
    form.spawnPattern === savedState.spawnPattern;

  const dirty = !defaultsApplied;
  const template = getTemplateForRole(agent.role);
  const hasDefaultTemplate = template && form.systemPrompt === template;
  const instructionPosture = hasDefaultTemplate ? 'Role template' : 'Custom prompt';
  const delegationLabel = form.canSpawn
    ? spawnPatternOptions.find((option) => option.id === form.spawnPattern)?.label || 'Enabled'
    : 'Solo operator';

  const updateForm = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setSaveError('');
  };

  const showFlash = (message) => {
    setFlash(message);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(''), 2200);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateAgentConfig(agent.id, form);
      setSavedState(form);
      showFlash('Configuration saved');
    } catch (error) {
      setSaveError(error.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    setForm(savedState);
    setSaveError('');
  };

  const handleAddModel = async () => {
    if (!newModelLabel.trim()) return;
    try {
      const saved = await createModelBankEntry({
        label: newModelLabel,
        modelKey: newModelLabel,
        provider: newModelProvider,
      });
      await refetchModels();
      setSelectedProvider(saved.provider || 'Custom');
      updateForm({ model: saved.modelKey });
      setNewModelLabel('');
      setNewModelProvider('');
      showFlash('Model bank updated');
    } catch (error) {
      setSaveError(error.message || 'Failed to save model');
    }
  };

  const syncAgentSkills = async (nextSkills) => {
    try {
      setAgentSkillIds(nextSkills);
      await updateAgentSkills(agent.id, nextSkills);
      showFlash('Capabilities updated');
    } catch (error) {
      setAgentSkillIds(agent.skills || []);
      setSaveError(error.message || 'Failed to update skills');
    }
  };

  const handleCreateSkill = async () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;

    try {
      const source = isGithub ? 'github' : isPath ? 'local' : 'custom';
      const skill = await createSkillBankEntry({
        name: isGithub || isPath ? trimmed.split('/').filter(Boolean).pop() || trimmed : trimmed,
        description: source === 'custom' ? 'User-added custom skill' : `User-added ${source} skill`,
        source,
        reference: trimmed,
      });
      await refetchSkills();
      await syncAgentSkills([...(agentSkillIds || []), skill.id]);
      setSearchInput('');
    } catch (error) {
      setSaveError(error.message || 'Failed to create skill');
    }
  };

  const handleAddServer = async () => {
    try {
      await createMcpServer({ name: serverName, url: serverUrl });
      await refetchMcpServers();
      setServerName('');
      setServerUrl('');
      showFlash('MCP server saved');
    } catch (error) {
      setSaveError(error.message || 'Failed to save MCP server');
    }
  };

  const handleDeleteServer = async (serverId) => {
    try {
      await deleteMcpServer(serverId);
      await refetchMcpServers();
      showFlash('MCP server removed');
    } catch (error) {
      setSaveError(error.message || 'Failed to remove MCP server');
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6">
        <div className="rounded-[1.4rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-aurora-teal">
              <Sparkles className="h-3.5 w-3.5" />
              Setup
            </div>
            <CapabilityBadge>{agent.role}</CapabilityBadge>
            {agent.parentId && (
              <CapabilityBadge>
                <span className="inline-flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3" />
                  Parent linked
                </span>
              </CapabilityBadge>
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-4">
            <SummaryChip label="Runtime" value={form.model || 'Needs model'} tone={form.model ? 'text-text-primary' : 'text-aurora-amber'} />
            <SummaryChip label="Delegation" value={delegationLabel} tone={form.canSpawn ? 'text-aurora-teal' : 'text-text-primary'} />
            <SummaryChip label="Instructions" value={instructionPosture} tone={hasDefaultTemplate ? 'text-aurora-blue' : 'text-aurora-violet'} />
            <SummaryChip label="Capabilities" value={`${attachedSkills.length} skills · ${mcpServers.length} MCP`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <CapabilityBadge>{(agent.totalTokens || 0).toLocaleString()} tokens</CapabilityBadge>
            <CapabilityBadge>${(agent.totalCost || 0).toFixed(2)} total cost</CapabilityBadge>
            <CapabilityBadge>{agent.successRate || 0}% success</CapabilityBadge>
            <CapabilityBadge>{agent.latencyMs || 0}ms latency</CapabilityBadge>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          <SectionShell
            eyebrow="Runtime"
            title="Model routing and execution profile"
            description="Choose the runtime this operator should use and keep it aligned with your saved model bank."
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    options={[{ value: 'All', label: 'All' }, ...providerGroups.map(([provider]) => ({ value: provider, label: provider }))]}
                    value={selectedProvider}
                    onChange={setSelectedProvider}
                  />
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {visibleModels.map((modelItem) => (
                    <button
                      key={modelItem.id}
                      type="button"
                      onClick={() => updateForm({ model: modelItem.modelKey })}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none',
                        form.model === modelItem.modelKey
                          ? 'border-aurora-teal/30 bg-aurora-teal/10 shadow-[0_0_18px_rgba(0,217,200,0.08)]'
                          : 'border-white/[0.06] bg-black/10 hover:border-white/[0.12] hover:bg-white/[0.03]'
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text-primary">{modelItem.label}</div>
                          <div className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-text-muted">{modelItem.provider}</div>
                        </div>
                        <Cpu className={cn('h-4 w-4 shrink-0', form.model === modelItem.modelKey ? 'text-aurora-teal' : 'text-text-disabled')} />
                      </div>
                    </button>
                  ))}
                  {!modelsLoading && visibleModels.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-4 text-sm text-text-body">
                      No saved models for this provider yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Expand your model bank</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <input
                    type="text"
                    value={newModelLabel}
                    onChange={(event) => setNewModelLabel(event.target.value)}
                    placeholder="Model name"
                    className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                  />
                  <input
                    type="text"
                    value={newModelProvider}
                    onChange={(event) => setNewModelProvider(event.target.value)}
                    placeholder="Provider (optional)"
                    className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                  />
                  <button
                    type="button"
                    onClick={handleAddModel}
                    disabled={!newModelLabel.trim()}
                    className="rounded-xl bg-aurora-teal px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save model
                  </button>
                </div>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            eyebrow="Behavior"
            title="Response and delegation posture"
            description="Shape how deterministic this operator should be, how much it says, and how aggressively it should delegate."
          >
            <div className="space-y-3">
              <SettingRow
                label="Temperature"
                description="Lower values stay tighter and more repeatable. Higher values trade precision for creativity."
              >
                <div className="flex items-center gap-3">
                  <SegmentedControl
                    options={tempOptions.map((option) => ({ value: option.value, label: option.label }))}
                    value={form.temperature}
                    onChange={(value) => updateForm({ temperature: value })}
                  />
                  <span className="w-10 text-right font-mono text-xs text-text-muted">{form.temperature.toFixed(1)}</span>
                </div>
              </SettingRow>

              <SettingRow
                label="Response length"
                description="Keep answers proportional to the job and the operator’s role."
              >
                <SegmentedControl
                  options={responseOptions}
                  value={form.responseLength}
                  onChange={(value) => updateForm({ responseLength: value })}
                />
              </SettingRow>

              <SettingRow
                label="Allow sub-agents"
                description="Enable this only when the operator should orchestrate helpers instead of staying solo."
              >
                <Toggle value={form.canSpawn} onChange={(value) => updateForm({ canSpawn: value })} />
              </SettingRow>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="text-sm font-medium text-text-primary">Delegation pattern</div>
                  <InfoBubble text="Choose the orchestration shape the agent should follow when sub-agent spawning is enabled." />
                </div>
                <div className="space-y-2">
                  {spawnPatternOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => updateForm({ spawnPattern: option.id, canSpawn: true })}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none',
                        form.spawnPattern === option.id
                          ? 'border-aurora-teal/30 bg-aurora-teal/10'
                          : 'border-white/[0.06] bg-black/10 hover:border-white/[0.12]'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2',
                          form.spawnPattern === option.id ? 'border-aurora-teal bg-aurora-teal' : 'border-white/20'
                        )}
                      />
                      <div>
                        <div className="text-sm font-medium text-text-primary">{option.label}</div>
                        <div className="mt-1 text-xs leading-5 text-text-body">{option.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SectionShell>

          <SectionShell
            eyebrow="Instructions"
            title="System guidance and role alignment"
            description="Keep the operator close to its role template or deliberately override it when the mission requires a sharper posture."
          >
            <div className="space-y-3">
              <div className="commander-runtime-slab">
                <div className="commander-runtime-section">
                  <div className="commander-meta-label text-aurora-blue/90">Prompt posture</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{instructionPosture}</div>
                </div>
                <div className="commander-runtime-divider" />
                <div className="commander-runtime-section">
                  <div className="commander-meta-label text-aurora-violet/90">Approx tokens</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">~{Math.ceil(form.systemPrompt.length / 4)}</div>
                </div>
                <div className="commander-runtime-divider" />
                <div className="commander-runtime-section">
                  <div className="commander-meta-label text-aurora-teal/90">Characters</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{form.systemPrompt.length}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">System prompt</div>
                    <div className="mt-1 text-xs text-text-body">The full instruction envelope this operator carries into task execution.</div>
                  </div>
                  {agent.role !== 'commander' && template && (
                    <button
                      type="button"
                      onClick={() => updateForm({ systemPrompt: template })}
                      className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-white/[0.14] hover:text-text-primary"
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <textarea
                  value={form.systemPrompt}
                  onChange={(event) => updateForm({ systemPrompt: event.target.value })}
                  rows={8}
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                />
              </div>
            </div>
          </SectionShell>

          <SectionShell
            eyebrow="Capabilities"
            title="Skills and MCP attachments"
            description="Give this operator the right tools, references, and connected servers without burying those capabilities in secondary tabs."
          >
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">Attached capabilities</div>
                        <div className="mt-1 text-xs text-text-muted">Explicit, visible attachments currently available to this operator.</div>
                      </div>
                      <CapabilityBadge>{attachedSkills.length} attached</CapabilityBadge>
                    </div>
                    <div className="mt-4 space-y-2">
                      {attachedSkills.map((skill) => {
                        const Icon = iconMap[skill.icon] || Zap;
                        return (
                          <div key={skill.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/15 px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                                <Icon className="h-4 w-4 text-aurora-teal" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-text-primary">{skill.name}</div>
                                <div className="mt-1 truncate text-xs text-text-body">{skill.description || 'No description yet.'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CapabilityBadge>{skill.source}</CapabilityBadge>
                              <button
                                type="button"
                                onClick={() => syncAgentSkills(agentSkillIds.filter((skillId) => skillId !== skill.id))}
                                className="rounded-xl border border-white/[0.08] bg-black/20 p-2 text-text-muted transition-colors hover:border-aurora-rose/30 hover:text-aurora-rose"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!skillsLoading && attachedSkills.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-5 text-sm text-text-body">
                          No skills attached yet. Add a path, GitHub source, or an existing bank entry from the discovery panel.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text-primary">MCP servers</div>
                        <div className="mt-1 text-xs text-text-body">Persisted server endpoints available to this workspace. Health checks stay out of scope for this pass.</div>
                      </div>
                      <CapabilityBadge>{mcpServers.length} configured</CapabilityBadge>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]">
                      <input
                        type="text"
                        value={serverName}
                        onChange={(event) => setServerName(event.target.value)}
                        placeholder="Display name (optional)"
                        className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                      />
                      <input
                        type="text"
                        value={serverUrl}
                        onChange={(event) => setServerUrl(event.target.value)}
                        placeholder="Server URL"
                        className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                      />
                      <button
                        type="button"
                        onClick={handleAddServer}
                        disabled={!serverUrl.trim()}
                        className="rounded-xl bg-aurora-teal px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-black transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Connect
                      </button>
                    </div>

                    <div className="mt-4 space-y-2">
                      {mcpServers.map((server) => (
                        <div key={server.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/15 px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                              <Server className="h-4 w-4 text-aurora-blue" />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-text-primary">{server.name}</div>
                              <div className="mt-1 truncate font-mono text-[11px] text-text-body">{server.url}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <CapabilityBadge>{server.status}</CapabilityBadge>
                            <CapabilityBadge>{server.toolCount} tools</CapabilityBadge>
                            <button
                              type="button"
                              onClick={() => handleDeleteServer(server.id)}
                              className="rounded-xl border border-white/[0.08] bg-black/20 p-2 text-text-muted transition-colors hover:border-aurora-rose/30 hover:text-aurora-rose"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {!mcpLoading && mcpServers.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-5 text-sm text-text-body">
                          No MCP servers configured yet. Add one above to make it a first-class capability in this workspace.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className="text-sm font-medium text-text-primary">Discover and attach</div>
                    <div className="mt-1 text-xs text-text-body">Search the shared skill bank, or create a new skill from a local path, custom name, or GitHub reference.</div>

                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search skills, paste path, or GitHub URL..."
                        className="w-full rounded-2xl border border-white/[0.08] bg-black/20 py-3 pl-10 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
                      />
                    </div>

                    {(isPath || isGithub || (searchInput && filteredSkills.length === 0)) && (
                      <div className="mt-3 rounded-2xl border border-aurora-teal/20 bg-aurora-teal/5 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-aurora-teal">
                          {isGithub ? 'GitHub source detected' : isPath ? 'Local path detected' : 'Create custom capability'}
                        </div>
                        <div className="mt-2 break-all font-mono text-[11px] text-text-body">{searchInput}</div>
                        <button
                          type="button"
                          onClick={handleCreateSkill}
                          className="mt-3 rounded-xl bg-aurora-teal px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-black"
                        >
                          Save and attach
                        </button>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      {filteredSkills.map((skill) => {
                        const Icon = iconMap[skill.icon] || Zap;
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => syncAgentSkills([...(agentSkillIds || []), skill.id])}
                            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-black/15 px-4 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-white/[0.03]"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03]">
                                <Icon className="h-4 w-4 text-aurora-teal" />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium text-text-primary">{skill.name}</div>
                                <div className="mt-1 truncate text-xs text-text-body">{skill.description}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <CapabilityBadge>{skill.source}</CapabilityBadge>
                              <Plus className="h-4 w-4 text-aurora-teal" />
                            </div>
                          </button>
                        );
                      })}
                      {!skillsLoading && filteredSkills.length === 0 && !searchInput && (
                        <div className="rounded-2xl border border-dashed border-white/[0.08] px-4 py-5 text-sm text-text-body">
                          Your shared skill bank is empty. Paste a path or GitHub source above to seed it.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SectionShell>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.07] bg-canvas/80 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-6 items-center gap-2">
            {saveError && <span className="text-xs text-aurora-rose">{saveError}</span>}
            {!saveError && flash && <span className="text-xs text-aurora-teal">{flash}</span>}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleDiscard}
              className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-white/[0.14] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={handleSave}
              className="rounded-xl bg-aurora-teal px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#12e8da] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
