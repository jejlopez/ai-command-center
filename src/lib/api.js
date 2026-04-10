/**
 * API abstraction layer.
 *
 * Every function returns a Promise so call sites use async/await.
 * Approval queue functions (fetchPendingReviews, approveReview, rejectReview)
 * read/write from Supabase when configured.
 *
 * Convention:
 *   fetch*  → read (GET)
 *   create* → insert (POST)
 *   update* → patch (PUT)
 *   delete* → remove (DELETE)
 */

import { supabase } from './supabaseClient';
import {
  DEFAULT_MODEL_PROVIDER,
  SYNTHETIC_COMMANDER_ID,
  getCommanderDisplayName,
  getCommanderLane,
  normalizeModelProvider,
} from '../utils/commanderPolicy';
import { WORKFLOW_STATUS, getTaskGraphShape } from '../utils/missionLifecycle';
import {
  buildDefaultRoutingPolicy,
  deriveRoutingDecision,
  mapRoutingPolicyFromDb,
} from '../utils/routingPolicy';

// True when real Supabase env vars are set (not the placeholder)
const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL
  && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

// ── Row mapper: snake_case DB → camelCase UI ────────────────────

function mapReviewRow(row) {
  return {
    id:         row.id,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
    urgency:    row.urgency,
    title:      row.title,
    outputType: row.output_type,
    status:     row.status,
    summary:    row.summary,
    payload:    row.payload,
    createdAt:  row.created_at,
    // Compute waitingMs from waiting_since for the UI's formatWaiting()
    waitingMs:  row.waiting_since
      ? Date.now() - new Date(row.waiting_since).getTime()
      : 0,
    acknowledgedAt: row.acknowledged_at,
    snoozedUntil: row.snoozed_until,
  };
}

// ── Row mappers: agents, tasks, activity_log ────────────────────

function mapAgentRow(row) {
  return {
    id:               row.id,
    name:             row.name,
    model:            row.model,
    roleDescription:  row.role_description || '',
    status:           row.status,
    role:             row.role,
    parentId:         row.parent_id,
    canSpawn:         row.can_spawn,
    spawnPattern:     row.spawn_pattern,
    taskCompletion:   row.task_completion,
    tokenBurn:        row.token_burn || [],
    latencyMs:        row.latency_ms,
    color:            row.color,
    temperature:      parseFloat(row.temperature) || 0.7,
    responseLength:   row.response_length,
    systemPrompt:     row.system_prompt || '',
    skills:           row.skills || [],
    subagents:        row.subagents || [],
    totalTokens:      row.total_tokens || 0,
    totalCost:        parseFloat(row.total_cost) || 0,
    successRate:      row.success_rate || 0,
    taskCount:        row.task_count || 0,
    uptimeMs:         Number(row.uptime_ms) || 0,
    lastHeartbeat:    row.last_heartbeat,
    restartCount:     row.restart_count || 0,
    errorMessage:     row.error_message,
    errorStack:       row.error_stack,
    lastRestart:      row.last_restart,
    tokenHistory24h:  row.token_history_24h || [],
    latencyHistory24h: row.latency_history_24h || [],
    isEphemeral:      row.is_ephemeral ?? false,
  };
}

function buildSyntheticCommander(user) {
  const commanderName = getCommanderDisplayName(user);
  const commanderLane = getCommanderLane();

  return {
    id: SYNTHETIC_COMMANDER_ID,
    name: commanderName,
    model: commanderLane.model,
    status: 'idle',
    role: 'commander',
    parentId: null,
    canSpawn: true,
    spawnPattern: 'fan-out',
    taskCompletion: 0,
    tokenBurn: [],
    latencyMs: 0,
    color: '#00D9C8',
    temperature: 0.4,
    responseLength: 'medium',
    systemPrompt: '',
    skills: [],
    subagents: [],
    totalTokens: 0,
    totalCost: 0,
    successRate: 100,
    taskCount: 0,
    uptimeMs: 0,
    lastHeartbeat: null,
    restartCount: 0,
    errorMessage: null,
    errorStack: null,
    lastRestart: null,
    tokenHistory24h: [],
    latencyHistory24h: [],
    isSyntheticCommander: true,
  };
}

async function ensureModelBankEntry(user, modelKey, provider = DEFAULT_MODEL_PROVIDER) {
  if (!user?.id || !modelKey) return null;

  const row = {
    user_id: user.id,
    model_key: modelKey,
    label: modelKey,
    provider: normalizeModelProvider(provider),
  };

  const { data, error } = await supabase
    .from('model_bank')
    .upsert(row, { onConflict: 'user_id,model_key' })
    .select('*')
    .single();

  if (error) {
    console.error('[api] ensureModelBankEntry:', error.message);
    return null;
  }

  return data;
}

async function ensureCommanderAgentRow() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return null;

  const user = authData.user;
  const commanderName = getCommanderDisplayName(user);
  const commanderLane = getCommanderLane();

  const { data: existingCommander, error: existingError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'commander')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!existingError && existingCommander) {
    return existingCommander;
  }

  await ensureModelBankEntry(user, commanderLane.model, commanderLane.provider);

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: commanderName,
    model: commanderLane.model,
    status: 'idle',
    role: 'commander',
    color: '#00D9C8',
    can_spawn: true,
    spawn_pattern: 'fan-out',
  };

  const { data, error } = await supabase
    .from('agents')
    .insert([row])
    .select('*')
    .single();

  if (error) {
    console.error('[api] ensureCommanderAgentRow:', error.message);
    return null;
  }

  return data;
}

function mapTaskRow(row) {
  const taskGraph = getTaskGraphShape(row);
  return {
    id:         row.id,
    name:       row.name || row.title,
    title:      row.title || row.name,
    description: row.description || row.prompt_text || '',
    status:     row.status,
    workflowStatus: taskGraph.workflowStatus,
    nodeType: taskGraph.nodeType,
    rootMissionId: taskGraph.rootMissionId,
    parentId:   row.parent_id,
    dependsOn: taskGraph.dependsOn,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
    mode:       row.mode || 'balanced',
    lane:       row.lane || 'active',
    priority:   row.priority ?? 5,
    scheduleType: row.schedule_type || 'once',
    runAt:      row.run_at,
    recurrenceRule: row.recurrence_rule,
    outputType: row.output_type || 'summary',
    outputSpec: row.output_spec || '',
    targetType: row.target_type || 'internal',
    targetIdentifier: row.target_identifier || '',
    createdByCommanderId: row.created_by_commander_id,
    routingPolicyId: row.routing_policy_id || null,
    routingReason: row.routing_reason || '',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    budgetClass: row.budget_class || 'balanced',
    riskLevel: row.risk_level || 'medium',
    contextPackIds: Array.isArray(row.context_pack_ids) ? row.context_pack_ids : [],
    requiredCapabilities: Array.isArray(row.required_capabilities) ? row.required_capabilities : [],
    approvalLevel: row.approval_level || 'risk_weighted',
    agentRole: row.agent_role || 'executor',
    executionStrategy: row.execution_strategy || 'sequential',
    branchLabel: row.branch_label || '',
    providerOverride: row.provider_override || null,
    modelOverride: row.model_override || null,
    lastRunAt:  row.last_run_at,
    nextRunAt:  row.next_run_at,
    estimatedCostCents: row.estimated_cost_cents,
    actualCostCents: row.actual_cost_cents,
    progressPercent: row.progress_percent ?? 0,
    requiresApproval: !!row.requires_approval,
    startedAt:  row.started_at,
    cancelledAt: row.cancelled_at,
    failedAt:   row.failed_at,
    createdAt:  row.created_at,
    updatedAt:  row.updated_at,
    durationMs: row.duration_ms || 0,
    costUsd:    parseFloat(row.cost_usd) || 0,
    resultText: row.result_text || '',
  };
}

