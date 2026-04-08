/**
 * API abstraction layer.
 *
 * Every function returns a Promise so call sites use async/await.
 * Review Room functions (fetchPendingReviews, approveReview, rejectReview)
 * read/write from Supabase when configured, falling back to mockData
 * when VITE_SUPABASE_URL is not set.
 *
 * All other functions remain mock-backed for now.
 *
 * Convention:
 *   fetch*  → read (GET)
 *   create* → insert (POST)
 *   update* → patch (PUT)
 *   delete* → remove (DELETE)
 */

import { supabase } from './supabaseClient';
import {
  agents as mockAgents,
  tasks as mockTasks,
  activityLog as mockActivityLog,
  pendingReviews as mockPendingReviews,
  completedOutputs as mockCompletedOutputs,
  costData,
  healthMetrics,
  mockSpans,
  memoryChunks,
  modelRegistry,
  skillBank,
  mcpServers,
  knowledgeNamespaces,
  directiveTemplates,
  modelBenchmarks,
  systemRecommendations,
  commandItems,
  generateNotifications,
  approvalAuditTrail,
} from '../utils/mockData';

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
  if (!isSupabaseConfigured) return mockAgents;

  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchAgents:', error.message);
    return mockAgents; // graceful fallback
  }
  return data.map(mapAgentRow);
}

export async function fetchAgentById(id) {
  if (!isSupabaseConfigured) return mockAgents.find(a => a.id === id) ?? null;

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
  if (!isSupabaseConfigured) return mockTasks;

  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[api] fetchTasks:', error.message);
    return mockTasks;
  }
  return data.map(mapTaskRow);
}

// ── Activity Log ────────────────────────────────────────────────

export async function fetchActivityLog(agentId = null) {
  if (!isSupabaseConfigured) {
    if (agentId) return mockActivityLog.filter(l => l.agentId === agentId);
    return mockActivityLog;
  }

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

// ── Execution Spans ─────────────────────────────────────────────

export async function fetchSpans() {
  return mockSpans;
}

// ── Reviews & Outputs ───────────────────────────────────────────

export async function fetchPendingReviews() {
  if (!isSupabaseConfigured) return mockPendingReviews;

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
  if (!isSupabaseConfigured) return mockCompletedOutputs;

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
  if (!isSupabaseConfigured) return approvalAuditTrail;

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

  const channel = supabase
    .channel('pending_reviews_changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'pending_reviews' },
      (payload) => onEvent(payload)
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ── Cost & Health ───────────────────────────────────────────────

export async function fetchCostData() {
  return costData;
}

export async function fetchHealthMetrics() {
  return healthMetrics;
}

// ── Memory ──────────────────────────────────────────────────────

export async function fetchMemoryChunks() {
  return memoryChunks;
}

// ── Intelligence / Config ───────────────────────────────────────

export async function fetchModelRegistry() {
  return modelRegistry;
}

export async function fetchSkillBank() {
  return skillBank;
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
  return generateNotifications();
}

export async function fetchCommandItems() {
  return commandItems;
}
