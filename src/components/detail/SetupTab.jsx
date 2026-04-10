import { useEffect, useMemo, useRef, useState } from 'react';
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
import { useAuth } from '../../context/AuthContext';
import { useWorkspaces } from '../../context/WorkspaceContext';
import {
  createMcpServer,
  createModelBankEntry,
  createSkillBankEntry,
  deleteMcpServer,
  ensureCommanderAgent,
  updateAgentConfig,
  updateAgentSkills,
  useMcpServers,
  useModelBank,
  useProviderCredentials,
  useSkillBank,
} from '../../utils/useSupabase';
import { usePreferences } from '../../context/PreferenceContext';

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
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-hairline bg-panel-soft p-3 text-[11px] leading-relaxed text-text-body shadow-2xl pointer-events-none"
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
        value ? 'bg-aurora-teal' : 'ui-well'
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
    <section className="ui-panel overflow-hidden rounded-[1.4rem] px-5 py-5">
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
    <div className="ui-card-row flex items-center justify-between gap-4 px-4 py-3">
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
    <div className="ui-stat min-w-0 px-4 py-3">
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
            'ui-chip rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors',
            value === option.value
              ? 'border-aurora-teal/30 bg-aurora-teal/10 text-aurora-teal'
              : 'border-hairline bg-panel-soft/30 text-text-body hover:bg-panel-soft'
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
    <span className="ui-chip rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-text-body">
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

const providerQuickActions = [
  { id: 'anthropic', label: 'Anthropic default', model: 'Claude Opus 4.6' },
  { id: 'openai', label: 'OpenAI default', model: 'GPT-5.4' },
  { id: 'google', label: 'Google default', model: 'Gemini 3.1' },
];

function inferProviderFromModel(model = '') {
  const normalized = model.toLowerCase();
  if (normalized.includes('claude')) return 'anthropic';
  if (normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) return 'openai';
  if (normalized.includes('gemini')) return 'google';
  return 'custom';
}

function formatProviderLabel(providerKey = 'custom') {
  if (providerKey === 'anthropic') return 'Anthropic';
  if (providerKey === 'openai') return 'OpenAI';
  if (providerKey === 'google') return 'Google';
  return 'Custom';
}

