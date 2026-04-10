import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import {
  AlarmClock,
  Calendar,
  ChevronDown,
  CircleAlert,
  Loader2,
  Play,
  ShieldCheck,
  Save,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useConnectedSystems, useTasks } from '../../utils/useSupabase';
import { deriveRoutingDecision } from '../../utils/routingPolicy';
import { getPreflightAlignmentSummary } from '../../utils/commanderAnalytics';

const SESSION_KEY = 'mission-creator-session-v1';
const SAVED_PRESETS_KEY = 'mission-creator-presets-v1';

const MODE_OPTIONS = [
  { value: 'fast', label: 'Fast', hint: 'Prioritize speed' },
  { value: 'balanced', label: 'Balanced', hint: 'Default' },
  { value: 'efficient', label: 'Efficient', hint: 'Prioritize cost' },
];

const MISSION_MODE_OPTIONS = [
  { value: 'do_now', label: 'Do now', hint: 'Launch immediately with the selected routing lane.' },
  { value: 'plan_first', label: 'Plan first', hint: 'Build the graph and hold execution until you step in.' },
  { value: 'watch_and_approve', label: 'Watch and approve', hint: 'Prepare the work and pause at the first human gate.' },
];

const WHEN_OPTIONS = [
  { value: 'now', label: 'Now' },
  { value: 'later_today', label: 'Later today' },
  { value: 'pick', label: 'Pick date & time' },
  { value: 'repeat', label: 'Repeat' },
];

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical - needs you now', score: 9 },
  { value: 'standard', label: 'Standard', score: 5 },
  { value: 'low', label: 'Low', score: 2 },
];

const OUTPUT_OPTIONS = [
  { value: 'summary', label: 'Summary only' },
  { value: 'email_drafts', label: 'Email drafts' },
  { value: 'crm_notes', label: 'CRM notes' },
  { value: 'report', label: 'Report / doc' },
  { value: 'custom', label: 'Custom...' },
];

const TARGET_OPTIONS = [
  { value: 'pipedrive_deal', label: 'Pipedrive - deal' },
  { value: 'pipedrive_person', label: 'Pipedrive - person' },
  { value: 'internal', label: 'Internal only' },
];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const COMMANDER_PRESETS = [
  {
    id: 'prospect-sweep',
    label: 'Prospect Sweep',
    intent: 'Research 10 new 3PL prospects, rank them by fit, and draft intro emails for the best opportunities.',
    defaults: {
      mode: 'balanced',
      missionMode: 'do_now',
      when: 'now',
      priority: 'standard',
      outputType: 'email_drafts',
      targetType: 'internal',
      targetIdentifier: '',
    },
  },
  {
    id: 'post-call-summary',
    label: 'Post-Call Summary',
    intent: 'Summarize today’s calls, extract decisions and follow-ups, and post clean notes to Pipedrive.',
    defaults: {
      mode: 'efficient',
      missionMode: 'plan_first',
      when: 'later_today',
      priority: 'standard',
      outputType: 'crm_notes',
      targetType: 'pipedrive_deal',
      targetIdentifier: '',
    },
  },
  {
    id: 'quote-follow-up',
    label: 'Quote Follow-up',
    intent: 'Review stalled quotes, identify the best follow-up angle for each one, and draft outreach for the top opportunities.',
    defaults: {
      mode: 'fast',
      missionMode: 'watch_and_approve',
      when: 'now',
      priority: 'critical',
      outputType: 'email_drafts',
      targetType: 'pipedrive_person',
      targetIdentifier: '',
    },
  },
  {
    id: '3pl-ops-check',
    label: '3PL Ops Check',
    intent: 'Check tracking on shipments delayed more than 2 days, summarize root causes, and flag any customers that need outreach.',
    defaults: {
      mode: 'balanced',
      missionMode: 'watch_and_approve',
      when: 'repeat',
      priority: 'standard',
      outputType: 'summary',
      targetType: 'internal',
      targetIdentifier: '',
      repeatFrequency: 'daily',
      repeatTime: '09:00',
    },
  },
];

function inferAgentModeBadge(agent) {
  if (agent?.isSyntheticCommander) return 'SUB';
  const model = String(agent?.model || '').toLowerCase();
  const localHints = ['llama', 'mistral', 'gemma', 'qwen', 'deepseek', 'ollama', 'hermes'];
  return localHints.some(hint => model.includes(hint)) ? 'LOCAL' : 'SUB';
}

function pickPrimaryOperationsAgent(agents) {
  return (
    agents.find(agent => /tony|atlas/i.test(agent.name || ''))
    || agents.find(agent => agent.role === 'commander' && !agent.isSyntheticCommander)
    || agents.find(agent => agent.role === 'commander')
    || agents[0]
    || null
  );
}

function inferBestAgent(intent, agents) {
  const selectableAgents = agents.filter(agent => !agent.isSyntheticCommander);
  const primary = pickPrimaryOperationsAgent(selectableAgents.length ? selectableAgents : agents);
  if (!intent.trim()) return primary;

  const lower = intent.toLowerCase();
  const preferenceSets = [
    {
      match: ['email', 'prospect', 'research', 'draft', 'outreach'],
      roles: ['researcher', 'commander'],
      names: ['lyra', 'orion', 'atlas', 'tony'],
    },
    {
      match: ['summary', 'notes', 'call', 'pipedrive', 'crm'],
      roles: ['commander', 'qa', 'researcher'],
      names: ['atlas', 'nova', 'orion'],
    },
    {
      match: ['tracking', 'shipment', 'delay', 'ops', 'check'],
      roles: ['commander', 'qa'],
      names: ['atlas', 'nova', 'tony'],
    },
  ];

  for (const set of preferenceSets) {
    if (!set.match.some(term => lower.includes(term))) continue;
    const byName = agents.find(agent => set.names.some(name => (agent.name || '').toLowerCase().includes(name)));
    if (byName) return byName;
    const byRole = agents.find(agent => set.roles.includes(agent.role));
    if (byRole) return byRole;
  }

  return primary;
}

function inferExplicitOutput(intent) {
  const lower = intent.toLowerCase();
  if (/(email|draft|outreach)/.test(lower)) return 'email_drafts';
  if (/(pipedrive|crm|notes)/.test(lower)) return 'crm_notes';
  if (/(report|doc)/.test(lower)) return 'report';
  return null;
}