function mapLogRow(row) {
  return {
    id:          row.id,
    timestamp:   row.timestamp,
    type:        row.type,
    message:     row.message,
    agentId:     row.agent_id,
    parentLogId: row.parent_log_id,
    tokens:      row.tokens || 0,
    durationMs:  row.duration_ms || 0,
  };
}

// ── Agents ──────────────────────────────────────────────────────

export async function fetchAgents() {
  if (!isSupabaseConfigured) return [];

  let { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchAgents:', error.message);
    return [];
  }

  const rows = data || [];
  const hasCommander = rows.some((agent) => agent.role === 'commander');
  if (!hasCommander) {
    await ensureCommanderAgentRow();
    ({ data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: true }));

    if (error) {
      console.error('[api] fetchAgents reload:', error.message);
      const user = (await supabase.auth.getUser()).data?.user;
      return [buildSyntheticCommander(user), ...rows.map(mapAgentRow)];
    }
  }

  const authUser = (await supabase.auth.getUser()).data?.user;
  const mappedAgents = (data || []).map(mapAgentRow);
  return mappedAgents.some((agent) => agent.role === 'commander')
    ? mappedAgents
    : [buildSyntheticCommander(authUser), ...mappedAgents];
}

export async function fetchAgentById(id) {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[api] fetchAgentById:', error.message);
    return null;
  }
  return data ? mapAgentRow(data) : null;
}

// ── Tasks ───────────────────────────────────────────────────────

export async function fetchTasks() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchTasks:', error.message);
    return [];
  }
  return data.map(mapTaskRow);
}

