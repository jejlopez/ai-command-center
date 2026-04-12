import { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  BrainCircuit,
  Cable,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Command,
  FolderLock,
  Layers3,
  Loader2,
  Play,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { TraceWaterfall } from '../components/TraceWaterfall';
import { cn } from '../utils/cn';
import { updateRecurringMissionFlow } from '../lib/api';
import {
  createAgentTemplate,
  createCredentialVault,
  createModelBankEntry,
  ensureProviderInfrastructure,
  launchEphemeralSession,
  upsertVaultBinding,
  updateAgentTemplate,
  useAgentSessions,
  useAgentTemplates,
  useAgents,
  useConnectedSystems,
  useCredentialVaults,
  useKnowledgeNamespaces,
  useMcpServers,
  useModelBank,
  useProviderCredentials,
  useSessionEvents,
  useTaskInterventions,
  useTasks,
  useVaultBindings,
} from '../utils/useSupabase';
import { getAutomationCandidates, getRecurringAutonomyTuningSummary, getRecurringBriefFitAction, getRecurringChangePayback, getRecurringChangeReadback, getRecurringNextCorrection, getRecurringPostChangeVerdict } from '../utils/commanderAnalytics';

const workflowTabs = [
  { id: 'create', label: 'Create', icon: Sparkles, description: 'Describe the specialist, review the draft, then launch.' },
  { id: 'registry', label: 'Registry', icon: Layers3, description: 'Manage reusable templates and durable operators.' },
  { id: 'runs', label: 'Runs', icon: Workflow, description: 'Inspect session timelines, transcript, and approvals.' },
  { id: 'infrastructure', label: 'Infrastructure', icon: Cable, description: 'Check providers, vaults, MCP, and knowledge readiness.' },
];

const registryTabs = [
  { id: 'templates', label: 'Templates' },
  { id: 'agents', label: 'Durable Agents' },
];

const infrastructureTabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'vaults', label: 'Vaults' },
];

const sessionTone = {
  queued: 'text-aurora-blue border-aurora-blue/20 bg-aurora-blue/10',
  running: 'text-aurora-teal border-aurora-teal/20 bg-aurora-teal/10',
  waiting_for_tool: 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/10',
  needs_review: 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/10',
  completed: 'text-aurora-green border-aurora-green/20 bg-aurora-green/10',
  failed: 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/10',
  cancelled: 'text-text-muted border-white/10 bg-white/[0.04]',
};

function inferProvider(modelLabel) {
  const label = (modelLabel || '').toLowerCase();
  if (label.includes('gemini')) return 'google';
  if (label.includes('claude')) return 'anthropic';
  if (label.includes('gpt') || label.includes('o1') || label.includes('o3') || label.includes('o4')) return 'openai';
  return 'custom';
}

function deriveRole(prompt) {
  const text = prompt.toLowerCase();
  if (/(review|qa|regression|test)/.test(text)) return 'qa';
  if (/(ui|frontend|design|component)/.test(text)) return 'ui-agent';
  if (/(ops|incident|supabase|integration|mcp|infra)/.test(text)) return 'ops';
  return 'researcher';
}

function deriveModel(prompt) {
  const text = prompt.toLowerCase();
  const usingMatch = text.match(/\busing\s+([a-z0-9.\- ]{2,60})/i);
  if (usingMatch?.[1]) {
    return usingMatch[1]
      .trim()
      .replace(/\s+(to|for|and)\b.*$/i, '')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  if (text.includes('claude opus')) return 'Claude Opus 4.6';
  if (text.includes('claude sonnet')) return 'Claude Sonnet 4.6';
  if (text.includes('gpt-5.4-mini')) return 'GPT-5.4-mini';
  if (text.includes('gpt-5.4')) return 'GPT-5.4';
  return 'Claude Opus 4.6';
}

function deriveVaultRequirements(prompt) {
  const text = prompt.toLowerCase();
  const requirements = [];
  if (text.includes('clickup')) requirements.push('ClickUp');
  if (text.includes('github')) requirements.push('GitHub');
  if (text.includes('slack')) requirements.push('Slack');
  if (text.includes('supabase')) requirements.push('Supabase service role');
  if (text.includes('gmail') || text.includes('email')) requirements.push('Email provider');
  return requirements;
}

function deriveAllowedTools(prompt) {
  const text = prompt.toLowerCase();
  const tools = new Set(['repo']);
  if (/(research|docs|analyze|brief)/.test(text)) tools.add('knowledge');
  if (/(clickup|slack|github|mcp|integration)/.test(text)) tools.add('mcp');
  if (/(supabase|sql)/.test(text)) tools.add('supabase');
  if (/(design|ui|frontend)/.test(text)) tools.add('design-system');
  if (/(review|test|regression)/.test(text)) tools.add('tests');
  return Array.from(tools);
}

function deriveTemplateName(prompt) {
  const text = prompt.trim();
  if (!text) return 'New Specialist';
  if (/review/i.test(text)) return 'Code Reviewer';
  if (/frontend|ui/i.test(text)) return 'Frontend Builder';
  if (/supabase/i.test(text)) return 'Supabase Operator';
  if (/incident/i.test(text)) return 'Incident Commander';
  if (/research/i.test(text)) return 'Research Analyst';
  return text
    .replace(/^(create|spin up|launch)\s+(an?\s+)?/i, '')
    .replace(/\s+using\s+.+$/i, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .join(' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseQuickstartPrompt(prompt) {
  const role = deriveRole(prompt);
  const model = deriveModel(prompt);
  const vaultRequirements = deriveVaultRequirements(prompt);

  return {
    name: deriveTemplateName(prompt),
    role,
    description: prompt.trim() || 'Drafted from quickstart prompt.',
    defaultModel: model,
    systemPrompt: prompt.trim() || `You are the ${role} specialist.`,
    allowedTools: deriveAllowedTools(prompt),
    environmentBindings: role === 'ops' ? ['mcp', 'workspace'] : ['workspace'],
    vaultRequirements,
    approvalMode: vaultRequirements.length > 0 || role === 'ops' ? 'approval_required' : 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: vaultRequirements.length > 0 ? 'restricted' : 'shared',
    canDelegate: role === 'ops',
  };
}

function buildSessionSpans(events) {
  if (!events.length) return [];
  return events.map((event, index) => ({
    id: event.id,
    name: event.title || event.eventType,
    type: event.eventType === 'tool_call' ? 'tool' : event.eventType === 'error' ? 'error' : event.eventType === 'approval_requested' ? 'agent' : 'llm',
    startMs: index * 420,
    durationMs: Math.max(220, event.durationMs || 480),
    parentId: null,
    tokens: event.tokenDelta || 0,
    model: event.payload?.model || null,
  }));
}

function formatProviderLabel(provider) {
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'google') return 'Google';
  return 'Custom';
}

function formatStatusLabel(value) {
  return value.replace(/_/g, ' ');
}

function formatRecurringPostureValue(value, kind = 'text') {
  if (value == null || value === '') return 'Not set';
  if (kind === 'paused') return value ? 'Paused' : 'Active';
  return String(value).replaceAll('_', ' ');
}

function formatPermissionScope(value) {
  return String(value || 'limited').replaceAll('_', ' ');
}

function normalizeManagedOpsTab(tab) {
  if (tab === 'quickstart') return 'create';
  if (tab === 'templates' || tab === 'agents') return 'registry';
  if (tab === 'sessions') return 'runs';
  if (tab === 'environments' || tab === 'vaults') return 'infrastructure';
  return tab || 'create';
}

function WorkflowButton({ active, item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-[24px] border px-4 py-4 text-left transition-colors',
        active
          ? 'border-aurora-teal/25 bg-aurora-teal/10'
          : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-2xl border p-2.5', active ? 'border-aurora-teal/30 bg-aurora-teal/10 text-aurora-teal' : 'border-white/10 bg-black/20 text-text-muted')}>
          <item.icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold text-text-primary">{item.label}</div>
          <div className="mt-1 text-xs leading-5 text-text-muted">{item.description}</div>
        </div>
      </div>
    </button>
  );
}

function SegmentedButton({ active, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
        active
          ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
          : 'border-white/10 bg-white/[0.03] text-text-muted hover:text-text-primary'
      )}
    >
      {label}
    </button>
  );
}