function findAgentByDoctrineName(agents, doctrineName) {
  if (!doctrineName) return null;
  const normalized = doctrineName.toLowerCase();
  return agents.find((agent) => (agent.name || '').toLowerCase() === normalized)
    || agents.find((agent) => (agent.name || '').toLowerCase().includes(normalized))
    || null;
}

function deriveTodayRunAt() {
  const now = new Date();
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  later.setMinutes(0, 0, 0);
  return later.toISOString().slice(0, 16);
}

function datetimeLocalNowPlus(minutes = 0) {
  const date = new Date(Date.now() + minutes * 60_000);
  const tzOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

function loadSessionDefaults() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function loadSavedPresets() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SAVED_PRESETS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessionDefaults(data) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    // ignore session storage failures
  }
}

function savePresetToSession(preset) {
  try {
    const existing = loadSavedPresets();
    const next = [preset, ...existing].slice(0, 8);
    sessionStorage.setItem(SAVED_PRESETS_KEY, JSON.stringify(next));
  } catch {
    // ignore session storage failures
  }
}

function initialFormState(agents) {
  const session = loadSessionDefaults();
  const primaryAgent = pickPrimaryOperationsAgent(agents);
  return {
    intent: '',
    agentId: session.agentId || primaryAgent?.id || '',
    mode: session.mode || 'balanced',
    missionMode: session.missionMode || 'do_now',
    when: session.when || 'now',
    priority: session.priority || 'standard',
    outputType: session.outputType || 'summary',
    outputSpec: session.outputSpec || '',
    targetType: session.targetType || 'internal',
    targetIdentifier: session.targetIdentifier || '',
    runAt: session.runAt || datetimeLocalNowPlus(15),
    repeatFrequency: session.repeatFrequency || 'daily',
    repeatTime: session.repeatTime || '09:00',
    repeatEndDate: session.repeatEndDate || '',
  };
}

function SectionLabel({ children }) {
  return <label className="text-[10px] uppercase tracking-[0.18em] text-text-muted font-semibold block mb-2">{children}</label>;
}

function summarizeMissionIntent(intent) {
  const trimmed = intent.trim();
  if (!trimmed) {
    return {
      objective: 'Waiting for mission intent',
      confidence: 18,
      cues: ['Add the action', 'Mention the destination', 'Say what finished looks like'],
      inferredOutput: 'Summary only',
    };
  }

  const lower = trimmed.toLowerCase();
  const cues = [];
  let confidence = 42;

  if (/(research|review|check|summarize|draft|alert|analyze|clean up|pull)/.test(lower)) {
    confidence += 16;
    cues.push('Clear action detected');
  }
  if (/(today|tomorrow|daily|weekly|monthly|later|now|at \d|\d{1,2}:\d{2})/.test(lower)) {
    confidence += 12;
    cues.push('Timing signal found');
  }
  if (/(email|pipedrive|crm|shipment|tracking|deal|person|report|notes|customer)/.test(lower)) {
    confidence += 14;
    cues.push('Destination or artifact is specific');
  }
  if (/\d+/.test(lower)) {
    confidence += 8;
    cues.push('Scope is measurable');
  }

  const inferredOutput =
    /(email|draft)/.test(lower) ? 'Email drafts'
      : /(pipedrive|crm|notes)/.test(lower) ? 'CRM notes'
        : /(report|doc)/.test(lower) ? 'Report / doc'
          : 'Summary only';

  return {
    objective: trimmed.length > 88 ? `${trimmed.slice(0, 85).trimEnd()}...` : trimmed,
    confidence: Math.min(96, confidence),
    cues: cues.length ? cues : ['Intent is still broad', 'Defaults will stay conservative'],
    inferredOutput,
  };
}

function describeWhyAgent(intent, agent) {
  if (!agent) return 'No agent selected yet.';
  const lower = intent.toLowerCase();
  if (/(email|prospect|research|outreach)/.test(lower)) return `${agent.name} fits discovery and outbound-heavy work.`;
  if (/(summary|call|notes|pipedrive|crm)/.test(lower)) return `${agent.name} fits structured synthesis and clean handoff work.`;
  if (/(tracking|shipment|ops|delay|alert)/.test(lower)) return `${agent.name} fits operations monitoring and exception handling.`;
  return `${agent.name} is the safest default execution branch for this mission.`;
}

function describeWhyMode(mode) {
  if (mode === 'fast') return 'Fast mode biases toward quick turnaround and more premium execution.';
  if (mode === 'efficient') return 'Efficient mode keeps cost tighter and accepts a calmer pace.';
  return 'Balanced mode keeps quality, speed, and spend in the middle lane.';
}

function describeMissionMode(missionMode) {
  if (missionMode === 'plan_first') return 'Commander will build the mission graph, route the branches, and hold the machine in planning posture until you step in.';
  if (missionMode === 'watch_and_approve') return 'Commander will prepare the work, but the first runnable branch will stop at a human gate so you can supervise before execution scales.';
  return 'Commander will route the mission and start the runnable branches as soon as the launch gate is clear.';
}

function describeSchedule(form) {
  if (form.when === 'now') return 'Launch immediately when you hit the button.';
  if (form.when === 'later_today') return 'Queue for the next clean slot later today.';
  if (form.when === 'pick') return `Hold until ${form.runAt || 'your chosen time'}.`;
  return `Repeat ${form.repeatFrequency} at ${form.repeatTime}${form.repeatEndDate ? ` until ${form.repeatEndDate}` : ''}.`;
}

function inferSystemsReadback(form, connectedSystems) {
  const intent = String(form.intent || '').toLowerCase();
  const systems = [];

  if (form.targetType !== 'internal' || /pipedrive|crm|deal|person/.test(intent)) systems.push('Pipedrive');
  if (/email|draft|outreach|reply/.test(intent)) systems.push('Email lane');
  if (/doc|report|summary|notes/.test(intent)) systems.push('Workspace docs');
  if (/shipment|tracking|ops|delay/.test(intent)) systems.push('Ops telemetry');

  const connectedLabels = connectedSystems
    .filter((system) => system.status !== 'error')
    .map((system) => system.integrationKey || system.name || '')
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  return [...new Set(systems)].map((label) => {
    const key = label.toLowerCase();
    const connected = connectedLabels.some((entry) => key.includes(entry) || entry.includes(key.split(' ')[0]));
    return { label, connected };
  });
}