function deriveMissionTitle(intent) {
  const normalized = String(intent || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Untitled Mission';
  if (normalized.length <= 60) return normalized;
  return `${normalized.slice(0, 57).trimEnd()}...`;
}

function inferLane(priority, requiresApproval = false, status = 'queued') {
  if (status === 'needs_approval' || requiresApproval) return 'approvals';
  if (status === 'done' || status === 'completed') return 'completed';
  if (['failed', 'error', 'blocked', 'cancelled'].includes(status)) return 'blocked';
  if (priority >= 8) return 'critical';
  return 'active';
}

function buildRecurrenceRule(repeat) {
  if (!repeat) return null;
  return {
    frequency: repeat.frequency,
    time: repeat.time,
    endDate: repeat.endDate || null,
  };
}

function getMissionExecutionPosture(payload) {
  const missionMode = payload.missionMode || 'do_now';
  return {
    missionMode,
    shouldPlanOnly: missionMode === 'plan_first',
    shouldWatchAndApprove: missionMode === 'watch_and_approve',
    shouldAutoDispatch: payload.when === 'now' && missionMode === 'do_now',
  };
}

function estimateMissionPlan(payload) {
  const lower = payload.intent.toLowerCase();
  const steps = [];

  if (/(research|prospect|find|analyze)/.test(lower)) {
    steps.push({ title: 'Gather targets', description: 'Search the requested sources and assemble the candidate set for review.' });
  }
  if (/(email|draft|outreach)/.test(lower)) {
    steps.push({ title: 'Draft outreach', description: 'Generate outbound messaging tailored to the selected contacts or accounts.' });
  }
  if (/(summary|summarize|notes|call|crm|pipedrive)/.test(lower)) {
    steps.push({ title: 'Summarize activity', description: 'Condense the raw inputs into clean notes, actions, and structured takeaways.' });
  }
  if (/(tracking|shipment|delay|ops|alert)/.test(lower)) {
    steps.push({ title: 'Check live operations', description: 'Pull current shipment or operations status and identify exceptions that need action.' });
  }
  if (!steps.length) {
    steps.push({ title: 'Parse mission intent', description: 'Break the request into an executable workflow with the selected agent.' });
    steps.push({ title: 'Execute workflow', description: 'Run the mission against the chosen systems and gather the requested output.' });
  }

  const complexity = Math.min(4, Math.max(1, Math.ceil(payload.intent.length / 80) + (payload.when === 'repeat' ? 1 : 0)));
  const durationBase = payload.mode === 'fast' ? 4 : payload.mode === 'efficient' ? 8 : 6;
  const duration = `${durationBase * complexity}-${durationBase * complexity + 6} min`;
  const centsBase = payload.mode === 'fast' ? 45 : payload.mode === 'efficient' ? 16 : 28;
  const costRange = `$${(centsBase * complexity / 100).toFixed(2)}-$${((centsBase * complexity + 35) / 100).toFixed(2)}`;

  return {
    steps,
    branches: steps.map((step, index) => ({
      title: step.title,
      description: step.description,
      agentRole: index === 0 ? 'planner' : index === steps.length - 1 ? 'verifier' : 'executor',
      executionStrategy: index === 0 ? 'sequential' : 'parallel',
      branchLabel: index === 0 ? 'Command' : `Branch ${index}`,
      dependsOn: index === 0 ? [] : [steps[0].title],
    })),
    estimatedDuration: duration,
    estimatedCostRange: costRange,
    estimatedCostCents: centsBase * complexity,
  };
}

async function ensureBranchSpecialistAgent({
  user,
  branchRole,
  modelOverride,
  providerOverride,
  commander,
  selectedAgent,
  objective,
}) {
  const chosenModel = modelOverride || selectedAgent?.model || commander?.model || getCommanderLane().model;
  const chosenProvider = providerOverride || normalizeModelProvider(selectedAgent?.provider || getCommanderLane().provider);

  await ensureModelBankEntry(user, chosenModel, chosenProvider);

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `${branchRole}-${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    model: chosenModel,
    status: 'idle',
    role: branchRole,
    role_description: `Ephemeral ${branchRole} specialist for mission branch execution.`,
    parent_id: commander?.isSyntheticCommander ? null : commander?.id || null,
    can_spawn: false,
    spawn_pattern: 'sequential',
    is_ephemeral: true,
    system_prompt: `You are a temporary ${branchRole} specialist. Objective: ${objective}`,
    response_length: selectedAgent?.responseLength || commander?.responseLength || 'medium',
    temperature: selectedAgent?.temperature ?? commander?.temperature ?? 0.4,
    color: '#6b7280',
  };

  const { data, error } = await supabase.from('agents').insert([row]).select('*').single();
  if (error) throw error;
  await logBranchEvent({
    userId: user.id,
    agentId: data.id,
    message: `[specialist-spawned] ${data.name} (${branchRole}) materialized for "${objective}" on ${chosenModel}.`,
  });
  return mapAgentRow(data);
}

async function buildMissionSubtasks({
  missionId,
  userId,
  user,
  title,
  payload,
  branches,
  assignedAgentId,
  agentName,
  commanderId,
  estimatedCostCents,
  routingPolicyId,
  routingDecision,
  runAt,
  scheduleType,
}) {
  if (!Array.isArray(branches) || branches.length <= 1) return [];

  const branchIdByTitle = new Map();
  const rows = [];

  for (const [index, branch] of branches.entries()) {
    const stepId = crypto.randomUUID();
    const first = index === 0;
    const branchCanRunImmediately = first || branch.executionStrategy === 'parallel';
    const executionPosture = getMissionExecutionPosture(payload);
    const branchRequiresApproval = executionPosture.shouldWatchAndApprove && branchCanRunImmediately;
    const branchShouldStayPlanned = executionPosture.shouldPlanOnly || (!branchCanRunImmediately && !branchRequiresApproval);
    branchIdByTitle.set(branch.title, stepId);
    const dependencies = Array.isArray(branch.dependsOn)
      ? branch.dependsOn.map((dependencyTitle) => branchIdByTitle.get(dependencyTitle)).filter(Boolean)
      : [];
    const assignment = await resolveBranchAssignment({
      branch,
      user,
      agents: payload.agents || [],
      routingPolicy: payload.routingPolicy || null,
      selectedAgent: payload.selectedAgent || null,
      commander: payload.commander || null,
    });

    rows.push({
      id: stepId,
      user_id: userId,
      title: `${title} · ${branch.title}`,
      name: branch.title,
      description: branch.description || branch.title,
      status: branchRequiresApproval ? 'needs_approval' : branchShouldStayPlanned ? 'pending' : 'queued',
      lane: branchRequiresApproval ? 'approvals' : branchCanRunImmediately && !branchShouldStayPlanned ? 'active' : 'blocked',
      priority: Math.max(1, (payload.priorityScore ?? 5) - (first ? 0 : 1)),
      schedule_type: scheduleType,
      run_at: runAt,
      recurrence_rule: buildRecurrenceRule(payload.repeat),
      agent_id: assignment.assignedAgentId || assignedAgentId,
      agent_name: assignment.agentName || agentName,
      mode: payload.mode,
      output_type: payload.outputType,
      output_spec: payload.outputSpec || null,
      target_type: payload.targetType,
      target_identifier: payload.targetIdentifier || null,
      created_by_commander_id: commanderId,
      estimated_cost_cents: Math.max(1, Math.round((estimatedCostCents || 0) / branches.length)),
      actual_cost_cents: 0,
      progress_percent: branchRequiresApproval || branchShouldStayPlanned ? 0 : 5,
      duration_ms: 0,
      cost_usd: 0,
      node_type: 'subtask',
      workflow_status: branchRequiresApproval
        ? WORKFLOW_STATUS.WAITING_ON_HUMAN
        : branchCanRunImmediately && !branchShouldStayPlanned
          ? WORKFLOW_STATUS.READY
          : WORKFLOW_STATUS.PLANNED,
      root_mission_id: missionId,
      parent_id: missionId,
      routing_policy_id: routingPolicyId || null,
      routing_reason: `${routingDecision.routingReason} | ${assignment.agentRole || branch.agentRole || 'executor'} branch ${index + 1}/${branches.length}`,
      domain: routingDecision.domain,
      intent_type: routingDecision.intentType,
      budget_class: routingDecision.budgetClass,
      risk_level: routingDecision.riskLevel,
      context_pack_ids: [],
      required_capabilities: routingDecision.requiredCapabilities,
      approval_level: routingDecision.approvalLevel,
      depends_on: dependencies,
      agent_role: assignment.agentRole || branch.agentRole || 'executor',
      execution_strategy: branch.executionStrategy || 'sequential',
      branch_label: branch.branchLabel || branch.title,
      provider_override: assignment.providerOverride || null,
      model_override: assignment.modelOverride || null,
      requires_approval: branchRequiresApproval,
    });
  }

  return rows;
}

async function resolveBranchAssignment({
  branch,
  user,
  agents,
  routingPolicy,
  selectedAgent,
  commander,
}) {
  const liveAgents = agents.filter((agent) => !agent.isSyntheticCommander);
  const branchRole = branch.agentRole || routingPolicy?.preferredAgentRole || selectedAgent?.role || 'executor';
  const fallbackOrder = Array.isArray(routingPolicy?.fallbackOrder) ? routingPolicy.fallbackOrder : [];
  const roleFallback = fallbackOrder.find((entry) => entry.role === branchRole) || null;
  const modelOverride = branch.modelOverride || roleFallback?.model || routingPolicy?.preferredModel || null;
  const providerOverride = branch.providerOverride || roleFallback?.provider || routingPolicy?.preferredProvider || null;

  const exactRoleMatches = liveAgents
    .filter((agent) => agent.role === branchRole)
    .sort((left, right) => {
      const leftPersistent = Number(!left.isEphemeral);
      const rightPersistent = Number(!right.isEphemeral);
      return rightPersistent - leftPersistent;
    });
  const roleCandidates = exactRoleMatches.length
    ? exactRoleMatches
    : branchRole === 'executor'
      ? liveAgents.filter((agent) => agent.id === selectedAgent?.id || agent.role === 'researcher' || agent.role === 'commander')
      : liveAgents;

  const modelMatch = modelOverride
    ? roleCandidates.find((agent) => agent.model === modelOverride)
    : null;

  let assignedAgent = modelMatch || roleCandidates[0] || null;

  if (!assignedAgent && !['executor', 'commander'].includes(branchRole)) {
    assignedAgent = await ensureBranchSpecialistAgent({
      user,
      branchRole,
      modelOverride,
      providerOverride,
      commander,
      selectedAgent,
      objective: branch.title || branch.description || `${branchRole} branch`,
    }).catch((error) => {
      console.error('[api] ensureBranchSpecialistAgent:', error.message);
      return null;
    });
  }

  assignedAgent = assignedAgent || selectedAgent || commander || null;

  return {
    agentRole: branchRole,
    assignedAgentId: assignedAgent?.isSyntheticCommander ? null : assignedAgent?.id || null,
    agentName: assignedAgent?.name || selectedAgent?.name || commander?.name || 'Unknown',
    providerOverride,
    modelOverride,
  };
}

export async function previewMissionPlan(payload) {
  if (!isSupabaseConfigured) return estimateMissionPlan(payload);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/preview-mission-plan`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          intent: payload.intent,
          mode: payload.mode,
          outputType: payload.outputType,
          targetType: payload.targetType,
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    return {
      steps: Array.isArray(data.steps) ? data.steps : estimateMissionPlan(payload).steps,
      branches: Array.isArray(data.branches) ? data.branches : estimateMissionPlan(payload).branches,
      estimatedDuration: data.estimatedDuration || estimateMissionPlan(payload).estimatedDuration,
      estimatedCostRange: data.estimatedCostRange || estimateMissionPlan(payload).estimatedCostRange,
      estimatedCostCents: data.estimatedCostCents ?? estimateMissionPlan(payload).estimatedCostCents,
      source: data.source || 'planner_endpoint',
    };
  } catch {
    return estimateMissionPlan(payload);
  }
}

