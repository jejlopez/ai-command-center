/**
 * API abstraction layer.
 *
 * Every function returns a Promise so call sites use async/await.
 * Approval queue functions (fetchPendingReviews, approveReview, rejectReview)
 * read/write from Supabase when configured.
 *
 * Static catalog/config helpers remain local until backed by tables.
 *
 * Convention:
 *   fetch*  → read (GET)
 *   create* → insert (POST)
 *   update* → patch (PUT)
 *   delete* → remove (DELETE)
 */

import { supabase } from './supabaseClient';
import {
  mcpServers,
  knowledgeNamespaces,
  directiveTemplates,
  modelBenchmarks,
  systemRecommendations,
  baseCommandItems,
} from '../utils/staticCatalog';

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
  };
}

function mapTaskRow(row) {
  return {
    id:         row.id,
    name:       row.name,
    status:     row.status,
    parentId:   row.parent_id,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
    durationMs: row.duration_ms || 0,
    costUsd:    parseFloat(row.cost_usd) || 0,
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

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchAgents:', error.message);
    return [];
  }
  return data.map(mapAgentRow);
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
    .update({ status: 'pending', duration_ms: 0, cost_usd: 0 })
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
    .update({ status: 'error' })
    .eq('id', taskId);

  if (error) {
    console.error('[api] stopTask:', error.message);
    throw error;
  }
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
  const { error } = await supabase
    .from('tasks')
    .insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      name: schedule.name,
      status: 'pending',
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

export async function fetchMcpServers() {
  return mcpServers;
}

export async function fetchKnowledgeNamespaces() {
  return knowledgeNamespaces;
}

export async function fetchDirectives() {
  return directiveTemplates;
}

export async function fetchModelBenchmarks() {
  return modelBenchmarks;
}

export async function fetchRecommendations() {
  return systemRecommendations;
}

// ── Notifications & Commands ────────────────────────────────────

export async function fetchNotifications() {
  return [];
}

export async function fetchCommandItems() {
  return baseCommandItems;
}
