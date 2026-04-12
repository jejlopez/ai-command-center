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
import { getAutomationCandidates, getBatchCommandSignals, getCommanderNextMove, getExecutionAuditReadback, getFailureTriageSummary, getHybridApprovalSummary, getMissionCreateBrief, getPatternApprovalBiasSummary, getPersistentPromotionGuidance, getRecurringAdaptiveControlSummary, getRecurringAutonomyTuningSummary, inferAgentProvider } from '../utils/commanderAnalytics';
import { buildExecutionReadiness, deriveBranchExecutionPosture, getTaskDispatchContract, getTaskDispatchSafety, hardenApprovalLevel, prioritizeMissionBranches } from '../utils/executionReadiness';

// True when real Supabase env vars are set (not the placeholder)
const isSupabaseConfigured = import.meta.env.VITE_SUPABASE_URL
  && !import.meta.env.VITE_SUPABASE_URL.includes('placeholder');

function isMissingTableError(error) {
  return ['42P01', 'PGRST205'].includes(error?.code || '') || /does not exist/i.test(String(error?.message || ''));
}

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
    provider:         normalizeModelProvider(row.provider),
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
    planBrief: row.plan_brief || row.planBrief || null,
    planSummary: row.plan_summary || row.planSummary || null,
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
    missionMode: repeat.missionMode || null,
    approvalPosture: repeat.approvalPosture || null,
    paused: repeat.paused ?? false,
  };
}

function computeNextRecurringRunAt(repeat) {
  if (!repeat?.time) return null;

  const [hourText, minuteText] = String(repeat.time || '09:00').split(':');
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);

  const frequency = String(repeat.frequency || 'weekly').toLowerCase();
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + (frequency === 'daily' ? 1 : 7));
  }

  return next.toISOString();
}

function deriveRecurringFlowState({ missionMode = 'watch_and_approve', approvalPosture = 'risk_weighted', paused = false, priority = 5 }) {
  if (paused) {
    return {
      status: 'paused',
      workflowStatus: WORKFLOW_STATUS.PLANNED,
      lane: 'blocked',
      requiresApproval: false,
      approvalLevel: approvalPosture,
    };
  }

  if (missionMode === 'plan_first') {
    return {
      status: 'pending',
      workflowStatus: WORKFLOW_STATUS.PLANNED,
      lane: 'blocked',
      requiresApproval: false,
      approvalLevel: approvalPosture,
    };
  }

  if (missionMode === 'watch_and_approve' || approvalPosture === 'human_required') {
    return {
      status: 'needs_approval',
      workflowStatus: WORKFLOW_STATUS.WAITING_ON_HUMAN,
      lane: 'approvals',
      requiresApproval: true,
      approvalLevel: 'human_required',
    };
  }

  return {
    status: 'queued',
    workflowStatus: WORKFLOW_STATUS.READY,
    lane: inferLane(priority, false, 'queued'),
    requiresApproval: false,
    approvalLevel: approvalPosture,
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

function applyLaunchReadinessToExecutionPosture(posture, launchReadiness = null) {
  if (!launchReadiness?.requiresHumanGate || posture.shouldPlanOnly) {
    return posture;
  }

  return {
    missionMode: 'watch_and_approve',
    shouldPlanOnly: false,
    shouldWatchAndApprove: true,
    shouldAutoDispatch: false,
  };
}

function deriveMissionApprovalLevel(payload = {}, fallbackApprovalLevel = 'risk_weighted') {
  if (payload.repeat?.approvalPosture) return payload.repeat.approvalPosture;
  if (payload.missionMode === 'watch_and_approve') return 'human_required';
  if (payload.missionMode === 'plan_first') return 'risk_weighted';
  return fallbackApprovalLevel;
}

async function fetchConnectedSystemsForUser(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('connected_systems')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api] fetchConnectedSystemsForUser:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    integrationKey: row.integration_key || '',
    displayName: row.display_name || row.integration_key || '',
    category: row.category || 'System',
    status: row.status || 'connected',
    identifier: row.identifier || '',
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    permissionScope: Array.isArray(row.permission_scope) ? row.permission_scope : [],
    domain: row.domain || 'general',
    trustLevel: row.trust_level || 'standard',
    riskLevel: row.risk_level || 'medium',
    metadata: row.metadata || {},
  }));
}

function enforceRecurringMissionGuardrails(payload = {}) {
  if (!payload.repeat) return { payload, guardrails: [] };

  const nextPayload = {
    ...payload,
    repeat: {
      frequency: payload.repeat.frequency || 'weekly',
      time: payload.repeat.time || '09:00',
      endDate: payload.repeat.endDate || null,
    },
  };
  const guardrails = [];
  const candidate = payload.automationCandidate || {};
  const domain = String(payload.targetType || candidate.domain || '').toLowerCase();
  const lowRoi = Number(candidate.roi || 0) > 0 && Number(candidate.roi || 0) < 1.5;
  const lightHistory = Number(candidate.runs || 0) > 0 && Number(candidate.runs || 0) < 3;
  const financeSensitive = ['finance', 'money', 'billing', 'banking'].includes(domain);
  const externalDraft = ['email_drafts', 'crm_notes'].includes(String(payload.outputType || '').toLowerCase());
  const trustTuning = getRecurringAutonomyTuningSummary(candidate);

  if (lowRoi || lightHistory || financeSensitive || externalDraft) {
    if (nextPayload.missionMode !== 'watch_and_approve') {
      nextPayload.missionMode = 'watch_and_approve';
      guardrails.push('Raised recurring mission to watch-and-approve.');
    }
  }

  if (nextPayload.repeat.frequency === 'daily' && lightHistory) {
    nextPayload.repeat = { ...nextPayload.repeat, frequency: 'weekly' };
    guardrails.push('Reduced cadence from daily to weekly until repetition history is stronger.');
  }

  if (financeSensitive) {
    guardrails.push('Finance-adjacent recurring work stays human-gated by default.');
  }

  if (lowRoi) {
    guardrails.push('Low ROI automation remains gated until the economics improve.');
  }

  if (trustTuning.posture === 'tighten') {
    if (nextPayload.missionMode !== trustTuning.recommendedMissionMode) {
      nextPayload.missionMode = trustTuning.recommendedMissionMode;
      guardrails.push('Tightened recurring mission mode from runtime trust memory.');
    }
    if (nextPayload.repeat.approvalPosture !== trustTuning.recommendedApprovalPosture) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        approvalPosture: trustTuning.recommendedApprovalPosture,
      };
      guardrails.push('Raised recurring approval posture because runtime trust is still fragile.');
    }
    if (nextPayload.repeat.frequency !== trustTuning.recommendedFrequency) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        frequency: trustTuning.recommendedFrequency,
      };
      guardrails.push('Reduced recurring cadence because runtime trust is still fragile.');
    }
    if (trustTuning.recommendedPaused && !nextPayload.repeat.paused) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        paused: true,
      };
      guardrails.push('Paused recurring flow because live trust memory is too brittle for continued autonomous runs.');
    }
  } else if (trustTuning.posture === 'watch' && nextPayload.missionMode === 'do_now') {
    nextPayload.missionMode = trustTuning.recommendedMissionMode;
    guardrails.push('Shifted recurring mission into plan-first while runtime trust is still forming.');
    if (nextPayload.repeat.frequency !== trustTuning.recommendedFrequency) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        frequency: trustTuning.recommendedFrequency,
      };
      guardrails.push('Kept recurring cadence conservative while runtime trust is still forming.');
    }
  } else if (trustTuning.earnedAutonomy) {
    if (nextPayload.missionMode !== trustTuning.recommendedMissionMode) {
      nextPayload.missionMode = trustTuning.recommendedMissionMode;
      guardrails.push('Recurring flow earned a lighter mission posture from clean runtime history.');
    }
    if (nextPayload.repeat.approvalPosture !== trustTuning.recommendedApprovalPosture) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        approvalPosture: trustTuning.recommendedApprovalPosture,
      };
      guardrails.push('Recurring approval posture relaxed because runtime trust has recovered.');
    }
    if (nextPayload.repeat.frequency !== trustTuning.recommendedFrequency) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        frequency: trustTuning.recommendedFrequency,
      };
      guardrails.push('Recurring cadence increased because runtime trust has recovered.');
    }
    if (nextPayload.repeat.paused) {
      nextPayload.repeat = {
        ...nextPayload.repeat,
        paused: false,
      };
      guardrails.push('Recurring flow automatically unpaused after earning trust back.');
    }
  }

  return { payload: nextPayload, guardrails };
}

async function inferAgentLaneDefaults(agentId) {
  if (!agentId || !isSupabaseConfigured) {
    return { provider: null, model: null };
  }

  const { data, error } = await supabase
    .from('agents')
    .select('provider,model')
    .eq('id', agentId)
    .maybeSingle();

  if (error) {
    console.error('[api] inferAgentLaneDefaults:', error.message);
    return { provider: null, model: null };
  }

  return {
    provider: data?.provider || null,
    model: data?.model || null,
  };
}

function inferMissionDomain(intent = '', targetType = 'internal') {
  const lower = String(intent || '').toLowerCase();
  if (/(code|bug|debug|test|pr|repo|build)/.test(lower)) return 'build';
  if (/(research|prospect|find|analyz|investigat|market|competitor)/.test(lower)) return 'research';
  if (/(email|draft|outreach|crm|pipedrive|deal|customer|person|slack)/.test(lower)) return 'sell';
  if (/(ops|shipment|tracking|delay|incident|war-room|vendor)/.test(lower)) return 'operate';
  if (/(budget|finance|money|cost|roi)/.test(lower)) return 'money';
  if (targetType !== 'internal') return 'sell';
  return 'general';
}

function inferMissionIntentType(intent = '', outputType = 'summary') {
  const lower = String(intent || '').toLowerCase();
  if (/(draft|email|outreach|reply)/.test(lower) || outputType === 'email_drafts') return 'draft';
  if (/(summary|summarize|brief|report|notes|crm|pipedrive)/.test(lower) || ['summary', 'report', 'crm_notes'].includes(outputType)) return 'summarize';
  if (/(research|find|investigat|analyz|prospect)/.test(lower)) return 'research';
  if (/(review|verify|validate|qa|check)/.test(lower)) return 'verify';
  if (/(update|sync|triage|route|operate)/.test(lower)) return 'operate';
  return 'general';
}

function inferMissionConstraints(payload = {}) {
  const constraints = [];
  if (payload.targetType && payload.targetType !== 'internal') {
    constraints.push(`Deliver into ${payload.targetType.replaceAll('_', ' ')} instead of an internal-only artifact.`);
  }
  if (payload.when === 'repeat' && payload.repeat?.frequency) {
    constraints.push(`Honor the ${payload.repeat.frequency} cadence without widening authority automatically.`);
  }
  if (payload.missionMode === 'watch_and_approve') {
    constraints.push('Stop at the first human gate before the work can scale.');
  } else if (payload.missionMode === 'plan_first') {
    constraints.push('Build the graph first and hold execution until explicitly released.');
  }
  if (payload.mode === 'efficient') {
    constraints.push('Bias decisions toward lower-cost execution unless trust is too weak.');
  } else if (payload.mode === 'fast') {
    constraints.push('Bias decisions toward faster completion while keeping approval posture intact.');
  }
  if (payload.outputType === 'custom' && payload.outputSpec) {
    constraints.push(`Final artifact must match the custom output spec: ${payload.outputSpec}.`);
  }
  return constraints.slice(0, 3);
}

function buildStructuredMissionBrief(payload = {}, estimated = {}) {
  const intent = String(payload.intent || '').trim();
  const domain = inferMissionDomain(intent, payload.targetType);
  const intentType = inferMissionIntentType(intent, payload.outputType);
  const branchCount = Array.isArray(estimated.branches) ? estimated.branches.length : 0;
  const riskLevel = branchCount >= 4 || payload.missionMode === 'watch_and_approve'
    ? 'high'
    : branchCount >= 2 || payload.mode === 'fast'
      ? 'medium'
      : 'low';
  const approvalPosture = payload.missionMode === 'watch_and_approve'
    ? 'human_required'
    : payload.missionMode === 'plan_first'
      ? 'plan_gated'
      : riskLevel === 'high'
        ? 'risk_weighted'
        : 'auto_low_risk';
  const costPosture = payload.mode === 'efficient'
    ? 'cost_disciplined'
    : payload.mode === 'fast'
      ? 'speed_biased'
      : 'balanced';
  const outputLabel = payload.outputType === 'custom'
    ? (payload.outputSpec || 'custom output')
    : String(payload.outputType || 'summary').replaceAll('_', ' ');

  return {
    objective: intent || 'Mission intent still needs to be specified.',
    domain,
    intentType,
    riskLevel,
    approvalPosture,
    costPosture,
    successDefinition: `Complete the mission with a usable ${outputLabel} that lands cleanly without avoidable rescue pressure.`,
    constraints: inferMissionConstraints(payload),
  };
}

function buildExecutionPlanSummary(payload = {}, estimated = {}) {
  const branches = Array.isArray(estimated.branches) ? estimated.branches : [];
  const steps = Array.isArray(estimated.steps) ? estimated.steps : [];
  const specialistRoles = [...new Set(branches.map((branch) => branch.agentRole).filter(Boolean))];
  const hasParallel = branches.some((branch) => branch.executionStrategy === 'parallel');
  const dependencyCount = branches.reduce((count, branch) => count + (Array.isArray(branch.dependsOn) ? branch.dependsOn.length : 0), 0);

  return {
    branchCount: branches.length || 1,
    primaryStrategy: hasParallel ? 'hybrid_parallel' : 'sequential',
    specialistRoles,
    dependencyPosture: dependencyCount > 0 ? 'dependency_gated' : 'launch_ready',
    verificationRequirement: payload.missionMode === 'watch_and_approve'
      ? 'human_gate'
      : specialistRoles.includes('verifier') || steps.length >= 3
        ? 'verifier_branch'
        : 'lightweight',
  };
}