function inferDoctrineDefaults({ intent, agents, learningMemory }) {
  const lower = intent.toLowerCase();
  const doctrine = learningMemory?.doctrineById || {};
  const agentDoctrine = doctrine['doctrine-agent'];
  const outputDoctrine = doctrine['doctrine-output'];
  const costDoctrine = doctrine['doctrine-cost'];
  const speedDoctrine = doctrine['doctrine-speed'];
  const routingDoctrine = doctrine['doctrine-routing'];

  const explicitOutput = inferExplicitOutput(intent);
  const doctrineAgent = findAgentByDoctrineName(agents, agentDoctrine?.metrics?.topAgentName);
  const suggestedAgent = doctrineAgent || inferBestAgent(intent, agents);
  const suggestedOutput = explicitOutput || outputDoctrine?.metrics?.dominantOutput || 'summary';

  let suggestedMode = 'balanced';
  if (/(rush|asap|immediately|urgent|today|alert)/.test(lower) && Number(speedDoctrine?.metrics?.approvalCount || 0) === 0) {
    suggestedMode = 'fast';
  } else if (Number(costDoctrine?.metrics?.savings || 0) < 0 || Number(routingDoctrine?.metrics?.spendLeaderCost || 0) > 1.5) {
    suggestedMode = 'efficient';
  }

  return {
    agent: suggestedAgent,
    outputType: suggestedOutput,
    mode: suggestedMode,
    notes: [
      doctrineAgent
        ? `${doctrineAgent.name} is carrying the strongest execution pattern right now.`
        : 'No branch is dominant enough to override the standard agent heuristic yet.',
      explicitOutput
        ? `Your wording already implies ${explicitOutput.replaceAll('_', ' ')}.`
        : `${(outputDoctrine?.metrics?.dominantOutput || 'summary').replaceAll('_', ' ')} is the cleanest recent landing pattern.`,
      suggestedMode === 'fast'
        ? 'Approval drag is light enough to push speed harder.'
        : suggestedMode === 'efficient'
          ? 'Spend concentration suggests a more disciplined mode by default.'
          : 'Balanced mode is still the safest lane for quality and cost together.',
    ],
  };
}

function buildFlightPlan(preview, missionSummary, form) {
  const steps = preview?.steps || [];
  const total = Math.max(steps.length, 1);
  return steps.map((step, index) => {
    const phase = index === 0 ? 'Acquire' : index === total - 1 ? 'Deliver' : 'Process';
    const intensity = Math.max(20, missionSummary.confidence - index * 8);
    return {
      ...step,
      phase,
      progress: `${Math.round(((index + 1) / total) * 100)}%`,
      intensity,
      timing: form.when === 'repeat' ? 'Recurring' : index === 0 ? 'Immediate' : index === total - 1 ? 'Finalization' : 'Mid-run',
    };
  });
}

function buildBranchPreview(preview) {
  const branches = Array.isArray(preview?.branches) ? preview.branches : [];
  const labelByTitle = new Map(branches.map((branch) => [branch.title, branch.branchLabel || branch.title]));
  return branches.map((branch, index) => ({
    ...branch,
    id: `${branch.title}-${index}`,
    dependencies: Array.isArray(branch.dependsOn) ? branch.dependsOn.map((dependency) => labelByTitle.get(dependency) || dependency) : [],
    roleLabel: (branch.agentRole || 'executor').toUpperCase(),
    strategyLabel: branch.executionStrategy === 'parallel' ? 'Parallel' : 'Sequential',
  }));
}

function formatApprovalLabel(value) {
  return String(value || 'risk_weighted').replaceAll('_', ' ');
}

function estimateBranchCount(intent = '') {
  const lower = String(intent || '').toLowerCase();
  let branches = 1;
  if (/(research|analyze|investigate|find)/.test(lower)) branches += 1;
  if (/(draft|email|report|summary|notes)/.test(lower)) branches += 1;
  if (/(verify|review|check|qa|validate)/.test(lower)) branches += 1;
  return Math.min(4, branches);
}

function estimateCostRange({ mode = 'balanced', riskLevel = 'medium', branchCount = 1, confidence = 50 }) {
  const base = mode === 'fast' ? 1.4 : mode === 'efficient' ? 0.55 : 0.9;
  const riskMultiplier = riskLevel === 'high' ? 1.35 : riskLevel === 'medium' ? 1 : 0.8;
  const uncertaintyMultiplier = confidence < 55 ? 1.2 : confidence > 80 ? 0.9 : 1;
  const estimated = base * riskMultiplier * uncertaintyMultiplier * Math.max(1, branchCount * 0.75);
  if (estimated < 0.9) return '$0.25 - $0.90';
  if (estimated < 1.8) return '$0.90 - $1.80';
  if (estimated < 3.5) return '$1.80 - $3.50';
  return '$3.50+';
}