async function dispatchMissionNow({ taskId, agentId, taskDescription }) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-task`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        task_id: taskId,
        agent_id: agentId,
        task_description: taskDescription,
      }),
    }
  );

  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.error || `HTTP ${res.status}`);
  }

  return result;
}

async function touchAgentHeartbeat(agentId, status) {
  if (!agentId) return;

  const payload = {
    last_heartbeat: new Date().toISOString(),
  };

  if (status) payload.status = status;

  const { error } = await supabase
    .from('agents')
    .update(payload)
    .eq('id', agentId);

  if (error) {
    console.error('[api] touchAgentHeartbeat:', error.message);
  }
}

async function logBranchEvent({ userId, agentId = null, type = 'SYS', message }) {
  if (!userId || !message) return;

  const { error } = await supabase.from('activity_log').insert({
    user_id: userId,
    type,
    message,
    agent_id: agentId,
    duration_ms: 0,
    tokens: 0,
  });

  if (error) {
    console.error('[api] logBranchEvent:', error.message);
  }
}

async function ensureDefaultRoutingPolicyRow(user) {
  if (!user?.id) return null;

  const { data: existing, error: existingError } = await supabase
    .from('routing_policies')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const row = buildDefaultRoutingPolicy(user.id);
  const { data, error } = await supabase
    .from('routing_policies')
    .insert(row)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function selectRoutingPolicyRow(user, routingDecision) {
  if (!user?.id) return null;

  const { data, error } = await supabase
    .from('routing_policies')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const policies = (data || []).map(mapRoutingPolicyFromDb);
  if (!policies.length) return ensureDefaultRoutingPolicyRow(user);

  return (
    policies.find((policy) => policy.taskDomain === routingDecision.domain && policy.intentType === routingDecision.intentType)
    || policies.find((policy) => policy.taskDomain === routingDecision.domain && policy.intentType === 'general')
    || policies.find((policy) => policy.isDefault)
    || policies[0]
  );
}

export async function createMission(payload, agents = []) {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      mission: {
        id: crypto.randomUUID(),
        title: deriveMissionTitle(payload.intent),
        name: deriveMissionTitle(payload.intent),
        description: payload.intent,
        agentId: payload.agentId,
        agentName: payload.agentName || '',
        status: 'queued',
        lane: inferLane(payload.priorityScore || 5, false, 'queued'),
        mode: payload.mode,
        progressPercent: 0,
        createdAt: new Date().toISOString(),
      },
    };
  }

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const title = deriveMissionTitle(payload.intent);
  const requestedSyntheticCommander = !payload.agentId || payload.agentId === SYNTHETIC_COMMANDER_ID;
  let selectedAgent = agents.find(agent => agent.id === payload.agentId) || null;
  let commander = agents.find(agent => agent.role === 'commander' && !agent.isSyntheticCommander) || null;

  if (requestedSyntheticCommander) {
    const persistedCommanderRow = await ensureCommanderAgentRow();
    if (persistedCommanderRow) {
      selectedAgent = mapAgentRow(persistedCommanderRow);
      commander = selectedAgent;
    } else {
      selectedAgent = selectedAgent?.isSyntheticCommander ? null : selectedAgent;
    }
  }

  if (!commander && selectedAgent && !selectedAgent.isSyntheticCommander) {
    commander = selectedAgent;
  }

  if (!commander) {
    commander = agents.find(agent => !agent.isSyntheticCommander) || null;
  }

  const assignedAgentId = selectedAgent?.isSyntheticCommander ? null : selectedAgent?.id || null;
  const commanderId = commander?.isSyntheticCommander ? null : commander?.id || null;
  const estimated = estimateMissionPlan(payload);
  const plannedBranches = Array.isArray(payload.planBranches) && payload.planBranches.length ? payload.planBranches : estimated.branches;
  const priorityScore = payload.priorityScore ?? 5;
  const scheduleType = payload.repeat ? 'recurring' : 'once';
  const runAt = payload.when === 'now' ? new Date().toISOString() : payload.runAt || null;
  const recurrenceRule = buildRecurrenceRule(payload.repeat);
  const lane = inferLane(priorityScore, false, 'queued');
  const missionId = crypto.randomUUID();
  const preliminaryRoutingDecision = deriveRoutingDecision(payload, selectedAgent, null);
  const routingPolicy = await selectRoutingPolicyRow(user, preliminaryRoutingDecision).catch((error) => {
    console.error('[api] selectRoutingPolicyRow:', error.message);
    return null;
  });
  const routingDecision = deriveRoutingDecision(payload, selectedAgent, routingPolicy);
  const hasDelegatedSteps = plannedBranches.length > 1;
  const executionPosture = getMissionExecutionPosture(payload);
  const workflowStatus = hasDelegatedSteps
    ? (executionPosture.shouldAutoDispatch ? WORKFLOW_STATUS.RUNNING : WORKFLOW_STATUS.PLANNED)
    : executionPosture.shouldWatchAndApprove
      ? WORKFLOW_STATUS.WAITING_ON_HUMAN
      : executionPosture.shouldAutoDispatch
        ? WORKFLOW_STATUS.READY
        : WORKFLOW_STATUS.PLANNED;

  const row = {
    id: missionId,
    user_id: user.id,
    title,
    name: title,
    description: payload.intent,
    status: hasDelegatedSteps
      ? (executionPosture.shouldAutoDispatch ? 'running' : 'pending')
      : executionPosture.shouldWatchAndApprove
        ? 'needs_approval'
        : executionPosture.shouldAutoDispatch
          ? 'queued'
          : 'pending',
    lane: hasDelegatedSteps
      ? (executionPosture.shouldAutoDispatch ? 'active' : 'blocked')
      : executionPosture.shouldWatchAndApprove
        ? 'approvals'
        : executionPosture.shouldAutoDispatch
          ? lane
          : 'blocked',
    priority: priorityScore,
    schedule_type: scheduleType,
    run_at: runAt,
    recurrence_rule: recurrenceRule,
    agent_id: assignedAgentId,
    agent_name: payload.agentName || selectedAgent?.name || 'Unknown',
    mode: payload.mode,
    output_type: payload.outputType,
    output_spec: payload.outputSpec || null,
    target_type: payload.targetType,
    target_identifier: payload.targetIdentifier || null,
    created_by_commander_id: commanderId,
    estimated_cost_cents: estimated.estimatedCostCents,
    actual_cost_cents: 0,
    progress_percent: hasDelegatedSteps ? 5 : 0,
    duration_ms: 0,
    cost_usd: 0,
    node_type: 'mission',
    workflow_status: workflowStatus,
    root_mission_id: missionId,
    routing_policy_id: routingPolicy?.id || null,
    routing_reason: `${routingDecision.routingReason} | mission mode ${executionPosture.missionMode.replaceAll('_', ' ')}`,
    domain: routingDecision.domain,
    intent_type: routingDecision.intentType,
    budget_class: routingDecision.budgetClass,
    risk_level: routingDecision.riskLevel,
    context_pack_ids: [],
    required_capabilities: routingDecision.requiredCapabilities,
    approval_level: routingDecision.approvalLevel,
    depends_on: [],
    agent_role: 'commander',
    execution_strategy: hasDelegatedSteps ? 'graph_root' : 'sequential',
    branch_label: 'Root Mission',
    provider_override: null,
    model_override: null,
    requires_approval: !hasDelegatedSteps && executionPosture.shouldWatchAndApprove,
  };

  const subtaskRows = await buildMissionSubtasks({
    missionId,
    userId: user.id,
    user,
    title,
    payload: { ...payload, priorityScore, agents, routingPolicy, selectedAgent, commander },
    branches: plannedBranches.map((branch) => ({ ...branch })),
    assignedAgentId,
    agentName: payload.agentName || selectedAgent?.name || 'Unknown',
    commanderId,
    estimatedCostCents: estimated.estimatedCostCents,
    routingPolicyId: routingPolicy?.id || null,
    routingDecision,
    runAt,
    scheduleType,
  });

  const { error } = await supabase.from('tasks').insert(row);
  if (error) {
    const legacyFallbackCodes = ['42703', '23502'];
    const missingColumn = /column .* does not exist/i.test(error.message || '');
    if (!legacyFallbackCodes.includes(error.code || '') && !missingColumn) {
      console.error('[api] createMission:', error.message);
      throw error;
    }

    const legacyRow = {
      id: missionId,
      user_id: user.id,
      name: title,
      status: 'pending',
      agent_id: assignedAgentId,
      agent_name: payload.agentName || selectedAgent?.name || 'Unknown',
      duration_ms: 0,
      cost_usd: 0,
      prompt_text: payload.intent,
    };

    const { error: legacyError } = await supabase.from('tasks').insert(legacyRow);
    if (legacyError) {
      console.error('[api] createMission legacy fallback:', legacyError.message);
      throw legacyError;
    }

    return {
      success: true,
      mission: mapTaskRow({
        ...legacyRow,
        title,
        description: payload.intent,
        mode: payload.mode,
        lane,
        priority: priorityScore,
        workflow_status: workflowStatus,
        node_type: 'mission',
        root_mission_id: missionId,
        routing_policy_id: routingPolicy?.id || null,
        routing_reason: routingDecision.routingReason,
        domain: routingDecision.domain,
        intent_type: routingDecision.intentType,
        budget_class: routingDecision.budgetClass,
        risk_level: routingDecision.riskLevel,
        context_pack_ids: [],
        required_capabilities: routingDecision.requiredCapabilities,
        approval_level: routingDecision.approvalLevel,
        depends_on: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    };
  }

  if (subtaskRows.length > 0) {
    const { error: subtaskError } = await supabase.from('tasks').insert(subtaskRows);
    if (subtaskError) {
      console.error('[api] createMission subtasks:', subtaskError.message);
      throw subtaskError;
    }
  }

  if (executionPosture.shouldAutoDispatch && assignedAgentId && subtaskRows.length === 0) {
    try {
      await dispatchMissionNow({
        taskId: missionId,
        agentId: assignedAgentId,
        taskDescription: payload.intent,
      });
    } catch (dispatchError) {
      console.error('[api] createMission dispatch:', dispatchError.message);
      throw dispatchError;
    }
  }

  if (executionPosture.shouldAutoDispatch && subtaskRows.length > 0) {
    try {
      const readySubtasks = subtaskRows.filter((subtask) => subtask.workflow_status === WORKFLOW_STATUS.READY && subtask.agent_id);
      await Promise.all(readySubtasks.map((subtask) => dispatchMissionNow({
        taskId: subtask.id,
        agentId: subtask.agent_id,
        taskDescription: subtask.description || subtask.title || subtask.name || payload.intent,
      })));
    } catch (dispatchError) {
      console.error('[api] createMission subtask dispatch:', dispatchError.message);
      throw dispatchError;
    }
  }

  const activityMessage = scheduleType === 'recurring'
    ? `Mission queued: ${title} • recurring ${payload.repeat.frequency} at ${payload.repeat.time}`
    : executionPosture.shouldWatchAndApprove
      ? `Mission staged for approval: ${title}`
      : executionPosture.shouldPlanOnly
        ? `Mission planned: ${title}`
        : payload.when === 'now' && assignedAgentId
      ? `Mission dispatched: ${title}`
      : `Mission queued: ${title}`;

  const { error: activityError } = await supabase.from('activity_log').insert({
    user_id: user.id,
    type: 'SYS',
    message: activityMessage,
    agent_id: assignedAgentId,
    duration_ms: 0,
    tokens: 0,
  });

  if (activityError) {
    console.error('[api] createMission activity_log:', activityError.message);
  }

  return {
    success: true,
    mission: mapTaskRow({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }),
    subtasks: subtaskRows.map((subtask) => mapTaskRow({ ...subtask, created_at: new Date().toISOString(), updated_at: new Date().toISOString() })),
  };
}

export async function runCommanderHeartbeat(agents = [], tasks = [], reviews = []) {
  if (!isSupabaseConfigured) return { dispatched: 0, scanned: 0 };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) return { dispatched: 0, scanned: 0 };

  const commander = agents.find((agent) => agent.role === 'commander' && !agent.isSyntheticCommander) || null;
  if (!commander?.id) return { dispatched: 0, scanned: 0 };

  await touchAgentHeartbeat(commander.id, commander.status === 'processing' ? 'processing' : 'idle');

  const now = Date.now();
  const blockedReviewAgentIds = new Set(reviews.map((review) => review.agentId).filter(Boolean));
  const busyAgentIds = new Set(
    agents
      .filter((agent) => agent.status === 'processing')
      .map((agent) => agent.id)
      .filter(Boolean)
  );

  const runnableTasks = tasks
    .filter((task) => {
      if (task.status !== 'queued') return false;
      if (task.requiresApproval) return false;
      const dueAt = task.runAt ? new Date(task.runAt).getTime() : now;
      if (Number.isNaN(dueAt) || dueAt > now) return false;
      const effectiveAgentId = task.agentId || commander.id;
      if (!effectiveAgentId) return false;
      if (blockedReviewAgentIds.has(effectiveAgentId)) return false;
      if (busyAgentIds.has(effectiveAgentId)) return false;
      return true;
    })
    .sort((a, b) => {
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

  let dispatched = 0;

  for (const task of runnableTasks) {
    const effectiveAgentId = task.agentId || commander.id;
    if (!effectiveAgentId || busyAgentIds.has(effectiveAgentId)) continue;

    const claimTimestamp = new Date().toISOString();
    const { data: claimedTask, error: claimError } = await supabase
      .from('tasks')
      .update({
        agent_id: effectiveAgentId,
        created_by_commander_id: task.createdByCommanderId || commander.id,
        status: 'running',
        workflow_status: WORKFLOW_STATUS.RUNNING,
        lane: 'active',
        started_at: task.startedAt || claimTimestamp,
        progress_percent: Math.max(10, Number(task.progressPercent || 0)),
        updated_at: claimTimestamp,
      })
      .eq('id', task.id)
      .eq('user_id', user.id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (claimError) {
      console.error('[api] runCommanderHeartbeat claim:', claimError.message);
      continue;
    }

    if (!claimedTask) continue;

    try {
      await dispatchMissionNow({
        taskId: task.id,
        agentId: effectiveAgentId,
        taskDescription: task.description || task.title || task.name || '',
      });
      dispatched += 1;
      busyAgentIds.add(effectiveAgentId);
    } catch (dispatchError) {
      console.error('[api] runCommanderHeartbeat dispatch:', dispatchError.message);
      await supabase
        .from('tasks')
        .update({
          status: 'failed',
          workflow_status: WORKFLOW_STATUS.FAILED,
          lane: 'blocked',
          failed_at: new Date().toISOString(),
          progress_percent: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id)
        .eq('user_id', user.id);
    }
  }

  return { dispatched, scanned: runnableTasks.length };
}

// ── Activity Log ────────────────────────────────────────────────

export async function fetchActivityLog(agentId = null) {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from('activity_log')
    .select('*')
    .order('timestamp', { ascending: true });

  if (agentId) {
    query = query.eq('agent_id', agentId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[api] fetchActivityLog:', error.message);
    return [];
  }
  return data.map(mapLogRow);
}

// ── Task Actions ────────────────────────────────────────────────

export async function retryTask(taskId) {
  if (!isSupabaseConfigured) return { success: true };

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'queued',
      workflow_status: WORKFLOW_STATUS.READY,
      lane: 'active',
      duration_ms: 0,
      cost_usd: 0,
      actual_cost_cents: 0,
      progress_percent: 0,
      failed_at: null,
      cancelled_at: null,
    })
    .eq('id', taskId);

  if (error) {
    console.error('[api] retryTask:', error.message);
    throw error;
  }
  return { success: true, taskId };
}

export async function stopTask(taskId) {
  if (!isSupabaseConfigured) return { success: true };

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'failed',
      workflow_status: WORKFLOW_STATUS.FAILED,
      lane: 'blocked',
      failed_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[api] stopTask:', error.message);
    throw error;
  }
  return { success: true, taskId };
}

export async function updateMissionBranchRouting(taskId, updates = {}, agents = []) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: currentTask, error: taskError } = await supabase
    .from('tasks')
    .select('id,title,name,agent_id,agent_name,root_mission_id,provider_override,model_override')
    .eq('id', taskId)
    .single();

  if (taskError) {
    console.error('[api] updateMissionBranchRouting fetch:', taskError.message);
    throw taskError;
  }

  const patch = {
    updated_at: new Date().toISOString(),
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'agentId')) {
    const nextAgent = agents.find((agent) => agent.id === updates.agentId) || null;
    patch.agent_id = updates.agentId || null;
    patch.agent_name = nextAgent?.name || 'Unassigned';
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'providerOverride')) {
    patch.provider_override = updates.providerOverride || null;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'modelOverride')) {
    patch.model_override = updates.modelOverride || null;
  }

  if (Object.keys(patch).length === 1) {
    return { success: true, taskId };
  }

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId);

  if (error) {
    console.error('[api] updateMissionBranchRouting:', error.message);
    throw error;
  }

  const nextAgent = agents.find((agent) => agent.id === (patch.agent_id || currentTask.agent_id)) || null;
  await logBranchEvent({
    userId: user.id,
    agentId: patch.agent_id || currentTask.agent_id || null,
    message: `[branch-routing] ${currentTask.title || currentTask.name || taskId} (${taskId}) on root ${currentTask.root_mission_id || taskId} -> agent ${nextAgent?.name || patch.agent_name || currentTask.agent_name || 'Unassigned'}, provider ${patch.provider_override ?? currentTask.provider_override ?? 'default'}, model ${patch.model_override ?? currentTask.model_override ?? 'default'}.`,
  });

  return { success: true, taskId };
}

export async function updateMissionBranchDependencies(taskId, dependsOn = []) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: currentTask, error: taskError } = await supabase
    .from('tasks')
    .select('id,title,name,agent_id,root_mission_id')
    .eq('id', taskId)
    .single();

  if (taskError) {
    console.error('[api] updateMissionBranchDependencies fetch:', taskError.message);
    throw taskError;
  }

  const normalizedDependencies = Array.isArray(dependsOn)
    ? [...new Set(dependsOn.filter(Boolean).filter((dependencyId) => dependencyId !== taskId))]
    : [];

  const { error } = await supabase
    .from('tasks')
    .update({
      depends_on: normalizedDependencies,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) {
    console.error('[api] updateMissionBranchDependencies:', error.message);
    throw error;
  }

  await logBranchEvent({
    userId: user.id,
    agentId: currentTask.agent_id || null,
    message: `[branch-dependency] ${currentTask.title || currentTask.name || taskId} (${taskId}) on root ${currentTask.root_mission_id || taskId} now depends on ${normalizedDependencies.length ? normalizedDependencies.join(', ') : 'no branches'}.`,
  });

  return { success: true, taskId };
}

export async function approveMissionTask(taskId) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, agent_id, title, priority')
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'queued',
      workflow_status: WORKFLOW_STATUS.READY,
      lane: inferLane(task.priority ?? 5, false, 'queued'),
      requires_approval: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;

  await supabase.from('activity_log').insert({
    user_id: user.id,
    type: 'OK',
    message: `Mission approved: ${task.title || task.id}`,
    agent_id: task.agent_id,
    tokens: 0,
    duration_ms: 0,
  });

  return { success: true, taskId };
}

export async function cancelMissionTask(taskId) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, agent_id, title')
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'cancelled',
      workflow_status: WORKFLOW_STATUS.CANCELLED,
      lane: 'blocked',
      cancelled_at: new Date().toISOString(),
      requires_approval: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId);

  if (error) throw error;

  await supabase.from('activity_log').insert({
    user_id: user.id,
    type: 'ERR',
    message: `Mission cancelled: ${task.title || task.id}`,
    agent_id: task.agent_id,
    tokens: 0,
    duration_ms: 0,
  });

  return { success: true, taskId };
}

// ── Task Notes ──────────────────────────────────────────────────

export async function fetchTaskNotes(taskId) {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('task_notes')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchTaskNotes:', error.message);
    return [];
  }
  return data.map(row => ({
    id: row.id,
    taskId: row.task_id,
    author: row.author,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function createTaskNote(taskId, content, author = 'Human') {
  if (!isSupabaseConfigured) return { success: true };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('task_notes')
    .insert({ task_id: taskId, user_id: user.id, author, content });

  if (error) throw error;
  return { success: true };
}

// ── Acknowledge / Reopen / Snooze ───────────────────────────────

export async function acknowledgeItem(table, itemId) {
  if (!isSupabaseConfigured) return { success: true };

  const { error } = await supabase
    .from(table)
    .update({ acknowledged_at: new Date().toISOString() })
    .eq('id', itemId);

  if (error) throw error;
  return { success: true };
}

export async function reopenReview(reviewId) {
  if (!isSupabaseConfigured) return { success: true };

  const { error } = await supabase
    .from('pending_reviews')
    .update({ status: 'awaiting_approval', acknowledged_at: null })
    .eq('id', reviewId);

  if (error) throw error;
  return { success: true };
}

export async function snoozeReview(reviewId, minutes = 30) {
  if (!isSupabaseConfigured) return { success: true };

  const until = new Date(Date.now() + minutes * 60_000).toISOString();
  const { error } = await supabase
    .from('pending_reviews')
    .update({ snoozed_until: until })
    .eq('id', reviewId);

  if (error) throw error;
  return { success: true };
}

// ── Schedules ───────────────────────────────────────────────────

export async function fetchSchedules() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    console.error('[api] fetchSchedules:', error.message);
    return [];
  }
  return data.map(row => ({
    id: row.id,
    name: row.name,
    agentId: row.agent_id,
    cronExpr: row.cron_expr,
    cadence: row.cadence_label,
    enabled: row.enabled,
    approvalRequired: row.approval_required,
    estMinutes: row.estimated_minutes,
    estCost: parseFloat(row.estimated_cost) || 0,
    priority: row.priority,
    lastResult: row.last_result,
    lastRunAt: row.last_run_at,
    nextRunAt: row.next_run_at,
  }));
}

export async function toggleSchedule(scheduleId, enabled) {
  if (!isSupabaseConfigured) return { success: true };

  const { error } = await supabase
    .from('schedules')
    .update({ enabled })
    .eq('id', scheduleId);

  if (error) throw error;
  return { success: true };
}

export async function dispatchFromSchedule(schedule, agents) {
  if (!isSupabaseConfigured) return { success: true };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const agent = agents.find(a => a.id === schedule.agentId);
  const taskId = crypto.randomUUID();
  const { error } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      user_id: user.id,
      name: schedule.name,
      status: 'pending',
      workflow_status: WORKFLOW_STATUS.READY,
      node_type: 'mission',
      root_mission_id: taskId,
      agent_id: schedule.agentId,
      agent_name: agent?.name || 'Unknown',
      duration_ms: 0,
      cost_usd: 0,
    });

  if (error) throw error;

  // Update schedule last_run
  await supabase
    .from('schedules')
    .update({ last_run_at: new Date().toISOString(), last_result: 'pending' })
    .eq('id', schedule.id);

  return { success: true };
}

// ── Agent Actions ───────────────────────────────────────────────

export async function restartAgent(agentId) {
  if (!isSupabaseConfigured) return { success: true };

  // Fetch current restart_count to increment
  const { data: current } = await supabase
    .from('agents')
    .select('restart_count')
    .eq('id', agentId)
    .single();

  const { error } = await supabase
    .from('agents')
    .update({
      status: 'idle',
      error_message: null,
      error_stack: null,
      last_restart: new Date().toISOString(),
      restart_count: (current?.restart_count || 0) + 1,
    })
    .eq('id', agentId);

  if (error) {
    console.error('[api] restartAgent:', error.message);
    throw error;
  }
  return { success: true, agentId };
}

// ── Execution Spans ─────────────────────────────────────────────

export async function fetchSpans() {
  return [];
}

// ── Reviews & Outputs ───────────────────────────────────────────

export async function fetchPendingReviews() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('pending_reviews')
    .select('*')
    .in('status', ['awaiting_approval', 'needs_intervention'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api] fetchPendingReviews:', error.message);
    return [];
  }
  return data.map(mapReviewRow);
}

export async function fetchCompletedOutputs() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('pending_reviews')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api] fetchCompletedOutputs:', error.message);
    return [];
  }
  return data.map(row => ({
    ...mapReviewRow(row),
    completedAt: row.created_at,
  }));
}

export async function fetchAuditTrail() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('approval_audit')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api] fetchAuditTrail:', error.message);
    return [];
  }
  return data;
}

export async function approveReview(reviewId) {
  if (!isSupabaseConfigured) return { success: true, reviewId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  // Update status on the review
  const { error: updateErr } = await supabase
    .from('pending_reviews')
    .update({ status: 'approved' })
    .eq('id', reviewId);

  if (updateErr) throw updateErr;

  // Append to audit trail
  const { error: auditErr } = await supabase
    .from('approval_audit')
    .insert({ review_id: reviewId, user_id: user.id, decision: 'approved' });

  if (auditErr) console.error('[api] audit insert:', auditErr.message);

  return { success: true, reviewId };
}

export async function rejectReview(reviewId, feedback) {
  if (!isSupabaseConfigured) return { success: true, reviewId, feedback };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { error: updateErr } = await supabase
    .from('pending_reviews')
    .update({ status: 'revision_requested' })
    .eq('id', reviewId);

  if (updateErr) throw updateErr;

  const { error: auditErr } = await supabase
    .from('approval_audit')
    .insert({
      review_id: reviewId,
      user_id: user.id,
      decision: 'revision_requested',
      feedback,
    });

  if (auditErr) console.error('[api] audit insert:', auditErr.message);

  return { success: true, reviewId, feedback };
}

export async function fetchRevisions() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('pending_reviews')
    .select('*')
    .in('status', ['revision_requested', 'rejected'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api] fetchRevisions:', error.message);
    return [];
  }
  return data.map(row => ({
    ...mapReviewRow(row),
    rejectedAt: row.created_at,
  }));
}

// ── Realtime: pending_reviews ───────────────────────────────────

/**
 * Subscribe to all changes on pending_reviews for the current user.
 * Returns an unsubscribe function.
 *
 * `onEvent` receives the raw Supabase realtime payload:
 *   { eventType: 'INSERT'|'UPDATE'|'DELETE', new: row, old: row }
 *
 * When Supabase is not configured, returns a no-op unsubscribe.
 */
export function subscribeToPendingReviews(onEvent) {
  if (!isSupabaseConfigured) return () => {};

  let channel = null;

  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;

    channel = supabase
      .channel(`pending_reviews_changes_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_reviews', filter: `user_id=eq.${user.id}` },
        (payload) => onEvent(payload)
      )
      .subscribe();
  });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