function summarizeMissionBrief(brief = null) {
  if (!brief) return '';

  return [
    brief.domain && brief.intentType ? `${brief.domain}/${brief.intentType}` : null,
    brief.riskLevel ? `${brief.riskLevel} risk` : null,
    brief.approvalPosture ? `${String(brief.approvalPosture).replaceAll('_', ' ')} approval` : null,
    brief.costPosture ? `${brief.costPosture} cost posture` : null,
  ].filter(Boolean).join(' • ');
}

function summarizeExecutionPlan(planSummary = null) {
  if (!planSummary) return '';

  return [
    Number.isFinite(Number(planSummary.branchCount))
      ? `${planSummary.branchCount} branch${Number(planSummary.branchCount) === 1 ? '' : 'es'}`
      : null,
    planSummary.primaryStrategy ? `${planSummary.primaryStrategy.replaceAll('_', ' ')} strategy` : null,
    planSummary.verificationRequirement ? `${planSummary.verificationRequirement.replaceAll('_', ' ')} verification` : null,
    Array.isArray(planSummary.specialistRoles) && planSummary.specialistRoles.length
      ? `roles ${planSummary.specialistRoles.join(', ')}`
      : null,
  ].filter(Boolean).join(' • ');
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
    brief: buildStructuredMissionBrief(payload, {
      branches: steps.map((step, index) => ({
        title: step.title,
        description: step.description,
        agentRole: index === 0 ? 'planner' : index === steps.length - 1 ? 'verifier' : 'executor',
        executionStrategy: index === 0 ? 'sequential' : 'parallel',
        branchLabel: index === 0 ? 'Command' : `Branch ${index}`,
        dependsOn: index === 0 ? [] : [steps[0].title],
      })),
      steps,
      estimatedCostCents: centsBase * complexity,
    }),
    planSummary: buildExecutionPlanSummary(payload, {
      branches: steps.map((step, index) => ({
        title: step.title,
        description: step.description,
        agentRole: index === 0 ? 'planner' : index === steps.length - 1 ? 'verifier' : 'executor',
        executionStrategy: index === 0 ? 'sequential' : 'parallel',
        branchLabel: index === 0 ? 'Command' : `Branch ${index}`,
        dependsOn: index === 0 ? [] : [steps[0].title],
      })),
      steps,
    }),
  };
}

async function ensureBranchSpecialistAgent({
  user,
  branchRole,
  modelOverride,
  providerOverride,
  commander,
  selectedAgent,
  rootMissionId = null,
  objective,
  recommendedSkillNames = [],
}) {
  const chosenModel = modelOverride || selectedAgent?.model || commander?.model || getCommanderLane().model;
  const chosenProvider = providerOverride || normalizeModelProvider(selectedAgent?.provider || getCommanderLane().provider);

  await ensureModelBankEntry(user, chosenModel, chosenProvider);

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `${branchRole}-${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
    model: chosenModel,
    provider: chosenProvider,
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
    skills: recommendedSkillNames,
  };

  const { data, error } = await supabase.from('agents').insert([row]).select('*').single();
  if (error) throw error;
  const message = `[specialist-spawned] ${data.name} (${branchRole}) materialized for "${objective}" on ${chosenModel}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: data.id,
    message,
  });
  await persistSpecialistLifecycleEvent({
    userId: user.id,
    agentId: data.id,
    rootMissionId,
    eventType: 'spawned',
    eventSource: 'mission_routing',
    role: branchRole,
    provider: chosenProvider,
    model: chosenModel,
    isEphemeral: true,
    message,
    metadata: {
      objective,
      skills: recommendedSkillNames,
    },
  });
  return mapAgentRow(data);
}