function buildPreflightReadback({
  form,
  preview,
  missionSummary,
  systemsReadback,
  routingDecision,
}) {
  const expectedBranches = Array.isArray(preview?.branches) && preview.branches.length
    ? preview.branches.length
    : estimateBranchCount(form.intent);
  const expectedDuration = preview?.estimatedDuration || (form.missionMode === 'plan_first' ? '2-6 min planning window' : expectedBranches > 2 ? '8-18 min' : '4-12 min');
  const estimatedCost = preview?.estimatedCostRange || estimateCostRange({
    mode: form.mode,
    riskLevel: routingDecision.riskLevel,
    branchCount: expectedBranches,
    confidence: missionSummary.confidence,
  });
  const disconnectedSystems = systemsReadback.filter((system) => !system.connected);
  const topRisks = [
    missionSummary.confidence < 55 ? 'Intent is still broad, so Commander may need to improvise before it can route cleanly.' : null,
    routingDecision.riskLevel === 'high' ? 'This mission touches higher-risk operations and should stay human-aware.' : null,
    form.when === 'repeat' && form.missionMode === 'do_now' ? 'Recurring missions launched in do-now mode can scale mistakes faster than planned review modes.' : null,
    disconnectedSystems.length > 0 ? `${disconnectedSystems.map((system) => system.label).join(', ')} is not fully connected, which can force fallback behavior.` : null,
    form.outputType === 'custom' && !form.outputSpec.trim() ? 'The final artifact is still underspecified, which increases revision risk.' : null,
  ].filter(Boolean).slice(0, 3);
  const uncertainty = [
    preview ? null : 'Branch graph is still estimated until you run Preview plan.',
    missionSummary.confidence >= 75 ? null : 'Commander is missing a little specificity on scope, destination, or success criteria.',
    routingDecision.contextPackIds.length <= 1 ? 'Only the core context pack is loaded so far.' : null,
  ].filter(Boolean).slice(0, 3);

  return {
    expectedBranches,
    expectedDuration,
    estimatedCost,
    approvalPosture: form.missionMode === 'watch_and_approve' ? 'human_required' : routingDecision.approvalLevel,
    contextPacks: routingDecision.contextPackIds,
    requiredCapabilities: routingDecision.requiredCapabilities,
    topRisks,
    uncertainty,
  };
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-2 rounded-xl border text-[11px] font-semibold transition-all',
            value === option.value
              ? 'bg-aurora-teal/10 text-aurora-teal border-aurora-teal/30 shadow-glow-teal'
              : 'bg-surface text-text-muted border-border hover:bg-surface-raised hover:text-text-primary'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function MissionCreatorPanel({
  isOpen,
  agents,
  learningMemory,
  onClose,
  onLaunch,
  onPreview,
}) {
  const { connectedSystems } = useConnectedSystems();
  const { tasks } = useTasks();
  const [form, setForm] = useState(() => initialFormState(agents));
  const [agentTouched, setAgentTouched] = useState(false);
  const [outputTouched, setOutputTouched] = useState(false);
  const [modeTouched, setModeTouched] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState('');
  const [savedPresets, setSavedPresets] = useState(() => loadSavedPresets());
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const textareaRef = useRef(null);

  const selectedAgent = useMemo(
    () => agents.find(agent => agent.id === form.agentId) || pickPrimaryOperationsAgent(agents),
    [agents, form.agentId]
  );
  const pipedriveConnected = useMemo(
    () => connectedSystems.some((system) => system.integrationKey === 'pipedrive' && system.status !== 'error'),
    [connectedSystems]
  );
  const availableTargetOptions = useMemo(
    () => TARGET_OPTIONS.filter((option) => option.value === 'internal' || pipedriveConnected),
    [pipedriveConnected]
  );
  const doctrineDefaults = useMemo(
    () => inferDoctrineDefaults({ intent: form.intent, agents, learningMemory }),
    [agents, form.intent, learningMemory]
  );
  const missionSummary = useMemo(() => summarizeMissionIntent(form.intent), [form.intent]);
  const agentRationale = useMemo(() => describeWhyAgent(form.intent, selectedAgent), [form.intent, selectedAgent]);
  const modeRationale = useMemo(() => describeWhyMode(form.mode), [form.mode]);
  const missionModeRationale = useMemo(() => describeMissionMode(form.missionMode), [form.missionMode]);
  const scheduleRationale = useMemo(() => describeSchedule(form), [form]);
  const flightPlan = useMemo(() => buildFlightPlan(preview, missionSummary, form), [preview, missionSummary, form]);
  const branchPreview = useMemo(() => buildBranchPreview(preview), [preview]);
  const systemsReadback = useMemo(() => inferSystemsReadback(form, connectedSystems), [connectedSystems, form]);
  const routingDecision = useMemo(() => deriveRoutingDecision({
    intent: form.intent,
    targetType: form.targetType,
    outputType: form.outputType === 'custom' ? form.outputSpec || form.outputType : form.outputType,
    repeat: form.when === 'repeat' ? { frequency: form.repeatFrequency, time: form.repeatTime } : null,
    mode: form.mode,
    requiresApproval: form.missionMode === 'watch_and_approve',
  }, selectedAgent, null), [form.intent, form.mode, form.missionMode, form.outputSpec, form.outputType, form.repeatFrequency, form.repeatTime, form.targetType, form.when, selectedAgent]);
  const preflight = useMemo(() => buildPreflightReadback({
    form,
    preview,
    missionSummary,
    systemsReadback,
    routingDecision,
  }), [form, preview, missionSummary, systemsReadback, routingDecision]);
  const preflightAlignment = useMemo(() => getPreflightAlignmentSummary({
    tasks,
    routingDecision,
    missionSummary,
    estimatedCost: preflight.estimatedCost,
    expectedBranches: preflight.expectedBranches,
  }), [tasks, routingDecision, missionSummary, preflight.estimatedCost, preflight.expectedBranches]);
  const selectedAgentIsPersistent = !!(selectedAgent && !selectedAgent.isEphemeral && !selectedAgent.isSyntheticCommander);

  useEffect(() => {
    if (!isOpen) return;
    setForm(initialFormState(agents));
    setAgentTouched(false);
    setOutputTouched(false);
    setModeTouched(false);
    setError('');
    setPreview(null);
    setPreviewOpen(false);
    setShowSavePreset(false);
    setPresetName('');
  }, [isOpen, agents]);

  useEffect(() => {
    if (!isOpen) return;
    const timeout = setTimeout(() => textareaRef.current?.focus(), 60);
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        handleLaunch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (agentTouched) return;
    const inferred = doctrineDefaults.agent || inferBestAgent(form.intent, agents);
    if (inferred?.id && inferred.id !== form.agentId) {
      setForm(prev => ({ ...prev, agentId: inferred.id }));
    }
  }, [form.intent, agents, form.agentId, agentTouched, doctrineDefaults.agent]);

  useEffect(() => {
    if (outputTouched || !doctrineDefaults.outputType) return;
    if (doctrineDefaults.outputType !== form.outputType) {
      setForm(prev => ({ ...prev, outputType: doctrineDefaults.outputType }));
    }
  }, [doctrineDefaults.outputType, form.outputType, outputTouched]);

  useEffect(() => {
    if (modeTouched || !doctrineDefaults.mode) return;
    if (doctrineDefaults.mode !== form.mode) {
      setForm(prev => ({ ...prev, mode: doctrineDefaults.mode }));
    }
  }, [doctrineDefaults.mode, form.mode, modeTouched]);

  useEffect(() => {
    if (!availableTargetOptions.some((option) => option.value === form.targetType)) {
      setForm((prev) => ({ ...prev, targetType: 'internal', targetIdentifier: '' }));
    }
  }, [availableTargetOptions, form.targetType]);

  useEffect(() => {
    saveSessionDefaults({
      agentId: form.agentId,
      mode: form.mode,
      missionMode: form.missionMode,
      when: form.when,
      priority: form.priority,
      outputType: form.outputType,
      outputSpec: form.outputSpec,
      targetType: form.targetType,
      targetIdentifier: form.targetIdentifier,
      runAt: form.runAt,
      repeatFrequency: form.repeatFrequency,
      repeatTime: form.repeatTime,
      repeatEndDate: form.repeatEndDate,
    });
  }, [form]);

  function updateField(field, value) {
    if (field === 'agentId') setAgentTouched(true);
    if (field === 'outputType') setOutputTouched(true);
    if (field === 'mode') setModeTouched(true);
    setForm(prev => ({ ...prev, [field]: value }));
    setError('');
  }

  function applyPreset(preset) {
    const inferred = inferBestAgent(preset.intent, agents);
    setForm(prev => ({
      ...prev,
      intent: preset.intent,
      agentId: preset.defaults.agentId || inferred?.id || prev.agentId,
      mode: preset.defaults.mode || prev.mode,
      missionMode: preset.defaults.missionMode || prev.missionMode,
      when: preset.defaults.when || prev.when,
      priority: preset.defaults.priority || prev.priority,
      outputType: preset.defaults.outputType || prev.outputType,
      outputSpec: preset.defaults.outputSpec || '',
      targetType: preset.defaults.targetType || prev.targetType,
      targetIdentifier: preset.defaults.targetIdentifier || '',
      runAt: preset.defaults.runAt || deriveTodayRunAt(),
      repeatFrequency: preset.defaults.repeatFrequency || 'daily',
      repeatTime: preset.defaults.repeatTime || '09:00',
      repeatEndDate: preset.defaults.repeatEndDate || '',
    }));
    setAgentTouched(true);
    setOutputTouched(true);
    setModeTouched(true);
  }

  function buildPayload() {
    const launchAgentId = selectedAgent?.isSyntheticCommander ? '' : (form.agentId || selectedAgent?.id || '');

    return {
      intent: form.intent.trim(),
      agentId: launchAgentId,
      mode: form.mode,
      missionMode: form.missionMode,
      when: form.when,
      priority: form.priority,
      outputType: form.outputType,
      outputSpec: form.outputType === 'custom' ? form.outputSpec.trim() : '',
      targetType: form.targetType,
      targetIdentifier: form.targetIdentifier.trim(),
      runAt: form.when === 'pick' ? form.runAt : form.when === 'later_today' ? deriveTodayRunAt() : null,
      repeat: form.when === 'repeat' ? {
        frequency: form.repeatFrequency,
        time: form.repeatTime,
        endDate: form.repeatEndDate || null,
      } : null,
      agentName: selectedAgent?.name || '',
      agentModel: selectedAgent?.model || '',
      agentExecutionMode: inferAgentModeBadge(selectedAgent),
      planSteps: Array.isArray(preview?.steps) ? preview.steps : [],
      planBranches: Array.isArray(preview?.branches) ? preview.branches : [],
    };
  }

  async function handlePreview() {
    if (!form.intent.trim()) {
      setError('Add a mission intent first.');
      return;
    }
    setPreviewLoading(true);
    setError('');
    try {
      const plan = await onPreview(buildPayload());
      setPreview(plan);
      setPreviewOpen(true);
    } catch (err) {
      setError(err.message || 'Could not preview mission plan.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleLaunch() {
    if (!form.intent.trim()) {
      setError('Mission intent is required.');
      return;
    }
    setLaunching(true);
    setError('');
    try {
      await onLaunch(buildPayload());
      onClose();
    } catch (err) {
      setError(err.message || 'Could not launch mission.');
    } finally {
      setLaunching(false);
    }
  }

  function handleSavePreset() {
    const name = presetName.trim();
    if (!name) return;
    const preset = {
      id: `custom-${Date.now()}`,
      label: name,
      intent: form.intent.trim() || 'New mission preset',
      defaults: {
        agentId: form.agentId,
        mode: form.mode,
        missionMode: form.missionMode,
        when: form.when,
        priority: form.priority,
        outputType: form.outputType,
        outputSpec: form.outputSpec,
        targetType: form.targetType,
        targetIdentifier: form.targetIdentifier,
        runAt: form.runAt,
        repeatFrequency: form.repeatFrequency,
        repeatTime: form.repeatTime,
        repeatEndDate: form.repeatEndDate,
      },
    };
    savePresetToSession(preset);
    setSavedPresets(loadSavedPresets());
    setShowSavePreset(false);
    setPresetName('');
  }

  const allPresets = [...COMMANDER_PRESETS, ...savedPresets];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className="fixed top-0 right-0 bottom-0 w-[520px] max-w-[92vw] bg-[linear-gradient(180deg,rgba(7,12,18,0.98),rgba(8,10,14,0.98))] border-l border-aurora-teal/15 z-50 flex flex-col shadow-[-16px_0_48px_rgba(0,0,0,0.55)]"
            aria-label="Tell Commander what you want"
          >
            <div className="relative flex items-start justify-between px-6 py-5 border-b border-white/[0.08] shrink-0 bg-black/20 backdrop-blur overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,217,200,0.14),transparent_38%),linear-gradient(180deg,rgba(96,165,250,0.06),transparent_60%)] pointer-events-none" />
              <div>
                <div className="flex items-center gap-2 text-aurora-teal mb-2">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em]">Commander Intake</span>
                </div>
                <h2 className="text-xl font-semibold text-text-primary">Tell Commander what you want</h2>
                <p className="text-[12px] text-text-muted mt-1">Describe the outcome naturally. Commander will translate it into a mission, route the lanes, and stage the right posture.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <div className="px-3 py-2 rounded-2xl border border-white/[0.08] bg-black/20">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Primary Lane</div>
                    <div className="text-[12px] font-semibold text-text-primary mt-1">{selectedAgent?.name || 'Auto-selecting'}</div>
                  </div>
                  <div className="px-3 py-2 rounded-2xl border border-white/[0.08] bg-black/20">
                    <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Mission Posture</div>
                    <div className="text-[12px] font-semibold text-text-primary mt-1">{MISSION_MODE_OPTIONS.find((option) => option.value === form.missionMode)?.label || 'Do now'}</div>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.05] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 py-5 space-y-6">
              <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-4 py-4">
                <SectionLabel>Tell Commander what you want</SectionLabel>
                <textarea
                  ref={textareaRef}
                  value={form.intent}
                  onChange={(event) => updateField('intent', event.target.value)}
                  rows={6}
                  placeholder={'Research 10 new 3PL prospects and draft intro emails.\n\nSummarize today’s calls and post notes to Pipedrive.\n\nCheck tracking on all shipments delayed more than 2 days and alert customers.'}
                  className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/40 resize-none leading-relaxed"
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-text-disabled">Cmd+Enter to launch or stage the mission</span>
                  <span className="text-[10px] font-mono text-text-disabled">{form.intent.length} chars</span>
                </div>

                <div className="mt-4 rounded-[20px] border border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(0,217,200,0.06),rgba(96,165,250,0.05))] px-4 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-teal font-semibold">JARVIS Readback</div>
                      <div className="text-sm font-semibold text-text-primary mt-1">{missionSummary.objective}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Clarity</div>
                      <div className="text-lg font-mono font-bold text-aurora-teal">{missionSummary.confidence}%</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Inferred result</div>
                      <div className="text-[12px] font-semibold text-text-primary mt-1">{missionSummary.inferredOutput}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Execution path</div>
                      <div className="text-[12px] font-semibold text-text-primary mt-1">{selectedAgent?.name || 'Auto-selecting'} • {selectedAgentIsPersistent ? 'Persistent lane' : inferAgentModeBadge(selectedAgent)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3 col-span-2">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Commander posture</div>
                      <div className="text-[12px] font-semibold text-text-primary mt-1">{MISSION_MODE_OPTIONS.find((option) => option.value === form.missionMode)?.label || 'Do now'}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">{missionModeRationale}</div>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {missionSummary.cues.map(cue => (
                      <span key={cue} className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/[0.08] bg-white/[0.03] text-text-body">
                        {cue}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-aurora-blue/15 bg-[linear-gradient(135deg,rgba(96,165,250,0.08),rgba(167,139,250,0.05))] px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-blue font-semibold">Mission Preflight</div>
                      <div className="mt-1 text-sm font-semibold text-text-primary">Commander briefing before launch</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-text-body">
                        Expected branches, loaded context, launch cost, approval posture, and the main uncertainty rail before you commit.
                      </div>
                    </div>
                    <div className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue">
                      {preview ? 'verified preview' : 'estimated preflight'}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Expected branches</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflight.expectedBranches}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Likely cost</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflight.estimatedCost}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Approval posture</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{formatApprovalLabel(preflight.approvalPosture)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Expected duration</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflight.expectedDuration}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-aurora-teal" />
                        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Context loaded</div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {preflight.contextPacks.map((pack) => (
                          <span key={pack} className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-1 text-[10px] font-semibold text-aurora-teal">
                            {pack}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {preflight.requiredCapabilities.length > 0 ? preflight.requiredCapabilities.map((capability) => (
                          <span key={capability} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-text-body">
                            {capability}
                          </span>
                        )) : (
                          <span className="text-[11px] text-text-muted">No extra capability pressure inferred yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                      <div className="flex items-center gap-2">
                        <CircleAlert className="h-4 w-4 text-aurora-amber" />
                        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Confidence + uncertainty rail</div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {preflight.uncertainty.length === 0 && (
                          <div className="rounded-2xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] text-text-body">
                            Commander has enough clarity to route this mission without a major uncertainty warning.
                          </div>
                        )}
                        {preflight.uncertainty.map((entry) => (
                          <div key={entry} className="rounded-2xl border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-2 text-[11px] text-text-body">
                            {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Preflight alignment</div>
                        <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflightAlignment.label}</div>
                      </div>
                      <div className={cn(
                        'rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                        preflightAlignment.posture === 'aligned'
                          ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                          : preflightAlignment.posture === 'close'
                            ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                            : 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                      )}>
                        {preflightAlignment.sampleCount > 0 ? `${preflightAlignment.sampleCount} matching runs` : 'forming'}
                      </div>
                    </div>
                    <div className="mb-3 text-[11px] leading-relaxed text-text-body">{preflightAlignment.detail}</div>
                    {preflightAlignment.sampleCount > 0 && (
                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                          <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Branch delta</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflightAlignment.branchDelta > 0 ? '+' : ''}{preflightAlignment.branchDelta}</div>
                        </div>
                        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                          <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Cost delta</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{preflightAlignment.costDelta > 0 ? '+' : ''}${Math.abs(preflightAlignment.costDelta).toFixed(2)}</div>
                        </div>
                      </div>
                    )}
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Top risks before launch</div>
                    <div className="mt-2 space-y-2">
                      {preflight.topRisks.length === 0 && (
                        <div className="rounded-2xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] text-text-body">
                          No major launch blocker is inferred right now. This looks safe enough to route with the current posture.
                        </div>
                      )}
                      {preflight.topRisks.map((risk) => (
                        <div key={risk} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[11px] text-text-body">
                          {risk}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-[20px] border border-white/[0.08] bg-black/20 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-aurora-violet font-semibold">Doctrine Suggests</div>
                      <div className="mt-1 text-sm font-semibold text-text-primary">Use the learned branch unless you want to override it.</div>
                    </div>
                    <div className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet">
                      learned defaults
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Agent</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{doctrineDefaults.agent?.name || selectedAgent?.name || 'Auto-selecting'}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Output</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{doctrineDefaults.outputType.replaceAll('_', ' ')}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Mode</div>
                      <div className="mt-1 text-[12px] font-semibold text-text-primary">{doctrineDefaults.mode}</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {doctrineDefaults.notes.map((note) => (
                      <div key={note} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-text-body">
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Mission details</h3>
                    <p className="text-[11px] text-text-muted mt-1">Smart defaults you can tune when you care.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <SectionLabel>Mission mode</SectionLabel>
                    <div className="grid gap-2">
                      {MISSION_MODE_OPTIONS.map((option) => {
                        const selected = form.missionMode === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => updateField('missionMode', option.value)}
                            className={cn(
                              'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                              selected
                                ? 'border-aurora-teal/30 bg-aurora-teal/8'
                                : 'border-border bg-surface hover:bg-surface-raised'
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="text-[12px] font-semibold text-text-primary">{option.label}</div>
                                <div className="mt-1 text-[11px] leading-relaxed text-text-muted">{option.hint}</div>
                              </div>
                              {selected && <div className="w-2 h-2 rounded-full bg-aurora-teal shrink-0" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Agent</SectionLabel>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/20 overflow-hidden">
                      {agents.map(agent => {
                        const selected = agent.id === form.agentId;
                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => {
                              setAgentTouched(true);
                              updateField('agentId', agent.id);
                            }}
                            className={cn(
                              'w-full px-4 py-3 flex items-center justify-between border-b border-border last:border-b-0 transition-colors text-left',
                              selected ? 'bg-aurora-teal/8' : 'hover:bg-white/[0.03]'
                            )}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-text-primary">{agent.name}</span>
                                <span className={cn(
                                  'px-2 py-0.5 rounded-full text-[9px] font-bold',
                                  selected ? 'bg-aurora-teal/15 text-aurora-teal' : 'bg-white/[0.04] text-text-muted'
                                )}>
                                  {!agent.isEphemeral && !agent.isSyntheticCommander ? 'PERSIST' : inferAgentModeBadge(agent)}
                                </span>
                              </div>
                              <p className="text-[11px] text-text-muted mt-1">{agent.model} • {agent.role}</p>
                            </div>
                            {selected && <div className="w-2 h-2 rounded-full bg-aurora-teal shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <SectionLabel>Speed vs cost</SectionLabel>
                    <SegmentedControl options={MODE_OPTIONS} value={form.mode} onChange={(value) => updateField('mode', value)} />
                  </div>

                  <div>
                    <SectionLabel>When should this run?</SectionLabel>
                    <SegmentedControl options={WHEN_OPTIONS} value={form.when} onChange={(value) => updateField('when', value)} />

                    {form.when === 'pick' && (
                      <input
                        type="datetime-local"
                        value={form.runAt}
                        onChange={(event) => updateField('runAt', event.target.value)}
                        className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                      />
                    )}

                    {form.when === 'repeat' && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <SectionLabel>Frequency</SectionLabel>
                          <select
                            value={form.repeatFrequency}
                            onChange={(event) => updateField('repeatFrequency', event.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                          >
                            {FREQUENCY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <SectionLabel>Start time</SectionLabel>
                          <input
                            type="time"
                            value={form.repeatTime}
                            onChange={(event) => updateField('repeatTime', event.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                          />
                        </div>
                        <div className="col-span-2">
                          <SectionLabel>End date (optional)</SectionLabel>
                          <input
                            type="date"
                            value={form.repeatEndDate}
                            onChange={(event) => updateField('repeatEndDate', event.target.value)}
                            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel>Priority</SectionLabel>
                    <div className="space-y-2">
                      {PRIORITY_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => updateField('priority', option.value)}
                          className={cn(
                            'w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors',
                            form.priority === option.value
                              ? 'border-aurora-teal/30 bg-aurora-teal/8 text-text-primary'
                              : 'border-border bg-surface text-text-muted hover:bg-surface-raised'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <SectionLabel>What should the result be?</SectionLabel>
                    <select
                      value={form.outputType}
                      onChange={(event) => updateField('outputType', event.target.value)}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                    >
                      {OUTPUT_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    {form.outputType === 'custom' && (
                      <input
                        value={form.outputSpec}
                        onChange={(event) => updateField('outputSpec', event.target.value)}
                        placeholder="Describe the final artifact you want."
                        className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/40"
                      />
                    )}
                  </div>

                  <div>
                    <SectionLabel>Where should this live?</SectionLabel>
                    <select
                      value={form.targetType}
                      onChange={(event) => updateField('targetType', event.target.value)}
                      className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-aurora-teal/40"
                    >
                      {availableTargetOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    {!pipedriveConnected && (
                      <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                        Pipedrive destinations unlock automatically once the CRM is connected in Systems Control.
                      </div>
                    )}
                    {form.targetType !== 'internal' && (
                      <input
                        value={form.targetIdentifier}
                        onChange={(event) => updateField('targetIdentifier', event.target.value)}
                        placeholder="Enter a deal, person, or CRM identifier"
                        className="mt-3 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/40"
                      />
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(96,165,250,0.05),rgba(255,255,255,0.02))] px-4 py-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Commander templates</h3>
                    <p className="text-[11px] text-text-muted mt-1">One-click starting points for common missions.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSavePreset(prev => !prev)}
                    className="text-[11px] font-semibold text-aurora-teal hover:text-[#00ebd8]"
                  >
                    Save as preset
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {allPresets.map(preset => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-1.5 rounded-full border border-white/[0.08] bg-black/20 text-[11px] font-semibold text-text-body hover:text-text-primary hover:bg-white/[0.04] transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {showSavePreset && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={presetName}
                      onChange={(event) => setPresetName(event.target.value)}
                      placeholder="Name this preset"
                      className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-aurora-teal/40"
                    />
                    <button
                      type="button"
                      onClick={handleSavePreset}
                      disabled={!presetName.trim()}
                      className="px-3 py-2.5 rounded-xl bg-aurora-teal text-black text-[11px] font-bold disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />Save</span>
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-[24px] border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setPreviewOpen(prev => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-text-primary">Mission Plan</h3>
                    <p className="text-[11px] text-text-muted mt-1">Preview steps, run time, and cost before launch.</p>
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-text-muted transition-transform', previewOpen && 'rotate-180')} />
                </button>

                <AnimatePresence initial={false}>
                  {previewOpen && (
                    <Motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div className="p-4">
                        {!preview && !previewLoading && (
                          <p className="text-[12px] text-text-muted">Use Preview plan to generate the wiring for this mission.</p>
                        )}

                        {previewLoading && (
                          <div className="flex items-center gap-2 text-[12px] text-text-muted">
                            <Loader2 className="w-4 h-4 animate-spin text-aurora-teal" />
                            Building mission plan...
                          </div>
                        )}

                        {preview && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-border bg-canvas/50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Estimated run time</p>
                                <p className="text-sm font-semibold text-text-primary mt-1">{preview.estimatedDuration}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-canvas/50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Estimated cost</p>
                                <p className="text-sm font-semibold text-text-primary mt-1">{preview.estimatedCostRange}</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-xl border border-border bg-canvas/50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Launch mode</p>
                                <p className="text-sm font-semibold text-text-primary mt-1">{MISSION_MODE_OPTIONS.find((option) => option.value === form.missionMode)?.label || 'Do now'}</p>
                              </div>
                              <div className="rounded-xl border border-border bg-canvas/50 px-3 py-2.5">
                                <p className="text-[10px] uppercase tracking-[0.15em] text-text-muted">Likely systems</p>
                                <p className="text-sm font-semibold text-text-primary mt-1">{systemsReadback.length ? systemsReadback.map((system) => system.label).join(', ') : 'Internal lane'}</p>
                              </div>
                            </div>
                            <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-3">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Flight Path</div>
                                  <div className="text-[12px] text-text-body mt-1">Projected execution arc from intake through delivery.</div>
                                </div>
                                <div className="text-[11px] font-mono text-aurora-teal">{flightPlan.length || 1} phases</div>
                              </div>
                              <div className="space-y-2">
                                {flightPlan.map((step, index) => (
                                  <div key={`${step.title}-flight-${index}`} className="grid grid-cols-[72px_1fr_52px] gap-3 items-center">
                                    <div className="text-[10px] font-mono uppercase text-text-muted">{step.phase}</div>
                                    <div className="h-10 rounded-2xl border border-white/[0.08] bg-[linear-gradient(90deg,rgba(0,217,200,0.12),rgba(96,165,250,0.06))] overflow-hidden relative">
                                      <div className="absolute inset-y-0 left-0 rounded-2xl bg-[linear-gradient(90deg,rgba(0,217,200,0.3),rgba(96,165,250,0.16))]" style={{ width: `${step.intensity}%` }} />
                                      <div className="relative h-full px-3 flex items-center justify-between text-[11px]">
                                        <span className="text-text-primary font-semibold truncate">{step.title}</span>
                                        <span className="text-text-muted font-mono ml-2 shrink-0">{step.timing}</span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] font-mono text-aurora-teal text-right">{step.progress}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-2">
                              {preview.steps.map((step, index) => (
                                <div key={`${step.title}-${index}`} className="rounded-xl border border-border bg-canvas/30 px-3 py-2.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-aurora-teal/10 text-aurora-teal text-[10px] font-bold flex items-center justify-center">{index + 1}</span>
                                    <span className="text-sm font-semibold text-text-primary">{step.title}</span>
                                  </div>
                                  <p className="text-[12px] text-text-body mt-1 ml-7">{step.description}</p>
                                </div>
                              ))}
                            </div>
                            {branchPreview.length > 0 && (
                              <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Delegation Graph</div>
                                    <div className="mt-1 text-[12px] text-text-body">Branch ownership, dependency order, and execution posture before launch.</div>
                                  </div>
                                  <div className="text-[11px] font-mono text-aurora-violet">{branchPreview.length} branches</div>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {branchPreview.map((branch, index) => (
                                    <div key={branch.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-3">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-aurora-violet/10 text-[10px] font-bold text-aurora-violet">{index + 1}</span>
                                        <span className="text-[12px] font-semibold text-text-primary">{branch.branchLabel || branch.title}</span>
                                        <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5 text-[9px] font-mono uppercase text-text-muted">{branch.roleLabel}</span>
                                        <span className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-aurora-blue">{branch.strategyLabel}</span>
                                      </div>
                                      <div className="mt-2 text-[11px] leading-relaxed text-text-body">{branch.description || branch.title}</div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {branch.dependencies.length === 0 ? (
                                          <span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-teal">
                                            Launch-ready branch
                                          </span>
                                        ) : (
                                          branch.dependencies.map((dependency) => (
                                            <span key={`${branch.id}-${dependency}`} className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-1 text-[10px] font-semibold text-text-muted">
                                              depends on {dependency}
                                            </span>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </Motion.div>
                  )}
                </AnimatePresence>
              </section>

              {selectedAgent && (
                <section className="rounded-[24px] border border-aurora-teal/15 bg-[linear-gradient(135deg,rgba(0,217,200,0.07),rgba(96,165,250,0.04))] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <AlarmClock className="w-4 h-4 text-aurora-teal" />
                    <p className="text-[12px] text-text-body">
                      Launching with <span className="text-text-primary font-semibold">{selectedAgent.name}</span> on the <span className="text-text-primary font-semibold">{selectedAgentIsPersistent ? 'persistent specialist' : inferAgentModeBadge(selectedAgent)}</span> lane.
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Why this agent</div>
                      <div className="text-[12px] text-text-body mt-1">{agentRationale}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Why these defaults</div>
                      <div className="text-[12px] text-text-body mt-1">{modeRationale} {missionModeRationale} {scheduleRationale}</div>
                    </div>
                    <div className="rounded-2xl border border-white/[0.08] bg-black/15 px-3 py-2.5">
                      <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Systems Commander expects to touch</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(systemsReadback.length ? systemsReadback : [{ label: 'Internal lane', connected: true }]).map((system) => (
                          <span
                            key={system.label}
                            className={cn(
                              'px-2 py-1 rounded-full text-[10px] font-semibold border',
                              system.connected
                                ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                                : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                            )}
                          >
                            {system.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {error && (
                <div className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/5 px-3 py-2.5 text-[12px] text-aurora-rose">
                  {error}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/[0.08] px-6 py-4 flex items-center gap-3 bg-black/20 backdrop-blur">
              <button
                type="button"
                onClick={handleLaunch}
                disabled={!form.intent.trim() || launching}
                className="flex-1 h-11 rounded-xl bg-aurora-teal text-black text-sm font-semibold hover:bg-[#00ebd8] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {form.missionMode === 'plan_first'
                  ? 'Create planned mission'
                  : form.missionMode === 'watch_and_approve'
                    ? 'Launch with approval gate'
                    : 'Launch mission'}
              </button>
              <button
                type="button"
                onClick={handlePreview}
                disabled={previewLoading}
                className="h-11 px-4 rounded-xl border border-white/[0.08] bg-black/20 text-sm font-semibold text-text-primary hover:bg-white/[0.04] transition-colors flex items-center gap-2"
              >
                {previewLoading ? <Loader2 className="w-4 h-4 animate-spin text-aurora-teal" /> : <Calendar className="w-4 h-4" />}
                Preview plan
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-[12px] font-semibold text-text-muted hover:text-text-primary px-2"
              >
                Cancel
              </button>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