export function subscribeToTasks(onEvent) {
  if (!isSupabaseConfigured) return () => {};

  let channel = null;

  supabase.auth.getUser().then(({ data: { user } }) => {
    if (!user) return;

    channel = supabase
      .channel(`tasks_changes_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${user.id}` },
        (payload) => onEvent(payload)
      )
      .subscribe();
  });

  return () => {
    if (channel) supabase.removeChannel(channel);
  };
}

// ── Cost & Health ───────────────────────────────────────────────

export async function fetchCostData() {
  return { total: 0, burnRate: 0, models: [] };
}

export async function fetchHealthMetrics() {
  return [];
}

// ── Memory ──────────────────────────────────────────────────────

export async function fetchMemoryChunks() {
  return [];
}

// ── Intelligence / Config ───────────────────────────────────────

export async function fetchModelRegistry() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('model_bank')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchModelRegistry:', error.message);
    return [];
  }
  return data;
}

export async function fetchSkillBank() {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from('skill_bank')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchSkillBank:', error.message);
    return [];
  }
  return data;
}

async function getCurrentUserId() {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

export async function fetchMcpServers() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('connected_systems')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[api] fetchMcpServers:', error.message);
    return [];
  }

  return (data || [])
    .filter((row) => row.category === 'MCP' || row.metadata?.protocol === 'mcp')
    .map((row) => ({
    id: row.id,
    name: row.display_name,
    url: row.identifier || row.metadata?.url || 'Connected through systems dock',
    tools: Array.isArray(row.capabilities) ? row.capabilities.length : 0,
    status: row.status || 'connected',
    lastVerifiedAt: row.last_verified_at || null,
    }));
}