function StatusPill({ label, value, tone = 'text-text-primary' }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className={cn('mt-2 text-base font-semibold', tone)}>{value}</div>
    </div>
  );
}

function InlineAlert({ message, tone = 'error' }) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'rounded-[22px] border px-4 py-3 text-sm leading-6',
        tone === 'error'
          ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
          : 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green'
      )}
    >
      {message}
    </div>
  );
}

function Surface({ eyebrow, title, description, action, className = '', children }) {
  return (
    <section className={cn('rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.032),rgba(255,255,255,0.014))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.2)]', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow && <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">{eyebrow}</div>}
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-text-primary">{title}</h2>
          {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-body">{description}</p>}
        </div>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ReadinessItem({ label, ready, detail }) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-text-primary">{label}</div>
        <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', ready ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green' : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber')}>
          {ready ? 'ready' : 'needs setup'}
        </span>
      </div>
      {detail && <div className="mt-2 text-sm leading-6 text-text-body">{detail}</div>}
    </div>
  );
}

function RecurringTrustCard({ candidate, onStageAction }) {
  if (!candidate?.launchBrief) return null;

  const trust = getRecurringAutonomyTuningSummary(candidate);
  const recurringAction = getRecurringBriefFitAction([candidate], [], []);
  const recurringChange = getRecurringChangeReadback(candidate);
  const recurringVerdict = getRecurringPostChangeVerdict(candidate);
  const nextCorrection = getRecurringNextCorrection(candidate);
  const tone = candidate.launchBriefFit === 'holding'
    ? 'text-aurora-green border-aurora-green/20 bg-aurora-green/10'
    : candidate.launchBriefFit === 'watch'
      ? 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/10'
      : 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/10';

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Recurring trust readback</div>
          <div className="mt-2 text-sm font-semibold text-text-primary">{candidate.title}</div>
        </div>
        <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', tone)}>
          {candidate.launchBriefFit}
        </span>
      </div>
      <div className="mt-3 text-sm leading-6 text-text-body">{trust.detail}</div>
      <div className="mt-3 text-[11px] leading-5 text-text-muted">
        Saved brief: {candidate.launchBrief.objective}
      </div>
      {recurringChange.available && (
        <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Saved change</div>
          <div className="mt-2 text-[12px] font-semibold text-text-primary">{recurringChange.title}</div>
          <div className="mt-1 text-[11px] leading-5 text-text-body">{recurringChange.detail}</div>
        </div>
      )}
      {recurringVerdict.available && (
        <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Post-change verdict</div>
          <div className="mt-2 text-[12px] font-semibold text-text-primary">{recurringVerdict.title}</div>
          <div className="mt-1 text-[11px] leading-5 text-text-body">{recurringVerdict.detail}</div>
          {(recurringVerdict.previousPosture || recurringVerdict.currentPosture) && (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {recurringVerdict.previousPosture && (
                <div className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-text-body">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Previous</div>
                  <div className="mt-1">Cadence: {formatRecurringPostureValue(recurringVerdict.previousPosture.cadence)}</div>
                  <div>Approval: {formatRecurringPostureValue(recurringVerdict.previousPosture.approvalPosture)}</div>
                  <div>Mode: {formatRecurringPostureValue(recurringVerdict.previousPosture.missionMode)}</div>
                </div>
              )}
              {recurringVerdict.currentPosture && (
                <div className="rounded-[14px] border border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-2.5 text-[11px] leading-5 text-text-body">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Current</div>
                  <div className="mt-1">Cadence: {formatRecurringPostureValue(recurringVerdict.currentPosture.cadence)}</div>
                  <div>Approval: {formatRecurringPostureValue(recurringVerdict.currentPosture.approvalPosture)}</div>
                  <div>Mode: {formatRecurringPostureValue(recurringVerdict.currentPosture.missionMode)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {recurringAction.available && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStageAction?.(candidate, recurringAction)}
            className="inline-flex items-center gap-2 rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Stage {recurringAction.actionLabel}
          </button>
          {nextCorrection.available && nextCorrection.tone !== 'teal' && (
            <span className="text-[11px] leading-5 text-text-muted">{nextCorrection.title}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function ManagedOpsView({ initialTab = 'create', routeState = null, onConsumeRouteState }) {
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { interventions } = useTaskInterventions();
  const { templates, loading: templatesLoading, refetch: refetchTemplates } = useAgentTemplates();
  const { sessions, loading: sessionsLoading, refetch: refetchSessions } = useAgentSessions();
  const { models, refetch: refetchModels } = useModelBank();
  const { credentials: providerCredentials, refetch: refetchProviderCredentials } = useProviderCredentials();
  const { vaults, loading: vaultsLoading, refetch: refetchVaults } = useCredentialVaults();
  const { servers } = useMcpServers();
  const { connectedSystems } = useConnectedSystems();
  const { namespaces } = useKnowledgeNamespaces();
  const { bindings, refetch: refetchBindings } = useVaultBindings();

  const durableAgents = useMemo(
    () => agents.filter((agent) => !agent.isEphemeral && !agent.isSyntheticCommander),
    [agents]
  );
  const commander = durableAgents.find((agent) => agent.role === 'commander') || null;
  const liveSessions = sessions.filter((session) => ['queued', 'running', 'waiting_for_tool', 'needs_review'].includes(session.status));
  const blockedSessions = sessions.filter((session) => session.status === 'needs_review' || session.status === 'failed');
  const templateById = useMemo(() => new Map(templates.map((template) => [template.id, template])), [templates]);
  const vaultById = useMemo(() => new Map(vaults.map((vault) => [vault.id, vault])), [vaults]);

  const [activeTab, setActiveTab] = useState(normalizeManagedOpsTab(initialTab));
  const [activeRegistryTab, setActiveRegistryTab] = useState('templates');
  const [activeInfrastructureTab, setActiveInfrastructureTab] = useState('overview');
  const [quickstartPrompt, setQuickstartPrompt] = useState('Create an agent using Gemini 3.1 to research design patterns for a new onboarding flow and summarize the findings.');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedTemplateEditId, setSelectedTemplateEditId] = useState('');
  const [selectedVaultId, setSelectedVaultId] = useState('');
  const [vaultDraft, setVaultDraft] = useState({ name: '', provider: 'custom', secretRefs: 'API key' });
  const [flash, setFlash] = useState('');
  const [stagedRecurringBrief, setStagedRecurringBrief] = useState(null);
  const [stagedConnectorBrief, setStagedConnectorBrief] = useState(null);
  const [stagedDispatchBrief, setStagedDispatchBrief] = useState(null);
  const [stagedControlBrief, setStagedControlBrief] = useState(null);
  const [stagedRecurringDraft, setStagedRecurringDraft] = useState(null);
  const [lastAppliedRecurringResult, setLastAppliedRecurringResult] = useState(null);
  const [pendingAutoStageRecurringCorrection, setPendingAutoStageRecurringCorrection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorState, setErrorState] = useState({ scope: 'create', message: '' });

  useEffect(() => {
    setActiveTab(normalizeManagedOpsTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (!routeState) return;
    if (routeState.tab) setActiveTab(normalizeManagedOpsTab(routeState.tab));
    if (routeState.quickstartPrompt) setQuickstartPrompt(routeState.quickstartPrompt);
    if (routeState.notice) setFlash(routeState.notice);
    setStagedRecurringBrief(routeState.recurringActionBrief || null);
    setStagedConnectorBrief(routeState.connectorActionBrief || null);
    setStagedDispatchBrief(routeState.dispatchActionBrief || null);
    setStagedControlBrief(routeState.controlActionBrief || null);
    setStagedRecurringDraft(routeState.recurringActionBrief?.proposedPosture || null);
    setLastAppliedRecurringResult(null);
    setPendingAutoStageRecurringCorrection(null);
    onConsumeRouteState?.();
  }, [routeState, onConsumeRouteState]);

  useEffect(() => {
    if (!selectedTemplateId && templates[0]) setSelectedTemplateId(templates[0].id);
    if (!selectedTemplateEditId && templates[0]) setSelectedTemplateEditId(templates[0].id);
  }, [templates, selectedTemplateId, selectedTemplateEditId]);

  useEffect(() => {
    if (!selectedSessionId && sessions[0]) setSelectedSessionId(sessions[0].id);
  }, [sessions, selectedSessionId]);

  const quickstartDraft = useMemo(() => parseQuickstartPrompt(quickstartPrompt), [quickstartPrompt]);
  const recurringCandidates = useMemo(
    () => getAutomationCandidates(tasks, 150, interventions, []),
    [tasks, interventions]
  );
  const topRecurringCandidate = recurringCandidates.find((candidate) => candidate.launchBrief) || null;
  const quickstartProvider = useMemo(() => inferProvider(quickstartDraft.defaultModel), [quickstartDraft.defaultModel]);
  const providerConnected = quickstartProvider === 'custom' ? true : providerCredentials[quickstartProvider];
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) || null;
  const { events: sessionEvents, loading: eventsLoading } = useSessionEvents(selectedSession?.id || null);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) || null;
  const editableTemplate = templates.find((template) => template.id === selectedTemplateEditId) || null;
  const templateBindings = useMemo(() => bindings.filter((binding) => binding.ownerType === 'template'), [bindings]);
  const sessionSpans = useMemo(() => buildSessionSpans(sessionEvents), [sessionEvents]);
  const providerStatuses = useMemo(
    () => [
      { id: 'anthropic', label: 'Anthropic', ready: providerCredentials.anthropic },
      { id: 'openai', label: 'OpenAI', ready: providerCredentials.openai },
      { id: 'google', label: 'Google', ready: providerCredentials.google },
    ],
    [providerCredentials]
  );
  const vaultIssueCount = useMemo(
    () => vaults.filter((vault) => vault.status !== 'active').length,
    [vaults]
  );
  const blockers = useMemo(() => {
    const items = [];
    if (quickstartProvider !== 'custom' && !providerConnected) {
      items.push(`Connect ${formatProviderLabel(quickstartProvider)} in Settings so Jarvis can auto-wire the provider vault.`);
    }
    if (!commander?.id) {
      items.push('Commander record is still warming up. Jarvis can still launch, but the session will be linked without a root commander id until the durable commander is available.');
    }
    return items;
  }, [commander?.id, providerConnected, quickstartProvider]);

  const templateBindingMap = useMemo(() => {
    const map = new Map();
    templateBindings.forEach((binding) => {
      if (!map.has(binding.ownerId)) map.set(binding.ownerId, []);
      map.get(binding.ownerId).push(binding);
    });
    return map;
  }, [templateBindings]);

  const [draftTemplateOverrides, setDraftTemplateOverrides] = useState({});

  useEffect(() => {
    if (editableTemplate) {
      setDraftTemplateOverrides((current) => ({
        ...current,
        [editableTemplate.id]: current[editableTemplate.id] || editableTemplate,
      }));
    }
  }, [editableTemplate]);

  const templateDraft = editableTemplate
    ? (draftTemplateOverrides[editableTemplate.id] || editableTemplate)
    : null;

  function clearNotice(scope) {
    setFlash('');
    setErrorState((current) => (current.scope === scope ? { scope, message: '' } : current));
  }

  function setScopedError(scope, message) {
    setErrorState({ scope, message });
  }

  function patchTemplateDraft(field, value) {
    if (!editableTemplate) return;
    setDraftTemplateOverrides((current) => ({
      ...current,
      [editableTemplate.id]: {
        ...(current[editableTemplate.id] || editableTemplate),
        [field]: value,
      },
    }));
  }

  function handleStageRecurringAction(candidate, recurringAction, options = {}) {
    if (!recurringAction?.available || !recurringAction.opsPrompt) return;
    setActiveTab('create');
    setQuickstartPrompt(recurringAction.opsPrompt);
    setFlash(options.notice || `Staged recurring ops draft: ${recurringAction.actionLabel} for ${candidate?.title || 'the selected flow'}.`);
    setStagedRecurringBrief({
      taskId: recurringAction.taskId,
      title: recurringAction.title,
      actionLabel: recurringAction.actionLabel,
      currentPosture: recurringAction.currentPosture || null,
      proposedPosture: recurringAction.proposedPosture || null,
      expectedImprovement: recurringAction.expectedImprovement,
      verificationTarget: recurringAction.verificationTarget,
      successCriteria: recurringAction.successCriteria,
      rollbackCriteria: recurringAction.rollbackCriteria,
    });
    setStagedRecurringDraft(recurringAction.proposedPosture || null);
    if (!options.preserveLastAppliedResult) {
      setLastAppliedRecurringResult(null);
    }
  }

  const stagedRecurringHistory = useMemo(
    () => topRecurringCandidate ? getRecurringChangeReadback(topRecurringCandidate) : null,
    [topRecurringCandidate]
  );
  const stagedRecurringPayback = useMemo(
    () => topRecurringCandidate ? getRecurringChangePayback(topRecurringCandidate) : null,
    [topRecurringCandidate]
  );
  const stagedRecurringCandidate = useMemo(
    () => recurringCandidates.find((candidate) => candidate.latestTaskId === stagedRecurringBrief?.taskId) || topRecurringCandidate || null,
    [recurringCandidates, stagedRecurringBrief?.taskId, topRecurringCandidate]
  );
  const stagedRecurringVerdict = useMemo(
    () => stagedRecurringCandidate ? getRecurringPostChangeVerdict(stagedRecurringCandidate) : null,
    [stagedRecurringCandidate]
  );
  const stagedRecurringNextCorrection = useMemo(
    () => stagedRecurringCandidate ? getRecurringNextCorrection(stagedRecurringCandidate) : null,
    [stagedRecurringCandidate]
  );

  useEffect(() => {
    if (!pendingAutoStageRecurringCorrection?.taskId) return;
    if (!stagedRecurringCandidate || stagedRecurringCandidate.latestTaskId !== pendingAutoStageRecurringCorrection.taskId) return;

    if (stagedRecurringNextCorrection?.available && stagedRecurringNextCorrection.tone === 'amber' && stagedRecurringNextCorrection.action?.available) {
      handleStageRecurringAction(stagedRecurringCandidate, stagedRecurringNextCorrection.action, {
        preserveLastAppliedResult: true,
        notice: `Commander auto-staged the next recurring correction because the last saved posture is still underperforming for ${stagedRecurringCandidate.title}.`,
      });
      setPendingAutoStageRecurringCorrection(null);
      return;
    }

    if (stagedRecurringVerdict?.available) {
      setPendingAutoStageRecurringCorrection(null);
    }
  }, [pendingAutoStageRecurringCorrection, stagedRecurringCandidate, stagedRecurringNextCorrection, stagedRecurringVerdict]);

  function patchStagedRecurringDraft(field, value) {
    setStagedRecurringDraft((current) => ({
      ...(current || {}),
      [field]: value,
    }));
  }

  async function handleApplyRecurringDraft() {
    if (!stagedRecurringBrief?.taskId || !stagedRecurringDraft) return;
    setSaving(true);
    clearNotice('create');
    try {
      const previousPosture = stagedRecurringBrief.currentPosture || null;
      const result = await updateRecurringMissionFlow(stagedRecurringBrief.taskId, {
        frequency: stagedRecurringDraft.cadence,
        missionMode: stagedRecurringDraft.missionMode,
        approvalPosture: stagedRecurringDraft.approvalPosture,
        paused: stagedRecurringDraft.paused,
      });
      const appliedPosture = {
        cadence: result?.recurrenceRule?.frequency || stagedRecurringDraft.cadence,
        approvalPosture: result?.recurrenceRule?.approvalPosture || stagedRecurringDraft.approvalPosture,
        missionMode: result?.recurrenceRule?.missionMode || stagedRecurringDraft.missionMode,
        paused: result?.recurrenceRule?.paused ?? stagedRecurringDraft.paused,
      };
      setStagedRecurringBrief((current) => current ? {
        ...current,
        currentPosture: appliedPosture,
        proposedPosture: appliedPosture,
      } : current);
      setStagedRecurringDraft(appliedPosture);
      setLastAppliedRecurringResult({
        previousPosture,
        posture: appliedPosture,
        guardrails: result?.guardrails || [],
      });
      setPendingAutoStageRecurringCorrection({
        taskId: stagedRecurringBrief.taskId,
      });
      setFlash(result?.guardrails?.length
        ? `Applied recurring posture with guardrails: ${result.guardrails.join(' ')}`
        : 'Applied drafted recurring posture');
    } catch (err) {
      setScopedError('create', err.message || 'Failed to apply recurring posture');
    } finally {
      setSaving(false);
    }
  }

  async function ensureModelExists(modelLabel) {
    if (!modelLabel) return;
    const exists = models.some((model) => model.label === modelLabel || model.modelKey === modelLabel);
    if (exists) return;
    await createModelBankEntry({
      label: modelLabel,
      modelKey: modelLabel,
      provider: inferProvider(modelLabel),
      costPer1k: 0,
    });
    await refetchModels();
  }

  async function ensureQuickstartProviderReady() {
    const provider = quickstartProvider;
    if (!provider || provider === 'custom') {
      return { status: 'custom', hasCredential: true, vault: null };
    }

    const infrastructure = await ensureProviderInfrastructure({
      provider,
      identifier: `${provider}-primary`,
    });

    await Promise.all([refetchVaults(), refetchProviderCredentials()]);

    if (!infrastructure.hasCredential) {
      throw new Error(`${formatProviderLabel(provider)} is not connected yet. Add the API key in Settings -> Connected Systems and Jarvis will auto-wire the provider vault.`);
    }

    return infrastructure;
  }

  async function handleSaveDraft() {
    setSaving(true);
    clearNotice('create');
    try {
      await ensureModelExists(quickstartDraft.defaultModel);
      const providerInfra = await ensureQuickstartProviderReady();
      const template = await createAgentTemplate(quickstartDraft);
      if (providerInfra?.vault?.id) {
        await upsertVaultBinding({
          vaultId: providerInfra.vault.id,
          ownerType: 'template',
          ownerId: template.id,
          bindingKind: 'runtime',
        });
        await refetchBindings();
      }
      await refetchTemplates();
      setSelectedTemplateId(template.id);
      setSelectedTemplateEditId(template.id);
      setActiveTab('registry');
      setActiveRegistryTab('templates');
      setFlash(`Template saved: ${template.name}`);
    } catch (err) {
      setScopedError('create', err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function handleLaunchSession() {
    setSaving(true);
    clearNotice('create');
    try {
      await ensureModelExists(quickstartDraft.defaultModel);
      const providerInfra = await ensureQuickstartProviderReady();
      let template = selectedTemplate;
      if (!template) {
        template = await createAgentTemplate(quickstartDraft);
        if (providerInfra?.vault?.id) {
          await upsertVaultBinding({
            vaultId: providerInfra.vault.id,
            ownerType: 'template',
            ownerId: template.id,
            bindingKind: 'runtime',
          });
          await refetchBindings();
        }
        await refetchTemplates();
        setSelectedTemplateId(template.id);
      }
      const { session } = await launchEphemeralSession({
        template,
        prompt: quickstartPrompt,
        modelOverride: quickstartDraft.defaultModel,
        commanderId: commander?.id || null,
        title: `${template.name} Session`,
      });
      await refetchSessions();
      setSelectedSessionId(session.id);
      setActiveTab('runs');
      setFlash(`Launched ephemeral worker from ${template.name}`);
    } catch (err) {
      setScopedError('create', err.message || 'Failed to launch session');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateVault() {
    setSaving(true);
    clearNotice('infrastructure');
    try {
      await createCredentialVault({
        name: vaultDraft.name,
        provider: vaultDraft.provider,
        secretRefs: vaultDraft.secretRefs.split(',').map((item) => item.trim()).filter(Boolean),
        metadata: {
          readiness: 'active',
        },
      });
      await refetchVaults();
      setVaultDraft({ name: '', provider: 'custom', secretRefs: 'API key' });
      setFlash('Credential vault created');
    } catch (err) {
      setScopedError('infrastructure', err.message || 'Failed to create vault');
    } finally {
      setSaving(false);
    }
  }

  async function handleBindVaultToTemplate(templateId, vaultId) {
    if (!templateId || !vaultId) return;
    setSaving(true);
    clearNotice('registry');
    try {
      await upsertVaultBinding({
        vaultId,
        ownerType: 'template',
        ownerId: templateId,
        bindingKind: 'runtime',
      });
      await refetchBindings();
      setFlash('Vault attached to template');
    } catch (err) {
      setScopedError('registry', err.message || 'Failed to attach vault');
    } finally {
      setSaving(false);
    }
  }

  async function handlePersistTemplateDraft() {
    if (!editableTemplate || !templateDraft) return;
    setSaving(true);
    clearNotice('registry');
    try {
      await ensureModelExists(templateDraft.defaultModel);
      await updateAgentTemplate(editableTemplate.id, templateDraft);
      await refetchTemplates();
      setFlash(`Template updated: ${templateDraft.name}`);
    } catch (err) {
      setScopedError('registry', err.message || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative flex h-full flex-col gap-5 overflow-y-auto pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-4%] top-[-8%] h-[320px] w-[320px] rounded-full bg-aurora-violet/10 blur-[120px]" />
        <div className="absolute right-[-10%] top-[8%] h-[400px] w-[400px] rounded-full bg-aurora-teal/10 blur-[140px]" />
      </div>

      {flash && <InlineAlert message={flash} tone="success" />}

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Surface
          eyebrow="Managed Ops"
          title="Command specialists with a cleaner workflow"
          description="Create reusable templates, launch ephemeral workers, inspect sessions, and keep infrastructure ready without digging through setup noise."
          className="h-fit"
        >
          <div className="space-y-3">
            {workflowTabs.map((item) => (
              <WorkflowButton key={item.id} item={item} active={activeTab === item.id} onClick={() => setActiveTab(item.id)} />
            ))}
          </div>
          <div className="mt-5 rounded-[24px] border border-white/10 bg-black/20 p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Status rail</div>
            <div className="mt-3 space-y-3">
              <StatusPill label="Templates" value={templatesLoading ? 'Loading...' : templates.length} tone="text-aurora-teal" />
              <StatusPill label="Active Runs" value={sessionsLoading ? 'Loading...' : liveSessions.length} tone="text-aurora-blue" />
              <StatusPill label="Blocked" value={blockedSessions.length} tone={blockedSessions.length ? 'text-aurora-amber' : 'text-aurora-green'} />
              <StatusPill label="Vault Issues" value={vaultsLoading ? 'Loading...' : vaultIssueCount} tone={vaultIssueCount ? 'text-aurora-amber' : 'text-aurora-green'} />
            </div>
          </div>
        </Surface>

        <div className="space-y-5">
          <Surface
            eyebrow="Managed Ops"
            title="Persistent templates. Ephemeral execution."
            description="Commander stays durable. Specialist behavior lives in templates. Delegated workers launch per session and retire cleanly."
            action={(
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('create')}
                  className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2.5 text-sm font-semibold text-black"
                >
                  <Sparkles className="h-4 w-4" />
                  New Specialist
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('runs')}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-text-primary"
                >
                  <Workflow className="h-4 w-4 text-aurora-blue" />
                  View Runs
                </button>
              </div>
            )}
          >
            <div className="grid gap-3 lg:grid-cols-4">
              <StatusPill label="Commander" value={commander ? commander.name : 'Pending durable row'} tone={commander ? 'text-aurora-green' : 'text-aurora-amber'} />
              <StatusPill label="Primary Model" value={quickstartDraft.defaultModel} tone="text-aurora-violet" />
              <StatusPill label="Provider" value={formatProviderLabel(quickstartProvider)} tone="text-aurora-blue" />
              <StatusPill label="Launch Mode" value="Ephemeral worker" tone="text-aurora-teal" />
            </div>
          </Surface>

          {topRecurringCandidate && (
            <RecurringTrustCard candidate={topRecurringCandidate} onStageAction={handleStageRecurringAction} />
          )}

          <AnimatePresence mode="wait">
            {activeTab === 'create' && (
              <Motion.div key="create" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <Surface
                  eyebrow="Create"
                  title="Describe the specialist you want"
                  description="Tell Jarvis what should be built or delegated. The right side will infer the draft, flag blockers, and tell you whether the run is launch-ready."
                >
                  <div className="space-y-4">
                    <InlineAlert message={errorState.scope === 'create' ? errorState.message : ''} />
                    {stagedRecurringBrief && (
                      <div className="rounded-[24px] border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-blue">Staged recurring action</div>
                            <div className="mt-2 text-sm font-semibold text-text-primary">{stagedRecurringBrief.title}</div>
                          </div>
                          <span className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-blue">
                            {stagedRecurringBrief.actionLabel}
                          </span>
                        </div>
                        {(stagedRecurringBrief.currentPosture || stagedRecurringBrief.proposedPosture) && (
                          <div className="mt-3 grid gap-3 md:grid-cols-2">
                            {stagedRecurringBrief.currentPosture && (
                              <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Current posture</div>
                                <div className="mt-2 space-y-1 text-[12px] leading-6 text-text-body">
                                  <div>Cadence: {formatRecurringPostureValue(stagedRecurringBrief.currentPosture.cadence)}</div>
                                  <div>Approval: {formatRecurringPostureValue(stagedRecurringBrief.currentPosture.approvalPosture)}</div>
                                  <div>Mission mode: {formatRecurringPostureValue(stagedRecurringBrief.currentPosture.missionMode)}</div>
                                  <div>Run state: {formatRecurringPostureValue(stagedRecurringBrief.currentPosture.paused, 'paused')}</div>
                                </div>
                              </div>
                            )}
                            {stagedRecurringBrief.proposedPosture && (
                              <div className="rounded-[18px] border border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-3">
                                <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-teal">Drafted posture</div>
                                <div className="mt-2 space-y-1 text-[12px] leading-6 text-text-body">
                                  <div>Cadence: {formatRecurringPostureValue(stagedRecurringDraft?.cadence || stagedRecurringBrief.proposedPosture.cadence)}</div>
                                  <div>Approval: {formatRecurringPostureValue(stagedRecurringDraft?.approvalPosture || stagedRecurringBrief.proposedPosture.approvalPosture)}</div>
                                  <div>Mission mode: {formatRecurringPostureValue(stagedRecurringDraft?.missionMode || stagedRecurringBrief.proposedPosture.missionMode)}</div>
                                  <div>Run state: {formatRecurringPostureValue(stagedRecurringDraft?.paused ?? stagedRecurringBrief.proposedPosture.paused, 'paused')}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {stagedRecurringDraft && (
                          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Edit drafted posture</div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <label className="space-y-2">
                                <div className="text-[11px] font-semibold text-text-primary">Cadence</div>
                                <select
                                  value={stagedRecurringDraft.cadence || 'weekly'}
                                  onChange={(event) => patchStagedRecurringDraft('cadence', event.target.value)}
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary outline-none"
                                >
                                  <option value="daily">daily</option>
                                  <option value="weekly">weekly</option>
                                </select>
                              </label>
                              <label className="space-y-2">
                                <div className="text-[11px] font-semibold text-text-primary">Approval posture</div>
                                <select
                                  value={stagedRecurringDraft.approvalPosture || 'risk_weighted'}
                                  onChange={(event) => patchStagedRecurringDraft('approvalPosture', event.target.value)}
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary outline-none"
                                >
                                  <option value="auto_low_risk">auto low risk</option>
                                  <option value="risk_weighted">risk weighted</option>
                                  <option value="human_required">human required</option>
                                </select>
                              </label>
                              <label className="space-y-2">
                                <div className="text-[11px] font-semibold text-text-primary">Mission mode</div>
                                <select
                                  value={stagedRecurringDraft.missionMode || 'watch_and_approve'}
                                  onChange={(event) => patchStagedRecurringDraft('missionMode', event.target.value)}
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary outline-none"
                                >
                                  <option value="do_now">do now</option>
                                  <option value="plan_first">plan first</option>
                                  <option value="watch_and_approve">watch and approve</option>
                                </select>
                              </label>
                              <label className="space-y-2">
                                <div className="text-[11px] font-semibold text-text-primary">Run state</div>
                                <select
                                  value={stagedRecurringDraft.paused ? 'paused' : 'active'}
                                  onChange={(event) => patchStagedRecurringDraft('paused', event.target.value === 'paused')}
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary outline-none"
                                >
                                  <option value="active">active</option>
                                  <option value="paused">paused</option>
                                </select>
                              </label>
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleApplyRecurringDraft}
                                disabled={saving || !stagedRecurringBrief?.taskId}
                                className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <Save className="h-4 w-4" />
                                Apply drafted posture
                              </button>
                              {!stagedRecurringBrief?.taskId && (
                                <span className="text-[11px] text-text-muted">Commander needs a persisted recurring mission before this posture can be applied.</span>
                              )}
                            </div>
                          </div>
                        )}
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Expected improvement</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedRecurringBrief.expectedImprovement}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Verify next</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedRecurringBrief.verificationTarget}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Success criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedRecurringBrief.successCriteria}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Rollback criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedRecurringBrief.rollbackCriteria}</div>
                          </div>
                        </div>
                        {stagedRecurringHistory?.available && (
                          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Recent recurring changes</div>
                            <div className="mt-2 text-[12px] font-semibold text-text-primary">{stagedRecurringHistory.title}</div>
                            <div className="mt-1 text-[12px] leading-6 text-text-body">{stagedRecurringHistory.detail}</div>
                            {stagedRecurringHistory.history?.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {stagedRecurringHistory.history.map((entry) => (
                                  <div key={entry.id} className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                                      {entry.timestamp ? new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current session'}
                                    </div>
                                    <div className="mt-1 text-[11px] leading-5 text-text-body">{entry.summary}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {stagedRecurringVerdict?.available && (
                          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Post-change verdict</div>
                            <div className="mt-2 text-[12px] font-semibold text-text-primary">{stagedRecurringVerdict.title}</div>
                            <div className="mt-1 text-[12px] leading-6 text-text-body">{stagedRecurringVerdict.detail}</div>
                            {(stagedRecurringVerdict.previousPosture || stagedRecurringVerdict.currentPosture) && (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                {stagedRecurringVerdict.previousPosture && (
                                  <div className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-text-body">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Previous posture</div>
                                    <div className="mt-1">Cadence: {formatRecurringPostureValue(stagedRecurringVerdict.previousPosture.cadence)}</div>
                                    <div>Approval: {formatRecurringPostureValue(stagedRecurringVerdict.previousPosture.approvalPosture)}</div>
                                    <div>Mission mode: {formatRecurringPostureValue(stagedRecurringVerdict.previousPosture.missionMode)}</div>
                                    <div>Run state: {formatRecurringPostureValue(stagedRecurringVerdict.previousPosture.paused, 'paused')}</div>
                                  </div>
                                )}
                                {stagedRecurringVerdict.currentPosture && (
                                  <div className="rounded-[14px] border border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-2.5 text-[11px] leading-5 text-text-body">
                                    <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Current posture</div>
                                    <div className="mt-1">Cadence: {formatRecurringPostureValue(stagedRecurringVerdict.currentPosture.cadence)}</div>
                                    <div>Approval: {formatRecurringPostureValue(stagedRecurringVerdict.currentPosture.approvalPosture)}</div>
                                    <div>Mission mode: {formatRecurringPostureValue(stagedRecurringVerdict.currentPosture.missionMode)}</div>
                                    <div>Run state: {formatRecurringPostureValue(stagedRecurringVerdict.currentPosture.paused, 'paused')}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {stagedRecurringPayback?.available && (
                          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Recurring payback</div>
                            <div className="mt-2 text-[12px] font-semibold text-text-primary">{stagedRecurringPayback.title}</div>
                            <div className="mt-1 text-[12px] leading-6 text-text-body">{stagedRecurringPayback.detail}</div>
                            <div className="mt-3 grid gap-2 md:grid-cols-4">
                              {stagedRecurringPayback.metrics.map((metric) => (
                                <div key={metric.label} className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{metric.label}</div>
                                  <div className="mt-1 text-[12px] font-semibold text-text-primary">{metric.value}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {stagedRecurringNextCorrection?.available && (
                          <div className="mt-3 rounded-[18px] border border-aurora-blue/15 bg-aurora-blue/[0.05] px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue">Next move</div>
                            <div className="mt-2 text-[12px] font-semibold text-text-primary">{stagedRecurringNextCorrection.title}</div>
                            <div className="mt-1 text-[12px] leading-6 text-text-body">{stagedRecurringNextCorrection.detail}</div>
                            {stagedRecurringNextCorrection.action?.available && stagedRecurringNextCorrection.tone !== 'teal' && (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => handleStageRecurringAction(stagedRecurringCandidate, stagedRecurringNextCorrection.action)}
                                  className="inline-flex items-center gap-2 rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[11px] font-semibold text-aurora-blue"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Stage {stagedRecurringNextCorrection.action.actionLabel}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {lastAppliedRecurringResult && (
                          <div className="mt-3 rounded-[18px] border border-aurora-green/15 bg-aurora-green/[0.05] px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-green">Saved confirmation</div>
                            <div className="mt-2 text-[12px] font-semibold text-text-primary">Recurring posture saved</div>
                            {lastAppliedRecurringResult.previousPosture && (
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="rounded-[14px] border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-text-body">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Before</div>
                                  <div className="mt-1">Cadence: {formatRecurringPostureValue(lastAppliedRecurringResult.previousPosture.cadence)}</div>
                                  <div>Approval: {formatRecurringPostureValue(lastAppliedRecurringResult.previousPosture.approvalPosture)}</div>
                                  <div>Mission mode: {formatRecurringPostureValue(lastAppliedRecurringResult.previousPosture.missionMode)}</div>
                                  <div>Run state: {formatRecurringPostureValue(lastAppliedRecurringResult.previousPosture.paused, 'paused')}</div>
                                </div>
                                <div className="rounded-[14px] border border-aurora-green/15 bg-aurora-green/[0.05] px-3 py-2.5 text-[11px] leading-5 text-text-body">
                                  <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-green">After</div>
                                  <div className="mt-1">Cadence: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.cadence)}</div>
                                  <div>Approval: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.approvalPosture)}</div>
                                  <div>Mission mode: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.missionMode)}</div>
                                  <div>Run state: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.paused, 'paused')}</div>
                                </div>
                              </div>
                            )}
                            <div className="mt-2 space-y-1 text-[12px] leading-6 text-text-body">
                              <div>Cadence: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.cadence)}</div>
                              <div>Approval: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.approvalPosture)}</div>
                              <div>Mission mode: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.missionMode)}</div>
                              <div>Run state: {formatRecurringPostureValue(lastAppliedRecurringResult.posture.paused, 'paused')}</div>
                            </div>
                            {lastAppliedRecurringResult.guardrails?.length > 0 && (
                              <div className="mt-3 text-[11px] leading-5 text-text-muted">
                                Guardrails: {lastAppliedRecurringResult.guardrails.join(' ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {stagedConnectorBrief && (
                      <div className="rounded-[24px] border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-blue">Staged connector action</div>
                            <div className="mt-2 text-sm font-semibold text-text-primary">{stagedConnectorBrief.title}</div>
                          </div>
                          <span className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-blue">
                            {stagedConnectorBrief.actionLabel}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Target lane</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.targetRole || 'ops'}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Approval posture</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{String(stagedConnectorBrief.targetApprovalPosture || 'risk_weighted').replaceAll('_', ' ')}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Expected improvement</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.expectedImprovement}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Verify next</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.verificationTarget}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Success criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.successCriteria}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Rollback criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.rollbackCriteria}</div>
                          </div>
                        </div>
                        {stagedConnectorBrief.affectedBranches?.length ? (
                          <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Affected branches</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedConnectorBrief.affectedBranches.join(', ')}</div>
                          </div>
                        ) : null}
                      </div>
                    )}
                    {stagedDispatchBrief && (
                      <div className="rounded-[24px] border border-aurora-violet/15 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-violet">Staged dispatch order</div>
                            <div className="mt-2 text-sm font-semibold text-text-primary">{stagedDispatchBrief.title}</div>
                          </div>
                          <span className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-violet">
                            {stagedDispatchBrief.actionLabel}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Expected improvement</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedDispatchBrief.expectedImprovement}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Verification target</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedDispatchBrief.verificationTarget}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Success criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedDispatchBrief.successCriteria}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Rollback criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedDispatchBrief.rollbackCriteria}</div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-3 text-[12px] leading-6 text-text-body">
                          <div><span className="font-semibold text-text-primary">Do next:</span> {stagedDispatchBrief.nextMove}</div>
                          {stagedDispatchBrief.topTaskTitle ? (
                            <div className="mt-1"><span className="font-semibold text-text-primary">Top branch:</span> {stagedDispatchBrief.topTaskTitle}</div>
                          ) : null}
                          <div className="mt-1">
                            <span className="font-semibold text-text-primary">Pressure mix:</span> Safe parallel {stagedDispatchBrief.safeParallelCount}, serialized {stagedDispatchBrief.serializedCount}, held upstream {stagedDispatchBrief.heldUpstreamCount}
                          </div>
                        </div>
                      </div>
                    )}
                    {stagedControlBrief && (
                      <div className="rounded-[24px] border border-aurora-amber/15 bg-[linear-gradient(135deg,rgba(251,191,36,0.08),rgba(255,255,255,0.02))] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-amber">Staged live control brief</div>
                            <div className="mt-2 text-sm font-semibold text-text-primary">{stagedControlBrief.title}</div>
                          </div>
                          <span className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-amber">
                            {stagedControlBrief.actionLabel}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Current state</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedControlBrief.currentState}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Expected improvement</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedControlBrief.expectedImprovement}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Verification target</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedControlBrief.verificationTarget}</div>
                          </div>
                          <div className="rounded-[18px] border border-white/10 bg-black/20 px-3 py-3">
                            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Success criteria</div>
                            <div className="mt-2 text-[12px] leading-6 text-text-body">{stagedControlBrief.successCriteria}</div>
                          </div>
                        </div>
                        <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-3 text-[12px] leading-6 text-text-body">
                          <div><span className="font-semibold text-text-primary">Do next:</span> {String(stagedControlBrief.nextMove || 'review_control_state').replaceAll('_', ' ')}</div>
                          {stagedControlBrief.taskTitle ? (
                            <div className="mt-1"><span className="font-semibold text-text-primary">Branch:</span> {stagedControlBrief.taskTitle}</div>
                          ) : null}
                          <div className="mt-1"><span className="font-semibold text-text-primary">Rollback:</span> {stagedControlBrief.rollbackCriteria}</div>
                        </div>
                      </div>
                    )}
                    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                        <Command className="h-3.5 w-3.5 text-aurora-teal" />
                        Step 1 · describe the task
                      </div>
                      <textarea
                        value={quickstartPrompt}
                        onChange={(event) => setQuickstartPrompt(event.target.value)}
                        className="mt-4 min-h-[200px] w-full rounded-[22px] border border-white/10 bg-black/30 px-4 py-4 text-sm leading-6 text-text-primary outline-none transition-colors focus:border-aurora-teal/30"
                      />
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                        <Layers3 className="h-3.5 w-3.5 text-aurora-blue" />
                        Step 2 · choose launch source
                      </div>
                      <label className="mt-4 block space-y-2 text-sm text-text-body">
                        <span>Use an existing template instead of the parsed draft</span>
                        <select
                          value={selectedTemplateId}
                          onChange={(event) => setSelectedTemplateId(event.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none"
                        >
                          <option value="">Use parsed draft</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                        <CheckCircle2 className="h-3.5 w-3.5 text-aurora-green" />
                        Step 3 · save or launch
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={handleSaveDraft}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-[#10e5d7] disabled:opacity-60"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          Save Template
                        </button>
                        <button
                          type="button"
                          onClick={handleLaunchSession}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-text-primary transition-colors hover:bg-white/[0.06] disabled:opacity-60"
                        >
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 text-aurora-blue" />}
                          Launch Worker
                        </button>
                      </div>
                    </div>
                  </div>
                </Surface>

                <div className="space-y-5">
                  <Surface
                    eyebrow="Draft"
                    title={quickstartDraft.name}
                    description="Jarvis inferred this template from your ask. Review the role, provider, and required access before you save or launch."
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <StatusPill label="Role" value={quickstartDraft.role} tone="text-aurora-blue" />
                      <StatusPill label="Model" value={quickstartDraft.defaultModel} tone="text-aurora-violet" />
                      <StatusPill label="Provider" value={formatProviderLabel(quickstartProvider)} tone="text-aurora-teal" />
                      <StatusPill
                        label="Credential State"
                        value={quickstartProvider === 'custom' ? 'Custom model' : providerConnected ? 'Connected' : 'Needs setup'}
                        tone={quickstartProvider === 'custom' || providerConnected ? 'text-aurora-green' : 'text-aurora-amber'}
                      />
                    </div>
                    <div className="mt-4 rounded-[22px] border border-white/10 bg-black/20 p-4">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">System prompt</div>
                      <p className="mt-3 text-sm leading-6 text-text-body">{quickstartDraft.systemPrompt}</p>
                    </div>
                  </Surface>

                  <Surface
                    eyebrow="Readiness"
                    title="Fix blockers before launch"
                    description="The create flow should tell you what to do next, not make you guess where the problem lives."
                  >
                    <div className="space-y-3">
                      <ReadinessItem
                        label={`${formatProviderLabel(quickstartProvider)} provider`}
                        ready={quickstartProvider === 'custom' || providerConnected}
                        detail={
                          quickstartProvider === 'custom'
                            ? 'Custom models skip provider automation.'
                            : providerConnected
                              ? 'Credential found in Settings and vault auto-wiring is available.'
                              : 'No provider key found yet. Connect the provider in Settings.'
                        }
                      />
                      <ReadinessItem
                        label="Commander link"
                        ready={Boolean(commander?.id)}
                        detail={commander?.id
                          ? 'Durable commander row is available for session lineage.'
                          : 'Launch still works, but the session will safely skip the commander foreign key until the durable commander record is available.'}
                      />
                      <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-semibold text-text-primary">Required access</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(quickstartDraft.vaultRequirements.length ? quickstartDraft.vaultRequirements : ['No required vaults']).map((requirement) => (
                            <span key={requirement} className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', quickstartDraft.vaultRequirements.length ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber' : 'border-white/10 bg-white/[0.04] text-text-body')}>
                              {requirement}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
                        <div className="text-sm font-semibold text-text-primary">Allowed tools</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {quickstartDraft.allowedTools.map((tool) => (
                            <span key={tool} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-text-body">
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                      {blockers.length > 0 && (
                        <div className="rounded-[20px] border border-aurora-amber/20 bg-aurora-amber/10 p-4">
                          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-aurora-amber">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            Current blockers
                          </div>
                          <div className="mt-3 space-y-2 text-sm leading-6 text-text-body">
                            {blockers.map((blocker) => (
                              <p key={blocker}>{blocker}</p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Surface>
                </div>
              </Motion.div>
            )}

            {activeTab === 'registry' && (
              <Motion.div key="registry" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <Surface
                  eyebrow="Registry"
                  title="Reusable blueprints and durable operators"
                  description="Templates are the main durable asset. Only keep a small number of always-on operators."
                  action={(
                    <div className="flex flex-wrap gap-2">
                      {registryTabs.map((item) => (
                        <SegmentedButton key={item.id} label={item.label} active={activeRegistryTab === item.id} onClick={() => setActiveRegistryTab(item.id)} />
                      ))}
                    </div>
                  )}
                >
                  <InlineAlert message={errorState.scope === 'registry' ? errorState.message : ''} />
                  {activeRegistryTab === 'templates' ? (
                    <div className="mt-4 grid gap-5 xl:grid-cols-[0.78fr_1.22fr]">
                      <div className="space-y-3">
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            type="button"
                            onClick={() => setSelectedTemplateEditId(template.id)}
                            className={cn(
                              'w-full rounded-[22px] border px-4 py-4 text-left transition-colors',
                              selectedTemplateEditId === template.id
                                ? 'border-aurora-teal/25 bg-aurora-teal/10'
                                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-text-primary">{template.name}</div>
                                <div className="mt-1 text-xs leading-5 text-text-muted">{template.description}</div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-text-muted" />
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                        {templateDraft ? (
                          <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div>
                                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Template detail</div>
                                <div className="mt-2 text-lg font-semibold text-text-primary">{templateDraft.name}</div>
                              </div>
                              <button
                                type="button"
                                onClick={handlePersistTemplateDraft}
                                disabled={saving}
                                className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2.5 text-sm font-semibold text-black"
                              >
                                <Save className="h-4 w-4" />
                                Save Changes
                              </button>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="space-y-2 text-sm text-text-body">
                                <span>Name</span>
                                <input value={templateDraft.name} onChange={(event) => patchTemplateDraft('name', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                              </label>
                              <label className="space-y-2 text-sm text-text-body">
                                <span>Default model</span>
                                <input value={templateDraft.defaultModel} onChange={(event) => patchTemplateDraft('defaultModel', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                              </label>
                            </div>
                            <label className="space-y-2 text-sm text-text-body">
                              <span>Description</span>
                              <textarea value={templateDraft.description} onChange={(event) => patchTemplateDraft('description', event.target.value)} className="min-h-[100px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                            </label>
                            <div className="grid gap-4 md:grid-cols-2">
                              <label className="space-y-2 text-sm text-text-body">
                                <span>Approval mode</span>
                                <select value={templateDraft.approvalMode} onChange={(event) => patchTemplateDraft('approvalMode', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none">
                                  <option value="review_first">Review first</option>
                                  <option value="approval_required">Approval required</option>
                                  <option value="autonomous">Autonomous</option>
                                </select>
                              </label>
                              <label className="space-y-2 text-sm text-text-body">
                                <span>Spawn policy</span>
                                <select value={templateDraft.spawnPolicy} onChange={(event) => patchTemplateDraft('spawnPolicy', event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none">
                                  <option value="ephemeral">Ephemeral</option>
                                  <option value="persistent">Persistent</option>
                                </select>
                              </label>
                            </div>
                            <label className="space-y-2 text-sm text-text-body">
                              <span>System prompt</span>
                              <textarea value={templateDraft.systemPrompt} onChange={(event) => patchTemplateDraft('systemPrompt', event.target.value)} className="min-h-[140px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                            </label>
                            <div className="rounded-[22px] border border-white/10 bg-black/30 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Vault inheritance</div>
                                  <div className="mt-1 text-sm text-text-body">Attach a vault that this template can inherit at runtime.</div>
                                </div>
                                <div className="flex gap-2">
                                  <select value={selectedVaultId} onChange={(event) => setSelectedVaultId(event.target.value)} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-text-primary outline-none">
                                    <option value="">Select vault</option>
                                    {vaults.map((vault) => (
                                      <option key={vault.id} value={vault.id}>{vault.name}</option>
                                    ))}
                                  </select>
                                  <button type="button" onClick={() => handleBindVaultToTemplate(templateDraft.id, selectedVaultId)} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-text-primary">
                                    Bind
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {(templateBindingMap.get(templateDraft.id) || []).map((binding) => (
                                  <span key={binding.id} className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-amber">
                                    {vaultById.get(binding.vaultId)?.name || 'Linked vault'}
                                  </span>
                                ))}
                                {(templateBindingMap.get(templateDraft.id) || []).length === 0 && (
                                  <span className="text-sm text-text-muted">No vaults attached yet.</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center text-text-muted">Select a template to edit.</div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {durableAgents.map((agent) => (
                        <div key={agent.id} className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold text-text-primary">{agent.name}</div>
                              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">{agent.role}</div>
                            </div>
                            <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', sessionTone[agent.status === 'processing' ? 'running' : agent.status] || sessionTone.cancelled)}>
                              {agent.status}
                            </span>
                          </div>
                          <div className="mt-4 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-text-body">
                            <div className="font-medium text-text-primary">{agent.model}</div>
                            <div className="mt-1">{agent.roleDescription || 'Durable operator in the command layer.'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Surface>
              </Motion.div>
            )}

            {activeTab === 'runs' && (
              <Motion.div key="runs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)_320px]">
                <Surface eyebrow="Runs" title="Session queue" description="Open a run to load its timeline, transcript, and debug detail.">
                  <InlineAlert message={errorState.scope === 'runs' ? errorState.message : ''} />
                  <div className="mt-4 space-y-3">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => setSelectedSessionId(session.id)}
                        className={cn(
                          'w-full rounded-[22px] border px-4 py-4 text-left transition-colors',
                          selectedSessionId === session.id
                            ? 'border-aurora-teal/25 bg-aurora-teal/10'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-text-primary">{session.title}</div>
                            <div className="mt-1 text-xs text-text-muted">{templateById.get(session.templateId)?.name || 'Template detached'} · {session.requestedModel || 'No model'}</div>
                          </div>
                          <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', sessionTone[session.status] || sessionTone.cancelled)}>
                            {formatStatusLabel(session.status)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </Surface>

                <Surface eyebrow="Run Console" title={selectedSession?.title || 'Select a session'} description="The session console is the runtime truth for delegated work.">
                  {selectedSession ? (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-4">
                        <StatusPill label="Workers" value={selectedSession.activeWorkerCount} tone="text-aurora-teal" />
                        <StatusPill label="Tokens" value={selectedSession.totalTokens} tone="text-aurora-blue" />
                        <StatusPill label="Tool Calls" value={selectedSession.toolCallCount} tone="text-aurora-amber" />
                        <StatusPill label="Retries" value={selectedSession.retryCount} tone="text-aurora-rose" />
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-2">
                        <TraceWaterfall spans={sessionSpans} />
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-text-muted">
                          <BrainCircuit className="h-3.5 w-3.5 text-aurora-blue" />
                          Transcript and debug
                        </div>
                        <div className="mt-4 space-y-3">
                          {eventsLoading && <Loader2 className="h-4 w-4 animate-spin text-aurora-teal" />}
                          {!eventsLoading && sessionEvents.map((event) => (
                            <div key={event.id} className="rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-text-primary">{event.title || event.eventType}</div>
                                <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{event.eventType}</span>
                              </div>
                              <div className="mt-2 text-sm leading-6 text-text-body">{event.content || 'No content recorded.'}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center text-text-muted">Select a session to load transcript and debug events.</div>
                  )}
                </Surface>

                <Surface eyebrow="Inspector" title="Jarvis guidance" description="Keep recommendations and blocking context separate from the main execution surface.">
                  {selectedSession ? (
                    <div className="space-y-3">
                      <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-text-body">
                        {selectedSession.status === 'needs_review'
                          ? 'Approval gate is active. Commander should inspect tool writes and confirm before continuing.'
                          : selectedSession.status === 'running'
                            ? 'Session is actively executing. Event loading stays scoped to this run so the app remains responsive.'
                            : 'Session is no longer live. Historical detail is available without keeping the worker in the active fleet.'}
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-text-body">
                        Bound template: <span className="font-semibold text-text-primary">{templateById.get(selectedSession.templateId)?.name || 'Detached'}</span>
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-text-body">
                        Provider: <span className="font-semibold text-text-primary">{formatProviderLabel(inferProvider(selectedSession.requestedModel || ''))}</span>
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-text-body">
                        Prompt: {selectedSession.prompt}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-white/10 px-4 py-10 text-center text-text-muted">Pick a run to inspect status, model, and operator guidance.</div>
                  )}
                </Surface>
              </Motion.div>
            )}

            {activeTab === 'infrastructure' && (
              <Motion.div key="infrastructure" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <Surface
                  eyebrow="Infrastructure"
                  title="Connections, vaults, and operational readiness"
                  description="Keep provider credentials, vault inheritance, MCP tooling, and knowledge surfaces in one place."
                  action={(
                    <div className="flex flex-wrap gap-2">
                      {infrastructureTabs.map((item) => (
                        <SegmentedButton key={item.id} label={item.label} active={activeInfrastructureTab === item.id} onClick={() => setActiveInfrastructureTab(item.id)} />
                      ))}
                    </div>
                  )}
                >
                  <InlineAlert message={errorState.scope === 'infrastructure' ? errorState.message : ''} />
                  {activeInfrastructureTab === 'overview' ? (
                    <div className="mt-4 grid gap-5 xl:grid-cols-2">
                      <div className="space-y-5">
                        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Providers</div>
                          <div className="mt-4 grid gap-3">
                            {providerStatuses.map((provider) => (
                              <ReadinessItem
                                key={provider.id}
                                label={provider.label}
                                ready={provider.ready}
                                detail={provider.ready ? 'API key found in Settings. Vault automation is available.' : 'No API key found yet in Settings.'}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">MCP servers</div>
                          <div className="mt-4 space-y-3">
                            {servers.map((server) => (
                              <div key={server.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                                <div className="text-sm font-semibold text-text-primary">{server.name}</div>
                                <div className="mt-1 text-xs text-text-muted">{server.url}</div>
                                <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-aurora-teal">{server.toolCount} tools · {server.status}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Connected systems</div>
                          <div className="mt-4 space-y-3">
                            {connectedSystems.map((system) => (
                              <div key={system.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                                <div className="text-sm font-semibold text-text-primary">{system.displayName}</div>
                                <div className="mt-1 text-xs text-text-muted">{system.category} · {system.domain || 'general'} · {system.status}</div>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {system.capabilities.map((capability) => (
                                    <span key={capability} className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-text-body">{capability}</span>
                                  ))}
                                  {(system.permissionScope || []).map((scope) => (
                                    <span key={`${system.id}-${scope}`} className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-aurora-amber">{formatPermissionScope(scope)}</span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Knowledge surfaces</div>
                          <div className="mt-4 space-y-3">
                            {namespaces.map((namespace) => (
                              <div key={namespace.id} className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4">
                                <div className="text-sm font-semibold text-text-primary">{namespace.name}</div>
                                <div className="mt-1 text-xs text-text-muted">{namespace.sizeLabel} · {namespace.vectors} vectors</div>
                                <div className="mt-3 text-[10px] uppercase tracking-[0.16em] text-aurora-blue">{namespace.status}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
                      <div className="space-y-3">
                        {vaults.map((vault) => (
                          <div key={vault.id} className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-sm font-semibold text-text-primary">{vault.name}</div>
                                <div className="mt-1 text-xs text-text-muted">{vault.provider}</div>
                              </div>
                              <span className={cn('rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]', vault.status === 'active' ? 'border-aurora-green/20 bg-aurora-green/10 text-aurora-green' : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber')}>
                                {vault.status}
                              </span>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {vault.secretRefs.map((item) => (
                                <span key={item} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-text-body">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-[26px] border border-white/10 bg-black/20 p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Create vault</div>
                            <div className="mt-2 text-lg font-semibold text-text-primary">Provision a new credential vault</div>
                            <div className="mt-1 text-sm text-text-body">Secrets stay masked after creation. The UI only exposes readiness and binding state.</div>
                          </div>
                          <button type="button" onClick={handleCreateVault} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-4 py-2.5 text-sm font-semibold text-black">
                            <FolderLock className="h-4 w-4" />
                            New Vault
                          </button>
                        </div>
                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-text-body">
                            <span>Vault name</span>
                            <input value={vaultDraft.name} onChange={(event) => setVaultDraft((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                          </label>
                          <label className="space-y-2 text-sm text-text-body">
                            <span>Provider</span>
                            <input value={vaultDraft.provider} onChange={(event) => setVaultDraft((current) => ({ ...current, provider: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                          </label>
                        </div>
                        <label className="mt-4 block space-y-2 text-sm text-text-body">
                          <span>Secret references</span>
                          <input value={vaultDraft.secretRefs} onChange={(event) => setVaultDraft((current) => ({ ...current, secretRefs: event.target.value }))} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-text-primary outline-none" />
                        </label>
                        <div className="mt-4 rounded-[22px] border border-aurora-blue/20 bg-aurora-blue/10 p-4 text-sm leading-6 text-text-body">
                          Vault bindings are inherited by spawned workers through template relationships. Missing required vaults should block launch until the template is ready.
                        </div>
                      </div>
                    </div>
                  )}
                </Surface>
              </Motion.div>
            )}
          </AnimatePresence>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <CheckCircle2 className="h-3.5 w-3.5 text-aurora-green" />
                Runtime posture
              </div>
              <p className="mt-3 text-sm leading-6 text-text-body">
                Templates load eagerly because they are small. Sessions stay live. Events load only for the session you open so the runtime surface stays responsive as history grows.
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <Clock3 className="h-3.5 w-3.5 text-aurora-amber" />
                Ephemeral lifecycle
              </div>
              <p className="mt-3 text-sm leading-6 text-text-body">
                Workers are linked to sessions, marked ephemeral, and prepared for archival so the default agent queries do not accumulate stale execution clutter.
              </p>
            </div>
            <div className="rounded-[20px] border border-white/10 bg-black/20 p-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-aurora-blue" />
                Vault discipline
              </div>
              <p className="mt-3 text-sm leading-6 text-text-body">
                Vaults are explicit, bindable assets. Templates declare their needs, and runtime sessions can surface missing credentials before a write-heavy flow proceeds.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