async function createPersistentBranchSpecialist({
  user,
  branchRole,
  modelOverride,
  providerOverride,
  commander,
  selectedAgent,
  rootMissionId = null,
  objective,
  recommendedSkillNames = [],
}) {
  const chosenModel = modelOverride || selectedAgent?.model || commander?.model || getCommanderLane().model;
  const chosenProvider = providerOverride || normalizeModelProvider(selectedAgent?.provider || getCommanderLane().provider);

  await ensureModelBankEntry(user, chosenModel, chosenProvider);

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `${branchRole}-lane-${objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`,
    model: chosenModel,
    provider: chosenProvider,
    status: 'idle',
    role: branchRole,
    role_description: `Persistent ${branchRole} lane created automatically from lifecycle pressure.`,
    parent_id: commander?.isSyntheticCommander ? null : commander?.id || null,
    can_spawn: false,
    spawn_pattern: 'persistent',
    is_ephemeral: false,
    system_prompt: `You are a persistent ${branchRole} lane. Objective focus: ${objective}`,
    response_length: selectedAgent?.responseLength || commander?.responseLength || 'medium',
    temperature: selectedAgent?.temperature ?? commander?.temperature ?? 0.4,
    color: '#60a5fa',
    skills: recommendedSkillNames,
  };

  const { data, error } = await supabase.from('agents').insert([row]).select('*').single();
  if (error) throw error;
  const message = `[specialist-persistent] ${data.name} (${branchRole}) created automatically from lifecycle pressure for "${objective}" on ${chosenModel}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: data.id,
    message,
  });
  await persistSpecialistLifecycleEvent({
    userId: user.id,
    agentId: data.id,
    rootMissionId,
    eventType: 'persistent_created',
    eventSource: 'mission_routing',
    role: branchRole,
    provider: chosenProvider,
    model: chosenModel,
    isEphemeral: false,
    message,
    metadata: {
      objective,
      skills: recommendedSkillNames,
      autoCreated: true,
    },
  });
  return mapAgentRow(data);
}

async function fetchPersistentLaneSignals(userId) {
  if (!userId) return { tasks: [], lifecycleEvents: [] };

  const [{ data: taskRows, error: taskError }, { data: lifecycleRows, error: lifecycleError }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id,root_mission_id,agent_role,domain,intent_type')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(160),
    supabase
      .from('specialist_lifecycle')
      .select('id,root_mission_id,event_type,role,is_ephemeral,message,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(160),
  ]);

  if (taskError) {
    console.error('[api] fetchPersistentLaneSignals tasks:', taskError.message);
  }
  if (lifecycleError) {
    console.error('[api] fetchPersistentLaneSignals lifecycle:', lifecycleError.message);
  }

  return {
    tasks: (taskRows || []).map((row) => ({
      id: row.id,
      rootMissionId: row.root_mission_id || row.id,
      agentRole: row.agent_role || 'executor',
      domain: row.domain || 'general',
      intentType: row.intent_type || 'general',
    })),
    lifecycleEvents: (lifecycleRows || []).map((row) => ({
      id: row.id,
      rootMissionId: row.root_mission_id || null,
      eventType: row.event_type || 'spawned',
      role: row.role || 'specialist',
      isEphemeral: row.is_ephemeral ?? false,
      message: row.message || '',
      createdAt: row.created_at,
    })),
  };
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
  observedWinningLane,
  persistentLaneSignals,
  missionBrief,
  planSummary,
  runAt,
  scheduleType,
}) {
  if (!Array.isArray(branches) || branches.length <= 1) return [];

  const controlPressure = payload.controlContext?.failureTriage?.failedCount > 0
    || payload.controlContext?.hybridApproval?.totalQueue > 2
    ? 'high'
    : 'stable';
  const orderedBranches = prioritizeMissionBranches({
    branches,
    launchReadiness: payload.launchReadiness || null,
    controlPressure,
  });
  const branchIdByTitle = new Map();
  const rows = [];
  orderedBranches.forEach((branch) => {
    branchIdByTitle.set(branch.title, crypto.randomUUID());
  });

  for (const [index, branch] of orderedBranches.entries()) {
    const stepId = branchIdByTitle.get(branch.title) || crypto.randomUUID();
    const first = index === 0;
    const executionPosture = getMissionExecutionPosture(payload);
    const branchExecutionPosture = deriveBranchExecutionPosture({
      branch,
      branchIndex: index,
      branchCount: orderedBranches.length,
      launchReadiness: payload.launchReadiness || null,
    });
    const dependencies = Array.isArray(branch.dependsOn)
      ? branch.dependsOn.map((dependencyTitle) => branchIdByTitle.get(dependencyTitle)).filter(Boolean)
      : [];
    const dispatchContract = dependencies.length > 0
      ? 'release_on_upstream_completion'
      : branchExecutionPosture.executionStrategy === 'parallel' || branch.executionStrategy === 'parallel'
        ? 'safe_parallel_fanout'
        : 'serialized_mission_order';
    const branchCanRunImmediately = dependencies.length === 0
      && (first || branchExecutionPosture.executionStrategy === 'parallel' || branch.executionStrategy === 'parallel')
      && !branchExecutionPosture.deferUntilSafeLane;
    const baseBranchApprovalLevel = deriveMissionApprovalLevel(payload, routingDecision.approvalLevel);
    const branchApprovalLevel = hardenApprovalLevel(baseBranchApprovalLevel, branchExecutionPosture.recommendedApprovalLevel || baseBranchApprovalLevel);
    const branchRequiresApproval = branchApprovalLevel === 'human_required' || (executionPosture.shouldWatchAndApprove && branchCanRunImmediately);
    const branchShouldStayPlanned = executionPosture.shouldPlanOnly || branchExecutionPosture.deferUntilSafeLane || (!branchCanRunImmediately && !branchRequiresApproval);
    const assignment = await resolveBranchAssignment({
      missionId,
      branch: {
        ...branch,
        recommendedSkillNames: Array.isArray(branch.recommendedSkillNames) && branch.recommendedSkillNames.length
          ? branch.recommendedSkillNames
          : routingDecision.recommendedSkillNames,
      },
      user,
      branchIndex: index,
      branchCount: orderedBranches.length,
      agents: payload.agents || [],
      routingPolicy: payload.routingPolicy || null,
      selectedAgent: payload.selectedAgent || null,
      commander: payload.commander || null,
      routingDecision,
      observedWinningLane,
      persistentLaneSignals,
      launchReadiness: payload.launchReadiness || null,
      branchExecutionPosture,
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
      routing_reason: `${routingDecision.routingReason} | skills ${(assignment.recommendedSkillNames || routingDecision.recommendedSkillNames || []).join(', ') || 'none'} | ${assignment.agentRole || branch.agentRole || 'executor'} branch ${index + 1}/${orderedBranches.length}${missionBrief?.objective ? ` | objective ${missionBrief.objective}` : ''}${planSummary?.primaryStrategy ? ` | ${planSummary.primaryStrategy.replaceAll('_', ' ')} plan` : ''}${planSummary?.verificationRequirement ? ` | ${planSummary.verificationRequirement.replaceAll('_', ' ')} verification` : ''}${branchExecutionPosture.available ? ` | connector posture ${branchExecutionPosture.title.toLowerCase()}${branchExecutionPosture.modes.length ? ` (${branchExecutionPosture.modes.join('/')})` : ''}` : ''}${branchExecutionPosture.fallbackStrategy ? ` | fallback ${branchExecutionPosture.fallbackStrategy.replaceAll('_', ' ')}` : ''}${branch.planningReason ? ` | order ${branch.planningReason}` : ''} | dispatch contract ${dispatchContract.replaceAll('_', ' ')}${dependencies.length > 0 ? ' | release trigger upstream completion' : ''}`,
      domain: routingDecision.domain,
      intent_type: routingDecision.intentType,
      budget_class: routingDecision.budgetClass,
      risk_level: routingDecision.riskLevel,
      context_pack_ids: routingDecision.contextPackIds,
      required_capabilities: routingDecision.requiredCapabilities,
      approval_level: branchApprovalLevel,
      depends_on: dependencies,
      agent_role: assignment.agentRole || branch.agentRole || 'executor',
      execution_strategy: dependencies.length === 0
        ? (branchExecutionPosture.executionStrategy || branch.executionStrategy || 'sequential')
        : 'sequential',
      branch_label: branch.branchLabel || branch.title,
      provider_override: assignment.providerOverride || null,
      model_override: assignment.modelOverride || null,
      requires_approval: branchRequiresApproval,
    });
  }

  return rows;
}

async function resolveBranchAssignment({
  missionId,
  branch,
  branchIndex = 0,
  branchCount = 1,
  user,
  agents,
  routingPolicy,
  routingDecision,
  selectedAgent,
  commander,
  observedWinningLane,
  persistentLaneSignals,
  launchReadiness = null,
  branchExecutionPosture = null,
}) {
  const liveAgents = agents.filter((agent) => !agent.isSyntheticCommander);
  const readinessSystems = launchReadiness
    ? [...(launchReadiness.missingSystems || []), ...(launchReadiness.degradedSystems || [])]
    : [];
  const needsConnectorStabilization = readinessSystems.length > 0;
  const inferredReadinessRole = needsConnectorStabilization
    ? (branchIndex === 0 ? 'ops' : branchIndex === branchCount - 1 ? 'verifier' : null)
    : null;
  const branchRole = branch.agentRole
    || branchExecutionPosture?.preferredRole
    || (observedWinningLane?.confidence === 'high' && observedWinningLane?.agentRole && !['commander', 'executor'].includes(observedWinningLane.agentRole)
      ? observedWinningLane.agentRole
      : null)
    || inferredReadinessRole
    || routingDecision?.selectedAgentRole
    || routingPolicy?.preferredAgentRole
    || selectedAgent?.role
    || 'executor';
  const fallbackOrder = Array.isArray(routingPolicy?.fallbackOrder) ? routingPolicy.fallbackOrder : [];
  const roleFallback = fallbackOrder.find((entry) => entry.role === branchRole) || null;
  const shouldLeanOnWinningLane = Boolean(
    observedWinningLane
    && (
      observedWinningLane.confidence === 'high'
      || (
        observedWinningLane.confidence === 'medium'
        && Number(observedWinningLane.avgScore || 0) >= (
          observedWinningLane.scopeLabel === 'exact'
            ? 82
            : observedWinningLane.scopeLabel === 'domain-pack'
              ? 85
              : 88
        )
      )
    )
  );
  const modelOverride = branch.modelOverride
    || (shouldLeanOnWinningLane ? observedWinningLane?.model : null)
    || routingDecision?.selectedModel
    || roleFallback?.model
    || routingPolicy?.preferredModel
    || null;
  const providerOverride = branch.providerOverride
    || (shouldLeanOnWinningLane ? observedWinningLane?.provider : null)
    || routingDecision?.selectedProvider
    || roleFallback?.provider
    || routingPolicy?.preferredProvider
    || null;
  const recommendedSkillNames = Array.isArray(branch.recommendedSkillNames)
    ? branch.recommendedSkillNames
    : [];
  const readinessSkillNames = [
    ...(needsConnectorStabilization ? ['operations', 'integration'] : []),
    ...readinessSystems.map((system) => system.key).filter(Boolean),
    ...((branchExecutionPosture?.skillHints) || []),
  ];
  const finalRecommendedSkillNames = [...new Set([...recommendedSkillNames, ...readinessSkillNames])];

  const exactRoleMatches = liveAgents
    .filter((agent) => agent.role === branchRole)
    .sort((left, right) => {
      const leftProvider = inferAgentProvider(left);
      const rightProvider = inferAgentProvider(right);
      const leftPersistent = Number(!left.isEphemeral);
      const rightPersistent = Number(!right.isEphemeral);
      const persistenceDelta = rightPersistent - leftPersistent;
      if (persistenceDelta !== 0) return persistenceDelta;
      if (providerOverride) {
        const rightProviderMatch = Number(rightProvider === providerOverride);
        const leftProviderMatch = Number(leftProvider === providerOverride);
        if (rightProviderMatch !== leftProviderMatch) return rightProviderMatch - leftProviderMatch;
      }
      const leftSkillScore = (left.skills || []).filter((skill) => finalRecommendedSkillNames.includes(skill)).length;
      const rightSkillScore = (right.skills || []).filter((skill) => finalRecommendedSkillNames.includes(skill)).length;
      return rightSkillScore - leftSkillScore;
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
    const promotionGuidance = getPersistentPromotionGuidance({
      lifecycleEvents: persistentLaneSignals?.lifecycleEvents || [],
      agents: liveAgents,
      tasks: persistentLaneSignals?.tasks || [],
    });
    const domainScopedGap = (promotionGuidance.domainTargets || []).find((entry) => (
      entry.role === branchRole
      && entry.domain === routingDecision.domain
      && entry.intentType === routingDecision.intentType
    ));
    const domainPackGap = (promotionGuidance.domainPackTargets || []).find((entry) => (
      entry.role === branchRole
      && entry.domain === routingDecision.domain
    ));
    const durableGap = Boolean(
      (Array.isArray(promotionGuidance.autoCreateRoles)
        && promotionGuidance.autoCreateRoles.includes(branchRole))
      || domainScopedGap
      || domainPackGap
      || ((promotionGuidance.domainPackTargets || []).filter((entry) => entry.role === branchRole).length >= 2)
    );

    assignedAgent = await (durableGap ? createPersistentBranchSpecialist : ensureBranchSpecialistAgent)({
      user,
      branchRole,
      modelOverride,
      providerOverride,
      commander,
      selectedAgent,
      rootMissionId: missionId,
      objective: branch.title || branch.description || `${branchRole} branch`,
      recommendedSkillNames: finalRecommendedSkillNames,
    }).catch((error) => {
      console.error(`[api] ${durableGap ? 'createPersistentBranchSpecialist' : 'ensureBranchSpecialistAgent'}:`, error.message);
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
    recommendedSkillNames: finalRecommendedSkillNames,
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
    const fallback = estimateMissionPlan(payload);
    return {
      steps: Array.isArray(data.steps) ? data.steps : fallback.steps,
      branches: Array.isArray(data.branches) ? data.branches : fallback.branches,
      estimatedDuration: data.estimatedDuration || fallback.estimatedDuration,
      estimatedCostRange: data.estimatedCostRange || fallback.estimatedCostRange,
      estimatedCostCents: data.estimatedCostCents ?? fallback.estimatedCostCents,
      brief: data.brief && typeof data.brief === 'object' ? { ...fallback.brief, ...data.brief } : fallback.brief,
      planSummary: data.planSummary && typeof data.planSummary === 'object' ? { ...fallback.planSummary, ...data.planSummary } : fallback.planSummary,
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

function isCompletedDependencyTask(task = {}) {
  const status = String(task.status || '').toLowerCase();
  const workflowStatus = String(task.workflowStatus || task.workflow_status || '').toLowerCase();
  return ['done', 'completed'].includes(status) || workflowStatus === WORKFLOW_STATUS.COMPLETED;
}

function isFailedDependencyTask(task = {}) {
  const status = String(task.status || '').toLowerCase();
  const workflowStatus = String(task.workflowStatus || task.workflow_status || '').toLowerCase();
  return ['failed', 'error', 'cancelled'].includes(status) || [WORKFLOW_STATUS.FAILED, WORKFLOW_STATUS.CANCELLED].includes(workflowStatus);
}

async function releaseDependencyReadyTasks({ user, tasks = [] }) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const candidates = tasks.filter((task) => {
    const status = String(task.status || '').toLowerCase();
    if (!['pending', 'blocked'].includes(status)) return false;
    if (task.requiresApproval) return false;
    const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
    if (!dependencies.length) return false;
    const upstream = dependencies.map((dependencyId) => byId.get(dependencyId)).filter(Boolean);
    if (!upstream.length || upstream.length !== dependencies.length) return false;
    if (upstream.some((dependency) => isFailedDependencyTask(dependency))) return false;
    return upstream.every((dependency) => isCompletedDependencyTask(dependency));
  });

  let released = 0;

  for (const task of candidates) {
    const claimTimestamp = new Date().toISOString();
    const { data: releasedTask, error } = await supabase
      .from('tasks')
      .update({
        status: 'queued',
        workflow_status: WORKFLOW_STATUS.READY,
        lane: inferLane(task.priority ?? 5, false, 'queued'),
        updated_at: claimTimestamp,
      })
      .eq('id', task.id)
      .eq('user_id', user.id)
      .in('status', ['pending', 'blocked'])
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[api] releaseDependencyReadyTasks:', error.message);
      continue;
    }

    if (!releasedTask) continue;

    released += 1;
    const message = `[dependency-release] ${(task.title || task.name || task.id)} (${task.id}) on root ${task.rootMissionId || task.id} was released after upstream dependencies completed.`;
    await logBranchEvent({
      userId: user.id,
      agentId: task.agentId || null,
      message,
    });
    await persistExecutionControlEvent({
      userId: user.id,
      task: {
        id: task.id,
        rootMissionId: task.rootMissionId || task.id,
        agentId: task.agentId || null,
        domain: task.domain || 'general',
        intentType: task.intentType || 'general',
        providerOverride: task.providerOverride || null,
        modelOverride: task.modelOverride || null,
        scheduleType: task.scheduleType || 'once',
      },
      rootMissionId: task.rootMissionId || task.id,
      agentId: task.agentId || null,
      eventType: 'dependency_release',
      eventSource: 'runtime',
      tone: 'teal',
      message,
      domain: task.domain || 'general',
      intentType: task.intentType || 'general',
      provider: task.providerOverride || null,
      model: task.modelOverride || null,
      scheduleType: task.scheduleType || 'once',
      metadata: buildExecutionControlMetadata({
        controlCategory: 'routing',
        actionType: 'dependency_release',
        triageVerdict: 'dependency_cleared',
        nextMove: 'dispatch_ready_branch',
        previousStatus: task.status || 'pending',
        nextStatus: 'queued',
        previousApprovalLevel: task.approvalLevel || 'risk_weighted',
        nextApprovalLevel: task.approvalLevel || 'risk_weighted',
        approvalState: 'not_required',
        reason: 'Upstream dependencies completed, so this branch was released into runnable execution.',
        extra: {
          dependsOn: Array.isArray(task.dependsOn) ? task.dependsOn : [],
          releaseTrigger: 'upstream_completion',
          dispatchContract: 'release_on_upstream_completion',
          releaseChainState: 'cleared',
        },
      }),
    });
  }

  return released;
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

async function persistTaskIntervention({
  userId,
  taskId = null,
  rootMissionId = null,
  agentId = null,
  eventType = 'override',
  eventSource = 'runtime',
  tone = 'blue',
  message = '',
  domain = 'general',
  intentType = 'general',
  provider = null,
  model = null,
  scheduleType = 'once',
  metadata = {},
}) {
  if (!userId || !message) return;

  const { error } = await supabase.from('task_interventions').insert({
    user_id: userId,
    task_id: taskId,
    root_mission_id: rootMissionId,
    agent_id: agentId,
    event_type: eventType,
    event_source: eventSource,
    tone,
    message,
    domain,
    intent_type: intentType,
    provider,
    model,
    schedule_type: scheduleType,
    metadata,
  });

  if (error) {
    console.error('[api] persistTaskIntervention:', error.message);
  }
}

function buildExecutionControlMetadata({
  controlCategory = 'intervention',
  actionType = 'override',
  triageVerdict = 'captured',
  nextMove = 'review',
  previousStatus = null,
  nextStatus = null,
  previousApprovalLevel = null,
  nextApprovalLevel = null,
  approvalState = null,
  batchSize = null,
  batchRoots = [],
  targetAgent = null,
  reviewId = null,
  reviewDecision = null,
  reason = null,
  extra = {},
} = {}) {
  return {
    controlCategory,
    actionType,
    triageVerdict,
    nextMove,
    previousStatus,
    nextStatus,
    previousApprovalLevel,
    nextApprovalLevel,
    approvalState,
    batchSize,
    batchRoots: Array.isArray(batchRoots) ? batchRoots.filter(Boolean) : [],
    targetAgentId: targetAgent?.id || null,
    targetAgentName: targetAgent?.name || null,
    reviewId,
    reviewDecision,
    reason,
    ...extra,
  };
}

async function persistExecutionControlEvent({
  userId,
  task = null,
  rootMissionId = null,
  agentId = null,
  eventType = 'override',
  eventSource = 'manual',
  tone = 'blue',
  message = '',
  domain = 'general',
  intentType = 'general',
  provider = null,
  model = null,
  scheduleType = 'once',
  metadata = {},
}) {
  if (!userId || !message) return;

  await persistTaskIntervention({
    userId,
    taskId: task?.id || null,
    rootMissionId: rootMissionId || task?.root_mission_id || task?.rootMissionId || task?.id || null,
    agentId: agentId ?? task?.agent_id ?? task?.agentId ?? null,
    eventType,
    eventSource,
    tone,
    message,
    domain: domain || task?.domain || 'general',
    intentType: intentType || task?.intent_type || task?.intentType || 'general',
    provider: provider ?? task?.provider_override ?? task?.providerOverride ?? null,
    model: model ?? task?.model_override ?? task?.modelOverride ?? null,
    scheduleType: scheduleType || task?.schedule_type || task?.scheduleType || 'once',
    metadata,
  });
}

async function persistSpecialistLifecycleEvent({
  userId,
  agentId = null,
  rootMissionId = null,
  eventType = 'spawned',
  eventSource = 'runtime',
  role = 'specialist',
  provider = null,
  model = null,
  isEphemeral = true,
  message = '',
  metadata = {},
}) {
  if (!userId || !message) return;

  const { error } = await supabase.from('specialist_lifecycle').insert({
    user_id: userId,
    agent_id: agentId,
    root_mission_id: rootMissionId,
    event_type: eventType,
    event_source: eventSource,
    role,
    provider,
    model,
    is_ephemeral: isEphemeral,
    message,
    metadata,
  });

  if (error) {
    console.error('[api] persistSpecialistLifecycleEvent:', error.message);
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

async function selectOutcomeWinningLane(user, routingDecision, batchSignals = null) {
  if (!user?.id) return null;

  const selectColumns = 'provider,model,score,cost_usd,agent_role,execution_strategy,approval_level,domain,intent_type';
  const queryOutcomeRows = async (scope = 'exact') => {
    let query = supabase
      .from('task_outcomes')
      .select(selectColumns)
      .eq('user_id', user.id)
      .eq('outcome_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(32);

    if (scope === 'exact') {
      query = query.eq('domain', routingDecision.domain).eq('intent_type', routingDecision.intentType);
    } else if (scope === 'domain-pack') {
      query = query.eq('domain', routingDecision.domain);
    } else if (scope === 'intent-pack') {
      query = query.eq('intent_type', routingDecision.intentType);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[api] selectOutcomeWinningLane:', error.message);
      return [];
    }
    return (data || []).map((row) => ({ ...row, __scope: scope }));
  };

  const exactRows = await queryOutcomeRows('exact');
  const data = exactRows.length >= 3
    ? exactRows
    : [
        ...exactRows,
        ...(await queryOutcomeRows('domain-pack')).filter((row) => !(row.domain === routingDecision.domain && row.intent_type === routingDecision.intentType)),
        ...(await queryOutcomeRows('intent-pack')).filter((row) => !(row.domain === routingDecision.domain && row.intent_type === routingDecision.intentType)),
      ].slice(0, 32);

  const grouped = new Map();
  (data || []).forEach((row) => {
    const key = `${row.provider || 'Adaptive'}::${row.model || 'Adaptive lane'}`;
    const current = grouped.get(key) || {
      provider: row.provider || 'Adaptive',
      model: row.model || 'Adaptive lane',
      agentRole: row.agent_role || 'executor',
      executionStrategy: row.execution_strategy || 'sequential',
      approvalLevel: row.approval_level || 'risk_weighted',
      exactRuns: 0,
      domainPackRuns: 0,
      intentPackRuns: 0,
      runs: 0,
      totalScore: 0,
      totalCost: 0,
    };
    if (row.domain === routingDecision.domain && row.intent_type === routingDecision.intentType) current.exactRuns += 1;
    else if (row.domain === routingDecision.domain) current.domainPackRuns += 1;
    else if (row.intent_type === routingDecision.intentType) current.intentPackRuns += 1;
    current.runs += 1;
    current.totalScore += Number(row.score || 0);
    current.totalCost += Number(row.cost_usd || 0);
    grouped.set(key, current);
  });

  return Array.from(grouped.values())
    .map((entry) => {
      const avgScore = entry.runs ? entry.totalScore / entry.runs : 0;
      const avgCost = entry.runs ? entry.totalCost / entry.runs : 0;
      const generalizedSupport = (entry.domainPackRuns * 0.7) + (entry.intentPackRuns * 0.55);
      const scopeSupport = entry.exactRuns + generalizedSupport;
      const scopeLabel = entry.exactRuns >= 3
        ? 'exact'
        : entry.domainPackRuns >= entry.intentPackRuns && entry.domainPackRuns > 0
          ? 'domain-pack'
          : entry.intentPackRuns > 0
            ? 'intent-pack'
            : 'thin';
      const confidence = entry.exactRuns >= 6 || scopeSupport >= 10
        ? 'high'
        : entry.exactRuns >= 2 || scopeSupport >= 5
          ? 'medium'
          : 'low';
      const batchApprovePressure = Number(batchSignals?.actionCounts?.approve || 0);
      const batchRescuePressure = Number(batchSignals?.actionCounts?.retry || 0)
        + Number(batchSignals?.actionCounts?.redirect || 0)
        + Number(batchSignals?.actionCounts?.stop || 0);
      const batchTrustAdjustment = batchApprovePressure > batchRescuePressure
        ? (entry.approvalLevel === 'auto_low_risk' ? 8 : entry.approvalLevel === 'risk_weighted' ? 4 : -3)
        : batchRescuePressure > batchApprovePressure
          ? (entry.approvalLevel === 'auto_low_risk' ? -10 : entry.approvalLevel === 'risk_weighted' ? -2 : 4)
          : 0;
      const batchTrustDetail = batchTrustAdjustment > 0
        ? 'Grouped approvals are reinforcing lighter lane trust.'
        : batchTrustAdjustment < 0
          ? 'Grouped rescues are penalizing brittle lane posture.'
          : 'Grouped batch history is not shifting lane trust yet.';

      return {
        ...entry,
        avgScore,
        avgCost,
        scopeLabel,
        confidence,
        batchTrustAdjustment,
        batchTrustDetail,
        rank: avgScore
          + Math.min(24, (entry.exactRuns * 4) + generalizedSupport * 2)
          - (avgCost * 5.5)
          + (entry.approvalLevel === 'auto_low_risk' ? 6 : entry.approvalLevel === 'risk_weighted' ? 2 : -6)
          + (entry.executionStrategy === 'parallel' ? 3 : 0)
          + (scopeLabel === 'exact' ? 6 : scopeLabel === 'domain-pack' ? 2 : 0)
          + batchTrustAdjustment,
      };
    })
    .sort((left, right) => {
      if (right.rank !== left.rank) return right.rank - left.rank;
      return right.runs - left.runs;
    })[0] || null;
}

function applyPatternApprovalBiasWithBatch({ routingDecision, observedWinningLane, batchSignals = null }) {
  const patternBias = getPatternApprovalBiasSummary({
    winningPattern: observedWinningLane
      ? {
          domain: routingDecision.domain,
          intentType: routingDecision.intentType,
          executionStrategy: observedWinningLane.executionStrategy,
          approvalLevel: observedWinningLane.approvalLevel,
          runs: observedWinningLane.runs,
          confidence: observedWinningLane.confidence === 'high' ? 84 : observedWinningLane.confidence === 'medium' ? 68 : 52,
        }
      : null,
    routingDecision,
    observedWinningLane,
    batchSignals,
  });

  if (!patternBias.available || routingDecision.riskLevel === 'high') {
    return {
      ...routingDecision,
      approvalBiasDetail: patternBias.detail,
    };
  }

  return {
    ...routingDecision,
    approvalLevel: patternBias.recommendedApprovalLevel || routingDecision.approvalLevel,
    approvalBiasDetail: patternBias.detail,
  };
}

async function fetchRecentBatchAuditLogs(userId) {
  const { data, error } = await supabase
    .from('activity_log')
    .select('id,message,timestamp,type')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(120);

  if (error) {
    console.error('[api] fetchRecentBatchAuditLogs:', error.message);
    return [];
  }

  return (data || [])
    .filter((row) => String(row.message || '').includes('[batch-intervention-]'))
    .map((row) => ({
      id: row.id,
      message: row.message || '',
      timestamp: row.timestamp || null,
      type: row.type || 'SYS',
    }));
}

async function fetchRecentTasksForControlContext(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(180);

  if (error) {
    console.error('[api] fetchRecentTasksForControlContext:', error.message);
    return [];
  }

  return (data || []).map(mapTaskRow);
}

async function fetchRecentInterventionsForControlContext(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('task_interventions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(160);

  if (error) {
    console.error('[api] fetchRecentInterventionsForControlContext:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || null,
    agentId: row.agent_id || null,
    eventType: row.event_type || 'override',
    eventSource: row.event_source || 'runtime',
    tone: row.tone || 'blue',
    message: row.message || '',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    provider: row.provider || null,
    model: row.model || null,
    scheduleType: row.schedule_type || 'once',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    timestamp: row.created_at,
  }));
}

async function fetchRecentApprovalAuditForControlContext(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('approval_audit')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingTableError(error)) return [];
    console.error('[api] fetchRecentApprovalAuditForControlContext:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    reviewId: row.review_id || null,
    decision: row.decision || 'approved',
    feedback: row.feedback || '',
    createdAt: row.created_at,
  }));
}

async function fetchPendingReviewsForControlContext(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from('pending_reviews')
    .select('id,status')
    .eq('user_id', userId)
    .in('status', ['awaiting_approval', 'needs_intervention'])
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingTableError(error)) return [];
    console.error('[api] fetchPendingReviewsForControlContext:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    status: row.status || 'awaiting_approval',
  }));
}

function filterTasksForMission(tasks = [], missionId = null) {
  if (!missionId) return tasks;
  return tasks.filter((task) => task.rootMissionId === missionId || task.id === missionId);
}

function filterInterventionsForMission(interventions = [], missionId = null) {
  if (!missionId) return interventions;
  return interventions.filter((entry) => entry.rootMissionId === missionId || entry.taskId === missionId);
}

async function fetchExecutionControlContext(userId, missionId = null) {
  if (!userId) {
    return {
      tasks: [],
      interventions: [],
      logs: [],
      approvalAudit: [],
      pendingReviews: [],
      hybridApproval: { available: false, totalQueue: 0, tone: 'teal' },
      failureTriage: { available: false, failedCount: 0, tone: 'teal', nextMove: 'keep flowing' },
      executionAudit: { available: false, entries: [] },
      commanderNextMove: null,
    };
  }

  const [tasks, interventions, logs, approvalAudit, pendingReviews] = await Promise.all([
    fetchRecentTasksForControlContext(userId),
    fetchRecentInterventionsForControlContext(userId),
    fetchRecentBatchAuditLogs(userId),
    fetchRecentApprovalAuditForControlContext(userId),
    fetchPendingReviewsForControlContext(userId),
  ]);

  const scopedTasks = filterTasksForMission(tasks, missionId);
  const scopedInterventions = filterInterventionsForMission(interventions, missionId);
  const scopedReviews = missionId ? [] : pendingReviews;

  return {
    tasks: scopedTasks,
    interventions: scopedInterventions,
    logs,
    approvalAudit,
    pendingReviews: scopedReviews,
    hybridApproval: getHybridApprovalSummary({
      tasks: scopedTasks,
      reviews: scopedReviews,
      interventions: scopedInterventions,
      approvalAudit,
    }),
    failureTriage: getFailureTriageSummary({
      tasks: scopedTasks,
      interventions: scopedInterventions,
      logs,
      mission: missionId ? { id: missionId, rootMissionId: missionId } : null,
    }),
    executionAudit: getExecutionAuditReadback({
      interventions: scopedInterventions,
      approvalAudit: missionId ? [] : approvalAudit,
      logs,
      mission: missionId ? { id: missionId, rootMissionId: missionId } : null,
      limit: 8,
    }),
    commanderNextMove: getCommanderNextMove({
      tasks: scopedTasks,
      reviews: scopedReviews,
      schedules: [],
      agents: [],
      interventions: scopedInterventions,
      logs,
      approvalAudit: missionId ? [] : approvalAudit,
      costData: null,
      learningMemory: null,
    }),
  };
}

function deriveExecutionControlPosture({
  payload = {},
  executionPosture,
  missionApprovalLevel = 'risk_weighted',
  routingDecision,
  launchReadiness,
  controlContext,
}) {
  if (!executionPosture) {
    return {
      executionPosture,
      missionApprovalLevel,
      guardrails: [],
      controlOrder: null,
    };
  }

  const hybridApproval = controlContext?.hybridApproval || { totalQueue: 0, tone: 'teal' };
  const failureTriage = controlContext?.failureTriage || { failedCount: 0, tone: 'teal', nextMove: 'keep flowing' };
  const executionAudit = controlContext?.executionAudit || { entries: [] };
  const commanderNextMove = controlContext?.commanderNextMove || null;
  const latestAuditEntry = executionAudit.entries?.[0] || null;
  const latestNextMove = String(commanderNextMove?.nextMove || latestAuditEntry?.nextMove || failureTriage.nextMove || '').toLowerCase();
  const nextMoveSource = String(commanderNextMove?.source || '').toLowerCase();
  const approvalQueue = Number(hybridApproval.totalQueue || 0);
  const failureCount = Number(failureTriage.failedCount || 0);
  const severePressure = approvalQueue >= 6
    || failureCount >= 3
    || latestNextMove.includes('approval')
    || nextMoveSource === 'failure_triage';
  const moderatePressure = severePressure
    || approvalQueue >= 3
    || failureCount >= 1
    || String(failureTriage.tone || '') === 'rose'
    || latestNextMove.includes('reroute')
    || latestNextMove.includes('dependency')
    || nextMoveSource === 'grouped_connector_blocker'
    || nextMoveSource === 'connector_branch_pressure'
    || nextMoveSource === 'dispatch_pressure'
    || nextMoveSource === 'hybrid_approval';
  const cleanTrail = approvalQueue === 0
    && failureCount === 0
    && String(hybridApproval.tone || '') === 'teal'
    && !latestNextMove.includes('approval')
    && !latestNextMove.includes('reroute');

  let nextExecutionPosture = { ...executionPosture };
  let nextApprovalLevel = missionApprovalLevel;
  const guardrails = [];

  if (moderatePressure) {
    if (executionPosture.missionMode === 'do_now' && !launchReadiness?.requiresHumanGate) {
      nextExecutionPosture = {
        missionMode: 'watch_and_approve',
        shouldPlanOnly: false,
        shouldWatchAndApprove: true,
        shouldAutoDispatch: false,
      };
      guardrails.push('Hardened mission mode because approval or recovery pressure is elevated in recent control memory.');
    }

    const hardenedLevel = hardenApprovalLevel(
      nextApprovalLevel,
      severePressure ? 'human_required' : 'risk_weighted',
    );
    if (hardenedLevel !== nextApprovalLevel) {
      nextApprovalLevel = hardenedLevel;
      guardrails.push(severePressure
        ? 'Raised launch approval to human-required because recent control memory is noisy.'
        : 'Kept launch approval risk-weighted because recent control memory is still fragile.');
    }
  } else if (
    cleanTrail
    && payload.missionMode === 'do_now'
    && String(routingDecision?.riskLevel || 'medium') === 'low'
    && !launchReadiness?.requiresHumanGate
    && nextApprovalLevel === 'risk_weighted'
  ) {
    nextApprovalLevel = 'auto_low_risk';
    guardrails.push('Relaxed launch approval to auto-low-risk because recent control memory is clean and this mission is low-risk.');
  }

  return {
    executionPosture: nextExecutionPosture,
    missionApprovalLevel: nextApprovalLevel,
    guardrails,
    controlOrder: latestAuditEntry
      ? {
          label: commanderNextMove?.title || latestAuditEntry.label,
          nextMove: commanderNextMove?.nextMove || latestAuditEntry.nextMove || null,
          detail: commanderNextMove?.detail || latestAuditEntry.detail || '',
        }
      : commanderNextMove
      ? {
          label: commanderNextMove.title,
          nextMove: commanderNextMove.nextMove || null,
          detail: commanderNextMove.detail || '',
        }
      : null,
  };
}

function deriveRetryControlPosture(task = {}, controlContext = null) {
  const interventions = Array.isArray(controlContext?.interventions) ? controlContext.interventions : [];
  const related = interventions.filter((entry) => entry.rootMissionId === (task.root_mission_id || task.rootMissionId || task.id) || entry.taskId === task.id);
  const retryCount = related.filter((entry) => entry.eventType === 'retry').length;
  const rerouteCount = related.filter((entry) => ['reroute', 'interrupt_redirect', 'dependency'].includes(entry.eventType)).length;
  const stopCount = related.filter((entry) => entry.eventType === 'stop').length;
  const failureTriage = controlContext?.failureTriage || null;
  const latestNextMove = String(failureTriage?.nextMove || '').toLowerCase();
  const dispatchContract = getTaskDispatchContract({
    ...task,
    routingReason: task.routing_reason || task.routingReason || '',
    dependsOn: Array.isArray(task.depends_on) ? task.depends_on : task.dependsOn,
  }, interventions);

  if (dispatchContract === 'release_on_upstream_completion') {
    return {
      status: 'blocked',
      workflowStatus: WORKFLOW_STATUS.BLOCKED,
      lane: 'blocked',
      requiresApproval: false,
      approvalLevel: task?.approval_level || 'risk_weighted',
      triageVerdict: 'release_chain_recovery',
      nextMove: 'clear_release_chain',
      reason: 'Retry stayed blocked because this branch still depends on upstream release-chain recovery before another rerun makes sense.',
    };
  }

  const shouldGuardRetry = retryCount >= 1 && (
    rerouteCount >= 1
    || stopCount >= 1
    || latestNextMove.includes('approval')
    || latestNextMove.includes('reroute')
    || String(failureTriage?.tone || '') === 'rose'
  );

  if (!shouldGuardRetry) {
    return {
      status: 'queued',
      workflowStatus: WORKFLOW_STATUS.READY,
      lane: 'active',
      requiresApproval: false,
      approvalLevel: task?.approval_level || 'risk_weighted',
      triageVerdict: dispatchContract === 'safe_parallel_fanout' ? 'safe_parallel_recovery' : 'recovery_started',
      nextMove: dispatchContract === 'safe_parallel_fanout' ? 'watch_retry_on_safe_parallel_lane' : 'watch_retry',
      reason: dispatchContract === 'safe_parallel_fanout'
        ? 'Manual retry restarted this branch on a safe-parallel lane so recovery can continue without forcing tighter serialized drag.'
        : 'Manual retry restarted this branch on a ready lane.',
    };
  }

  return {
    status: 'needs_approval',
    workflowStatus: WORKFLOW_STATUS.WAITING_ON_HUMAN,
    lane: 'approvals',
    requiresApproval: true,
    approvalLevel: hardenApprovalLevel(task?.approval_level || 'risk_weighted', 'human_required'),
    triageVerdict: 'guarded_retry',
    nextMove: rerouteCount > 0 ? 'review_retry_or_reroute' : 'review_retry',
    reason: 'Retry was held for review because recent rescue history shows this branch needs a tighter recovery decision before rerunning.',
  };
}

async function fetchMissionCreateInterventions(userId, rootMissionId) {
  if (!userId || !rootMissionId) return [];

  const { data, error } = await supabase
    .from('task_interventions')
    .select('*')
    .eq('user_id', userId)
    .eq('root_mission_id', rootMissionId)
    .eq('event_type', 'mission_create')
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    console.error('[api] fetchMissionCreateInterventions:', error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || null,
    eventType: row.event_type || 'mission_create',
    eventSource: row.event_source || 'mission_create',
    tone: row.tone || 'teal',
    message: row.message || '',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    provider: row.provider || null,
    model: row.model || null,
    scheduleType: row.schedule_type || 'once',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    timestamp: row.created_at,
  }));
}

async function fetchRecurringAdaptiveCandidateForSchedule(userId, schedule = null) {
  if (!userId || !schedule?.name) return null;

  const [{ data: taskRows, error: taskError }, { data: interventionRows, error: interventionError }, { data: outcomeRows, error: outcomeError }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('schedule_type', 'recurring')
      .order('created_at', { ascending: false })
      .limit(180),
    supabase
      .from('task_interventions')
      .select('*')
      .eq('user_id', userId)
      .eq('schedule_type', 'recurring')
      .order('created_at', { ascending: false })
      .limit(240),
    supabase
      .from('task_outcomes')
      .select('id,task_id,root_mission_id,score')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(180),
  ]);

  if (taskError) {
    console.error('[api] fetchRecurringAdaptiveCandidateForSchedule tasks:', taskError.message);
    return null;
  }
  if (interventionError) {
    console.error('[api] fetchRecurringAdaptiveCandidateForSchedule interventions:', interventionError.message);
    return null;
  }
  if (outcomeError) {
    console.error('[api] fetchRecurringAdaptiveCandidateForSchedule outcomes:', outcomeError.message);
    return null;
  }

  const tasks = (taskRows || []).map(mapTaskRow);
  const interventions = (interventionRows || []).map((row) => ({
    id: row.id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || null,
    eventType: row.event_type || 'override',
    eventSource: row.event_source || 'runtime',
    tone: row.tone || 'blue',
    message: row.message || '',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    provider: row.provider || null,
    model: row.model || null,
    scheduleType: row.schedule_type || 'once',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    timestamp: row.created_at,
  }));
  const outcomes = (outcomeRows || []).map((row) => ({
    id: row.id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || row.task_id || null,
    score: Number(row.score || 0),
  }));

  const candidates = getAutomationCandidates(tasks, 150, interventions, outcomes);
  const scheduleName = String(schedule.name || '').trim().toLowerCase();
  return candidates.find((candidate) => {
    const candidateName = String(candidate.title || '').trim().toLowerCase();
    return scheduleName && candidateName && (
      scheduleName === candidateName
      || scheduleName.includes(candidateName)
      || candidateName.includes(scheduleName)
    );
  }) || null;
}

function applyRuntimeConfidenceBias({ routingDecision, observedWinningLane, batchSignals = null }) {
  if (!observedWinningLane) return routingDecision;

  const shouldPromoteWinningLane = observedWinningLane.confidence === 'high'
    || (observedWinningLane.confidence === 'medium' && Number(observedWinningLane.avgScore || 0) >= 78);

  if (!shouldPromoteWinningLane) {
    return routingDecision;
  }

  return {
    ...routingDecision,
    selectedProvider: observedWinningLane.provider || routingDecision.selectedProvider,
    selectedModel: observedWinningLane.model || routingDecision.selectedModel,
    selectedAgentRole: observedWinningLane.agentRole || routingDecision.selectedAgentRole,
    routingReason: `${routingDecision.routingReason} | runtime winner ${observedWinningLane.provider || 'Adaptive'} ${observedWinningLane.model || 'lane'} @ ${Math.round(observedWinningLane.avgScore || 0)} score via ${observedWinningLane.scopeLabel || 'exact'} history${observedWinningLane.batchTrustAdjustment ? ` | ${observedWinningLane.batchTrustDetail}` : ''}${batchSignals?.totalActions ? ` | ${batchSignals.totalActions} grouped batch actions informed lane trust` : ''}`,
  };
}

export async function createMission(payload, agents = []) {
  const guardedMission = enforceRecurringMissionGuardrails(payload);
  const effectivePayload = guardedMission.payload;

  if (!isSupabaseConfigured) {
    return {
      success: true,
      mission: {
        id: crypto.randomUUID(),
        title: deriveMissionTitle(effectivePayload.intent),
        name: deriveMissionTitle(effectivePayload.intent),
        description: effectivePayload.intent,
        agentId: effectivePayload.agentId,
        agentName: effectivePayload.agentName || '',
        status: 'queued',
        lane: inferLane(effectivePayload.priorityScore || 5, false, 'queued'),
        mode: effectivePayload.mode,
        progressPercent: 0,
        createdAt: new Date().toISOString(),
      },
      guardrails: guardedMission.guardrails,
    };
  }

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const title = deriveMissionTitle(effectivePayload.intent);
  const requestedSyntheticCommander = !effectivePayload.agentId || effectivePayload.agentId === SYNTHETIC_COMMANDER_ID;
  let selectedAgent = agents.find(agent => agent.id === effectivePayload.agentId) || null;
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
  const estimated = estimateMissionPlan(effectivePayload);
  const normalizedBrief = effectivePayload.planBrief || estimated.brief || null;
  const normalizedPlanSummary = effectivePayload.planSummary || estimated.planSummary || null;
  const missionBriefSummary = summarizeMissionBrief(normalizedBrief);
  const executionPlanSummary = summarizeExecutionPlan(normalizedPlanSummary);
  const combinedGuardrails = [...guardedMission.guardrails];
  const plannedBranches = Array.isArray(effectivePayload.planBranches) && effectivePayload.planBranches.length ? effectivePayload.planBranches : estimated.branches;
  const priorityScore = effectivePayload.priorityScore ?? 5;
  const scheduleType = effectivePayload.repeat ? 'recurring' : 'once';
  const runAt = effectivePayload.when === 'now' ? new Date().toISOString() : effectivePayload.runAt || null;
  const recurrenceRule = buildRecurrenceRule(effectivePayload.repeat);
  const lane = inferLane(priorityScore, false, 'queued');
  const missionId = crypto.randomUUID();
  const preliminaryRoutingDecision = deriveRoutingDecision(effectivePayload, selectedAgent, null);
  const routingPolicy = await selectRoutingPolicyRow(user, preliminaryRoutingDecision).catch((error) => {
    console.error('[api] selectRoutingPolicyRow:', error.message);
    return null;
  });
  const recentBatchAuditLogs = await fetchRecentBatchAuditLogs(user.id);
  const batchSignals = getBatchCommandSignals(recentBatchAuditLogs);
  let routingDecision = deriveRoutingDecision(effectivePayload, selectedAgent, routingPolicy);
  const observedWinningLane = await selectOutcomeWinningLane(user, routingDecision, batchSignals);
  routingDecision = applyPatternApprovalBiasWithBatch({ routingDecision, observedWinningLane, batchSignals });
  routingDecision = applyRuntimeConfidenceBias({ routingDecision, observedWinningLane, batchSignals });
  const connectedSystems = await fetchConnectedSystemsForUser(user.id);
  const launchReadiness = buildExecutionReadiness({
    payload: effectivePayload,
    routingDecision,
    connectedSystems,
  });
  if (launchReadiness.guardrails.length) {
    combinedGuardrails.push(...launchReadiness.guardrails);
  }
  const persistentLaneSignals = await fetchPersistentLaneSignals(user.id);
  const hasDelegatedSteps = plannedBranches.length > 1;
  const launchControlContext = await fetchExecutionControlContext(user.id);
  let executionPosture = applyLaunchReadinessToExecutionPosture(
    getMissionExecutionPosture(effectivePayload),
    launchReadiness,
  );
  let missionApprovalLevel = hardenApprovalLevel(
    deriveMissionApprovalLevel(
      {
        ...effectivePayload,
        missionMode: executionPosture.missionMode,
      },
      routingDecision.approvalLevel,
    ),
    launchReadiness.recommendedApprovalLevel,
  );
  const controlPosture = deriveExecutionControlPosture({
    payload: effectivePayload,
    executionPosture,
    missionApprovalLevel,
    routingDecision,
    launchReadiness,
    controlContext: launchControlContext,
  });
  executionPosture = controlPosture.executionPosture;
  missionApprovalLevel = controlPosture.missionApprovalLevel;
  if (controlPosture.guardrails.length) {
    combinedGuardrails.push(...controlPosture.guardrails);
  }
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
    description: effectivePayload.intent,
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
    agent_name: effectivePayload.agentName || selectedAgent?.name || 'Unknown',
    mode: effectivePayload.mode,
    output_type: effectivePayload.outputType,
    output_spec: effectivePayload.outputSpec || null,
    target_type: effectivePayload.targetType,
    target_identifier: effectivePayload.targetIdentifier || null,
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
    routing_reason: `${routingDecision.routingReason} | skills ${(routingDecision.recommendedSkillNames || []).join(', ') || 'none'} | mission mode ${executionPosture.missionMode.replaceAll('_', ' ')}${scheduleType === 'recurring' ? ` | recurring approval ${missionApprovalLevel.replaceAll('_', ' ')}` : ''}${routingDecision.approvalBiasDetail ? ` | ${routingDecision.approvalBiasDetail}` : ''}${missionBriefSummary ? ` | brief ${missionBriefSummary}` : ''}${executionPlanSummary ? ` | plan ${executionPlanSummary}` : ''}${launchReadiness.summary ? ` | readiness ${launchReadiness.summary}` : ''}${launchReadiness.fallbackStrategy ? ` | fallback ${launchReadiness.fallbackStrategy.replaceAll('_', ' ')}` : ''}${controlPosture.controlOrder?.nextMove ? ` | control order ${String(controlPosture.controlOrder.nextMove).replaceAll('_', ' ')}` : ''}`,
    domain: routingDecision.domain,
    intent_type: routingDecision.intentType,
    budget_class: routingDecision.budgetClass,
    risk_level: routingDecision.riskLevel,
    context_pack_ids: routingDecision.contextPackIds,
    required_capabilities: routingDecision.requiredCapabilities,
    approval_level: missionApprovalLevel,
    depends_on: [],
    agent_role: 'commander',
    execution_strategy: hasDelegatedSteps ? 'graph_root' : 'sequential',
    branch_label: 'Root Mission',
    provider_override: routingDecision.selectedProvider || null,
    model_override: routingDecision.selectedModel || null,
    requires_approval: !hasDelegatedSteps && executionPosture.shouldWatchAndApprove,
  };

  const subtaskRows = await buildMissionSubtasks({
    missionId,
    userId: user.id,
    user,
    title,
    payload: { ...effectivePayload, missionMode: executionPosture.missionMode, priorityScore, agents, routingPolicy, selectedAgent, commander, launchReadiness, controlContext: launchControlContext },
    branches: plannedBranches.map((branch) => ({ ...branch })),
    assignedAgentId,
    agentName: effectivePayload.agentName || selectedAgent?.name || 'Unknown',
    commanderId,
    estimatedCostCents: estimated.estimatedCostCents,
    routingPolicyId: routingPolicy?.id || null,
    routingDecision,
    observedWinningLane,
    persistentLaneSignals,
    missionBrief: normalizedBrief,
    planSummary: normalizedPlanSummary,
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
      agent_name: effectivePayload.agentName || selectedAgent?.name || 'Unknown',
      duration_ms: 0,
      cost_usd: 0,
      prompt_text: effectivePayload.intent,
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
        description: effectivePayload.intent,
        mode: effectivePayload.mode,
        lane,
        priority: priorityScore,
        workflow_status: workflowStatus,
        node_type: 'mission',
        root_mission_id: missionId,
        routing_policy_id: routingPolicy?.id || null,
        routing_reason: `${routingDecision.routingReason}${missionBriefSummary ? ` | brief ${missionBriefSummary}` : ''}${executionPlanSummary ? ` | plan ${executionPlanSummary}` : ''}`,
        domain: routingDecision.domain,
        intent_type: routingDecision.intentType,
        budget_class: routingDecision.budgetClass,
        risk_level: routingDecision.riskLevel,
        context_pack_ids: [],
        required_capabilities: routingDecision.requiredCapabilities,
        approval_level: missionApprovalLevel,
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
        taskDescription: effectivePayload.intent,
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
        taskDescription: subtask.description || subtask.title || subtask.name || effectivePayload.intent,
      })));
    } catch (dispatchError) {
      console.error('[api] createMission subtask dispatch:', dispatchError.message);
      throw dispatchError;
    }
  }

  const activityMessage = scheduleType === 'recurring'
    ? `Mission queued: ${title} • recurring ${effectivePayload.repeat.frequency} at ${effectivePayload.repeat.time}`
    : executionPosture.shouldWatchAndApprove
      ? `Mission staged for approval: ${title}`
      : executionPosture.shouldPlanOnly
        ? `Mission planned: ${title}`
        : effectivePayload.when === 'now' && assignedAgentId
      ? `Mission dispatched: ${title}`
      : `Mission queued: ${title}`;
  const activityDetail = [
    missionBriefSummary,
    executionPlanSummary,
    launchReadiness.summary,
    controlPosture.controlOrder?.nextMove ? `control ${String(controlPosture.controlOrder.nextMove).replaceAll('_', ' ')}` : null,
  ].filter(Boolean).join(' | ');

  const { error: activityError } = await supabase.from('activity_log').insert({
    user_id: user.id,
    type: 'SYS',
    message: activityDetail ? `${activityMessage} [mission-brief] ${activityDetail}` : activityMessage,
    agent_id: assignedAgentId,
    duration_ms: 0,
    tokens: 0,
  });

  if (activityError) {
    console.error('[api] createMission activity_log:', activityError.message);
  }

  if (combinedGuardrails.length) {
    const guardrailMessage = `[automation-guardrail] ${title} on root ${missionId} -> ${combinedGuardrails.join(' ')}`;
    await logBranchEvent({
      userId: user.id,
      agentId: assignedAgentId,
      message: guardrailMessage,
    });
    await persistTaskIntervention({
      userId: user.id,
      taskId: missionId,
      rootMissionId: missionId,
      agentId: assignedAgentId,
      eventType: 'guardrail',
      eventSource: 'mission_create',
      tone: 'amber',
      message: guardrailMessage,
      domain: routingDecision.domain,
      intentType: routingDecision.intentType,
      scheduleType,
      metadata: {
        missionMode: executionPosture.missionMode,
        guardrails: combinedGuardrails,
        budgetClass: routingDecision.budgetClass,
        riskLevel: routingDecision.riskLevel,
        launchReadiness,
      },
    });
  }

  await persistTaskIntervention({
    userId: user.id,
    taskId: missionId,
    rootMissionId: missionId,
    agentId: assignedAgentId,
    eventType: 'mission_create',
    eventSource: 'mission_create',
    tone: executionPosture.shouldWatchAndApprove ? 'amber' : 'teal',
    message: `[mission-create] ${title} on root ${missionId}${missionBriefSummary ? ` | ${missionBriefSummary}` : ''}${executionPlanSummary ? ` | ${executionPlanSummary}` : ''}`,
    domain: routingDecision.domain,
    intentType: routingDecision.intentType,
    provider: routingDecision.selectedProvider || null,
    model: routingDecision.selectedModel || null,
    scheduleType,
    metadata: {
      missionMode: executionPosture.missionMode,
      objective: normalizedBrief?.objective || effectivePayload.intent,
      successDefinition: normalizedBrief?.successDefinition || null,
      domain: normalizedBrief?.domain || routingDecision.domain,
      intentType: normalizedBrief?.intentType || routingDecision.intentType,
      riskLevel: normalizedBrief?.riskLevel || routingDecision.riskLevel,
      approvalPosture: normalizedBrief?.approvalPosture || routingDecision.approvalLevel,
      costPosture: normalizedBrief?.costPosture || routingDecision.budgetClass,
      constraints: Array.isArray(normalizedBrief?.constraints) ? normalizedBrief.constraints : [],
      branchCount: normalizedPlanSummary?.branchCount ?? plannedBranches.length,
      strategy: normalizedPlanSummary?.primaryStrategy || row.execution_strategy,
      dependencyPosture: normalizedPlanSummary?.dependencyPosture || null,
      verificationRequirement: normalizedPlanSummary?.verificationRequirement || null,
      specialistRoles: Array.isArray(normalizedPlanSummary?.specialistRoles) ? normalizedPlanSummary.specialistRoles : [],
      launchReadiness,
      controlOrder: controlPosture.controlOrder,
    },
  });

  return {
    success: true,
    mission: mapTaskRow({ ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), planBrief: normalizedBrief, planSummary: normalizedPlanSummary }),
    subtasks: subtaskRows.map((subtask) => mapTaskRow({ ...subtask, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), planBrief: normalizedBrief, planSummary: normalizedPlanSummary })),
    guardrails: combinedGuardrails,
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
  const released = await releaseDependencyReadyTasks({ user, tasks });
  const currentTasks = released > 0
    ? await fetchTasks()
    : tasks;
  const blockedReviewAgentIds = new Set(reviews.map((review) => review.agentId).filter(Boolean));
  const busyAgentIds = new Set(
    agents
      .filter((agent) => agent.status === 'processing')
      .map((agent) => agent.id)
      .filter(Boolean)
  );
  const runningRootCounts = currentTasks.reduce((acc, task) => {
    if (task.status !== 'running') return acc;
    const rootMissionId = task.rootMissionId || task.id;
    acc.set(rootMissionId, (acc.get(rootMissionId) || 0) + 1);
    return acc;
  }, new Map());
  const dispatchedRootCounts = new Map();

  const runnableTasks = currentTasks
    .filter((task) => {
      if (task.status !== 'queued') return false;
      if (task.requiresApproval) return false;
      const dependencies = Array.isArray(task.dependsOn) ? task.dependsOn : [];
      if (dependencies.length > 0) {
        const dependencyRows = dependencies.map((dependencyId) => currentTasks.find((candidate) => candidate.id === dependencyId)).filter(Boolean);
        if (dependencyRows.length !== dependencies.length) return false;
        if (!dependencyRows.every((dependency) => isCompletedDependencyTask(dependency))) return false;
      }
      const dueAt = task.runAt ? new Date(task.runAt).getTime() : now;
      if (Number.isNaN(dueAt) || dueAt > now) return false;
      const effectiveAgentId = task.agentId || commander.id;
      if (!effectiveAgentId) return false;
      if (blockedReviewAgentIds.has(effectiveAgentId)) return false;
      if (busyAgentIds.has(effectiveAgentId)) return false;
      return true;
    })
    .map((task) => ({
      ...task,
      dispatchSafety: getTaskDispatchSafety(task),
    }))
    .sort((a, b) => {
      const safetyDelta = Number(b.dispatchSafety?.priorityBoost || 0) - Number(a.dispatchSafety?.priorityBoost || 0);
      if (safetyDelta !== 0) return safetyDelta;
      const priorityDelta = Number(b.priority || 0) - Number(a.priority || 0);
      if (priorityDelta !== 0) return priorityDelta;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

  let dispatched = 0;

  for (const task of runnableTasks) {
    const effectiveAgentId = task.agentId || commander.id;
    if (!effectiveAgentId || busyAgentIds.has(effectiveAgentId)) continue;
    const rootMissionId = task.rootMissionId || task.id;
    const siblingRunningCount = runningRootCounts.get(rootMissionId) || 0;
    const siblingDispatchedCount = dispatchedRootCounts.get(rootMissionId) || 0;
    const canFanOut = Boolean(task.dispatchSafety?.parallelSafe);
    if (!canFanOut && (siblingRunningCount > 0 || siblingDispatchedCount > 0)) continue;

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
      dispatchedRootCounts.set(rootMissionId, siblingDispatchedCount + 1);
      runningRootCounts.set(rootMissionId, siblingRunningCount + 1);
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

  return { dispatched, scanned: runnableTasks.length, released };
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

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');
  const { data: task } = await supabase
    .from('tasks')
    .select('id,title,name,status,agent_id,root_mission_id,domain,intent_type,provider_override,model_override,schedule_type,approval_level,requires_approval')
    .eq('id', taskId)
    .maybeSingle();
  const laneDefaults = await inferAgentLaneDefaults(task?.agent_id || null);
  const controlContext = await fetchExecutionControlContext(user.id, task?.root_mission_id || taskId);
  const retryPosture = deriveRetryControlPosture(task, controlContext);

  const { error } = await supabase
    .from('tasks')
    .update({
      status: retryPosture.status,
      workflow_status: retryPosture.workflowStatus,
      lane: retryPosture.lane,
      duration_ms: 0,
      cost_usd: 0,
      actual_cost_cents: 0,
      progress_percent: 0,
      failed_at: null,
      cancelled_at: null,
      requires_approval: retryPosture.requiresApproval,
      approval_level: retryPosture.approvalLevel,
      provider_override: task?.provider_override || laneDefaults.provider || null,
      model_override: task?.model_override || laneDefaults.model || null,
    })
    .eq('id', taskId);

  if (error) {
    console.error('[api] retryTask:', error.message);
    throw error;
  }
  const message = `[intervention-retry] ${(task?.title || task?.name || taskId)} (${taskId}) on root ${task?.root_mission_id || taskId} was manually rerun.`;
  await logBranchEvent({
    userId: user.id,
    agentId: task?.agent_id || null,
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: task?.root_mission_id || taskId,
    agentId: task?.agent_id || null,
    eventType: 'retry',
    eventSource: 'manual',
    tone: 'amber',
    message,
    domain: task?.domain || 'general',
    intentType: task?.intent_type || 'general',
    provider: task?.provider_override || null,
    model: task?.model_override || null,
    scheduleType: task?.schedule_type || 'once',
    metadata: buildExecutionControlMetadata({
      controlCategory: 'recovery',
      actionType: 'retry',
      triageVerdict: retryPosture.triageVerdict,
      nextMove: retryPosture.nextMove,
      previousStatus: task?.status || 'failed',
      nextStatus: retryPosture.status,
      previousApprovalLevel: task?.approval_level || 'risk_weighted',
      nextApprovalLevel: retryPosture.approvalLevel,
      approvalState: retryPosture.requiresApproval ? 'waiting' : 'not_required',
      reason: retryPosture.reason,
    }),
  });
  return { success: true, taskId };
}

export async function stopTask(taskId) {
  if (!isSupabaseConfigured) return { success: true };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');
  const { data: task } = await supabase
    .from('tasks')
    .select('id,title,name,status,agent_id,root_mission_id,domain,intent_type,provider_override,model_override,schedule_type,approval_level,requires_approval')
    .eq('id', taskId)
    .maybeSingle();

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
  const message = `[intervention-stop] ${(task?.title || task?.name || taskId)} (${taskId}) on root ${task?.root_mission_id || taskId} was manually stopped.`;
  await logBranchEvent({
    userId: user.id,
    agentId: task?.agent_id || null,
    type: 'ERR',
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: task?.root_mission_id || taskId,
    agentId: task?.agent_id || null,
    eventType: 'stop',
    eventSource: 'manual',
    tone: 'rose',
    message,
    domain: task?.domain || 'general',
    intentType: task?.intent_type || 'general',
    provider: task?.provider_override || null,
    model: task?.model_override || null,
    scheduleType: task?.schedule_type || 'once',
    metadata: buildExecutionControlMetadata({
      controlCategory: 'recovery',
      actionType: 'stop',
      triageVerdict: 'human_hold',
      nextMove: 'investigate_failure',
      previousStatus: task?.status || 'running',
      nextStatus: 'failed',
      previousApprovalLevel: task?.approval_level || 'risk_weighted',
      nextApprovalLevel: task?.approval_level || 'risk_weighted',
      approvalState: task?.requires_approval ? 'approval_retained' : 'not_required',
      reason: 'Manual stop moved this branch into a held failure state for triage.',
    }),
  });
  return { success: true, taskId };
}

export async function recordBatchCommandEvent({ actionType = 'batch', tasks = [], targetAgent = null } = {}) {
  if (!isSupabaseConfigured || !Array.isArray(tasks) || tasks.length === 0) return { success: true };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const normalizedAction = String(actionType || 'batch').toLowerCase();
  const summaryTitles = tasks
    .slice(0, 3)
    .map((task) => task?.title || task?.name || task?.id)
    .filter(Boolean);
  const summaryLabel = summaryTitles.join(', ');
  const remainder = tasks.length > 3 ? ` +${tasks.length - 3} more` : '';
  const roots = [...new Set(tasks.map((task) => task?.rootMissionId || task?.root_mission_id || task?.id).filter(Boolean))];

  const message = `[batch-intervention-${normalizedAction}] ${tasks.length} branch${tasks.length === 1 ? '' : 'es'} handled from the bridge${targetAgent?.name ? ` toward ${targetAgent.name}` : ''}: ${summaryLabel}${remainder}. Roots: ${roots.join(', ') || 'unknown'}.`;
  const type = normalizedAction === 'approve'
    ? 'OK'
    : normalizedAction === 'stop'
      ? 'ERR'
      : 'SYS';

  await logBranchEvent({
    userId: user.id,
    agentId: targetAgent?.id || tasks[0]?.agentId || tasks[0]?.agent_id || null,
    type,
    message,
  });

  await Promise.all(tasks.map((task) => persistExecutionControlEvent({
    userId: user.id,
    task,
    agentId: targetAgent?.id || task?.agentId || task?.agent_id || null,
    eventType: normalizedAction,
    eventSource: 'batch_bridge',
    tone: normalizedAction === 'stop' ? 'rose' : normalizedAction === 'approve' ? 'amber' : 'blue',
    message,
    domain: task?.domain || 'general',
    intentType: task?.intentType || task?.intent_type || 'general',
    provider: task?.providerOverride || task?.provider_override || null,
    model: task?.modelOverride || task?.model_override || null,
    scheduleType: task?.scheduleType || task?.schedule_type || 'once',
    metadata: buildExecutionControlMetadata({
      controlCategory: normalizedAction === 'approve' ? 'approval' : normalizedAction === 'retry' || normalizedAction === 'stop' ? 'recovery' : 'batch',
      actionType: normalizedAction,
      triageVerdict: normalizedAction === 'approve'
        ? 'released'
        : normalizedAction === 'retry'
          ? 'recovery_started'
          : normalizedAction === 'stop'
            ? 'human_hold'
            : 'batched',
      nextMove: normalizedAction === 'approve'
        ? 'dispatch_ready_work'
        : normalizedAction === 'retry'
          ? 'watch_retry'
          : normalizedAction === 'stop'
            ? 'investigate_failure'
            : 'review_batch_effect',
      previousStatus: task?.status || null,
      nextStatus: normalizedAction === 'approve' || normalizedAction === 'retry'
        ? 'queued'
        : normalizedAction === 'stop'
          ? 'failed'
          : task?.status || null,
      previousApprovalLevel: task?.approvalLevel || task?.approval_level || null,
      nextApprovalLevel: task?.approvalLevel || task?.approval_level || null,
      approvalState: normalizedAction === 'approve'
        ? 'released'
        : task?.requiresApproval || task?.requires_approval
          ? 'waiting'
          : 'not_required',
      batchSize: tasks.length,
      batchRoots: roots,
      targetAgent,
      reason: `Bridge batch ${normalizedAction} handled ${tasks.length} branches together.`,
      extra: {
        isBatchAction: true,
      },
    }),
  })));

  return { success: true, message };
}

export async function interruptAndRedirectTask(taskId, updates = {}, agents = []) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id,title,name,priority,status,agent_id,agent_name,root_mission_id,domain,intent_type,provider_override,model_override,schedule_type,routing_reason')
    .eq('id', taskId)
    .single();

  if (fetchError) {
    console.error('[api] interruptAndRedirectTask fetch:', fetchError.message);
    throw fetchError;
  }

  const requestedAgent = Object.prototype.hasOwnProperty.call(updates, 'agentId')
    ? agents.find((agent) => agent.id === updates.agentId) || null
    : null;
  const laneDefaults = requestedAgent
    ? {
        provider: inferAgentProvider(requestedAgent) || null,
        model: requestedAgent.model || null,
      }
    : await inferAgentLaneDefaults(task.agent_id || null);

  const patch = {
    status: 'queued',
    workflow_status: WORKFLOW_STATUS.READY,
    lane: inferLane(task.priority ?? 5, false, 'queued'),
    duration_ms: 0,
    cost_usd: 0,
    actual_cost_cents: 0,
    progress_percent: 0,
    failed_at: null,
    cancelled_at: null,
    requires_approval: false,
    updated_at: new Date().toISOString(),
    agent_id: Object.prototype.hasOwnProperty.call(updates, 'agentId') ? (updates.agentId || null) : task.agent_id,
    agent_name: Object.prototype.hasOwnProperty.call(updates, 'agentId')
      ? (requestedAgent?.name || 'Unassigned')
      : (task.agent_name || 'Unassigned'),
    provider_override: Object.prototype.hasOwnProperty.call(updates, 'providerOverride')
      ? (updates.providerOverride || null)
      : (requestedAgent ? laneDefaults.provider : (task.provider_override || laneDefaults.provider || null)),
    model_override: Object.prototype.hasOwnProperty.call(updates, 'modelOverride')
      ? (updates.modelOverride || null)
      : (requestedAgent ? laneDefaults.model : (task.model_override || laneDefaults.model || null)),
  };

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId);

  if (error) {
    console.error('[api] interruptAndRedirectTask:', error.message);
    throw error;
  }

  const message = `[intervention-redirect] ${task.title || task.name || taskId} (${taskId}) on root ${task.root_mission_id || taskId} was interrupted from ${task.status || 'active'} and redirected to ${patch.agent_name || 'Unassigned'}, provider ${patch.provider_override || 'default'}, model ${patch.model_override || 'default'}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: patch.agent_id || task.agent_id || null,
    type: 'SYS',
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: task.root_mission_id || taskId,
    agentId: patch.agent_id || task.agent_id || null,
    eventType: 'interrupt_redirect',
    eventSource: 'manual',
    tone: 'blue',
    message,
    domain: task.domain || 'general',
    intentType: task.intent_type || 'general',
    provider: patch.provider_override || null,
    model: patch.model_override || null,
    scheduleType: task.schedule_type || 'once',
    metadata: {
      ...buildExecutionControlMetadata({
        controlCategory: 'routing',
        actionType: 'redirect',
        triageVerdict: 'rerouted',
        nextMove: 'watch_new_lane',
        previousStatus: task.status || null,
        nextStatus: 'queued',
        reason: 'Manual redirect moved this branch to a new agent or model lane.',
      }),
      previousStatus: task.status || null,
      previousAgentId: task.agent_id || null,
      nextAgentId: patch.agent_id || task.agent_id || null,
      previousProvider: task.provider_override || null,
      previousModel: task.model_override || null,
      nextProvider: patch.provider_override || null,
      nextModel: patch.model_override || null,
      previousRoutingReason: task.routing_reason || '',
    },
  });

  return { success: true, taskId };
}