export async function fetchKnowledgeNamespaces() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('knowledge_namespaces')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api] fetchKnowledgeNamespaces:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    vectors: row.vectors || 0,
    sizeLabel: row.size_label || '0 MB',
    lastSyncAt: row.last_sync_at,
    status: row.status || 'active',
    agents: row.agents || [],
    description: row.description || '',
  }));
}

export async function fetchRoutingPolicies() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('routing_policies')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api] fetchRoutingPolicies:', error.message);
    return [];
  }

  return (data || []).map(mapRoutingPolicyFromDb);
}

export async function fetchDirectives() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('shared_directives')
    .select('*')
    .eq('user_id', userId)
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api] fetchDirectives:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    scope: row.scope || 'all',
    appliedTo: row.applied_to || [],
    content: row.content || '',
    priority: row.priority || 'normal',
    icon: row.icon || 'ShieldCheck',
  }));
}

export async function fetchModelBenchmarks() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const [{ data: models, error: modelError }, { data: agents, error: agentError }] = await Promise.all([
    supabase.from('model_bank').select('*').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('agents').select('model,status').eq('user_id', userId),
  ]);

  if (modelError) {
    console.error('[api] fetchModelBenchmarks model_bank:', modelError.message);
    return [];
  }

  if (agentError) {
    console.error('[api] fetchModelBenchmarks agents:', agentError.message);
    return [];
  }

  const usageByModel = (agents || []).reduce((acc, row) => {
    const key = row.model || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return (models || []).map((row) => ({
    id: row.id,
    name: row.label,
    provider: normalizeModelProvider(row.provider),
    load: usageByModel[row.label] || usageByModel[row.model_key] || 0,
    costPer1k: Number(row.cost_per_1k || 0),
  }));
}

export async function fetchRecommendations() {
  if (!isSupabaseConfigured) return [];

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('system_recommendations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[api] fetchRecommendations:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    recType: row.rec_type || 'optimization',
    title: row.title,
    description: row.description || '',
    impact: row.impact || 'normal',
    savingsLabel: row.savings_label || null,
  }));
}