export function SetupTab({ agent, onAgentUpdated }) {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspaces();
  const { models, loading: modelsLoading, refetch: refetchModels } = useModelBank();
  const { credentials: providerCredentials } = useProviderCredentials();
  const { skills: skillBank, loading: skillsLoading, refetch: refetchSkills } = useSkillBank();
  const { servers: mcpServers, loading: mcpLoading, refetch: refetchMcpServers } = useMcpServers();
  const commanderPrefs = usePreferences();

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
    setSelectedProvider(formatProviderLabel(inferProviderFromModel(defaultState.model || '')));
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

  const providerReadiness = useMemo(
    () => [
      { id: 'anthropic', label: 'Anthropic', ready: providerCredentials.anthropic, model: 'Claude Opus 4.6' },
      { id: 'openai', label: 'OpenAI', ready: providerCredentials.openai, model: 'GPT-5.4' },
      { id: 'google', label: 'Google', ready: providerCredentials.google, model: 'Gemini 3.1' },
    ],
    [providerCredentials]
  );
  const activeProvider = useMemo(() => inferProviderFromModel(form.model || ''), [form.model]);
  const activeProviderLabel = useMemo(
    () => providerReadiness.find((provider) => provider.id === activeProvider)?.label || 'Custom',
    [activeProvider, providerReadiness]
  );
  const selectedModelEntry = useMemo(
    () => models.find((modelItem) => modelItem.modelKey === form.model || modelItem.label === form.model) || null,
    [models, form.model]
  );

  const showFlash = (message) => {
    setFlash(message);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(''), 2200);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      let targetAgentId = agent.id;
      if (agent.isSyntheticCommander) {
        const commander = await ensureCommanderAgent(user, activeWorkspace?.id || null);
        targetAgentId = commander?.id || agent.id;
      }

      let normalizedForm = { ...form };
      let savedModel = null;
      if (form.model) {
        savedModel = await createModelBankEntry({
          label: form.model,
          modelKey: form.model,
        });
        normalizedForm = { ...normalizedForm, model: savedModel.modelKey };
      }

      await refetchModels();
      setSelectedProvider(savedModel?.provider || formatProviderLabel(inferProviderFromModel(normalizedForm.model || '')));

      const updatedAgent = await updateAgentConfig(targetAgentId, normalizedForm);
      const nextState = {
        model: updatedAgent.model || normalizedForm.model,
        temperature: updatedAgent.temperature ?? normalizedForm.temperature,
        responseLength: updatedAgent.responseLength ?? normalizedForm.responseLength,
        systemPrompt: updatedAgent.systemPrompt ?? normalizedForm.systemPrompt,
        canSpawn: updatedAgent.canSpawn ?? normalizedForm.canSpawn,
        spawnPattern: updatedAgent.spawnPattern ?? normalizedForm.spawnPattern,
      };
      setForm(nextState);
      setSavedState(nextState);
      onAgentUpdated?.(updatedAgent);
      showFlash(agent.isSyntheticCommander ? 'Commander saved to durable row' : 'Configuration saved');
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

  const handleApplyProviderModel = async (provider) => {
    try {
      const saved = await createModelBankEntry({
        label: provider.model,
        modelKey: provider.model,
        provider: provider.label,
      });
      await refetchModels();
      setSelectedProvider(provider.label);
      updateForm({ model: saved.modelKey });
      showFlash(`${provider.label} model ready`);
    } catch (error) {
      setSaveError(error.message || 'Failed to prepare model');
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
        <div className="rounded-[1.4rem] border border-hairline bg-panel-soft p-4">
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
              <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                {agent.isSyntheticCommander && (
                  <div className="mb-4 rounded-2xl border border-aurora-amber/20 bg-aurora-amber/10 px-4 py-3 text-sm leading-6 text-text-body">
                    You are viewing the fallback commander shell. Saving will first materialize the durable commander row for this workspace, then apply the runtime changes there.
                  </div>
                )}
                <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Provider shortcuts</div>
                      <div className="mt-1 text-xs text-text-body">Pick a provider default fast, then fine-tune from the model bank below.</div>
                    </div>
                    <CapabilityBadge>Active provider: {activeProviderLabel}</CapabilityBadge>
                  </div>
                  <div className="mt-4 grid gap-3 xl:grid-cols-3">
                    {providerQuickActions.map((provider) => {
                      const ready = providerCredentials[provider.id];
                      const selected = form.model === provider.model || activeProvider === provider.id;
                      return (
                        <button
                          key={provider.id}
                          type="button"
                          onClick={() => handleApplyProviderModel(provider)}
                          className={cn(
                            'rounded-2xl border px-4 py-4 text-left transition-colors',
                            selected
                              ? 'border-aurora-teal/30 bg-aurora-teal/12 shadow-[0_0_18px_rgba(0,217,200,0.08)]'
                              : ready
                                ? 'border-aurora-teal/20 bg-aurora-teal/10 hover:bg-aurora-teal/15'
                                : 'border-hairline bg-panel-soft hover:bg-panel-hover'
                          )}
                        >
                          <div className="space-y-4">
                            <div>
                              <div className="text-sm font-semibold text-text-primary">{provider.label}</div>
                              <div className="mt-1 text-xs text-text-body">{provider.model}</div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn('rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em]', ready ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green' : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber')}>
                                {ready ? 'connected' : 'needs key'}
                              </span>
                              {selected && (
                                <span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-aurora-teal">
                                  selected
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  {providerReadiness.map((provider) => (
                    <div key={provider.id} className="rounded-xl border border-hairline bg-panel-soft/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{provider.label}</span>
                        <span className={cn('h-2.5 w-2.5 rounded-full', provider.ready ? 'bg-aurora-green' : 'bg-aurora-amber')} />
                      </div>
                      <div className={cn('mt-2 text-xs font-medium', provider.ready ? 'text-aurora-green' : 'text-aurora-amber')}>
                        {provider.ready ? 'Connected' : 'Missing key'}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                    Model bank filter
                  </div>
                  <SegmentedControl
                    options={[{ value: 'All', label: 'All' }, ...providerGroups.map(([provider]) => ({ value: provider, label: provider }))]}
                    value={selectedProvider}
                    onChange={setSelectedProvider}
                  />
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2">
                  {(visibleModels.length > 0 ? visibleModels : selectedModelEntry ? [selectedModelEntry] : []).map((modelItem) => (
                    <button
                      key={modelItem.id}
                      type="button"
                      onClick={() => updateForm({ model: modelItem.modelKey })}
                      className={cn(
                        'rounded-2xl border px-4 py-3 text-left transition-all focus:outline-none',
                        form.model === modelItem.modelKey
                          ? 'border-aurora-teal/30 bg-aurora-teal/10 shadow-glow-teal'
                          : 'border-hairline bg-panel-soft/50 hover:bg-panel-hover'
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
                  {!modelsLoading && visibleModels.length === 0 && !selectedModelEntry && (
                    <div className="rounded-2xl border border-dashed border-hairline px-4 py-4 text-sm text-text-body">
                      No saved models for this provider yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">Expand your model bank</div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
                  <input
                    type="text"
                    value={newModelLabel}
                    onChange={(event) => setNewModelLabel(event.target.value)}
                    placeholder="Model name"
                    className="rounded-xl ui-input px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40 shadow-sm"
                  />
                  <input
                    type="text"
                    value={newModelProvider}
                    onChange={(event) => setNewModelProvider(event.target.value)}
                    placeholder="Provider (optional)"
                    className="rounded-xl ui-input px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40 shadow-sm"
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

              <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
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
                          ? "border-aurora-teal/30 bg-aurora-teal/10"
                          : 'border-hairline bg-panel-soft/50 hover:border-hairline/20'
                      )}
                    >
                      <div
                        className={cn(
                          'mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2',
                          form.spawnPattern === option.id ? 'border-aurora-teal bg-aurora-teal' : 'border-hairline'
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

          {agent.role === 'commander' && (
            <SectionShell
              eyebrow="Operational Doctrine"
              title="Execution and Persona alignment"
              description="Configure how you navigate missions, weigh approvals, and speak to the fleet."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-hairline bg-panel-soft p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-text-primary">Command style</div>
                    <CapabilityBadge>{commanderPrefs.commandStyle}</CapabilityBadge>
                  </div>
                  <SegmentedControl
                    options={[
                      { value: 'tony', label: 'Tony' },
                      { value: 'hybrid', label: 'Hybrid' },
                      { value: 'elon', label: 'Elon' },
                    ]}
                    value={commanderPrefs.commandStyle}
                    onChange={commanderPrefs.setCommandStyle}
                  />
                  <div className="mt-3 text-[11px] leading-relaxed text-text-muted">
                    {commanderPrefs.commandStyle === 'tony' && 'Sarcastic, efficient, and highly autonomous with a bias for speed.'}
                    {commanderPrefs.commandStyle === 'hybrid' && 'Balanced professional posture with occasional creative flare.'}
                    {commanderPrefs.commandStyle === 'elon' && 'Direct, mission-critical, and highly technical perspective.'}
                  </div>
                </div>

                <div className="rounded-2xl border border-hairline bg-panel-soft p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-text-primary">Mission persona</div>
                    <CapabilityBadge>{commanderPrefs.commanderPersona}</CapabilityBadge>
                  </div>
                  <SegmentedControl
                    options={[
                      { value: 'founder', label: 'Founder' },
                      { value: 'operator', label: 'Operator' },
                      { value: 'reviewer', label: 'Reviewer' },
                    ]}
                    value={commanderPrefs.commanderPersona}
                    onChange={commanderPrefs.setCommanderPersona}
                  />
                  <div className="mt-3 text-[11px] leading-relaxed text-text-muted">
                    {commanderPrefs.commanderPersona === 'founder' && 'Extreme ownership, high risk tolerance, and big-picture execution.'}
                    {commanderPrefs.commanderPersona === 'operator' && 'Focus on efficiency, routine maintenance, and reliability.'}
                    {commanderPrefs.commanderPersona === 'reviewer' && 'Skeptical, detail-oriented, and focused on quality assurance.'}
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-hairline bg-panel-soft p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-text-primary">Trusted-write mode</div>
                      <Toggle 
                        value={commanderPrefs.trustedWriteMode === 'autonomous'} 
                        onChange={(val) => commanderPrefs.setTrustedWriteMode(val ? 'autonomous' : 'review_first')} 
                      />
                    </div>
                    <div className="text-[11px] leading-relaxed text-text-muted">
                      {commanderPrefs.trustedWriteMode === 'autonomous' 
                        ? 'Autonomous execution enabled for the primary workspace.' 
                        : 'Manual review required for all mission-critical modifications.'}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-text-primary">Approval weighting</div>
                      <CapabilityBadge>{commanderPrefs.approvalDoctrine === 'risk_weighted' ? 'Risk-Weighted' : 'Standard'}</CapabilityBadge>
                    </div>
                    <SegmentedControl
                      options={[
                        { value: 'standard', label: 'Standard' },
                        { value: 'risk_weighted', label: 'Risk-Weighted' },
                      ]}
                      value={commanderPrefs.approvalDoctrine}
                      onChange={commanderPrefs.setApprovalDoctrine}
                    />
                  </div>
                </div>
              </div>
            </SectionShell>
          )}

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

              <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">System prompt</div>
                    <div className="mt-1 text-xs text-text-body">The full instruction envelope this operator carries into task execution.</div>
                  </div>
                  {agent.role !== 'commander' && template && (
                    <button
                      type="button"
                      onClick={() => updateForm({ systemPrompt: template })}
                      className="rounded-xl border border-hairline ui-well px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-hairline-strong hover:text-text-primary shadow-sm"
                    >
                      Reset to default
                    </button>
                  )}
                </div>
                <textarea
                  value={form.systemPrompt}
                  onChange={(event) => updateForm({ systemPrompt: event.target.value })}
                  rows={8}
                  className="w-full resize-none rounded-2xl ui-input px-4 py-4 text-sm leading-relaxed text-text-primary placeholder:text-text-disabled focus:outline-none transition-colors shadow-sm focus:border-aurora-teal/40"
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
                  <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
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
                          <div key={skill.id} className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel-soft px-4 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-panel-soft/30">
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
                                className="rounded-xl border border-hairline ui-well p-2 text-text-muted transition-colors hover:border-aurora-rose/30 hover:text-aurora-rose"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      {!skillsLoading && attachedSkills.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-sm text-text-body">
                          No skills attached yet. Add a path, GitHub source, or an existing bank entry from the discovery panel.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
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
                        className="rounded-xl ui-input px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40 shadow-sm"
                      />
                      <input
                        type="text"
                        value={serverUrl}
                        onChange={(event) => setServerUrl(event.target.value)}
                        placeholder="Server URL"
                        className="rounded-xl ui-input px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40 shadow-sm"
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
                        <div key={server.id} className="flex items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel-soft px-4 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-panel-soft/30">
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
                              className="rounded-xl border border-hairline ui-well p-2 text-text-muted transition-colors hover:border-aurora-rose/30 hover:text-aurora-rose"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {!mcpLoading && mcpServers.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-sm text-text-body">
                          No MCP servers configured yet. Add one above to make it a first-class capability in this workspace.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-hairline bg-panel-soft/50 p-4">
                    <div className="text-sm font-medium text-text-primary">Discover and attach</div>
                    <div className="mt-1 text-xs text-text-body">Search the shared skill bank, or create a new skill from a local path, custom name, or GitHub reference.</div>

                    <div className="relative mt-4">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={searchInput}
                        onChange={(event) => setSearchInput(event.target.value)}
                        placeholder="Search skills, paste path, or GitHub URL..."
                        className="w-full rounded-2xl ui-input py-3 pl-10 pr-3 text-sm text-text-primary outline-none transition-colors focus:border-aurora-teal/40 shadow-sm"
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
                            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-hairline bg-panel-soft px-4 py-3 text-left transition-colors hover:border-white/[0.12] hover:bg-panel-soft/30"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-panel-soft/30">
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
                        <div className="rounded-2xl border border-dashed border-hairline px-4 py-5 text-sm text-text-body">
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

      <div className="shrink-0 border-t border-hairline bg-canvas/80 p-4 backdrop-blur">
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
              className="rounded-xl border border-hairline px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-white/[0.14] hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
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