export async function updateMissionBranchRouting(taskId, updates = {}, agents = []) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: currentTask, error: taskError } = await supabase
    .from('tasks')
    .select('id,title,name,agent_id,agent_name,root_mission_id,provider_override,model_override,domain,intent_type,schedule_type')
    .eq('id', taskId)
    .single();

  if (taskError) {
    console.error('[api] updateMissionBranchRouting fetch:', taskError.message);
    throw taskError;
  }

  const patch = {
    updated_at: new Date().toISOString(),
  };
  const requestedAgent = Object.prototype.hasOwnProperty.call(updates, 'agentId')
    ? agents.find((agent) => agent.id === updates.agentId) || null
    : null;

  if (Object.prototype.hasOwnProperty.call(updates, 'agentId')) {
    patch.agent_id = updates.agentId || null;
    patch.agent_name = requestedAgent?.name || 'Unassigned';
    if (!Object.prototype.hasOwnProperty.call(updates, 'providerOverride') && requestedAgent) {
      patch.provider_override = inferAgentProvider(requestedAgent) || null;
    }
    if (!Object.prototype.hasOwnProperty.call(updates, 'modelOverride') && requestedAgent?.model) {
      patch.model_override = requestedAgent.model || null;
    }
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

  const nextAgent = requestedAgent || agents.find((agent) => agent.id === (patch.agent_id || currentTask.agent_id)) || null;
  const message = `[branch-routing] ${currentTask.title || currentTask.name || taskId} (${taskId}) on root ${currentTask.root_mission_id || taskId} -> agent ${nextAgent?.name || patch.agent_name || currentTask.agent_name || 'Unassigned'}, provider ${patch.provider_override ?? currentTask.provider_override ?? 'default'}, model ${patch.model_override ?? currentTask.model_override ?? 'default'}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: patch.agent_id || currentTask.agent_id || null,
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: currentTask.root_mission_id || taskId,
    agentId: patch.agent_id || currentTask.agent_id || null,
    eventType: 'reroute',
    eventSource: 'manual',
    tone: 'teal',
    message,
    domain: currentTask.domain || 'general',
    intentType: currentTask.intent_type || 'general',
    provider: patch.provider_override ?? currentTask.provider_override ?? null,
    model: patch.model_override ?? currentTask.model_override ?? null,
    scheduleType: currentTask.schedule_type || 'once',
    metadata: {
      ...buildExecutionControlMetadata({
        controlCategory: 'routing',
        actionType: 'reroute',
        triageVerdict: 'rerouted',
        nextMove: 'watch_new_lane',
        reason: 'Branch routing was manually updated to a safer or stronger lane.',
      }),
      previousAgentId: currentTask.agent_id || null,
      nextAgentId: patch.agent_id || currentTask.agent_id || null,
      inheritedProvider: patch.provider_override ?? currentTask.provider_override ?? inferAgentProvider(nextAgent) ?? null,
      inheritedModel: patch.model_override ?? currentTask.model_override ?? nextAgent?.model ?? null,
    },
  });

  return { success: true, taskId };
}

export async function updateMissionBranchDependencies(taskId, dependsOn = []) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: currentTask, error: taskError } = await supabase
    .from('tasks')
    .select('id,title,name,agent_id,root_mission_id,domain,intent_type,provider_override,model_override,schedule_type')
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

  const message = `[branch-dependency] ${currentTask.title || currentTask.name || taskId} (${taskId}) on root ${currentTask.root_mission_id || taskId} now depends on ${normalizedDependencies.length ? normalizedDependencies.join(', ') : 'no branches'}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: currentTask.agent_id || null,
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: currentTask.root_mission_id || taskId,
    agentId: currentTask.agent_id || null,
    eventType: 'dependency',
    eventSource: 'manual',
    tone: 'amber',
    message,
    domain: currentTask.domain || 'general',
    intentType: currentTask.intent_type || 'general',
    provider: currentTask.provider_override || null,
    model: currentTask.model_override || null,
    scheduleType: currentTask.schedule_type || 'once',
    metadata: {
      ...buildExecutionControlMetadata({
        controlCategory: 'routing',
        actionType: 'dependency',
        triageVerdict: normalizedDependencies.length > 0 ? 'held_for_dependency' : 'dependency_cleared',
        nextMove: normalizedDependencies.length > 0 ? 'wait_for_upstream' : 'resume_when_ready',
        reason: 'Dependency posture was manually adjusted for this branch.',
      }),
      dependsOn: normalizedDependencies,
    },
  });

  return { success: true, taskId };
}