// ── Notifications & Commands ────────────────────────────────────

export async function fetchNotifications() {
  return [];
}

export async function fetchCommandItems() {
  if (!isSupabaseConfigured) {
    return [
      { id: 'go-overview', label: 'Open Overview', section: 'Navigation', type: 'view', route: '/' },
      { id: 'go-missions', label: 'Open Mission Control', section: 'Navigation', type: 'view', route: '/missions' },
      { id: 'go-reports', label: 'Open Reports', section: 'Navigation', type: 'view', route: '/reports' },
      { id: 'go-intelligence', label: 'Open Intelligence', section: 'Navigation', type: 'view', route: '/intelligence' },
    ];
  }

  const userId = await getCurrentUserId();
  if (!userId) return [];

  const [{ data: agents, error: agentError }, { data: systems, error: systemsError }] = await Promise.all([
    supabase.from('agents').select('id,name,role,status').eq('user_id', userId).order('created_at', { ascending: true }),
    supabase.from('connected_systems').select('id,display_name,status,category').eq('user_id', userId).order('created_at', { ascending: true }),
  ]);

  if (agentError) {
    console.error('[api] fetchCommandItems agents:', agentError.message);
  }
  if (systemsError) {
    console.error('[api] fetchCommandItems systems:', systemsError.message);
  }

  const navigationItems = [
    { id: 'go-overview', label: 'Open Overview', section: 'Navigation', type: 'view', route: '/' },
    { id: 'go-missions', label: 'Open Mission Control', section: 'Navigation', type: 'view', route: '/missions' },
    { id: 'go-reports', label: 'Open Reports', section: 'Navigation', type: 'view', route: '/reports' },
    { id: 'go-intelligence', label: 'Open Intelligence', section: 'Navigation', type: 'view', route: '/intelligence' },
  ];

  const agentItems = (agents || []).map((row) => ({
    id: `agent-${row.id}`,
    label: row.name,
    section: 'Agents',
    type: 'agent',
    status: row.status,
    detail: row.role,
  }));

  const systemItems = (systems || []).map((row) => ({
    id: `system-${row.id}`,
    label: row.display_name,
    section: 'Connected Systems',
    type: 'system',
    status: row.status,
    detail: row.category,
  }));

  return [...navigationItems, ...agentItems, ...systemItems];
}