export async function approveMissionTask(taskId) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, agent_id, title, priority, status, root_mission_id, domain, intent_type, provider_override, model_override, schedule_type, approval_level, requires_approval')
    .eq('id', taskId)
    .single();
  const laneDefaults = await inferAgentLaneDefaults(task?.agent_id || null);

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'queued',
      workflow_status: WORKFLOW_STATUS.READY,
      lane: inferLane(task.priority ?? 5, false, 'queued'),
      requires_approval: false,
      provider_override: task.provider_override || laneDefaults.provider || null,
      model_override: task.model_override || laneDefaults.model || null,
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
  const message = `[intervention-approve] ${task.title || task.id} (${taskId}) on root ${task.root_mission_id || taskId} was approved to continue.`;
  await logBranchEvent({
    userId: user.id,
    agentId: task.agent_id,
    type: 'OK',
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: task.root_mission_id || taskId,
    agentId: task.agent_id,
    eventType: 'approve',
    eventSource: 'manual',
    tone: 'amber',
    message,
    domain: task.domain || 'general',
    intentType: task.intent_type || 'general',
    provider: task.provider_override || null,
    model: task.model_override || null,
    scheduleType: task.schedule_type || 'once',
    metadata: buildExecutionControlMetadata({
      controlCategory: 'approval',
      actionType: 'approve',
      triageVerdict: 'released',
      nextMove: 'dispatch_ready_work',
      previousStatus: task.status || 'needs_approval',
      nextStatus: 'queued',
      previousApprovalLevel: task.approval_level || 'risk_weighted',
      nextApprovalLevel: task.approval_level || 'risk_weighted',
      approvalState: 'released',
      reason: 'Human approval released this branch back into execution.',
    }),
  });

  return { success: true, taskId };
}

export async function cancelMissionTask(taskId) {
  if (!isSupabaseConfigured) return { success: true, taskId };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('id, agent_id, title, status, root_mission_id, domain, intent_type, provider_override, model_override, schedule_type, approval_level, requires_approval')
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
  const message = `[intervention-cancel] ${task.title || task.id} (${taskId}) on root ${task.root_mission_id || taskId} was cancelled by a human gate.`;
  await logBranchEvent({
    userId: user.id,
    agentId: task.agent_id,
    type: 'ERR',
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: task.root_mission_id || taskId,
    agentId: task.agent_id,
    eventType: 'cancel',
    eventSource: 'manual',
    tone: 'rose',
    message,
    domain: task.domain || 'general',
    intentType: task.intent_type || 'general',
    provider: task.provider_override || null,
    model: task.model_override || null,
    scheduleType: task.schedule_type || 'once',
    metadata: buildExecutionControlMetadata({
      controlCategory: 'approval',
      actionType: 'cancel',
      triageVerdict: 'cancelled_by_human',
      nextMove: 'review_scope',
      previousStatus: task.status || 'needs_approval',
      nextStatus: 'cancelled',
      previousApprovalLevel: task.approval_level || 'risk_weighted',
      nextApprovalLevel: task.approval_level || 'risk_weighted',
      approvalState: 'rejected',
      reason: 'Human gate cancelled the branch instead of releasing it.',
    }),
  });

  return { success: true, taskId };
}

export async function updateRecurringMissionFlow(taskId, updates = {}) {
  if (!isSupabaseConfigured) return { success: true, taskId, guardrails: [] };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const { data: currentTask, error: fetchError } = await supabase
    .from('tasks')
    .select('id,title,name,priority,root_mission_id,agent_id,domain,intent_type,provider_override,model_override,schedule_type,recurrence_rule,approval_level,requires_approval')
    .eq('id', taskId)
    .single();

  if (fetchError) throw fetchError;

  const missionCreateInterventions = await fetchMissionCreateInterventions(user.id, currentTask.root_mission_id || currentTask.id);
  const launchBrief = getMissionCreateBrief(missionCreateInterventions, {
    id: currentTask.id,
    rootMissionId: currentTask.root_mission_id || currentTask.id,
    domain: currentTask.domain || 'general',
    intentType: currentTask.intent_type || 'general',
    approvalLevel: currentTask.approval_level || 'risk_weighted',
  });

  const existingRepeat = currentTask.recurrence_rule || {};
  const requestedRepeat = {
    frequency: updates.frequency || existingRepeat.frequency || 'weekly',
    time: updates.time || existingRepeat.time || '09:00',
    endDate: updates.endDate ?? existingRepeat.endDate ?? null,
    missionMode: updates.missionMode || existingRepeat.missionMode || 'watch_and_approve',
    approvalPosture: updates.approvalPosture || existingRepeat.approvalPosture || currentTask.approval_level || 'risk_weighted',
    paused: updates.paused ?? existingRepeat.paused ?? false,
  };
  const automationCandidate = {
    ...(updates.automationCandidate || {
      domain: currentTask.domain || 'general',
      roi: updates.roi || 0,
      runs: updates.runs || 0,
    }),
    launchBrief: updates.automationCandidate?.launchBrief || launchBrief || null,
  };

  const { payload: guardedPayload, guardrails } = enforceRecurringMissionGuardrails({
    repeat: requestedRepeat,
    missionMode: requestedRepeat.missionMode,
    targetType: currentTask.domain || 'general',
    outputType: updates.outputType || 'summary',
    automationCandidate,
  });

  const effectiveRepeat = {
    ...requestedRepeat,
    frequency: guardedPayload.repeat?.frequency || requestedRepeat.frequency,
    time: guardedPayload.repeat?.time || requestedRepeat.time,
    endDate: guardedPayload.repeat?.endDate ?? requestedRepeat.endDate,
    missionMode: guardedPayload.missionMode || requestedRepeat.missionMode,
    approvalPosture: requestedRepeat.approvalPosture,
    paused: requestedRepeat.paused,
  };
  const nextState = deriveRecurringFlowState({
    missionMode: effectiveRepeat.missionMode,
    approvalPosture: effectiveRepeat.approvalPosture,
    paused: effectiveRepeat.paused,
    priority: currentTask.priority ?? 5,
  });
  const nextRunAt = effectiveRepeat.paused || nextState.status !== 'queued'
    ? null
    : computeNextRecurringRunAt(effectiveRepeat);

  const patch = {
    schedule_type: 'recurring',
    recurrence_rule: buildRecurrenceRule(effectiveRepeat),
    run_at: nextRunAt,
    status: nextState.status,
    workflow_status: nextState.workflowStatus,
    lane: nextState.lane,
    requires_approval: nextState.requiresApproval,
    approval_level: nextState.approvalLevel,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId);

  if (error) throw error;

  const message = `[automation-tuning] ${(currentTask.title || currentTask.name || taskId)} (${taskId}) on root ${currentTask.root_mission_id || taskId} -> ${effectiveRepeat.frequency} at ${effectiveRepeat.time}, mission mode ${effectiveRepeat.missionMode.replaceAll('_', ' ')}, approval ${effectiveRepeat.approvalPosture}, ${effectiveRepeat.paused ? 'paused' : 'active'}.`;
  await logBranchEvent({
    userId: user.id,
    agentId: currentTask.agent_id || null,
    message,
  });
  await persistTaskIntervention({
    userId: user.id,
    taskId,
    rootMissionId: currentTask.root_mission_id || taskId,
    agentId: currentTask.agent_id || null,
    eventType: 'tuning',
    eventSource: 'manual',
    tone: 'blue',
    message,
    domain: currentTask.domain || 'general',
    intentType: currentTask.intent_type || 'general',
    provider: currentTask.provider_override || null,
    model: currentTask.model_override || null,
    scheduleType: 'recurring',
    metadata: {
      ...buildExecutionControlMetadata({
        controlCategory: 'automation',
        actionType: 'tuning',
        triageVerdict: 'posture_updated',
        nextMove: 'watch_recurring_flow',
        previousApprovalLevel: currentTask.approval_level || 'risk_weighted',
        nextApprovalLevel: nextState.approvalLevel,
        approvalState: nextState.requiresApproval ? 'waiting' : 'not_required',
        reason: 'Recurring mission posture was tuned and should be monitored against trust recovery.',
      }),
      frequency: effectiveRepeat.frequency,
      time: effectiveRepeat.time,
      missionMode: effectiveRepeat.missionMode,
      approvalPosture: effectiveRepeat.approvalPosture,
      paused: effectiveRepeat.paused,
      nextRunAt,
      guardrails,
    },
  });

  if (guardrails.length) {
    const guardrailMessage = `[automation-guardrail] ${(currentTask.title || currentTask.name || taskId)} on root ${currentTask.root_mission_id || taskId} -> ${guardrails.join(' ')}`;
    await logBranchEvent({
      userId: user.id,
      agentId: currentTask.agent_id || null,
      message: guardrailMessage,
    });
    await persistTaskIntervention({
      userId: user.id,
      taskId,
      rootMissionId: currentTask.root_mission_id || taskId,
      agentId: currentTask.agent_id || null,
      eventType: 'guardrail',
      eventSource: 'manual',
      tone: 'amber',
      message: guardrailMessage,
      domain: currentTask.domain || 'general',
      intentType: currentTask.intent_type || 'general',
      provider: currentTask.provider_override || null,
      model: currentTask.model_override || null,
      scheduleType: 'recurring',
      metadata: {
        guardrails,
      },
    });
  }

  return {
    success: true,
    taskId,
    guardrails,
    nextRunAt,
    recurrenceRule: patch.recurrence_rule,
    status: patch.status,
  };
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

function getScratchpadDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function fetchScratchpadNote(workspaceId) {
  if (!isSupabaseConfigured || !workspaceId) return null;

  const noteDate = getScratchpadDateKey();
  const { data, error } = await supabase
    .from('scratchpad_notes')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('note_date', noteDate)
    .maybeSingle();

  if (error) {
    console.error('[api] fetchScratchpadNote:', error.message);
    return null;
  }

  if (!data) return null;
  return {
    id: data.id,
    workspaceId: data.workspace_id,
    noteDate: data.note_date,
    content: data.content || '',
    updatedAt: data.updated_at,
  };
}

export async function upsertScratchpadNote(workspaceId, content) {
  if (!isSupabaseConfigured || !workspaceId) return { success: true };

  const user = (await supabase.auth.getUser()).data?.user;
  if (!user) throw new Error('Not authenticated');

  const payload = {
    user_id: user.id,
    workspace_id: workspaceId,
    note_date: getScratchpadDateKey(),
    content,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('scratchpad_notes')
    .upsert(payload, { onConflict: 'workspace_id,note_date' });

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
  const laneDefaults = await inferAgentLaneDefaults(schedule.agentId);
  const recurringCandidate = await fetchRecurringAdaptiveCandidateForSchedule(user.id, schedule);
  const recurringAdaptiveControl = getRecurringAdaptiveControlSummary(recurringCandidate ? [recurringCandidate] : [], [], []);
  const recurringMissionMode = recurringAdaptiveControl.available
    ? recurringAdaptiveControl.recommendedMissionMode
    : (schedule.approvalRequired ? 'watch_and_approve' : 'do_now');
  const recurringApprovalPosture = recurringAdaptiveControl.available
    ? recurringAdaptiveControl.recommendedApprovalPosture
    : (schedule.approvalRequired ? 'human_required' : 'auto_low_risk');
  const recurringFrequency = recurringAdaptiveControl.available
    ? recurringAdaptiveControl.recommendedFrequency
    : (String(schedule.cadence || '').toLowerCase().includes('day') ? 'daily' : 'weekly');
  const recurringPaused = recurringAdaptiveControl.available
    ? recurringAdaptiveControl.recommendedPaused
    : false;
  const recurringRoutingDecision = deriveRoutingDecision({
    intent: recurringCandidate?.launchBrief?.objective || schedule.name,
    targetType: 'internal',
    outputType: 'summary',
    mode: 'balanced',
    requiresApproval: schedule.approvalRequired,
    repeat: { frequency: recurringFrequency },
  }, agent, null);
  const connectedSystems = await fetchConnectedSystemsForUser(user.id);
  const launchReadiness = buildExecutionReadiness({
    payload: {
      intent: recurringCandidate?.launchBrief?.objective || schedule.name,
      targetType: 'internal',
      outputType: 'summary',
      missionMode: recurringMissionMode,
      when: 'now',
    },
    routingDecision: recurringRoutingDecision,
    connectedSystems,
  });
  const effectiveRecurringMissionMode = launchReadiness.requiresHumanGate && recurringMissionMode === 'do_now'
    ? 'watch_and_approve'
    : recurringMissionMode;
  let effectiveRecurringApprovalPosture = hardenApprovalLevel(
    recurringApprovalPosture,
    launchReadiness.recommendedApprovalLevel,
  );
  const launchControlContext = await fetchExecutionControlContext(user.id);
  const recurringControlPosture = deriveExecutionControlPosture({
    payload: { missionMode: effectiveRecurringMissionMode },
    executionPosture: getMissionExecutionPosture({
      missionMode: effectiveRecurringMissionMode,
      when: 'now',
    }),
    missionApprovalLevel: effectiveRecurringApprovalPosture,
    routingDecision: recurringRoutingDecision,
    launchReadiness,
    controlContext: launchControlContext,
  });
  const controlledRecurringMissionMode = recurringControlPosture.executionPosture?.missionMode || effectiveRecurringMissionMode;
  effectiveRecurringApprovalPosture = recurringControlPosture.missionApprovalLevel;
  const recurringState = deriveRecurringFlowState({
    missionMode: controlledRecurringMissionMode,
    approvalPosture: effectiveRecurringApprovalPosture,
    paused: recurringPaused,
    priority: schedule.priority ?? 5,
  });
  const recurrenceRule = buildRecurrenceRule({
    frequency: recurringFrequency,
    time: schedule.nextRunAt
      ? new Date(schedule.nextRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : '09:00',
    missionMode: controlledRecurringMissionMode,
    approvalPosture: effectiveRecurringApprovalPosture,
    paused: recurringPaused,
  });
  const routingReason = recurringAdaptiveControl.available
    ? `Schedule launch using recurring adaptive control | ${recurringAdaptiveControl.title.toLowerCase()} | ${recurringAdaptiveControl.detail}${launchReadiness.summary ? ` | readiness ${launchReadiness.summary}` : ''}${recurringControlPosture.controlOrder?.nextMove ? ` | control order ${String(recurringControlPosture.controlOrder.nextMove).replaceAll('_', ' ')}` : ''}`
    : `Schedule launch using current recurring schedule defaults.${launchReadiness.summary ? ` | readiness ${launchReadiness.summary}` : ''}${recurringControlPosture.controlOrder?.nextMove ? ` | control order ${String(recurringControlPosture.controlOrder.nextMove).replaceAll('_', ' ')}` : ''}`;
  const { error } = await supabase
    .from('tasks')
    .insert({
      id: taskId,
      user_id: user.id,
      name: schedule.name,
      status: recurringState.status,
      workflow_status: recurringState.workflowStatus,
      node_type: 'mission',
      root_mission_id: taskId,
      agent_id: schedule.agentId,
      agent_name: agent?.name || 'Unknown',
      provider_override: laneDefaults.provider || inferAgentProvider(agent) || null,
      model_override: laneDefaults.model || agent?.model || null,
      schedule_type: 'recurring',
      recurrence_rule: recurrenceRule,
      lane: recurringState.lane,
      approval_level: recurringState.approvalLevel,
      requires_approval: recurringState.requiresApproval,
      priority: schedule.priority ?? 5,
      title: schedule.name,
      description: recurringCandidate?.launchBrief?.objective || schedule.name,
      routing_reason: routingReason,
      domain: recurringCandidate?.domain || recurringRoutingDecision.domain || 'general',
      intent_type: recurringCandidate?.intentType || recurringRoutingDecision.intentType || 'general',
      budget_class: recurringRoutingDecision.budgetClass || 'balanced',
      risk_level: recurringRoutingDecision.riskLevel || 'medium',
      context_pack_ids: recurringRoutingDecision.contextPackIds || [],
      required_capabilities: recurringRoutingDecision.requiredCapabilities || [],
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

  const reviewMessage = `[review-approve] Review ${reviewId} was approved for live release.`;
  await logBranchEvent({
    userId: user.id,
    type: 'OK',
    message: reviewMessage,
  });
  await persistExecutionControlEvent({
    userId: user.id,
    eventType: 'review_approve',
    eventSource: 'review_room',
    tone: 'amber',
    message: reviewMessage,
    metadata: buildExecutionControlMetadata({
      controlCategory: 'approval',
      actionType: 'review_approve',
      triageVerdict: 'released',
      nextMove: 'publish_review_output',
      approvalState: 'released',
      reviewId,
      reviewDecision: 'approved',
      reason: 'Review-room approval released a pending output.',
    }),
  });

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

  const reviewMessage = `[review-reject] Review ${reviewId} was sent back for revision.${feedback ? ` Feedback: ${feedback}` : ''}`;
  await logBranchEvent({
    userId: user.id,
    type: 'ERR',
    message: reviewMessage,
  });
  await persistExecutionControlEvent({
    userId: user.id,
    eventType: 'review_reject',
    eventSource: 'review_room',
    tone: 'rose',
    message: reviewMessage,
    metadata: buildExecutionControlMetadata({
      controlCategory: 'approval',
      actionType: 'review_reject',
      triageVerdict: 'revision_requested',
      nextMove: 'revise_output',
      approvalState: 'rejected',
      reviewId,
      reviewDecision: 'revision_requested',
      reason: 'Review-room rejection sent the output back for revision.',
      extra: {
        feedback: feedback || '',
      },
    }),
  });

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
